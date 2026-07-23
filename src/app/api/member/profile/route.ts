import { NextRequest, NextResponse } from "next/server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";
import {
  GAME_GENRE_OPTIONS,
  type GameDirectoryGenre,
} from "@/lib/gameDirectory";

export const runtime = "nodejs";

type ProfileUpdateBody = {
  displayName?: unknown;
  headline?: unknown;
  bio?: unknown;
  skills?: unknown;
  genreExperience?: unknown;
  availability?: unknown;
  experienceTier?: unknown;
  deliveryScope?: unknown;
  robloxProfileUrl?: unknown;
  portfolioUrl?: unknown;
  workSamples?: unknown;
  coverShowcaseImages?: unknown;
  avatarImage?: unknown;
};

type AvatarImage = {
  url: string;
  storagePath: string;
  width: number;
  height: number;
};

type CoverShowcaseImage = {
  id: string;
  url: string;
  storagePath: string;
  width: number;
  height: number;
  order: 1 | 2 | 3;
};

type WorkSampleImage = {
  id: string;
  url: string;
  storagePath: string;
  width: number;
  height: number;

  // Temporary legacy fields.
  showcaseOrder: number | null;
  showcaseUrl: string;
  showcaseStoragePath: string;
};

type WorkSampleMediaOrderItem = {
  type: "image" | "youtube";
  id: string;
};

type WorkSample = {
  id: string;
  title: string;
  projectUrl: string;
  youtubeVideoUrl: string;
  mediaOrder: WorkSampleMediaOrderItem[];
  role: string;
  contribution: string;
  teamName: string;

  projectType: "owned" | "team" | "client" | "other";

  isInDevelopment: boolean;
  images: WorkSampleImage[];
  thumbnailUrl: string;
};

function timestampToIso(value: unknown): string | null {
  if (
    value instanceof Timestamp ||
    (typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (
        value as {
          toDate?: unknown;
        }
      ).toDate === "function")
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

function sanitizeText(value: unknown, maximumLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function sanitizeUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function sanitizeYoutubeUrl(value: unknown): string {
  const urlValue = sanitizeUrl(value);

  if (!urlValue) {
    return "";
  }

  try {
    const url = new URL(urlValue);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v") || "";
      } else {
        const parts = url.pathname.split("/").filter(Boolean);

        if (
          parts[0] === "shorts" ||
          parts[0] === "embed" ||
          parts[0] === "live"
        ) {
          videoId = parts[1] || "";
        }
      }
    }

    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      return "";
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return "";
  }
}

function sanitizeExperienceTier(
  value: unknown,
): "aspiring" | "emerging" | "established" | "experienced" | "" {
  return value === "aspiring" ||
    value === "emerging" ||
    value === "established" ||
    value === "experienced"
    ? value
    : "";
}

function sanitizeDeliveryScope(
  value: unknown,
): "full_team" | "solo_full_project" | "specialist" | "" {
  return value === "full_team" ||
    value === "solo_full_project" ||
    value === "specialist"
    ? value
    : "";
}

function sanitizeGenreExperience(
  value: unknown,
): GameDirectoryGenre[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedGenres =
    new Set<GameDirectoryGenre>(
      GAME_GENRE_OPTIONS.map(
        (option) => option.value,
      ),
    );

  const uniqueGenres =
    new Set<GameDirectoryGenre>();

  value.forEach((item) => {
    if (
      typeof item === "string" &&
      allowedGenres.has(
        item as GameDirectoryGenre,
      )
    ) {
      uniqueGenres.add(
        item as GameDirectoryGenre,
      );
    }
  });

  return Array.from(
    uniqueGenres,
  ).slice(0, 12);
}

function sanitizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueSkills = new Set<string>();

  value.forEach((item) => {
    if (typeof item !== "string") {
      return;
    }

    const skill = item.trim().slice(0, 60);

    if (skill) {
      uniqueSkills.add(skill);
    }
  });

  return Array.from(uniqueSkills).slice(0, 20);
}

function sanitizeAvatarImage(
  value: unknown,
  memberUid: string,
): AvatarImage | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const storagePath = sanitizeText(raw.storagePath, 500);
  const requiredPrefix = `developer-avatars/${memberUid}/`;

  if (!storagePath.startsWith(requiredPrefix)) {
    return null;
  }

  const url = sanitizeUrl(raw.url);
  if (!url) return null;

  return {
    url,
    storagePath,
    width:
      typeof raw.width === "number"
        ? Math.max(1, Math.min(2000, Math.round(raw.width)))
        : 512,
    height:
      typeof raw.height === "number"
        ? Math.max(1, Math.min(2000, Math.round(raw.height)))
        : 512,
  };
}

