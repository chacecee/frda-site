import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import {
  createSelfRegisteredMember,
  type MemberAccountPurpose,
} from "@/lib/server/members";

export const runtime = "nodejs";

const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_REGISTRATIONS_PER_WINDOW = 5;

function getBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.SITE_URL;

  return configuredUrl
    ? configuredUrl.replace(/\/$/, "")
    : "https://frdaph.org";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function sanitizeName(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, 120)
    : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAccountPurpose(
  value: unknown
): value is MemberAccountPurpose {
  return (
    value === "developer" ||
    value === "talent_seeker" ||
    value === "both"
  );
}

function getClientAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function hashRateLimitKey(value: string): string {
  return crypto
    .createHash("sha256")
    .update(
      `${process.env.FIREBASE_ADMIN_PROJECT_ID || "frda"}:${value}`
    )
    .digest("hex");
}

async function enforceRateLimit(request: NextRequest) {
  const addressHash = hashRateLimitKey(getClientAddress(request));
  const reference = adminDb
    .collection("membershipRegistrationRateLimits")
    .doc(addressHash);

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data() || {};
    const windowStartedAt = data.windowStartedAt;

    const activeWindow =
      windowStartedAt instanceof Timestamp &&
      Date.now() - windowStartedAt.toMillis() < REGISTRATION_WINDOW_MS;

    const attemptCount =
      activeWindow && typeof data.attemptCount === "number"
        ? data.attemptCount
        : 0;

    if (attemptCount >= MAX_REGISTRATIONS_PER_WINDOW) {
      throw new Error(
        "Too many account creation attempts were made from this connection. Please try again later."
      );
    }

    transaction.set(
      reference,
      {
        windowStartedAt:
          activeWindow
            ? windowStartedAt
            : Timestamp.now(),
        attemptCount: attemptCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

function escapeHtml(value: string): string {
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
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const resend = new Resend(apiKey);
  const logoPath = path.join(
    process.cwd(),
    "public",
    "frda-logo.png"
  );
  const logoBuffer = await readFile(logoPath);

  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(verificationUrl);

  const { error } = await resend.emails.send({
    from: "FRDA Team <admin@frdaph.org>",
    to: [email],
    subject: "Verify your FRDA membership email",
    replyTo: "admin@frdaph.org",
    html: `
      <div style="margin:0;padding:56px 24px 64px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:40px 32px;box-shadow:0 16px 50px rgba(15,23,42,.08);">
          <div style="text-align:center;margin-bottom:28px;">
            <img src="cid:frda-logo" alt="FRDA logo" style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;" />
          </div>
          <h1 style="margin:0 0 18px;font-size:28px;line-height:1.25;color:#111827;">Verify your email address</h1>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#374151;">Hi ${safeName},</p>
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
            <a href="${safeUrl}" style="color:#2563eb;text-decoration:underline;">${safeUrl}</a>
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: "frda-logo.png",
        content: logoBuffer.toString("base64"),
        contentType: "image/png",
        contentId: "frda-logo",
      },
    ],
  });

  if (error) {
    throw new Error("Could not send the verification email.");
  }
}

export async function POST(request: NextRequest) {
  let createdUid = "";
  let createdMemberId = "";

  try {
    await enforceRateLimit(request);

    const body = await request.json().catch(() => null);

    const fullName = sanitizeName(body?.fullName);
    const email = normalizeEmail(body?.email);
    const password =
      typeof body?.password === "string"
        ? body.password
        : "";
    const honeypot =
      typeof body?.companyWebsite === "string"
        ? body.companyWebsite.trim()
        : "";

    if (honeypot) {
      return NextResponse.json({
        ok: true,
        message:
          "Check your email to finish creating your FRDA membership account.",
      });
    }

    if (!fullName) {
      return NextResponse.json(
        { ok: false, error: "Your full name is required." },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your password must contain at least eight characters.",
        },
        { status: 400 }
      );
    }

    if (!isAccountPurpose(body?.accountPurpose)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Choose how you plan to use FRDA.",
        },
        { status: 400 }
      );
    }

    const existingMemberSnapshot = await adminDb
      .collection("members")
      .where("normalizedEmail", "==", email)
      .limit(1)
      .get();

    if (!existingMemberSnapshot.empty) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An FRDA membership account already exists for this email address.",
        },
        { status: 409 }
      );
    }

    try {
      const existingUser = await adminAuth.getUserByEmail(email);

      if (existingUser) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "An account already exists for this email address. Try signing in instead.",
          },
          { status: 409 }
        );
      }
    } catch (error: unknown) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String((error as { code?: unknown }).code || "")
          : "";

      if (code !== "auth/user-not-found") {
        throw error;
      }
    }

    const createdUser = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: false,
      disabled: false,
    });

    createdUid = createdUser.uid;

    const member = await createSelfRegisteredMember({
      email,
      displayName: fullName,
      accountPurpose: body.accountPurpose,
      authUid: createdUid,
    });

    createdMemberId = member.memberId;

    const verificationUrl =
      await adminAuth.generateEmailVerificationLink(email, {
        url: `${getBaseUrl()}/member/login?verified=1`,
      });

    await sendVerificationEmail({
      email,
      displayName: fullName,
      verificationUrl,
    });

    return NextResponse.json({
      ok: true,
      memberId: createdMemberId,
      message:
        "Check your email to verify your address, then sign in to your FRDA member account.",
    });
  } catch (error) {
    console.error("Public membership registration error:", error);

    if (createdMemberId) {
      await Promise.allSettled([
        adminDb.collection("members").doc(createdMemberId).delete(),
        adminDb.collection("memberIds").doc(createdMemberId).delete(),
      ]);
    }

    if (createdUid) {
      await Promise.allSettled([
        adminDb.collection("developerProfiles").doc(createdUid).delete(),
        adminAuth.deleteUser(createdUid),
      ]);
    }

    const message =
      error instanceof Error
        ? error.message
        : "Could not create your FRDA membership account.";

    return NextResponse.json(
      { ok: false, error: message },
      {
        status:
          message.includes("already exists") ? 409 : 500,
      }
    );
  }
}