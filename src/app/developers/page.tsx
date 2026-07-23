"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import Link from "next/link";
import {
    Bookmark,
    Check,
    ChevronDown,
    LoaderCircle,
} from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { useAuthUser } from "@/lib/useAuthUser";
import { notify } from "@/components/ToastConfig";
import {
    GAME_GENRE_OPTIONS,
    getGameGenreLabel,
    type GameDirectoryGenre,
} from "@/lib/gameDirectory";

type DirectoryShowcaseImage = {
    id: string;
    url: string;
    order: number;
};

type DeveloperDirectoryItem = {
    uid: string;
    memberId: string;
    slug: string;
    customSubdomain: string;
    displayName: string;
    headline: string;
    bio: string;
    skills: string[];
    genreExperience: GameDirectoryGenre[];
    availability: string;
    availabilityLabel: string;
    deliveryScope: string;
    deliveryScopeLabel: string;
    avatarUrl: string;

    showcaseImages: DirectoryShowcaseImage[];
    showcasePreviewUrl: string;
    showcaseCount: number;

    isVerified: boolean;
    isFeatured: boolean;
    saveCount: number;
};

type DirectoryCardShowcaseProps = {
    images: DirectoryShowcaseImage[];
};

function getAvailabilityClasses(
    availability: string
): string {
    switch (availability) {
        case "available":
            return "border-emerald-400/25 bg-emerald-500/20 text-emerald-100";

        case "limited":
            return "border-amber-400/25 bg-amber-500/20 text-amber-100";

        case "collaborations_only":
            return "border-violet-400/25 bg-violet-500/20 text-violet-100";

        default:
            return "border-white/15 bg-black/35 text-zinc-200";
    }
}

