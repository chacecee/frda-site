import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";

export const runtime = "nodejs";

type PublicationAction = "publish" | "unpublish";

function timestampToIso(value: unknown): string | null {
  if (
    value instanceof Timestamp ||
    (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate ===
        "function"
    )
  ) {
    return (value as { toDate: () => Date })
      .toDate()
      .toISOString();
  }

  return null;
}

function getMissingFields(
  profile: FirebaseFirestore.DocumentData
): string[] {
  const missing: string[] = [];

  if (!String(profile.displayName || "").trim()) {
    missing.push("Display name");
  }

  if (!String(profile.headline || "").trim()) {
    missing.push("Professional headline");
  }

  if (!String(profile.bio || "").trim()) {
    missing.push("Bio");
  }

  if (
    !Array.isArray(profile.skills) ||
    profile.skills.length === 0
  ) {
    missing.push("At least one skill");
  }

  if (!String(profile.robloxProfileUrl || "").trim()) {
    missing.push("Roblox profile");
  }

  return missing;
}

function isPublicationAction(
  value: unknown
): value is PublicationAction {
  return value === "publish" || value === "unpublish";
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

export async function GET(request: NextRequest) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } = authorization;

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
        { status: 403 }
      );
    }

    const profileSnapshot = await adminDb
      .collection("developerProfiles")
      .doc(member.uid)
      .get();

    if (!profileSnapshot.exists) {
      return NextResponse.json({
        ok: true,
        publication: {
          status: "draft",
          isPublished: false,
          publishedAt: null,
          unpublishedAt: null,
          reviewerNote: "",
        },
      });
    }

    const profile = profileSnapshot.data() || {};

    return NextResponse.json({
      ok: true,
      publication: {
        status: String(
          profile.profileStatus || "draft"
        ),
        isPublished: profile.isPublished === true,
        publishedAt: timestampToIso(
          profile.publishedAt
        ),
        unpublishedAt: timestampToIso(
          profile.unpublishedAt
        ),
        reviewerNote: String(
          profile.publicationReviewerNote || ""
        ),
      },
    });
  } catch (error) {
    console.error(
      "Load profile publication status error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your profile publication status.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } = authorization;

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
        { status: 403 }
      );
    }

    const body = (await request
      .json()
      .catch(() => null)) as
      | {
          action?: unknown;
          confirmedAccuracy?: unknown;
        }
      | null;

    if (!isPublicationAction(body?.action)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid publication action is required.",
        },
        { status: 400 }
      );
    }

    const profileReference = adminDb
      .collection("developerProfiles")
      .doc(member.uid);

    const memberReference = adminDb
      .collection("members")
      .doc(member.memberId);

    if (body.action === "publish") {
      if (body.confirmedAccuracy !== true) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "You must confirm that your profile information and portfolio claims are accurate.",
          },
          { status: 400 }
        );
      }

      await adminDb.runTransaction(async (transaction) => {
        const profileSnapshot =
          await transaction.get(profileReference);

        if (!profileSnapshot.exists) {
          throw new Error(
            "Create and save your developer profile before publishing it."
          );
        }

        const profile =
          profileSnapshot.data() || {};

        const missingFields =
          getMissingFields(profile);

        if (missingFields.length > 0) {
          throw new Error(
            `Complete these required fields first — ${missingFields.join(
              ", "
            )}.`
          );
        }

        const profileSlug =
          String(profile.profileSlug || "") ||
          createProfileSlug({
            displayName: String(
              profile.displayName || "Developer"
            ),
            memberId: member.memberId,
          });

        transaction.set(
          profileReference,
          {
            profileStatus: "live",
            isPublished: true,
            profileSlug,

            publishedAt:
              profile.publishedAt ||
              FieldValue.serverTimestamp(),

            lastPublishedAt:
              FieldValue.serverTimestamp(),

            publicationRequestedAt:
              FieldValue.delete(),

            publicationReviewerNote: "",

            selfPublicationConfirmed: true,
            selfPublicationConfirmedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
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
      });

      return NextResponse.json({
        ok: true,
        publication: {
          status: "live",
          isPublished: true,
          publishedAt: new Date().toISOString(),
          unpublishedAt: null,
          reviewerNote: "",
        },
        message:
          "Your developer profile is now published.",
      });
    }

    await adminDb.runTransaction(async (transaction) => {
      const profileSnapshot =
        await transaction.get(profileReference);

      if (!profileSnapshot.exists) {
        throw new Error(
          "Your developer profile could not be found."
        );
      }

      const profile =
        profileSnapshot.data() || {};

      if (profile.isPublished !== true) {
        throw new Error(
          "This developer profile is not currently published."
        );
      }

      transaction.set(
        profileReference,
        {
          profileStatus: "draft",
          isPublished: false,
          unpublishedAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        memberReference,
        {
          profileStatus: "draft",
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({
      ok: true,
      publication: {
        status: "draft",
        isPublished: false,
        publishedAt: null,
        unpublishedAt: new Date().toISOString(),
        reviewerNote: "",
      },
      message:
        "Your developer profile has been unpublished.",
    });
  } catch (error) {
    console.error(
      "Update developer profile publication error:",
      error
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
        : message.includes("not currently published")
          ? 409
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