import type { Timestamp } from "firebase/firestore";

export type GameDirectoryStatus =
    | "for_approval"
    | "published"
    | "pending"
    | "declined"
    | "archived";

export type GameDirectoryGenre =
    | "action"
    | "adventure"
    | "education"
    | "entertainment"
    | "obby_platformer"
    | "party_casual"
    | "puzzle"
    | "rpg"
    | "roleplay_avatar_sim"
    | "shooter"
    | "shopping"
    | "simulation"
    | "social"
    | "sports_racing"
    | "strategy"
    | "survival"
    | "utility_other";

export type GameContentMaturity =
    | "minimal"
    | "mild"
    | "moderate"
    | "restricted";

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
    thumbnailPath?: string;
    coverImageUrl?: string;
    coverImagePath?: string;

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
        { value: "action", label: "Action" },
        { value: "adventure", label: "Adventure" },
        { value: "education", label: "Education" },
        { value: "entertainment", label: "Entertainment" },
        { value: "obby_platformer", label: "Obby & Platformer" },
        { value: "party_casual", label: "Party & Casual" },
        { value: "puzzle", label: "Puzzle" },
        { value: "rpg", label: "RPG" },
        { value: "roleplay_avatar_sim", label: "Roleplay & Avatar Sim" },
        { value: "shooter", label: "Shooter" },
        { value: "shopping", label: "Shopping" },
        { value: "simulation", label: "Simulation" },
        { value: "social", label: "Social" },
        { value: "sports_racing", label: "Sports & Racing" },
        { value: "strategy", label: "Strategy" },
        { value: "survival", label: "Survival" },
        { value: "utility_other", label: "Utility & Other" },
    ];

export const GAME_CONTENT_MATURITY_OPTIONS: Array<{
    value: GameContentMaturity;
    label: string;
    publicLabel: string;
}> = [
        {
            value: "minimal",
            label: "Minimal",
            publicLabel: "Minimal",
        },
        {
            value: "mild",
            label: "Mild",
            publicLabel: "Mild",
        },
        {
            value: "moderate",
            label: "Moderate",
            publicLabel: "Moderate",
        },
        {
            value: "restricted",
            label: "Restricted",
            publicLabel: "Restricted",
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

    const legacyMap: Record<string, GameDirectoryGenre> = {
        obby: "obby_platformer",
        roleplay: "roleplay_avatar_sim",
        simulator: "simulation",
        educational: "education",
        racing: "sports_racing",
        fighting: "action",
        horror: "survival",
        tycoon: "simulation",
        showcase: "entertainment",
        other: "utility_other",
    };

    const migratedValue = legacyMap[normalized || ""] || normalized;

    const match = GAME_GENRE_OPTIONS.find((item) => item.value === migratedValue);

    return match?.value || "utility_other";
}
export function normalizeGameContentMaturity(
    value?: string | null
): GameContentMaturity {
    const normalized = value?.trim().toLowerCase();

    if (
        normalized === "minimal" ||
        normalized === "mild" ||
        normalized === "moderate" ||
        normalized === "restricted"
    ) {
        return normalized;
    }

    return "minimal";
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