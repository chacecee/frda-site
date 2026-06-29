"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";

type ReviewStatus =
  | "new"
  | "valid"
  | "needs_review"
  | "excluded";

type TallyRow = {
  value: string;
  count: number;
};

type SurveyResponse = {
  id: string;

  name: string;
  robloxAlias: string;
  contactInfo: string;
  contactPermission: boolean;
  creditPreference: string;

  robloxExperience: string[];
  robloxExperienceOther: string;

  childSafetyRisks: string[];
  childSafetyRisksOther: string;
  riskPatternNotes: string;

  creatorActions: string[];
  creatorActionsOther: string;

  robloxResponsibilities: string[];
  robloxResponsibilitiesOther: string;

  hasSafetyLoophole: string;
  safetyLoopholeDetails: string;
  safetyImprovementIdea: string;

  practicalSolution: string;
  additionalInsight: string;

  publicationConsent: boolean;

  reviewStatus: ReviewStatus;
  reviewNote: string;

  reviewedByEmail: string;
  reviewedByName: string;
  reviewedAt: string | null;

  suspicious: boolean;
  suspiciousReasons: string[];
  submissionCountFromIp24Hours: number;
  formCompletionTimeMs: number;

  createdAt: string | null;
  updatedAt: string | null;

  displayIdentity: string;
};

type SurveySummary = {
  statusCounts: {
    total: number;
    new: number;
    valid: number;
    needsReview: number;
    excluded: number;
    suspicious: number;
  };

  tallies: {
    robloxExperience: TallyRow[];
    childSafetyRisks: TallyRow[];
    creatorActions: TallyRow[];
    robloxResponsibilities: TallyRow[];
    safetyLoopholeAnswers: TallyRow[];
  };
};

type ApiResponse = {
  ok: boolean;
  responses: SurveyResponse[];
  summary: SurveySummary;
  error?: string;
};

type MainTab = "responses" | "findings";

const EXPERIENCE_LABELS: Record<string, string> = {
  published_experience:
    "Published or helped create a public Roblox experience",
  programming: "Scripts or programs",
  creative_assets:
    "Creates maps, models, UI, art, animation, or audio",
  game_design: "Designs gameplay or game systems",
  moderation:
    "Moderates or manages an experience or community",
  learning: "Currently learning Roblox development",
  player: "Mainly plays Roblox",
};

const RISK_LABELS: Record<string, string> = {
  adults_pretending_to_be_children:
    "Adults or older users pretending to be children",
  grooming: "Grooming or attempts to gain a child’s trust",
  off_platform_contact:
    "Attempts to move children to another platform",
  bullying: "Bullying or harassment",
  sexual_content: "Sexual or inappropriate content",
  violent_content: "Violent or disturbing content",
  scams: "Scams, account theft, or Robux manipulation",
  personal_information:
    "Children sharing personal information",
  bypassed_protections:
    "Age or account protections being bypassed",
  parent_awareness:
    "Parents not knowing how to use safety tools",
  slow_serious_reports:
    "Serious reports not being handled quickly enough",
  real_world_threats:
    "Threats involving possible real-world harm",
  unsure: "Not sure",
};

const CREATOR_ACTION_LABELS: Record<string, string> = {
  accurate_labels:
    "Label content and intended age groups honestly",
  community_moderation:
    "Moderate behavior within their own experiences or communities",
  safe_social_design:
    "Design social features with younger users in mind",
  protect_personal_information:
    "Avoid features encouraging personal-information sharing",
  clear_reporting: "Make reporting instructions easy to find",
  report_serious_concerns:
    "Report suspected grooming or credible threats",
  preserve_evidence:
    "Preserve usernames, screenshots, links, and timestamps",
  parent_information:
    "Give parents clearer information about their experiences",
  player_education:
    "Educate players about suspicious or unsafe contact",
  none: "None of these",
  unsure: "Not sure",
};

const ROBLOX_RESPONSIBILITY_LABELS: Record<string, string> = {
  age_identity_checks: "Age and identity checks",
  platform_chat_controls:
    "Platform-wide chat and communication controls",
  detect_adults_pretending:
    "Detecting adults who pretend to be children",
  account_sharing:
    "Detecting account sharing, selling, or borrowing",
  repeat_offenders:
    "Tracking repeat offenders across accounts or experiences",
  platform_suspensions:
    "Suspending or restricting accounts across Roblox",
  experience_review:
    "Reviewing and classifying public experiences",
  evidence_preservation:
    "Preserving platform records for investigations",
  law_enforcement:
    "Responding to valid law-enforcement requests",
  serious_report_response:
    "Acting more quickly on serious reports",
  unsure: "Not sure",
};

