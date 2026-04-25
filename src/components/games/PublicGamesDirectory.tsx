"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, X } from "lucide-react";
import { logAnalyticsEvent } from "@/lib/analytics";
import {
    GAME_CONTENT_MATURITY_OPTIONS,
    GAME_GENRE_OPTIONS,
    GameContentMaturity,
    GameDirectoryGenre,
    getGameContentMaturityLabel,
    getGameGenreLabel,
    normalizeGameContentMaturity,
    normalizeGameGenre,
} from "@/lib/gameDirectory";

type PublicGame = {
    id: string;
    title: string;
    description: string;
    robloxUrl: string;
    creatorName: string;
    creatorType: string;
    genre: GameDirectoryGenre;
    contentMaturity: GameContentMaturity;
    thumbnailUrl: string;
    coverImageUrl: string;
    isSponsored: boolean;
    isHighlighted: boolean;
    createdAt: string | null;
    updatedAt: string | null;
};

type ApiResponse = {
    ok: boolean;
    games?: PublicGame[];
    error?: string;
};

const ALL_GENRES = "all";
const ALL_MATURITY = "all";

const SHOW_HIGHLIGHTED_GAMES = false;

function normalizeText(value?: string | null) {
    return value?.trim().toLowerCase() || "";
}

function EmptyImage({ label = "No image" }: { label?: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-700">
            {label}
        </div>
    );
}

