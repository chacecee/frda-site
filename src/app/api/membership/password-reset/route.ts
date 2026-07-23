import crypto from "crypto";
import {
  readFile,
} from "fs/promises";
import path from "path";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  Resend,
} from "resend";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const RESET_WINDOW_MS =
  60 * 60 * 1000;

const MAX_RESETS_PER_WINDOW =
  5;

function getBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.SITE_URL;

  return configuredUrl
    ? configuredUrl.replace(
        /\/$/,
        "",
      )
    : "https://frdaph.org";
}

function normalizeEmail(
  value: unknown,
): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
    : "";
}

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function getClientAddress(
  request: NextRequest,
): string {
  const forwarded =
    request.headers.get(
      "x-forwarded-for",
    );

  if (forwarded) {
    return (
      forwarded
        .split(",")[0]
        ?.trim() ||
      "unknown"
    );
  }

  return (
    request.headers
      .get("x-real-ip")
      ?.trim() ||
    "unknown"
  );
}

function hashRateLimitKey(
  value: string,
): string {
  return crypto
    .createHash("sha256")
    .update(
      `${
        process.env
          .FIREBASE_ADMIN_PROJECT_ID ||
        "frda"
      }:password-reset:${value}`,
    )
    .digest("hex");
}

async function enforceRateLimit(
  request: NextRequest,
) {
  const addressHash =
    hashRateLimitKey(
      getClientAddress(
        request,
      ),
    );

  const reference =
    adminDb
      .collection(
        "membershipPasswordResetRateLimits",
      )
      .doc(addressHash);

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          reference,
        );

      const data =
        snapshot.data() || {};

      const windowStartedAt =
        data.windowStartedAt;

      const activeWindow =
        windowStartedAt instanceof
          Timestamp &&
        Date.now() -
          windowStartedAt.toMillis() <
          RESET_WINDOW_MS;

      const attemptCount =
        activeWindow &&
        typeof data.attemptCount ===
          "number"
          ? data.attemptCount
          : 0;

      if (
        attemptCount >=
        MAX_RESETS_PER_WINDOW
      ) {
        throw new Error(
          "Too many password reset attempts were made from this connection. Please try again later.",
        );
      }

      transaction.set(
        reference,
        {
          windowStartedAt:
            activeWindow
              ? windowStartedAt
              : Timestamp.now(),

          attemptCount:
            attemptCount + 1,

          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        { merge: true },
      );
    },
  );
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#39;",
    );
}

async function findDisplayName(
  email: string,
): Promise<string> {
  const memberSnapshot =
    await adminDb
      .collection("members")
      .where(
        "normalizedEmail",
        "==",
        email,
      )
      .limit(1)
      .get();

  if (
    !memberSnapshot.empty
  ) {
    const member =
      memberSnapshot.docs[0]
        .data();

    const displayName =
      String(
        member.displayName ||
        "",
      ).trim();

    if (displayName) {
      return displayName;
    }
  }

  try {
    const user =
      await adminAuth
        .getUserByEmail(email);

    return (
      user.displayName?.trim() ||
      "FRDA Member"
    );
  } catch {
    return "FRDA Member";
  }
}

async function sendPasswordResetEmail({
  email,
  displayName,
  resetUrl,
}: {
  email: string;
  displayName: string;
  resetUrl: string;
}) {
  const apiKey =
    process.env
      .RESEND_API_KEY
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY.",
    );
  }

  const resend =
    new Resend(apiKey);

  const logoPath =
    path.join(
      process.cwd(),
      "public",
      "frda-logo.png",
    );

  const logoBuffer =
    await readFile(
      logoPath,
    );

  const safeName =
    escapeHtml(
      displayName,
    );

  const safeUrl =
    escapeHtml(
      resetUrl,
    );

  const { error } =
    await resend.emails.send({
      from:
        "FRDA Team <admin@frdaph.org>",

      to: [email],

      subject:
        "Reset your FRDA password",

      replyTo:
        "admin@frdaph.org",

      html: `
        <div style="margin:0;padding:56px 24px 64px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:40px 32px;box-shadow:0 16px 50px rgba(15,23,42,.08);">
            <div style="text-align:center;margin-bottom:28px;">
              <img src="cid:frda-logo" alt="FRDA logo" style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;" />
            </div>

            <h1 style="margin:0 0 18px;font-size:28px;line-height:1.25;color:#111827;">
              Reset your password
            </h1>

            <p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#374151;">
              Hi ${safeName},
            </p>

            <p style="margin:0 0 24px;font-size:16px;line-height:1.75;color:#374151;">
              We received a request to reset the password for your FRDA Member Account.
            </p>

            <div style="margin:0 0 30px;">
              <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 24px;border-radius:10px;">
                Reset Password
              </a>
            </div>

            <p style="margin:0 0 18px;font-size:14px;line-height:1.75;color:#6b7280;">
              If you did not request this, you can safely ignore this email. Your password will not change unless you open the link and choose a new one.
            </p>

            <p style="margin:0 0 10px;font-size:14px;line-height:1.75;color:#6b7280;">
              If the button does not work, copy and paste this link into your browser:
            </p>

            <p style="margin:0;font-size:14px;line-height:1.8;color:#2563eb;word-break:break-word;">
              <a href="${safeUrl}" style="color:#2563eb;text-decoration:underline;">${safeUrl}</a>
            </p>
          </div>
        </div>
      `,

      attachments: [
        {
          filename:
            "frda-logo.png",

          content:
            logoBuffer
              .toString(
                "base64",
              ),

          contentType:
            "image/png",

          contentId:
            "frda-logo",
        },
      ],
    });

  if (error) {
    throw new Error(
      "Could not send the password reset email.",
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    await enforceRateLimit(
      request,
    );

    const body =
      await request
        .json()
        .catch(() => null);

    const email =
      normalizeEmail(
        body?.email,
      );

    if (
      !email ||
      !isValidEmail(email)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid email address.",
        },
        { status: 400 },
      );
    }

    let userExists = false;

    try {
      await adminAuth
        .getUserByEmail(email);

      userExists = true;
    } catch (error: unknown) {
      const code =
        typeof error ===
          "object" &&
        error !== null &&
        "code" in error
          ? String(
              (
                error as {
                  code?: unknown;
                }
              ).code ||
              "",
            )
          : "";

      if (
        code !==
        "auth/user-not-found"
      ) {
        throw error;
      }
    }

    if (userExists) {
      const [
        resetUrl,
        displayName,
      ] =
        await Promise.all([
          adminAuth
            .generatePasswordResetLink(
              email,
              {
                url:
                  `${getBaseUrl()}/member/login`,
              },
            ),

          findDisplayName(
            email,
          ),
        ]);

      await sendPasswordResetEmail({
        email,
        displayName,
        resetUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "If an FRDA account exists for that address, a password reset email has been sent.",
    });
  } catch (error) {
    console.error(
      "Membership password reset error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "The password reset email could not be sent.";

    const isRateLimit =
      message.includes(
        "Too many password reset attempts",
      );

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status:
          isRateLimit
            ? 429
            : 500,
      },
    );
  }
}