function sanitizeCoverShowcaseImages(
  value: unknown,
  memberUid: string,
): CoverShowcaseImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const requiredPrefix = `developer-showcase/${memberUid}/`;

  const usedOrders = new Set<number>();

  return value
    .slice(0, 3)
    .map((item) => {
      const raw =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};

      const storagePath = sanitizeText(raw.storagePath, 500);

      const rawOrder = typeof raw.order === "number" ? raw.order : null;

      if (!storagePath.startsWith(requiredPrefix)) {
        return null;
      }

      if (rawOrder !== 1 && rawOrder !== 2 && rawOrder !== 3) {
        return null;
      }

      if (usedOrders.has(rawOrder)) {
        return null;
      }

      const id = sanitizeText(raw.id, 100);

      const url = sanitizeUrl(raw.url);

      if (!id || !url) {
        return null;
      }

      usedOrders.add(rawOrder);

      return {
        id,
        url,
        storagePath,

        width:
          typeof raw.width === "number"
            ? Math.max(1, Math.min(5000, Math.round(raw.width)))
            : 1600,

        height:
          typeof raw.height === "number"
            ? Math.max(1, Math.min(5000, Math.round(raw.height)))
            : 900,

        order: rawOrder as 1 | 2 | 3,
      };
    })
    .filter((item): item is CoverShowcaseImage => item !== null)
    .sort((first, second) => first.order - second.order);
}

function sanitizeWorkSampleImages(
  value: unknown,
  memberUid: string,
): WorkSampleImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const requiredPrefix = `developer-work/${memberUid}/`;

  return value
    .slice(0, 5)
    .map((item) => {
      const raw =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};

      const storagePath = sanitizeText(raw.storagePath, 500);

      if (!storagePath.startsWith(requiredPrefix)) {
        return null;
      }

      const showcaseStoragePath = sanitizeText(raw.showcaseStoragePath, 500);

      if (
        showcaseStoragePath &&
        !showcaseStoragePath.startsWith(requiredPrefix)
      ) {
        return null;
      }

      return {
        id: sanitizeText(raw.id, 100),

        url: sanitizeUrl(raw.url),

        storagePath,

        width:
          typeof raw.width === "number"
            ? Math.max(1, Math.min(5000, Math.round(raw.width)))
            : 1,

        height:
          typeof raw.height === "number"
            ? Math.max(1, Math.min(5000, Math.round(raw.height)))
            : 1,

        showcaseOrder:
          raw.showcaseOrder === 1 ||
          raw.showcaseOrder === 2 ||
          raw.showcaseOrder === 3
            ? raw.showcaseOrder
            : null,

        showcaseUrl: sanitizeUrl(raw.showcaseUrl),

        showcaseStoragePath,
      };
    })
    .filter((item): item is WorkSampleImage =>
      Boolean(item?.id && item.url && item.storagePath),
    );
}

function sanitizeMediaOrder(
  value: unknown,
  images: WorkSampleImage[],
  youtubeVideoUrl: string,
): WorkSampleMediaOrderItem[] {
  const validImageIds = new Set(images.map((image) => image.id));
  const usedKeys = new Set<string>();
  const ordered: WorkSampleMediaOrderItem[] = [];

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const raw =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};

      const type =
        raw.type === "image" || raw.type === "youtube"
          ? raw.type
          : null;

      const id = sanitizeText(raw.id, 100);

      if (!type || !id) {
        return;
      }

      if (type === "image" && !validImageIds.has(id)) {
        return;
      }

      if (type === "youtube" && (!youtubeVideoUrl || id !== "youtube")) {
        return;
      }

      const key = `${type}:${id}`;

      if (usedKeys.has(key)) {
        return;
      }

      usedKeys.add(key);
      ordered.push({ type, id });
    });
  }

  if (youtubeVideoUrl && !usedKeys.has("youtube:youtube")) {
    ordered.push({
      type: "youtube",
      id: "youtube",
    });
    usedKeys.add("youtube:youtube");
  }

  images.forEach((image) => {
    const key = `image:${image.id}`;

    if (!usedKeys.has(key)) {
      ordered.push({
        type: "image",
        id: image.id,
      });
      usedKeys.add(key);
    }
  });

  return ordered.slice(0, images.length + (youtubeVideoUrl ? 1 : 0));
}

