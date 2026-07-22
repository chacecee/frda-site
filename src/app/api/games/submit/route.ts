import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";
import {
  GAME_CONTENT_MATURITY_OPTIONS,
  GAME_GENRE_OPTIONS,
  isProbablyRobloxGameUrl,
  normalizeGameContentMaturity,
  normalizeGameGenre,
} from "@/lib/gameDirectory";

export const runtime = "nodejs";

const DESCRIPTION_LIMIT = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const globalForSubmitRateLimit =
  globalThis as unknown as {
    gameSubmitRateLimit?: Map<
      string,
      {
        count: number;
        resetAt: number;
      }
    >;
  };

const rateLimitStore =
  globalForSubmitRateLimit
    .gameSubmitRateLimit ||
  new Map();

globalForSubmitRateLimit
  .gameSubmitRateLimit =
  rateLimitStore;

function getClientIp(
  request: NextRequest,
) {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(
  key: string,
) {
  const now = Date.now();
  const windowMs =
    10 * 60 * 1000;
  const maxSubmissions = 5;

  const existing =
    rateLimitStore.get(key);

  if (
    !existing ||
    existing.resetAt < now
  ) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return false;
  }

  existing.count += 1;
  rateLimitStore.set(
    key,
    existing,
  );

  return (
    existing.count >
    maxSubmissions
  );
}

function cleanString(
  value: FormDataEntryValue | null,
  maxLength = 500,
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
}

function cleanEmail(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .slice(0, 180);
}

function isValidEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function cleanRobloxUrl(
  value: string,
) {
  const trimmed =
    value.trim();

  try {
    return new URL(
      trimmed,
    ).toString();
  } catch {
    return trimmed;
  }
}

function getFileExtension(
  file: File,
) {
  if (
    file.type === "image/png"
  ) {
    return "png";
  }

  if (
    file.type === "image/webp"
  ) {
    return "webp";
  }

  return "jpg";
}

function validateImageFile(
  file: File | null,
) {
  if (
    !file ||
    file.size === 0
  ) {
    return "";
  }

  if (
    !ALLOWED_IMAGE_TYPES.has(
      file.type,
    )
  ) {
    return "Please upload JPG, PNG, or WEBP images only.";
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    return "Each uploaded image must be smaller than 5MB.";
  }

  return "";
}

async function uploadSubmissionImage(
  args: {
    file: File;
    folder:
      | "thumbnails"
      | "covers";
    submissionId: string;
  },
) {
  const extension =
    getFileExtension(
      args.file,
    );

  const safeBase =
    `${Date.now()}-${crypto.randomUUID()}`;

  const imagePath =
    `game-directory/submissions/${args.submissionId}/${args.folder}/${safeBase}.${extension}`;

  const arrayBuffer =
    await args.file.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  const bucket =
    adminStorage.bucket();

  const storageFile =
    bucket.file(imagePath);

  await storageFile.save(
    buffer,
    {
      metadata: {
        contentType:
          args.file.type,
        cacheControl:
          "public, max-age=31536000",
      },
    },
  );

  await storageFile.makePublic();

  return {
    imagePath,
    imageUrl:
      `https://storage.googleapis.com/${bucket.name}/${imagePath}`,
  };
}

async function hasDuplicateRobloxUrl(
  robloxUrl: string,
) {
  const snapshot =
    await adminDb
      .collection(
        "gameDirectory",
      )
      .where(
        "robloxUrl",
        "==",
        robloxUrl,
      )
      .limit(1)
      .get();

  return !snapshot.empty;
}

function normalizeMemberId(
  value: string,
) {
  const cleaned =
    value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/-/g, "");

  if (!cleaned) return "";

  if (
    cleaned.startsWith(
      "FRDAM",
    )
  ) {
    const code =
      cleaned.replace(
        "FRDAM",
        "",
      );

    return code
      ? `FRDA-M-${code}`
      : "";
  }

  if (
    cleaned.startsWith(
      "FRDA",
    )
  ) {
    const code =
      cleaned
        .replace("FRDA", "")
        .replace(/^M/, "");

    return code
      ? `FRDA-M-${code}`
      : "";
  }

  return `FRDA-M-${cleaned}`;
}

type VerifiedMember = {
  memberId: string;
  email: string;
  fullName: string;
  listingLimit: number;
  paidListingCredits: number;
  applicationId: string;
  authUid: string;
};

async function verifyLegacyMember(
  args: {
    memberId: string;
    contactEmail: string;
  },
): Promise<
  | {
      ok: true;
      member: VerifiedMember;
    }
  | {
      ok: false;
      error: string;
      status: number;
    }
