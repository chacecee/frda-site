import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Timestamp,
} from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";

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

    const { member } =
      authorization;

    if (
      member.accountPurpose !==
        "talent_seeker" &&
      member.accountPurpose !==
        "both"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A talent-seeker account is required to view sent requests.",
        },
        { status: 403 },
      );
    }

    const snapshot =
      await adminDb
        .collection(
          "developerConnectionRequests",
        )
        .where(
          "requesterMemberId",
          "==",
          member.memberId,
        )
        .get();

    const developerMemberIds =
      Array.from(
        new Set(
          snapshot.docs
            .map((document) =>
              String(
                document.data()
                  .developerMemberId ||
                "",
              ),
            )
            .filter(Boolean),
        ),
      );

    const developerAvatarMap =
      new Map<string, string>();

    await Promise.all(
      developerMemberIds.map(
        async (memberId) => {
          const [
            profileSnapshot,
            memberSnapshot,
          ] = await Promise.all([
            adminDb
              .collection(
                "developerProfiles",
              )
              .where(
                "memberId",
                "==",
                memberId,
              )
              .limit(1)
              .get(),

            adminDb
              .collection("members")
              .doc(memberId)
              .get(),
          ]);

          const developerAvatar =
            !profileSnapshot.empty
              ? String(
                  profileSnapshot.docs[0]
                    .data().avatarUrl ||
                  "",
                )
              : "";

          const memberData =
            memberSnapshot.data() || {};

          const talentSeekerProfile =
            typeof memberData
              .talentSeekerProfile ===
                "object" &&
            memberData
              .talentSeekerProfile !== null
              ? memberData
                  .talentSeekerProfile as
                    Record<string, unknown>
              : {};

          developerAvatarMap.set(
            memberId,
            developerAvatar ||
            String(
              talentSeekerProfile.avatarUrl ||
              "",
            ),
          );
        },
      ),
    );

    const requests =
      snapshot.docs
        .map((document) => {
          const data =
            document.data();

          const developerMemberId =
            String(
              data.developerMemberId ||
              "",
            );

          return {
            requestId:
              document.id,

            status:
              String(
                data.status ||
                "pending_frda_review",
              ),

            inquiryType:
              String(
                data.inquiryType ||
                "",
              ),

            opportunityTitle:
              String(
                data.opportunityTitle ||
                "",
              ),

            organizationName:
              String(
                data.requesterOrganizationName ||
                data.organizationName ||
                "",
              ),

            developerDisplayName:
              String(
                data.developerDisplayName ||
                "FRDA Developer",
              ),

            developerAvatarUrl:
              String(
                data.developerAvatarUrl ||
                "",
              ) ||
              developerAvatarMap.get(
                developerMemberId,
              ) ||
              "",

            developerSlug:
              String(
                data.developerSlug ||
                "",
              ),

            message:
              String(
                data.message ||
                "",
              ),

            relevantUrl:
              String(
                data.relevantUrl ||
                "",
              ),

            adminReviewNote:
              String(
                data.adminReviewNote ||
                "",
              ),

            developerResponseNote:
              String(
                data.developerResponseNote ||
                "",
              ),

            createdAt:
              timestampToIso(
                data.createdAt,
              ),

            updatedAt:
              timestampToIso(
                data.updatedAt,
              ),

            respondedAt:
              timestampToIso(
                data.respondedAt,
              ),
          };
        })
        .sort(
          (
            first,
            second,
          ) =>
            new Date(
              second.createdAt || 0,
            ).getTime() -
            new Date(
              first.createdAt || 0,
            ).getTime(),
        );

    return NextResponse.json({
      ok: true,
      requests,
    });
  } catch (error) {
    console.error(
      "Load sent connection requests error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your sent requests.",
      },
      { status: 500 },
    );
  }
}