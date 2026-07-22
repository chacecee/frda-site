"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

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
    availability: string;
    availabilityLabel: string;
    avatarUrl: string;

    showcaseImages: DirectoryShowcaseImage[];
    showcasePreviewUrl: string;
    showcaseCount: number;

    isVerified: boolean;
    isFeatured: boolean;
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

                return (
                    matchesSearch &&
                    matchesSkill &&
                    matchesAvailability
                );
            }
        );
    }, [
        developers,
        search,
        skillFilter,
        availabilityFilter,
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

                <div className="mt-9 flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
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
                        className="w-full border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 md:w-[240px]"
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
                            "all") ? (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setSkillFilter("all");
                                setAvailabilityFilter(
                                    "all"
                                );
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
                                <Link
                                    key={developer.uid}
                                    href={`/developers/${encodeURIComponent(
                                        developer.slug
                                    )}`}
                                    className="group overflow-hidden border border-white/10 bg-[#0a172a] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-blue-400/35 hover:bg-[#0c1c34] hover:shadow-[0_16px_42px_rgba(0,0,0,0.25),0_0_28px_rgba(37,99,235,0.10)]"
                                    style={{
                                        borderRadius: 8,
                                    }}
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

                                        {developer.bio ? (
                                            <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
                                                {developer.bio}
                                            </p>
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
                            )
                        )}
                    </div>
                )}
                </section>

                <SiteFooter />
            </div>
        </main>
    );
}