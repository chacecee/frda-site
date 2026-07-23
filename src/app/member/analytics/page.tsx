"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  Bookmark,
  Eye,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  MessagesSquare,
  MousePointerClick,
  Users,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import MemberPortalHeader from "@/components/member/MemberPortalHeader";
import {
  useAuthUser,
} from "@/lib/useAuthUser";

type RangeValue =
  | "today"
  | "7d"
  | "30d"
  | "all";

type AnalyticsTotals = {
  profileViews: number;
  uniqueProfileViews: number;
  bookmarks: number;
  contactClicks: number;
  projectViews: number;
  projectLinkClicks: number;
  portfolioClicks: number;
};

type DailyRow = {
  dayKey: string;
  profileViews: number;
  uniqueProfileViews: number;
  contactClicks: number;
  projectViews: number;
  projectLinkClicks: number;
  portfolioClicks: number;
};

type ProjectRow = {
  projectId: string;
  projectTitle: string;
  detailViews: number;
  linkClicks: number;
  engagement: number;
};

const EMPTY_TOTALS:
  AnalyticsTotals = {
  profileViews: 0,
  uniqueProfileViews: 0,
  bookmarks: 0,
  contactClicks: 0,
  projectViews: 0,
  projectLinkClicks: 0,
  portfolioClicks: 0,
};

