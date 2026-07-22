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

export type PermanentMemberRecord = MemberEntitlements & {
  email: string;
  normalizedEmail: string;
  displayName: string;
  accountPurpose: MemberAccountPurpose;
  source: "developer_application" | "manual_invitation" | "self_registration";
  sourceApplicationId: string;
  authUid: string | null;
  accountStatus: string;
  emailVerified: boolean;
  profileStatus: string;
  talentSeekerStatus:
    | "not_required"
    | "not_submitted"
    | "pending"
    | "verified"
    | "rejected"
    | "suspended";
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

    const [memberIdSnapshot, memberSnapshot] =
      await Promise.all([
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

    const [memberIdSnapshot, memberSnapshot] =
      await Promise.all([
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
        talentSeekerStatus: "not_required",

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

      memberIdAssignedAt: FieldValue.serverTimestamp(),
      memberIdAssignedByUid: actor.uid,
      memberIdAssignedByEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return memberFields;
  });
}

export async function createManualMember({
  email,
  displayName,
  accountPurpose,
  actor,
}: {
  email: string;
  displayName: string;
  accountPurpose: MemberAccountPurpose;
  actor: MemberActor;
}): Promise<MemberEntitlements> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("A valid member email address is required.");
  }

  const existingSnapshot = await adminDb
    .collection("members")
    .where("normalizedEmail", "==", normalizedEmail)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const existingDocument = existingSnapshot.docs[0];
    const existing = existingDocument.data();

    return {
      memberId: existingDocument.id,
      memberListingLimit:
        typeof existing.memberListingLimit === "number"
          ? existing.memberListingLimit
          : 3,
      paidListingCredits:
        typeof existing.paidListingCredits === "number"
          ? existing.paidListingCredits
          : 0,
      sponsoredPlacementsPurchased:
        typeof existing.sponsoredPlacementsPurchased === "number"
          ? existing.sponsoredPlacementsPurchased
          : 0,
      memberStatus: String(existing.memberStatus || "active"),
    };
  }

  return adminDb.runTransaction(async (transaction) => {
    const memberId = await generateUniqueMemberId(transaction);

    const memberReference = adminDb
      .collection("members")
      .doc(memberId);

    const memberIdReference = adminDb
      .collection("memberIds")
      .doc(memberId);

    const memberFields: MemberEntitlements = {
      memberId,
      memberListingLimit: 3,
      paidListingCredits: 0,
      sponsoredPlacementsPurchased: 0,
      memberStatus: "active",
    };

    transaction.set(memberReference, {
      ...memberFields,

      email: normalizedEmail,
      normalizedEmail,
      displayName: displayName.trim(),

      accountPurpose,

      source: "manual_invitation",
      sourceApplicationId: "",

      authUid: null,
      accountStatus: "invited",
      emailVerified: false,
      profileStatus: "not_started",
      talentSeekerStatus:
        accountPurpose === "talent_seeker" ||
        accountPurpose === "both"
          ? "not_submitted"
          : "not_required",

      createdAt: FieldValue.serverTimestamp(),
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      createdByStaffId: actor.staffId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(memberIdReference, {
      memberId,
      applicationId: "",
      memberDocumentId: memberId,
      applicantEmail: normalizedEmail,
      applicantName: displayName.trim(),
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      createdByStaffId: actor.staffId,
    });

    return memberFields;
  });
}


export async function createSelfRegisteredMember({
  email,
  displayName,
  accountPurpose,
  authUid,
}: {
  email: string;
  displayName: string;
  accountPurpose: MemberAccountPurpose;
  authUid: string;
}): Promise<{
  memberId: string;
  profileCreated: boolean;
}> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDisplayName = displayName.trim();

  if (!normalizedEmail) {
    throw new Error("A valid email address is required.");
  }

  if (!normalizedDisplayName) {
    throw new Error("A full name is required.");
  }

  if (!authUid.trim()) {
    throw new Error("A Firebase account UID is required.");
  }

  const existingEmailSnapshot = await adminDb
    .collection("members")
    .where("normalizedEmail", "==", normalizedEmail)
    .limit(1)
    .get();

  if (!existingEmailSnapshot.empty) {
    throw new Error(
      "An FRDA membership account already exists for this email address."
    );
  }

  const existingUidSnapshot = await adminDb
    .collection("members")
    .where("authUid", "==", authUid)
    .limit(1)
    .get();

  if (!existingUidSnapshot.empty) {
    throw new Error(
      "This Firebase account is already linked to an FRDA membership."
    );
  }

  const isDeveloper =
    accountPurpose === "developer" ||
    accountPurpose === "both";

  return adminDb.runTransaction(async (transaction) => {
    const memberId = await generateUniqueMemberId(transaction);

    const memberReference = adminDb
      .collection("members")
      .doc(memberId);

    const memberIdReference = adminDb
      .collection("memberIds")
      .doc(memberId);

    transaction.set(memberReference, {
      memberId,

      email: normalizedEmail,
      normalizedEmail,
      displayName: normalizedDisplayName,

      accountPurpose,

      source: "self_registration",
      sourceApplicationId: "",

      authUid,
      accountStatus: "active",
      emailVerified: false,

      profileStatus:
        isDeveloper
          ? "draft"
          : "not_applicable",

      talentSeekerStatus:
        accountPurpose === "talent_seeker" ||
        accountPurpose === "both"
          ? "not_submitted"
          : "not_required",

      memberListingLimit: 3,
      paidListingCredits: 0,
      sponsoredPlacementsPurchased: 0,
      memberStatus: "active",

      createdAt: FieldValue.serverTimestamp(),
      activatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(memberIdReference, {
      memberId,
      applicationId: "",
      memberDocumentId: memberId,
      applicantEmail: normalizedEmail,
      applicantName: normalizedDisplayName,
      source: "self_registration",
      createdAt: FieldValue.serverTimestamp(),
    });

    if (isDeveloper) {
      const profileReference = adminDb
        .collection("developerProfiles")
        .doc(authUid);

      transaction.set(profileReference, {
        uid: authUid,
        memberId,
        email: normalizedEmail,
        displayName: normalizedDisplayName,

        bio: "",
        avatarUrl: "",
        profileSlug: "",
        skills: [],
        availability: "",

        featuredExperiences: [],
        portfolioItems: [],

        profileStatus: "draft",
        isPublished: false,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      memberId,
      profileCreated: isDeveloper,
    };
  });
}

export async function getPermanentMember(
  memberId: string
): Promise<PermanentMemberRecord | null> {
  const normalizedMemberId = memberId.trim();

  if (!normalizedMemberId) {
    return null;
  }

  const snapshot = await adminDb
    .collection("members")
    .doc(normalizedMemberId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() || {};

  return {
    memberId: snapshot.id,
    email: String(data.email || ""),
    normalizedEmail: String(data.normalizedEmail || ""),
    displayName: String(data.displayName || ""),
    accountPurpose: String(
      data.accountPurpose || "developer"
    ) as MemberAccountPurpose,
    source: String(
      data.source || "manual_invitation"
    ) as PermanentMemberRecord["source"],
    sourceApplicationId: String(
      data.sourceApplicationId || ""
    ),
    authUid:
      typeof data.authUid === "string" && data.authUid
        ? data.authUid
        : null,
    accountStatus: String(data.accountStatus || "invited"),
    emailVerified: data.emailVerified === true,
    profileStatus: String(data.profileStatus || "not_started"),
    talentSeekerStatus:
      data.talentSeekerStatus === "not_required" ||
      data.talentSeekerStatus === "not_submitted" ||
      data.talentSeekerStatus === "pending" ||
      data.talentSeekerStatus === "verified" ||
      data.talentSeekerStatus === "rejected" ||
      data.talentSeekerStatus === "suspended"
        ? data.talentSeekerStatus
        : String(data.accountPurpose || "developer") === "talent_seeker" ||
            String(data.accountPurpose || "developer") === "both"
          ? "not_submitted"
          : "not_required",
    memberListingLimit:
      typeof data.memberListingLimit === "number"
        ? data.memberListingLimit
        : 3,
    paidListingCredits:
      typeof data.paidListingCredits === "number"
        ? data.paidListingCredits
        : 0,
    sponsoredPlacementsPurchased:
      typeof data.sponsoredPlacementsPurchased === "number"
        ? data.sponsoredPlacementsPurchased
        : 0,
    memberStatus: String(data.memberStatus || "active"),
  };
}