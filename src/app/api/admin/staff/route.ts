import path from "path";
import {
  readFile,
} from "fs/promises";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { Resend } from "resend";
import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";
import {
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "Admin",
  "Moderator",
  "Reviewer",
  "Staff",
]);

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

function normalizeEmail(
  value: unknown,
): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .slice(0, 254)
    : "";
}

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function serializeDate(
  value: unknown,
): string | null {
  if (value instanceof Timestamp) {
    return value
      .toDate()
      .toISOString();
  }

  return null;
}

function serializeStaff(
  document:
    FirebaseFirestore.QueryDocumentSnapshot |
    FirebaseFirestore.DocumentSnapshot,
) {
  const data =
    document.data() || {};

  return {
    id: document.id,
    displayName: String(
      data.displayName || "",
    ),
    discordProfile: String(
      data.discordProfile || "",
    ),
    robloxInput: String(
      data.robloxInput || "",
    ),
    emailAddress: String(
      data.emailAddress || "",
    ),
    role: String(
      data.role || "Staff",
    ),
    status: String(
      data.status || "Invited",
    ),
    dateInvited:
      serializeDate(
        data.dateInvited,
      ),
    dateJoined:
      serializeDate(
        data.dateJoined,
      ),
    createdAt:
      serializeDate(
        data.createdAt,
      ),
    updatedAt:
      serializeDate(
        data.updatedAt,
      ),
  };
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendInvite({
  emailAddress,
  displayName,
  role,
}: {
  emailAddress: string;
  displayName: string;
  role: string;
}) {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY.",
    );
  }

  let authUser;

  try {
    authUser =
      await adminAuth
        .getUserByEmail(
          emailAddress,
        );
  } catch (error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String(
            (
              error as {
                code?: unknown;
              }
            ).code || "",
          )
        : "";

    if (
      code !==
      "auth/user-not-found"
    ) {
      throw error;
    }

    authUser =
      await adminAuth
        .createUser({
          email:
            emailAddress,
          displayName,
          emailVerified:
            false,
          disabled:
            false,
        });
  }

  const resetLink =
    await adminAuth
      .generatePasswordResetLink(
        emailAddress,
        {
          url:
            "https://portal.frdaph.org",
          handleCodeInApp:
            false,
        },
      );

  const logoPath =
    path.join(
      process.cwd(),
      "public",
      "frda-logo.png",
    );

  const logoBuffer =
    await readFile(
      logoPath,
    );

  const article =
    /^[aeiou]/i.test(
      role,
    )
      ? "an"
      : "a";

  const roleLine =
    `You’ve been added as ${article} ${role} to FRDA Portal. Click the button below to set your password, activate your account, and access your dashboard.`;

  const resend =
    new Resend(apiKey);

  const { error } =
    await resend.emails.send({
      from:
        "FRDA Team <admin@frdaph.org>",
      to: [emailAddress],
      subject:
        "Set up your FRDA Portal account",
      replyTo:
        "admin@frdaph.org",
      html: `
        <div style="margin:0;padding:56px 24px 64px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:40px 32px;">
            <div style="text-align:center;margin-bottom:28px;">
              <img src="cid:frda-logo" alt="FRDA logo" style="width:64px;height:64px;object-fit:contain;" />
            </div>

            <h1 style="margin:0 0 20px;font-size:30px;color:#111827;">
              Welcome to the FRDA Portal
            </h1>

            <p style="font-size:17px;line-height:1.7;color:#374151;">
              Hi ${escapeHtml(displayName)},
            </p>

            <p style="font-size:17px;line-height:1.7;color:#374151;">
              ${escapeHtml(roleLine)}
            </p>

            <p style="margin:28px 0;">
              <a href="${escapeHtml(resetLink)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:15px 22px;border-radius:8px;">
                Set Your Password
              </a>
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename:
            "frda-logo.png",
          content:
            logoBuffer.toString(
              "base64",
            ),
          contentType:
            "image/png",
          contentId:
            "frda-logo",
        },
      ],
    });

  if (error) {
    throw new Error(
      "The staff invitation email could not be sent.",
    );
  }

  return authUser.uid;
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

  const snapshot =
    await adminDb
      .collection("staff")
      .orderBy(
        "createdAt",
        "desc",
      )
      .get();

  return response({
    ok: true,
    staff: snapshot.docs.map(
      serializeStaff,
    ),
    currentStaffId:
      authorization.staff.id,
    currentRole:
      authorization.staff.role,
  });
}

export async function POST(
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

  const emailAddress =
    normalizeEmail(
      body?.emailAddress,
    );

  const role =
    cleanText(
      body?.role,
      30,
    );

  if (
    !displayName ||
    !discordProfile ||
    !emailAddress ||
    !isValidEmail(
      emailAddress,
    ) ||
    !ALLOWED_ROLES.has(role)
  ) {
    return response(
      {
        ok: false,
        error:
          "Enter valid staff details.",
      },
      400,
    );
  }

  const existingSnapshot =
    await adminDb
      .collection("staff")
      .where(
        "emailAddress",
        "==",
        emailAddress,
      )
      .limit(1)
      .get();

  if (
    !existingSnapshot.empty
  ) {
    return response(
      {
        ok: false,
        error:
          "A staff record already exists for this email address.",
      },
      409,
    );
  }

  const authUid =
    await sendInvite({
      emailAddress,
      displayName,
      role,
    });

  const reference =
    adminDb
      .collection("staff")
      .doc();

  await reference.set({
    displayName,
    discordProfile,
    robloxInput,
    emailAddress,
    normalizedEmail:
      emailAddress,
    authUid,
    role,
    status: "Invited",
    dateInvited:
      FieldValue.serverTimestamp(),
    dateJoined: null,
    createdAt:
      FieldValue.serverTimestamp(),
    createdByUid:
      authorization.staff.uid,
    createdByEmail:
      authorization.staff
        .emailAddress,
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  const created =
    await reference.get();

  return response(
    {
      ok: true,
      staff:
        serializeStaff(
          created,
        ),
    },
    201,
  );
}

export async function PATCH(
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

  const staffId =
    cleanText(
      body?.staffId,
      128,
    );

  const action =
    cleanText(
      body?.action,
      20,
    );

  if (!staffId) {
    return response(
      {
        ok: false,
        error:
          "The staff record is missing.",
      },
      400,
    );
  }

  const reference =
    adminDb
      .collection("staff")
      .doc(staffId);

  const snapshot =
    await reference.get();

  if (!snapshot.exists) {
    return response(
      {
        ok: false,
        error:
          "The staff record was not found.",
      },
      404,
    );
  }

  if (
    staffId ===
      authorization.staff.id &&
    (
      action === "remove" ||
      action === "update"
    )
  ) {
    const nextRole =
      cleanText(
        body?.role,
        30,
      );

    if (
      action === "remove" ||
      (
        nextRole &&
        nextRole !== "Admin"
      )
    ) {
      return response(
        {
          ok: false,
          error:
            "You cannot remove or demote your own administrator account.",
        },
        400,
      );
    }
  }

  if (action === "remove") {
    await reference.set(
      {
        status: "Removed",
        updatedAt:
          FieldValue.serverTimestamp(),
        updatedByUid:
          authorization.staff.uid,
      },
      { merge: true },
    );

    return response({
      ok: true,
    });
  }

  if (action !== "update") {
    return response(
      {
        ok: false,
        error:
          "The requested staff action is invalid.",
      },
      400,
    );
  }

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

  const emailAddress =
    normalizeEmail(
      body?.emailAddress,
    );

  const role =
    cleanText(
      body?.role,
      30,
    );

  if (
    !displayName ||
    !discordProfile ||
    !emailAddress ||
    !isValidEmail(
      emailAddress,
    ) ||
    !ALLOWED_ROLES.has(role)
  ) {
    return response(
      {
        ok: false,
        error:
          "Enter valid staff details.",
      },
      400,
    );
  }

  const data =
    snapshot.data() || {};

  const storedUid =
    typeof data.authUid ===
    "string"
      ? data.authUid
      : "";

  if (
    storedUid &&
    normalizeEmail(
      data.emailAddress,
    ) !== emailAddress
  ) {
    await adminAuth.updateUser(
      storedUid,
      {
        email:
          emailAddress,
        displayName,
      },
    );
  } else if (storedUid) {
    await adminAuth.updateUser(
      storedUid,
      {
        displayName,
      },
    );
  }

  await reference.set(
    {
      displayName,
      discordProfile,
      robloxInput,
      emailAddress,
      normalizedEmail:
        emailAddress,
      role,
      updatedAt:
        FieldValue.serverTimestamp(),
      updatedByUid:
        authorization.staff.uid,
    },
    { merge: true },
  );

  return response({
    ok: true,
  });
}

export async function DELETE(
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

  const url =
    new URL(request.url);

  const staffId =
    cleanText(
      url.searchParams.get(
        "staffId",
      ),
      128,
    );

  if (!staffId) {
    return response(
      {
        ok: false,
        error:
          "The staff record is missing.",
      },
      400,
    );
  }

  if (
    staffId ===
    authorization.staff.id
  ) {
    return response(
      {
        ok: false,
        error:
          "You cannot delete your own administrator account.",
      },
      400,
    );
  }

  const reference =
    adminDb
      .collection("staff")
      .doc(staffId);

  const snapshot =
    await reference.get();

  if (!snapshot.exists) {
    return response(
      {
        ok: false,
        error:
          "The staff record was not found.",
      },
      404,
    );
  }

  const data =
    snapshot.data() || {};

  const authUid =
    typeof data.authUid ===
    "string"
      ? data.authUid
      : "";

  await reference.delete();

  if (authUid) {
    await adminAuth
      .deleteUser(authUid)
      .catch((error) => {
        console.error(
          "Could not delete staff Auth account:",
          error,
        );
      });
  }

  return response({
    ok: true,
  });
}