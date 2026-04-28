"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";

type AnalyticsRow = {
    label: string;
    count: number;
};

type RecentAnalyticsEvent = {
    id: string;
    eventName: string;
    path: string;
    rawPath?: string;
    pageTitle: string;
    metadata: Record<string, unknown>;
    createdAt: string | null;
};

type AnalyticsSummary = {
    ok: boolean;
    range: {
        days: number;
        since: string;
    };
    totals: {
        events: number;
        pageViews: number;
        uniqueVisitors: number;
        sessions: number;

        directoryVisits?: number;
        gameCardClicks?: number;
        playOnRobloxClicks: number;
        categoryClicks?: number;

        featuredGameImpressions?: number;
        featuredGameClicks: number;
        submitGameCtaClicks: number;
        completedSubmissions: number;
        searches: number;

        developerApplications?: number;
        approvedDevelopers?: number;
        needsMoreInfoApplications?: number;
        declinedApplications?: number;
    };
    eventBreakdown: AnalyticsRow[];
    recentEvents: RecentAnalyticsEvent[];

    topPages: AnalyticsRow[];
    topContentEntries?: AnalyticsRow[];

    directoryFunnel?: AnalyticsRow[];
    topGames?: AnalyticsRow[];
    topGameCardClicks?: AnalyticsRow[];
    topPlayOnRobloxGames?: AnalyticsRow[];
    topSearches?: AnalyticsRow[];
    topCategories?: AnalyticsRow[];

    topFeaturedGameImpressions?: AnalyticsRow[];
    topFeaturedGames: AnalyticsRow[];

    dailyPageViews: AnalyticsRow[];
    dailyClicks: AnalyticsRow[];
    dailyGameActivity?: AnalyticsRow[];

    applicationsByRegion?: AnalyticsRow[];
    applicationsByStatus?: AnalyticsRow[];
    applicationsByDay?: AnalyticsRow[];
};

function StatCard({
    label,
    value,
    note,
}: {
    label: string;
    value: number;
    note?: string;
}) {
    return (
        <div
            className="border border-zinc-800 bg-zinc-950/35 p-5"
            style={{ borderRadius: 8 }}
        >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                {label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
                {value.toLocaleString()}
            </p>
            {note ? <p className="mt-2 text-sm text-zinc-500">{note}</p> : null}
        </div>
    );
}

function formatEventName(value: string) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function formatEventDate(value: string | null) {
    if (!value) return "—";

    return new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(value));
}

function getMetadataString(
    metadata: Record<string, unknown>,
    key: string,
    fallback = ""
) {
    const value = metadata[key];
    return typeof value === "string" ? value : fallback;
}

function getEventDetail(event: RecentAnalyticsEvent) {
    const metadata = event.metadata || {};

    if (event.eventName === "featured_game_click") {
        const gameTitle = getMetadataString(metadata, "gameTitle", "Featured game");
        const clickType = getMetadataString(metadata, "clickType", "click");

        return `${gameTitle} · ${clickType}`;
    }

    if (event.eventName === "game_card_click") {
        const gameTitle = getMetadataString(metadata, "gameTitle", "Game card");
        const clickType = getMetadataString(metadata, "clickType", "card click");

        return `${gameTitle} · ${clickType}`;
    }

    if (event.eventName === "play_on_roblox_click") {
        const gameTitle = getMetadataString(metadata, "gameTitle", "Game");
        return `${gameTitle} · Play on Roblox`;
    }

    if (event.eventName === "game_directory_visit") {
        return "Visited public game directory";
    }

    if (event.eventName === "submit_game_cta_click") {
        return "Clicked submit game CTA";
    }

    if (event.eventName === "game_submission_completed") {
        return "Game submission completed";
    }

    if (event.eventName === "page_view") {
        return event.pageTitle || event.rawPath || event.path;
    }

    if (event.eventName === "search_used") {
        const searchTerm = getMetadataString(metadata, "searchTerm");

        return searchTerm ? `Searched for “${searchTerm}”` : "Search used";
    }

    if (event.eventName === "category_click") {
        const category = getMetadataString(metadata, "category", "Category");

        return category;
    }

    return event.pageTitle || event.rawPath || event.path || "—";
}

