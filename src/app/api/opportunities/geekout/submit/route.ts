import { createHash } from "crypto";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const SUBMISSION_COLLECTION = "geekOutPortfolioSubmissions";
const RATE_LIMIT_COLLECTION = "geekOutPortfolioRateLimits";

const MIN_SECONDS_BETWEEN_SUBMISSIONS = 30;
const MAX_SUBMISSIONS_PER_24_HOURS = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type TurnstileResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

type RateLimitResult = {
  allowed: boolean;
  count24Hours: number;
  reason?: "too_soon" | "too_many_requests";
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/opportunities/geekout/submit",
    message: "GeekOut portfolio submission route is active.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request.",
        },
        { status: 400 },
      );
    }

    const creatorName = normalizeText(body.creatorName, 100);
    const age =
      typeof body.age === "number"
        ? body.age
        : Number(body.age);

    const robloxProfileUrl = normalizeText(
      body.robloxProfileUrl,
      500,
    );
    const workLink = normalizeText(body.workLink, 500);
    const contribution = normalizeText(body.contribution, 1200);
    const meetingPreference = normalizeText(
      body.meetingPreference,
      30,
    );
    const discordUsername = normalizeText(
      body.discordUsername,
      100,
    );
    const email = normalizeText(body.email, 200).toLowerCase();

    const consentToShare = body.consentToShare === true;
    const futureOpportunities = body.futureOpportunities === true;
    const wantsDiscordInvite = body.wantsDiscordInvite === true;

    const turnstileToken = normalizeText(
      body.turnstileToken,
      3000,
    );

    // Honeypot. Real visitors should leave this blank.
    const companyWebsite = normalizeText(
      body.companyWebsite,
      300,
    );

    if (companyWebsite) {
      return NextResponse.json(
        {
          ok: false,
          error: "The request could not be completed.",
        },
        { status: 400 },
      );
    }

    if (!creatorName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter your creator name, alias, or studio.",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(age) ||
      age < 1 ||
      age > 120
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter your current age.",
        },
        { status: 400 },
      );
    }

    if (!isValidHttpUrl(robloxProfileUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid Roblox profile link.",
        },
        { status: 400 },
      );
    }

    if (!isValidHttpUrl(workLink)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please enter a valid link to your best game or portfolio.",
        },
        { status: 400 },
      );
    }

    if (contribution.length < 20) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please briefly explain what you did on the project.",
        },
        { status: 400 },
      );
    }

    if (
      meetingPreference !== "manila" &&
      meetingPreference !== "online" &&
      meetingPreference !== "either"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please select your meeting availability.",
        },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please provide an email address so FRDA can contact you.",
        },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid email address.",
        },
        { status: 400 },
      );
    }

    if (!consentToShare) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "We need your permission to share the submitted profile with GeekOut.",
        },
        { status: 400 },
      );
    }

    if (!turnstileToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please complete the security check.",
        },
        { status: 400 },
      );
    }

    const ipAddress = getClientIp(request);
    const ipHash = hashValue(ipAddress);

    const rateLimitResult = await checkAndUpdateRateLimit(ipHash);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            rateLimitResult.reason === "too_many_requests"
              ? "Too many submissions have been made from this connection. Please try again later."
              : "Please wait a moment before submitting again.",
        },
        { status: 429 },
      );
    }

    const turnstileResult = await verifyTurnstile({
      token: turnstileToken,
      ipAddress,
    });

    if (!turnstileResult.success) {
      console.warn("Portfolio Turnstile verification failed:", {
        errorCodes: turnstileResult["error-codes"] || [],
        hostname: turnstileResult.hostname || "",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "The security check could not be verified. Please refresh and try again.",
        },
        { status: 400 },
      );
    }

    const submissionRef = await adminDb
      .collection(SUBMISSION_COLLECTION)
      .add({
        creatorName,
        age,
        isMinor: age < 18,

        robloxProfileUrl,
        workLink,
        contribution,
        meetingPreference,
        discordUsername,
        email,

        consentToShare: true,
        futureOpportunities,
        wantsDiscordInvite,

        reviewStatus: "new",
        reviewNote: "",

        candidateInviteGenerated: false,
        candidateInviteUrl: "",
        sentToGeekOut: false,
        selectedByGeekOut: false,

        ipHash,
        submissionCountFromIp24Hours:
          rateLimitResult.count24Hours,

        turnstileHostname: turnstileResult.hostname || "",
        turnstileChallengeTimestamp:
          turnstileResult.challenge_ts || "",

        userAgent: normalizeText(
          request.headers.get("user-agent"),
          500,
        ),

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      ok: true,
      success: true,
      submissionId: submissionRef.id,
    });
  } catch (error) {
    console.error("GeekOut portfolio submission error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          "Something went wrong while submitting your portfolio. Please try again.",
      },
      { status: 500 },
    );
  }
}

async function verifyTurnstile({
  token,
  ipAddress,
}: {
  token: string;
  ipAddress: string;
}): Promise<TurnstileResponse> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing TURNSTILE_SECRET_KEY.");
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  if (ipAddress !== "unknown") {
    formData.append("remoteip", ipAddress);
  }

  const response = await fetch(
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

  return (await response.json()) as TurnstileResponse;
}

async function checkAndUpdateRateLimit(
  ipHash: string,
): Promise<RateLimitResult> {
  const ref = adminDb
    .collection(RATE_LIMIT_COLLECTION)
    .doc(ipHash);

  const now = Date.now();

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    let count24Hours = 0;
    let lastSubmittedAtMs = 0;
    let windowStartedAtMs = now;

    if (snapshot.exists) {
      const data = snapshot.data() as {
        count24Hours?: number;
        lastSubmittedAt?: Timestamp;
        windowStartedAt?: Timestamp;
      };

      lastSubmittedAtMs =
        data.lastSubmittedAt?.toMillis() || 0;

      windowStartedAtMs =
        data.windowStartedAt?.toMillis() || now;

      if (now - windowStartedAtMs < ONE_DAY_MS) {
        count24Hours = Number(data.count24Hours || 0);
      } else {
        count24Hours = 0;
        windowStartedAtMs = now;
      }
    }

    if (
      lastSubmittedAtMs &&
      now - lastSubmittedAtMs <
        MIN_SECONDS_BETWEEN_SUBMISSIONS * 1000
    ) {
      return {
        allowed: false,
        count24Hours,
        reason: "too_soon",
      };
    }

    if (count24Hours >= MAX_SUBMISSIONS_PER_24_HOURS) {
      return {
        allowed: false,
        count24Hours,
        reason: "too_many_requests",
      };
    }

    const nextCount = count24Hours + 1;

    transaction.set(
      ref,
      {
        count24Hours: nextCount,
        windowStartedAt: Timestamp.fromMillis(
          windowStartedAtMs,
        ),
        lastSubmittedAt: Timestamp.fromMillis(now),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      allowed: true,
      count24Hours: nextCount,
    };
  });
}

function normalizeText(
  value: unknown,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function hashValue(value: string): string {
  const salt =
    process.env.OPPORTUNITY_HASH_SALT ||
    process.env.SURVEY_HASH_SALT ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    "frda-geekout";

  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex");
}