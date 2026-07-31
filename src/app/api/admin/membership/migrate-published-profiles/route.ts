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
  buildPublishedDeveloperProfile,
} from "@/lib/server/publishedDeveloperProfiles";

export const runtime = "nodejs";

function response(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

async function loadCandidates() {
  const snapshot =
    await adminDb
      .collection(
        "developerProfiles",
      )
      .where(
        "isPublished",
        "==",
        true,
      )
      .get();

  return snapshot.docs.filter(
    (document) =>
      String(
        document.data()
          .profileStatus ||
        "",
      ) === "live",
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        undefined,
        true,
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const candidates =
      await loadCandidates();

    const existing =
      await Promise.all(
        candidates.map(
          async (document) => {
            const snapshot =
              await adminDb
                .collection(
                  PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
                )
                .doc(
                  document.id,
                )
                .get();

            return snapshot.exists;
          },
        ),
      );

    return response({
      ok: true,
      preview: {
        candidateCount:
          candidates.length,
        alreadyMigratedCount:
          existing.filter(
            Boolean,
          ).length,
        pendingMigrationCount:
          existing.filter(
            (value) =>
              !value,
          ).length,
        developers:
          candidates.map(
            (
              document,
              index,
            ) => ({
              uid:
                document.id,
              displayName:
                String(
                  document.data()
                    .displayName ||
                  "Unnamed Developer",
                ),
              profileSlug:
                String(
                  document.data()
                    .profileSlug ||
                  "",
                ),
              alreadyMigrated:
                existing[index],
            }),
          ),
      },
    });
  } catch (error) {
    console.error(
      "Preview profile migration error:",
      error,
    );

    return response(
      {
        ok: false,
        error:
          "Could not preview the published-profile migration.",
      },
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
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
        .catch(() => null) as
      | {
          confirm?: unknown;
        }
      | null;

    if (
      body?.confirm !==
      "MIGRATE_PUBLISHED_PROFILES"
    ) {
      return response(
        {
          ok: false,
          error:
            "Migration confirmation is missing.",
        },
        400,
      );
    }

    const candidates =
      await loadCandidates();

    let migratedCount = 0;
    let skippedCount = 0;

    for (
      const document of
      candidates
    ) {
      const profile =
        document.data();

      const uid =
        document.id;

      const memberId =
        String(
          profile.memberId ||
          "",
        );

      const publishedReference =
        adminDb
          .collection(
            PUBLISHED_DEVELOPER_PROFILES_COLLECTION,
          )
          .doc(uid);

      const existingPublished =
        await publishedReference.get();

      if (
        existingPublished.exists
      ) {
        skippedCount += 1;
        continue;
      }

      const profileReference =
        adminDb
          .collection(
            "developerProfiles",
          )
          .doc(uid);

      const memberReference =
        memberId
          ? adminDb
              .collection(
                "members",
              )
              .doc(memberId)
          : null;

      await adminDb.runTransaction(
        async (
          transaction,
        ) => {
          transaction.set(
            publishedReference,
            buildPublishedDeveloperProfile({
              uid,
              profile,
              approvedBy: {
                uid:
                  authorization
                    .staff.uid,
                email:
                  authorization
                    .staff
                    .emailAddress,
                name:
                  authorization
                    .staff
                    .displayName ||
                  authorization
                    .staff
                    .emailAddress,
              },
              source:
                "migration",
            }),
            {
              merge: false,
            },
          );

          transaction.set(
            profileReference,
            {
              hasBeenApprovedBefore:
                true,
              requiresProfileReview:
                false,
              lastApprovedSnapshotAt:
                FieldValue
                  .serverTimestamp(),
              moderationMigrationVersion:
                1,
              moderationMigratedAt:
                FieldValue
                  .serverTimestamp(),
              moderationMigratedByUid:
                authorization
                  .staff.uid,
              updatedAt:
                FieldValue
                  .serverTimestamp(),
            },
            {
              merge: true,
            },
          );

          if (
            memberReference
          ) {
            transaction.set(
              memberReference,
              {
                hasBeenApprovedBefore:
                  true,
                requiresProfileReview:
                  false,
                moderationMigrationVersion:
                  1,
                moderationMigratedAt:
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
          }
        },
      );

      migratedCount += 1;
    }

    await adminDb
      .collection(
        "adminMigrationLogs",
      )
      .add({
        migration:
          "published_developer_profiles_v1",
        migratedCount,
        skippedCount,
        totalCandidates:
          candidates.length,
        executedByUid:
          authorization.staff.uid,
        executedByEmail:
          authorization.staff
            .emailAddress,
        executedByName:
          authorization.staff
            .displayName ||
          authorization.staff
            .emailAddress,
        createdAt:
          FieldValue
            .serverTimestamp(),
      });

    return response({
      ok: true,
      migratedCount,
      skippedCount,
      totalCandidates:
        candidates.length,
      message:
        `Migration complete. ${migratedCount} profile(s) copied and ${skippedCount} already-migrated profile(s) skipped.`,
    });
  } catch (error) {
    console.error(
      "Run profile migration error:",
      error,
    );

    return response(
      {
        ok: false,
        error:
          "Could not complete the published-profile migration.",
      },
      500,
    );
  }
}