> {
  const normalizedMemberId =
    normalizeMemberId(
      args.memberId,
    );

  const normalizedEmail =
    cleanEmail(
      args.contactEmail,
    );

  const memberSnapshot =
    await adminDb
      .collection("members")
      .doc(normalizedMemberId)
      .get();

  if (
    memberSnapshot.exists
  ) {
    const data =
      memberSnapshot.data() || {};

    if (
      String(
        data.email || "",
      ).toLowerCase() !==
      normalizedEmail
    ) {
      return {
        ok: false,
        status: 403,
        error:
          "The email you entered does not match this FRDA Member ID.",
      };
    }

    return {
      ok: true,
      member: {
        memberId:
          memberSnapshot.id,
        email:
          normalizedEmail,
        fullName:
          String(
            data.displayName || "",
          ),
        listingLimit:
          Number(
            data.memberListingLimit ||
            3,
          ),
        paidListingCredits:
          Number(
            data.paidListingCredits ||
            0,
          ),
        applicationId:
          String(
            data.sourceApplicationId ||
            "",
          ),
        authUid:
          String(
            data.authUid || "",
          ),
      },
    };
  }

  const applicationSnapshot =
    await adminDb
      .collection("applications")
      .where(
        "memberId",
        "==",
        normalizedMemberId,
      )
      .limit(1)
      .get();

  if (
    applicationSnapshot.empty
  ) {
    return {
      ok: false,
      status: 404,
      error:
        "This FRDA Member ID does not exist in our system.",
    };
  }

  const document =
    applicationSnapshot.docs[0];

  const data =
    document.data();

  if (
    data.status !== "accepted"
  ) {
    return {
      ok: false,
      status: 403,
      error:
        "This FRDA Member ID is not tied to an accepted developer account yet.",
    };
  }

  const registeredEmail =
    cleanEmail(
      String(
        data.email || "",
      ),
    );

  if (
    registeredEmail !==
    normalizedEmail
  ) {
    return {
      ok: false,
      status: 403,
      error:
        "The email you entered does not match this FRDA Member ID.",
    };
  }

  return {
    ok: true,
    member: {
      memberId:
        String(
          data.memberId ||
          normalizedMemberId,
        ),
      email:
        registeredEmail,
      fullName:
        `${data.firstName || ""} ${data.lastName || ""}`.trim(),
      listingLimit:
        Number(
          data.memberListingLimit ||
          3,
        ),
      paidListingCredits:
        Number(
          data.paidListingCredits ||
          0,
        ),
      applicationId:
        document.id,
      authUid: "",
    },
  };
}

