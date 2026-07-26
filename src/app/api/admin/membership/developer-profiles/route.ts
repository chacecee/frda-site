import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";
import { DEVELOPER_PREMIUM_LAUNCH_LIMIT } from "@/lib/server/developerPremiumLaunch";

export const runtime = "nodejs";

type ReviewAction =
  | "approve"
  | "request_changes"
  | "hide"
  | "grant_premium";

function timestampToIso(value: unknown): string | null {
  if (
    value instanceof Timestamp ||
    (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    )
  ) {
    return (value as { toDate: () => Date })
      .toDate()
      .toISOString();
  }

  return null;
}

function normalizeExperienceTier(value: unknown): string {
  return value === "aspiring" ||
    value === "emerging" ||
    value === "established" ||
    value === "experienced"
    ? value
    : "";
}

function normalizeDeliveryScope(value: unknown): string {
  return value === "full_team" ||
    value === "solo_full_project" ||
    value === "specialist"
    ? value
    : "";
}

function normalizeAccountPurpose(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isDeveloperAccount(value: unknown): boolean {
  const purpose = normalizeAccountPurpose(value);

  return purpose === "developer" || purpose === "both";
}

function serializeDeveloperAccount({
  memberId,
  member,
  profile,
  analytics,
  bookmarkCount,
}: {
  memberId: string;
  member: FirebaseFirestore.DocumentData;
  profile: FirebaseFirestore.DocumentData | null;
  analytics?: FirebaseFirestore.DocumentData | null;
  bookmarkCount?: number;
}) {
  return {
    uid: String(member.authUid || profile?.uid || ""),
    memberId,

    email: String(member.email || profile?.email || ""),
    displayName: String(
      profile?.displayName ||
      member.displayName ||
      ""
    ),

    accountPurpose: String(
      member.accountPurpose || "developer"
    ),

    accountStatus: String(
      member.accountStatus || ""
    ),

    memberStatus: String(
      member.memberStatus || ""
    ),

    profileStatus: String(
      profile?.profileStatus ||
      member.profileStatus ||
      "not_started"
    ),

    headline: String(profile?.headline || ""),
    bio: String(profile?.bio || ""),

    avatarUrl: String(
      profile?.avatarUrl ||
      (
        typeof member.talentSeekerProfile ===
          "object" &&
        member.talentSeekerProfile !== null
          ? (
              member.talentSeekerProfile as
                Record<string, unknown>
            ).avatarUrl
          : ""
      ) ||
      ""
    ),

    skills: Array.isArray(profile?.skills)
      ? profile.skills.filter(
          (value: unknown): value is string =>
            typeof value === "string"
        )
      : [],

    availability: String(
      profile?.availability || ""
    ),

    experienceTier:
      normalizeExperienceTier(
        profile?.experienceTier
      ),

    experienceTierIsSelfDeclared:
      profile?.experienceTierIsSelfDeclared === true,

    deliveryScope:
      normalizeDeliveryScope(
        profile?.deliveryScope
      ),

    robloxProfileUrl: String(
      profile?.robloxProfileUrl || ""
    ),

    portfolioUrl: String(
      profile?.portfolioUrl || ""
    ),

    profileSlug: String(
      profile?.profileSlug || ""
    ),

    isPublished: profile?.isPublished === true,

    memberListingLimit:
      typeof member.memberListingLimit === "number"
        ? member.memberListingLimit
        : 3,

    paidListingCredits:
      typeof member.paidListingCredits === "number"
        ? member.paidListingCredits
        : 0,

    activatedAt: timestampToIso(
      member.activatedAt
    ),

    profileCreatedAt: timestampToIso(
      profile?.createdAt
    ),

    profileUpdatedAt: timestampToIso(
      profile?.updatedAt
    ),

    publicationRequestedAt: timestampToIso(
      profile?.publicationRequestedAt
    ),

    publicationReviewedAt: timestampToIso(
      profile?.publicationReviewedAt
    ),

    publicationReviewedByName: String(
      profile?.publicationReviewedByName || ""
    ),

    publicationReviewerNote: String(
      profile?.publicationReviewerNote || ""
    ),

    profileViews:
      typeof analytics?.profileViews === "number"
        ? analytics.profileViews
        : 0,

    uniqueProfileViews:
      typeof analytics?.uniqueProfileViews === "number"
        ? analytics.uniqueProfileViews
        : 0,

    bookmarkCount:
      typeof bookmarkCount === "number"
        ? bookmarkCount
        : 0,

    contactClicks:
      typeof analytics?.contactClicks === "number"
        ? analytics.contactClicks
        : 0,

    projectViews:
      typeof analytics?.projectViews === "number"
        ? analytics.projectViews
        : 0,

    projectLinkClicks:
      typeof analytics?.projectLinkClicks === "number"
        ? analytics.projectLinkClicks
        : 0,

    portfolioClicks:
      typeof analytics?.portfolioClicks === "number"
        ? analytics.portfolioClicks
        : 0,

    developerPremiumStatus: String(member.developerPremiumStatus || "not_eligible"),
    developerPremiumGrantType: String(member.developerPremiumGrantType || ""),
    developerPremiumGrantedAt: timestampToIso(member.developerPremiumGrantedAt),
    hasPremiumAccess:
      member.developerPremiumStatus === "qualified" ||
      member.analyticsAccess === "pro" ||
      Boolean(String(member.customSubdomain || "").trim()),
  };
}

function isReviewAction(
  value: unknown
): value is ReviewAction {
  return (
    value === "approve" ||
    value === "request_changes" ||
    value === "hide" ||
    value === "grant_premium"
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function createProfileSlug({
  displayName,
  memberId,
}: {
  displayName: string;
  memberId: string;
}): string {
  const base = slugify(displayName) || "developer";

  const memberSuffix = memberId
    .replace(/^FRDA-M-/i, "")
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
    adminDb.collection("members").get(),
    adminDb.collection("developerProfiles").get(),
    adminDb.collection("developerAnalytics").get(),
    adminDb.collection("developerSaves").get(),
  ]);

  const profileByUid = new Map<
    string,
    FirebaseFirestore.DocumentData
  >();

  profilesSnapshot.docs.forEach((document) => {
    profileByUid.set(document.id, document.data());
  });

  const analyticsByUid =
    new Map<
      string,
      FirebaseFirestore.DocumentData
    >();

  analyticsSnapshot.docs.forEach(
    (document) => {
      analyticsByUid.set(
        document.id,
        document.data(),
      );
    },
  );

  const bookmarkCountByUid =
    new Map<string, number>();

  savesSnapshot.docs.forEach(
    (document) => {
      const developerUid =
        String(
          document.data().developerUid ||
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

  const accounts = membersSnapshot.docs
    .filter((document) =>
      isDeveloperAccount(
        document.data().accountPurpose
      )
    )
    .map((document) => {
      const member = document.data();

      const authUid =
        typeof member.authUid === "string"
          ? member.authUid
          : "";

      const profile = authUid
        ? profileByUid.get(authUid) || null
        : null;

      return serializeDeveloperAccount({
        memberId: document.id,
        member,
        profile,
        analytics:
          authUid
            ? analyticsByUid.get(authUid) || null
            : null,
        bookmarkCount:
          authUid
            ? bookmarkCountByUid.get(authUid) || 0
            : 0,
      });
    });

  accounts.sort((first, second) => {
    const firstTime =
      new Date(
        first.publicationRequestedAt ||
        first.profileUpdatedAt ||
        first.activatedAt ||
        0
      ).getTime();

    const secondTime =
      new Date(
        second.publicationRequestedAt ||
        second.profileUpdatedAt ||
        second.activatedAt ||
        0
      ).getTime();

    return secondTime - firstTime;
  });

  return accounts;
}

export async function GET(request: NextRequest) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        "membership_developer_accounts"
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
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load developer accounts and profiles.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        "membership_developer_accounts"
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body = (await request
      .json()
      .catch(() => null)) as
      | {
          uid?: unknown;
          memberId?: unknown;
          action?: unknown;
          reviewerNote?: unknown;
        }
      | null;

    const uid =
      typeof body?.uid === "string"
        ? body.uid.trim()
        : "";

    const memberId =
      typeof body?.memberId === "string"
        ? body.memberId.trim()
        : "";

    const reviewerNote =
      typeof body?.reviewerNote === "string"
        ? body.reviewerNote.trim().slice(0, 3000)
        : "";

    if (!uid || !memberId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A developer UID and Member ID are required.",
        },
        { status: 400 }
      );
    }

    if (!isReviewAction(body?.action)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid profile-review action is required.",
        },
        { status: 400 }
      );
    }

    if (
      body.action === "request_changes" &&
      !reviewerNote
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add a reviewer note explaining the requested changes.",
        },
        { status: 400 }
      );
    }

    const profileReference = adminDb
      .collection("developerProfiles")
      .doc(uid);

    const memberReference = adminDb
      .collection("members")
      .doc(memberId);

    const requestReference = adminDb
      .collection("profilePublicationRequests")
      .doc(uid);

    await adminDb.runTransaction(
      async (transaction) => {
        const [profileSnapshot, memberSnapshot] =
          await Promise.all([
            transaction.get(profileReference),
            transaction.get(memberReference),
          ]);

        if (!profileSnapshot.exists) {
          throw new Error(
            "The developer profile no longer exists."
          );
        }

        if (!memberSnapshot.exists) {
          throw new Error(
            "The permanent member record no longer exists."
          );
        }

        const profile =
          profileSnapshot.data() || {};

        const currentStatus = String(
          profile.profileStatus || "draft"
        );

        const reviewerFields = {
          publicationReviewedAt:
            FieldValue.serverTimestamp(),

          publicationReviewedByUid:
            authorization.staff.uid,

          publicationReviewedByEmail:
            authorization.staff.emailAddress,

          publicationReviewedByName:
            authorization.staff.displayName ||
            authorization.staff.emailAddress,

          publicationReviewerNote:
            reviewerNote,

          updatedAt:
            FieldValue.serverTimestamp(),
        };

        if (body.action === "grant_premium") {
          if (profile.isPublished !== true || currentStatus !== "live") {
            throw new Error("Only a published profile can receive lifetime premium.");
          }

          if (memberSnapshot.data()?.developerPremiumStatus === "qualified") {
            throw new Error("This developer already has lifetime premium.");
          }

          const premiumSnapshot = await transaction.get(
            adminDb.collection("developerPremiumLaunchGrants").doc("launch_lifetime"),
          );
          const currentCount = typeof premiumSnapshot.data()?.approvedCount === "number"
            ? premiumSnapshot.data()!.approvedCount
            : 0;

          if (currentCount >= DEVELOPER_PREMIUM_LAUNCH_LIMIT) {
            throw new Error("All 30 lifetime premium launch spots have already been awarded.");
          }

          transaction.set(memberReference, {
            developerPremiumStatus: "qualified",
            developerPremiumGrantType: "launch_lifetime",
            developerPremiumGrantedAt: FieldValue.serverTimestamp(),
            developerPremiumGrantedByUid: authorization.staff.uid,
            developerPremiumGrantedByEmail: authorization.staff.emailAddress,
            analyticsAccess: "pro",
            customSubdomainAccess: "premium",
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          transaction.set(profileReference, {
            developerPremiumStatus: "qualified",
            developerPremiumGrantType: "launch_lifetime",
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          transaction.set(
            adminDb.collection("developerPremiumLaunchGrants").doc("launch_lifetime"),
            { approvedCount: currentCount + 1, limit: DEVELOPER_PREMIUM_LAUNCH_LIMIT, updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          );

          transaction.set(adminDb.collection("memberNotifications").doc(), {
            memberId,
            type: "developer_premium_qualified",
            title: "Lifetime premium unlocked",
            message: "Your developer profile has qualified for lifetime FRDA Profile Premium. Profile analytics and your custom FRDA subdomain are now available at no cost.",
            href: "/member/dashboard",
            isRead: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        if (body.action === "approve") {
          if (currentStatus !== "pending_review") {
            throw new Error(
              "Only profiles waiting for review can be approved."
            );
          }

          const profileSlug =
            String(profile.profileSlug || "") ||
            createProfileSlug({
              displayName: String(
                profile.displayName || "Developer"
              ),
              memberId,
            });

          transaction.set(
            profileReference,
            {
              ...reviewerFields,

              profileStatus: "live",
              isPublished: true,
              profileSlug,

              publishedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            memberReference,
            {
              profileStatus: "live",
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            requestReference,
            {
              status: "approved",
              reviewerNote,

              reviewedAt:
                FieldValue.serverTimestamp(),

              reviewedByUid:
                authorization.staff.uid,

              reviewedByEmail:
                authorization.staff.emailAddress,

              reviewedByName:
                authorization.staff.displayName ||
                authorization.staff.emailAddress,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return;
        }

        if (
          body.action === "request_changes"
        ) {
          if (currentStatus !== "pending_review") {
            throw new Error(
              "Only profiles waiting for review can receive change requests."
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
            { merge: true }
          );

          transaction.set(
            memberReference,
            {
              profileStatus:
                "changes_requested",

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            requestReference,
            {
              status: "changes_requested",
              reviewerNote,

              reviewedAt:
                FieldValue.serverTimestamp(),

              reviewedByUid:
                authorization.staff.uid,

              reviewedByEmail:
                authorization.staff.emailAddress,

              reviewedByName:
                authorization.staff.displayName ||
                authorization.staff.emailAddress,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          return;
        }

        if (body.action === "hide") {
          if (
            currentStatus !== "live" &&
            profile.isPublished !== true
          ) {
            throw new Error(
              "Only a published profile can be hidden."
            );
          }

          transaction.set(
            profileReference,
            {
              ...reviewerFields,

              profileStatus: "hidden",
              isPublished: false,

              hiddenAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            memberReference,
            {
              profileStatus: "hidden",

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            requestReference,
            {
              status: "hidden",
              reviewerNote,

              reviewedAt:
                FieldValue.serverTimestamp(),

              reviewedByUid:
                authorization.staff.uid,

              reviewedByEmail:
                authorization.staff.emailAddress,

              reviewedByName:
                authorization.staff.displayName ||
                authorization.staff.emailAddress,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
    );

    const [
      updatedMemberSnapshot,
      updatedProfileSnapshot,
      updatedAnalyticsSnapshot,
      updatedSavesSnapshot,
    ] = await Promise.all([
      memberReference.get(),
      profileReference.get(),
      adminDb
        .collection("developerAnalytics")
        .doc(uid)
        .get(),
      adminDb
        .collection("developerSaves")
        .where("developerUid", "==", uid)
        .get(),
    ]);

    return NextResponse.json({
      ok: true,

      developer: serializeDeveloperAccount({
        memberId,
        member:
          updatedMemberSnapshot.data() || {},
        profile:
          updatedProfileSnapshot.data() || {},
        analytics:
          updatedAnalyticsSnapshot.data() || null,
        bookmarkCount:
          updatedSavesSnapshot.size,
      }),

      message:
        body.action === "grant_premium"
          ? "Lifetime premium was granted to this developer."
          : body.action === "approve"
            ? "Developer profile approved and published."
            : body.action === "request_changes"
              ? "Changes were requested from the developer."
              : "Developer profile hidden.",
    });
  } catch (error) {
    console.error(
      "Review developer profile error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Could not update the developer profile.";

    const status =
      message.includes("Only profiles") ||
      message.includes("Only a published") ||
      message.includes("already has lifetime") ||
      message.includes("All 30")
        ? 409
        : message.includes("no longer exists")
          ? 404
          : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}