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
    developerApplications?: number;
    applicationSent?: number;
    manualReviewApplications?: number;
    approvedDevelopers?: number;
    needsMoreInfoApplications?: number;
    pendingApplications?: number;
    declinedApplications?: number;
    expiredApplications?: number;
  };
  applicationsByRegion?: AnalyticsRow[];
  approvedDevelopersByRegion?: AnalyticsRow[];
  applicationsByStatus?: AnalyticsRow[];
  applicationsByDay?: AnalyticsRow[];
  approvedDevelopersByDay?: AnalyticsRow[];
};

function getRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
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
      className="border border-zinc-800 bg-zinc-950/35 p-5"
      style={{ borderRadius: 8 }}
    >
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {note ? <p className="mt-2 text-sm leading-6 text-zinc-500">{note}</p> : null}
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

export default function DeveloperAnalyticsPage() {
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
          throw new Error(result?.error || "Could not load developer analytics.");
        }

        if (!cancelled) {
          setSummary(result as AnalyticsSummary);
        }
      } catch (error) {
        console.error("Developer analytics load error:", error);

        if (!cancelled) {
          setErrorMsg("Could not load developer analytics right now.");
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

  const totalApplications = summary?.totals.developerApplications || 0;
  const approvedDevelopers = summary?.totals.approvedDevelopers || 0;
  const manualReview = summary?.totals.manualReviewApplications || 0;
  const needsMoreInfo = summary?.totals.needsMoreInfoApplications || 0;
  const pending = summary?.totals.pendingApplications || 0;
  const declined = summary?.totals.declinedApplications || 0;
  const expired = summary?.totals.expiredApplications || 0;
  const applicationSent = summary?.totals.applicationSent || 0;

  const approvalRate = formatPercent(
    getRate(approvedDevelopers, totalApplications)
  );

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">Loading developer analytics...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="analytics_developers"
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
              Developer Analytics
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Developer Analytics
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Internal view of developer registrations, approvals, review
                pipeline health, and regional reach.
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
              Loading developer analytics...
            </div>
          ) : summary ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total Applications"
                  value={totalApplications}
                  note="Applications submitted in this period"
                />
                <StatCard
                  label="Approved Developers"
                  value={approvedDevelopers}
                  note="Accepted registered developers"
                />
                <StatCard
                  label="Approval Rate"
                  value={approvalRate}
                  note="Approved divided by submitted"
                />
                <StatCard
                  label="Application Sent"
                  value={applicationSent}
                  note="Submitted but not yet in manual review"
                />
                <StatCard
                  label="Manual Review"
                  value={manualReview}
                  note="Currently under reviewer evaluation"
                />
                <StatCard
                  label="Needs More Info"
                  value={needsMoreInfo}
                  note="Waiting for applicant correction"
                />
                <StatCard
                  label="Pending"
                  value={pending}
                  note="Marked pending by reviewers"
                />
                <StatCard
                  label="Declined / Expired"
                  value={`${declined} / ${expired}`}
                  note="Rejected or expired applications"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <MiniBarList
                  title="Applications by Day"
                  rows={summary.applicationsByDay || []}
                  note="Registration submissions over the selected period."
                />

                <MiniBarList
                  title="Approved Developers by Day"
                  rows={summary.approvedDevelopersByDay || []}
                  note="Accepted developers over the selected period."
                />

                <DataTable
                  title="Applications by Region"
                  rows={summary.applicationsByRegion || []}
                  empty="No application region data recorded yet."
                  note="Where applicants are coming from."
                />

                <DataTable
                  title="Approved Developers by Region"
                  rows={summary.approvedDevelopersByRegion || []}
                  empty="No approved developer region data recorded yet."
                  note="Where approved registered developers are coming from."
                />

                <DataTable
                  title="Applications by Status"
                  rows={summary.applicationsByStatus || []}
                  empty="No application status data recorded yet."
                  note="Current review pipeline distribution."
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}