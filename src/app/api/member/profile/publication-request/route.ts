import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/lib/firebaseAdmin";

import {
  authorizeMemberRequest,
} from "@/lib/server/memberAuthorization";

import {
  DEVELOPER_PREMIUM_LAUNCH_ACTIVE,
  hasDeveloperPremiumAccess,
  isEligibleForLaunchPremiumReview,
  normalizeDeveloperPremiumStatus,
} from "@/lib/server/developerPremiumLaunch";

import {
  PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
  buildPublishedDeveloperProfile,
} from "@/lib/server/publishedDeveloperProfiles";

export const runtime = "nodejs";

type PublicationAction =
  | "publish"
  | "unpublish";

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

function getMissingFields(
  profile:
    FirebaseFirestore.DocumentData,
): string[] {
  const missing: string[] = [];

  if (
    !String(
      profile.displayName || "",
    ).trim()
  ) {
    missing.push("display name");
  }

  if (
    !Array.isArray(profile.skills) ||
    profile.skills.length === 0
  ) {
    missing.push("at least one skill");
  }

  if (
    !String(
      profile.experienceTier || "",
    ).trim()
  ) {
    missing.push("experience level");
  }

  if (
    !String(
      profile.deliveryScope || "",
    ).trim()
  ) {
    missing.push("development capacity");
  }

  if (
    !Array.isArray(
      profile.coverShowcaseImages,
    ) ||
    profile.coverShowcaseImages.length === 0
  ) {
    missing.push("at least one cover photo");
  }

  const workSamples =
    Array.isArray(profile.workSamples)
      ? profile.workSamples
      : [];

  const hasValidWorkSample =
    workSamples.some(
      (item: unknown) => {
        if (
          typeof item !== "object" ||
          item === null
        ) {
          return false;
        }

        const work =
          item as {
            title?: unknown;
            role?: unknown;
          };

        return (
          typeof work.title === "string" &&
          work.title.trim().length > 0 &&
          typeof work.role === "string" &&
          work.role.trim().length > 0
        );
      },
    );

  if (!hasValidWorkSample) {
    missing.push(
      "at least one featured work item with a title and your role",
    );
  }

  return missing;
}

