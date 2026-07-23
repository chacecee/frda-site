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
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";

export const runtime = "nodejs";

type ReportStatus =
  | "open"
  | "reviewing"
  | "resolved"
  | "dismissed";

type ReviewStatus =
  | "reviewing"
  | "dismissed"
  | "resolved";

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

function isReviewStatus(
  value: unknown,
): value is ReviewStatus {
  return (
    value === "reviewing" ||
    value === "dismissed" ||
    value === "resolved"
  );
}

function reasonLabel(
  value: unknown,
): string {
  switch (String(value || "")) {
    case "false_claims":
      return "False claims";
    case "stolen_work":
      return "Stolen work";
    case "impersonation":
      return "Impersonation";
    case "inappropriate_content":
      return "Inappropriate content";
    case "spam":
      return "Spam";
    case "other":
      return "Other";
    default:
      return "Unknown";
  }
}

function serializeReport(
  document:
    FirebaseFirestore.QueryDocumentSnapshot |
    FirebaseFirestore.DocumentSnapshot,
) {
  const data =
    document.data() || {};

  return {
    id: document.id,
    profileUid:
      String(data.profileUid || ""),
    profileSlug:
      String(data.profileSlug || ""),
    memberId:
      String(data.memberId || ""),
    developerDisplayName:
      String(
        data.developerDisplayName ||
        "Unnamed Developer",
      ),
    reason:
      String(data.reason || ""),
    reasonLabel:
      reasonLabel(data.reason),
    details:
      String(data.details || ""),
    reporterEmail:
      String(data.reporterEmail || ""),
    status:
      String(data.status || "open") as ReportStatus,
    createdAt:
      timestampToIso(data.createdAt),
    updatedAt:
      timestampToIso(data.updatedAt),
    reviewedAt:
      timestampToIso(data.reviewedAt),
    reviewedByUid:
      String(data.reviewedByUid || ""),
    reviewedByEmail:
      String(data.reviewedByEmail || ""),
    reviewedByName:
      String(data.reviewedByName || ""),
    reviewerNote:
      String(data.reviewerNote || ""),
    resolutionAction:
      String(data.resolutionAction || ""),
    hideProfile:
      data.hideProfile === true,
  };
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

    const snapshot =
      await adminDb
        .collection(
          "developerProfileReports",
        )
        .get();

    const reports =
      snapshot.docs
        .map(serializeReport)
        .sort((first, second) => {
          const firstTime =
            first.createdAt
              ? new Date(
                  first.createdAt,
                ).getTime()
              : 0;

          const secondTime =
            second.createdAt
              ? new Date(
                  second.createdAt,
                ).getTime()
              : 0;

          return (
            secondTime -
            firstTime
          );
        });

    const openCount =
      reports.filter(
        (report) =>
          report.status === "open" ||
          report.status === "reviewing",
      ).length;

    return NextResponse.json({
      ok: true,
      reports,
      openCount,
    });
  } catch (error) {
    console.error(
      "Load developer profile reports error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load developer profile reports.",
      },
      { status: 500 },
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
            reportId?: unknown;
            status?: unknown;
            reviewerNote?: unknown;
            hideProfile?: unknown;
          }
        | null;

    const reportId =
      typeof body?.reportId === "string"
        ? body.reportId.trim()
        : "";

    const reviewerNote =
      typeof body?.reviewerNote === "string"
        ? body.reviewerNote.trim().slice(0, 3000)
        : "";

    const hideProfile =
      body?.hideProfile === true;

    if (!reportId) {
      return NextResponse.json(
        {
          ok: false,
          error: "A report ID is required.",
        },
        { status: 400 },
      );
    }

    if (!isReviewStatus(body?.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Select a valid report status.",
        },
        { status: 400 },
      );
    }

    if (hideProfile && !reviewerNote) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add a reviewer note explaining why the profile should be hidden.",
        },
        { status: 400 },
      );
    }

    const reportReference =
      adminDb
        .collection("developerProfileReports")
        .doc(reportId);

    await adminDb.runTransaction(
      async (transaction) => {
        const reportSnapshot =
          await transaction.get(reportReference);

        if (!reportSnapshot.exists) {
          throw new Error(
            "The profile report no longer exists.",
          );
        }

        const report =
          reportSnapshot.data() || {};

        const profileUid =
          String(report.profileUid || "");

        const memberId =
          String(report.memberId || "");

        const profileReference =
          profileUid
            ? adminDb
                .collection("developerProfiles")
                .doc(profileUid)
            : null;

        const memberReference =
          memberId
            ? adminDb
                .collection("members")
                .doc(memberId)
            : null;

        let profileSnapshot:
          | FirebaseFirestore.DocumentSnapshot
          | null = null;

        let memberSnapshot:
          | FirebaseFirestore.DocumentSnapshot
          | null = null;

        if (profileReference && memberReference) {
          [
            profileSnapshot,
            memberSnapshot,
          ] = await Promise.all([
            transaction.get(profileReference),
            transaction.get(memberReference),
          ]);
        }

        const status =
          body.status as ReviewStatus;

        transaction.set(
          reportReference,
          {
            status,
            hideProfile:
              status === "dismissed"
                ? false
                : hideProfile,
            resolutionAction:
              status === "dismissed"
                ? "report_dismissed"
                : status === "resolved"
                  ? "report_accepted"
                  : "",
            reviewedAt:
              FieldValue.serverTimestamp(),
            reviewedByUid:
              authorization.staff.uid,
            reviewedByEmail:
              authorization.staff.emailAddress,
            reviewedByName:
              authorization.staff.displayName ||
              authorization.staff.emailAddress,
            reviewerNote,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        if (
          !profileReference ||
          !memberReference ||
          !profileSnapshot?.exists ||
          !memberSnapshot?.exists
        ) {
          if (hideProfile) {
            throw new Error(
              "The connected developer profile or member record could not be found.",
            );
          }

          return;
        }

        if (status === "dismissed") {
          transaction.set(
            profileReference,
            {
              moderationLock: false,
              moderationSource: "",
              moderationReportId: "",
              moderationNote: "",
              moderationLockedAt:
                FieldValue.delete(),
              moderationLockedByUid:
                FieldValue.delete(),
              moderationLockedByEmail:
                FieldValue.delete(),
              publicationReviewerNote: "",
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          transaction.set(
            memberReference,
            {
              moderationLock: false,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          return;
        }

        if (hideProfile) {
          transaction.set(
            profileReference,
            {
              profileStatus: "hidden",
              isPublished: false,
              moderationLock: true,
              moderationSource: "profile_report",
              moderationReportId: reportId,
              moderationNote: reviewerNote,
              moderationLockedAt:
                FieldValue.serverTimestamp(),
              moderationLockedByUid:
                authorization.staff.uid,
              moderationLockedByEmail:
                authorization.staff.emailAddress,
              publicationReviewerNote:
                reviewerNote,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          transaction.set(
            memberReference,
            {
              profileStatus: "hidden",
              moderationLock: true,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          return;
        }

        if (
          String(
            profileSnapshot.data()
              ?.moderationReportId || "",
          ) === reportId
        ) {
          transaction.set(
            profileReference,
            {
              moderationLock: false,
              moderationSource: "",
              moderationReportId: "",
              moderationNote: "",
              moderationLockedAt:
                FieldValue.delete(),
              moderationLockedByUid:
                FieldValue.delete(),
              moderationLockedByEmail:
                FieldValue.delete(),
              publicationReviewerNote: "",
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          transaction.set(
            memberReference,
            {
              moderationLock: false,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      },
    );

    const updatedSnapshot =
      await reportReference.get();

    return NextResponse.json({
      ok: true,
      report:
        serializeReport(updatedSnapshot),
      message:
        body.status === "reviewing"
          ? hideProfile
            ? "Report marked under investigation and the profile was hidden."
            : "Report marked under investigation."
          : body.status === "dismissed"
            ? "Report dismissed. Any hide restriction from this report was removed."
            : hideProfile
              ? "Report resolved and the developer profile was hidden."
              : "Report resolved.",
    });
  } catch (error) {
    console.error(
      "Update developer profile report error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Could not update this profile report.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status:
          message.includes("no longer exists")
            ? 404
            : message.includes("could not be found")
              ? 409
              : 500,
      },
    );
  }
}