function formatDayLabel(
  value: string,
): string {
  const date =
    new Date(
      `${value}T00:00:00+08:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    },
  ).format(date);
}

export default function MemberAnalyticsPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [range, setRange] =
    useState<RangeValue>("30d");

  const [totals, setTotals] =
    useState<AnalyticsTotals>(
      EMPTY_TOTALS,
    );

  const [series, setSeries] =
    useState<DailyRow[]>([]);

  const [projects, setProjects] =
    useState<ProjectRow[]>([]);

  const [analyticsAccess, setAnalyticsAccess] =
    useState("basic");

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  useEffect(() => {
    if (
      !authLoading &&
      !user
    ) {
      router.replace(
        "/member/login",
      );
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setPageError("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response =
          await fetch(
            `/api/member/analytics?range=${range}`,
            {
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },
              cache: "no-store",
            },
          );

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.error ||
            "Could not load your developer analytics.",
          );
        }

        if (!cancelled) {
          setTotals(
            result.totals ||
            EMPTY_TOTALS,
          );

          setSeries(
            result.series || [],
          );

          setProjects(
            result.projects || [],
          );

          setAnalyticsAccess(
            result.analyticsAccess ||
            "basic",
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load your developer analytics.",
          );
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
  }, [
    user,
    range,
  ]);

  const maximumViews =
    useMemo(
      () =>
        Math.max(
          1,
          ...series.map(
            (item) =>
              item.profileViews,
          ),
        ),
      [series],
    );

  const rangeOptions: Array<{
    value: RangeValue;
    label: string;
  }> = [
    {
      value: "today",
      label: "Today",
    },
    {
      value: "7d",
      label: "7 Days",
    },
    {
      value: "30d",
      label: "30 Days",
    },
    {
      value: "all",
      label: "All Time",
    },
  ];

  const metricCards = [
    {
      label: "Profile Views",
      value:
        totals.profileViews,
      icon: Eye,
    },
    {
      label: "Unique Visitors",
      value:
        totals.uniqueProfileViews,
      icon: Users,
    },
    {
      label: "Current Bookmarks",
      value:
        totals.bookmarks,
      icon: Bookmark,
    },
    {
      label: "Contact Attempts",
      value:
        totals.contactClicks,
      icon: MessagesSquare,
    },
    {
      label: "Work Opens",
      value:
        totals.projectViews,
      icon: FolderOpen,
    },
    {
      label: "Project Link Clicks",
      value:
        totals.projectLinkClicks,
      icon: ExternalLink,
    },
  ];

  return (
    <main className="min-h-screen bg-[#071225] text-white">
      <MemberPortalHeader
        active="analytics"
        subtitle="Developer Analytics"
      />

      <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sky-300">
              <BarChart3
                size={18}
              />

              <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                Profile Performance
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-semibold text-white">
              Analytics
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              See how visitors are discovering and engaging with your developer profile and featured work.
            </p>
          </div>

          <div className="inline-flex w-full overflow-x-auto border border-white/10 bg-black/20 p-1 sm:w-auto" style={{ borderRadius: 8 }}>
            {rangeOptions.map(
              (option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setRange(
                      option.value,
                    )
                  }
                  className={`min-w-max cursor-pointer px-4 py-2.5 text-sm font-medium transition ${
                    range ===
                    option.value
                      ? "bg-sky-400/15 text-sky-200"
                      : "text-zinc-500 hover:text-zinc-200"
                  }`}
                  style={{
                    borderRadius: 6,
                  }}
                >
                  {option.label}
                </button>
              ),
            )}
          </div>
        </div>

        {pageError ? (
          <div
            className="mt-7 border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200"
            style={{ borderRadius: 8 }}
          >
            {pageError}
          </div>
        ) : loading ? (
          <div
            className="mt-7 flex items-center gap-3 border border-white/10 bg-white/[0.025] p-6 text-sm text-zinc-400"
            style={{ borderRadius: 8 }}
          >
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading your analytics...
          </div>
        ) : (
          <>
            <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-3">
              {metricCards.map(
                (metric) => {
                  const Icon =
                    metric.icon;

                  return (
                    <div
                      key={metric.label}
                      className="border border-white/10 bg-white/[0.025] p-4 md:p-5"
                      style={{
                        borderRadius: 8,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500 md:text-xs">
                          {metric.label}
                        </p>

                        <Icon
                          size={17}
                          className="shrink-0 text-sky-300/80"
                        />
                      </div>

                      <p className="mt-3 text-3xl font-semibold text-white">
                        {metric.value.toLocaleString()}
                      </p>
                    </div>
                  );
                },
              )}
            </div>

            <section
              className="mt-7 border border-white/10 bg-white/[0.025] p-5 md:p-6"
              style={{ borderRadius: 8 }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Profile Views
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Daily profile activity for the selected period.
                  </p>
                </div>

                {analyticsAccess ===
                "pro" ? (
                  <span
                    className="border border-violet-300/25 bg-violet-400/10 px-2.5 py-1 text-xs font-medium text-violet-200"
                    style={{
                      borderRadius: 999,
                    }}
                  >
                    Pro
                  </span>
                ) : null}
              </div>

              {series.length === 0 ? (
                <div className="mt-6 border border-dashed border-white/10 px-5 py-10 text-center text-sm text-zinc-500" style={{ borderRadius: 7 }}>
                  No profile-view activity has been recorded for this period yet.
                </div>
              ) : (
                <div className="mt-7 overflow-x-auto">
                  <div className="flex min-w-[620px] items-end gap-2">
                    {series.map(
                      (item) => {
                        const height =
                          Math.max(
                            8,
                            (
                              item.profileViews /
                              maximumViews
                            ) *
                              180,
                          );

                        return (
                          <div
                            key={
                              item.dayKey
                            }
                            className="flex min-w-0 flex-1 flex-col items-center"
                            title={`${item.profileViews} views, ${item.uniqueProfileViews} unique visitors`}
                          >
                            <div className="flex h-48 w-full items-end justify-center">
                              <div
                                className="w-full max-w-8 bg-sky-400/65 shadow-[0_0_14px_rgba(56,189,248,0.16)]"
                                style={{
                                  height,
                                  borderRadius:
                                    "5px 5px 2px 2px",
                                }}
                              />
                            </div>

                            <p className="mt-2 text-[10px] text-zinc-600">
                              {formatDayLabel(
                                item.dayKey,
                              )}
                            </p>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </section>

            <section
              className="mt-7 border border-white/10 bg-white/[0.025] p-5 md:p-6"
              style={{ borderRadius: 8 }}
            >
              <div className="flex items-center gap-3">
                <MousePointerClick
                  size={18}
                  className="text-sky-300"
                />

                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Top Featured Work
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Ranked by detail opens and project-link clicks.
                  </p>
                </div>
              </div>

              {projects.length === 0 ? (
                <div className="mt-6 border border-dashed border-white/10 px-5 py-10 text-center text-sm text-zinc-500" style={{ borderRadius: 7 }}>
                  Featured Work engagement will appear here after visitors interact with your projects.
                </div>
              ) : (
                <div className="mt-6 divide-y divide-white/10">
                  {projects.map(
                    (
                      project,
                      index,
                    ) => (
                      <div
                        key={
                          project.projectId
                        }
                        className="grid gap-4 py-4 sm:grid-cols-[40px_minmax(0,1fr)_100px_100px]"
                      >
                        <p className="text-sm font-semibold text-zinc-600">
                          #{index + 1}
                        </p>

                        <p className="min-w-0 truncate font-medium text-white">
                          {
                            project.projectTitle
                          }
                        </p>

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                            Opens
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-200">
                            {project.detailViews.toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                            Link Clicks
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-200">
                            {project.linkClicks.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>

            <p className="mt-5 text-xs leading-5 text-zinc-600">
              Unique visitors are counted once per browser, per developer profile, per Philippine calendar day. Bookmark totals show the number currently saved.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
