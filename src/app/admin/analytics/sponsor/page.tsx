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
    pageViews: number;
    uniqueVisitors: number;
    directoryVisits?: number;
    gameCardClicks?: number;
    playOnRobloxClicks?: number;
    searches: number;
    categoryClicks?: number;
    featuredGameImpressions?: number;
    featuredGameClicks?: number;
  };
  topPages: AnalyticsRow[];
  topContentEntries?: AnalyticsRow[];
  directoryFunnel?: AnalyticsRow[];
  topGames?: AnalyticsRow[];
  topSearches?: AnalyticsRow[];
  topCategories?: AnalyticsRow[];
  topFeaturedGameImpressions?: AnalyticsRow[];
  topFeaturedGames?: AnalyticsRow[];
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div
      className="sponsor-print-card border border-zinc-800 bg-zinc-950/35 p-5"
      style={{ borderRadius: 8 }}
    >
      <p className="sponsor-print-eyebrow text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="sponsor-print-heading mt-3 text-3xl font-semibold text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {note ? (
        <p className="sponsor-print-muted mt-2 text-sm leading-6 text-zinc-500">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function NarrativeCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="sponsor-print-blue-card border border-blue-500/20 bg-blue-500/[0.06] p-5"
      style={{ borderRadius: 10 }}
    >
      <p className="sponsor-print-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300/80">
        {eyebrow}
      </p>
      <h2 className="sponsor-print-heading mt-3 text-xl font-semibold leading-tight text-white">
        {title}
      </h2>
      <p className="sponsor-print-muted mt-3 text-sm leading-7 text-zinc-300">
        {body}
      </p>
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
      className="sponsor-print-table overflow-hidden border border-zinc-800 bg-zinc-950/25"
      style={{ borderRadius: 8 }}
    >
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 className="sponsor-print-heading text-base font-semibold text-white">
          {title}
        </h2>
        {note ? (
          <p className="sponsor-print-muted mt-1 text-xs text-zinc-500">
            {note}
          </p>
        ) : null}
      </div>

      <div className="max-h-[360px] overflow-auto sponsor-print-table-scroll">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-500">
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
                  <td className="max-w-[520px] truncate px-5 py-4 text-zinc-200 sponsor-print-table-text">
                    {row.label}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-white sponsor-print-table-number">
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

function HighlightStrip({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div
      className="sponsor-print-card border border-zinc-800 bg-zinc-950/35 p-5"
      style={{ borderRadius: 8 }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="sponsor-print-eyebrow text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </p>
          <p className="sponsor-print-muted mt-2 text-sm leading-6 text-zinc-400">
            {description}
          </p>
        </div>
        <p className="sponsor-print-heading text-3xl font-semibold text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function SponsorReportPage() {
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
        console.error("Sponsor report load error:", error);

        if (!cancelled) {
          setErrorMsg("Could not load sponsor report right now.");
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

  const reach = summary?.totals.pageViews || 0;
  const visitors = summary?.totals.uniqueVisitors || 0;
  const directoryVisits = summary?.totals.directoryVisits || 0;
  const gameCardClicks = summary?.totals.gameCardClicks || 0;
  const robloxClicks = summary?.totals.playOnRobloxClicks || 0;
  const featuredImpressions = summary?.totals.featuredGameImpressions || 0;
  const featuredClicks = summary?.totals.featuredGameClicks || 0;
  const searches = summary?.totals.searches || 0;
  const categoryClicks = summary?.totals.categoryClicks || 0;

  const directoryCardCtr = getRate(gameCardClicks, directoryVisits);
  const directoryRobloxCtr = getRate(robloxClicks, gameCardClicks);
  const featuredCtr = getRate(featuredClicks, featuredImpressions);

  const strongestCategory = useMemo(() => {
    return summary?.topCategories?.[0]?.label || "Not enough category data yet";
  }, [summary?.topCategories]);

  const strongestGame = useMemo(() => {
    return summary?.topGames?.[0]?.label || "Not enough game click data yet";
  }, [summary?.topGames]);

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">Loading sponsor report...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          aside,
          nav,
          .sponsor-no-print {
            display: none !important;
          }

          .sponsor-print-layout {
            display: block !important;
          }

          .sponsor-print-page,
          .sponsor-print-content {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          .sponsor-print-page *,
          .sponsor-print-page h1,
          .sponsor-print-page h2,
          .sponsor-print-page h3,
          .sponsor-print-page p,
          .sponsor-print-page span,
          .sponsor-print-page div,
          .sponsor-print-page td,
          .sponsor-print-page th,
          .sponsor-print-page strong {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            text-shadow: none !important;
          }

          .sponsor-print-eyebrow {
            color: #003a8c !important;
            -webkit-text-fill-color: #003a8c !important;
          }

          .sponsor-print-heading {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
          }

          .sponsor-print-muted {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
          }

          .sponsor-print-card,
          .sponsor-print-table {
            background: #ffffff !important;
            border: 1px solid #b6c2d1 !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .sponsor-print-hero {
            background: #eaf3ff !important;
            border: 1px solid #8bbcff !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .sponsor-print-blue-card {
            background: #eef6ff !important;
            border: 1px solid #a9cffc !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .sponsor-print-table-scroll {
            max-height: none !important;
            overflow: visible !important;
          }

          .sponsor-print-page table {
            width: 100% !important;
            border-collapse: collapse !important;
            color: #000000 !important;
          }

          .sponsor-print-page thead {
            background: #dbeafe !important;
            color: #000000 !important;
            position: static !important;
          }

          .sponsor-print-page tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .sponsor-print-page td,
          .sponsor-print-page th {
            border-color: #b6c2d1 !important;
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
          }

          .sponsor-print-page .truncate {
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
          }

          .sponsor-print-page .bg-zinc-950,
          .sponsor-print-page .bg-zinc-950\\/25,
          .sponsor-print-page .bg-zinc-950\\/35,
          .sponsor-print-page .bg-zinc-900,
          .sponsor-print-page .bg-blue-500\\/\\[0\\.06\\] {
            background: #ffffff !important;
          }

          .sponsor-print-page .border-zinc-800 {
            border-color: #b6c2d1 !important;
          }

          .sponsor-print-page .text-white,
          .sponsor-print-page .text-zinc-200,
          .sponsor-print-page .text-zinc-300,
          .sponsor-print-page .text-zinc-400,
          .sponsor-print-page .text-zinc-500,
          .sponsor-print-page .text-blue-300 {
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
          }

          .sponsor-print-page .print-title-blue {
            color: #003a8c !important;
            -webkit-text-fill-color: #003a8c !important;
          }
        }
      `}</style>

      <main className="sponsor-print-page min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
        <div className="sponsor-print-layout grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[290px_minmax(0,1fr)]">
          <AdminSidebar
            active="analytics_sponsor"
            sidebarOpen={sidebarOpen}
            onCloseSidebar={() => setSidebarOpen(false)}
            onNavigate={(path) => router.push(path)}
            onSignOut={handleSignOut}
            displayName={displayName}
            email={user.email}
          />

          <section className="sponsor-print-content min-w-0 w-full max-w-full overflow-x-hidden bg-zinc-900 px-4 py-5 md:px-10 md:py-8 xl:px-14">
            <div className="sponsor-no-print mb-5 flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="cursor-pointer bg-zinc-900 px-3 py-2 text-sm text-white"
                style={{ borderRadius: 8 }}
              >
                ☰
              </button>
              <p className="text-2xl font-semibold leading-none text-white">
                Sponsor Report
              </p>
            </div>

            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="print-title-blue text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                  Sponsor-ready analytics
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-white">
                  FRDA Sponsorship Readout
                </h1>
                <p className="sponsor-print-muted mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                  A polished summary of reach, game discovery activity, featured
                  placement visibility, and player interest signals across FRDA’s
                  public website.
                </p>
              </div>

              <div className="sponsor-no-print flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/15 hover:text-white"
                  style={{ borderRadius: 8 }}
                >
                  <span aria-hidden="true">🖨️</span>
                  <span>Print / Export PDF</span>
                </button>

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
                className="sponsor-print-card border border-zinc-800 bg-zinc-950/35 p-6 text-sm text-zinc-400"
                style={{ borderRadius: 8 }}
              >
                Loading sponsor report...
              </div>
            ) : summary ? (
              <div className="space-y-6">
                <div
                  className="sponsor-print-hero border border-blue-500/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6"
                  style={{ borderRadius: 12 }}
                >
                  <p className="sponsor-print-eyebrow text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                    Reporting window
                  </p>
                  <h2 className="sponsor-print-heading mt-3 text-2xl font-semibold text-white">
                    In the last {days} days, FRDA recorded{" "}
                    {formatNumber(reach)} site views,{" "}
                    {formatNumber(directoryVisits)} Game Directory visits, and{" "}
                    {formatNumber(featuredImpressions)} featured game impressions.
                  </h2>
                  <p className="sponsor-print-muted mt-4 max-w-4xl text-sm leading-7 text-zinc-300">
                    This report focuses on sponsor-relevant signals: reach,
                    discovery behavior, game interest, featured placement
                    visibility, and what visitors appear to be looking for.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Site Views"
                    value={reach}
                    note="Tracked public website views"
                  />
                  <StatCard
                    label="Unique Visitors"
                    value={visitors}
                    note="Anonymous visitor IDs"
                  />
                  <StatCard
                    label="Directory Visits"
                    value={directoryVisits}
                    note="Game discovery traffic"
                  />
                  <StatCard
                    label="Game Interactions"
                    value={gameCardClicks}
                    note="Game card clicks in the directory"
                  />
                  <StatCard
                    label="Featured Impressions"
                    value={featuredImpressions}
                    note="Homepage featured games shown"
                  />
                  <StatCard
                    label="Featured Clicks"
                    value={featuredClicks}
                    note="Featured title and play button clicks"
                  />
                  <StatCard
                    label="Featured CTR"
                    value={formatPercent(featuredCtr)}
                    note="Featured clicks divided by impressions"
                  />
                  <StatCard
                    label="Searches"
                    value={searches}
                    note="Directory search behavior"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <NarrativeCard
                    eyebrow="Audience reach"
                    title={`${formatNumber(reach)} tracked page views`}
                    body={`FRDA’s public pages give sponsors a place to show up around Filipino Roblox developer activity, community updates, and game discovery. ${formatNumber(
                      visitors
                    )} anonymous visitors were tracked in this period.`}
                  />

                  <NarrativeCard
                    eyebrow="Game discovery"
                    title={`${formatPercent(directoryCardCtr)} directory card CTR`}
                    body={`Visitors are not only landing on the directory. They are clicking into games. The directory recorded ${formatNumber(
                      directoryVisits
                    )} visits and ${formatNumber(
                      gameCardClicks
                    )} game card clicks in this period.`}
                  />

                  <NarrativeCard
                    eyebrow="Featured placement"
                    title={`${formatNumber(featuredImpressions)} featured impressions`}
                    body={`Homepage featured games were shown ${formatNumber(
                      featuredImpressions
                    )} times. Featured placements are the cleanest sponsor inventory for homepage visibility and game launch promotions.`}
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <HighlightStrip
                    label="Strongest game signal"
                    value={strongestGame}
                    description="The game with the strongest combined game card and Roblox click activity."
                  />
                  <HighlightStrip
                    label="Strongest category signal"
                    value={strongestCategory}
                    description={`Category clicks show browsing intent. The directory recorded ${formatNumber(
                      categoryClicks
                    )} category clicks in this period.`}
                  />
                  <HighlightStrip
                    label="Directory funnel"
                    value={`${formatPercent(directoryCardCtr)} card CTR`}
                    description={`From ${formatNumber(
                      directoryVisits
                    )} directory visits to ${formatNumber(
                      gameCardClicks
                    )} game card clicks.`}
                  />
                  <HighlightStrip
                    label="Roblox outbound intent"
                    value={`${formatPercent(directoryRobloxCtr)} Roblox CTR`}
                    description={`From ${formatNumber(
                      gameCardClicks
                    )} game card clicks to ${formatNumber(
                      robloxClicks
                    )} Play on Roblox clicks.`}
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <DataTable
                    title="Top Games"
                    rows={summary.topGames || []}
                    empty="No game interaction data recorded yet."
                    note="Games with the strongest combined directory activity."
                  />

                  <DataTable
                    title="Top Featured Games"
                    rows={summary.topFeaturedGameImpressions || []}
                    empty="No featured game impressions recorded yet."
                    note="Homepage featured games shown most often."
                  />

                  <DataTable
                    title="Top Searches"
                    rows={summary.topSearches || []}
                    empty="No search data recorded yet."
                    note="What visitors are actively looking for."
                  />

                  <DataTable
                    title="Top Categories"
                    rows={summary.topCategories || []}
                    empty="No category data recorded yet."
                    note="Which game categories visitors are exploring."
                  />

                  <DataTable
                    title="Top Content Entries"
                    rows={summary.topContentEntries || []}
                    empty="No content entry views recorded yet."
                    note="Articles or entries attracting attention."
                  />

                  <DataTable
                    title="Top Pages"
                    rows={summary.topPages || []}
                    empty="No page views recorded yet."
                    note="Most visited public page paths."
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}