function DataTable({
    title,
    rows,
    empty,
    note,
}: {
    title: string;
    rows: AnalyticsRow[];
    empty: string;
    note?: string;
}) {
    return (
        <div
            className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
            style={{ borderRadius: 8 }}
        >
            <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-base font-semibold text-white">{title}</h2>
                {note ? <p className="mt-1 text-xs text-zinc-500">{note}</p> : null}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-zinc-950/60 text-[11px] uppercase tracking-wide text-zinc-500">
                        <tr>
                            <th className="px-5 py-3">Item</th>
                            <th className="px-5 py-3 text-right">Count</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="px-5 py-5 text-zinc-500">
                                    {empty}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.label} className="border-t border-zinc-800/70">
                                    <td className="max-w-[520px] truncate px-5 py-4 text-zinc-200">
                                        {row.label}
                                    </td>
                                    <td className="px-5 py-4 text-right font-medium text-white">
                                        {row.count.toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function RecentEventsTable({ rows }: { rows: RecentAnalyticsEvent[] }) {
    return (
        <div
            className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
            style={{ borderRadius: 8 }}
        >
            <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-base font-semibold text-white">Recent Events</h2>
                <p className="mt-1 text-xs text-zinc-500">
                    Latest tracked activity. Kept scrollable so raw logs do not dominate
                    the dashboard.
                </p>
            </div>

            <div className="max-h-[420px] overflow-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-500">
                        <tr>
                            <th className="px-5 py-3">Event</th>
                            <th className="px-5 py-3">Details</th>
                            <th className="px-5 py-3">Path</th>
                            <th className="px-5 py-3 text-right">Time</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-5 py-5 text-zinc-500">
                                    No recent events recorded yet.
                                </td>
                            </tr>
                        ) : (
                            rows.map((event) => (
                                <tr key={event.id} className="border-t border-zinc-800/70">
                                    <td className="whitespace-nowrap px-5 py-4 font-medium text-white">
                                        {formatEventName(event.eventName)}
                                    </td>
                                    <td className="max-w-[360px] truncate px-5 py-4 text-zinc-300">
                                        {getEventDetail(event)}
                                    </td>
                                    <td className="max-w-[260px] truncate px-5 py-4 text-zinc-500">
                                        {event.path}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-4 text-right text-zinc-400">
                                        {formatEventDate(event.createdAt)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MiniBarList({
    title,
    rows,
    note,
}: {
    title: string;
    rows: AnalyticsRow[];
    note?: string;
}) {
    const max = useMemo(() => {
        return Math.max(...rows.map((row) => row.count), 1);
    }, [rows]);

    return (
        <div
            className="border border-zinc-800 bg-zinc-950/25 p-5"
            style={{ borderRadius: 8 }}
        >
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {note ? <p className="mt-1 text-xs text-zinc-500">{note}</p> : null}

            <div className="mt-5 space-y-3">
                {rows.length === 0 ? (
                    <p className="text-sm text-zinc-500">No activity recorded yet.</p>
                ) : (
                    rows.map((row) => {
                        const width = Math.max((row.count / max) * 100, 4);

                        return (
                            <div key={row.label}>
                                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                    <span className="text-zinc-400">{row.label}</span>
                                    <span className="font-medium text-zinc-200">
                                        {row.count.toLocaleString()}
                                    </span>
                                </div>

                                <div
                                    className="h-2 overflow-hidden bg-zinc-900"
                                    style={{ borderRadius: 999 }}
                                >
                                    <div
                                        className="h-full bg-blue-500/70"
                                        style={{
                                            width: `${width}%`,
                                            borderRadius: 999,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function DirectoryFunnelCard({ rows }: { rows: AnalyticsRow[] }) {
    const visits = rows.find((row) => row.label === "Directory visits")?.count || 0;
    const cardClicks =
        rows.find((row) => row.label === "Game card clicks")?.count || 0;
    const robloxClicks =
        rows.find((row) => row.label === "Play on Roblox clicks")?.count || 0;

    const cardClickRate = visits > 0 ? (cardClicks / visits) * 100 : 0;
    const robloxClickRate = cardClicks > 0 ? (robloxClicks / cardClicks) * 100 : 0;

    return (
        <div
            className="border border-zinc-800 bg-zinc-950/25 p-5"
            style={{ borderRadius: 8 }}
        >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-white">Directory Funnel</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                        Shows how visitors move from browsing the directory to clicking into
                        games.
                    </p>
                </div>

                <div className="text-xs text-zinc-500">
                    Card CTR{" "}
                    <span className="font-semibold text-zinc-200">
                        {cardClickRate.toFixed(1)}%
                    </span>{" "}
                    · Roblox CTR{" "}
                    <span className="font-semibold text-zinc-200">
                        {robloxClickRate.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="border border-zinc-800 bg-zinc-950/45 p-4" style={{ borderRadius: 8 }}>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Directory Visits
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {visits.toLocaleString()}
                    </p>
                </div>

                <div className="border border-zinc-800 bg-zinc-950/45 p-4" style={{ borderRadius: 8 }}>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Game Card Clicks
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {cardClicks.toLocaleString()}
                    </p>
                </div>

                <div className="border border-zinc-800 bg-zinc-950/45 p-4" style={{ borderRadius: 8 }}>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Play on Roblox Clicks
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {robloxClicks.toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function AdminAnalyticsPage() {
    const router = useRouter();
    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const displayName =
        user?.displayName?.trim() ||
        (user?.email ? user.email.split("@")[0] : "Unknown User");

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/admin/login");
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!user) return;

        const currentUser = user;
        let cancelled = false;

        async function loadAnalytics() {
            setLoading(true);
            setErrorMsg("");

            try {
                const idToken = await currentUser.getIdToken();

                const response = await fetch(`/api/admin/analytics/summary?days=${days}`, {
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                    },
                });

                const result = await response.json().catch(() => null);

                if (!response.ok || !result?.ok) {
                    throw new Error(result?.error || "Could not load analytics.");
                }

                if (!cancelled) {
                    setSummary(result as AnalyticsSummary);
                }
            } catch (error) {
                console.error("Analytics load error:", error);

                if (!cancelled) {
                    setErrorMsg("Could not load analytics right now.");
                    setSummary(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadAnalytics();

        return () => {
            cancelled = true;
        };
    }, [user, days]);

    async function handleSignOut() {
        try {
            await setPresenceOffline(user?.email);
            await signOut(auth);
            router.replace("/admin/login");
        } catch (error) {
            console.error("Sign out error:", error);
        }
    }

    if (authLoading || !user) {
        return (
            <main className="min-h-screen bg-zinc-950 text-white">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <p className="text-sm text-zinc-400">Loading analytics...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
            <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[290px_minmax(0,1fr)]">
                <AdminSidebar
                    active="analytics_overview"
                    sidebarOpen={sidebarOpen}
                    onCloseSidebar={() => setSidebarOpen(false)}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    displayName={displayName}
                    email={user.email}
                />

                <section className="min-w-0 w-full max-w-full overflow-x-hidden bg-zinc-900 px-4 py-5 md:px-10 md:py-8 xl:px-14">
                    <div className="mb-5 flex items-center gap-3 lg:hidden">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="cursor-pointer bg-zinc-900 px-3 py-2 text-sm text-white"
                            style={{ borderRadius: 8 }}
                        >
                            ☰
                        </button>
                        <p className="text-2xl font-semibold leading-none text-white">
                            Analytics
                        </p>
                    </div>

                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">
                                Analytics Overview
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-zinc-400">
                                Site, directory, featured placement, and content activity from
                                anonymous website events.
                            </p>
                        </div>

                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none md:w-[180px]"
                            style={{ borderRadius: 8 }}
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={60}>Last 60 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>

                    {errorMsg ? (
                        <div
                            className="mb-6 border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
                            style={{ borderRadius: 8 }}
                        >
                            {errorMsg}
                        </div>
                    ) : null}

                    {loading ? (
                        <div
                            className="border border-zinc-800 bg-zinc-950/35 p-6 text-sm text-zinc-400"
                            style={{ borderRadius: 8 }}
                        >
                            Loading analytics...
                        </div>
                    ) : summary ? (
                        <div className="space-y-6">
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <StatCard
                                    label="Page Views"
                                    value={summary.totals.pageViews}
                                    note="All tracked site views"
                                />
                                <StatCard
                                    label="Unique Visitors"
                                    value={summary.totals.uniqueVisitors}
                                    note="Anonymous visitor IDs"
                                />
                                <StatCard
                                    label="Directory Visits"
                                    value={summary.totals.directoryVisits || 0}
                                    note="Public game directory"
                                />
                                <StatCard
                                    label="Game Card Clicks"
                                    value={summary.totals.gameCardClicks || 0}
                                    note="Directory game interest"
                                />
                                <StatCard
                                    label="Play on Roblox Clicks"
                                    value={summary.totals.playOnRobloxClicks}
                                    note="Outbound Roblox interest"
                                />
                                <StatCard
                                    label="Featured Impressions"
                                    value={summary.totals.featuredGameImpressions || 0}
                                    note="Homepage featured views"
                                />

                                <StatCard
                                    label="Featured Game Clicks"
                                    value={summary.totals.featuredGameClicks}
                                    note="Homepage featured clicks"
                                />

                                <StatCard
                                    label="Featured CTR"
                                    value={
                                        summary.totals.featuredGameImpressions
                                            ? Number(
                                                (
                                                    (summary.totals.featuredGameClicks /
                                                        summary.totals.featuredGameImpressions) *
                                                    100
                                                ).toFixed(1)
                                            )
                                            : 0
                                    }
                                    note="Clicks per featured impression"
                                />

                                <StatCard
                                    label="Searches"
                                    value={summary.totals.searches}
                                    note="Directory search usage"
                                />
                                <StatCard
                                    label="Completed Submissions"
                                    value={summary.totals.completedSubmissions}
                                    note="Game submission completions"
                                />

                                <StatCard
                                    label="Developer Applications"
                                    value={summary.totals.developerApplications || 0}
                                    note="Registration form submissions"
                                />

                                <StatCard
                                    label="Approved Developers"
                                    value={summary.totals.approvedDevelopers || 0}
                                    note="Accepted registrations"
                                />
                            </div>

                            <div className="grid gap-6 xl:grid-cols-3">
                                <div className="xl:col-span-2">
                                    <DirectoryFunnelCard rows={summary.directoryFunnel || []} />
                                </div>

                                <MiniBarList
                                    title="Daily Game Activity"
                                    rows={summary.dailyGameActivity || []}
                                    note="Directory visits, searches, category clicks, and game clicks"
                                />
                            </div>

                            <div className="grid gap-6 xl:grid-cols-2">
                                <MiniBarList
                                    title="Daily Page Views"
                                    rows={summary.dailyPageViews}
                                    note="All tracked site pages"
                                />
                                <MiniBarList
                                    title="Daily Click Activity"
                                    rows={summary.dailyClicks}
                                    note="Featured, directory, Roblox, and CTA clicks"
                                />
                            </div>

                            <div className="grid gap-6 xl:grid-cols-2">
                                <DataTable
                                    title="Top Pages"
                                    rows={summary.topPages}
                                    empty="No page views recorded yet."
                                    note="Noisy dynamic URLs are grouped for cleaner reporting."
                                />

                                <DataTable
                                    title="Top Content Entries"
                                    rows={summary.topContentEntries || []}
                                    empty="No content entry views recorded yet."
                                    note="Individual blog or content entries getting attention."
                                />

                                <DataTable
                                    title="Top Games"
                                    rows={summary.topGames || []}
                                    empty="No game interactions recorded yet."
                                    note="Combines game card and Play on Roblox clicks."
                                />

                                <DataTable
                                    title="Top Featured Game Impressions"
                                    rows={summary.topFeaturedGameImpressions || []}
                                    empty="No featured game impressions recorded yet."
                                    note="Homepage featured games shown to visitors."
                                />

                                <DataTable
                                    title="Top Featured Game Clicks"
                                    rows={summary.topFeaturedGames}
                                    empty="No featured game clicks recorded yet."
                                    note="Homepage featured section click activity."
                                />

                                <DataTable
                                    title="Top Searches"
                                    rows={summary.topSearches || []}
                                    empty="No searches recorded yet."
                                    note="What visitors are trying to find in the directory."
                                />

                                <DataTable
                                    title="Top Categories"
                                    rows={summary.topCategories || []}
                                    empty="No category clicks recorded yet."
                                    note="Directory categories visitors are exploring."
                                />
                            </div>

                            <div className="grid gap-6 xl:grid-cols-3">
                                <div className="xl:col-span-2">
                                    <MiniBarList
                                        title="Developer Applications by Day"
                                        rows={summary.applicationsByDay || []}
                                        note="Registration submissions over the selected date range"
                                    />
                                </div>

                                <DataTable
                                    title="Applications by Status"
                                    rows={summary.applicationsByStatus || []}
                                    empty="No developer applications recorded yet."
                                    note="Current review status of submitted applications."
                                />
                            </div>

                            <div className="grid gap-6 xl:grid-cols-2">
                                <DataTable
                                    title="Applications by Region"
                                    rows={summary.applicationsByRegion || []}
                                    empty="No regional application data recorded yet."
                                    note="Where registered developer applicants are coming from."
                                />

                                <DataTable
                                    title="Application Review Signals"
                                    rows={[
                                        {
                                            label: "Approved Developers",
                                            count: summary.totals.approvedDevelopers || 0,
                                        },
                                        {
                                            label: "Needs More Info",
                                            count: summary.totals.needsMoreInfoApplications || 0,
                                        },
                                        {
                                            label: "Declined Applications",
                                            count: summary.totals.declinedApplications || 0,
                                        },
                                    ]}
                                    empty="No application review signals yet."
                                    note="Useful for understanding registration quality and review workload."
                                />
                            </div>

                            <RecentEventsTable rows={summary.recentEvents || []} />

                            <div className="grid gap-6 xl:grid-cols-2">
                                <DataTable
                                    title="Event Breakdown"
                                    rows={summary.eventBreakdown}
                                    empty="No events recorded yet."
                                    note="Raw event mix for debugging and internal review."
                                />

                                <DataTable
                                    title="Top Play on Roblox Clicks"
                                    rows={summary.topPlayOnRobloxGames || []}
                                    empty="No Play on Roblox clicks recorded yet."
                                    note="Games that drove the most outbound Roblox interest."
                                />
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>
        </main>
    );
}