import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";

export const runtime = "nodejs";

type EntityType =
  | "individual"
  | "studio"
  | "company"
  | "organization";

type AvatarImage = {
  url: string;
  storagePath: string;
  width: number;
  height: number;
};

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

function sanitizeAvatarImage(
  value: unknown,
  memberUid: string,
): AvatarImage | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const raw =
    value as Record<string, unknown>;

  const storagePath =
    sanitizeText(raw.storagePath, 500);

  const requiredPrefix =
    `developer-avatars/${memberUid}/`;

  if (
    !storagePath.startsWith(
      requiredPrefix,
    )
  ) {
    return null;
  }

  const url = sanitizeUrl(raw.url);

  if (!url) {
    return null;
  }

  return {
    url,
    storagePath,
    width:
      typeof raw.width === "number"
        ? Math.max(
            1,
            Math.min(
              2000,
              Math.round(raw.width),
            ),
          )
        : 512,
    height:
      typeof raw.height === "number"
        ? Math.max(
            1,
            Math.min(
              2000,
              Math.round(raw.height),
            ),
          )
        : 512,
  };
}

function isTalentSeekerPurpose(
  value: string,
): boolean {
  return (
    value === "talent_seeker" ||
    value === "both"
  );
}

function getProfile(
  memberData:
    FirebaseFirestore.DocumentData,
  fallbackEmail: string,
) {
  const raw =
    typeof memberData.talentSeekerProfile ===
      "object" &&
    memberData.talentSeekerProfile !== null
      ? memberData.talentSeekerProfile as
          Record<string, unknown>
      : {};

  return {
    avatarUrl:
      String(raw.avatarUrl || ""),
    avatarStoragePath:
      String(
        raw.avatarStoragePath || "",
      ),
    avatarWidth:
      typeof raw.avatarWidth === "number"
        ? raw.avatarWidth
        : 512,
    avatarHeight:
      typeof raw.avatarHeight === "number"
        ? raw.avatarHeight
        : 512,
    entityType:
      raw.entityType === "individual" ||
      raw.entityType === "studio" ||
      raw.entityType === "company" ||
      raw.entityType === "organization"
        ? raw.entityType
        : "individual",
    organizationName:
      String(raw.organizationName || ""),
    role:
      String(raw.role || ""),
    talentNeeds:
      String(raw.talentNeeds || ""),
    websiteUrl:
      String(raw.websiteUrl || ""),
    reasonForJoining:
      String(raw.reasonForJoining || ""),
    contactEmail:
      String(
        raw.contactEmail ||
        fallbackEmail ||
        "",
      ),
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member, memberData } =
      authorization;

    if (
      !isTalentSeekerPurpose(
        member.accountPurpose,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account does not include talent-seeker access.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      verification: {
        status:
          member.talentSeekerStatus,
        reviewerNote:
          String(
            memberData
              .talentSeekerReviewerNote ||
              "",
          ),
        submittedAt:
          timestampToIso(
            memberData
              .talentSeekerSubmittedAt,
          ),
        reviewedAt:
          timestampToIso(
            memberData
              .talentSeekerReviewedAt,
          ),
        profile:
          getProfile(
            memberData,
            member.email,
          ),
      },
    });
  } catch (error) {
    console.error(
      "Load talent-seeker verification error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your talent-seeker verification.",
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
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } =
      authorization;

    if (
      !isTalentSeekerPurpose(
        member.accountPurpose,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account does not include talent-seeker access.",
        },
        { status: 403 },
      );
    }

    const body =
      await request.json().catch(() => null);

    const memberReference = adminDb
      .collection("members")
      .doc(member.memberId);

    if (
      body?.action ===
      "update_avatar"
    ) {
      const avatar =
        sanitizeAvatarImage(
          body.avatarImage,
          member.uid,
        );

      await memberReference.set(
        {
          "talentSeekerProfile.avatarUrl":
            avatar?.url || "",
          "talentSeekerProfile.avatarStoragePath":
            avatar?.storagePath || "",
          "talentSeekerProfile.avatarWidth":
            avatar?.width || 0,
          "talentSeekerProfile.avatarHeight":
            avatar?.height || 0,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return NextResponse.json({
        ok: true,
        avatar,
        message: avatar
          ? "Profile photo updated."
          : "Profile photo removed.",
      });
    }

    if (
      member.talentSeekerStatus ===
      "suspended"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Talent-seeker access is suspended for this membership.",
        },
        { status: 403 },
      );
    }

    if (
      member.talentSeekerStatus ===
      "pending"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your verification is already waiting for review.",
        },
        { status: 409 },
      );
    }

    if (
      member.talentSeekerStatus ===
      "verified"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Verified talent-seeker details cannot be changed from this form.",
        },
        { status: 409 },
      );
    }

    const entityType =
      sanitizeText(
        body?.entityType,
        30,
      ) as EntityType;

    const organizationName =
      sanitizeText(
        body?.organizationName,
        160,
      );

    const role =
      sanitizeText(
        body?.role,
        160,
      );

    const talentNeeds =
      sanitizeText(
        body?.talentNeeds,
        2000,
      );

    const reasonForJoining =
      sanitizeText(
        body?.reasonForJoining,
        2000,
      );

    const rawWebsiteUrl =
      sanitizeText(
        body?.websiteUrl,
        500,
      );

    const websiteUrl =
      sanitizeUrl(rawWebsiteUrl);

    const contactEmail =
      sanitizeText(
        body?.contactEmail,
        254,
      ).toLowerCase();

    if (
      entityType !== "individual" &&
      entityType !== "studio" &&
      entityType !== "company" &&
      entityType !== "organization"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Choose a valid account or organization type.",
        },
        { status: 400 },
      );
    }

    if (
      entityType !== "individual" &&
      !organizationName
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An organization name is required for this account type.",
        },
        { status: 400 },
      );
    }

    if (
      !role ||
      !talentNeeds ||
      !reasonForJoining ||
      !contactEmail
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Role, talent needs, reason for joining, and contact email are required.",
        },
        { status: 400 },
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        contactEmail,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid contact email address.",
        },
        { status: 400 },
      );
    }

    if (
      rawWebsiteUrl &&
      !websiteUrl
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid website URL beginning with http:// or https://.",
        },
        { status: 400 },
      );
    }

    const currentSnapshot =
      await memberReference.get();

    const currentProfile =
      getProfile(
        currentSnapshot.data() || {},
        member.email,
      );

    await memberReference.set(
      {
        talentSeekerProfile: {
          avatarUrl:
            currentProfile.avatarUrl,
          avatarStoragePath:
            currentProfile.avatarStoragePath,
          avatarWidth:
            currentProfile.avatarWidth,
          avatarHeight:
            currentProfile.avatarHeight,
          entityType,
          organizationName,
          role,
          talentNeeds,
          websiteUrl,
          reasonForJoining,
          contactEmail,
        },
        talentSeekerStatus: "pending",
        talentSeekerSubmittedAt:
          FieldValue.serverTimestamp(),
        talentSeekerReviewerNote: "",
        talentSeekerReviewedAt: null,
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      message:
        "Your talent-seeker verification information was submitted for FRDA review.",
    });
  } catch (error) {
    console.error(
      "Save talent-seeker verification error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save your verification information.",
      },
      { status: 500 },
    );
  }
}