function isPublicationAction(
  value: unknown,
): value is PublicationAction {
  return (
    value === "publish" ||
    value === "unpublish"
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

function serializePublication({
  profile,
  memberData = {},
  publishedProfile = null,
}: {
  profile:
    FirebaseFirestore.DocumentData;
  memberData?:
    FirebaseFirestore.DocumentData;
  publishedProfile?:
    FirebaseFirestore.DocumentData | null;
}) {
  const publicProfileIsLive =
    Boolean(
      publishedProfile &&
      publishedProfile.isPublished === true &&
      String(
        publishedProfile.profileStatus || "",
      ) === "live",
    );

  return {
    status:
      String(
        profile.profileStatus || "draft",
      ),

    isPublished:
      publicProfileIsLive,

    hasPublishedProfile:
      publicProfileIsLive,

    hasPendingChanges:
      profile.hasUnpublishedChanges === true ||
      (
        publicProfileIsLive &&
        (
          String(
            profile.profileStatus || "",
          ) === "pending_review" ||
          String(
            profile.profileStatus || "",
          ) === "changes_requested"
        )
      ),

    requiresProfileReview:
      profile.requiresProfileReview !== false,

    hasBeenApprovedBefore:
      profile.hasBeenApprovedBefore === true ||
      Boolean(publishedProfile),

    publishedAt:
      timestampToIso(
        publishedProfile?.publishedAt ||
        profile.publishedAt,
      ),

    unpublishedAt:
      timestampToIso(
        publishedProfile?.unpublishedAt ||
        profile.unpublishedAt,
      ),

    reviewerNote:
      String(
        profile.publicationReviewerNote || "",
      ),

    moderationLock:
      profile.moderationLock === true,

    moderationNote:
      String(
        profile.moderationNote || "",
      ),

    moderationSource:
      String(
        profile.moderationSource || "",
      ),

    moderationReportId:
      String(
        profile.moderationReportId || "",
      ),

    developerPremiumStatus:
      normalizeDeveloperPremiumStatus(
        memberData.developerPremiumStatus,
      ),

    hasPremiumAccess:
      hasDeveloperPremiumAccess(
        memberData,
      ),

    launchPremiumEligible:
      isEligibleForLaunchPremiumReview(
        memberData,
      ),
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(
        request,
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const {
      member,
      memberData,
    } = authorization;

    if (
      member.accountPurpose !== "developer" &&
      member.accountPurpose !== "both"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account does not include a developer profile.",
        },
        { status: 403 },
      );
    }

    const [
      profileSnapshot,
      publishedSnapshot,
    ] = await Promise.all([
      adminDb
        .collection("developerProfiles")
        .doc(member.uid)
        .get(),

      adminDb
        .collection(
          PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
        )
        .doc(member.uid)
        .get(),
    ]);

    const profile =
      profileSnapshot.exists
        ? profileSnapshot.data() || {}
        : {
            profileStatus: "draft",
            isPublished: false,
            requiresProfileReview: true,
            hasBeenApprovedBefore: false,
            hasUnpublishedChanges: false,
          };

    return NextResponse.json({
      ok: true,
      publication:
        serializePublication({
          profile,
          memberData,
          publishedProfile:
            publishedSnapshot.exists
              ? publishedSnapshot.data() || {}
              : null,
        }),
    });
  } catch (error) {
    console.error(
      "Load profile publication status error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your profile publication status.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(
        request,
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const {
      member,
      memberData,
    } = authorization;

    if (
      member.accountPurpose !== "developer" &&
      member.accountPurpose !== "both"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account does not include a developer profile.",
        },
        { status: 403 },
      );
    }

    const body =
      await request
        .json()
        .catch(() => null) as
        | {
            action?: unknown;
            confirmedAccuracy?: unknown;
          }
        | null;

    if (
      !isPublicationAction(
        body?.action,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid publication action is required.",
        },
        { status: 400 },
      );
    }

    const profileReference =
      adminDb
        .collection("developerProfiles")
        .doc(member.uid);

    const publishedReference =
      adminDb
        .collection(
          PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
        )
        .doc(member.uid);

    const memberReference =
      adminDb
        .collection("members")
        .doc(member.memberId);

    const requestReference =
      adminDb
        .collection(
          "profilePublicationRequests",
        )
        .doc(member.uid);

    let queuedForLaunchReview =
      false;

    let submittedForReview =
      false;

    if (
      body.action === "publish"
    ) {
      if (
        body.confirmedAccuracy !== true
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "You must confirm that your profile information and portfolio claims are accurate.",
          },
          { status: 400 },
        );
      }

      await adminDb.runTransaction(
        async (transaction) => {
          const [
            profileSnapshot,
            currentMemberSnapshot,
            publishedSnapshot,
          ] = await Promise.all([
            transaction.get(
              profileReference,
            ),
            transaction.get(
              memberReference,
            ),
            transaction.get(
              publishedReference,
            ),
          ]);

          if (
            !profileSnapshot.exists
          ) {
            throw new Error(
              "Create and save your developer profile before submitting it.",
            );
          }

          if (
            !currentMemberSnapshot.exists
          ) {
            throw new Error(
              "Your membership account could not be found.",
            );
          }

          const profile =
            profileSnapshot.data() || {};

          const currentMemberData =
            currentMemberSnapshot.data() || {};

          if (
            profile.moderationLock === true
          ) {
            throw new Error(
              "Your public profile is currently hidden by FRDA moderation and cannot be submitted until the restriction is lifted.",
            );
          }

          const missingFields =
            getMissingFields(profile);

          if (
            missingFields.length > 0
          ) {
            throw new Error(
              `Complete these required fields first: ${missingFields.join(", ")}.`,
            );
          }

          const profileSlug =
            String(
              profile.profileSlug || "",
            ) ||
            createProfileSlug({
              displayName:
                String(
                  profile.displayName ||
                  "Developer",
                ),
              memberId:
                member.memberId,
            });

          const hasBeenApprovedBefore =
            profile.hasBeenApprovedBefore === true ||
            publishedSnapshot.exists;

          const requiresProfileReview =
            profile.requiresProfileReview !== false;

          const shouldRequireReview =
            !hasBeenApprovedBefore ||
            requiresProfileReview;

          if (shouldRequireReview) {
            submittedForReview =
              true;

            transaction.set(
              profileReference,
              {
                profileStatus:
                  "pending_review",
                isPublished:
                  false,
                profileSlug,
                hasBeenApprovedBefore,
                requiresProfileReview,
                hasUnpublishedChanges:
                  true,
                publicationRequestedAt:
                  FieldValue.serverTimestamp(),
                publicationReviewerNote:
                  "",
                selfPublicationConfirmed:
                  true,
                selfPublicationConfirmedAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true },
            );

            transaction.set(
              memberReference,
              {
                profileStatus:
                  "pending_review",
                hasBeenApprovedBefore,
                requiresProfileReview,
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true },
            );

            transaction.set(
              requestReference,
              {
                uid:
                  member.uid,
                memberId:
                  member.memberId,
                status:
                  "pending_review",
                isRevision:
                  publishedSnapshot.exists,
                requestedAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true },
            );

            return;
          }

          const publicSnapshot =
            buildPublishedDeveloperProfile({
              uid: member.uid,
              profile: {
                ...profile,
                profileSlug,
                profileStatus: "live",
                isPublished: true,
                publishedAt:
                  publishedSnapshot.data()
                    ?.publishedAt ||
                  profile.publishedAt ||
                  FieldValue.serverTimestamp(),
                lastPublishedAt:
                  FieldValue.serverTimestamp(),
              },
              source:
                "trusted_update",
            });

          transaction.set(
            publishedReference,
            publicSnapshot,
            { merge: false },
          );

          transaction.set(
            profileReference,
            {
              profileStatus:
                "live",
              isPublished:
                true,
              profileSlug,
              hasBeenApprovedBefore:
                true,
              hasUnpublishedChanges:
                false,
              publishedAt:
                profile.publishedAt ||
                FieldValue.serverTimestamp(),
              lastPublishedAt:
                FieldValue.serverTimestamp(),
              publicationRequestedAt:
                FieldValue.delete(),
              publicationReviewerNote:
                "",
              selfPublicationConfirmed:
                true,
              selfPublicationConfirmedAt:
                FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          const alreadyHasPremium =
            hasDeveloperPremiumAccess(
              currentMemberData,
            );

          const eligibleForLaunchReview =
            isEligibleForLaunchPremiumReview(
              currentMemberData,
            );

          queuedForLaunchReview =
            DEVELOPER_PREMIUM_LAUNCH_ACTIVE &&
            eligibleForLaunchReview &&
            !alreadyHasPremium;

          transaction.set(
            memberReference,
            {
              profileStatus:
                "live",
              hasBeenApprovedBefore:
                true,
              ...(queuedForLaunchReview
                ? {
                    developerPremiumStatus:
                      "pending_review",
                  }
                : {}),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        },
      );
    } else {
      await adminDb.runTransaction(
        async (transaction) => {
          const [
            profileSnapshot,
            publishedSnapshot,
          ] = await Promise.all([
            transaction.get(
              profileReference,
            ),
            transaction.get(
              publishedReference,
            ),
          ]);

          if (
            !profileSnapshot.exists
          ) {
            throw new Error(
              "Your developer profile could not be found.",
            );
          }

          if (
            !publishedSnapshot.exists ||
            publishedSnapshot.data()
              ?.isPublished !== true
          ) {
            throw new Error(
              "This developer profile is not currently published.",
            );
          }

          transaction.set(
            publishedReference,
            {
              profileStatus:
                "hidden",
              isPublished:
                false,
              unpublishedAt:
                FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          transaction.set(
            profileReference,
            {
              profileStatus:
                "draft",
              isPublished:
                false,
              hasUnpublishedChanges:
                true,
              unpublishedAt:
                FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          transaction.set(
            memberReference,
            {
              profileStatus:
                "draft",
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        },
      );
    }

    const [
      updatedProfileSnapshot,
      updatedMemberSnapshot,
      updatedPublishedSnapshot,
    ] = await Promise.all([
      profileReference.get(),
      memberReference.get(),
      publishedReference.get(),
    ]);

    return NextResponse.json({
      ok: true,

      publication:
        serializePublication({
          profile:
            updatedProfileSnapshot.data() || {},
          memberData:
            updatedMemberSnapshot.data() || {},
          publishedProfile:
            updatedPublishedSnapshot.exists
              ? updatedPublishedSnapshot.data() || {}
              : null,
        }),

      message:
        body.action === "unpublish"
          ? "Your developer profile has been unpublished."
          : submittedForReview
            ? updatedPublishedSnapshot.exists
              ? "Your profile changes were submitted for review. Your current approved profile will remain public until the changes are approved."
              : "Your developer profile was submitted for review."
            : queuedForLaunchReview
              ? "Your profile has been updated and will be reviewed within three business days to determine whether it qualifies for lifetime free premium."
              : "Your public developer profile was updated.",
    });
  } catch (error) {
    console.error(
      "Update developer profile publication error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Could not update your profile publication status.";

    const status =
      message.includes("Complete these") ||
      message.includes("Create and save") ||
      message.includes("must confirm")
        ? 400
        : message.includes(
            "currently hidden by FRDA moderation",
          )
          ? 403
          : message.includes(
              "not currently published",
            )
            ? 409
            : message.includes(
                "membership account could not be found",
              )
              ? 404
              : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}