function sanitizeWorkSamples(value: unknown, memberUid: string): WorkSample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 6)
    .map((item, index) => {
      const raw =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};

      const rawProjectType = sanitizeText(raw.projectType, 30);

      const projectType: WorkSample["projectType"] =
        rawProjectType === "owned" ||
        rawProjectType === "team" ||
        rawProjectType === "client" ||
        rawProjectType === "other"
          ? rawProjectType
          : "other";

      const images =
        sanitizeWorkSampleImages(
          raw.images,
          memberUid,
        );

      const youtubeVideoUrl =
        sanitizeYoutubeUrl(
          raw.youtubeVideoUrl,
        );

      return {
        id: sanitizeText(raw.id, 80) || `work-${index + 1}`,

        title: sanitizeText(raw.title, 120),

        projectUrl: sanitizeUrl(raw.projectUrl),

        youtubeVideoUrl,

        mediaOrder:
          sanitizeMediaOrder(
            raw.mediaOrder,
            images,
            youtubeVideoUrl,
          ),

        role: sanitizeText(raw.role, 160),

        contribution: sanitizeText(raw.contribution, 1200),

        teamName: sanitizeText(raw.teamName, 120),

        projectType,

        isInDevelopment: raw.isInDevelopment === true,

        images,

        thumbnailUrl: sanitizeUrl(raw.thumbnailUrl),
      };
    })
    .filter((item) =>
      Boolean(
        item.title ||
          item.projectUrl ||
          item.youtubeVideoUrl ||
          item.role ||
          item.contribution ||
          item.teamName ||
          item.images.length > 0 ||
          item.thumbnailUrl,
      ),
    );
}

