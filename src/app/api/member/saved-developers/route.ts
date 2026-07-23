import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
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

function sanitizeUrl(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  try {
    const url = new URL(value);

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

function getAvailabilityLabel(
  value: unknown,
): string {
  switch (String(value || "")) {
    case "available":
      return "Available for work";
    case "limited":
      return "Limited availability";
    case "not_available":
      return "Not currently available";
    case "collaborations_only":
      return "Open to collaborations only";
    default:
      return "";
  }
}

function getDeliveryScopeLabel(
  value: unknown,
): string {
  switch (String(value || "")) {
    case "full_team":
      return "Full development team";
    case "solo_full_project":
      return "Solo full-project developer";
    case "specialist":
      return "Specialist";
    default:
      return "";
  }
}

function createSaveId(
  saverUid: string,
  developerUid: string,
): string {
  return `${saverUid}_${developerUid}`;
}

async function loadPublishedProfile(
  developerUid: string,
) {
  const profileSnapshot =
    await adminDb
      .collection("developerProfiles")
      .doc(developerUid)
      .get();

  if (!profileSnapshot.exists) {
    return null;
  }

  const profile =
    profileSnapshot.data() || {};

  if (
    profile.isPublished !== true ||
    String(
      profile.profileStatus || "",
    ) !== "live"
  ) {
    return null;
  }

  return {
    reference:
      profileSnapshot.ref,
    data: profile,
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

    const { member } = authorization;

    const savesSnapshot =
      await adminDb
        .collection("developerSaves")
        .where(
          "savedByUid",
          "==",
          member.uid,
        )
        .get();

    const sortedDocuments =
      savesSnapshot.docs.sort(
        (first, second) => {
          const firstTime =
            first.data().createdAt
              ?.toMillis?.() || 0;

          const secondTime =
            second.data().createdAt
              ?.toMillis?.() || 0;

          return secondTime - firstTime;
        },
      );

    const developers = [];

    for (const document of sortedDocuments) {
      const save = document.data();

      const developerUid =
        String(
          save.developerUid || "",
        );

      if (!developerUid) {
        continue;
      }

      const loadedProfile =
        await loadPublishedProfile(
          developerUid,
        );

      if (!loadedProfile) {
        continue;
      }

      const profile =
        loadedProfile.data;

      const skills =
        Array.isArray(profile.skills)
          ? profile.skills.filter(
              (
                value: unknown,
              ): value is string =>
                typeof value ===
                  "string" &&
                Boolean(value.trim()),
            )
          : [];

      developers.push({
        saveId: document.id,
        developerUid,
        memberId: String(
          profile.memberId || "",
        ),
        slug: String(
          profile.profileSlug ||
          profile.customSubdomain ||
          "",
        ),
        customSubdomain: String(
          profile.customSubdomain || "",
        ),
        displayName: String(
          profile.displayName ||
          "FRDA Developer",
        ),
        headline: String(
          profile.headline || "",
        ),
        bio: String(
          profile.bio || "",
        ),
        avatarUrl: sanitizeUrl(
          profile.avatarUrl,
        ),
        skills,
        availability: String(
          profile.availability || "",
        ),
        availabilityLabel:
          getAvailabilityLabel(
            profile.availability,
          ),
        deliveryScope: String(
          profile.deliveryScope || "",
        ),
        deliveryScopeLabel:
          getDeliveryScopeLabel(
            profile.deliveryScope,
          ),
        savedAt:
          timestampToIso(
            save.createdAt,
          ),
      });
    }

    return NextResponse.json({
      ok: true,
      savedDeveloperUids:
        developers.map(
          (developer) =>
            developer.developerUid,
        ),
      developers,
    });
  } catch (error) {
    console.error(
      "Load saved developers error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your bookmarked developers.",
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

    const { member } = authorization;

    const body = await request
      .json()
      .catch(() => null) as
      | {
          developerUid?: unknown;
        }
      | null;

    const developerUid =
      typeof body?.developerUid ===
        "string"
        ? body.developerUid.trim()
        : "";

    if (!developerUid) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A developer profile is required.",
        },
        { status: 400 },
      );
    }

    if (developerUid === member.uid) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You cannot save your own developer profile.",
        },
        { status: 400 },
      );
    }

    const loadedProfile =
      await loadPublishedProfile(
        developerUid,
      );

    if (!loadedProfile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This developer profile is unavailable.",
        },
        { status: 404 },
      );
    }

    const profile =
      loadedProfile.data;

    const saveReference =
      adminDb
        .collection("developerSaves")
        .doc(
          createSaveId(
            member.uid,
            developerUid,
          ),
        );

    await adminDb.runTransaction(
      async (transaction) => {
        const existingSave =
          await transaction.get(
            saveReference,
          );

        if (existingSave.exists) {
          transaction.set(
            saveReference,
            {
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          return;
        }

        transaction.set(
          saveReference,
          {
            savedByUid: member.uid,
            savedByMemberId:
              member.memberId,
            developerUid,
            developerMemberId:
              String(
                profile.memberId || "",
              ),
            developerSlug:
              String(
                profile.profileSlug ||
                profile.customSubdomain ||
                "",
              ),
            createdAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        transaction.set(
          loadedProfile.reference,
          {
            saveCount:
              FieldValue.increment(1),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      },
    );

    return NextResponse.json({
      ok: true,
      saved: true,
      message: "Developer bookmarked.",
    });
  } catch (error) {
    console.error(
      "Save developer error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not save this developer.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const { member } = authorization;

    const body = await request
      .json()
      .catch(() => null) as
      | {
          developerUid?: unknown;
        }
      | null;

    const developerUid =
      typeof body?.developerUid ===
        "string"
        ? body.developerUid.trim()
        : "";

    if (!developerUid) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A developer profile is required.",
        },
        { status: 400 },
      );
    }

    const saveReference =
      adminDb
        .collection("developerSaves")
        .doc(
          createSaveId(
            member.uid,
            developerUid,
          ),
        );

    const profileReference =
      adminDb
        .collection("developerProfiles")
        .doc(developerUid);

    await adminDb.runTransaction(
      async (transaction) => {
        const [
          existingSave,
          profileSnapshot,
        ] = await Promise.all([
          transaction.get(
            saveReference,
          ),
          transaction.get(
            profileReference,
          ),
        ]);

        if (!existingSave.exists) {
          return;
        }

        transaction.delete(
          saveReference,
        );

        if (profileSnapshot.exists) {
          const profileData =
            profileSnapshot.data() || {};

          const currentSaveCount =
            typeof profileData.saveCount ===
              "number"
              ? profileData.saveCount
              : 0;

          transaction.set(
            profileReference,
            {
              saveCount:
                Math.max(
                  0,
                  currentSaveCount - 1,
                ),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      },
    );

    return NextResponse.json({
      ok: true,
      saved: false,
      message:
        "Developer removed from your bookmarks.",
    });
  } catch (error) {
    console.error(
      "Remove saved developer error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not remove this saved developer.",
      },
      { status: 500 },
    );
  }
}