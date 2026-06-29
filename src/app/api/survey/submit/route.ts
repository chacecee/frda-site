import { createHash } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const RESPONSE_COLLECTION = "communitySafetySurveyResponses";
const RATE_LIMIT_COLLECTION = "communitySafetySurveyRateLimits";

const MINIMUM_COMPLETION_TIME_MS = 20_000;
const HARD_BURST_LIMIT_MS = 45_000;
const SOFT_DAILY_LIMIT = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const ALLOWED_EXPERIENCE = new Set([
  "published_experience",
  "programming",
  "creative_assets",
  "game_design",
  "moderation",
  "learning",
  "player",
]);

const ALLOWED_RISKS = new Set([
  "adults_pretending_to_be_children",
  "grooming",
  "off_platform_contact",
  "bullying",
  "sexual_content",
  "violent_content",
  "scams",
  "personal_information",
  "bypassed_protections",
  "parent_awareness",
  "slow_serious_reports",
  "real_world_threats",
  "unsure",
]);

const ALLOWED_CREATOR_ACTIONS = new Set([
  "accurate_labels",
  "community_moderation",
  "safe_social_design",
  "protect_personal_information",
  "clear_reporting",
  "report_serious_concerns",
  "preserve_evidence",
  "parent_information",
  "player_education",
  "none",
  "unsure",
]);

const ALLOWED_ROBLOX_RESPONSIBILITIES = new Set([
  "age_identity_checks",
  "platform_chat_controls",
  "detect_adults_pretending",
  "account_sharing",
  "repeat_offenders",
  "platform_suspensions",
  "experience_review",
  "evidence_preservation",
  "law_enforcement",
  "serious_report_response",
  "unsure",
]);

const ALLOWED_CREDIT_PREFERENCES = new Set([
  "name",
  "alias",
  "anonymous",
]);

const ALLOWED_LOOPHOLE_ANSWERS = new Set(["yes", "no", "unsure"]);

function normalizeText(value: unknown, maximumLength = 1500): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maximumLength);
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeArray(
  value: unknown,
  allowedValues: Set<string>,
  maximumItems = 20
): string[] {
  if (!Array.isArray(value)) return [];

  const unique = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") continue;

    const normalized = item.trim();

    if (allowedValues.has(normalized)) {
      unique.add(normalized);
    }

    if (unique.size >= maximumItems) break;
  }

  return Array.from(unique);
}

function getRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function hashValue(value: string): string {
  const salt =
    process.env.SURVEY_HASH_SALT ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    "frda-survey";

  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex");
}

function normalizeFingerprintText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function createSubmissionFingerprint(input: {
  robloxExperience: string[];
  childSafetyRisks: string[];
  creatorActions: string[];
  robloxResponsibilities: string[];
  riskPatternNotes: string;
  safetyLoopholeDetails: string;
  safetyImprovementIdea: string;
  practicalSolution: string;
  additionalInsight: string;
}): string {
  const normalized = [
    [...input.robloxExperience].sort().join("|"),
    [...input.childSafetyRisks].sort().join("|"),
    [...input.creatorActions].sort().join("|"),
    [...input.robloxResponsibilities].sort().join("|"),
    normalizeFingerprintText(input.riskPatternNotes),
    normalizeFingerprintText(input.safetyLoopholeDetails),
    normalizeFingerprintText(input.safetyImprovementIdea),
    normalizeFingerprintText(input.practicalSolution),
    normalizeFingerprintText(input.additionalInsight),
  ].join("::");

  return createHash("sha256").update(normalized).digest("hex");
}

