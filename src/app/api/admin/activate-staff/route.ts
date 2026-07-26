import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
} from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function normalizeEmail(
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

function response(
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

export async function POST(
  request: NextRequest,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return response(
      {
        ok: false,
        error:
          "Missing authentication token.",
      },
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
      "Staff activation token error:",
      error,
    );

    return response(
      {
        ok: false,
        error:
          "Your session is invalid or has expired.",
      },
      401,
    );
  }

  if (
    decodedToken.email_verified !== true
  ) {
    return response(
      {
        ok: false,
        error:
          "Verify your email address before activating staff access.",
      },
      403,
    );
  }

  const email =
    normalizeEmail(
      decodedToken.email,
    );

  if (!email) {
    return response(
      {
        ok: false,
        error:
          "This account does not have a valid email address.",
      },
      403,
    );
  }

  const staffCollection =
    adminDb.collection("staff");

  const uidSnapshot =
    await staffCollection
      .where(
        "authUid",
        "==",
        decodedToken.uid,
      )
      .limit(2)
      .get();

  let staffDocument =
    uidSnapshot.size === 1
      ? uidSnapshot.docs[0]
      : null;

  if (!staffDocument) {
    const normalizedEmailSnapshot =
      await staffCollection
        .where(
          "normalizedEmail",
          "==",
          email,
        )
        .limit(2)
        .get();

    if (
      normalizedEmailSnapshot.size === 1
    ) {
      staffDocument =
        normalizedEmailSnapshot.docs[0];
    }
  }

  if (!staffDocument) {
    const exactEmailSnapshot =
      await staffCollection
        .where(
          "emailAddress",
          "==",
          email,
        )
        .limit(2)
        .get();

    if (
      exactEmailSnapshot.size === 1
    ) {
      staffDocument =
        exactEmailSnapshot.docs[0];
    }
  }

  // Compatibility fallback for older staff records that were saved
  // before normalizedEmail and authUid were added.
  if (!staffDocument) {
    const allStaffSnapshot =
      await staffCollection.get();

    const matches =
      allStaffSnapshot.docs.filter(
        (document) =>
          normalizeEmail(
            String(
              document.data()
                .emailAddress || "",
            ),
          ) === email,
      );

    if (matches.length === 1) {
      staffDocument = matches[0];
    }
  }

  if (!staffDocument) {
    return response(
      {
        ok: false,
        error:
          "No matching invited staff profile was found.",
      },
      403,
    );
  }

  const data =
    staffDocument.data();

  const staffEmail =
    normalizeEmail(
      String(
        data.emailAddress || "",
      ),
    );

  const storedUid =
    typeof data.authUid === "string"
      ? data.authUid.trim()
      : "";

  if (
    staffEmail !== email ||
    (
      storedUid &&
      storedUid !== decodedToken.uid
    )
  ) {
    return response(
      {
        ok: false,
        error:
          "This staff invitation does not match your login.",
      },
      403,
    );
  }

  const status =
    String(
      data.status || "",
    )
      .trim()
      .toLowerCase();

  if (
    status !== "invited" &&
    status !== "active"
  ) {
    return response(
      {
        ok: false,
        error:
          "This staff invitation is no longer active.",
      },
      403,
    );
  }

  await staffDocument.ref.set(
    {
      authUid:
        decodedToken.uid,
      normalizedEmail:
        email,
      emailAddress:
        email,
      status: "Active",
      dateJoined:
        data.dateJoined ||
        FieldValue.serverTimestamp(),
      ...(
        status === "invited"
          ? {
              activatedAt:
                FieldValue.serverTimestamp(),
            }
          : {}
      ),
      updatedAt:
        FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return response({
    ok: true,
    activated:
      status === "invited",
  });
}