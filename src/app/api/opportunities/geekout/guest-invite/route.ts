import { createHash } from "crypto";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const VISITOR_CHANNEL_ID = "1523964531070599319";
const OPPORTUNITY_GUEST_ROLE_ID = "1523920686727561276";

const VISITOR_COLLECTION = "opportunityVisitors";
const RATE_LIMIT_COLLECTION = "opportunityVisitorRateLimits";

const INVITE_MAX_AGE_SECONDS = 60 * 60 * 24;
const INVITE_MAX_USES = 1;

const MIN_SECONDS_BETWEEN_REQUESTS = 60;
const MAX_REQUESTS_PER_24_HOURS = 2;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const ALLOWED_INTERESTS = [
  "geekout_opportunity",
  "future_opportunities",
] as const;

type AllowedInterest =
  (typeof ALLOWED_INTERESTS)[number];

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
    route: "/api/opportunities/geekout/guest-invite",
    message: "GeekOut guest invite route is active.",
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

    const creatorAlias = normalizeText(
      body.creatorAlias,
      100,
    );

    const interests = normalizeInterests(body.interests);

    const rulesAccepted =
      body.rulesAccepted === true;

    const turnstileToken = normalizeText(
      body.turnstileToken,
      3000,
    );

    /*
      Honeypot field.

      Real visitors should never fill this in.
    */
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

    if (!creatorAlias) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter your creator name or alias.",
        },
        { status: 400 },
      );
    }

    if (interests.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please select at least one reason for joining.",
        },
        { status: 400 },
      );
    }

    if (!rulesAccepted) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please agree to the opportunity channel rules.",
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

    const rateLimitResult =
      await checkAndUpdateRateLimit(ipHash);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            rateLimitResult.reason ===
            "too_many_requests"
              ? "The invite request limit has been reached for this connection. Please try again tomorrow."
              : "Please wait a moment before requesting another invite.",
        },
        { status: 429 },
      );
    }

    const turnstileResult =
      await verifyTurnstile({
        token: turnstileToken,
        ipAddress,
      });

    if (!turnstileResult.success) {
      console.warn(
        "Turnstile verification failed:",
        {
          errorCodes:
            turnstileResult["error-codes"] || [],
          hostname:
            turnstileResult.hostname || "",
        },
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "The security check could not be verified. Please refresh the page and try again.",
        },
        { status: 400 },
      );
    }

    const invite =
      await createDiscordGuestInvite();

    const inviteUrl =
      `https://discord.gg/${invite.code}`;

    const visitorRef = await adminDb
      .collection(VISITOR_COLLECTION)
      .add({
        creatorAlias,
        interests,

        rulesAccepted: true,

        status: "submitted",
        reviewStatus: "new",
        reviewNote: "",

        inviteCode: invite.code,
        inviteUrl,
        inviteGenerated: true,
        inviteMaxUses: INVITE_MAX_USES,
        inviteExpiresInSeconds:
          INVITE_MAX_AGE_SECONDS,

        /*
          This records the full date and time.

          We can display it inside the admin page later.
        */
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),

        ipHash,
        submissionCountFromIp24Hours:
          rateLimitResult.count24Hours,

        turnstileHostname:
          turnstileResult.hostname || "",

        turnstileChallengeTimestamp:
          turnstileResult.challenge_ts || "",

        userAgent: normalizeText(
          request.headers.get("user-agent"),
          500,
        ),
      });

    return NextResponse.json({
      ok: true,
      success: true,
      visitorId: visitorRef.id,
      inviteUrl,
      expiresInSeconds:
        INVITE_MAX_AGE_SECONDS,
    });
  } catch (error) {
    console.error(
      "GeekOut guest invite route error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Something went wrong while preparing the Discord invite. Please try again.",
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
  const secretKey =
    process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "Missing TURNSTILE_SECRET_KEY.",
    );
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

  return await response.json();
}

