"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  signOut,
} from "firebase/auth";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import {
  auth,
} from "@/lib/firebase";

import {
  useAuthUser,
} from "@/lib/useAuthUser";

import {
  setPresenceOffline,
} from "@/lib/usePresence";

import AdminSidebar from "@/components/admin/AdminSidebar";
import {
  notify,
} from "@/components/ToastConfig";

type ReportStatus =
  | "open"
  | "reviewing"
  | "resolved"
  | "dismissed";

type ReportReason =
  | "false_claims"
  | "stolen_work"
  | "impersonation"
  | "inappropriate_content"
  | "spam"
  | "other"
  | "";

type ProfileReport = {
  id: string;
  profileUid: string;
  profileSlug: string;
  memberId: string;
  developerDisplayName: string;
  reason: ReportReason;
  reasonLabel: string;
  details: string;
  reporterEmail: string;
  status: ReportStatus;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  reviewedByUid: string;
  reviewedByEmail: string;
  reviewedByName: string;
  reviewerNote: string;
  resolutionAction: string;
  hideProfile?: boolean;
};

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone:
        "Asia/Manila",
    },
  ).format(date);
}

function getStatusLabel(
  status: ReportStatus,
): string {
  switch (status) {
    case "open":
      return "Open";
    case "reviewing":
      return "Reviewing";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
    default:
      return status;
  }
}

function getStatusClass(
  status: ReportStatus,
): string {
  switch (status) {
    case "open":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "reviewing":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "dismissed":
      return "border-zinc-600 bg-zinc-800 text-zinc-300";
  }
}

