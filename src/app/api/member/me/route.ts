import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  authorizeMemberRequest,
} from "@/lib/server/memberAuthorization";

import {
  adminDb,
} from "@/lib/firebaseAdmin";

import {
  hasDeveloperPremiumAccess,
} from "@/lib/server/developerPremiumLaunch";

export const runtime = "nodejs";

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

    const talentSeekerProfile =
      typeof memberData
        .talentSeekerProfile ===
        "object" &&
      memberData.talentSeekerProfile !==
        null
        ? memberData
            .talentSeekerProfile as
            Record<
              string,
              unknown
            >
        : {};

    let developerAvatarUrl = "";

    if (
      member.accountPurpose ===
        "developer" ||
      member.accountPurpose === "both"
    ) {
      const profileSnapshot =
        await adminDb
          .collection(
            "developerProfiles",
          )
          .where(
            "memberId",
            "==",
            member.memberId,
          )
          .limit(1)
          .get();

      if (!profileSnapshot.empty) {
        developerAvatarUrl =
          String(
            profileSnapshot
              .docs[0]
              .data()
              .avatarUrl || "",
          );
      }
    }

    const talentSeekerAvatarUrl =
      String(
        talentSeekerProfile.avatarUrl ||
          "",
      );

    const memberListingLimit =
      typeof memberData
        .memberListingLimit ===
      "number"
        ? memberData.memberListingLimit
        : 3;

    const paidListingCredits =
      typeof memberData
        .paidListingCredits ===
      "number"
        ? memberData.paidListingCredits
        : 0;

    let listingsApproved = 0;
    let listingsPendingReview = 0;

    if (
      member.accountPurpose ===
        "developer" ||
      member.accountPurpose === "both"
    ) {
      const listingsSnapshot =
        await adminDb
          .collection(
            "gameDirectory",
          )
          .where(
            "memberId",
            "==",
            member.memberId,
          )
          .get();

      listingsSnapshot.docs.forEach(
        (document) => {
          const status =
            String(
              document
                .data()
                .status || "",
            );

          if (
            status === "published"
          ) {
            listingsApproved += 1;
          } else if (
            status ===
              "for_approval" ||
            status === "pending"
          ) {
            listingsPendingReview +=
              1;
          }
        },
      );
    }

    const hasDeveloperPremium =
      hasDeveloperPremiumAccess(
        memberData,
      );

    const developerPremiumStatus =
      memberData
        .developerPremiumStatus ===
          "qualified" ||
      memberData
        .developerPremiumStatus ===
          "pending_review"
        ? memberData
            .developerPremiumStatus
        : "not_eligible";

    const isDeveloperAccount =
      member.accountPurpose === "developer" ||
      member.accountPurpose === "both";

    const discordInviteEligible =
      isDeveloperAccount &&
      memberData.hasBeenApprovedBefore === true;

    const discordInviteGeneratedOnce =
      memberData.discordInviteGeneratedOnce === true ||
      Boolean(
        memberData.discordInviteCode ||
        memberData.discordInviteCreatedAt,
      );

    return NextResponse.json({
      ok: true,

      member: {
        uid: member.uid,
        memberId:
          member.memberId,
        email: member.email,
        displayName:
          member.displayName,
        accountPurpose:
          member.accountPurpose,
        accountStatus:
          member.accountStatus,
        memberStatus:
          member.memberStatus,
        profileStatus:
          member.profileStatus,

        avatarUrl:
          developerAvatarUrl ||
          talentSeekerAvatarUrl,

        hasDeveloperPremium,

        analyticsAccess:
          hasDeveloperPremium
            ? "pro"
            : "disabled",

        customSubdomainAccess:
          hasDeveloperPremium
            ? "premium"
            : "disabled",

        developerPremiumStatus,

        developerPremiumGrantType:
          String(
            memberData
              .developerPremiumGrantType ||
              "",
          ),

        developerPremiumGrantedAt:
          timestampToIso(
            memberData
              .developerPremiumGrantedAt,
          ),

        talentSeekerStatus:
          member.talentSeekerStatus,

        talentSeekerReviewerNote:
          String(
            memberData
              .talentSeekerReviewerNote ||
              "",
          ),

        talentSeekerSubmittedAt:
          timestampToIso(
            memberData
              .talentSeekerSubmittedAt,
          ),

        talentSeekerReviewedAt:
          timestampToIso(
            memberData
              .talentSeekerReviewedAt,
          ),

        talentSeekerProfile: {
          entityType:
            String(
              talentSeekerProfile
                .entityType || "",
            ),

          organizationName:
            String(
              talentSeekerProfile
                .organizationName ||
                "",
            ),

          role:
            String(
              talentSeekerProfile
                .role || "",
            ),

          contactEmail:
            String(
              talentSeekerProfile
                .contactEmail ||
                member.email,
            ),

          avatarUrl:
            talentSeekerAvatarUrl,
        },

        memberListingLimit,
        paidListingCredits,
        listingsApproved,
        listingsPendingReview,

        availableListings:
          Math.max(
            0,
            memberListingLimit +
              paidListingCredits -
              listingsApproved -
              listingsPendingReview,
          ),

        sponsoredPlacementsPurchased:
          typeof memberData
            .sponsoredPlacementsPurchased ===
          "number"
            ? memberData
                .sponsoredPlacementsPurchased
            : 0,

        source:
          String(
            memberData.source || "",
          ),

        sourceApplicationId:
          String(
            memberData
              .sourceApplicationId || "",
          ),

        activatedAt:
          timestampToIso(
            memberData.activatedAt,
          ),

        discordInviteEligible,

        discordInviteGeneratedOnce,

        discordInviteStatus:
          String(
            memberData
              .discordInviteStatus ||
              (
                discordInviteGeneratedOnce
                  ? "used_or_expired"
                  : discordInviteEligible
                    ? "eligible"
                    : "locked"
              ),
          ),

        discordInviteUrl:
          String(
            memberData
              .discordInviteUrl || "",
          ),

        discordInviteExpiresAt:
          timestampToIso(
            memberData
              .discordInviteExpiresAt,
          ),

        discordInviteError:
          String(
            memberData
              .discordInviteError || "",
          ),
      },
    });
  } catch (error) {
    console.error(
      "Load member account error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your FRDA membership account.",
      },
      { status: 500 },
    );
  }
}