function DirectoryCardShowcase({
    images,
}: DirectoryCardShowcaseProps) {
    const [activeIndex, setActiveIndex] =
        useState(0);

    const [isPaused, setIsPaused] =
        useState(false);

    const touchStartX =
        useRef<number | null>(null);

    useEffect(() => {
        images.forEach((image) => {
            const preload = new Image();
            preload.src = image.url;
        });
    }, [images]);

    useEffect(() => {
        if (
            images.length <= 1 ||
            isPaused
        ) {
            return;
        }

        const timer = window.setInterval(
            () => {
                setActiveIndex((current) =>
                    current === images.length - 1
                        ? 0
                        : current + 1
                );
            },
            6500
        );

        return () =>
            window.clearInterval(timer);
    }, [
        images.length,
        isPaused,
    ]);

    if (images.length === 0) {
        return null;
    }

    function move(
        event: React.MouseEvent<HTMLButtonElement>,
        direction: "previous" | "next"
    ) {
        event.preventDefault();
        event.stopPropagation();

        setActiveIndex((current) => {
            if (direction === "previous") {
                return current === 0
                    ? images.length - 1
                    : current - 1;
            }

            return current === images.length - 1
                ? 0
                : current + 1;
        });
    }

    function handleTouchStart(
        event: React.TouchEvent<HTMLDivElement>
    ) {
        touchStartX.current =
            event.touches[0]?.clientX ?? null;
    }

    function handleTouchEnd(
        event: React.TouchEvent<HTMLDivElement>
    ) {
        if (touchStartX.current === null) {
            return;
        }

        const endX =
            event.changedTouches[0]?.clientX ??
            touchStartX.current;

        const distance =
            endX - touchStartX.current;

        touchStartX.current = null;

        if (Math.abs(distance) < 45) {
            return;
        }

        setActiveIndex((current) => {
            if (distance > 0) {
                return current === 0
                    ? images.length - 1
                    : current - 1;
            }

            return current === images.length - 1
                ? 0
                : current + 1;
        });
    }

    return (
        <div
            className="group/showcase relative aspect-[16/9] overflow-hidden bg-black/30"
            onMouseEnter={() =>
                setIsPaused(true)
            }
            onMouseLeave={() =>
                setIsPaused(false)
            }
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {images.map((image, index) => (
                <img
                    key={image.id}
                    src={image.url}
                    alt=""
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${
                        index === activeIndex
                            ? "scale-100 opacity-100 group-hover:scale-[1.02]"
                            : "pointer-events-none scale-[1.01] opacity-0"
                    }`}
                />
            ))}

            {images.length > 1 ? (
                <>
                    <button
                        type="button"
                        onClick={(event) =>
                            move(event, "previous")
                        }
                        className="absolute inset-y-0 left-0 z-20 hidden w-14 cursor-pointer items-center justify-start bg-gradient-to-r from-black/50 to-transparent pl-3 text-3xl text-white opacity-0 transition-opacity group-hover/showcase:flex group-hover/showcase:opacity-100"
                        aria-label="Previous cover"
                    >
                        ‹
                    </button>

                    <button
                        type="button"
                        onClick={(event) =>
                            move(event, "next")
                        }
                        className="absolute inset-y-0 right-0 z-20 hidden w-14 cursor-pointer items-center justify-end bg-gradient-to-l from-black/50 to-transparent pr-3 text-3xl text-white opacity-0 transition-opacity group-hover/showcase:flex group-hover/showcase:opacity-100"
                        aria-label="Next cover"
                    >
                        ›
                    </button>

                    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1.5 backdrop-blur-md">
                        {images.map((image, index) => (
                            <button
                                key={image.id}
                                type="button"
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setActiveIndex(index);
                                }}
                                className={`h-1.5 cursor-pointer rounded-full transition-all ${
                                    index === activeIndex
                                        ? "w-4 bg-white"
                                        : "w-1.5 bg-white/45"
                                }`}
                                aria-label={`Show cover ${index + 1}`}
                            />
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function openDeveloperSignupModal() {
    window.dispatchEvent(
        new CustomEvent(
            "frda:open-account-modal",
            {
                detail: {
                    tab: "signup",
                    accountPurpose:
                        "developer",
                },
            },
        ),
    );
}

function getInitials(value: string): string {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) =>
            part.charAt(0).toUpperCase()
        )
        .join("");
}

export default function DeveloperDirectoryPage() {
    const { user, authLoading } =
        useAuthUser();

    const [developers, setDevelopers] =
        useState<DeveloperDirectoryItem[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [pageError, setPageError] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [skillFilter, setSkillFilter] =
        useState("all");

    const [
        availabilityFilter,
        setAvailabilityFilter,
    ] = useState("all");

    const [
        genreFilters,
        setGenreFilters,
    ] = useState<GameDirectoryGenre[]>([]);

    const [
        genreMenuOpen,
        setGenreMenuOpen,
    ] = useState(false);

    const genreMenuReference =
        useRef<HTMLDivElement | null>(null);

    const [savedDeveloperUids, setSavedDeveloperUids] =
        useState<Set<string>>(new Set());

    const [savingDeveloperUid, setSavingDeveloperUid] =
        useState<string | null>(null);

    const [saveAccountPromptOpen, setSaveAccountPromptOpen] =
        useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadDevelopers() {
            setLoading(true);
            setPageError("");

            try {
                const response = await fetch(
                    "/api/public/developers",
                    {
                        cache: "no-store",
                    }
                );

                const result = await response
                    .json()
                    .catch(() => null);

                if (!response.ok || !result?.ok) {
                    throw new Error(
                        result?.error ||
                        "Could not load the developer directory."
                    );
                }

                if (!cancelled) {
                    setDevelopers(
                        result.developers || []
                    );
                }
            } catch (error) {
                if (!cancelled) {
                    setPageError(
                        error instanceof Error
                            ? error.message
                            : "Could not load the developer directory."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadDevelopers();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!user) {
            setSavedDeveloperUids(new Set());
            return;
        }

        const currentUser = user;
        let cancelled = false;

        async function loadSavedDevelopers() {
            try {
                const idToken =
                    await currentUser.getIdToken();

                const response = await fetch(
                    "/api/member/saved-developers",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${idToken}`,
                        },
                        cache: "no-store",
                    },
                );

                const result = await response
                    .json()
                    .catch(() => null);

                if (
                    response.ok &&
                    result?.ok &&
                    !cancelled
                ) {
                    const loadedSavedUids =
                        new Set<string>(
                            result.savedDeveloperUids ||
                            [],
                        );

                    setSavedDeveloperUids(
                        loadedSavedUids,
                    );
                }
            } catch (error) {
                console.error(
                    "Load saved developers error:",
                    error,
                );
            }
        }

        loadSavedDevelopers();

        return () => {
            cancelled = true;
        };
    }, [user]);

    async function toggleSavedDeveloper(
        event: React.MouseEvent<HTMLButtonElement>,
        developer: DeveloperDirectoryItem,
    ) {
        event.preventDefault();
        event.stopPropagation();

        if (authLoading) return;

        if (!user) {
            setSaveAccountPromptOpen(true);
            return;
        }

        if (user.uid === developer.uid) {
            notify.error(
                "You cannot save your own developer profile.",
            );
            return;
        }

        if (savingDeveloperUid) return;

        const currentlySaved =
            savedDeveloperUids.has(
                developer.uid,
            );

        setSavingDeveloperUid(
            developer.uid,
        );

        setSavedDeveloperUids((current) => {
            const next = new Set(current);

            if (currentlySaved) {
                next.delete(developer.uid);
            } else {
                next.add(developer.uid);
            }

            return next;
        });

        try {
            const idToken =
                await user.getIdToken();

            const response = await fetch(
                "/api/member/saved-developers",
                {
                    method:
                        currentlySaved
                            ? "DELETE"
                            : "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        developerUid:
                            developer.uid,
                    }),
                },
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error ||
                    "Could not update your bookmarked developers.",
                );
            }

            notify.success(
                currentlySaved
                    ? "Developer removed from your bookmarks."
                    : "Developer bookmarked.",
            );
        } catch (error) {
            setSavedDeveloperUids(
                (current) => {
                    const next =
                        new Set(current);

                    if (currentlySaved) {
                        next.add(developer.uid);
                    } else {
                        next.delete(
                            developer.uid,
                        );
                    }

                    return next;
                },
            );

            notify.error(
                error instanceof Error
                    ? error.message
                    : "Could not update your bookmarked developers.",
            );
        } finally {
            setSavingDeveloperUid(null);
        }
    }

    function openAccountModal(
        tab: "signup" | "login",
    ) {
        setSaveAccountPromptOpen(false);

        window.setTimeout(() => {
            window.dispatchEvent(
                new CustomEvent(
                    "frda:open-account-modal",
                    {
                        detail: {
                            tab,
                        },
                    },
                ),
            );
        }, 0);
    }

    useEffect(() => {
        function closeGenreMenu(
            event: MouseEvent,
        ) {
            if (
                genreMenuReference.current &&
                !genreMenuReference.current.contains(
                    event.target as Node,
                )
            ) {
                setGenreMenuOpen(false);
            }
        }

        document.addEventListener(
            "mousedown",
            closeGenreMenu,
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                closeGenreMenu,
            );
        };
    }, []);

    function toggleGenreFilter(
        genre: GameDirectoryGenre,
    ) {
        setGenreFilters((current) =>
            current.includes(genre)
                ? current.filter(
                    (item) => item !== genre,
                )
                : [...current, genre],
        );
    }

    const availableSkills = useMemo(() => {
        return Array.from(
            new Set(
                developers.flatMap(
                    (developer) =>
                        developer.skills
                )
            )
        ).sort((first, second) =>
            first.localeCompare(second)
        );
    }, [developers]);

    const skillCounts = useMemo(() => {
        const counts = new Map<
            string,
            number
        >();

        developers.forEach((developer) => {
            developer.skills.forEach((skill) => {
                counts.set(
                    skill,
                    (counts.get(skill) || 0) + 1
                );
            });
        });

        return Array.from(
            counts.entries()
        )
            .map(([skill, count]) => ({
                skill,
                count,
            }))
            .sort((first, second) => {
                if (
                    second.count !==
                    first.count
                ) {
                    return (
                        second.count -
                        first.count
                    );
                }

                return first.skill.localeCompare(
                    second.skill
                );
            });
    }, [developers]);

    const primarySkillTabs =
        skillCounts.slice(0, 6);

    const additionalSkillTabs =
        skillCounts.slice(6);

    const filteredDevelopers = useMemo(() => {
        const normalizedSearch =
            search.trim().toLowerCase();

        return developers.filter(
            (developer) => {
                const matchesSearch =
                    !normalizedSearch ||
                    [
                        developer.displayName,
                        developer.headline,
                        developer.bio,
                        developer.skills.join(" "),
                        developer.memberId,
                    ]
                        .join(" ")
                        .toLowerCase()
                        .includes(normalizedSearch);

                const matchesSkill =
                    skillFilter === "all" ||
                    developer.skills.some(
                        (skill) =>
                            skill.toLowerCase() ===
                            skillFilter.toLowerCase()
                    );

                const matchesAvailability =
                    availabilityFilter === "all" ||
                    developer.availability ===
                        availabilityFilter;

                const matchesGenre =
                    genreFilters.length === 0 ||
                    genreFilters.some(
                        (genre) =>
                            developer.genreExperience
                                .includes(genre)
                    );

                return (
                    matchesSearch &&
                    matchesSkill &&
                    matchesAvailability &&
                    matchesGenre
                );
            }
        );
    }, [
        developers,
        search,
        skillFilter,
        availabilityFilter,
        genreFilters,
    ]);

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#030713] text-white">
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#07101f_0%,#040817_50%,#030713_100%)]" />

                <div className="absolute left-1/2 top-[55px] h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-blue-400/10 blur-[145px]" />

                <div className="absolute right-[-180px] top-[160px] h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-[170px]" />

                <div className="absolute left-[-180px] top-[460px] h-[420px] w-[420px] rounded-full bg-indigo-500/8 blur-[150px]" />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_86%_28%,rgba(45,212,191,0.07),transparent_24%)]" />

                <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:72px_72px]" />

                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.015)_0%,rgba(2,6,23,0.08)_40%,rgba(2,6,23,0.38)_100%)]" />
            </div>

            <div className="relative z-10">
                <SiteHeader />

                <section className="mx-auto w-full max-w-7xl px-5 pb-16 pt-32 md:px-8 md:pb-24 md:pt-40">
                <div className="mx-auto max-w-2xl text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
                        FRDA Dev Network
                    </p>

                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                        Find Filipino Roblox Talent
                    </h1>

                    <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                        Explore skilled Filipino Roblox developers,
                        find the right fit for your project, and
                        start a conversation.{" "}
                        <button
                            type="button"
                            onClick={
                                openDeveloperSignupModal
                            }
                            className="cursor-pointer font-medium text-cyan-300 underline decoration-cyan-400/40 underline-offset-4 transition hover:text-cyan-200 hover:decoration-cyan-300"
                        >
                            Filipino developer? Create your free profile.
                        </button>
                    </p>
                </div>

                <div className="mt-9 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px] md:items-center">
                    <input
                        type="search"
                        value={search}
                        onChange={(event) =>
                            setSearch(
                                event.target.value
                            )
                        }
                        placeholder="Search developers..."
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400"
                        style={{
                            borderRadius: 7,
                        }}
                    />

                    <select
                        value={
                            availabilityFilter
                        }
                        onChange={(event) =>
                            setAvailabilityFilter(
                                event.target.value
                            )
                        }
                        className="w-full border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                        style={{
                            borderRadius: 7,
                            colorScheme: "dark",
                        }}
                    >
                        <option value="all">
                            All availability
                        </option>
                        <option value="available">
                            Available for work
                        </option>
                        <option value="limited">
                            Limited availability
                        </option>
                        <option value="not_available">
                            Not currently available
                        </option>
                        <option value="collaborations_only">
                            Open to collaborations only
                        </option>
                    </select>

                    <div
                        ref={genreMenuReference}
                        className="relative"
                    >
                        <button
                            type="button"
                            onClick={() =>
                                setGenreMenuOpen(
                                    (current) =>
                                        !current
                                )
                            }
                            className={`flex w-full cursor-pointer items-center justify-between gap-3 border bg-[#071225] px-4 py-3 text-sm outline-none transition ${
                                genreFilters.length > 0
                                    ? "border-cyan-300/35 text-white shadow-[0_0_20px_rgba(34,211,238,0.10)]"
                                    : "border-white/10 text-zinc-400 hover:border-cyan-400/30"
                            }`}
                            style={{
                                borderRadius: 7,
                            }}
                            aria-expanded={
                                genreMenuOpen
                            }
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                {genreFilters.length > 0 ? (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
                                ) : null}

                                <span className="truncate">
                                    {genreFilters.length > 0
                                        ? `Genre Experience (${genreFilters.length})`
                                        : "Genre Experience"}
                                </span>
                            </span>

                            <ChevronDown
                                className={`h-4 w-4 shrink-0 transition ${
                                    genreMenuOpen
                                        ? "rotate-180"
                                        : ""
                                }`}
                            />
                        </button>

                        {genreMenuOpen ? (
                            <div
                                className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-80 w-full min-w-[240px] overflow-y-auto border border-white/10 bg-[#081426] p-2 shadow-2xl"
                                style={{
                                    borderRadius: 8,
                                }}
                            >
                                {GAME_GENRE_OPTIONS.map(
                                    (genre) => {
                                        const selected =
                                            genreFilters.includes(
                                                genre.value
                                            );

                                        return (
                                            <button
                                                key={
                                                    genre.value
                                                }
                                                type="button"
                                                onClick={() =>
                                                    toggleGenreFilter(
                                                        genre.value
                                                    )
                                                }
                                                className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                                                    selected
                                                        ? "bg-cyan-400/10 text-cyan-100"
                                                        : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                                                }`}
                                                style={{
                                                    borderRadius: 6,
                                                }}
                                            >
                                                <span
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                                                        selected
                                                            ? "border-cyan-300 bg-cyan-400 text-slate-950"
                                                            : "border-white/20 bg-black/20"
                                                    }`}
                                                    style={{
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    {selected ? (
                                                        <Check className="h-3 w-3" />
                                                    ) : null}
                                                </span>

                                                <span>
                                                    {
                                                        genre.label
                                                    }
                                                </span>
                                            </button>
                                        );
                                    }
                                )}

                                {genreFilters.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setGenreFilters(
                                                []
                                            )
                                        }
                                        className="mt-2 w-full cursor-pointer border-t border-white/10 px-3 py-2.5 text-left text-xs font-medium text-cyan-300 hover:text-cyan-200"
                                    >
                                        Clear genre filters
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            setSkillFilter("all")
                        }
                        className={`cursor-pointer border px-3.5 py-2 text-sm font-medium transition ${
                            skillFilter === "all"
                                ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                                : "border-white/10 bg-white/[0.025] text-zinc-300 hover:border-cyan-400/25 hover:text-white"
                        }`}
                        style={{
                            borderRadius: 7,
                        }}
                    >
                        All
                        <span className="ml-2 text-xs opacity-70">
                            {developers.length}
                        </span>
                    </button>

                    {primarySkillTabs.map(
                        ({ skill, count }) => (
                            <button
                                key={skill}
                                type="button"
                                onClick={() =>
                                    setSkillFilter(skill)
                                }
                                className={`cursor-pointer border px-3.5 py-2 text-sm font-medium transition ${
                                    skillFilter === skill
                                        ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                                        : "border-white/10 bg-white/[0.025] text-zinc-300 hover:border-cyan-400/25 hover:text-white"
                                }`}
                                style={{
                                    borderRadius: 7,
                                }}
                            >
                                {skill}
                                <span className="ml-2 text-xs opacity-70">
                                    {count}
                                </span>
                            </button>
                        )
                    )}

                    {additionalSkillTabs.length > 0 ? (
                        <select
                            value={
                                additionalSkillTabs.some(
                                    ({ skill }) =>
                                        skill ===
                                        skillFilter
                                )
                                    ? skillFilter
                                    : ""
                            }
                            onChange={(event) => {
                                if (
                                    event.target.value
                                ) {
                                    setSkillFilter(
                                        event.target.value
                                    );
                                }
                            }}
                            className="border border-white/10 bg-[#071225] px-3.5 py-2 text-sm text-zinc-300 outline-none focus:border-cyan-400"
                            style={{
                                borderRadius: 7,
                                colorScheme: "dark",
                            }}
                        >
                            <option value="">
                                More skills
                            </option>

                            {additionalSkillTabs.map(
                                ({ skill, count }) => (
                                    <option
                                        key={skill}
                                        value={skill}
                                    >
                                        {skill} ({count})
                                    </option>
                                )
                            )}
                        </select>
                    ) : null}
                </div>

                <div className="mt-6 flex items-center justify-between gap-4">
                    <p className="text-sm text-zinc-500">
                        {filteredDevelopers.length}{" "}
                        {filteredDevelopers.length === 1
                            ? "developer"
                            : "developers"}
                    </p>

                    {(search ||
                        skillFilter !== "all" ||
                        availabilityFilter !==
                            "all" ||
                        genreFilters.length > 0) ? (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setSkillFilter("all");
                                setAvailabilityFilter(
                                    "all"
                                );
                                setGenreFilters([]);
                            }}
                            className="cursor-pointer text-sm font-medium text-blue-300 hover:text-blue-200"
                        >
                            Clear filters
                        </button>
                    ) : null}
                </div>

                {pageError ? (
                    <div
                        className="mt-8 border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200"
                        style={{ borderRadius: 8 }}
                    >
                        {pageError}
                    </div>
                ) : loading ? (
                    <div
                        className="mt-8 border border-white/10 bg-white/[0.025] p-6 text-sm text-zinc-400"
                        style={{ borderRadius: 8 }}
                    >
                        Loading developers...
                    </div>
                ) : filteredDevelopers.length ===
                    0 ? (
                    <div
                        className="mt-8 border border-white/10 bg-white/[0.025] p-8 text-center"
                        style={{ borderRadius: 8 }}
                    >
                        <h2 className="text-lg font-semibold text-white">
                            No matching developers
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                            Try changing or clearing the current
                            filters.
                        </p>
                    </div>
                ) : (
                    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredDevelopers.map(
                            (developer) => (
                                <div
                                    key={developer.uid}
                                    className="group relative overflow-hidden border border-white/10 bg-[#0a172a] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-blue-400/35 hover:bg-[#0c1c34] hover:shadow-[0_16px_42px_rgba(0,0,0,0.25),0_0_28px_rgba(37,99,235,0.10)]"
                                    style={{
                                        borderRadius: 8,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={(event) =>
                                            toggleSavedDeveloper(
                                                event,
                                                developer,
                                            )
                                        }
                                        disabled={
                                            savingDeveloperUid ===
                                            developer.uid
                                        }
                                        className={`absolute right-3 top-3 z-30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition disabled:cursor-wait ${
                                            savedDeveloperUids.has(
                                                developer.uid,
                                            )
                                                ? "border-cyan-200/50 bg-cyan-400/85 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.30)]"
                                                : "border-white/20 bg-black/50 text-white hover:border-cyan-200/50 hover:text-cyan-200"
                                        }`}
                                        aria-label={
                                            savedDeveloperUids.has(
                                                developer.uid,
                                            )
                                                ? "Remove bookmarked developer"
                                                : "Bookmark developer"
                                        }
                                        title={
                                            savedDeveloperUids.has(
                                                developer.uid,
                                            )
                                                ? "Bookmarked"
                                                : "Bookmark developer"
                                        }
                                    >
                                        {savingDeveloperUid ===
                                        developer.uid ? (
                                            <LoaderCircle className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Bookmark
                                                className="h-4 w-4"
                                                fill={
                                                    savedDeveloperUids.has(
                                                        developer.uid,
                                                    )
                                                        ? "currentColor"
                                                        : "none"
                                                }
                                            />
                                        )}
                                    </button>

                                    <Link
                                        href={`/developers/${encodeURIComponent(
                                            developer.slug
                                        )}`}
                                        className="block"
                                    >
                                        <DirectoryCardShowcase
                                        images={
                                            developer.showcaseImages ||
                                            []
                                        }
                                    />

                                    <div className="p-4">
                                        <div className="flex items-start gap-3">
                                            {developer.avatarUrl ? (
                                                <img
                                                    src={
                                                        developer.avatarUrl
                                                    }
                                                    alt=""
                                                    className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 text-sm font-semibold text-blue-200">
                                                    {getInitials(
                                                        developer.displayName
                                                    ) || "FD"}
                                                </div>
                                            )}

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="truncate text-base font-semibold text-white">
                                                        {
                                                            developer.displayName
                                                        }
                                                    </h2>

                                                    {developer.isVerified ? (
                                                        <span
                                                            className="border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200"
                                                            style={{
                                                                borderRadius: 999,
                                                            }}
                                                        >
                                                            Verified
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {developer.availabilityLabel ? (
                                                    <span
                                                        className={`mt-2 inline-flex self-start items-center gap-2 border px-2.5 py-1 text-xs font-medium backdrop-blur-sm ${getAvailabilityClasses(
                                                            developer.availability
                                                        )}`}
                                                        style={{
                                                            borderRadius: 999,
                                                        }}
                                                    >
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                        {
                                                            developer
                                                                .availabilityLabel
                                                        }
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                        {developer.deliveryScopeLabel ? (
                                            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-cyan-300">
                                                {developer.deliveryScopeLabel}
                                            </p>
                                        ) : null}

                                        {developer.bio ? (
                                            <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
                                                {developer.bio}
                                            </p>
                                        ) : null}

                                        {developer.genreExperience.length > 0 ? (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {developer.genreExperience
                                                    .slice(0, 3)
                                                    .map((genre) => (
                                                        <span
                                                            key={genre}
                                                            className="border border-cyan-300/15 bg-cyan-400/[0.06] px-2 py-1 text-[10px] text-cyan-200"
                                                            style={{
                                                                borderRadius: 999,
                                                            }}
                                                        >
                                                            {getGameGenreLabel(
                                                                genre
                                                            )}
                                                        </span>
                                                    ))}
                                            </div>
                                        ) : null}

                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {developer.skills
                                                .slice(0, 5)
                                                .map((skill) => (
                                                    <span
                                                        key={skill}
                                                        className="border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300"
                                                        style={{
                                                            borderRadius: 5,
                                                        }}
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                    </Link>
                                </div>
                            )
                        )}
                    </div>
                )}
                </section>

                <SiteFooter />

                {saveAccountPromptOpen ? (
                    <div
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                        onMouseDown={(event) => {
                            if (
                                event.target ===
                                event.currentTarget
                            ) {
                                setSaveAccountPromptOpen(
                                    false,
                                );
                            }
                        }}
                    >
                        <div
                            className="w-full max-w-md border border-white/10 bg-[#081426] p-6 shadow-2xl"
                            style={{ borderRadius: 10 }}
                        >
                            <h2 className="text-xl font-semibold text-white">
                                Bookmark developers to your account
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-zinc-400">
                                Create a free FRDA account or log in to keep a private shortlist of developers you may want to contact or collaborate with later.
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        openAccountModal(
                                            "signup",
                                        )
                                    }
                                    className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                                    style={{ borderRadius: 6 }}
                                >
                                    Sign Up
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        openAccountModal(
                                            "login",
                                        )
                                    }
                                    className="cursor-pointer border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/[0.08]"
                                    style={{ borderRadius: 6 }}
                                >
                                    Log In
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </main>
    );
}