async function inspectAndUpdateRateLimit(ipHash: string) {
  const ref = adminDb.collection(RATE_LIMIT_COLLECTION).doc(ipHash);
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

      lastSubmittedAtMs = data.lastSubmittedAt?.toMillis() || 0;
      windowStartedAtMs = data.windowStartedAt?.toMillis() || now;

      if (now - windowStartedAtMs < ONE_DAY_MS) {
        count24Hours = Number(data.count24Hours || 0);
      } else {
        count24Hours = 0;
        windowStartedAtMs = now;
      }
    }

    const elapsedSinceLastSubmission = lastSubmittedAtMs
      ? now - lastSubmittedAtMs
      : Number.POSITIVE_INFINITY;

    if (elapsedSinceLastSubmission < HARD_BURST_LIMIT_MS) {
      return {
        blocked: true,
        suspicious: true,
        reason: "rapid_repeat_submission",
        count24Hours,
      };
    }

    const nextCount = count24Hours + 1;
    const suspicious = nextCount > SOFT_DAILY_LIMIT;

    transaction.set(
      ref,
      {
        ipHash,
        count24Hours: nextCount,
        windowStartedAt: Timestamp.fromMillis(windowStartedAtMs),
        lastSubmittedAt: Timestamp.fromMillis(now),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      blocked: false,
      suspicious,
      reason: suspicious ? "high_submission_volume" : "",
      count24Hours: nextCount,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "The submitted response could not be read.",
        },
        { status: 400 }
      );
    }

    const companyWebsite = normalizeText(body.companyWebsite, 250);

    if (companyWebsite) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to submit this response.",
        },
        { status: 400 }
      );
    }

    const formStartedAt = Number(body.formStartedAt);
    const elapsedMs = Date.now() - formStartedAt;

    if (
      !Number.isFinite(formStartedAt) ||
      formStartedAt <= 0 ||
      elapsedMs < MINIMUM_COMPLETION_TIME_MS
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The form was submitted unusually quickly. Please review your answers and try again.",
        },
        { status: 400 }
      );
    }

    const name = normalizeText(body.name, 100);
    const robloxAlias = normalizeText(body.robloxAlias, 100);
    const contactInfo = normalizeText(body.contactInfo, 250);
    const contactPermission = normalizeBoolean(body.contactPermission);

    const rawCreditPreference = normalizeText(
      body.creditPreference,
      20
    );

    const creditPreference = ALLOWED_CREDIT_PREFERENCES.has(
      rawCreditPreference
    )
      ? rawCreditPreference
      : "anonymous";

    const robloxExperience = normalizeArray(
      body.robloxExperience,
      ALLOWED_EXPERIENCE,
      10
    );

    const robloxExperienceOther = normalizeText(
      body.robloxExperienceOther,
      250
    );

    const childSafetyRisks = normalizeArray(
      body.childSafetyRisks,
      ALLOWED_RISKS,
      3
    );

    const childSafetyRisksOther = normalizeText(
      body.childSafetyRisksOther,
      250
    );

    const riskPatternNotes = normalizeText(body.riskPatternNotes, 1500);

    const creatorActions = normalizeArray(
      body.creatorActions,
      ALLOWED_CREATOR_ACTIONS,
      15
    );

    const creatorActionsOther = normalizeText(
      body.creatorActionsOther,
      500
    );

    const robloxResponsibilities = normalizeArray(
      body.robloxResponsibilities,
      ALLOWED_ROBLOX_RESPONSIBILITIES,
      15
    );

    const robloxResponsibilitiesOther = normalizeText(
      body.robloxResponsibilitiesOther,
      500
    );

    const rawLoopholeAnswer = normalizeText(
      body.hasSafetyLoophole,
      20
    );

    const hasSafetyLoophole = ALLOWED_LOOPHOLE_ANSWERS.has(
      rawLoopholeAnswer
    )
      ? rawLoopholeAnswer
      : "";

    const safetyLoopholeDetails = normalizeText(
      body.safetyLoopholeDetails,
      1500
    );

    const safetyImprovementIdea = normalizeText(
      body.safetyImprovementIdea,
      1500
    );

    const practicalSolution = normalizeText(
      body.practicalSolution,
      1500
    );

    const additionalInsight = normalizeText(
      body.additionalInsight,
      1500
    );

    const publicationConsent = normalizeBoolean(
      body.publicationConsent
    );

    if (robloxExperience.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please select at least one option describing your Roblox experience.",
        },
        { status: 400 }
      );
    }

    if (childSafetyRisks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please choose at least one child-safety concern, or select “I’m not sure.”",
        },
        { status: 400 }
      );
    }

    if (creatorActions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please answer what creators or moderators can realistically help with.",
        },
        { status: 400 }
      );
    }

    if (robloxResponsibilities.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please answer which issues mainly require Roblox-level action.",
        },
        { status: 400 }
      );
    }

    if (!hasSafetyLoophole) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please answer the question about possible safety-measure loopholes.",
        },
        { status: 400 }
      );
    }

    if (!practicalSolution) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please share one practical action that could help make Roblox safer.",
        },
        { status: 400 }
      );
    }

    if (!publicationConsent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please confirm how FRDA may summarize and use your response.",
        },
        { status: 400 }
      );
    }

    if (
      creditPreference === "name" &&
      !name
    ) {
      // Missing attribution details should not prevent submission.
      // The response will be treated as anonymous.
    }

    if (
      creditPreference === "alias" &&
      !robloxAlias
    ) {
      // Missing attribution details should not prevent submission.
      // The response will be treated as anonymous.
    }

    const effectiveCreditPreference =
      creditPreference === "name" && name
        ? "name"
        : creditPreference === "alias" && robloxAlias
          ? "alias"
          : "anonymous";

    const ip = getRequestIp(request);
    const ipHash = hashValue(ip);

    const rateResult = await inspectAndUpdateRateLimit(ipHash);

    if (rateResult.blocked) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Another response was submitted from this connection very recently. Please wait a moment and try again.",
        },
        { status: 429 }
      );
    }

    const submissionFingerprint = createSubmissionFingerprint({
      robloxExperience,
      childSafetyRisks,
      creatorActions,
      robloxResponsibilities,
      riskPatternNotes,
      safetyLoopholeDetails,
      safetyImprovementIdea,
      practicalSolution,
      additionalInsight,
    });

    const duplicateSnapshot = await adminDb
      .collection(RESPONSE_COLLECTION)
      .where("submissionFingerprint", "==", submissionFingerprint)
      .limit(5)
      .get();

    const suspiciousReasons: string[] = [];

    if (rateResult.suspicious && rateResult.reason) {
      suspiciousReasons.push(rateResult.reason);
    }

    if (!duplicateSnapshot.empty) {
      suspiciousReasons.push("matching_response_fingerprint");
    }

    const suspicious = suspiciousReasons.length > 0;

    const reviewStatus = suspicious ? "needs_review" : "new";

    const responseRef = await adminDb
      .collection(RESPONSE_COLLECTION)
      .add({
        name,
        robloxAlias,
        contactInfo,
        contactPermission,
        creditPreference: effectiveCreditPreference,

        robloxExperience,
        robloxExperienceOther,

        childSafetyRisks,
        childSafetyRisksOther,
        riskPatternNotes,

        creatorActions,
        creatorActionsOther,

        robloxResponsibilities,
        robloxResponsibilitiesOther,

        hasSafetyLoophole,
        safetyLoopholeDetails:
          hasSafetyLoophole === "yes"
            ? safetyLoopholeDetails
            : "",
        safetyImprovementIdea:
          hasSafetyLoophole === "yes"
            ? safetyImprovementIdea
            : "",

        practicalSolution,
        additionalInsight,

        publicationConsent,

        reviewStatus,
        reviewNote: "",

        suspicious,
        suspiciousReasons,
        submissionFingerprint,
        ipHash,
        submissionCountFromIp24Hours: rateResult.count24Hours,

        formCompletionTimeMs: elapsedMs,
        userAgent: normalizeText(
          request.headers.get("user-agent"),
          500
        ),

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      responseId: responseRef.id,
    });
  } catch (error) {
    console.error("Survey submission route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          "Something went wrong while submitting your response. Please try again.",
      },
      { status: 500 }
    );
  }
}