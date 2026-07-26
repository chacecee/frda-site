import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

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

function normalizeEmail(
  value?: string | null,
): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeRole(
  value?: string | null,
): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeStatus(
  value?: string | null,
): string {
  return value?.trim().toLowerCase() || "";
}

function getBearerToken(
  request: NextRequest,
): string {
  const authorization =
    request.headers.get("authorization") || "";

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return "";
  }

  return authorization.slice(7).trim();
}

function denied(
  error: string,
  status: number,
): AuthorizationFailure {
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    ),
  };
}

async function findStaff({
  uid,
  email,
}: {
  uid: string;
  email: string;
}): Promise<AuthorizedStaff | null> {
  const normalizedEmail =
    normalizeEmail(email);

  const uidSnapshot = await adminDb
    .collection("staff")
    .where("authUid", "==", uid)
    .limit(2)
    .get();

  let staffDocument =
    uidSnapshot.size === 1
      ? uidSnapshot.docs[0]
      : null;

  if (!staffDocument) {
    const emailSnapshot = await adminDb
      .collection("staff")
      .where(
        "emailAddress",
        "==",
        normalizedEmail,
      )
      .limit(2)
      .get();

    if (emailSnapshot.size !== 1) {
      return null;
    }

    staffDocument =
      emailSnapshot.docs[0];
  }

  const data =
    staffDocument.data();

  const staffEmail = normalizeEmail(
    String(data.emailAddress || ""),
  );

  if (
    !staffEmail ||
    staffEmail !== normalizedEmail
  ) {
    return null;
  }

  const storedUid =
    typeof data.authUid === "string"
      ? data.authUid.trim()
      : "";

  if (
    storedUid &&
    storedUid !== uid
  ) {
    return null;
  }

  if (!storedUid) {
    await staffDocument.ref.set(
      {
        authUid: uid,
        normalizedEmail,
        updatedAt: new Date(),
      },
      { merge: true },
    );
  }

  return {
    uid,
    id: staffDocument.id,
    emailAddress: staffEmail,
    displayName: String(
      data.displayName || "",
    ),
    role: String(data.role || ""),
    status: String(data.status || ""),
  };
}

export async function authorizeAdminRequest(
  request: NextRequest,
  permissionKey?: string,
  requireAdmin = false,
): Promise<AdminAuthorizationResult> {
  const token =
    getBearerToken(request);

  if (!token) {
    return denied(
      "Missing authentication token.",
      401,
    );
  }

  let decodedToken;

  try {
    decodedToken =
      await adminAuth.verifyIdToken(
        token,
        true,
      );
  } catch (error) {
    console.error(
      "Admin token verification error:",
      error,
    );

    return denied(
      "Your session is invalid or has expired.",
      401,
    );
  }

  if (
    decodedToken.email_verified !== true
  ) {
    return denied(
      "Verify your email address before accessing the FRDA admin portal.",
      403,
    );
  }

  const email =
    normalizeEmail(
      decodedToken.email,
    );

  if (!email) {
    return denied(
      "This account does not have a valid email address.",
      403,
    );
  }

  const staff =
    await findStaff({
      uid: decodedToken.uid,
      email,
    });

  if (!staff) {
    return denied(
      "No matching FRDA staff profile was found.",
      403,
    );
  }

  if (
    normalizeStatus(staff.status) !==
    "active"
  ) {
    return denied(
      "This staff account is not active.",
      403,
    );
  }

  const isAdmin =
    normalizeRole(staff.role) ===
    "admin";

  if (requireAdmin && !isAdmin) {
    return denied(
      "This action is restricted to administrators.",
      403,
    );
  }

  if (
    isAdmin ||
    !permissionKey
  ) {
    return {
      ok: true,
      staff,
    };
  }

  const permissionsSnapshot =
    await adminDb
      .collection(
        "adminUiPermissions",
      )
      .doc("sidebar")
      .get();

  const permissions =
    permissionsSnapshot.exists
      ? permissionsSnapshot.data()
      : null;

  const allowedStaffIds =
    Array.isArray(
      permissions?.[permissionKey],
    )
      ? permissions[
          permissionKey
        ].filter(
          (
            value: unknown,
          ): value is string =>
            typeof value ===
            "string",
        )
      : [];

  if (
    !allowedStaffIds.includes(
      staff.id,
    )
  ) {
    return denied(
      "You do not have permission to perform this action.",
      403,
    );
  }

  return {
    ok: true,
    staff,
  };
}