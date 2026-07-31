import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

import {
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";

import {
  markConnectionSuspension,
} from "@/lib/server/securitySignals";

import {
  DEVELOPER_PREMIUM_LAUNCH_LIMIT,
  hasDeveloperPremiumAccess,
  isEligibleForLaunchPremiumReview,
} from "@/lib/server/developerPremiumLaunch";

export const runtime = "nodejs";

type ReviewAction =
  | "approve"
  | "request_changes"
  | "hide"
  | "grant_premium"
  | "revoke_premium"
  | "suspend_account"
  | "restore_account";

function timestampToIso(
  value: unknown,
): string | null {
  if (
    value instanceof Timestamp ||
    (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (
        value as {
          toDate?: unknown;
        }
      ).toDate === "function"
    )
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toISOString();
  }

  return null;
}

function normalizeExperienceTier(
  value: unknown,
): string {
  return value === "aspiring" ||
    value === "emerging" ||
    value === "established" ||
    value === "experienced"
    ? value
    : "";
}

function normalizeDeliveryScope(
  value: unknown,
): string {
  return value === "full_team" ||
    value ===
    "solo_full_project" ||
    value === "specialist"
    ? value
    : "";
}

function normalizeAccountPurpose(
  value: unknown,
): string {
  return String(
    value || "",
  )
    .trim()
    .toLowerCase();
}

function isDeveloperAccount(
  value: unknown,
): boolean {
  const purpose =
    normalizeAccountPurpose(
      value,
    );

  return (
    purpose === "developer" ||
    purpose === "both"
  );
}

function serializeDeveloperAccount({
  memberId,
  member,
  profile,
  analytics,
  bookmarkCount,
}: {
  memberId: string;

  member:
  FirebaseFirestore.DocumentData;

  profile:
  | FirebaseFirestore.DocumentData
  | null;

  analytics?:
  | FirebaseFirestore.DocumentData
  | null;

  bookmarkCount?: number;
}) {
  const launchPremiumEligible =
    isEligibleForLaunchPremiumReview(
      member,
    );

  const premiumAccess =
    hasDeveloperPremiumAccess(
      member,
    );

  let launchPremiumIneligibilityReason =
    "";

  if (premiumAccess) {
    launchPremiumIneligibilityReason =
      "This developer already has premium access.";
  } else if (
    !launchPremiumEligible
  ) {
    launchPremiumIneligibilityReason =
      "This account was created before the launch cutoff and cannot consume one of the 30 promotional spots.";
  }

  return {
    uid: String(
      member.authUid ||
      profile?.uid ||
      "",
    ),

    memberId,

    email: String(
      member.email ||
      profile?.email ||
      "",
    ),

    displayName:
      String(
        profile?.displayName ||
        member.displayName ||
        "",
      ),

    accountPurpose:
      String(
        member.accountPurpose ||
        "developer",
      ),

    accountStatus:
      String(
        member.accountStatus ||
        "",
      ),

    memberStatus:
      String(
        member.memberStatus ||
        "",
      ),

    accountSuspensionReason:
      String(
        member.accountSuspensionReason ||
        "",
      ),

    accountSuspendedAt:
      timestampToIso(
        member.accountSuspendedAt,
      ),

    accountSuspendedByName:
      String(
        member.accountSuspendedByName ||
        "",
      ),

    accountRestoredAt:
      timestampToIso(
        member.accountRestoredAt,
      ),

    accountRestoredByName:
      String(
        member.accountRestoredByName ||
        "",
      ),

    profileStatus:
      String(
        profile?.profileStatus ||
        member.profileStatus ||
        "not_started",
      ),

    headline:
      String(
        profile?.headline ||
        "",
      ),

    bio:
      String(
        profile?.bio ||
        "",
      ),

    avatarUrl:
      String(
        profile?.avatarUrl ||
        (
          typeof member
            .talentSeekerProfile ===
            "object" &&
            member
              .talentSeekerProfile !==
            null
            ? (
              member
                .talentSeekerProfile as
              Record<
                string,
                unknown
              >
            ).avatarUrl
            : ""
        ) ||
        "",
      ),

    skills:
      Array.isArray(
        profile?.skills,
      )
        ? profile.skills.filter(
          (
            value: unknown,
          ): value is string =>
            typeof value ===
            "string",
        )
        : [],

    availability:
      String(
        profile?.availability ||
        "",
      ),

    experienceTier:
      normalizeExperienceTier(
        profile?.experienceTier,
      ),

    experienceTierIsSelfDeclared:
      profile
        ?.experienceTierIsSelfDeclared ===
      true,

    deliveryScope:
      normalizeDeliveryScope(
        profile?.deliveryScope,
      ),

    portfolioUrl:
      String(
        profile?.portfolioUrl ||
        "",
      ),

    customSubdomain:
      String(
        profile?.customSubdomain ||
        member.customSubdomain ||
        "",
      )
        .trim()
        .toLowerCase(),

    customProfileAddress:
      String(
        profile?.customProfileAddress ||
        (
          profile?.customSubdomain
            ? `https://${String(
              profile.customSubdomain,
            )
              .trim()
              .toLowerCase()}.frdaph.org`
            : ""
        ),
      ),

    profileSlug:
      String(
        profile?.profileSlug ||
        "",
      ),

    isPublished:
      profile?.isPublished === true,

    memberListingLimit:
      typeof member
        .memberListingLimit ===
        "number"
        ? member.memberListingLimit
        : 3,

    paidListingCredits:
      typeof member
        .paidListingCredits ===
        "number"
        ? member.paidListingCredits
        : 0,

    memberCreatedAt:
      timestampToIso(
        member.createdAt,
      ),

    activatedAt:
      timestampToIso(
        member.activatedAt,
      ),

    profileCreatedAt:
      timestampToIso(
        profile?.createdAt,
      ),

    profileUpdatedAt:
      timestampToIso(
        profile?.updatedAt,
      ),

    publicationRequestedAt:
      timestampToIso(
        profile
          ?.publicationRequestedAt,
      ),

    publicationReviewedAt:
      timestampToIso(
        profile
          ?.publicationReviewedAt,
      ),

    publicationReviewedByName:
      String(
        profile
          ?.publicationReviewedByName ||
        "",
      ),

    publicationReviewerNote:
      String(
        profile
          ?.publicationReviewerNote ||
        "",
      ),

    profileViews:
      typeof analytics
        ?.profileViews ===
        "number"
        ? analytics.profileViews
        : 0,

    uniqueProfileViews:
      typeof analytics
        ?.uniqueProfileViews ===
        "number"
        ? analytics
          .uniqueProfileViews
        : 0,

    bookmarkCount:
      typeof bookmarkCount ===
        "number"
        ? bookmarkCount
        : 0,

    contactClicks:
      typeof analytics
        ?.contactClicks ===
        "number"
        ? analytics.contactClicks
        : 0,

    projectViews:
      typeof analytics
        ?.projectViews ===
        "number"
        ? analytics.projectViews
        : 0,

    projectLinkClicks:
      typeof analytics
        ?.projectLinkClicks ===
        "number"
        ? analytics
          .projectLinkClicks
        : 0,

    portfolioClicks:
      typeof analytics
        ?.portfolioClicks ===
        "number"
        ? analytics.portfolioClicks
        : 0,

    developerPremiumStatus:
      String(
        member
          .developerPremiumStatus ||
        "not_eligible",
      ),

    developerPremiumGrantType:
      String(
        member
          .developerPremiumGrantType ||
        "",
      ),

    developerPremiumGrantedAt:
      timestampToIso(
        member
          .developerPremiumGrantedAt,
      ),

    hasPremiumAccess:
      premiumAccess,

    launchPremiumEligible,

    launchPremiumIneligibilityReason,

    securityConnectionFingerprint:
      String(
        member.securityConnectionFingerprint ||
        "",
      ),
  };
}

function isReviewAction(
  value: unknown,
): value is ReviewAction {
  return (
    value === "approve" ||
    value ===
    "request_changes" ||
    value === "hide" ||
    value ===
    "grant_premium" ||
    value ===
    "revoke_premium" ||
    value ===
    "suspend_account" ||
    value ===
    "restore_account"
  );
}

function slugify(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .slice(0, 60);
}

function createProfileSlug({
  displayName,
  memberId,
}: {
  displayName: string;
  memberId: string;
}): string {
  const base =
    slugify(displayName) ||
    "developer";

  const memberSuffix =
    memberId
      .replace(
        /^FRDA-M-/i,
        "",
      )
      .toLowerCase()
      .slice(-5);

  return `${base}-${memberSuffix}`;
}

async function loadDeveloperAccounts() {
  const [
    membersSnapshot,
    profilesSnapshot,
    analyticsSnapshot,
    savesSnapshot,
  ] = await Promise.all([
    adminDb
      .collection("members")
      .get(),

    adminDb
      .collection(
        "developerProfiles",
      )
      .get(),

    adminDb
      .collection(
        "developerAnalytics",
      )
      .get(),

    adminDb
      .collection(
        "developerSaves",
      )
      .get(),
  ]);

  const profileByUid =
    new Map<
      string,
      FirebaseFirestore.DocumentData
    >();

  profilesSnapshot.docs.forEach(
    (
      document,
    ) => {
      profileByUid.set(
        document.id,
        document.data(),
      );
    },
  );

  const analyticsByUid =
    new Map<
      string,
      FirebaseFirestore.DocumentData
    >();

  analyticsSnapshot.docs.forEach(
    (
      document,
    ) => {
      analyticsByUid.set(
        document.id,
        document.data(),
      );
    },
  );

  const bookmarkCountByUid =
    new Map<
      string,
      number
    >();

  savesSnapshot.docs.forEach(
    (
      document,
    ) => {
      const developerUid =
        String(
          document
            .data()
            .developerUid ||
          "",
        );

      if (!developerUid) {
        return;
      }

      bookmarkCountByUid.set(
        developerUid,
        (
          bookmarkCountByUid.get(
            developerUid,
          ) || 0
        ) + 1,
      );
    },
  );

  const accounts =
    membersSnapshot.docs
      .filter(
        (
          document,
        ) =>
          isDeveloperAccount(
            document
              .data()
              .accountPurpose,
          ),
      )
      .map(
        (
          document,
        ) => {
          const member =
            document.data();

          const authUid =
            typeof member.authUid ===
              "string"
              ? member.authUid
              : "";

          const profile =
            authUid
              ? profileByUid.get(
                authUid,
              ) || null
              : null;

          return serializeDeveloperAccount({
            memberId:
              document.id,

            member,

            profile,

            analytics:
              authUid
                ? analyticsByUid.get(
                  authUid,
                ) || null
                : null,

            bookmarkCount:
              authUid
                ? bookmarkCountByUid.get(
                  authUid,
                ) || 0
                : 0,
          });
        },
      );

  accounts.sort(
    (
      first,
      second,
    ) => {
      const firstTime =
        new Date(
          first
            .publicationRequestedAt ||
          first
            .profileUpdatedAt ||
          first.activatedAt ||
          0,
        ).getTime();

      const secondTime =
        new Date(
          second
            .publicationRequestedAt ||
          second
            .profileUpdatedAt ||
          second.activatedAt ||
          0,
        ).getTime();

      return (
        secondTime -
        firstTime
      );
    },
  );

  return accounts;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        "membership_developer_accounts",
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const developers =
      await loadDeveloperAccounts();

    return NextResponse.json({
      ok: true,
      developers,
    });
  } catch (error) {
    console.error(
      "Load developer accounts error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load developer accounts and profiles.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        "membership_developer_accounts",
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body =
      await request
        .json()
        .catch(() => null) as
      | {
        uid?: unknown;
        memberId?: unknown;
        action?: unknown;
        reviewerNote?: unknown;
      }
      | null;

    const uid =
      typeof body?.uid ===
        "string"
        ? body.uid.trim()
        : "";

    const memberId =
      typeof body?.memberId ===
        "string"
        ? body.memberId.trim()
        : "";

    const reviewerNote =
      typeof body
        ?.reviewerNote ===
        "string"
        ? body.reviewerNote
          .trim()
          .slice(0, 3000)
        : "";

    if (
      !uid ||
      !memberId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A developer UID and Member ID are required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isReviewAction(
        body?.action,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid profile-review action is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.action ===
      "request_changes" &&
      !reviewerNote
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add a reviewer note explaining the requested changes.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.action ===
      "suspend_account" &&
      !reviewerNote
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add an internal reason before suspending this account.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.action ===
      "revoke_premium" &&
      !reviewerNote
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add an internal reason before revoking lifetime premium.",
        },
        {
          status: 400,
        },
      );
    }

    const profileReference =
      adminDb
        .collection(
          "developerProfiles",
        )
        .doc(uid);

    const memberReference =
      adminDb
        .collection("members")
        .doc(memberId);

    const requestReference =
      adminDb
        .collection(
          "profilePublicationRequests",
        )
        .doc(uid);

    await adminDb.runTransaction(
      async (
        transaction,
      ) => {
        const [
          profileSnapshot,
          memberSnapshot,
        ] = await Promise.all([
          transaction.get(
            profileReference,
          ),

          transaction.get(
            memberReference,
          ),
        ]);

        if (
          !profileSnapshot.exists
        ) {
          throw new Error(
            "The developer profile no longer exists.",
          );
        }

        if (
          !memberSnapshot.exists
        ) {
          throw new Error(
            "The permanent member record no longer exists.",
          );
        }

        const profile =
          profileSnapshot.data() ||
          {};

        const memberData =
          memberSnapshot.data() ||
          {};

        const currentStatus =
          String(
            profile.profileStatus ||
            "draft",
          );

        const reviewerFields = {
          publicationReviewedAt:
            FieldValue
              .serverTimestamp(),

          publicationReviewedByUid:
            authorization.staff.uid,

          publicationReviewedByEmail:
            authorization.staff
              .emailAddress,

          publicationReviewedByName:
            authorization.staff
              .displayName ||
            authorization.staff
              .emailAddress,

          publicationReviewerNote:
            reviewerNote,

          updatedAt:
            FieldValue
              .serverTimestamp(),
        };

        if (
          body.action ===
          "suspend_account"
        ) {
          if (
            memberData.accountStatus ===
            "suspended" ||
            memberData.memberStatus ===
            "suspended"
          ) {
            throw new Error(
              "This account is already suspended.",
            );
          }

          transaction.set(
            memberReference,
            {
              accountStatus:
                "suspended",

              memberStatus:
                "suspended",

              profileStatus:
                "hidden",

              accountSuspensionReason:
                reviewerNote,

              accountSuspendedAt:
                FieldValue
                  .serverTimestamp(),

              accountSuspendedByUid:
                authorization.staff.uid,

              accountSuspendedByEmail:
                authorization.staff
                  .emailAddress,

              accountSuspendedByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              accountRestoredAt:
                FieldValue.delete(),

              accountRestoredByUid:
                FieldValue.delete(),

              accountRestoredByEmail:
                FieldValue.delete(),

              accountRestoredByName:
                FieldValue.delete(),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            profileReference,
            {
              profileStatus:
                "hidden",

              isPublished: false,

              moderationLock: true,

              moderationNote:
                reviewerNote,

              moderationSource:
                "account_suspension",

              hiddenAt:
                FieldValue
                  .serverTimestamp(),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            requestReference,
            {
              status:
                "account_suspended",

              reviewerNote,

              reviewedAt:
                FieldValue
                  .serverTimestamp(),

              reviewedByUid:
                authorization.staff
                  .uid,

              reviewedByEmail:
                authorization.staff
                  .emailAddress,

              reviewedByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          return;
        }

        if (
          body.action ===
          "restore_account"
        ) {
          if (
            memberData.accountStatus !==
            "suspended" &&
            memberData.memberStatus !==
            "suspended"
          ) {
            throw new Error(
              "This account is not currently suspended.",
            );
          }

          transaction.set(
            memberReference,
            {
              accountStatus:
                "active",

              memberStatus:
                "active",

              profileStatus:
                "draft",

              accountRestoredAt:
                FieldValue
                  .serverTimestamp(),

              accountRestoredByUid:
                authorization.staff.uid,

              accountRestoredByEmail:
                authorization.staff
                  .emailAddress,

              accountRestoredByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            profileReference,
            {
              profileStatus:
                "draft",

              isPublished: false,

              moderationLock: false,

              moderationNote:
                "",

              moderationSource:
                "",

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            requestReference,
            {
              status:
                "account_restored",

              reviewerNote,

              reviewedAt:
                FieldValue
                  .serverTimestamp(),

              reviewedByUid:
                authorization.staff
                  .uid,

              reviewedByEmail:
                authorization.staff
                  .emailAddress,

              reviewedByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          return;
        }

        if (
          body.action ===
          "revoke_premium"
        ) {
          if (
            memberData
              .developerPremiumStatus !==
            "qualified" ||
            memberData
              .developerPremiumGrantType !==
            "launch_lifetime"
          ) {
            throw new Error(
              "Only a launch lifetime premium grant can be revoked through this action.",
            );
          }

          const premiumReference =
            adminDb
              .collection(
                "developerPremiumLaunchGrants",
              )
              .doc(
                "launch_lifetime",
              );

          const premiumSnapshot =
            await transaction.get(
              premiumReference,
            );

          const currentCount =
            typeof premiumSnapshot
              .data()
              ?.approvedCount ===
              "number"
              ? premiumSnapshot
                .data()!
                .approvedCount
              : 0;

          const nextPremiumStatus =
            profile.isPublished ===
              true &&
              currentStatus === "live" &&
              isEligibleForLaunchPremiumReview(
                memberData,
              )
              ? "pending_review"
              : "not_eligible";

          transaction.set(
            memberReference,
            {
              developerPremiumStatus:
                nextPremiumStatus,

              developerPremiumGrantType:
                FieldValue.delete(),

              developerPremiumGrantedAt:
                FieldValue.delete(),

              developerPremiumGrantedByUid:
                FieldValue.delete(),

              developerPremiumGrantedByEmail:
                FieldValue.delete(),

              analyticsAccess:
                "disabled",

              customSubdomainAccess:
                "disabled",

              developerPremiumRevokedAt:
                FieldValue
                  .serverTimestamp(),

              developerPremiumRevokedByUid:
                authorization.staff
                  .uid,

              developerPremiumRevokedByEmail:
                authorization.staff
                  .emailAddress,

              developerPremiumRevokedByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              developerPremiumRevocationReason:
                reviewerNote,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            profileReference,
            {
              developerPremiumStatus:
                nextPremiumStatus,

              developerPremiumGrantType:
                FieldValue.delete(),

              developerPremiumRevokedAt:
                FieldValue
                  .serverTimestamp(),

              developerPremiumRevocationReason:
                reviewerNote,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            premiumReference,
            {
              approvedCount:
                Math.max(
                  0,
                  currentCount - 1,
                ),

              limit:
                DEVELOPER_PREMIUM_LAUNCH_LIMIT,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            adminDb
              .collection(
                "memberNotifications",
              )
              .doc(),
            {
              memberId,

              type:
                "developer_premium_revoked",

              title:
                "Profile Premium removed",

              message:
                "Your Lifetime Profile Premium was removed. Contact FRDA if you believe this was an error.",

              href:
                "/member/dashboard",

              isRead: false,

              createdAt:
                FieldValue
                  .serverTimestamp(),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
          );

          return;
        }


        if (
          body.action ===
          "grant_premium"
        ) {
          if (
            profile.isPublished !==
            true ||
            currentStatus !== "live"
          ) {
            throw new Error(
              "Only a published profile can receive launch lifetime premium.",
            );
          }

          if (
            hasDeveloperPremiumAccess(
              memberData,
            )
          ) {
            throw new Error(
              "This developer already has premium access.",
            );
          }

          if (
            !isEligibleForLaunchPremiumReview(
              memberData,
            )
          ) {
            throw new Error(
              "This account is not eligible for one of the 30 launch premium spots.",
            );
          }

          if (
            memberData
              .developerPremiumStatus !==
            "pending_review"
          ) {
            throw new Error(
              "This profile is not awaiting launch premium review.",
            );
          }

          const premiumReference =
            adminDb
              .collection(
                "developerPremiumLaunchGrants",
              )
              .doc(
                "launch_lifetime",
              );

          const premiumSnapshot =
            await transaction.get(
              premiumReference,
            );

          const currentCount =
            typeof premiumSnapshot
              .data()
              ?.approvedCount ===
              "number"
              ? premiumSnapshot
                .data()!
                .approvedCount
              : 0;

          if (
            currentCount >=
            DEVELOPER_PREMIUM_LAUNCH_LIMIT
          ) {
            throw new Error(
              "All 30 lifetime premium launch spots have already been awarded.",
            );
          }

          transaction.set(
            memberReference,
            {
              developerPremiumStatus:
                "qualified",

              developerPremiumGrantType:
                "launch_lifetime",

              developerPremiumGrantedAt:
                FieldValue
                  .serverTimestamp(),

              developerPremiumGrantedByUid:
                authorization.staff
                  .uid,

              developerPremiumGrantedByEmail:
                authorization.staff
                  .emailAddress,

              analyticsAccess:
                "pro",

              customSubdomainAccess:
                "premium",

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            profileReference,
            {
              developerPremiumStatus:
                "qualified",

              developerPremiumGrantType:
                "launch_lifetime",

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            premiumReference,
            {
              approvedCount:
                currentCount + 1,

              limit:
                DEVELOPER_PREMIUM_LAUNCH_LIMIT,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            adminDb
              .collection(
                "memberNotifications",
              )
              .doc(),
            {
              memberId,

              type:
                "developer_premium_qualified",

              title:
                "Lifetime premium unlocked",

              message:
                "Congratulations! Your developer profile has qualified for lifetime FRDA Profile Premium.",

              href:
                "/member/dashboard",

              isRead: false,

              createdAt:
                FieldValue
                  .serverTimestamp(),

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
          );

          return;
        }

        if (
          body.action ===
          "approve"
        ) {
          if (
            currentStatus !==
            "pending_review"
          ) {
            throw new Error(
              "Only profiles waiting for review can be approved.",
            );
          }

          const profileSlug =
            String(
              profile.profileSlug ||
              "",
            ) ||
            createProfileSlug({
              displayName:
                String(
                  profile.displayName ||
                  "Developer",
                ),

              memberId,
            });

          transaction.set(
            profileReference,
            {
              ...reviewerFields,

              profileStatus:
                "live",

              isPublished: true,

              profileSlug,

              publishedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            memberReference,
            {
              profileStatus:
                "live",

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            requestReference,
            {
              status:
                "approved",

              reviewerNote,

              reviewedAt:
                FieldValue
                  .serverTimestamp(),

              reviewedByUid:
                authorization.staff
                  .uid,

              reviewedByEmail:
                authorization.staff
                  .emailAddress,

              reviewedByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          return;
        }

        if (
          body.action ===
          "request_changes"
        ) {
          if (
            currentStatus !==
            "pending_review"
          ) {
            throw new Error(
              "Only profiles waiting for review can receive change requests.",
            );
          }

          transaction.set(
            profileReference,
            {
              ...reviewerFields,

              profileStatus:
                "changes_requested",

              isPublished: false,
            },
            {
              merge: true,
            },
          );

          transaction.set(
            memberReference,
            {
              profileStatus:
                "changes_requested",

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            requestReference,
            {
              status:
                "changes_requested",

              reviewerNote,

              reviewedAt:
                FieldValue
                  .serverTimestamp(),

              reviewedByUid:
                authorization.staff
                  .uid,

              reviewedByEmail:
                authorization.staff
                  .emailAddress,

              reviewedByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          return;
        }

        if (
          body.action ===
          "hide"
        ) {
          if (
            currentStatus !==
            "live" &&
            profile.isPublished !==
            true
          ) {
            throw new Error(
              "Only a published profile can be hidden.",
            );
          }

          transaction.set(
            profileReference,
            {
              ...reviewerFields,

              profileStatus:
                "hidden",

              isPublished: false,

              hiddenAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            memberReference,
            {
              profileStatus:
                "hidden",

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          transaction.set(
            requestReference,
            {
              status:
                "hidden",

              reviewerNote,

              reviewedAt:
                FieldValue
                  .serverTimestamp(),

              reviewedByUid:
                authorization.staff
                  .uid,

              reviewedByEmail:
                authorization.staff
                  .emailAddress,

              reviewedByName:
                authorization.staff
                  .displayName ||
                authorization.staff
                  .emailAddress,

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );
        }
      },
    );

    if (
      body.action ===
      "suspend_account"
    ) {
      await adminAuth.updateUser(
        uid,
        {
          disabled: true,
        },
      );

      await adminAuth
        .revokeRefreshTokens(uid);
    }

    if (
      body.action ===
      "suspend_account"
    ) {
      const memberSnapshot =
        await memberReference.get();

      const fingerprint =
        String(
          memberSnapshot.data()
            ?.securityConnectionFingerprint ||
          "",
        );

      if (fingerprint) {
        await markConnectionSuspension({
          connectionFingerprint:
            fingerprint,
          suspended: true,
        });
      }
    }

    if (
      body.action ===
      "restore_account"
    ) {
      await adminAuth.updateUser(
        uid,
        {
          disabled: false,
        },
      );
    }

    if (
      body.action ===
      "restore_account"
    ) {
      const memberSnapshot =
        await memberReference.get();

      const fingerprint =
        String(
          memberSnapshot.data()
            ?.securityConnectionFingerprint ||
          "",
        );

      if (fingerprint) {
        await markConnectionSuspension({
          connectionFingerprint:
            fingerprint,
          suspended: false,
        });
      }
    }

    const [
      updatedMemberSnapshot,
      updatedProfileSnapshot,
      updatedAnalyticsSnapshot,
      updatedSavesSnapshot,
    ] = await Promise.all([
      memberReference.get(),

      profileReference.get(),

      adminDb
        .collection(
          "developerAnalytics",
        )
        .doc(uid)
        .get(),

      adminDb
        .collection(
          "developerSaves",
        )
        .where(
          "developerUid",
          "==",
          uid,
        )
        .get(),
    ]);

    return NextResponse.json({
      ok: true,

      developer:
        serializeDeveloperAccount({
          memberId,

          member:
            updatedMemberSnapshot
              .data() || {},

          profile:
            updatedProfileSnapshot
              .data() || {},

          analytics:
            updatedAnalyticsSnapshot
              .data() || null,

          bookmarkCount:
            updatedSavesSnapshot.size,
        }),

      message:
        body.action ===
          "grant_premium"
          ? "Launch lifetime premium was granted to this developer."
          : body.action ===
            "revoke_premium"
            ? "Launch lifetime premium was revoked and the promotional spot was returned."
            : body.action ===
              "suspend_account"
              ? "The member account was suspended and its public profile was hidden."
              : body.action ===
                "restore_account"
                ? "The member account was restored. Its profile remains unpublished as a draft."
                : body.action ===
                  "approve"
                  ? "Developer profile approved and published."
                  : body.action ===
                    "request_changes"
                    ? "Changes were requested from the developer."
                    : "Developer profile hidden.",
    });
  } catch (error) {
    console.error(
      "Review developer profile error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Could not update the developer profile.";

    const status =
      message.includes(
        "Only profiles",
      ) ||
        message.includes(
          "Only a published",
        ) ||
        message.includes(
          "already has premium",
        ) ||
        message.includes(
          "All 30",
        ) ||
        message.includes(
          "not eligible",
        ) ||
        message.includes(
          "not awaiting",
        ) ||
        message.includes(
          "already suspended",
        ) ||
        message.includes(
          "not currently suspended",
        ) ||
        message.includes(
          "Only a launch lifetime",
        )
        ? 409
        : message.includes(
          "no longer exists",
        )
          ? 404
          : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status,
      },
    );
  }
}