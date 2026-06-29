import { NextRequest, NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const RESPONSE_COLLECTION = "communitySafetySurveyResponses";
const PERMISSION_DOCUMENT = "sidebar";
const SURVEY_PERMISSION_KEY = "admin_community_survey";

const ALLOWED_REVIEW_STATUSES = new Set([
  "new",
  "valid",
  "needs_review",
  "excluded",
]);

type StaffAccess = {
  uid: string;
  email: string;
  staffId: string;
  role: string;
};

type SurveyResponseRecord = {
  name?: string;
  robloxAlias?: string;
  contactInfo?: string;
  contactPermission?: boolean;
  creditPreference?: string;

  robloxExperience?: string[];
  robloxExperienceOther?: string;

  childSafetyRisks?: string[];
  childSafetyRisksOther?: string;
  riskPatternNotes?: string;

  creatorActions?: string[];
  creatorActionsOther?: string;

  robloxResponsibilities?: string[];
  robloxResponsibilitiesOther?: string;

  hasSafetyLoophole?: string;
  safetyLoopholeDetails?: string;
  safetyImprovementIdea?: string;

  practicalSolution?: string;
  additionalInsight?: string;

  publicationConsent?: boolean;

  reviewStatus?: string;
  reviewNote?: string;
  reviewedByUid?: string;
  reviewedByEmail?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;

  suspicious?: boolean;
  suspiciousReasons?: string[];
  submissionCountFromIp24Hours?: number;
  formCompletionTimeMs?: number;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type TallyRow = {
  value: string;
  count: number;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeRole(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeText(value: unknown, maximumLength = 2000): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maximumLength);
}

function timestampToIso(value?: Timestamp): string | null {
  if (!value || typeof value.toDate !== "function") return null;
  return value.toDate().toISOString();
}

async function findStaffByEmail(email: string) {
  const exactSnapshot = await adminDb
    .collection("staff")
    .where("emailAddress", "==", email)
    .limit(1)
    .get();

  if (!exactSnapshot.empty) {
    return exactSnapshot.docs[0];
  }

  const allStaffSnapshot = await adminDb.collection("staff").get();

  return (
    allStaffSnapshot.docs.find((docSnap) => {
      const data = docSnap.data() as {
        emailAddress?: string;
      };

      return normalizeEmail(data.emailAddress) === email;
    }) || null
  );
}

async function verifySurveyAccess(
  request: NextRequest
): Promise<StaffAccess | null> {
  try {
    const authHeader = request.headers.get("authorization") || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) return null;

    const decoded = await adminAuth.verifyIdToken(token);
    const email = normalizeEmail(decoded.email);

    if (!email) return null;

    const staffDoc = await findStaffByEmail(email);

    if (!staffDoc) return null;

    const staffData = staffDoc.data() as {
      role?: string;
      status?: string;
    };

    const role = staffData.role?.trim() || "";
    const status = staffData.status?.trim().toLowerCase() || "";

    if (status && status !== "active" && status !== "invited") {
      return null;
    }

    if (normalizeRole(role) === "admin") {
      return {
        uid: decoded.uid,
        email,
        staffId: staffDoc.id,
        role,
      };
    }

    const permissionsSnapshot = await adminDb
      .collection("adminUiPermissions")
      .doc(PERMISSION_DOCUMENT)
      .get();

    const permissionData = permissionsSnapshot.exists
      ? (permissionsSnapshot.data() as Record<string, unknown>)
      : {};

    const permittedStaffIds = Array.isArray(
      permissionData[SURVEY_PERMISSION_KEY]
    )
      ? (permissionData[SURVEY_PERMISSION_KEY] as unknown[]).filter(
          (value): value is string => typeof value === "string"
        )
      : [];

    if (!permittedStaffIds.includes(staffDoc.id)) {
      return null;
    }

    return {
      uid: decoded.uid,
      email,
      staffId: staffDoc.id,
      role,
    };
  } catch (error) {
    console.error("Community survey access verification error:", error);
    return null;
  }
}

function addArrayValuesToMap(
  map: Map<string, number>,
  values?: string[]
) {
  if (!Array.isArray(values)) return;

  values.forEach((value) => {
    const normalized = value?.trim();

    if (!normalized) return;

    map.set(normalized, (map.get(normalized) || 0) + 1);
  });
}

function mapToRows(map: Map<string, number>): TallyRow[] {
  return Array.from(map.entries())
    .map(([value, count]) => ({
      value,
      count,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.value.localeCompare(b.value)
    );
}

function getReviewStatus(value?: string): string {
  const normalized = value?.trim().toLowerCase() || "";

  if (ALLOWED_REVIEW_STATUSES.has(normalized)) {
    return normalized;
  }

  return "new";
}

function getDisplayIdentity(record: SurveyResponseRecord): string {
  const name = record.name?.trim();
  const alias = record.robloxAlias?.trim();

  if (name) return name;
  if (alias) return alias;

  return "Anonymous respondent";
}

function serializeResponse(
  id: string,
  record: SurveyResponseRecord
) {
  return {
    id,

    name: record.name || "",
    robloxAlias: record.robloxAlias || "",
    contactInfo: record.contactInfo || "",
    contactPermission: record.contactPermission === true,
    creditPreference: record.creditPreference || "anonymous",

    robloxExperience: Array.isArray(record.robloxExperience)
      ? record.robloxExperience
      : [],
    robloxExperienceOther:
      record.robloxExperienceOther || "",

    childSafetyRisks: Array.isArray(record.childSafetyRisks)
      ? record.childSafetyRisks
      : [],
    childSafetyRisksOther:
      record.childSafetyRisksOther || "",
    riskPatternNotes: record.riskPatternNotes || "",

    creatorActions: Array.isArray(record.creatorActions)
      ? record.creatorActions
      : [],
    creatorActionsOther:
      record.creatorActionsOther || "",

    robloxResponsibilities: Array.isArray(
      record.robloxResponsibilities
    )
      ? record.robloxResponsibilities
      : [],
    robloxResponsibilitiesOther:
      record.robloxResponsibilitiesOther || "",

    hasSafetyLoophole:
      record.hasSafetyLoophole || "",
    safetyLoopholeDetails:
      record.safetyLoopholeDetails || "",
    safetyImprovementIdea:
      record.safetyImprovementIdea || "",

    practicalSolution:
      record.practicalSolution || "",
    additionalInsight:
      record.additionalInsight || "",

    publicationConsent:
      record.publicationConsent === true,

    reviewStatus: getReviewStatus(record.reviewStatus),
    reviewNote: record.reviewNote || "",

    reviewedByEmail:
      record.reviewedByEmail || "",
    reviewedByName:
      record.reviewedByName || "",
    reviewedAt: timestampToIso(record.reviewedAt),

    suspicious: record.suspicious === true,
    suspiciousReasons: Array.isArray(
      record.suspiciousReasons
    )
      ? record.suspiciousReasons
      : [],
    submissionCountFromIp24Hours:
      Number(record.submissionCountFromIp24Hours || 0),
    formCompletionTimeMs:
      Number(record.formCompletionTimeMs || 0),

    createdAt: timestampToIso(record.createdAt),
    updatedAt: timestampToIso(record.updatedAt),

    displayIdentity: getDisplayIdentity(record),
  };
}

function buildSummary(
  records: Array<{
    id: string;
    data: SurveyResponseRecord;
  }>
) {
  const statusCounts = {
    total: records.length,
    new: 0,
    valid: 0,
    needsReview: 0,
    excluded: 0,
    suspicious: 0,
  };

  const experienceMap = new Map<string, number>();
  const risksMap = new Map<string, number>();
  const creatorActionsMap = new Map<string, number>();
  const robloxResponsibilitiesMap =
    new Map<string, number>();
  const loopholeAnswersMap = new Map<string, number>();

  records.forEach(({ data }) => {
    const status = getReviewStatus(data.reviewStatus);

    if (status === "new") statusCounts.new += 1;
    if (status === "valid") statusCounts.valid += 1;
    if (status === "needs_review") {
      statusCounts.needsReview += 1;
    }
    if (status === "excluded") {
      statusCounts.excluded += 1;
    }
    if (data.suspicious === true) {
      statusCounts.suspicious += 1;
    }

    /*
      Only responses marked Valid contribute to the
      official objective findings.
    */
    if (status !== "valid") return;

    addArrayValuesToMap(
      experienceMap,
      data.robloxExperience
    );

    addArrayValuesToMap(
      risksMap,
      data.childSafetyRisks
    );

    addArrayValuesToMap(
      creatorActionsMap,
      data.creatorActions
    );

    addArrayValuesToMap(
      robloxResponsibilitiesMap,
      data.robloxResponsibilities
    );

    const loopholeAnswer =
      data.hasSafetyLoophole?.trim();

    if (loopholeAnswer) {
      loopholeAnswersMap.set(
        loopholeAnswer,
        (loopholeAnswersMap.get(loopholeAnswer) || 0) + 1
      );
    }
  });

  return {
    statusCounts,
    tallies: {
      robloxExperience: mapToRows(experienceMap),
      childSafetyRisks: mapToRows(risksMap),
      creatorActions: mapToRows(creatorActionsMap),
      robloxResponsibilities: mapToRows(
        robloxResponsibilitiesMap
      ),
      safetyLoopholeAnswers: mapToRows(
        loopholeAnswersMap
      ),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const staffAccess =
      await verifySurveyAccess(request);

    if (!staffAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You do not have permission to view the community survey.",
        },
        { status: 403 }
      );
    }

    const snapshot = await adminDb
      .collection(RESPONSE_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    const records = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as SurveyResponseRecord,
    }));

    return NextResponse.json({
      ok: true,
      responses: records.map(({ id, data }) =>
        serializeResponse(id, data)
      ),
      summary: buildSummary(records),
    });
  } catch (error) {
    console.error(
      "Community survey admin GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load the community survey responses.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const staffAccess =
      await verifySurveyAccess(request);

    if (!staffAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You do not have permission to update the community survey.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    const responseId = normalizeText(body?.responseId, 200);
    const reviewStatus = normalizeText(
      body?.reviewStatus,
      50
    ).toLowerCase();
    const reviewNote = normalizeText(
      body?.reviewNote,
      2000
    );

    if (!responseId) {
      return NextResponse.json(
        {
          ok: false,
          error: "No survey response was selected.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_REVIEW_STATUSES.has(reviewStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The selected review status is not valid.",
        },
        { status: 400 }
      );
    }

    const responseRef = adminDb
      .collection(RESPONSE_COLLECTION)
      .doc(responseId);

    const responseSnapshot = await responseRef.get();

    if (!responseSnapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The selected survey response could not be found.",
        },
        { status: 404 }
      );
    }

    const staffSnapshot = await adminDb
      .collection("staff")
      .doc(staffAccess.staffId)
      .get();

    const staffData = staffSnapshot.exists
      ? (staffSnapshot.data() as {
          displayName?: string;
        })
      : {};

    const reviewerName =
      staffData.displayName?.trim() ||
      staffAccess.email.split("@")[0] ||
      "Staff reviewer";

    await responseRef.update({
      reviewStatus,
      reviewNote,

      reviewedByUid: staffAccess.uid,
      reviewedByEmail: staffAccess.email,
      reviewedByName: reviewerName,
      reviewedAt: FieldValue.serverTimestamp(),

      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedSnapshot = await responseRef.get();

    return NextResponse.json({
      ok: true,
      response: serializeResponse(
        updatedSnapshot.id,
        updatedSnapshot.data() as SurveyResponseRecord
      ),
    });
  } catch (error) {
    console.error(
      "Community survey admin PATCH error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not update the community survey response.",
      },
      { status: 500 }
    );
  }
}