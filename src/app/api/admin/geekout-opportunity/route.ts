import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

type VisitorReviewStatus =
  | "new"
  | "reviewed"
  | "archived"
  | "blocked";

type PortfolioReviewStatus =
  | "new"
  | "reviewing"
  | "needs_clarification"
  | "candidate"
  | "not_a_fit"
  | "sent_to_geekout"
  | "selected_by_geekout"
  | "archived";

type RecordType = "visitor" | "portfolio";

type AuthorizedStaff = {
  id: string;
  emailAddress: string;
  displayName: string;
  role: string;
};

const VISITOR_REVIEW_STATUSES: VisitorReviewStatus[] = [
  "new",
  "reviewed",
  "archived",
  "blocked",
];

const PORTFOLIO_REVIEW_STATUSES: PortfolioReviewStatus[] = [
  "new",
  "reviewing",
  "needs_clarification",
  "candidate",
  "not_a_fit",
  "sent_to_geekout",
  "selected_by_geekout",
  "archived",
];

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeRole(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function isAdminRole(value?: string | null): boolean {
  return normalizeRole(value) === "admin";
}

function getBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function isTimestamp(value: unknown): value is Timestamp {
  return (
    value instanceof Timestamp ||
    (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    )
  );
}

function serializeValue(value: unknown): unknown {
  if (isTimestamp(value)) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeValue(item),
      ])
    );
  }

  return value;
}

function serializeDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
) {
  const serializedData = serializeValue(data);

  return {
    id,
    ...(typeof serializedData === "object" &&
    serializedData !== null &&
    !Array.isArray(serializedData)
      ? serializedData
      : {}),
  };
}

async function findStaffByEmail(
  email: string
): Promise<AuthorizedStaff | null> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return null;

  const exactSnapshot = await adminDb
    .collection("staff")
    .where("emailAddress", "==", email)
    .limit(1)
    .get();

  if (!exactSnapshot.empty) {
    const document = exactSnapshot.docs[0];
    const data = document.data();

    return {
      id: document.id,
      emailAddress: String(data.emailAddress || email),
      displayName: String(data.displayName || ""),
      role: String(data.role || ""),
    };
  }

  /*
    This fallback preserves the same case-insensitive behavior
    already used by the client-side staff lookup.
  */
  const allStaffSnapshot = await adminDb.collection("staff").get();

  const matchingDocument = allStaffSnapshot.docs.find((document) => {
    const data = document.data();

    return (
      normalizeEmail(String(data.emailAddress || "")) ===
      normalizedEmail
    );
  });

  if (!matchingDocument) return null;

  const data = matchingDocument.data();

  return {
    id: matchingDocument.id,
    emailAddress: String(data.emailAddress || email),
    displayName: String(data.displayName || ""),
    role: String(data.role || ""),
  };
}

async function authorizeRequest(
  request: NextRequest
): Promise<
  | {
      ok: true;
      staff: AuthorizedStaff;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Missing authentication token.",
        },
        { status: 401 }
      ),
    };
  }

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.error(
      "GeekOut admin token verification error:",
      error
    );

    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Your session is invalid or has expired.",
        },
        { status: 401 }
      ),
    };
  }

  const email = normalizeEmail(decodedToken.email);

  if (!email) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "This account does not have an email address.",
        },
        { status: 403 }
      ),
    };
  }

  const staff = await findStaffByEmail(email);

  if (!staff) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "No matching FRDA staff profile was found.",
        },
        { status: 403 }
      ),
    };
  }

  if (isAdminRole(staff.role)) {
    return {
      ok: true,
      staff,
    };
  }

  const permissionsSnapshot = await adminDb
    .collection("adminUiPermissions")
    .doc("sidebar")
    .get();

  const permissions = permissionsSnapshot.exists
    ? permissionsSnapshot.data()
    : null;

  const allowedStaffIds = Array.isArray(
    permissions?.admin_community_survey
  )
    ? permissions.admin_community_survey.filter(
        (value: unknown): value is string =>
          typeof value === "string"
      )
    : [];

  if (!allowedStaffIds.includes(staff.id)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "You do not have permission to review GeekOut opportunity submissions.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    staff,
  };
}

