import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";

export const runtime = "nodejs";

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

function cleanText(
  value: unknown,
  maxLength: number,
): string {
  return typeof value === "string"
    ? value
        .replace(
          /[\u0000-\u001F\u007F]/g,
          "",
        )
        .trim()
        .slice(0, maxLength)
    : "";
}

export async function GET(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const [
    staffSnapshot,
    permissionsSnapshot,
  ] = await Promise.all([
    adminDb
      .collection("staff")
      .doc(
        authorization.staff.id,
      )
      .get(),

    adminDb
      .collection(
        "adminUiPermissions",
      )
      .doc("sidebar")
      .get(),
  ]);

  if (!staffSnapshot.exists) {
    return response(
      {
        ok: false,
        error:
          "Your staff profile could not be loaded.",
      },
      404,
    );
  }

  return response({
    ok: true,
    staff: {
      id: staffSnapshot.id,
      ...staffSnapshot.data(),
    },
    permissions:
      permissionsSnapshot.exists
        ? permissionsSnapshot.data()
        : {},
  });
}

export async function PATCH(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const displayName =
    cleanText(
      body?.displayName,
      120,
    );

  const discordProfile =
    cleanText(
      body?.discordProfile,
      200,
    );

  const robloxInput =
    cleanText(
      body?.robloxInput,
      200,
    );

  if (!displayName) {
    return response(
      {
        ok: false,
        error:
          "Display Name is required.",
      },
      400,
    );
  }

  await adminDb
    .collection("staff")
    .doc(
      authorization.staff.id,
    )
    .set(
      {
        displayName,
        discordProfile,
        robloxInput,
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return response({
    ok: true,
    staff: {
      ...authorization.staff,
      displayName,
      discordProfile,
      robloxInput,
    },
  });
}

export async function PUT(
  request: NextRequest,
) {
  const authorization =
    await authorizeAdminRequest(
      request,
      undefined,
      true,
    );

  if (!authorization.ok) {
    return authorization.response;
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const permissionKey =
    cleanText(
      body?.permissionKey,
      100,
    );

  const staffIds =
    Array.isArray(body?.staffIds)
      ? Array.from(
          new Set(
            body.staffIds
              .filter(
                (
                  value: unknown,
                ): value is string =>
                  typeof value ===
                  "string",
              )
              .map((value: string) =>
                value.trim(),
              )
              .filter(Boolean)
              .slice(0, 100),
          ),
        )
      : [];

  if (
    !permissionKey ||
    !/^[a-z0-9_]+$/.test(
      permissionKey,
    )
  ) {
    return response(
      {
        ok: false,
        error:
          "The permission key is invalid.",
      },
      400,
    );
  }

  await adminDb
    .collection(
      "adminUiPermissions",
    )
    .doc("sidebar")
    .set(
      {
        [permissionKey]:
          staffIds,
        updatedAt:
          FieldValue.serverTimestamp(),
        updatedByUid:
          authorization.staff.uid,
        updatedByEmail:
          authorization.staff
            .emailAddress,
      },
      { merge: true },
    );

  return response({
    ok: true,
    permissionKey,
    staffIds,
  });
}