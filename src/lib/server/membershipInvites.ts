import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import type { AuthorizedStaff } from "@/lib/server/adminAuthorization";
import {
  createManualMember,
  ensureMemberForApplication,
  getPermanentMember,
  type MemberAccountPurpose,
} from "@/lib/server/members";

const INVITATION_LIFETIME_MS =
  3 * 24 * 60 * 60 * 1000;

export type MembershipAccountPurpose =
  MemberAccountPurpose;

export type MembershipInviteStatus =
  | "pending"
  | "claimed"
  | "expired"
  | "revoked";

export type SerializedMembershipInvite = {
  id: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  accountPurpose: MembershipAccountPurpose;
  memberId: string;
  sourceApplicationId: string;
  status: MembershipInviteStatus;
  createdAt: string | null;
  expiresAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
  invitedByEmail: string;
  invitedByName: string;
  emailSentAt: string | null;
  emailSendCount: number;
  emailError: string;
};

export type PublicMembershipInvitation = {
  inviteId: string;
  email: string;
  displayName: string;
  accountPurpose: MembershipAccountPurpose;
  memberId: string;
  expiresAt: string;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isTimestamp(value: unknown): value is Timestamp {
  return (
    value instanceof Timestamp ||
    (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate ===
        "function"
    )
  );
}

function timestampToIso(value: unknown): string | null {
  if (!isTimestamp(value)) return null;
  return value.toDate().toISOString();
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashMembershipInvitationToken(
  token: string
): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.SITE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return "https://frdaph.org";
}

function getEffectiveStatus(
  data: FirebaseFirestore.DocumentData
): MembershipInviteStatus {
  const storedStatus = String(data.status || "pending");

  if (storedStatus === "claimed") return "claimed";
  if (storedStatus === "revoked") return "revoked";
  if (storedStatus === "expired") return "expired";

  if (
    isTimestamp(data.expiresAt) &&
    data.expiresAt.toDate().getTime() <= Date.now()
  ) {
    return "expired";
  }

  return "pending";
}

export function serializeMembershipInvite(
  id: string,
  data: FirebaseFirestore.DocumentData
): SerializedMembershipInvite {
  return {
    id,
    email: String(data.email || ""),
    normalizedEmail: String(data.normalizedEmail || ""),
    displayName: String(data.displayName || ""),
    accountPurpose: String(
      data.accountPurpose || "developer"
    ) as MembershipAccountPurpose,
    memberId: String(data.memberId || ""),
    sourceApplicationId: String(
      data.sourceApplicationId || ""
    ),
    status: getEffectiveStatus(data),
    createdAt: timestampToIso(data.createdAt),
    expiresAt: timestampToIso(data.expiresAt),
    claimedAt: timestampToIso(data.claimedAt),
    revokedAt: timestampToIso(data.revokedAt),
    invitedByEmail: String(data.invitedByEmail || ""),
    invitedByName: String(data.invitedByName || ""),
    emailSentAt: timestampToIso(data.emailSentAt),
    emailSendCount:
      typeof data.emailSendCount === "number"
        ? data.emailSendCount
        : 0,
    emailError: String(data.emailError || ""),
  };
}

async function sendMembershipInvitationEmail({
  email,
  displayName,
  activationUrl,
}: {
  email: string;
  displayName: string;
  activationUrl: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const resend = new Resend(resendApiKey);

  const logoPath = path.join(
    process.cwd(),
    "public",
    "frda-logo.png"
  );

  const logoBuffer = await readFile(logoPath);

  const safeName = escapeHtml(displayName || "there");
  const safeActivationUrl = escapeHtml(activationUrl);

  const { error } = await resend.emails.send({
    from: "FRDA Team <admin@frdaph.org>",
    to: [email],
    subject: "Activate your FRDA membership account",
    replyTo: "admin@frdaph.org",
    html: `
      <div style="margin:0;padding:56px 24px 64px 24px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:40px 32px;box-shadow:0 16px 50px rgba(15,23,42,0.08);">
          <div style="text-align:center;margin-bottom:28px;">
            <img
              src="cid:frda-logo"
              alt="FRDA logo"
              style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;"
            />
          </div>

          <h1 style="margin:0 0 18px 0;font-size:28px;line-height:1.25;color:#111827;">
            Activate your FRDA membership account
          </h1>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            Hi ${safeName},
          </p>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            You’ve been invited to create your FRDA membership account.
          </p>

          <p style="margin:0 0 26px 0;font-size:16px;line-height:1.75;color:#374151;">
            Use the button below to set up your account. This invitation is valid for three days and can only be used once.
          </p>

          <div style="margin:0 0 30px 0;">
            <a
              href="${safeActivationUrl}"
              style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 24px;border-radius:10px;"
            >
              Activate Membership
            </a>
          </div>

          <p style="margin:0 0 10px 0;font-size:14px;line-height:1.75;color:#6b7280;">
            If the button doesn’t work, copy and paste this link into your browser:
          </p>

          <p style="margin:0;font-size:14px;line-height:1.8;color:#2563eb;word-break:break-word;">
            <a
              href="${safeActivationUrl}"
              style="color:#2563eb;text-decoration:underline;"
            >
              ${safeActivationUrl}
            </a>
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: "frda-logo.png",
        content: logoBuffer.toString("base64"),
        contentType: "image/png",
        contentId: "frda-logo",
      },
    ],
  });

  if (error) {
    throw new Error(
      "Could not send the membership invitation email."
    );
  }
}

export async function listMembershipInvitations() {
  const snapshot = await adminDb
    .collection("membershipInvites")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((document) =>
    serializeMembershipInvite(
      document.id,
      document.data()
    )
  );
}

export async function createMembershipInvitation({
  email,
  displayName,
  accountPurpose,
  memberId,
  sourceApplicationId,
  staff,
}: {
  email: string;
  displayName: string;
  accountPurpose: MembershipAccountPurpose;
  memberId?: string;
  sourceApplicationId?: string;
  staff: AuthorizedStaff;
}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("A valid email address is required.");
  }

  let resolvedMemberId = memberId?.trim() || "";
  const resolvedApplicationId =
    sourceApplicationId?.trim() || "";

  if (resolvedApplicationId) {
    const assigned = await ensureMemberForApplication({
      applicationId: resolvedApplicationId,
      actor: {
        uid: staff.uid,
        email: staff.emailAddress,
        staffId: staff.id,
        displayName:
          staff.displayName || staff.emailAddress,
      },
    });

    resolvedMemberId = assigned.memberId;

    const member = await getPermanentMember(
      resolvedMemberId
    );

    if (
      !member ||
      member.normalizedEmail !== normalizedEmail
    ) {
      throw new Error(
        "The invitation email does not match the approved application."
      );
    }
  } else if (resolvedMemberId) {
    const member = await getPermanentMember(
      resolvedMemberId
    );

    if (!member) {
      throw new Error(
        "The supplied FRDA Member ID does not exist."
      );
    }

    if (member.normalizedEmail !== normalizedEmail) {
      throw new Error(
        "The invitation email does not match this Member ID."
      );
    }
  } else {
    const created = await createManualMember({
      email: normalizedEmail,
      displayName,
      accountPurpose,
      actor: {
        uid: staff.uid,
        email: staff.emailAddress,
        staffId: staff.id,
        displayName:
          staff.displayName || staff.emailAddress,
      },
    });

    resolvedMemberId = created.memberId;
  }

  const permanentMember = await getPermanentMember(
    resolvedMemberId
  );

  if (!permanentMember) {
    throw new Error(
      "The permanent member record could not be found."
    );
  }

  if (permanentMember.authUid) {
    throw new Error(
      "This member already has an activated account."
    );
  }

  const existingPendingSnapshot = await adminDb
    .collection("membershipInvites")
    .where("normalizedEmail", "==", normalizedEmail)
    .where("status", "==", "pending")
    .get();

  const stillActiveInvite =
    existingPendingSnapshot.docs.find((document) => {
      const data = document.data();

      return (
        isTimestamp(data.expiresAt) &&
        data.expiresAt.toDate().getTime() > Date.now()
      );
    });

  if (stillActiveInvite) {
    throw new Error(
      "This email address already has an active membership invitation."
    );
  }

  const rawToken = generateRawToken();
  const tokenHash =
    hashMembershipInvitationToken(rawToken);

  const expiresAt = Timestamp.fromMillis(
    Date.now() + INVITATION_LIFETIME_MS
  );

  const inviteReference = adminDb
    .collection("membershipInvites")
    .doc();

  const activationUrl =
    `${getBaseUrl()}/register/member?token=` +
    encodeURIComponent(rawToken);

  await inviteReference.set({
    email: normalizedEmail,
    normalizedEmail,
    displayName: displayName.trim(),
    accountPurpose,
    memberId: resolvedMemberId,
    sourceApplicationId: resolvedApplicationId,

    tokenHash,
    status: "pending",

    createdAt: FieldValue.serverTimestamp(),
    expiresAt,

    invitedByStaffId: staff.id,
    invitedByUid: staff.uid,
    invitedByEmail: staff.emailAddress,
    invitedByName:
      staff.displayName || staff.emailAddress,

    emailSentAt: null,
    emailSendCount: 0,
    emailError: "",
    updatedAt: FieldValue.serverTimestamp(),
  });

  await adminDb
    .collection("members")
    .doc(resolvedMemberId)
    .set(
      {
        displayName: displayName.trim(),
        accountPurpose,
        accountStatus: "invited",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  try {
    await sendMembershipInvitationEmail({
      email: normalizedEmail,
      displayName: displayName.trim(),
      activationUrl,
    });

    await inviteReference.update({
      emailSentAt: FieldValue.serverTimestamp(),
      emailSendCount: FieldValue.increment(1),
      emailError: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await inviteReference.update({
      emailError:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown email error.",
      updatedAt: FieldValue.serverTimestamp(),
    });

    throw error;
  }

  const updatedSnapshot = await inviteReference.get();

  return serializeMembershipInvite(
    updatedSnapshot.id,
    updatedSnapshot.data() || {}
  );
}

export async function findValidMembershipInvitation(
  rawToken: string
): Promise<{
  reference: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
  publicInvitation: PublicMembershipInvitation;
}> {
  const token = rawToken.trim();

  if (!token) {
    throw new Error("Missing membership invitation token.");
  }

  const tokenHash =
    hashMembershipInvitationToken(token);

  const snapshot = await adminDb
    .collection("membershipInvites")
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error(
      "This membership invitation is invalid."
    );
  }

  const document = snapshot.docs[0];
  const data = document.data();
  const effectiveStatus = getEffectiveStatus(data);

  if (effectiveStatus === "claimed") {
    throw new Error(
      "This membership invitation has already been used."
    );
  }

  if (effectiveStatus === "revoked") {
    throw new Error(
      "This membership invitation has been revoked."
    );
  }

  if (effectiveStatus === "expired") {
    if (String(data.status || "") === "pending") {
      await document.ref.update({
        status: "expired",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    throw new Error(
      "This membership invitation has expired."
    );
  }

  if (!isTimestamp(data.expiresAt)) {
    throw new Error(
      "This membership invitation has no valid expiration date."
    );
  }

  return {
    reference: document.ref,
    data,
    publicInvitation: {
      inviteId: document.id,
      email: String(data.email || ""),
      displayName: String(data.displayName || ""),
      accountPurpose: String(
        data.accountPurpose || "developer"
      ) as MembershipAccountPurpose,
      memberId: String(data.memberId || ""),
      expiresAt: data.expiresAt
        .toDate()
        .toISOString(),
    },
  };
}

export async function resendMembershipInvitation({
  inviteId,
  staff,
}: {
  inviteId: string;
  staff: AuthorizedStaff;
}) {
  const inviteReference = adminDb
    .collection("membershipInvites")
    .doc(inviteId);

  const inviteSnapshot = await inviteReference.get();

  if (!inviteSnapshot.exists) {
    throw new Error("Membership invitation not found.");
  }

  const invite = inviteSnapshot.data() || {};

  if (String(invite.status || "") === "claimed") {
    throw new Error(
      "This membership invitation has already been claimed."
    );
  }

  if (String(invite.status || "") === "revoked") {
    throw new Error(
      "This membership invitation has been revoked."
    );
  }

  const email = normalizeEmail(
    String(invite.email || "")
  );

  const displayName = String(
    invite.displayName || ""
  );

  if (!email) {
    throw new Error(
      "This membership invitation does not have a valid email address."
    );
  }

  const memberId = String(invite.memberId || "");
  const member = await getPermanentMember(memberId);

  if (!member) {
    throw new Error(
      "The permanent member record could not be found."
    );
  }

  if (member.authUid) {
    throw new Error(
      "This member already has an activated account."
    );
  }

  const rawToken = generateRawToken();
  const tokenHash =
    hashMembershipInvitationToken(rawToken);

  const expiresAt = Timestamp.fromMillis(
    Date.now() + INVITATION_LIFETIME_MS
  );

  const activationUrl =
    `${getBaseUrl()}/register/member?token=` +
    encodeURIComponent(rawToken);

  await inviteReference.update({
    tokenHash,
    status: "pending",
    expiresAt,

    resentAt: FieldValue.serverTimestamp(),
    resentByStaffId: staff.id,
    resentByUid: staff.uid,
    resentByEmail: staff.emailAddress,
    resentByName:
      staff.displayName || staff.emailAddress,

    emailError: "",
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    await sendMembershipInvitationEmail({
      email,
      displayName,
      activationUrl,
    });

    await inviteReference.update({
      emailSentAt: FieldValue.serverTimestamp(),
      emailSendCount: FieldValue.increment(1),
      emailError: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await inviteReference.update({
      emailError:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown email error.",
      updatedAt: FieldValue.serverTimestamp(),
    });

    throw error;
  }

  const updatedSnapshot = await inviteReference.get();

  return serializeMembershipInvite(
    updatedSnapshot.id,
    updatedSnapshot.data() || {}
  );
}

export async function revokeMembershipInvitation({
  inviteId,
  staff,
}: {
  inviteId: string;
  staff: AuthorizedStaff;
}) {
  const inviteReference = adminDb
    .collection("membershipInvites")
    .doc(inviteId);

  const inviteSnapshot = await inviteReference.get();

  if (!inviteSnapshot.exists) {
    throw new Error("Membership invitation not found.");
  }

  const invite = inviteSnapshot.data() || {};

  if (String(invite.status || "") === "claimed") {
    throw new Error(
      "A claimed membership invitation cannot be revoked."
    );
  }

  await inviteReference.update({
    status: "revoked",
    revokedAt: FieldValue.serverTimestamp(),
    revokedByStaffId: staff.id,
    revokedByUid: staff.uid,
    revokedByEmail: staff.emailAddress,
    revokedByName:
      staff.displayName || staff.emailAddress,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await inviteReference.get();

  return serializeMembershipInvite(
    updatedSnapshot.id,
    updatedSnapshot.data() || {}
  );
}