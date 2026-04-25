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
        featuredGameClicks: number;
        playOnRobloxClicks: number;
        submitGameCtaClicks: number;
        completedSubmissions: number;
        searches: number;
    };
    eventBreakdown: AnalyticsRow[];
    recentEvents: RecentAnalyticsEvent[];
    topPages: AnalyticsRow[];
    topFeaturedGames: AnalyticsRow[];
    dailyPageViews: AnalyticsRow[];
    dailyClicks: AnalyticsRow[];
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

function getEventDetail(event: RecentAnalyticsEvent) {
    const metadata = event.metadata || {};

    if (event.eventName === "featured_game_click") {
        const gameTitle =
            typeof metadata.gameTitle === "string" ? metadata.gameTitle : "Featured game";

        const clickType =
            typeof metadata.clickType === "string" ? metadata.clickType : "click";

        return `${gameTitle} · ${clickType}`;
    }

    if (event.eventName === "game_directory_visit") {
        return "Visited public game directory";
    }

    if (event.eventName === "page_view") {
        return event.pageTitle || event.path;
    }

    if (event.eventName === "search_used") {
        const searchTerm =
            typeof metadata.searchTerm === "string" ? metadata.searchTerm : "";

        return searchTerm ? `Searched for “${searchTerm}”` : "Search used";
    }

    if (event.eventName === "category_click") {
        const category =
            typeof metadata.category === "string" ? metadata.category : "Category";

        return category;
    }

    return event.pageTitle || event.path || "—";
}

function DataTable({
    title,
    rows,
    empty,
}: {
    title: string;
    rows: AnalyticsRow[];
    empty: string;
}) {
    return (
        <div
            className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
            style={{ borderRadius: 8 }}
        >
            <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-base font-semibold text-white">{title}</h2>
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

function RecentEventsTable({
    rows,
}: {
    rows: RecentAnalyticsEvent[];
}) {
    return (
        <div
            className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
            style={{ borderRadius: 8 }}
        >
            <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-base font-semibold text-white">Recent Events</h2>
                <p className="mt-1 text-xs text-zinc-500">
                    Latest tracked activity from the website.
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-zinc-950/60 text-[11px] uppercase tracking-wide text-zinc-500">
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
}: {
    title: string;
    rows: AnalyticsRow[];
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

                                <div className="h-2 overflow-hidden bg-zinc-900" style={{ borderRadius: 999 }}>
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
                            <h1 className="text-2xl font-semibold text-white">Analytics Overview</h1>
                            <p className="mt-2 text-sm leading-6 text-zinc-400">
                                Anonymous website activity from Firestore.
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
                                <StatCard label="Page Views" value={summary.totals.pageViews} />
                                <StatCard label="Unique Visitors" value={summary.totals.uniqueVisitors} />
                                <StatCard label="Sessions" value={summary.totals.sessions} />
                                <StatCard label="Featured Game Clicks" value={summary.totals.featuredGameClicks} />
                                <StatCard label="Play on Roblox Clicks" value={summary.totals.playOnRobloxClicks} />
                                <StatCard label="Submit Game CTA Clicks" value={summary.totals.submitGameCtaClicks} />
                                <StatCard label="Completed Submissions" value={summary.totals.completedSubmissions} />
                                <StatCard label="Searches" value={summary.totals.searches} />
                            </div>

                            <div className="grid gap-6 xl:grid-cols-2">
                                <MiniBarList title="Daily Page Views" rows={summary.dailyPageViews} />
                                <MiniBarList title="Daily Click Activity" rows={summary.dailyClicks} />
                            </div>

                            <RecentEventsTable rows={summary.recentEvents || []} />

                            <div className="grid gap-6 xl:grid-cols-2">
                                <DataTable
                                    title="Top Pages"
                                    rows={summary.topPages}
                                    empty="No page views recorded yet."
                                />

                                <DataTable
                                    title="Top Featured Games"
                                    rows={summary.topFeaturedGames}
                                    empty="No featured game clicks recorded yet."
                                />

                                <DataTable
                                    title="Event Breakdown"
                                    rows={summary.eventBreakdown}
                                    empty="No events recorded yet."
                                />
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>
        </main>
    );
}