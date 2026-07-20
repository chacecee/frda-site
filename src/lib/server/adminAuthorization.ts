import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export type AuthorizedStaff = {
  uid: string;
  id: string;
  emailAddress: string;
  displayName: string;
  role: string;
  status: string;
};

type AuthorizationSuccess = {
  ok: true;
  staff: AuthorizedStaff;
};

type AuthorizationFailure = {
  ok: false;
  response: NextResponse;
};

export type AdminAuthorizationResult =
  | AuthorizationSuccess
  | AuthorizationFailure;

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeRole(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeStatus(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function getBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

async function findStaffByEmail(
  uid: string,
  email: string
): Promise<AuthorizedStaff | null> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const exactSnapshot = await adminDb
    .collection("staff")
    .where("emailAddress", "==", email)
    .limit(1)
    .get();

  if (!exactSnapshot.empty) {
    const staffDocument = exactSnapshot.docs[0];
    const data = staffDocument.data();

    return {
      uid,
      id: staffDocument.id,
      emailAddress: String(data.emailAddress || email),
      displayName: String(data.displayName || ""),
      role: String(data.role || ""),
      status: String(data.status || ""),
    };
  }

  const allStaffSnapshot = await adminDb.collection("staff").get();

  const matchingDocument = allStaffSnapshot.docs.find((document) => {
    const data = document.data();

    return (
      normalizeEmail(String(data.emailAddress || "")) === normalizedEmail
    );
  });

  if (!matchingDocument) {
    return null;
  }

  const data = matchingDocument.data();

  return {
    uid,
    id: matchingDocument.id,
    emailAddress: String(data.emailAddress || email),
    displayName: String(data.displayName || ""),
    role: String(data.role || ""),
    status: String(data.status || ""),
  };
}

export async function authorizeAdminRequest(
  request: NextRequest,
  permissionKey?: string
): Promise<AdminAuthorizationResult> {
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
    console.error("Admin token verification error:", error);

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

  const staff = await findStaffByEmail(decodedToken.uid, email);

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

  if (normalizeStatus(staff.status) === "removed") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "This staff account has been removed.",
        },
        { status: 403 }
      ),
    };
  }

  if (normalizeRole(staff.role) === "admin") {
    return {
      ok: true,
      staff,
    };
  }

  if (!permissionKey) {
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

  const allowedStaffIds = Array.isArray(permissions?.[permissionKey])
    ? permissions[permissionKey].filter(
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
          error: "You do not have permission to perform this action.",
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