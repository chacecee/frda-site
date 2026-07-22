import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";

export const runtime = "nodejs";

type ReviewAction =
  | "verify"
  | "request_changes"
  | "reject"
  | "suspend";

function timestampToIso(
  value: unknown,
): string | null {
  if (
    value instanceof Timestamp ||
    (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown })
        .toDate === "function"
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

function isTalentSeekerPurpose(
  value: unknown,
): boolean {
  const purpose =
    String(value || "");

  return (
    purpose === "talent_seeker" ||
    purpose === "both"
  );
}

function serializeTalentSeeker(
  memberId: string,
  data:
    FirebaseFirestore.DocumentData,
) {
  const rawProfile =
    typeof data.talentSeekerProfile ===
      "object" &&
    data.talentSeekerProfile !== null
      ? data.talentSeekerProfile as
          Record<string, unknown>
      : {};

  return {
    memberId,
    uid:
      String(data.authUid || ""),

    email:
      String(data.email || ""),

    displayName:
      String(data.displayName || ""),

    accountPurpose:
      String(data.accountPurpose || ""),

    accountStatus:
      String(data.accountStatus || ""),

    memberStatus:
      String(data.memberStatus || ""),

    talentSeekerStatus:
      String(
        data.talentSeekerStatus ||
        "not_submitted",
      ),

    reviewerNote:
      String(
        data.talentSeekerReviewerNote ||
        "",
      ),

    submittedAt:
      timestampToIso(
        data.talentSeekerSubmittedAt,
      ),

    reviewedAt:
      timestampToIso(
        data.talentSeekerReviewedAt,
      ),

    reviewedByName:
      String(
        data.talentSeekerReviewedByName ||
        "",
      ),

    activatedAt:
      timestampToIso(
        data.activatedAt,
      ),

    profile: {
      avatarUrl:
        String(
          rawProfile.avatarUrl ||
          "",
        ),

      entityType:
        String(
          rawProfile.entityType ||
          "",
        ),

      organizationName:
        String(
          rawProfile.organizationName ||
          "",
        ),

      role:
        String(
          rawProfile.role ||
          "",
        ),

      talentNeeds:
        String(
          rawProfile.talentNeeds ||
          "",
        ),

      websiteUrl:
        String(
          rawProfile.websiteUrl ||
          "",
        ),

      reasonForJoining:
        String(
          rawProfile.reasonForJoining ||
          "",
        ),

      contactEmail:
        String(
          rawProfile.contactEmail ||
          "",
        ),
    },
  };
}

function isReviewAction(
  value: unknown,
): value is ReviewAction {
  return (
    value === "verify" ||
    value === "request_changes" ||
    value === "reject" ||
    value === "suspend"
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        "membership_talent_seeker_accounts",
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const [
      snapshot,
      developerProfilesSnapshot,
    ] = await Promise.all([
      adminDb
        .collection("members")
        .get(),

      adminDb
        .collection("developerProfiles")
        .get(),
    ]);

    const developerAvatarByMemberId =
      new Map<string, string>();

    developerProfilesSnapshot.docs.forEach(
      (document) => {
        const data = document.data();

        const memberId =
          String(data.memberId || "");

        if (memberId) {
          developerAvatarByMemberId.set(
            memberId,
            String(data.avatarUrl || ""),
          );
        }
      },
    );

    const talentSeekers =
      snapshot.docs
        .filter((document) =>
          isTalentSeekerPurpose(
            document.data()
              .accountPurpose,
          ),
        )
        .map((document) => {
          const serialized =
            serializeTalentSeeker(
              document.id,
              document.data(),
            );

          return {
            ...serialized,
            profile: {
              ...serialized.profile,
              avatarUrl:
                serialized.profile.avatarUrl ||
                developerAvatarByMemberId.get(
                  document.id,
                ) ||
                "",
            },
          };
        })
        .sort((first, second) => {
          const firstTime =
            new Date(
              first.submittedAt ||
              first.activatedAt ||
              0,
            ).getTime();

          const secondTime =
            new Date(
              second.submittedAt ||
              second.activatedAt ||
              0,
            ).getTime();

          return secondTime - firstTime;
        });

    return NextResponse.json({
      ok: true,
      talentSeekers,
    });
  } catch (error) {
    console.error(
      "Load talent-seeker accounts error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load talent-seeker accounts.",
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
        "membership_talent_seeker_accounts",
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body =
      await request
        .json()
        .catch(() => null);

    const memberId =
      typeof body?.memberId ===
        "string"
        ? body.memberId.trim()
        : "";

    const reviewerNote =
      typeof body?.reviewerNote ===
        "string"
        ? body.reviewerNote
            .trim()
            .slice(0, 3000)
        : "";

    if (!memberId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A Member ID is required.",
        },
        { status: 400 },
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
            "A valid review action is required.",
        },
        { status: 400 },
      );
    }

    if (
      (
        body.action ===
          "request_changes" ||
        body.action ===
          "reject" ||
        body.action ===
          "suspend"
      ) &&
      !reviewerNote
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add a reviewer note for this action.",
        },
        { status: 400 },
      );
    }

    const memberReference =
      adminDb
        .collection("members")
        .doc(memberId);

    const memberSnapshot =
      await memberReference.get();

    if (!memberSnapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Member not found.",
        },
        { status: 404 },
      );
    }

    const memberData =
      memberSnapshot.data() || {};

    if (
      !isTalentSeekerPurpose(
        memberData.accountPurpose,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This member is not a talent seeker.",
        },
        { status: 409 },
      );
    }

    const currentStatus =
      String(
        memberData
          .talentSeekerStatus ||
        "not_submitted",
      );

    if (
      body.action === "verify" &&
      currentStatus !== "pending"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only submissions waiting for review can be verified.",
        },
        { status: 409 },
      );
    }

    const nextStatus =
      body.action === "verify"
        ? "verified"
        : body.action ===
            "suspend"
          ? "suspended"
          : "rejected";

    await memberReference.set(
      {
        talentSeekerStatus:
          nextStatus,

        talentSeekerReviewerNote:
          reviewerNote,

        talentSeekerReviewedAt:
          FieldValue.serverTimestamp(),

        talentSeekerReviewedByUid:
          authorization.staff.uid,

        talentSeekerReviewedByEmail:
          authorization.staff
            .emailAddress,

        talentSeekerReviewedByName:
          authorization.staff
            .displayName ||
          authorization.staff
            .emailAddress,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const updatedSnapshot =
      await memberReference.get();

    return NextResponse.json({
      ok: true,

      talentSeeker:
        serializeTalentSeeker(
          updatedSnapshot.id,
          updatedSnapshot.data() ||
            {},
        ),

      message:
        body.action === "verify"
          ? "Talent-seeker account verified."
          : body.action ===
              "request_changes"
            ? "Changes were requested from the talent seeker."
            : body.action ===
                "reject"
              ? "Talent-seeker verification rejected."
              : "Talent-seeker access suspended.",
    });
  } catch (error) {
    console.error(
      "Review talent-seeker account error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update this talent-seeker account.",
      },
      { status: 500 },
    );
  }
}