function serializeProfile(uid: string, data: FirebaseFirestore.DocumentData) {
  return {
    uid,

    memberId: String(data.memberId || ""),

    email: String(data.email || ""),

    displayName: String(data.displayName || ""),

    headline: String(data.headline || ""),

    bio: String(data.bio || ""),

    skills: Array.isArray(data.skills)
      ? data.skills.filter(
          (value: unknown): value is string => typeof value === "string",
        )
      : [],

    genreExperience:
      sanitizeGenreExperience(
        data.genreExperience,
      ),

    availability: String(data.availability || ""),

    experienceTier:
      sanitizeExperienceTier(data.experienceTier),

    deliveryScope:
      sanitizeDeliveryScope(data.deliveryScope),

    robloxProfileUrl: String(data.robloxProfileUrl || ""),

    portfolioUrl: String(data.portfolioUrl || ""),

    avatarUrl: String(data.avatarUrl || ""),

    avatarStoragePath: String(data.avatarStoragePath || ""),

    workSamples: Array.isArray(data.workSamples) ? data.workSamples : [],

    coverShowcaseImages: Array.isArray(data.coverShowcaseImages)
      ? data.coverShowcaseImages
      : [],

    customSubdomain: String(data.customSubdomain || ""),

    customProfileAddress: String(data.customProfileAddress || ""),

    profileStatus: String(data.profileStatus || "draft"),

    isPublished: data.isPublished === true,

    moderationLock:
      data.moderationLock === true,

    moderationNote:
      String(data.moderationNote || ""),

    moderationSource:
      String(data.moderationSource || ""),

    moderationReportId:
      String(data.moderationReportId || ""),

    createdAt: timestampToIso(data.createdAt),

    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeMemberRequest(request);

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
          error: "This account does not include a developer profile.",
        },
        { status: 403 },
      );
    }

    const profileReference = adminDb
      .collection("developerProfiles")
      .doc(member.uid);

    const profileSnapshot = await profileReference.get();

    if (!profileSnapshot.exists) {
      await profileReference.set({
        uid: member.uid,
        memberId: member.memberId,
        email: member.email,
        displayName: member.displayName,

        headline: "",
        bio: "",
        skills: [],
        genreExperience: [],
        availability: "",
        experienceTier: "",
        experienceTierIsSelfDeclared: true,
        deliveryScope: "",
        robloxProfileUrl: "",
        portfolioUrl: "",
        workSamples: [],
        coverShowcaseImages: [],
        avatarUrl: "",
        avatarStoragePath: "",

        customSubdomain: "",
        customProfileAddress: "",

        profileStatus: "draft",
        isPublished: false,

        moderationLock: false,
        moderationNote: "",
        moderationSource: "",
        moderationReportId: "",

        createdAt: FieldValue.serverTimestamp(),

        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const updatedSnapshot = await profileReference.get();

    return NextResponse.json({
      ok: true,

      profile: serializeProfile(
        updatedSnapshot.id,
        updatedSnapshot.data() || {},
      ),
    });
  } catch (error) {
    console.error("Load developer profile error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load your developer profile.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await authorizeMemberRequest(request);

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
          error: "This account does not include a developer profile.",
        },
        { status: 403 },
      );
    }

    const body = (await request
      .json()
      .catch(() => null)) as ProfileUpdateBody | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing profile information.",
        },
        { status: 400 },
      );
    }

    const displayName = sanitizeText(body.displayName, 100);

    const headline = sanitizeText(body.headline, 140);

    const bio = sanitizeText(body.bio, 2000);

    const availability = sanitizeText(body.availability, 80);

    const experienceTier =
      sanitizeExperienceTier(body.experienceTier);

    const deliveryScope =
      sanitizeDeliveryScope(body.deliveryScope);

    const skills = sanitizeSkills(body.skills);

    const genreExperience =
      sanitizeGenreExperience(
        body.genreExperience,
      );

    const rawRobloxProfileUrl =
      typeof body.robloxProfileUrl === "string"
        ? body.robloxProfileUrl.trim()
        : "";

    const rawPortfolioUrl =
      typeof body.portfolioUrl === "string" ? body.portfolioUrl.trim() : "";

    const robloxProfileUrl = sanitizeUrl(rawRobloxProfileUrl);

    const portfolioUrl = sanitizeUrl(rawPortfolioUrl);

    const workSamples = sanitizeWorkSamples(body.workSamples, member.uid);

    const coverShowcaseImages = sanitizeCoverShowcaseImages(
      body.coverShowcaseImages,
      member.uid,
    );

    const avatarImage = sanitizeAvatarImage(body.avatarImage, member.uid);

    if (!displayName) {
      return NextResponse.json(
        {
          ok: false,
          error: "A display name is required.",
        },
        { status: 400 },
      );
    }

    if (!experienceTier) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Choose the experience level that best describes you.",
        },
        { status: 400 },
      );
    }

    if (!deliveryScope) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Choose the type of development work you can take on.",
        },
        { status: 400 },
      );
    }

    if (rawRobloxProfileUrl && !robloxProfileUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid Roblox profile URL beginning with http:// or https://.",
        },
        { status: 400 },
      );
    }

    if (rawPortfolioUrl && !portfolioUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a valid portfolio URL beginning with http:// or https://.",
        },
        { status: 400 },
      );
    }

    const profileReference = adminDb
      .collection("developerProfiles")
      .doc(member.uid);

    const memberReference = adminDb.collection("members").doc(member.memberId);

    const existingSnapshot = await profileReference.get();

    const existingProfile = existingSnapshot.exists
      ? existingSnapshot.data() || {}
      : {};

    const moderationLocked =
      existingProfile.moderationLock === true;

    const remainsPublished =
      !moderationLocked &&
      existingProfile.isPublished === true &&
      String(existingProfile.profileStatus || "") === "live";

    await adminDb.runTransaction(async (transaction) => {
      transaction.set(
        profileReference,
        {
          uid: member.uid,
          memberId: member.memberId,
          email: member.email,

          displayName,
          headline,
          bio,
          skills,
          genreExperience,
          availability,

          experienceTier,
          experienceTierIsSelfDeclared: true,
          experienceTierUpdatedAt:
            existingProfile.experienceTier ===
            experienceTier
              ? existingProfile.experienceTierUpdatedAt ||
                FieldValue.serverTimestamp()
              : FieldValue.serverTimestamp(),

          deliveryScope,

          // Kept for FRDA/internal use.
          robloxProfileUrl,

          portfolioUrl,
          workSamples,
          coverShowcaseImages,

          avatarUrl: avatarImage?.url || "",

          avatarStoragePath: avatarImage?.storagePath || "",

          profileStatus:
            moderationLocked
              ? "hidden"
              : remainsPublished
                ? "live"
                : "draft",

          isPublished:
            moderationLocked
              ? false
              : remainsPublished,

          updatedAt: FieldValue.serverTimestamp(),

          createdAt: existingProfile.createdAt || FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      transaction.set(
        memberReference,
        {
          displayName,

          profileStatus:
            moderationLocked
              ? "hidden"
              : remainsPublished
                ? "live"
                : "draft",

          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    const updatedSnapshot = await profileReference.get();

    return NextResponse.json({
      ok: true,

      profile: serializeProfile(
        updatedSnapshot.id,
        updatedSnapshot.data() || {},
      ),

      message: "Developer profile draft saved.",
    });
  } catch (error) {
    console.error("Save developer profile error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not save your developer profile.",
      },
      { status: 500 },
    );
  }
}