async function createDiscordGuestInvite(): Promise<{
  code: string;
}> {
  const botToken =
    process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    throw new Error(
      "Missing DISCORD_BOT_TOKEN.",
    );
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${VISITOR_CHANNEL_ID}/invites`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_age: INVITE_MAX_AGE_SECONDS,
        max_uses: INVITE_MAX_USES,
        temporary: false,
        unique: true,
        role_ids: [
          OPPORTUNITY_GUEST_ROLE_ID,
        ],
      }),
      cache: "no-store",
    },
  );

  const responseText =
    await response.text();

  let result: unknown = null;

  try {
    result = responseText
      ? JSON.parse(responseText)
      : null;
  } catch {
    result = responseText;
  }

  if (!response.ok) {
    console.error(
      "Discord guest invite creation failed:",
      {
        status: response.status,
        statusText: response.statusText,
        response: result,
        channelId: VISITOR_CHANNEL_ID,
        roleId:
          OPPORTUNITY_GUEST_ROLE_ID,
      },
    );

    throw new Error(
      `Discord returned ${response.status} ${response.statusText}.`,
    );
  }

  if (
    !result ||
    typeof result !== "object" ||
    !("code" in result) ||
    typeof result.code !== "string"
  ) {
    throw new Error(
      "Discord returned an unexpected invite response.",
    );
  }

  return {
    code: result.code,
  };
}

async function checkAndUpdateRateLimit(
  ipHash: string,
): Promise<RateLimitResult> {
  const ref = adminDb
    .collection(RATE_LIMIT_COLLECTION)
    .doc(ipHash);

  const now = Date.now();

  return adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(ref);

      let count24Hours = 0;
      let lastRequestedAtMs = 0;
      let windowStartedAtMs = now;

      if (snapshot.exists) {
        const data = snapshot.data() as {
          count24Hours?: number;
          lastRequestedAt?: Timestamp;
          windowStartedAt?: Timestamp;
        };

        lastRequestedAtMs =
          data.lastRequestedAt?.toMillis() ||
          0;

        windowStartedAtMs =
          data.windowStartedAt?.toMillis() ||
          now;

        if (
          now - windowStartedAtMs <
          ONE_DAY_MS
        ) {
          count24Hours = Number(
            data.count24Hours || 0,
          );
        } else {
          count24Hours = 0;
          windowStartedAtMs = now;
        }
      }

      if (
        lastRequestedAtMs &&
        now - lastRequestedAtMs <
          MIN_SECONDS_BETWEEN_REQUESTS *
            1000
      ) {
        return {
          allowed: false,
          count24Hours,
          reason: "too_soon",
        };
      }

      if (
        count24Hours >=
        MAX_REQUESTS_PER_24_HOURS
      ) {
        return {
          allowed: false,
          count24Hours,
          reason: "too_many_requests",
        };
      }

      const nextCount =
        count24Hours + 1;

      transaction.set(
        ref,
        {
          count24Hours: nextCount,

          windowStartedAt:
            Timestamp.fromMillis(
              windowStartedAtMs,
            ),

          lastRequestedAt:
            Timestamp.fromMillis(now),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        allowed: true,
        count24Hours: nextCount,
      };
    },
  );
}

function normalizeInterests(
  value: unknown,
): AllowedInterest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueValues = new Set<
    AllowedInterest
  >();

  for (const item of value) {
    if (
      typeof item === "string" &&
      ALLOWED_INTERESTS.includes(
        item as AllowedInterest,
      )
    ) {
      uniqueValues.add(
        item as AllowedInterest,
      );
    }
  }

  return [...uniqueValues];
}

function normalizeText(
  value: unknown,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getClientIp(
  request: NextRequest,
): string {
  return (
    request.headers
      .get("cf-connecting-ip")
      ?.trim() ||
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers
      .get("x-real-ip")
      ?.trim() ||
    "unknown"
  );
}

function hashValue(value: string): string {
  const salt =
    process.env.OPPORTUNITY_HASH_SALT ||
    process.env.SURVEY_HASH_SALT ||
    process.env
      .FIREBASE_ADMIN_PROJECT_ID ||
    "frda-opportunity";

  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex");
}