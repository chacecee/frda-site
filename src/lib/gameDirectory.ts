import type { Timestamp } from "firebase/firestore";

export type GameDirectoryStatus =
  | "for_approval"
  | "published"
  | "pending"
  | "declined"
  | "archived";

export type GameDirectoryGenre =
  | "adventure"
  | "obby"
  | "roleplay"
  | "simulator"
  | "horror"
  | "survival"
  | "tycoon"
  | "puzzle"
  | "racing"
  | "fighting"
  | "shooter"
  | "social"
  | "educational"
  | "showcase"
  | "other";

export type GameContentMaturity =
  | "minimal"
  | "mild"
  | "moderate"
  | "restricted"
  | "not_sure";

export type GameDirectorySource = "staff_added" | "member_submission";

export type GameDirectoryItem = {
  id: string;

  title: string;
  description: string;
  robloxUrl: string;

  creatorName: string;
  creatorType?: "individual" | "group";
  memberId?: string;

  genre: GameDirectoryGenre;
  contentMaturity: GameContentMaturity;

  status: GameDirectoryStatus;
  source: GameDirectorySource;

  thumbnailUrl?: string;
  coverImageUrl?: string;

  isSponsored?: boolean;
  isHighlighted?: boolean;
  isHiddenFromPublic?: boolean;

  submittedByName?: string;
  submittedByEmail?: string;
  submittedByMemberId?: string;
  submittedAt?: Timestamp;

  uploadedByUid?: string;
  uploadedByName?: string;
  uploadedByEmail?: string;
  uploadedAt?: Timestamp;

  reviewedByUid?: string;
  reviewedByName?: string;
  reviewedByEmail?: string;
  reviewedAt?: Timestamp;

  reviewerNote?: string;
  declineReason?: string;
  archiveReason?: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export const GAME_STATUS_OPTIONS: Array<{
  value: GameDirectoryStatus;
  label: string;
  description: string;
}> = [
  {
    value: "for_approval",
    label: "For Approval",
    description: "New submissions or staff-added games waiting for review.",
  },
  {
    value: "published",
    label: "Published",
    description: "Visible on the public game directory.",
  },
  {
    value: "pending",
    label: "Pending",
    description: "Needs more checking before approval or decline.",
  },
  {
    value: "declined",
    label: "Declined",
    description: "Rejected and not shown publicly.",
  },
  {
    value: "archived",
    label: "Archived",
    description: "Previously listed or stored, but retired from public display.",
  },
];

export const GAME_GENRE_OPTIONS: Array<{
  value: GameDirectoryGenre;
  label: string;
}> = [
  { value: "adventure", label: "Adventure" },
  { value: "obby", label: "Obby" },
  { value: "roleplay", label: "Roleplay" },
  { value: "simulator", label: "Simulator" },
  { value: "horror", label: "Horror" },
  { value: "survival", label: "Survival" },
  { value: "tycoon", label: "Tycoon" },
  { value: "puzzle", label: "Puzzle" },
  { value: "racing", label: "Racing" },
  { value: "fighting", label: "Fighting" },
  { value: "shooter", label: "Shooter" },
  { value: "social", label: "Social" },
  { value: "educational", label: "Educational" },
  { value: "showcase", label: "Showcase" },
  { value: "other", label: "Other" },
];

export const GAME_CONTENT_MATURITY_OPTIONS: Array<{
  value: GameContentMaturity;
  label: string;
  publicLabel: string;
}> = [
  {
    value: "minimal",
    label: "Minimal",
    publicLabel: "Minimal maturity",
  },
  {
    value: "mild",
    label: "Mild",
    publicLabel: "Mild maturity",
  },
  {
    value: "moderate",
    label: "Moderate",
    publicLabel: "Moderate maturity",
  },
  {
    value: "restricted",
    label: "Restricted",
    publicLabel: "Restricted maturity",
  },
  {
    value: "not_sure",
    label: "Not sure",
    publicLabel: "Not reviewed yet",
  },
];

export function getGameStatusLabel(status?: string) {
  return (
    GAME_STATUS_OPTIONS.find((item) => item.value === status)?.label ||
    "Unknown"
  );
}

export function getGameGenreLabel(genre?: string) {
  return GAME_GENRE_OPTIONS.find((item) => item.value === genre)?.label || "Other";
}

export function getGameContentMaturityLabel(value?: string) {
  return (
    GAME_CONTENT_MATURITY_OPTIONS.find((item) => item.value === value)
      ?.publicLabel || "Not reviewed yet"
  );
}

export function normalizeGameDirectoryStatus(
  value?: string | null
): GameDirectoryStatus {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "for_approval" ||
    normalized === "published" ||
    normalized === "pending" ||
    normalized === "declined" ||
    normalized === "archived"
  ) {
    return normalized;
  }

  return "for_approval";
}

export function normalizeGameGenre(value?: string | null): GameDirectoryGenre {
  const normalized = value?.trim().toLowerCase();

  const match = GAME_GENRE_OPTIONS.find((item) => item.value === normalized);

  return match?.value || "other";
}

export function normalizeGameContentMaturity(
  value?: string | null
): GameContentMaturity {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "minimal" ||
    normalized === "mild" ||
    normalized === "moderate" ||
    normalized === "restricted" ||
    normalized === "not_sure"
  ) {
    return normalized;
  }

  return "not_sure";
}

export function cleanRobloxGameUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (!url.hostname.includes("roblox.com")) {
      return trimmed;
    }

    return url.toString();
  } catch {
    return trimmed;
  }
}

export function isProbablyRobloxGameUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    return (
      url.hostname.includes("roblox.com") &&
      (url.pathname.includes("/games/") ||
        url.pathname.includes("/share") ||
        url.pathname.includes("/communities/"))
    );
  } catch {
    return false;
  }
}