const LOOPHOLE_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(milliseconds: number) {
  if (!milliseconds || milliseconds <= 0) return "—";

  const seconds = Math.round(milliseconds / 1000);

  if (seconds < 60) return `${seconds} sec`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (!remainingSeconds) return `${minutes} min`;

  return `${minutes} min ${remainingSeconds} sec`;
}

function getStatusLabel(status: ReviewStatus) {
  switch (status) {
    case "new":
      return "New";
    case "valid":
      return "Valid";
    case "needs_review":
      return "Needs Review";
    case "excluded":
      return "Excluded";
    default:
      return status;
  }
}

function getStatusClass(status: ReviewStatus) {
  switch (status) {
    case "valid":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "needs_review":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "excluded":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "new":
    default:
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }
}

function mapValues(
  values: string[],
  labels: Record<string, string>
) {
  return values.map((value) => labels[value] || value);
}

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
      className="min-w-0 border border-zinc-800 bg-zinc-950/35 px-4 py-3.5 sm:p-5"
      style={{ borderRadius: 8 }}
    >
      <div className="flex items-center justify-between gap-3 sm:block">
        <p className="min-w-0 text-[10px] font-medium uppercase leading-4 tracking-[0.13em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]">
          {label}
        </p>

        <p className="shrink-0 text-2xl font-semibold leading-none text-white sm:mt-3 sm:text-3xl">
          {value.toLocaleString()}
        </p>
      </div>

      {note ? (
        <p className="mt-2 text-[11px] leading-4 text-zinc-500 sm:text-sm sm:leading-6">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function TallyList({
  title,
  rows,
  labels,
  emptyText,
  note,
}: {
  title: string;
  rows: TallyRow[];
  labels: Record<string, string>;
  emptyText: string;
  note?: string;
}) {
  const maximum = Math.max(...rows.map((row) => row.count), 1);

  return (
    <div
      className="border border-zinc-800 bg-zinc-950/25 p-5"
      style={{ borderRadius: 8 }}
    >
      <h2 className="text-base font-semibold text-white">
        {title}
      </h2>

      {note ? (
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          {note}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">{emptyText}</p>
        ) : (
          rows.map((row) => {
            const width = Math.max(
              (row.count / maximum) * 100,
              4
            );

            return (
              <div key={row.value}>
                <div className="mb-2 flex items-start justify-between gap-4">
                  <span className="text-sm leading-5 text-zinc-300">
                    {labels[row.value] || row.value}
                  </span>

                  <span className="shrink-0 text-sm font-semibold text-white">
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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {title}
      </h3>

      <div
        className="border border-zinc-800 bg-zinc-950/35 p-4"
        style={{ borderRadius: 8 }}
      >
        {children}
      </div>
    </section>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-800 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
        {children || "—"}
      </div>
    </div>
  );
}

export default function CommunitySurveyAdminPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] =
    useState<MainTab>("responses");

  const [responses, setResponses] = useState<SurveyResponse[]>(
    []
  );

  const [summary, setSummary] =
    useState<SurveySummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ReviewStatus | "all">("all");

  const [selectedResponse, setSelectedResponse] =
    useState<SurveyResponse | null>(null);

  const [reviewStatus, setReviewStatus] =
    useState<ReviewStatus>("new");

  const [reviewNote, setReviewNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const displayName =
    user?.displayName?.trim() ||
    (user?.email
      ? user.email.split("@")[0]
      : "Unknown User");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/admin/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadSurvey() {
      setLoading(true);
      setErrorMessage("");

      try {
        const idToken = await currentUser.getIdToken();

        const response = await fetch(
          "/api/admin/community-survey",
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        const result =
          (await response.json().catch(() => null)) as
          | ApiResponse
          | null;

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error ||
            "Could not load community survey responses."
          );
        }

        if (!cancelled) {
          setResponses(result.responses || []);
          setSummary(result.summary || null);
        }
      } catch (error) {
        console.error(
          "Community survey dashboard load error:",
          error
        );

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load community survey responses."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSurvey();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredResponses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return responses.filter((response) => {
      const matchesStatus =
        statusFilter === "all" ||
        response.reviewStatus === statusFilter;

      if (!matchesStatus) return false;

      if (!normalizedSearch) return true;

      const searchableText = [
        response.displayIdentity,
        response.name,
        response.robloxAlias,
        response.contactInfo,
        response.robloxExperienceOther,
        response.childSafetyRisksOther,
        response.riskPatternNotes,
        response.creatorActionsOther,
        response.robloxResponsibilitiesOther,
        response.safetyLoopholeDetails,
        response.safetyImprovementIdea,
        response.practicalSolution,
        response.additionalInsight,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [responses, search, statusFilter]);

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.email);
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  function openResponse(response: SurveyResponse) {
    setSelectedResponse(response);
    setReviewStatus(response.reviewStatus);
    setReviewNote(response.reviewNote || "");
  }

  function closeResponse() {
    if (savingReview) return;

    setSelectedResponse(null);
    setReviewStatus("new");
    setReviewNote("");
  }

  async function saveReview() {
    if (!user || !selectedResponse || savingReview) return;

    setSavingReview(true);
    setErrorMessage("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(
        "/api/admin/community-survey",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            responseId: selectedResponse.id,
            reviewStatus,
            reviewNote,
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
          "Could not update this survey response."
        );
      }

      const updatedResponse =
        result.response as SurveyResponse;

      setResponses((current) =>
        current.map((item) =>
          item.id === updatedResponse.id
            ? updatedResponse
            : item
        )
      );

      setSelectedResponse(updatedResponse);

      /*
        Refresh the full dataset so the Findings tab
        immediately reflects newly Valid or Excluded responses.
      */
      const refreshedToken = await user.getIdToken();

      const refreshedResponse = await fetch(
        "/api/admin/community-survey",
        {
          headers: {
            Authorization: `Bearer ${refreshedToken}`,
          },
        }
      );

      const refreshedResult =
        (await refreshedResponse
          .json()
          .catch(() => null)) as ApiResponse | null;

      if (refreshedResponse.ok && refreshedResult?.ok) {
        setResponses(refreshedResult.responses || []);
        setSummary(refreshedResult.summary || null);

        const refreshedSelected =
          refreshedResult.responses.find(
            (item) => item.id === selectedResponse.id
          );

        if (refreshedSelected) {
          setSelectedResponse(refreshedSelected);
          setReviewStatus(
            refreshedSelected.reviewStatus
          );
          setReviewNote(
            refreshedSelected.reviewNote || ""
          );
        }
      }
    } catch (error) {
      console.error(
        "Community survey review save error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update this survey response."
      );
    } finally {
      setSavingReview(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">
            Loading community survey...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="admin_community_survey"
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
              Community Survey
            </p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">
              Community Survey
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Review Roblox community responses, exclude
              suspicious or unusable submissions, and view
              objective findings from responses marked Valid.
            </p>
          </div>

          <div className="mb-6 flex gap-2 border-b border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab("responses")}
              className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "responses"
                ? "border-blue-400 text-blue-300"
                : "border-transparent text-zinc-400 hover:text-white"
                }`}
            >
              Responses
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("findings")}
              className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "findings"
                ? "border-blue-400 text-blue-300"
                : "border-transparent text-zinc-400 hover:text-white"
                }`}
            >
              Findings
            </button>
          </div>

          {errorMessage ? (
            <div
              className="mb-6 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
              style={{ borderRadius: 8 }}
            >
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div
              className="border border-zinc-800 bg-zinc-950/35 p-6 text-sm text-zinc-400"
              style={{ borderRadius: 8 }}
            >
              Loading survey responses...
            </div>
          ) : activeTab === "responses" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 xl:gap-4">
                <StatCard
                  label="Total"
                  value={summary?.statusCounts.total || 0}
                />

                <StatCard
                  label="New"
                  value={summary?.statusCounts.new || 0}
                />

                <StatCard
                  label="Valid"
                  value={summary?.statusCounts.valid || 0}
                />

                <StatCard
                  label="Needs Review"
                  value={summary?.statusCounts.needsReview || 0}
                />

                <StatCard
                  label="Excluded"
                  value={summary?.statusCounts.excluded || 0}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search names, aliases, contact details, or written answers"
                  className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                  style={{ borderRadius: 8 }}
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as
                      | ReviewStatus
                      | "all"
                    )
                  }
                  className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
                  style={{ borderRadius: 8 }}
                >
                  <option value="all">All statuses</option>
                  <option value="new">New</option>
                  <option value="valid">Valid</option>
                  <option value="needs_review">
                    Needs Review
                  </option>
                  <option value="excluded">Excluded</option>
                </select>
              </div>

              <div
                className="hidden overflow-hidden border border-zinc-700 bg-zinc-900/85 md:block"
                style={{ borderRadius: 12 }}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-zinc-800 bg-zinc-950/35">
                      <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                        <th className="px-4 py-3">Respondent</th>
                        <th className="px-4 py-3">
                          Roblox Background
                        </th>
                        <th className="px-4 py-3 text-center">
                          Submitted
                        </th>
                        <th className="px-4 py-3 text-center">
                          Status
                        </th>
                        <th className="px-4 py-3 text-center">
                          Flags
                        </th>
                        <th className="px-4 py-3 text-center">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredResponses.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-7 text-sm text-zinc-400"
                          >
                            No matching survey responses found.
                          </td>
                        </tr>
                      ) : (
                        filteredResponses.map((response) => (
                          <tr
                            key={response.id}
                            className="border-b border-zinc-800/80 text-sm last:border-b-0"
                          >
                            <td className="px-4 py-4">
                              <p className="font-medium text-white">
                                {response.displayIdentity}
                              </p>

                              {response.contactInfo ? (
                                <p className="mt-1 max-w-[240px] truncate text-xs text-zinc-500">
                                  {response.contactInfo}
                                </p>
                              ) : null}
                            </td>

                            <td className="px-4 py-4 text-zinc-300">
                              {mapValues(
                                response.robloxExperience,
                                EXPERIENCE_LABELS
                              )
                                .slice(0, 2)
                                .join(", ") || "—"}

                              {response.robloxExperience.length >
                                2 ? (
                                <span className="text-zinc-500">
                                  {" "}
                                  +{response.robloxExperience.length - 2}
                                </span>
                              ) : null}
                            </td>

                            <td className="px-4 py-4 text-center text-zinc-300">
                              {formatDate(response.createdAt)}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusClass(
                                  response.reviewStatus
                                )}`}
                              >
                                {getStatusLabel(
                                  response.reviewStatus
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-center">
                              {response.suspicious ? (
                                <span className="text-xs font-medium text-amber-300">
                                  Suspicious
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-600">
                                  None
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  openResponse(response)
                                }
                                className="cursor-pointer border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
                                style={{ borderRadius: 7 }}
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 md:hidden">
                {filteredResponses.length === 0 ? (
                  <div
                    className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                    style={{ borderRadius: 12 }}
                  >
                    No matching survey responses found.
                  </div>
                ) : (
                  filteredResponses.map((response) => (
                    <div
                      key={response.id}
                      className="border border-zinc-700 bg-zinc-900/85 p-4"
                      style={{ borderRadius: 12 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold text-white">
                            {response.displayIdentity}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            {formatDate(response.createdAt)}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusClass(
                            response.reviewStatus
                          )}`}
                        >
                          {getStatusLabel(
                            response.reviewStatus
                          )}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-zinc-300">
                        {mapValues(
                          response.robloxExperience,
                          EXPERIENCE_LABELS
                        )
                          .slice(0, 2)
                          .join(", ") || "No background listed"}
                      </p>

                      {response.suspicious ? (
                        <p className="mt-3 text-xs font-medium text-amber-300">
                          This response has an automatic flag.
                        </p>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          openResponse(response)
                        }
                        className="mt-4 w-full cursor-pointer border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
                        style={{ borderRadius: 7 }}
                      >
                        Review Response
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
                <StatCard
                  label="Valid Responses"
                  value={summary?.statusCounts.valid || 0}
                  note="Counted in the findings below."
                />

                <StatCard
                  label="Under Review"
                  value={
                    (summary?.statusCounts.new || 0) +
                    (summary?.statusCounts.needsReview || 0)
                  }
                  note="Not included yet."
                />

                <StatCard
                  label="Excluded"
                  value={summary?.statusCounts.excluded || 0}
                  note="Removed from findings."
                />

                <StatCard
                  label="Auto-Flagged"
                  value={summary?.statusCounts.suspicious || 0}
                  note="May still be valid."
                />
              </div>

              {(summary?.statusCounts.valid || 0) === 0 ? (
                <div
                  className="border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-200"
                  style={{ borderRadius: 8 }}
                >
                  No responses have been marked Valid yet.
                  Review submissions in the Responses tab and
                  mark legitimate entries as Valid before using
                  these findings.
                </div>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-2">
                <TallyList
                  title="Respondent Background"
                  rows={
                    summary?.tallies.robloxExperience || []
                  }
                  labels={EXPERIENCE_LABELS}
                  emptyText="No valid respondent background data yet."
                  note="Respondents may select more than one option."
                />

                <TallyList
                  title="Main Risks to Younger Users"
                  rows={
                    summary?.tallies.childSafetyRisks || []
                  }
                  labels={RISK_LABELS}
                  emptyText="No valid risk selections yet."
                  note="Respondents were asked to choose up to three."
                />

                <TallyList
                  title="What Creators Can Realistically Do"
                  rows={
                    summary?.tallies.creatorActions || []
                  }
                  labels={CREATOR_ACTION_LABELS}
                  emptyText="No valid creator-action selections yet."
                  note="Respondents may select more than one option."
                />

                <TallyList
                  title="What Mainly Requires Roblox-Level Action"
                  rows={
                    summary?.tallies
                      .robloxResponsibilities || []
                  }
                  labels={ROBLOX_RESPONSIBILITY_LABELS}
                  emptyText="No valid Roblox-responsibility selections yet."
                  note="Respondents may select more than one option."
                />

                <TallyList
                  title="Could Safety Measures Have Loopholes?"
                  rows={
                    summary?.tallies
                      .safetyLoopholeAnswers || []
                  }
                  labels={LOOPHOLE_LABELS}
                  emptyText="No valid loophole answers yet."
                />
              </div>

              <div
                className="border border-zinc-800 bg-zinc-950/25 p-5"
                style={{ borderRadius: 8 }}
              >
                <h2 className="text-base font-semibold text-white">
                  How to Use These Findings
                </h2>

                <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-400">
                  These results come from a rapid community
                  consultation and should not be described as a
                  nationally representative or scientific survey.
                  Use the counts to identify recurring views,
                  practical implementation concerns, and ideas
                  worth examining further. The written answers
                  should still be reviewed for context before
                  quoting or summarizing them.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedResponse ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4">
          <div className="flex min-h-full items-start justify-center py-6">
            <div
              className="flex h-[min(90vh,900px)] w-full max-w-4xl flex-col overflow-hidden border border-zinc-800 bg-zinc-900 shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
              style={{ borderRadius: 12 }}
            >
              <div className="border-b border-zinc-800 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-xl font-semibold text-white">
                      {selectedResponse.displayIdentity}
                    </h2>

                    <p className="mt-1 text-sm text-zinc-400">
                      Submitted{" "}
                      {formatDate(selectedResponse.createdAt)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusClass(
                          selectedResponse.reviewStatus
                        )}`}
                      >
                        {getStatusLabel(
                          selectedResponse.reviewStatus
                        )}
                      </span>

                      {selectedResponse.suspicious ? (
                        <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-300">
                          Auto-flagged
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeResponse}
                    disabled={savingReview}
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-zinc-700 bg-zinc-950 text-xl text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderRadius: 8 }}
                    aria-label="Close response"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                <div className="space-y-6">
                  <DetailSection title="Respondent Information">
                    <DetailRow label="Name">
                      {selectedResponse.name || "Anonymous"}
                    </DetailRow>

                    <DetailRow label="Roblox Username or Alias">
                      {selectedResponse.robloxAlias || "—"}
                    </DetailRow>

                    <DetailRow label="Contact Information">
                      {selectedResponse.contactInfo || "—"}
                    </DetailRow>

                    <DetailRow label="May FRDA Contact Them?">
                      {selectedResponse.contactPermission
                        ? "Yes"
                        : "No"}
                    </DetailRow>

                    <DetailRow label="Credit Preference">
                      {selectedResponse.creditPreference ===
                        "name"
                        ? "Use their name"
                        : selectedResponse.creditPreference ===
                          "alias"
                          ? "Use their Roblox alias"
                          : "Keep anonymous"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Roblox Background">
                    <DetailRow label="Selected Background">
                      {mapValues(
                        selectedResponse.robloxExperience,
                        EXPERIENCE_LABELS
                      ).join("\n") || "—"}
                    </DetailRow>

                    <DetailRow label="Other Background">
                      {selectedResponse.robloxExperienceOther ||
                        "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Risks to Younger Users">
                    <DetailRow label="Selected Risks">
                      {mapValues(
                        selectedResponse.childSafetyRisks,
                        RISK_LABELS
                      ).join("\n") || "—"}
                    </DetailRow>

                    <DetailRow label="Other Risk">
                      {selectedResponse.childSafetyRisksOther ||
                        "—"}
                    </DetailRow>

                    <DetailRow label="Situation or Pattern to Examine">
                      {selectedResponse.riskPatternNotes || "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Creator Responsibilities">
                    <DetailRow label="Selected Creator Actions">
                      {mapValues(
                        selectedResponse.creatorActions,
                        CREATOR_ACTION_LABELS
                      ).join("\n") || "—"}
                    </DetailRow>

                    <DetailRow label="Other Creator Action">
                      {selectedResponse.creatorActionsOther ||
                        "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Roblox-Level Responsibilities">
                    <DetailRow label="Selected Roblox Responsibilities">
                      {mapValues(
                        selectedResponse.robloxResponsibilities,
                        ROBLOX_RESPONSIBILITY_LABELS
                      ).join("\n") || "—"}
                    </DetailRow>

                    <DetailRow label="Other Roblox Responsibility">
                      {selectedResponse
                        .robloxResponsibilitiesOther || "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Possible Loopholes and Improvements">
                    <DetailRow label="Could a Safety Measure Have a Loophole?">
                      {LOOPHOLE_LABELS[
                        selectedResponse.hasSafetyLoophole
                      ] ||
                        selectedResponse.hasSafetyLoophole ||
                        "—"}
                    </DetailRow>

                    <DetailRow label="Possible Loophole or Unintended Problem">
                      {selectedResponse.safetyLoopholeDetails ||
                        "—"}
                    </DetailRow>

                    <DetailRow label="Idea to Make It Work Better">
                      {selectedResponse.safetyImprovementIdea ||
                        "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Proposed Solutions">
                    <DetailRow label="One Practical Action">
                      {selectedResponse.practicalSolution || "—"}
                    </DetailRow>

                    <DetailRow label="Additional Insight">
                      {selectedResponse.additionalInsight || "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Technical Review Information">
                    <DetailRow label="Automatic Flag">
                      {selectedResponse.suspicious
                        ? "Yes"
                        : "No"}
                    </DetailRow>

                    <DetailRow label="Flag Reasons">
                      {selectedResponse.suspiciousReasons
                        .length
                        ? selectedResponse.suspiciousReasons.join(
                          "\n"
                        )
                        : "None"}
                    </DetailRow>

                    <DetailRow label="Submissions From Same Technical Source in 24 Hours">
                      {selectedResponse.submissionCountFromIp24Hours ||
                        "—"}
                    </DetailRow>

                    <DetailRow label="Form Completion Time">
                      {formatDuration(
                        selectedResponse.formCompletionTimeMs
                      )}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Review Decision">
                    <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                      <div>
                        <label
                          htmlFor="reviewStatus"
                          className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                        >
                          Status
                        </label>

                        <select
                          id="reviewStatus"
                          value={reviewStatus}
                          onChange={(event) =>
                            setReviewStatus(
                              event.target.value as ReviewStatus
                            )
                          }
                          className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
                          style={{ borderRadius: 8 }}
                        >
                          <option value="new">New</option>
                          <option value="valid">Valid</option>
                          <option value="needs_review">
                            Needs Review
                          </option>
                          <option value="excluded">
                            Excluded
                          </option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="reviewNote"
                          className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                        >
                          Internal Review Note
                        </label>

                        <textarea
                          id="reviewNote"
                          value={reviewNote}
                          onChange={(event) =>
                            setReviewNote(event.target.value)
                          }
                          rows={4}
                          maxLength={2000}
                          placeholder="Optional reason for the review decision"
                          className="w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                          style={{ borderRadius: 8 }}
                        />
                      </div>
                    </div>

                    {selectedResponse.reviewedAt ? (
                      <p className="mt-4 text-xs leading-5 text-zinc-500">
                        Last reviewed by{" "}
                        <span className="text-zinc-300">
                          {selectedResponse.reviewedByName ||
                            selectedResponse.reviewedByEmail ||
                            "Unknown reviewer"}
                        </span>{" "}
                        on{" "}
                        <span className="text-zinc-300">
                          {formatDate(
                            selectedResponse.reviewedAt
                          )}
                        </span>
                      </p>
                    ) : null}

                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={saveReview}
                        disabled={savingReview}
                        className="inline-flex min-w-[150px] cursor-pointer items-center justify-center gap-2 bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
                        style={{ borderRadius: 7 }}
                      >
                        {savingReview ? (
                          <>
                            <span
                              className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                              aria-hidden="true"
                            />
                            Saving...
                          </>
                        ) : (
                          "Save Review"
                        )}
                      </button>
                    </div>
                  </DetailSection>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}