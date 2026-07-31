import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { Resend } from "resend";
import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";
import {
  createSelfRegisteredMember,
  type MemberAccountPurpose,
} from "@/lib/server/members";
import {
  createConnectionFingerprint,
  getClientAddress,
  getConnectionControl,
  isConnectionBlocked,
  recordSecurityEvent,
  registerConnectionAccount,
} from "@/lib/server/securitySignals";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1024;

const IP_WINDOW_MS =
  60 * 60 * 1000;
const MAX_IP_ATTEMPTS = 5;

const EMAIL_WINDOW_MS =
  60 * 60 * 1000;
const MAX_EMAIL_ATTEMPTS = 3;

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 4096;

const GENERIC_DUPLICATE_MESSAGE =
  "We could not create this account. Try signing in or resetting your password if you may already have an FRDA account.";

class RateLimitError extends Error {}

type TurnstileResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.SITE_URL;

  return configuredUrl
    ? configuredUrl.replace(/\/$/, "")
    : "https://frdaph.org";
}

function normalizeEmail(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function sanitizeDisplayName(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .replace(
      /[\u0000-\u001F\u007F]/g,
      "",
    )
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function normalizeText(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, maxLength)
    : "";
}

function isValidEmail(
  value: string,
): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value,
    )
  );
}

function isAccountPurpose(
  value: unknown,
): value is MemberAccountPurpose {
  return (
    value === "developer" ||
    value === "talent_seeker" ||
    value === "both"
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
      }:${value}`,
    )
    .digest("hex");
}

async function enforceSlidingWindow({
  key,
  windowMs,
  maxAttempts,
}: {
  key: string;
  windowMs: number;
  maxAttempts: number;
}) {
  const reference =
    adminDb
      .collection(
        "membershipRegistrationRateLimits",
      )
      .doc(
        hashRateLimitKey(key),
      );

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
          windowMs;

      const attemptCount =
        activeWindow &&
        typeof data.attemptCount ===
          "number"
          ? data.attemptCount
          : 0;

      if (
        attemptCount >=
        maxAttempts
      ) {
        throw new RateLimitError(
          "Too many account creation attempts were made. Please try again later.",
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
            FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    },
  );
}

async function verifyTurnstile({
  token,
  ipAddress,
}: {
  token: string;
  ipAddress: string;
}): Promise<TurnstileResponse> {
  const secretKey =
    process.env
      .TURNSTILE_SECRET_KEY
      ?.trim();

  if (!secretKey) {
    throw new Error(
      "Missing TURNSTILE_SECRET_KEY.",
    );
  }

  const formData =
    new FormData();

  formData.append(
    "secret",
    secretKey,
  );

  formData.append(
    "response",
    token,
  );

  if (
    ipAddress !== "unknown"
  ) {
    formData.append(
      "remoteip",
      ipAddress,
    );
  }

  const response =
    await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      `Turnstile verification returned ${response.status}.`,
    );
  }

  return (
    await response.json()
  ) as TurnstileResponse;
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendVerificationEmail({
  email,
  displayName,
  verificationUrl,
}: {
  email: string;
  displayName: string;
  verificationUrl: string;
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
    await readFile(logoPath);

  const safeName =
    escapeHtml(displayName);

  const safeUrl =
    escapeHtml(
      verificationUrl,
    );

  const { error } =
    await resend.emails.send({
      from:
        "FRDA Team <admin@frdaph.org>",
      to: [email],
      subject:
        "Verify your FRDA membership email",
      replyTo:
        "admin@frdaph.org",
      html: `
        <div style="margin:0;padding:56px 24px 64px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:40px 32px;box-shadow:0 16px 50px rgba(15,23,42,.08);">
            <div style="text-align:center;margin-bottom:28px;">
              <img src="cid:frda-logo" alt="FRDA logo" style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;" />
            </div>
            <h1 style="margin:0 0 18px;font-size:28px;line-height:1.25;color:#111827;">
              Verify your email address
            </h1>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#374151;">
              Hi ${safeName},
            </p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.75;color:#374151;">
              Confirm your email address to finish setting up your FRDA membership account.
            </p>
            <div style="margin:0 0 30px;">
              <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 24px;border-radius:10px;">
                Verify Email
              </a>
            </div>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.75;color:#6b7280;">
              If the button does not work, copy and paste this link into your browser:
            </p>
            <p style="margin:0;font-size:14px;line-height:1.8;color:#2563eb;word-break:break-word;">
              <a href="${safeUrl}" style="color:#2563eb;text-decoration:underline;">
                ${safeUrl}
              </a>
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename:
            "frda-logo.png",
          content:
            logoBuffer.toString(
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
      "Could not send the verification email.",
    );
  }
}