async function countActiveListings(
  memberId: string,
) {
  const activeStatuses =
    new Set([
      "for_approval",
      "pending",
      "published",
    ]);

  const snapshot =
    await adminDb
      .collection("gameDirectory")
      .where(
        "memberId",
        "==",
        memberId,
      )
      .get();

  return snapshot.docs.filter(
    (document) =>
      activeStatuses.has(
        String(
          document.data()
            .status || "",
        ),
      ),
  ).length;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const authorizationHeader =
      request.headers.get(
        "authorization",
      );

    const isAuthenticatedSubmission =
      Boolean(
        authorizationHeader
          ?.toLowerCase()
          .startsWith("bearer "),
      );

    let authenticatedMember:
      VerifiedMember | null = null;

    if (
      isAuthenticatedSubmission
    ) {
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

      if (
        member.accountPurpose !==
          "developer" &&
        member.accountPurpose !==
          "both"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "A developer account is required to submit a game.",
          },
          { status: 403 },
        );
      }

      authenticatedMember = {
        memberId:
          member.memberId,
        email:
          member.email,
        fullName:
          member.displayName,
        listingLimit:
          typeof memberData
            .memberListingLimit ===
          "number"
            ? memberData
                .memberListingLimit
            : 3,
        paidListingCredits:
          typeof memberData
            .paidListingCredits ===
          "number"
            ? memberData
                .paidListingCredits
            : 0,
        applicationId:
          String(
            memberData
              .sourceApplicationId ||
            "",
          ),
        authUid:
          member.uid,
      };
    }

    const rateLimitKey =
      authenticatedMember
        ? `member:${authenticatedMember.memberId}`
        : `ip:${getClientIp(request)}`;

    if (
      isRateLimited(
        rateLimitKey,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Too many submissions were sent. Please try again later.",
        },
        { status: 429 },
      );
    }

    const formData =
      await request.formData();

    const honeypot =
      cleanString(
        formData.get(
          "companyWebsite",
        ),
        200,
      );

    if (honeypot) {
      return NextResponse.json({
        ok: true,
      });
    }

    const formStartedAt =
      Number(
        cleanString(
          formData.get(
            "formStartedAt",
          ),
          30,
        ),
      );

    if (
      !formStartedAt ||
      Date.now() -
        formStartedAt <
        5000
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please review the form before submitting.",
        },
        { status: 400 },
      );
    }

    const title =
      cleanString(
        formData.get("title"),
        120,
      );

    const description =
      cleanString(
        formData.get(
          "description",
        ),
        DESCRIPTION_LIMIT + 20,
      );

    const robloxUrl =
      cleanRobloxUrl(
        cleanString(
          formData.get(
            "robloxUrl",
          ),
          500,
        ),
      );

    const creatorName =
      cleanString(
        formData.get(
          "creatorName",
        ),
        120,
      );

    const creatorType =
      cleanString(
        formData.get(
          "creatorType",
        ),
        40,
      ) === "group"
        ? "group"
        : "individual";

    const genre =
      normalizeGameGenre(
        cleanString(
          formData.get("genre"),
          80,
        ),
      );

    const contentMaturity =
      normalizeGameContentMaturity(
        cleanString(
          formData.get(
            "contentMaturity",
          ),
          80,
        ),
      );

    const thumbnailFile =
      formData.get(
        "thumbnail",
      ) as File | null;

    if (
      !title ||
      !creatorName ||
      !description ||
      !robloxUrl
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Complete all required game details.",
        },
        { status: 400 },
      );
    }

    if (
      description.length >
      DESCRIPTION_LIMIT
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Description must be ${DESCRIPTION_LIMIT} characters or less.`,
        },
        { status: 400 },
      );
    }

    if (
      !isProbablyRobloxGameUrl(
        robloxUrl,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please enter a valid Roblox game, share, or community link.",
        },
        { status: 400 },
      );
    }

    if (
      !GAME_GENRE_OPTIONS
        .map((item) => item.value)
        .includes(genre)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please choose a valid genre.",
        },
        { status: 400 },
      );
    }

    if (
      !GAME_CONTENT_MATURITY_OPTIONS
        .map((item) => item.value)
        .includes(contentMaturity)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please choose a valid content maturity level.",
        },
        { status: 400 },
      );
    }

    if (
      !thumbnailFile ||
      thumbnailFile.size === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please upload a thumbnail image for your game.",
        },
        { status: 400 },
      );
    }

    const thumbnailError =
      validateImageFile(
        thumbnailFile,
      );

    if (thumbnailError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            thumbnailError,
        },
        { status: 400 },
      );
    }

    let verifiedMember =
      authenticatedMember;

    if (!verifiedMember) {
      const memberId =
        normalizeMemberId(
          cleanString(
            formData.get(
              "memberId",
            ),
            80,
          ),
        );

      const contactEmail =
        cleanEmail(
          cleanString(
            formData.get(
              "contactEmail",
            ),
            180,
          ),
        );

      if (
        !memberId ||
        !contactEmail ||
        !isValidEmail(
          contactEmail,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Enter a valid FRDA Member ID and contact email.",
          },
          { status: 400 },
        );
      }

      const verifiedResult =
        await verifyLegacyMember({
          memberId,
          contactEmail,
        });

      if (!verifiedResult.ok) {
        return NextResponse.json(
          {
            ok: false,
            error:
              verifiedResult.error,
          },
          {
            status:
              verifiedResult.status,
          },
        );
      }

      verifiedMember =
        verifiedResult.member;
    }

    const activeListingCount =
      await countActiveListings(
        verifiedMember.memberId,
      );

    const totalAllowedListings =
      verifiedMember.listingLimit +
      verifiedMember
        .paidListingCredits;

    if (
      activeListingCount >=
      totalAllowedListings
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You have no available directory listings remaining.",
        },
        { status: 403 },
      );
    }

    if (
      await hasDuplicateRobloxUrl(
        robloxUrl,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This Roblox experience has already been submitted or listed.",
        },
        { status: 409 },
      );
    }

    const submissionId =
      crypto.randomUUID();

    const uploadedThumbnail =
      await uploadSubmissionImage({
        file: thumbnailFile,
        folder: "thumbnails",
        submissionId,
      });

    const documentReference =
      await adminDb
        .collection(
          "gameDirectory",
        )
        .add({
          title,
          description,
          robloxUrl,

          creatorName,
          creatorType,

          memberId:
            verifiedMember.memberId,
          memberApplicationId:
            verifiedMember.applicationId,
          memberAuthUid:
            verifiedMember.authUid,
          memberEmailSnapshot:
            verifiedMember.email,
          memberNameSnapshot:
            verifiedMember.fullName,

          listingSlotType: "free",
          listingLimitAtSubmission:
            verifiedMember.listingLimit,
          paidListingCreditsAtSubmission:
            verifiedMember
              .paidListingCredits,
          activeListingCountAtSubmission:
            activeListingCount + 1,

          genre,
          contentMaturity,

          thumbnailUrl:
            uploadedThumbnail.imageUrl,
          thumbnailPath:
            uploadedThumbnail.imagePath,
          coverImageUrl: "",
          coverImagePath: "",

          isSponsored: false,
          isHighlighted: false,
          isHiddenFromPublic: true,

          status: "for_approval",
          source:
            "member_submission",

          submittedByName:
            creatorName,
          submittedByEmail:
            verifiedMember.email,
          submittedByMemberId:
            verifiedMember.memberId,
          submittedByUid:
            verifiedMember.authUid,
          submittedAt:
            FieldValue.serverTimestamp(),

          createdAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),

          submissionMeta: {
            ipCountry:
              request.headers.get(
                "x-vercel-ip-country",
              ) || "",
            userAgent:
              request.headers.get(
                "user-agent",
              ) || "",
          },
        });

    return NextResponse.json({
      ok: true,
      id:
        documentReference.id,
    });
  } catch (error) {
    console.error(
      "Game submission error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not submit your game right now. Please try again.",
      },
      { status: 500 },
    );
  }
}