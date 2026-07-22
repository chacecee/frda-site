import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";

export const runtime = "nodejs";

const REQUEST_COOLDOWN_MS =
  24 * 60 * 60 * 1000;

type InquiryType =
  | "paid_project"
  | "employment"
  | "collaboration"
  | "publishing"
  | "other";

function sanitizeText(
  value: unknown,
  maximumLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function sanitizeUrl(
  value: unknown,
): string {
  const raw = sanitizeText(value, 500);

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function isInquiryType(
  value: unknown,
): value is InquiryType {
  return (
    value === "paid_project" ||
    value === "employment" ||
    value === "collaboration" ||
    value === "publishing" ||
    value === "other"
  );
}

function buildRateLimitId(
  requesterMemberId: string,
  developerMemberId: string,
): string {
  return crypto
    .createHash("sha256")
    .update(
      `${requesterMemberId}:${developerMemberId}`,
    )
    .digest("hex");
}


export async function POST(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const {
      member,
      memberData,
    } = authorization;

    const hasTalentSeekerPurpose =
      member.accountPurpose ===
        "talent_seeker" ||
      member.accountPurpose ===
        "both";

    if (!hasTalentSeekerPurpose) {
      return NextResponse.json(
        {
          ok: false,
          code: "talent_seeker_required",
          error:
            "A talent-seeker account is required to contact developers.",
        },
        { status: 403 },
      );
    }

    if (
      member.talentSeekerStatus !==
      "verified"
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            `talent_seeker_${member.talentSeekerStatus}`,
          error:
            "Your talent-seeker account must be verified before you can contact developers.",
        },
        { status: 403 },
      );
    }

    const body =
      await request.json().catch(() => null);

    const slug =
      sanitizeText(
        body?.developerSlug,
        100,
      ).toLowerCase();

    const inquiryType =
      body?.inquiryType;

    const opportunityTitle =
      sanitizeText(
        body?.opportunityTitle,
        160,
      );

    const organizationName =
      sanitizeText(
        body?.organizationName,
        160,
      );

    const message =
      sanitizeText(
        body?.message,
        4000,
      );

    const rawRelevantUrl =
      sanitizeText(
        body?.relevantUrl,
        500,
      );

    const relevantUrl =
      sanitizeUrl(rawRelevantUrl);

    if (!slug) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The developer profile could not be identified.",
        },
        { status: 400 },
      );
    }

    if (!isInquiryType(inquiryType)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Choose a valid inquiry type.",
        },
        { status: 400 },
      );
    }

    if (
      !opportunityTitle ||
      !message
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An opportunity title and message are required.",
        },
        { status: 400 },
      );
    }

    if (
      message.length < 40
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please provide a little more detail about the opportunity.",
        },
        { status: 400 },
      );
    }

    if (
      rawRelevantUrl &&
      !relevantUrl
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid link beginning with http:// or https://.",
        },
        { status: 400 },
      );
    }

    let developerSnapshot =
      await adminDb
        .collection("developerProfiles")
        .where(
          "profileSlug",
          "==",
          slug,
        )
        .where(
          "isPublished",
          "==",
          true,
        )
        .limit(1)
        .get();

    if (developerSnapshot.empty) {
      developerSnapshot =
        await adminDb
          .collection("developerProfiles")
          .where(
            "customSubdomain",
            "==",
            slug,
          )
          .where(
            "isPublished",
            "==",
            true,
          )
          .limit(1)
          .get();
    }

    if (developerSnapshot.empty) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This developer profile is unavailable.",
        },
        { status: 404 },
      );
    }

    const developerDocument =
      developerSnapshot.docs[0];

    const developerData =
      developerDocument.data();

    if (
      String(
        developerData.profileStatus || "",
      ) !== "live"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This developer profile is unavailable.",
        },
        { status: 404 },
      );
    }

    const developerMemberId =
      String(
        developerData.memberId || "",
      );

    if (!developerMemberId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This developer cannot currently receive connection requests.",
        },
        { status: 409 },
      );
    }

    if (
      developerMemberId ===
      member.memberId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You cannot send a connection request to your own developer profile.",
        },
        { status: 409 },
      );
    }

    const developerMemberSnapshot =
      await adminDb
        .collection("members")
        .doc(developerMemberId)
        .get();

    if (
      !developerMemberSnapshot.exists
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This developer cannot currently receive connection requests.",
        },
        { status: 409 },
      );
    }

    const developerMemberData =
      developerMemberSnapshot.data() || {};

    const developerEmail =
      String(
        developerMemberData.email || "",
      );

    if (
      String(
        developerMemberData.memberStatus ||
        "active",
      ) !== "active"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This developer cannot currently receive connection requests.",
        },
        { status: 409 },
      );
    }

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

    const requestReference =
      adminDb
        .collection(
          "developerConnectionRequests",
        )
        .doc();

    const rateLimitReference =
      adminDb
        .collection(
          "developerConnectionRequestLimits",
        )
        .doc(
          buildRateLimitId(
            member.memberId,
            developerMemberId,
          ),
        );

    await adminDb.runTransaction(
      async (transaction) => {
        const rateLimitSnapshot =
          await transaction.get(
            rateLimitReference,
          );

        const rateLimitData =
          rateLimitSnapshot.data() ||
          {};

        const lastSubmittedAt =
          rateLimitData.lastSubmittedAt;

        if (
          lastSubmittedAt instanceof
            Timestamp &&
          Date.now() -
            lastSubmittedAt.toMillis() <
            REQUEST_COOLDOWN_MS
        ) {
          const lastRequestId =
            String(
              rateLimitData.lastRequestId ||
              "",
            );

          if (lastRequestId) {
            const lastRequestReference =
              adminDb
                .collection(
                  "developerConnectionRequests",
                )
                .doc(lastRequestId);

            const lastRequestSnapshot =
              await transaction.get(
                lastRequestReference,
              );

            if (
              lastRequestSnapshot.exists
            ) {
              throw new Error(
                "You recently contacted this developer. Please wait before sending another request.",
              );
            }
          }
        }

        transaction.set(
          requestReference,
          {
            requestId:
              requestReference.id,

            status: "pending_frda_review",

            inquiryType,
            opportunityTitle,
            organizationName,
            message,
            relevantUrl,

            requesterUid:
              member.uid,

            requesterMemberId:
              member.memberId,

            requesterDisplayName:
              member.displayName,

            requesterAvatarUrl:
              String(
                talentSeekerProfile.avatarUrl ||
                "",
              ),

            requesterLoginEmail:
              member.email,

            requesterContactEmail:
              String(
                talentSeekerProfile
                  .contactEmail ||
                member.email,
              ),

            requesterOrganizationName:
              organizationName ||
              String(
                talentSeekerProfile
                  .organizationName ||
                "",
              ),

            requesterRole:
              String(
                talentSeekerProfile.role ||
                "",
              ),

            developerUid:
              developerDocument.id,

            developerMemberId,

            developerDisplayName:
              String(
                developerData.displayName ||
                "FRDA Developer",
              ),

            developerSlug:
              String(
                developerData.profileSlug ||
                slug,
              ),

            source:
              "public_developer_profile",

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        transaction.set(
          rateLimitReference,
          {
            requesterMemberId:
              member.memberId,

            developerMemberId,

            lastRequestId:
              requestReference.id,

            lastSubmittedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      },
    );

    return NextResponse.json({
      ok: true,
      requestId: requestReference.id,
      message:
        "Your connection request was sent to FRDA for review.",
    });
  } catch (error) {
    console.error(
      "Create developer connection request error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Could not send your connection request.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status:
          message.includes(
            "recently contacted",
          )
            ? 429
            : 500,
      },
    );
  }
}