function getAuthErrorCode(
  error: unknown,
): string {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  )
    ? String(
        (
          error as {
            code?: unknown;
          }
        ).code || "",
      )
    : "";
}

export async function POST(
  request: NextRequest,
) {
  let createdUid = "";
  let createdMemberId = "";

  const ipAddress =
    getClientAddress(request);

  const connectionFingerprint =
    createConnectionFingerprint(
      ipAddress,
    );

  try {
    const connectionControl =
      await getConnectionControl(
        connectionFingerprint,
      );

    if (
      isConnectionBlocked(
        connectionControl,
      )
    ) {
      await recordSecurityEvent({
        eventType:
          "registration_blocked",
        connectionFingerprint,
        outcome: "blocked",
        details: {
          permanentBlock:
            connectionControl
              .permanentBlock,
          blockedUntil:
            connectionControl
              .blockedUntil
              ?.toDate()
              .toISOString() ||
            null,
          reason:
            connectionControl
              .blockReason,
        },
        request,
      });

      return jsonResponse(
        {
          ok: false,
          error:
            "Account creation is temporarily unavailable from this connection. Contact official@frdaph.org if you believe this is an error.",
        },
        403,
      );
    }

    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ||
      "";

    if (
      !contentType.includes(
        "application/json",
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This request format is not supported.",
        },
        415,
      );
    }

    const contentLength =
      Number(
        request.headers.get(
          "content-length",
        ) || "0",
      );

    if (
      Number.isFinite(
        contentLength,
      ) &&
      contentLength >
        MAX_REQUEST_BYTES
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The registration request is too large.",
        },
        413,
      );
    }

    try {
      await enforceSlidingWindow({
        key:
          `ip:${ipAddress}`,
        windowMs:
          IP_WINDOW_MS,
        maxAttempts:
          MAX_IP_ATTEMPTS,
      });
    } catch (error) {
      if (
        error instanceof
        RateLimitError
      ) {
        await recordSecurityEvent({
          eventType:
            "registration_rate_limited",
          connectionFingerprint,
          outcome: "blocked",
          details: {
            scope: "ip",
          },
          request,
        });
      }

      throw error;
    }

    const body =
      await request
        .json()
        .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The registration request is invalid.",
        },
        400,
      );
    }

    const registrationBody =
      body as Record<
        string,
        unknown
      >;

    const displayName =
      sanitizeDisplayName(
        registrationBody
          .displayName ??
        registrationBody
          .fullName,
      );

    const email =
      normalizeEmail(
        registrationBody.email,
      );

    const password =
      typeof registrationBody
        .password === "string"
        ? registrationBody
            .password
        : "";

    const accountPurpose =
      registrationBody
        .accountPurpose;

    const honeypot =
      normalizeText(
        registrationBody
          .companyWebsite,
        300,
      );

    const turnstileToken =
      normalizeText(
        registrationBody
          .turnstileToken,
        4000,
      );

    if (honeypot) {
      await recordSecurityEvent({
        eventType:
          "registration_honeypot",
        connectionFingerprint,
        email,
        displayName,
        outcome: "blocked",
        request,
      });

      return jsonResponse({
        ok: true,
        message:
          "Check your email to finish creating your FRDA membership account.",
      });
    }

    if (!turnstileToken) {
      await recordSecurityEvent({
        eventType:
          "registration_turnstile_failed",
        connectionFingerprint,
        email,
        displayName,
        outcome: "blocked",
        details: {
          reason:
            "missing_token",
        },
        request,
      });

      return jsonResponse(
        {
          ok: false,
          error:
            "Please complete the security check.",
        },
        400,
      );
    }

    const turnstileResult =
      await verifyTurnstile({
        token:
          turnstileToken,
        ipAddress,
      });

    if (
      !turnstileResult.success
    ) {
      await recordSecurityEvent({
        eventType:
          "registration_turnstile_failed",
        connectionFingerprint,
        email,
        displayName,
        outcome: "blocked",
        details: {
          hostname:
            turnstileResult.hostname ||
            "",
          errorCodes:
            turnstileResult[
              "error-codes"
            ] || [],
        },
        request,
      });

      return jsonResponse(
        {
          ok: false,
          error:
            "The security check could not be verified. Please refresh and try again.",
        },
        400,
      );
    }

    if (
      displayName.length < 2
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Enter your developer name or alias.",
        },
        400,
      );
    }

    if (
      !email ||
      !isValidEmail(email)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Enter a valid email address.",
        },
        400,
      );
    }

    try {
      await enforceSlidingWindow({
        key:
          `email:${email}`,
        windowMs:
          EMAIL_WINDOW_MS,
        maxAttempts:
          MAX_EMAIL_ATTEMPTS,
      });
    } catch (error) {
      if (
        error instanceof
        RateLimitError
      ) {
        await recordSecurityEvent({
          eventType:
            "registration_rate_limited",
          connectionFingerprint,
          email,
          displayName,
          outcome: "blocked",
          details: {
            scope: "email",
          },
          request,
        });
      }

      throw error;
    }

    if (
      password.length <
      MIN_PASSWORD_LENGTH
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            `Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
        },
        400,
      );
    }

    if (
      password.length >
      MAX_PASSWORD_LENGTH
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Your password is too long.",
        },
        400,
      );
    }

    if (
      !isAccountPurpose(
        accountPurpose,
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Choose how you plan to use FRDA.",
        },
        400,
      );
    }

    const existingMemberSnapshot =
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
      !existingMemberSnapshot.empty
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            GENERIC_DUPLICATE_MESSAGE,
        },
        409,
      );
    }

    try {
      await adminAuth
        .getUserByEmail(email);

      return jsonResponse(
        {
          ok: false,
          error:
            GENERIC_DUPLICATE_MESSAGE,
        },
        409,
      );
    } catch (error) {
      const code =
        getAuthErrorCode(error);

      if (
        code !==
        "auth/user-not-found"
      ) {
        throw error;
      }
    }

    let createdUser;

    try {
      createdUser =
        await adminAuth
          .createUser({
            email,
            password,
            displayName,
            emailVerified:
              false,
            disabled:
              false,
          });
    } catch (error) {
      const code =
        getAuthErrorCode(error);

      if (
        code ===
        "auth/email-already-exists"
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              GENERIC_DUPLICATE_MESSAGE,
          },
          409,
        );
      }

      throw error;
    }

    createdUid =
      createdUser.uid;

    const member =
      await createSelfRegisteredMember({
        email,
        displayName,
        accountPurpose,
        authUid:
          createdUid,
      });

    createdMemberId =
      member.memberId;

    await registerConnectionAccount({
      connectionFingerprint,
      memberId:
        createdMemberId,
      authUid:
        createdUid,
      email,
      displayName,
      accountPurpose,
      turnstileHostname:
        turnstileResult.hostname ||
        "",
    });

    await Promise.all([
      adminDb
        .collection(
          "members",
        )
        .doc(createdMemberId)
        .set(
          {
            securityConnectionFingerprint:
              connectionFingerprint,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),

      recordSecurityEvent({
        eventType:
          "registration_succeeded",
        connectionFingerprint,
        email,
        memberId:
          createdMemberId,
        authUid:
          createdUid,
        displayName,
        outcome: "allowed",
        details: {
          accountPurpose,
          turnstileHostname:
            turnstileResult.hostname ||
            "",
        },
        request,
      }),
    ]);

    const verificationUrl =
      await adminAuth
        .generateEmailVerificationLink(
          email,
          {
            url:
              `${getBaseUrl()}/member/login?verified=1`,
          },
        );

    await sendVerificationEmail({
      email,
      displayName,
      verificationUrl,
    });

    return jsonResponse({
      ok: true,
      message:
        "Check your email to verify your address, then sign in to your FRDA member account.",
    });
  } catch (error) {
    console.error(
      "Public membership registration error:",
      error,
    );

    if (createdMemberId) {
      await Promise.allSettled([
        adminDb
          .collection("members")
          .doc(createdMemberId)
          .delete(),

        adminDb
          .collection("memberIds")
          .doc(createdMemberId)
          .delete(),
      ]);
    }

    if (createdUid) {
      await Promise.allSettled([
        adminDb
          .collection(
            "developerProfiles",
          )
          .doc(createdUid)
          .delete(),

        adminAuth
          .deleteUser(createdUid),
      ]);
    }

    if (
      error instanceof
      RateLimitError
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            error.message,
        },
        429,
      );
    }

    const code =
      getAuthErrorCode(error);

    if (
      code ===
      "auth/email-already-exists"
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            GENERIC_DUPLICATE_MESSAGE,
        },
        409,
      );
    }

    await recordSecurityEvent({
      eventType:
        "registration_failed",
      connectionFingerprint,
      outcome: "failed",
      details: {
        errorCode: code,
      },
      request,
    }).catch(() => undefined);

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not create your FRDA membership account. Please try again.",
      },
      500,
    );
  }
}