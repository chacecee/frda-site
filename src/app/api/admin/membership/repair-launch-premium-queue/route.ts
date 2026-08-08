import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/lib/firebaseAdmin";

import {
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";

import {
  PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
} from "@/lib/server/publishedDeveloperProfiles";

import {
  hasDeveloperPremiumAccess,
  isEligibleForLaunchPremiumReview,
} from "@/lib/server/developerPremiumLaunch";

export const runtime = "nodejs";

type RepairMode =
  | "preview"
  | "apply";

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

function isRepairMode(
  value: unknown,
): value is RepairMode {
  return (
    value === "preview" ||
    value === "apply"
  );
}

export async function POST(
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
        mode?: unknown;
      }
      | null;

    if (
      !isRepairMode(
        body?.mode,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid repair mode is required.",
        },
        {
          status: 400,
        },
      );
    }

    const membersSnapshot =
      await adminDb
        .collection("members")
        .get();

    const candidates: Array<{
      memberId: string;
      uid: string;
      displayName: string;
      currentPremiumStatus: string;
    }> = [];

    let alreadyQueuedCount = 0;
    let alreadyPremiumCount = 0;
    let notEligibleCount = 0;
    let notPublishedCount = 0;

    for (
      const memberDocument of
      membersSnapshot.docs
    ) {
      const member =
        memberDocument.data();

      if (
        !isDeveloperAccount(
          member.accountPurpose,
        )
      ) {
        continue;
      }

      const uid =
        typeof member.authUid ===
          "string"
          ? member.authUid.trim()
          : "";

      if (!uid) {
        continue;
      }

      if (
        hasDeveloperPremiumAccess(
          member,
        )
      ) {
        alreadyPremiumCount += 1;
        continue;
      }

      if (
        !isEligibleForLaunchPremiumReview(
          member,
        )
      ) {
        notEligibleCount += 1;
        continue;
      }

      const publishedSnapshot =
        await adminDb
          .collection(
            PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
          )
          .doc(uid)
          .get();

      const published =
        publishedSnapshot.exists
          ? publishedSnapshot.data() || {}
          : {};

      const publishedIsLive =
        publishedSnapshot.exists &&
        published.isPublished === true &&
        String(
          published.profileStatus || "",
        ) === "live";

      if (!publishedIsLive) {
        notPublishedCount += 1;
        continue;
      }

      if (
        member
          .developerPremiumStatus ===
        "pending_review"
      ) {
        alreadyQueuedCount += 1;
        continue;
      }

      candidates.push({
        memberId:
          memberDocument.id,

        uid,

        displayName:
          String(
            published.displayName ||
            member.displayName ||
            memberDocument.id,
          ),

        currentPremiumStatus:
          String(
            member
              .developerPremiumStatus ||
            "not_eligible",
          ),
      });
    }

    if (
      body.mode ===
      "preview"
    ) {
      return NextResponse.json({
        ok: true,

        mode:
          "preview",

        candidateCount:
          candidates.length,

        candidates,

        skipped: {
          alreadyQueued:
            alreadyQueuedCount,

          alreadyPremium:
            alreadyPremiumCount,

          notEligible:
            notEligibleCount,

          notPublished:
            notPublishedCount,
        },

        message:
          candidates.length === 1
            ? "1 eligible published developer needs repair."
            : `${candidates.length} eligible published developers need repair.`,
      });
    }

    const repairedMembers: Array<{
      memberId: string;
      uid: string;
      displayName: string;
    }> = [];

    for (
      const candidate of
      candidates
    ) {
      const memberReference =
        adminDb
          .collection("members")
          .doc(
            candidate.memberId,
          );

      const profileReference =
        adminDb
          .collection(
            "developerProfiles",
          )
          .doc(
            candidate.uid,
          );

      const publishedReference =
        adminDb
          .collection(
            PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
          )
          .doc(
            candidate.uid,
          );

      const repaired =
        await adminDb.runTransaction(
          async (
            transaction,
          ) => {
            const [
              memberSnapshot,
              profileSnapshot,
              publishedSnapshot,
            ] =
              await Promise.all([
                transaction.get(
                  memberReference,
                ),

                transaction.get(
                  profileReference,
                ),

                transaction.get(
                  publishedReference,
                ),
              ]);

            if (
              !memberSnapshot.exists ||
              !publishedSnapshot.exists
            ) {
              return false;
            }

            const member =
              memberSnapshot.data() ||
              {};

            const published =
              publishedSnapshot.data() ||
              {};

            const stillPublishedLive =
              published.isPublished ===
                true &&
              String(
                published
                  .profileStatus ||
                "",
              ) === "live";

            if (
              !stillPublishedLive
            ) {
              return false;
            }

            if (
              hasDeveloperPremiumAccess(
                member,
              )
            ) {
              return false;
            }

            if (
              !isEligibleForLaunchPremiumReview(
                member,
              )
            ) {
              return false;
            }

            if (
              member
                .developerPremiumStatus ===
              "pending_review"
            ) {
              return false;
            }

            transaction.set(
              memberReference,
              {
                developerPremiumStatus:
                  "pending_review",

                updatedAt:
                  FieldValue
                    .serverTimestamp(),
              },
              {
                merge: true,
              },
            );

            if (
              profileSnapshot.exists
            ) {
              transaction.set(
                profileReference,
                {
                  developerPremiumStatus:
                    "pending_review",

                  updatedAt:
                    FieldValue
                      .serverTimestamp(),
                },
                {
                  merge: true,
                },
              );
            }

            return true;
          },
        );

      if (repaired) {
        repairedMembers.push({
          memberId:
            candidate.memberId,

          uid:
            candidate.uid,

          displayName:
            candidate.displayName,
        });
      }
    }

    return NextResponse.json({
      ok: true,

      mode:
        "apply",

      repairedCount:
        repairedMembers.length,

      repairedMembers,

      message:
        repairedMembers.length === 1
          ? "1 eligible published developer was restored to the launch premium review queue."
          : `${repairedMembers.length} eligible published developers were restored to the launch premium review queue.`,
    });
  } catch (error) {
    console.error(
      "Repair launch premium queue error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Could not repair the launch premium review queue.",
      },
      {
        status: 500,
      },
    );
  }
}