function GameCard({
    game,
    onOpen,
}: {
    game: PublicGame;
    onOpen: (game: PublicGame) => void;
}) {
    function handleOpen() {
        logAnalyticsEvent({
            eventName: "game_card_click",
            path: "/games",
            metadata: {
                gameId: game.id,
                gameTitle: game.title,
                creator: game.creatorName,
                genre: game.genre,
                clickType: "open_details",
            },
        });

        onOpen(game);
    }

    return (
        <button
            type="button"
            onClick={handleOpen}
            className="group block overflow-hidden border border-zinc-800 bg-zinc-950/35 text-left transition hover:border-blue-400/35 hover:bg-zinc-950/55"
            style={{ borderRadius: 8 }}
        >
            <div className="aspect-video overflow-hidden border-b border-zinc-800 bg-zinc-950">
                {game.thumbnailUrl ? (
                    <img
                        src={game.thumbnailUrl}
                        alt={game.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                ) : (
                    <EmptyImage />
                )}
            </div>

            <div className="p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                    <span
                        className="border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-blue-200"
                        style={{ borderRadius: 999 }}
                    >
                        {getGameGenreLabel(game.genre)}
                    </span>

                    <span
                        className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400"
                        style={{ borderRadius: 999 }}
                    >
                        {getGameContentMaturityLabel(game.contentMaturity)}
                    </span>
                </div>

                <h2 className="line-clamp-2 text-lg font-semibold leading-tight text-white group-hover:text-blue-300">
                    {game.title}
                </h2>

                <p className="mt-2 truncate text-sm text-zinc-500">
                    By <span className="text-zinc-300">{game.creatorName || "Unknown creator"}</span>
                </p>
            </div>
        </button>
    );
}

function GameDetailsModal({
    game,
    onClose,
}: {
    game: PublicGame;
    onClose: () => void;
}) {
    function handlePlayClick() {
        logAnalyticsEvent({
            eventName: "play_on_roblox_click",
            path: "/games",
            metadata: {
                gameId: game.id,
                gameTitle: game.title,
                creator: game.creatorName,
                genre: game.genre,
                clickType: "modal_play_button",
            },
        });
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4">
            <div className="flex min-h-full items-start justify-center py-8">
                <div
                    className="w-full max-w-4xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
                    style={{ borderRadius: 10 }}
                >
                    <div className="relative aspect-video bg-black">
                        {game.coverImageUrl || game.thumbnailUrl ? (
                            <img
                                src={game.coverImageUrl || game.thumbnailUrl}
                                alt={game.title}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <EmptyImage />
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center border border-white/15 bg-black/70 text-xl text-white backdrop-blur transition hover:bg-black"
                            style={{ borderRadius: 5 }}
                            aria-label="Close game details"
                        >
                            ×
                        </button>
                    </div>

                    <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                            <div className="mb-4 flex flex-wrap gap-2">
                                <span
                                    className="border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-blue-200"
                                    style={{ borderRadius: 999 }}
                                >
                                    {getGameGenreLabel(game.genre)}
                                </span>

                                <span
                                    className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400"
                                    style={{ borderRadius: 999 }}
                                >
                                    {getGameContentMaturityLabel(game.contentMaturity)}
                                </span>
                            </div>

                            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                                {game.title}
                            </h2>

                            <p className="mt-2 text-sm text-zinc-500">
                                By{" "}
                                <span className="text-zinc-300">
                                    {game.creatorName || "Unknown creator"}
                                </span>
                            </p>

                            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-zinc-300">
                                {game.description || "No description provided."}
                            </p>
                        </div>

                        <div>
                            <a
                                href={game.robloxUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={handlePlayClick}
                                className="inline-flex w-full items-center justify-center gap-2 border border-blue-400/30 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
                                style={{ borderRadius: 5 }}
                            >
                                Play on Roblox
                                <ExternalLink size={14} />
                            </a>

                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-3 w-full cursor-pointer border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                                style={{ borderRadius: 5 }}
                            >
                                Back to directory
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PublicGamesDirectory() {
    const [games, setGames] = useState<PublicGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [search, setSearch] = useState("");
    const [activeGenre, setActiveGenre] = useState<string>(ALL_GENRES);
    const [activeMaturity, setActiveMaturity] = useState<string>(ALL_MATURITY);
    const [showHighlights, setShowHighlights] = useState(true);
    const [selectedGame, setSelectedGame] = useState<PublicGame | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadGames() {
            setLoading(true);
            setErrorMsg("");

            try {
                const response = await fetch("/api/games/directory", {
                    cache: "no-store",
                });

                const result = (await response.json().catch(() => null)) as ApiResponse | null;

                if (!response.ok || !result?.ok) {
                    throw new Error(result?.error || "Could not load games.");
                }

                const rows = (result.games || []).map((game) => ({
                    ...game,
                    genre: normalizeGameGenre(game.genre),
                    contentMaturity: normalizeGameContentMaturity(game.contentMaturity),
                }));

                if (!cancelled) {
                    setGames(rows);
                }
            } catch (error) {
                console.error("Game directory load error:", error);

                if (!cancelled) {
                    setErrorMsg("Could not load the game directory right now.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadGames();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const trimmed = search.trim();

        if (trimmed.length < 2) return;

        const timeout = window.setTimeout(() => {
            logAnalyticsEvent({
                eventName: "search_used",
                path: "/games",
                metadata: {
                    searchTerm: trimmed,
                    area: "game_directory",
                },
            });
        }, 800);

        return () => window.clearTimeout(timeout);
    }, [search]);

    const highlightedGames = useMemo(() => {
        return games.filter((game) => game.isHighlighted || game.isSponsored).slice(0, 5);
    }, [games]);

    const genreCounts = useMemo(() => {
        const counts: Record<string, number> = {
            [ALL_GENRES]: games.length,
        };

        games.forEach((game) => {
            counts[game.genre] = (counts[game.genre] || 0) + 1;
        });

        return counts;
    }, [games]);

    const filteredGames = useMemo(() => {
        const q = normalizeText(search);

        return games.filter((game) => {
            const matchesGenre = activeGenre === ALL_GENRES || game.genre === activeGenre;
            const matchesMaturity =
                activeMaturity === ALL_MATURITY || game.contentMaturity === activeMaturity;

            const searchableText = [
                game.title,
                game.description,
                game.creatorName,
                getGameGenreLabel(game.genre),
                getGameContentMaturityLabel(game.contentMaturity),
            ]
                .join(" ")
                .toLowerCase();

            const matchesSearch = !q || searchableText.includes(q);

            return matchesGenre && matchesMaturity && matchesSearch;
        });
    }, [games, search, activeGenre, activeMaturity]);

    function selectGenre(value: string) {
        setActiveGenre(value);

        logAnalyticsEvent({
            eventName: "category_click",
            path: "/games",
            metadata: {
                category: value === ALL_GENRES ? "All" : getGameGenreLabel(value),
                categoryValue: value,
            },
        });
    }

    function handleSubmitCtaClick() {
        logAnalyticsEvent({
            eventName: "submit_game_cta_click",
            path: "/games",
            metadata: {
                ctaLocation: "public_game_directory",
            },
        });
    }

    return (
        <section className="mx-auto max-w-[1500px] px-6 pb-24 pt-[110px] md:px-8 md:pt-[120px]">
            <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="order-2 lg:order-1">
                    <div
                        className="sticky top-24 border border-zinc-800 bg-zinc-950/35 p-4"
                        style={{ borderRadius: 8 }}
                    >
                        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Categories
                        </p>

                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => selectGenre(ALL_GENRES)}
                                className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm transition ${activeGenre === ALL_GENRES
                                    ? "bg-blue-500/15 text-blue-100"
                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                    }`}
                                style={{ borderRadius: 5 }}
                            >
                                <span>All Games</span>
                                <span className="text-xs text-zinc-500">{genreCounts[ALL_GENRES] || 0}</span>
                            </button>

                            {GAME_GENRE_OPTIONS.map((genre) => (
                                <button
                                    key={genre.value}
                                    type="button"
                                    onClick={() => selectGenre(genre.value)}
                                    className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm transition ${activeGenre === genre.value
                                        ? "bg-blue-500/15 text-blue-100"
                                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                        }`}
                                    style={{ borderRadius: 5 }}
                                >
                                    <span>{genre.label}</span>
                                    <span className="text-xs text-zinc-500">{genreCounts[genre.value] || 0}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <a
                        href="/games/submit"
                        onClick={handleSubmitCtaClick}
                        className="mt-4 flex w-full items-center justify-center border border-blue-400/30 bg-blue-500/15 px-4 py-3 text-center text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
                        style={{ borderRadius: 5 }}
                    >
                        Want to submit your game?
                    </a>
                </aside>

                <div className="order-1 min-w-0 lg:order-2">
                    <div className="mb-6 max-w-5xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
                            FRDA Game Directory
                        </p>

                        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-[2.35rem] md:leading-tight">
                            Roblox experiences made by Filipino developers
                        </h1>

                        <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400 md:text-base">
                            Each listed experience is reviewed by FRDA before appearing here. If
                            you believe a listed experience may violate Roblox safety standards
                            or FRDA listing guidelines, please contact{" "}
                            <a
                                href="mailto:admin@frdaph.org"
                                className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
                            >
                                admin@frdaph.org
                            </a>
                            .
                        </p>
                    </div>

                    <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="relative">
                            <Search
                                size={18}
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                            />

                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search by game, description, creator, or genre"
                                className="w-full border border-zinc-700 bg-zinc-950 py-4 pl-12 pr-11 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                                style={{ borderRadius: 8 }}
                            />

                            {search ? (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                    aria-label="Clear search"
                                >
                                    <X size={18} />
                                </button>
                            ) : null}
                        </div>

                        <select
                            value={activeMaturity}
                            onChange={(event) => setActiveMaturity(event.target.value)}
                            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-4 text-sm text-white outline-none focus:border-blue-500"
                            style={{ borderRadius: 8 }}
                        >
                            <option value={ALL_MATURITY}>All maturity levels</option>
                            {GAME_CONTENT_MATURITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.publicLabel}
                                </option>
                            ))}
                        </select>
                    </div>

                    {SHOW_HIGHLIGHTED_GAMES && showHighlights ? (
                        <div
                            className="mb-8 overflow-hidden border border-zinc-800 bg-zinc-950/35"
                            style={{ borderRadius: 8 }}
                        >
                            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
                                <div>
                                    <h2 className="text-base font-semibold text-white">
                                        Highlighted Games
                                    </h2>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        Placeholder for future sponsored or featured directory placements.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowHighlights(false)}
                                    className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-white"
                                >
                                    Hide
                                </button>
                            </div>

                            {highlightedGames.length > 0 ? (
                                <div className="grid gap-4 p-5 md:grid-cols-3">
                                    {highlightedGames.slice(0, 3).map((game) => (
                                        <a
                                            key={game.id}
                                            href={game.robloxUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() =>
                                                logAnalyticsEvent({
                                                    eventName: "game_card_click",
                                                    path: "/games",
                                                    metadata: {
                                                        gameId: game.id,
                                                        gameTitle: game.title,
                                                        creator: game.creatorName,
                                                        clickType: "highlighted_card",
                                                    },
                                                })
                                            }
                                            className="group overflow-hidden border border-zinc-800 bg-zinc-950 transition hover:border-blue-400/35"
                                            style={{ borderRadius: 5 }}
                                        >
                                            <div className="aspect-video overflow-hidden">
                                                {game.coverImageUrl || game.thumbnailUrl ? (
                                                    <img
                                                        src={game.coverImageUrl || game.thumbnailUrl}
                                                        alt={game.title}
                                                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                                    />
                                                ) : (
                                                    <EmptyImage label="Featured slot" />
                                                )}
                                            </div>
                                            <div className="p-4">
                                                <p className="truncate text-sm font-semibold text-white">
                                                    {game.title}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-zinc-500">
                                                    {game.creatorName}
                                                </p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-5">
                                    <div
                                        className="flex min-h-[180px] items-center justify-center border border-dashed border-zinc-700 bg-black/20 text-center"
                                        style={{ borderRadius: 5 }}
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-zinc-300">
                                                Sponsored/highlighted area placeholder
                                            </p>
                                            <p className="mt-2 max-w-md text-xs leading-5 text-zinc-500">
                                                Once games are marked as highlighted or sponsored, they can
                                                appear here in a Steam-style showcase.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <div className="mb-4 flex items-center justify-between gap-4">
                        <p className="text-sm text-zinc-400">
                            Showing{" "}
                            <span className="font-semibold text-white">{filteredGames.length}</span>{" "}
                            {filteredGames.length === 1 ? "game" : "games"}
                        </p>

                        {(activeGenre !== ALL_GENRES || activeMaturity !== ALL_MATURITY || search) ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setActiveGenre(ALL_GENRES);
                                    setActiveMaturity(ALL_MATURITY);
                                }}
                                className="text-sm text-zinc-500 underline underline-offset-4 hover:text-white"
                            >
                                Clear filters
                            </button>
                        ) : null}
                    </div>

                    {loading ? (
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {[1, 2, 3].map((item) => (
                                <div
                                    key={item}
                                    className="animate-pulse overflow-hidden border border-zinc-800 bg-zinc-950/35"
                                    style={{ borderRadius: 8 }}
                                >
                                    <div className="aspect-video bg-zinc-900" />
                                    <div className="space-y-3 p-4">
                                        <div className="h-4 w-2/3 bg-zinc-900" />
                                        <div className="h-3 w-1/2 bg-zinc-900" />
                                        <div className="h-3 w-full bg-zinc-900" />
                                        <div className="h-3 w-5/6 bg-zinc-900" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : errorMsg ? (
                        <div
                            className="border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200"
                            style={{ borderRadius: 8 }}
                        >
                            {errorMsg}
                        </div>
                    ) : filteredGames.length === 0 ? (
                        <div
                            className="border border-zinc-800 bg-zinc-950/35 p-8 text-center"
                            style={{ borderRadius: 8 }}
                        >
                            <p className="text-base font-medium text-white">No games found yet.</p>
                            <p className="mt-2 text-sm text-zinc-500">
                                Try clearing your filters or check back once more games are published.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {filteredGames.map((game) => (
                                <GameCard
                                    key={game.id}
                                    game={game}
                                    onOpen={setSelectedGame}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {selectedGame ? (
                <GameDetailsModal
                    game={selectedGame}
                    onClose={() => setSelectedGame(null)}
                />
            ) : null}
        </section>
    );
}