export default function ProfileReportsPage() {
  const router =
    useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    reports,
    setReports,
  ] = useState<
    ProfileReport[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    ReportStatus | "all"
  >("all");

  const [
    reasonFilter,
    setReasonFilter,
  ] = useState<
    ReportReason | "all"
  >("all");

  const [
    selectedReport,
    setSelectedReport,
  ] = useState<
    ProfileReport | null
  >(null);

  const [
    reviewerNote,
    setReviewerNote,
  ] = useState("");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState<
    "reviewing" |
    "dismissed" |
    "resolved"
  >("reviewing");

  const [
    hideProfile,
    setHideProfile,
  ] = useState(false);

  const [
    savingReview,
    setSavingReview,
  ] = useState(false);

  const displayName =
    user?.displayName?.trim() ||
    (
      user?.email
        ? user.email.split("@")[0]
        : "Unknown User"
    );

  useEffect(() => {
    if (
      !authLoading &&
      !user
    ) {
      router.replace(
        "/admin/login",
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

    async function loadReports() {
      setLoading(true);
      setPageError("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response =
          await fetch(
            "/api/admin/membership/profile-reports",
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
            "Could not load profile reports.",
          );
        }

        if (!cancelled) {
          setReports(
            result.reports || [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load profile reports.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const counts =
    useMemo(() => ({
      total:
        reports.length,
      open:
        reports.filter(
          (report) =>
            report.status ===
              "open" ||
            report.status ===
              "reviewing",
        ).length,
      resolved:
        reports.filter(
          (report) =>
            report.status ===
            "resolved",
        ).length,
      dismissed:
        reports.filter(
          (report) =>
            report.status ===
            "dismissed",
        ).length,
    }), [reports]);

  const filteredReports =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return reports.filter(
        (report) => {
          const matchesStatus =
            statusFilter ===
              "all" ||
            report.status ===
              statusFilter;

          const matchesReason =
            reasonFilter ===
              "all" ||
            report.reason ===
              reasonFilter;

          if (
            !matchesStatus ||
            !matchesReason
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            report.developerDisplayName,
            report.memberId,
            report.profileSlug,
            report.reporterEmail,
            report.reasonLabel,
            report.details,
          ]
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch,
            );
        },
      );
    }, [
      reports,
      search,
      statusFilter,
      reasonFilter,
    ]);

  function openReport(
    report: ProfileReport,
  ) {
    setSelectedReport(report);
    setReviewerNote(
      report.reviewerNote || "",
    );

    setSelectedStatus(
      report.status === "dismissed"
        ? "dismissed"
        : report.status === "resolved"
          ? "resolved"
          : "reviewing",
    );

    setHideProfile(
      report.status !== "dismissed" &&
      report.hideProfile === true,
    );
  }

  function closeReport() {
    if (savingReview) {
      return;
    }

    setSelectedReport(null);
    setReviewerNote("");
  }

  async function saveReview() {
    if (
      !user ||
      !selectedReport ||
      savingReview
    ) {
      return;
    }

    if (
      hideProfile &&
      !reviewerNote.trim()
    ) {
      notify.error(
        "Add a reviewer note explaining why the profile should be hidden.",
      );
      return;
    }

    setSavingReview(true);

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/membership/profile-reports",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              reportId:
                selectedReport.id,
              status:
                selectedStatus,
              hideProfile:
                selectedStatus ===
                  "dismissed"
                  ? false
                  : hideProfile,
              reviewerNote:
                reviewerNote.trim(),
            }),
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
          "Could not update this report.",
        );
      }

      const updatedReport =
        result.report as
          ProfileReport;

      setReports((current) =>
        current.map((report) =>
          report.id ===
          updatedReport.id
            ? updatedReport
            : report,
        ),
      );

      setSelectedReport(
        updatedReport,
      );

      setReviewerNote(
        updatedReport.reviewerNote ||
        "",
      );

      if (
        updatedReport.status ===
        "dismissed"
      ) {
        setHideProfile(false);
      }

      window.dispatchEvent(
        new Event(
          "frda-admin-profile-reports-changed",
        ),
      );

      notify.success(
        result.message,
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not update this report.",
      );
    } finally {
      setSavingReview(false);
    }
  }

  async function handleSignOut() {
    try {
      await setPresenceOffline(
        user?.email,
      );

      await signOut(auth);

      router.replace(
        "/admin/login",
      );
    } catch (error) {
      console.error(
        "Admin sign-out error:",
        error,
      );
    }
  }

  if (
    authLoading ||
    !user
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <p className="p-8 text-sm text-zinc-400">
          Loading profile reports...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="membership_profile_reports"
          sidebarOpen={
            sidebarOpen
          }
          onCloseSidebar={() =>
            setSidebarOpen(false)
          }
          onNavigate={(path) =>
            router.push(path)
          }
          onSignOut={
            handleSignOut
          }
          displayName={
            displayName
          }
          email={user.email}
        />

        <section className="min-w-0 overflow-x-hidden bg-zinc-900 px-4 py-5 md:px-10 md:py-8 xl:px-14">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="cursor-pointer bg-zinc-800 px-3 py-2 text-sm text-white"
              style={{
                borderRadius: 8,
              }}
            >
              ☰
            </button>

            <p className="text-2xl font-semibold text-white">
              Profile Reports
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3">
              <ShieldAlert
                size={24}
                className="text-amber-300"
              />

              <h1 className="text-2xl font-semibold text-white">
                Profile Reports
              </h1>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Review reports submitted against public developer profiles and take moderation action when needed.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              [
                "Total Reports",
                counts.total,
              ],
              [
                "Needs Attention",
                counts.open,
              ],
              [
                "Resolved",
                counts.resolved,
              ],
              [
                "Dismissed",
                counts.dismissed,
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={
                    String(label)
                  }
                  className="border border-zinc-800 bg-zinc-950/35 p-4"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {label}
                  </p>

                  <p className="mt-3 text-3xl font-semibold text-white">
                    {Number(
                      value,
                    ).toLocaleString()}
                  </p>
                </div>
              ),
            )}
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_210px_210px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search developer, Member ID, reporter email, reason, or details"
                className="w-full border border-zinc-700 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                style={{
                  borderRadius: 8,
                }}
              />
            </div>

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as
                    | ReportStatus
                    | "all",
                )
              }
              className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
              style={{
                borderRadius: 8,
                colorScheme: "dark",
              }}
            >
              <option value="all">
                All statuses
              </option>
              <option value="open">
                Open
              </option>
              <option value="reviewing">
                Reviewing
              </option>
              <option value="resolved">
                Resolved
              </option>
              <option value="dismissed">
                Dismissed
              </option>
            </select>

            <select
              value={
                reasonFilter
              }
              onChange={(event) =>
                setReasonFilter(
                  event.target
                    .value as
                    | ReportReason
                    | "all",
                )
              }
              className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
              style={{
                borderRadius: 8,
                colorScheme: "dark",
              }}
            >
              <option value="all">
                All reasons
              </option>
              <option value="false_claims">
                False claims
              </option>
              <option value="stolen_work">
                Stolen work
              </option>
              <option value="impersonation">
                Impersonation
              </option>
              <option value="inappropriate_content">
                Inappropriate content
              </option>
              <option value="spam">
                Spam
              </option>
              <option value="other">
                Other
              </option>
            </select>
          </div>

          {pageError ? (
            <div
              className="mb-5 border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
              style={{
                borderRadius: 8,
              }}
            >
              {pageError}
            </div>
          ) : null}

          <div
            className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
            style={{
              borderRadius: 8,
            }}
          >
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] border-collapse">
                <thead className="bg-zinc-950/80">
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Developer
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Reporter
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-sm text-zinc-400"
                      >
                        Loading profile reports...
                      </td>
                    </tr>
                  ) : filteredReports.length ===
                    0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-sm text-zinc-400"
                      >
                        No profile reports match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map(
                      (report) => (
                        <tr
                          key={
                            report.id
                          }
                          className="border-b border-zinc-800/80 last:border-b-0"
                        >
                          <td className="px-4 py-4 align-top">
                            <p className="font-medium text-white">
                              {
                                report.developerDisplayName
                              }
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {report.memberId ||
                                "No Member ID"}
                            </p>
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-300">
                            {
                              report.reasonLabel
                            }
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-300">
                            {formatDate(
                              report.createdAt,
                            )}
                          </td>

                          <td className="max-w-[220px] px-4 py-4 align-top text-sm text-zinc-400">
                            <span className="block truncate">
                              {report.reporterEmail ||
                                "Not provided"}
                            </span>
                          </td>

                          <td className="px-4 py-4 align-top">
                            <span
                              className={`inline-flex border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                report.status,
                              )}`}
                              style={{
                                borderRadius: 999,
                              }}
                            >
                              {getStatusLabel(
                                report.status,
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right align-top">
                            <button
                              type="button"
                              onClick={() =>
                                openReport(
                                  report,
                                )
                              }
                              className="cursor-pointer border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                              style={{
                                borderRadius: 7,
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-800 lg:hidden">
              {loading ? (
                <div className="p-5 text-sm text-zinc-400">
                  Loading profile reports...
                </div>
              ) : filteredReports.length ===
                0 ? (
                <div className="p-5 text-sm text-zinc-400">
                  No profile reports match the current filters.
                </div>
              ) : (
                filteredReports.map(
                  (report) => (
                    <button
                      key={
                        report.id
                      }
                      type="button"
                      onClick={() =>
                        openReport(
                          report,
                        )
                      }
                      className="block w-full cursor-pointer p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">
                            {
                              report.developerDisplayName
                            }
                          </p>
                          <p className="mt-1 text-sm text-zinc-400">
                            {
                              report.reasonLabel
                            }
                          </p>
                        </div>

                        <span
                          className={`shrink-0 border px-2.5 py-1 text-xs ${getStatusClass(
                            report.status,
                          )}`}
                          style={{
                            borderRadius: 999,
                          }}
                        >
                          {getStatusLabel(
                            report.status,
                          )}
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-zinc-500">
                        Submitted{" "}
                        {formatDate(
                          report.createdAt,
                        )}
                      </p>
                    </button>
                  ),
                )
              )}
            </div>
          </div>
        </section>
      </div>

      {selectedReport ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/70"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeReport();
            }
          }}
        >
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Profile Report
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  {
                    selectedReport.developerDisplayName
                  }
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  {
                    selectedReport.memberId ||
                    "No Member ID"
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeReport
                }
                disabled={
                  Boolean(
                    savingReview,
                  )
                }
                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex border px-3 py-1.5 text-xs font-medium ${getStatusClass(
                    selectedReport.status,
                  )}`}
                  style={{
                    borderRadius: 999,
                  }}
                >
                  {getStatusLabel(
                    selectedReport.status,
                  )}
                </span>

                <span className="border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300" style={{ borderRadius: 999 }}>
                  {
                    selectedReport.reasonLabel
                  }
                </span>
              </div>

              <div className="space-y-6">
                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Report Details
                  </h3>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {selectedReport.details ||
                      "No additional details were provided."}
                  </p>
                </section>

                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Submission
                  </h3>

                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <p>
                      <span className="text-zinc-500">
                        Submitted —
                      </span>{" "}
                      {formatDate(
                        selectedReport.createdAt,
                      )}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Reporter email —
                      </span>{" "}
                      {selectedReport.reporterEmail ||
                        "Not provided"}
                    </p>

                    {selectedReport.reviewedAt ? (
                      <p>
                        <span className="text-zinc-500">
                          Last reviewed —
                        </span>{" "}
                        {formatDate(
                          selectedReport.reviewedAt,
                        )}
                        {selectedReport.reviewedByName
                          ? ` by ${selectedReport.reviewedByName}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </section>

                {selectedReport.profileSlug ? (
                  <a
                    href={`/developers/${encodeURIComponent(
                      selectedReport.profileSlug,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-200"
                    style={{
                      borderRadius: 7,
                    }}
                  >
                    Open Public Profile
                    <ExternalLink
                      size={15}
                    />
                  </a>
                ) : null}

                <section>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Reviewer Note
                  </label>

                  <textarea
                    value={
                      reviewerNote
                    }
                    onChange={(event) =>
                      setReviewerNote(
                        event.target.value,
                      )
                    }
                    rows={6}
                    maxLength={3000}
                    placeholder="Add internal review notes or explain a moderation action."
                    className="w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                    style={{
                      borderRadius: 8,
                    }}
                  />
                </section>
              </div>
            </div>

            <div className="border-t border-zinc-800 px-5 py-4 sm:px-6">
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Status
                  </label>

                  <select
                    value={
                      selectedStatus
                    }
                    onChange={(event) => {
                      const nextStatus =
                        event.target.value as
                          | "reviewing"
                          | "dismissed"
                          | "resolved";

                      setSelectedStatus(
                        nextStatus,
                      );

                      if (
                        nextStatus ===
                        "dismissed"
                      ) {
                        setHideProfile(false);
                      }
                    }}
                    disabled={
                      savingReview
                    }
                    className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-60"
                    style={{
                      borderRadius: 8,
                      colorScheme: "dark",
                    }}
                  >
                    <option value="reviewing">
                      Under Investigation
                    </option>
                    <option value="dismissed">
                      Report Dismissed
                    </option>
                    <option value="resolved">
                      Resolved
                    </option>
                  </select>
                </div>

                <label
                  className={`flex items-start gap-3 border p-4 ${
                    selectedStatus === "dismissed"
                      ? "cursor-not-allowed border-zinc-800 bg-zinc-950/30 opacity-50"
                      : "cursor-pointer border-red-500/20 bg-red-500/[0.07]"
                  }`}
                  style={{
                    borderRadius: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedStatus ===
                      "dismissed"
                        ? false
                        : hideProfile
                    }
                    onChange={(event) =>
                      setHideProfile(
                        event.target.checked,
                      )
                    }
                    disabled={
                      savingReview ||
                      selectedStatus ===
                        "dismissed"
                    }
                    className="mt-1"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Hide Profile
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-zinc-400">
                      Prevents the developer from publishing this profile until the restriction is removed. Dismissing the report automatically overrides this setting.
                    </span>
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={
                      closeReport
                    }
                    disabled={
                      savingReview
                    }
                    className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    style={{
                      borderRadius: 7,
                    }}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={
                      saveReview
                    }
                    disabled={
                      savingReview
                    }
                    className="cursor-pointer bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    style={{
                      borderRadius: 7,
                    }}
                  >
                    {savingReview
                      ? "Saving Review..."
                      : "Save Review"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}