async function loadCollection(collectionName: string) {
  const snapshot = await adminDb
    .collection(collectionName)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((document) =>
    serializeDocument(document.id, document.data())
  );
}

function isRecordType(value: unknown): value is RecordType {
  return value === "visitor" || value === "portfolio";
}

function isVisitorReviewStatus(
  value: unknown
): value is VisitorReviewStatus {
  return (
    typeof value === "string" &&
    VISITOR_REVIEW_STATUSES.includes(
      value as VisitorReviewStatus
    )
  );
}

function isPortfolioReviewStatus(
  value: unknown
): value is PortfolioReviewStatus {
  return (
    typeof value === "string" &&
    PORTFOLIO_REVIEW_STATUSES.includes(
      value as PortfolioReviewStatus
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const [visitors, portfolioSubmissions] =
      await Promise.all([
        loadCollection("opportunityVisitors"),
        loadCollection("geekOutPortfolioSubmissions"),
      ]);

    return NextResponse.json({
      ok: true,
      visitors,
      portfolioSubmissions,
    });
  } catch (error) {
    console.error(
      "GeekOut opportunity admin load error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load the GeekOut opportunity records.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const body = (await request.json().catch(() => null)) as
      | {
          recordType?: unknown;
          recordId?: unknown;
          reviewStatus?: unknown;
          reviewNote?: unknown;
        }
      | null;

    if (!body || !isRecordType(body.recordType)) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid record type is required.",
        },
        { status: 400 }
      );
    }

    const recordId =
      typeof body.recordId === "string"
        ? body.recordId.trim()
        : "";

    if (!recordId) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid record ID is required.",
        },
        { status: 400 }
      );
    }

    const reviewNote =
      typeof body.reviewNote === "string"
        ? body.reviewNote.trim().slice(0, 5000)
        : "";

    if (
      body.recordType === "visitor" &&
      !isVisitorReviewStatus(body.reviewStatus)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid visitor review status is required.",
        },
        { status: 400 }
      );
    }

    if (
      body.recordType === "portfolio" &&
      !isPortfolioReviewStatus(body.reviewStatus)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid portfolio review status is required.",
        },
        { status: 400 }
      );
    }

    const collectionName =
      body.recordType === "visitor"
        ? "opportunityVisitors"
        : "geekOutPortfolioSubmissions";

    const recordReference = adminDb
      .collection(collectionName)
      .doc(recordId);

    const existingSnapshot = await recordReference.get();

    if (!existingSnapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error: "The selected record no longer exists.",
        },
        { status: 404 }
      );
    }

    const updateData: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> =
      {
        reviewStatus: body.reviewStatus,
        reviewNote,
        reviewedByEmail:
          authorization.staff.emailAddress,
        reviewedByName:
          authorization.staff.displayName ||
          authorization.staff.emailAddress,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

    /*
      These fields are retained as historical milestones.
      Changing the review status later will not erase them.
    */
    if (
      body.recordType === "portfolio" &&
      (
        body.reviewStatus === "sent_to_geekout" ||
        body.reviewStatus === "selected_by_geekout"
      )
    ) {
      updateData.sentToGeekOut = true;
    }

    if (
      body.recordType === "portfolio" &&
      body.reviewStatus === "selected_by_geekout"
    ) {
      updateData.selectedByGeekOut = true;
    }

    await recordReference.update(updateData);

    const updatedSnapshot = await recordReference.get();

    return NextResponse.json({
      ok: true,
      recordType: body.recordType,
      record: serializeDocument(
        updatedSnapshot.id,
        updatedSnapshot.data() || {}
      ),
    });
  } catch (error) {
    console.error(
      "GeekOut opportunity admin update error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not update the selected GeekOut opportunity record.",
      },
      { status: 500 }
    );
  }
}