import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const MEMBER_ID_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type MemberAccountPurpose =
  | "developer"
  | "talent_seeker"
  | "both";

export type MemberActor = {
  uid: string;
  email: string;
  staffId: string;
  displayName?: string;
};

export type MemberEntitlements = {
  memberId: string;
  memberListingLimit: number;
  paidListingCredits: number;
  sponsoredPlacementsPurchased: number;
  memberStatus: string;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function generateRandomMemberId(): string {
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    const alphabetIndex = Math.floor(
      Math.random() * MEMBER_ID_ALPHABET.length
    );

    code += MEMBER_ID_ALPHABET[alphabetIndex];
  }

  return `FRDA-M-${code}`;
}

async function generateUniqueMemberId(
  transaction: FirebaseFirestore.Transaction
): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = generateRandomMemberId();

    const memberIdReference = adminDb
      .collection("memberIds")
      .doc(candidate);

    const memberReference = adminDb
      .collection("members")
      .doc(candidate);

    const [memberIdSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(memberIdReference),
      transaction.get(memberReference),
    ]);

    if (!memberIdSnapshot.exists && !memberSnapshot.exists) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique member ID.");
}

export async function ensureMemberForApplication({
  applicationId,
  actor,
}: {
  applicationId: string;
  actor: MemberActor;
}): Promise<MemberEntitlements> {
  const applicationReference = adminDb
    .collection("applications")
    .doc(applicationId);

  return adminDb.runTransaction(async (transaction) => {
    const applicationSnapshot = await transaction.get(
      applicationReference
    );

    if (!applicationSnapshot.exists) {
      throw new Error("Application not found.");
    }

    const application = applicationSnapshot.data() as {
      memberId?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      memberListingLimit?: number;
      paidListingCredits?: number;
      sponsoredPlacementsPurchased?: number;
      memberStatus?: string;
      memberAcceptedAt?: unknown;
    };

    let memberId = application.memberId?.trim() || "";

    if (!memberId) {
      memberId = await generateUniqueMemberId(transaction);
    }

    const normalizedEmail = normalizeEmail(application.email);

    const applicantName = `${application.firstName || ""} ${
      application.lastName || ""
    }`.trim();

    const memberFields: MemberEntitlements = {
      memberId,
      memberListingLimit:
        typeof application.memberListingLimit === "number"
          ? application.memberListingLimit
          : 3,
      paidListingCredits:
        typeof application.paidListingCredits === "number"
          ? application.paidListingCredits
          : 0,
      sponsoredPlacementsPurchased:
        typeof application.sponsoredPlacementsPurchased === "number"
          ? application.sponsoredPlacementsPurchased
          : 0,
      memberStatus: application.memberStatus || "active",
    };

    const memberIdReference = adminDb
      .collection("memberIds")
      .doc(memberId);

    const memberReference = adminDb
      .collection("members")
      .doc(memberId);

    const [memberIdSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(memberIdReference),
      transaction.get(memberReference),
    ]);

    if (!memberIdSnapshot.exists) {
      transaction.set(memberIdReference, {
        memberId,
        applicationId,
        memberDocumentId: memberId,
        applicantEmail: normalizedEmail,
        applicantName,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: actor.uid,
        createdByEmail: actor.email,
        createdByStaffId: actor.staffId,
      });
    } else {
      transaction.set(
        memberIdReference,
        {
          applicationId,
          memberDocumentId: memberId,
          applicantEmail: normalizedEmail,
          applicantName,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (!memberSnapshot.exists) {
      transaction.set(memberReference, {
        memberId,

        email: normalizedEmail,
        normalizedEmail,
        displayName: applicantName,

        accountPurpose: "developer" as MemberAccountPurpose,

        source: "developer_application",
        sourceApplicationId: applicationId,

        authUid: null,
        accountStatus: "invited",
        emailVerified: false,

        profileStatus: "not_started",

        memberListingLimit:
          memberFields.memberListingLimit,
        paidListingCredits:
          memberFields.paidListingCredits,
        sponsoredPlacementsPurchased:
          memberFields.sponsoredPlacementsPurchased,

        memberStatus: memberFields.memberStatus,

        createdAt: FieldValue.serverTimestamp(),
        createdByUid: actor.uid,
        createdByEmail: actor.email,
        createdByStaffId: actor.staffId,

        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(
        memberReference,
        {
          email: normalizedEmail,
          normalizedEmail,
          displayName: applicantName,

          source: "developer_application",
          sourceApplicationId: applicationId,

          memberListingLimit:
            memberFields.memberListingLimit,
          paidListingCredits:
            memberFields.paidListingCredits,
          sponsoredPlacementsPurchased:
            memberFields.sponsoredPlacementsPurchased,

          memberStatus: memberFields.memberStatus,

          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    transaction.update(applicationReference, {
      ...memberFields,

      permanentMemberDocumentId: memberId,

      memberAcceptedAt:
        application.memberAcceptedAt ||
        FieldValue.serverTimestamp(),

      memberIdAssignedAt:
        application.memberId
          ? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),

      memberIdAssignedByUid: actor.uid,
      memberIdAssignedByEmail: actor.email,

      updatedAt: FieldValue.serverTimestamp(),
    });

    return memberFields;
  });
}