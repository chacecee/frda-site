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

type AnalyticsSummary = {
  ok: boolean;
  totals: {
    directoryVisits?: number;
    gameCardClicks?: number;
    playOnRobloxClicks?: number;
    categoryClicks?: number;
    submitGameCtaClicks?: number;
    completedSubmissions?: number;
    searches?: number;
  };
  directoryFunnel?: AnalyticsRow[];
  topGames?: AnalyticsRow[];
  topGameCardClicks?: AnalyticsRow[];
  topPlayOnRobloxGames?: AnalyticsRow[];
  topSearches?: AnalyticsRow[];
  topCategories?: AnalyticsRow[];
  dailyGameActivity?: AnalyticsRow[];
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

      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-500">
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
            Tracks how visitors move from browsing to clicking game cards and
            leaving for Roblox.
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

export default function GameDirectoryAnalyticsPage() {
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
        console.error("Game analytics load error:", error);

        if (!cancelled) {
          setErrorMsg("Could not load game directory analytics right now.");
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
          <p className="text-sm text-zinc-400">Loading game directory analytics...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="analytics_games"
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
              Game Directory Analytics
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Game Directory Analytics
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Directory visits, search behavior, game clicks, category interest,
                and outbound Roblox activity.
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
              Loading game directory analytics...
            </div>
          ) : summary ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Directory Visits"
                  value={summary.totals.directoryVisits || 0}
                  note="Public directory traffic"
                />
                <StatCard
                  label="Game Card Clicks"
                  value={summary.totals.gameCardClicks || 0}
                  note="Game detail interest"
                />
                <StatCard
                  label="Play on Roblox Clicks"
                  value={summary.totals.playOnRobloxClicks || 0}
                  note="Outbound Roblox interest"
                />
                <StatCard
                  label="Searches"
                  value={summary.totals.searches || 0}
                  note="Directory search usage"
                />
                <StatCard
                  label="Category Clicks"
                  value={summary.totals.categoryClicks || 0}
                  note="Browsing by category"
                />
                <StatCard
                  label="Submit Game CTA"
                  value={summary.totals.submitGameCtaClicks || 0}
                  note="Submission intent"
                />
                <StatCard
                  label="Completed Submissions"
                  value={summary.totals.completedSubmissions || 0}
                  note="Submitted game listings"
                />
              </div>

              <DirectoryFunnelCard rows={summary.directoryFunnel || []} />

              <div className="grid gap-6 xl:grid-cols-2">
                <MiniBarList
                  title="Daily Game Activity"
                  rows={summary.dailyGameActivity || []}
                  note="Directory visits, searches, category clicks, and game clicks"
                />

                <DataTable
                  title="Top Games"
                  rows={summary.topGames || []}
                  empty="No game interactions recorded yet."
                  note="Combines game card and Play on Roblox clicks."
                />

                <DataTable
                  title="Top Play on Roblox Clicks"
                  rows={summary.topPlayOnRobloxGames || []}
                  empty="No outbound Roblox clicks recorded yet."
                  note="Games that drove visitors to Roblox."
                />

                <DataTable
                  title="Top Game Card Clicks"
                  rows={summary.topGameCardClicks || []}
                  empty="No game card clicks recorded yet."
                  note="Games that attracted the most directory interest."
                />

                <DataTable
                  title="Top Searches"
                  rows={summary.topSearches || []}
                  empty="No searches recorded yet."
                  note="What visitors are trying to find."
                />

                <DataTable
                  title="Top Categories"
                  rows={summary.topCategories || []}
                  empty="No category clicks recorded yet."
                  note="Game categories visitors are exploring."
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}