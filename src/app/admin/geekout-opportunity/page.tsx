"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";

type MainTab = "visitors" | "portfolio";
type RecordType = "visitor" | "portfolio";

type VisitorReviewStatus =
  | "new"
  | "reviewed"
  | "archived"
  | "blocked";

type PortfolioReviewStatus =
  | "new"
  | "reviewing"
  | "needs_clarification"
  | "candidate"
  | "not_a_fit"
  | "sent_to_geekout"
  | "selected_by_geekout"
  | "archived";

type OpportunityVisitor = {
  id: string;
  creatorAlias: string;
  interests: string[];

  status: string;
  reviewStatus: VisitorReviewStatus;
  reviewNote: string;

  inviteCode: string;
  inviteUrl: string;
  inviteGenerated: boolean;
  inviteMaxUses: number;
  inviteExpiresInSeconds: number;

  reviewedByEmail: string;
  reviewedByName: string;
  reviewedAt: string | null;

  createdAt: string | null;
  updatedAt: string | null;

  turnstileHostname: string;
  turnstileChallengeTimestamp: string;
  userAgent: string;
};

type PortfolioSubmission = {
  id: string;

  creatorName: string;
  age: number | null;
  isMinor: boolean;

  robloxProfileUrl: string;
  workLink: string;
  contribution: string;
  meetingPreference: string;

  discordUsername: string;
  email: string;

  consentToShare: boolean;
  futureOpportunities: boolean;
  wantsDiscordInvite: boolean;

  reviewStatus: PortfolioReviewStatus;
  reviewNote: string;

  candidateInviteGenerated: boolean;
  candidateInviteUrl: string;
  candidateInviteEmailSent: boolean;
  candidateInviteEmailSentAt: string | null;
  candidateInviteEmailSentTo: string;
  candidateInviteEmailError: string;

  sentToGeekOut: boolean;
  selectedByGeekOut: boolean;

  reviewedByEmail: string;
  reviewedByName: string;
  reviewedAt: string | null;

  createdAt: string | null;
  updatedAt: string | null;

  turnstileHostname: string;
  turnstileChallengeTimestamp: string;
  userAgent: string;
};

type ApiResponse = {
  ok: boolean;
  visitors: OpportunityVisitor[];
  portfolioSubmissions: PortfolioSubmission[];
  error?: string;
};

type ToastState = {
  message: string;
  tone: "success" | "error";
} | null;

const VISITOR_STATUSES: VisitorReviewStatus[] = [
  "new",
  "reviewed",
  "archived",
  "blocked",
];

const PORTFOLIO_STATUSES: PortfolioReviewStatus[] = [
  "new",
  "reviewing",
  "needs_clarification",
  "candidate",
  "not_a_fit",
  "sent_to_geekout",
  "selected_by_geekout",
  "archived",
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(date);
}

function getVisitorStatusLabel(status: VisitorReviewStatus) {
  switch (status) {
    case "new":
      return "New";
    case "reviewed":
      return "Reviewed";
    case "archived":
      return "Archived";
    case "blocked":
      return "Blocked";
    default:
      return status;
  }
}

function getPortfolioStatusLabel(
  status: PortfolioReviewStatus
) {
  switch (status) {
    case "new":
      return "New";
    case "reviewing":
      return "Reviewing";
    case "needs_clarification":
      return "Needs clarification";
    case "candidate":
      return "Candidate";
    case "not_a_fit":
      return "Not a fit";
    case "sent_to_geekout":
      return "Sent to GeekOut";
    case "selected_by_geekout":
      return "Selected by GeekOut";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "reviewed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "reviewing":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";

    case "needs_clarification":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "candidate":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300";

    case "sent_to_geekout":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";

    case "selected_by_geekout":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "not_a_fit":
    case "blocked":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "archived":
      return "border-zinc-600 bg-zinc-800 text-zinc-300";

    case "new":
    default:
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }
}

function getMeetingLabel(value: string) {
  switch (value) {
    case "manila":
      return "Manila";
    case "online":
      return "Online";
    case "either":
      return "Either";
    default:
      return value || "—";
  }
}

function getInterestLabel(value: string) {
  switch (value) {
    case "geekout_opportunity":
      return "GeekOut opportunity";
    case "future_opportunities":
      return "Future developer opportunities";
    default:
      return value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function StatusChip({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span
      className={`inline-flex border px-2.5 py-1 text-xs font-medium ${getStatusClass(
        status
      )}`}
      style={{ borderRadius: 999 }}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      className="min-w-0 border border-zinc-800 bg-zinc-950/35 px-4 py-3.5"
      style={{ borderRadius: 8 }}
    >
      <div className="flex items-center justify-between gap-4 sm:block">
        <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-zinc-500 sm:text-xs">
          {label}
        </p>

        <p className="shrink-0 text-2xl font-semibold leading-none text-white sm:mt-3 sm:text-3xl">
          {value.toLocaleString()}
        </p>
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

function BooleanValue({ value }: { value: boolean }) {
  return (
    <span className={value ? "text-emerald-300" : "text-zinc-400"}>
      {value ? "Yes" : "No"}
    </span>
  );
}

export default function GeekOutOpportunityAdminPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] =
    useState<MainTab>("visitors");

  const [visitors, setVisitors] = useState<
    OpportunityVisitor[]
  >([]);

  const [portfolioSubmissions, setPortfolioSubmissions] =
    useState<PortfolioSubmission[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [visitorSearch, setVisitorSearch] = useState("");
  const [visitorStatusFilter, setVisitorStatusFilter] =
    useState<VisitorReviewStatus | "all">("all");

  const [portfolioSearch, setPortfolioSearch] =
    useState("");

  const [
    portfolioStatusFilter,
    setPortfolioStatusFilter,
  ] = useState<PortfolioReviewStatus | "all">("all");

  const [selectedVisitor, setSelectedVisitor] =
    useState<OpportunityVisitor | null>(null);

  const [
    selectedPortfolio,
    setSelectedPortfolio,
  ] = useState<PortfolioSubmission | null>(null);

  const [visitorReviewStatus, setVisitorReviewStatus] =
    useState<VisitorReviewStatus>("new");

  const [portfolioReviewStatus, setPortfolioReviewStatus] =
    useState<PortfolioReviewStatus>("new");

  const [reviewNote, setReviewNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [sendingCandidateInvite, setSendingCandidateInvite] =
    useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

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

    async function loadRecords() {
      setLoading(true);
      setErrorMessage("");

      try {
        const idToken = await currentUser.getIdToken();

        const response = await fetch(
          "/api/admin/geekout-opportunity",
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
              "Could not load GeekOut opportunity records."
          );
        }

        if (!cancelled) {
          setVisitors(result.visitors || []);
          setPortfolioSubmissions(
            result.portfolioSubmissions || []
          );
        }
      } catch (error) {
        console.error(
          "GeekOut opportunity dashboard load error:",
          error
        );

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load GeekOut opportunity records."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const visitorCounts = useMemo(() => {
    return {
      total: visitors.length,
      new: visitors.filter(
        (visitor) => visitor.reviewStatus === "new"
      ).length,
      reviewed: visitors.filter(
        (visitor) => visitor.reviewStatus === "reviewed"
      ).length,
      blocked: visitors.filter(
        (visitor) => visitor.reviewStatus === "blocked"
      ).length,
    };
  }, [visitors]);

  const portfolioCounts = useMemo(() => {
    return {
      total: portfolioSubmissions.length,
      new: portfolioSubmissions.filter(
        (submission) => submission.reviewStatus === "new"
      ).length,
      candidate: portfolioSubmissions.filter(
        (submission) =>
          submission.reviewStatus === "candidate"
      ).length,
      selected: portfolioSubmissions.filter(
        (submission) =>
          submission.reviewStatus ===
          "selected_by_geekout"
      ).length,
    };
  }, [portfolioSubmissions]);

  const filteredVisitors = useMemo(() => {
    const normalizedSearch = visitorSearch
      .trim()
      .toLowerCase();

    return visitors.filter((visitor) => {
      const matchesStatus =
        visitorStatusFilter === "all" ||
        visitor.reviewStatus === visitorStatusFilter;

      if (!matchesStatus) return false;
      if (!normalizedSearch) return true;

      const searchableText = [
        visitor.creatorAlias,
        ...(visitor.interests || []),
        visitor.status,
        visitor.reviewStatus,
        visitor.reviewNote,
        visitor.inviteCode,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [visitors, visitorSearch, visitorStatusFilter]);

  const filteredPortfolioSubmissions = useMemo(() => {
    const normalizedSearch = portfolioSearch
      .trim()
      .toLowerCase();

    return portfolioSubmissions.filter((submission) => {
      const matchesStatus =
        portfolioStatusFilter === "all" ||
        submission.reviewStatus === portfolioStatusFilter;

      if (!matchesStatus) return false;
      if (!normalizedSearch) return true;

      const searchableText = [
        submission.creatorName,
        submission.email,
        submission.discordUsername,
        submission.robloxProfileUrl,
        submission.workLink,
        submission.contribution,
        submission.meetingPreference,
        submission.reviewStatus,
        submission.reviewNote,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    portfolioSubmissions,
    portfolioSearch,
    portfolioStatusFilter,
  ]);

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.email);
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  function openVisitor(visitor: OpportunityVisitor) {
    setSuccessMessage("");
    setSelectedPortfolio(null);
    setSelectedVisitor(visitor);
    setVisitorReviewStatus(
      visitor.reviewStatus || "new"
    );
    setReviewNote(visitor.reviewNote || "");
  }

  function openPortfolio(
    submission: PortfolioSubmission
  ) {
    setSuccessMessage("");
    setSelectedVisitor(null);
    setSelectedPortfolio(submission);
    setPortfolioReviewStatus(
      submission.reviewStatus || "new"
    );
    setReviewNote(submission.reviewNote || "");
  }

  function closeReviewPanel() {
    if (savingReview || sendingCandidateInvite) return;

    setSelectedVisitor(null);
    setSelectedPortfolio(null);
    setReviewNote("");
    setSuccessMessage("");
  }

  async function copyText(
    value: string,
    successText: string
  ) {
    if (!value) {
      setErrorMessage("There is nothing available to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(successText);
      setErrorMessage("");
    } catch (error) {
      console.error("Clipboard error:", error);
      setErrorMessage(
        "Could not copy the value to your clipboard."
      );
    }
  }

  async function sendCandidateInvite({
    submission,
    isResend = false,
  }: {
    submission: PortfolioSubmission;
    isResend?: boolean;
  }) {
    if (!user || sendingCandidateInvite) return null;

    setSendingCandidateInvite(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(
        "/api/admin/geekout-opportunity/send-candidate-invite",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            submissionId: submission.id,
            resend: isResend,
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            "Could not send the GeekOut Candidate invitation."
        );
      }

      const updatedSubmission: PortfolioSubmission = {
        ...submission,
        candidateInviteGenerated: true,
        candidateInviteEmailSent: true,
        candidateInviteEmailSentAt: new Date().toISOString(),
        candidateInviteEmailSentTo: submission.email,
        candidateInviteEmailError: "",
      };

      setPortfolioSubmissions((current) =>
        current.map((item) =>
          item.id === updatedSubmission.id
            ? updatedSubmission
            : item
        )
      );

      setSelectedPortfolio(updatedSubmission);

      const message = isResend
        ? "Candidate Discord invitation resent successfully."
        : "Candidate Discord invitation emailed successfully.";

      setSuccessMessage(message);
      setToast({
        message,
        tone: "success",
      });

      return updatedSubmission;
    } catch (error) {
      console.error(
        "GeekOut candidate invitation send error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Could not send the GeekOut Candidate invitation.";

      setErrorMessage(message);
      setToast({
        message,
        tone: "error",
      });

      return null;
    } finally {
      setSendingCandidateInvite(false);
    }
  }

  async function saveReview() {
    if (!user || savingReview) return;

    const recordType: RecordType | null = selectedVisitor
      ? "visitor"
      : selectedPortfolio
        ? "portfolio"
        : null;

    const recordId =
      selectedVisitor?.id || selectedPortfolio?.id || "";

    if (!recordType || !recordId) return;

    const reviewStatus =
      recordType === "visitor"
        ? visitorReviewStatus
        : portfolioReviewStatus;

    setSavingReview(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(
        "/api/admin/geekout-opportunity",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            recordType,
            recordId,
            reviewStatus,
            reviewNote,
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            "Could not update this GeekOut opportunity record."
        );
      }

      if (recordType === "visitor") {
        const updatedVisitor =
          result.record as OpportunityVisitor;

        setVisitors((current) =>
          current.map((visitor) =>
            visitor.id === updatedVisitor.id
              ? updatedVisitor
              : visitor
          )
        );

        setSelectedVisitor(updatedVisitor);
        setVisitorReviewStatus(
          updatedVisitor.reviewStatus
        );
        setReviewNote(updatedVisitor.reviewNote || "");
      } else {
        const updatedSubmission =
          result.record as PortfolioSubmission;

        setPortfolioSubmissions((current) =>
          current.map((submission) =>
            submission.id === updatedSubmission.id
              ? updatedSubmission
              : submission
          )
        );

        setSelectedPortfolio(updatedSubmission);
        setPortfolioReviewStatus(
          updatedSubmission.reviewStatus
        );
        setReviewNote(
          updatedSubmission.reviewNote || ""
        );

        const shouldSendCandidateInvite =
          updatedSubmission.reviewStatus === "candidate" &&
          updatedSubmission.wantsDiscordInvite === true &&
          updatedSubmission.candidateInviteEmailSent !== true;

        if (shouldSendCandidateInvite) {
          const sentSubmission =
            await sendCandidateInvite({
              submission: updatedSubmission,
            });

          if (sentSubmission) {
            setSuccessMessage(
              "Review saved and candidate Discord invitation emailed."
            );
            setToast({
              message:
                "Review saved and candidate Discord invitation emailed.",
              tone: "success",
            });
          } else {
            setSuccessMessage(
              "Review saved, but the candidate invitation could not be sent."
            );
          }

          return;
        }
      }

      setSuccessMessage("Review saved successfully.");
      setToast({
        message: "Review saved successfully.",
        tone: "success",
      });
    } catch (error) {
      console.error(
        "GeekOut opportunity review save error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update this GeekOut opportunity record."
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
            Loading GeekOut opportunity dashboard...
          </p>
        </div>
      </main>
    );
  }

  const reviewPanelOpen =
    Boolean(selectedVisitor) ||
    Boolean(selectedPortfolio);

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="admin_geekout_opportunity"
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
              className="cursor-pointer bg-zinc-800 px-3 py-2 text-sm text-white"
              style={{ borderRadius: 8 }}
            >
              ☰
            </button>

            <p className="text-2xl font-semibold leading-none text-white">
              GeekOut Opportunity
            </p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">
              GeekOut Opportunity
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Review Discord visitor requests and developer
              portfolio submissions collected for possible
              introduction to GeekOut K.K.
            </p>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto border-b border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab("visitors");
                closeReviewPanel();
              }}
              className={`shrink-0 cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === "visitors"
                  ? "border-blue-400 text-blue-300"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              Discord Visitors
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("portfolio");
                closeReviewPanel();
              }}
              className={`shrink-0 cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === "portfolio"
                  ? "border-blue-400 text-blue-300"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              Portfolio Submissions
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

          {successMessage && !reviewPanelOpen ? (
            <div
              className="mb-6 border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200"
              style={{ borderRadius: 8 }}
            >
              {successMessage}
            </div>
          ) : null}

          {loading ? (
            <div
              className="border border-zinc-800 bg-zinc-950/35 p-6 text-sm text-zinc-400"
              style={{ borderRadius: 8 }}
            >
              Loading GeekOut opportunity records...
            </div>
          ) : activeTab === "visitors" ? (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Total visitors"
                  value={visitorCounts.total}
                />

                <StatCard
                  label="New"
                  value={visitorCounts.new}
                />

                <StatCard
                  label="Reviewed"
                  value={visitorCounts.reviewed}
                />

                <StatCard
                  label="Blocked"
                  value={visitorCounts.blocked}
                />
              </div>

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="search"
                  value={visitorSearch}
                  onChange={(event) =>
                    setVisitorSearch(event.target.value)
                  }
                  placeholder="Search creator alias..."
                  className="min-w-0 flex-1 border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                  style={{ borderRadius: 8 }}
                />

                <select
                  value={visitorStatusFilter}
                  onChange={(event) =>
                    setVisitorStatusFilter(
                      event.target.value as
                        | VisitorReviewStatus
                        | "all"
                    )
                  }
                  className="border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  style={{ borderRadius: 8 }}
                >
                  <option value="all">All statuses</option>

                  {VISITOR_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {getVisitorStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
                style={{ borderRadius: 8 }}
              >
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[940px] border-collapse">
                    <thead className="bg-zinc-950/80">
                      <tr className="border-b border-zinc-800 text-left">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Creator alias
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Interests
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Submitted
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Invite
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Review status
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredVisitors.map((visitor) => (
                        <tr
                          key={visitor.id}
                          className="border-b border-zinc-800/80 last:border-b-0 hover:bg-white/[0.025]"
                        >
                          <td className="px-4 py-4 align-top">
                            <p className="font-medium text-white">
                              {visitor.creatorAlias || "—"}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                              Status —{" "}
                              {visitor.status || "submitted"}
                            </p>
                          </td>

                          <td className="max-w-[280px] px-4 py-4 align-top">
                            <div className="flex flex-wrap gap-1.5">
                              {(visitor.interests || []).length >
                              0 ? (
                                visitor.interests.map(
                                  (interest) => (
                                    <span
                                      key={interest}
                                      className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                                      style={{
                                        borderRadius: 999,
                                      }}
                                    >
                                      {getInterestLabel(
                                        interest
                                      )}
                                    </span>
                                  )
                                )
                              ) : (
                                <span className="text-sm text-zinc-500">
                                  —
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-sm leading-5 text-zinc-300">
                            {formatDate(visitor.createdAt)}
                          </td>

                          <td className="px-4 py-4 align-top text-sm">
                            <BooleanValue
                              value={Boolean(
                                visitor.inviteGenerated
                              )}
                            />
                          </td>

                          <td className="px-4 py-4 align-top">
                            <StatusChip
                              status={visitor.reviewStatus}
                              label={getVisitorStatusLabel(
                                visitor.reviewStatus
                              )}
                            />
                          </td>

                          <td className="px-4 py-4 text-right align-top">
                            <button
                              type="button"
                              onClick={() =>
                                openVisitor(visitor)
                              }
                              className="cursor-pointer border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:border-zinc-600 hover:bg-zinc-800"
                              style={{ borderRadius: 7 }}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-zinc-800 lg:hidden">
                  {filteredVisitors.map((visitor) => (
                    <button
                      key={visitor.id}
                      type="button"
                      onClick={() => openVisitor(visitor)}
                      className="block w-full cursor-pointer p-4 text-left hover:bg-white/[0.025]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">
                            {visitor.creatorAlias || "—"}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            {formatDate(visitor.createdAt)}
                          </p>
                        </div>

                        <StatusChip
                          status={visitor.reviewStatus}
                          label={getVisitorStatusLabel(
                            visitor.reviewStatus
                          )}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(visitor.interests || []).map(
                          (interest) => (
                            <span
                              key={interest}
                              className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                              style={{ borderRadius: 999 }}
                            >
                              {getInterestLabel(interest)}
                            </span>
                          )
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {filteredVisitors.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    No Discord visitor records match the
                    current filters.
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Total submissions"
                  value={portfolioCounts.total}
                />

                <StatCard
                  label="New"
                  value={portfolioCounts.new}
                />

                <StatCard
                  label="Candidates"
                  value={portfolioCounts.candidate}
                />

                <StatCard
                  label="Selected"
                  value={portfolioCounts.selected}
                />
              </div>

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="search"
                  value={portfolioSearch}
                  onChange={(event) =>
                    setPortfolioSearch(event.target.value)
                  }
                  placeholder="Search creator, email, Discord, or work..."
                  className="min-w-0 flex-1 border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                  style={{ borderRadius: 8 }}
                />

                <select
                  value={portfolioStatusFilter}
                  onChange={(event) =>
                    setPortfolioStatusFilter(
                      event.target.value as
                        | PortfolioReviewStatus
                        | "all"
                    )
                  }
                  className="border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  style={{ borderRadius: 8 }}
                >
                  <option value="all">All statuses</option>

                  {PORTFOLIO_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {getPortfolioStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
                style={{ borderRadius: 8 }}
              >
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1120px] border-collapse">
                    <thead className="bg-zinc-950/80">
                      <tr className="border-b border-zinc-800 text-left">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Creator
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Age
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Best work
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Meeting
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Contact
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Submitted
                        </th>

                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Review status
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPortfolioSubmissions.map(
                        (submission) => {
                          const workUrl = safeExternalUrl(
                            submission.workLink
                          );

                          return (
                            <tr
                              key={submission.id}
                              className="border-b border-zinc-800/80 last:border-b-0 hover:bg-white/[0.025]"
                            >
                              <td className="px-4 py-4 align-top">
                                <p className="font-medium text-white">
                                  {submission.creatorName ||
                                    "—"}
                                </p>

                                {submission.isMinor ? (
                                  <p className="mt-1 text-xs font-medium text-amber-300">
                                    Minor
                                  </p>
                                ) : null}
                              </td>

                              <td className="px-4 py-4 align-top text-sm text-zinc-300">
                                {submission.age ?? "—"}
                              </td>

                              <td className="max-w-[220px] px-4 py-4 align-top">
                                {workUrl ? (
                                  <a
                                    href={workUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block truncate text-sm text-blue-300 hover:text-blue-200 hover:underline"
                                  >
                                    Open work
                                  </a>
                                ) : (
                                  <span className="text-sm text-zinc-500">
                                    —
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-4 align-top text-sm text-zinc-300">
                                {getMeetingLabel(
                                  submission.meetingPreference
                                )}
                              </td>

                              <td className="max-w-[220px] px-4 py-4 align-top">
                                <p className="truncate text-sm text-zinc-300">
                                  {submission.email || "—"}
                                </p>

                                {submission.discordUsername ? (
                                  <p className="mt-1 truncate text-xs text-zinc-500">
                                    Discord —{" "}
                                    {
                                      submission.discordUsername
                                    }
                                  </p>
                                ) : null}
                              </td>

                              <td className="px-4 py-4 align-top text-sm leading-5 text-zinc-300">
                                {formatDate(
                                  submission.createdAt
                                )}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <StatusChip
                                  status={
                                    submission.reviewStatus
                                  }
                                  label={getPortfolioStatusLabel(
                                    submission.reviewStatus
                                  )}
                                />
                              </td>

                              <td className="px-4 py-4 text-right align-top">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPortfolio(submission)
                                  }
                                  className="cursor-pointer border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:border-zinc-600 hover:bg-zinc-800"
                                  style={{ borderRadius: 7 }}
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-zinc-800 lg:hidden">
                  {filteredPortfolioSubmissions.map(
                    (submission) => (
                      <button
                        key={submission.id}
                        type="button"
                        onClick={() =>
                          openPortfolio(submission)
                        }
                        className="block w-full cursor-pointer p-4 text-left hover:bg-white/[0.025]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {submission.creatorName || "—"}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                              Age {submission.age ?? "—"} ·{" "}
                              {getMeetingLabel(
                                submission.meetingPreference
                              )}
                            </p>
                          </div>

                          <StatusChip
                            status={submission.reviewStatus}
                            label={getPortfolioStatusLabel(
                              submission.reviewStatus
                            )}
                          />
                        </div>

                        <p className="mt-3 truncate text-sm text-zinc-400">
                          {submission.email || "—"}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(submission.createdAt)}
                        </p>
                      </button>
                    )
                  )}
                </div>

                {filteredPortfolioSubmissions.length ===
                0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    No portfolio submissions match the current
                    filters.
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>

      {reviewPanelOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-end bg-black/70 sm:items-stretch"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReviewPanel();
            }
          }}
        >
          <div className="flex max-h-[94vh] w-full flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl sm:max-h-none sm:max-w-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {selectedVisitor
                    ? "Discord visitor"
                    : "Portfolio submission"}
                </p>

                <h2 className="mt-1 truncate text-lg font-semibold text-white">
                  {selectedVisitor?.creatorAlias ||
                    selectedPortfolio?.creatorName ||
                    "Record"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeReviewPanel}
                disabled={savingReview}
                className="cursor-pointer px-2 py-1 text-xl leading-none text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close review panel"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {successMessage ? (
                <div
                  className="mb-5 border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200"
                  style={{ borderRadius: 8 }}
                >
                  {successMessage}
                </div>
              ) : null}

              {selectedVisitor ? (
                <div className="space-y-6">
                  <DetailSection title="Visitor details">
                    <DetailRow label="Creator alias">
                      {selectedVisitor.creatorAlias}
                    </DetailRow>

                    <DetailRow label="Interests">
                      {(selectedVisitor.interests || [])
                        .map(getInterestLabel)
                        .join(", ")}
                    </DetailRow>

                    <DetailRow label="Submitted">
                      {formatDate(selectedVisitor.createdAt)}
                    </DetailRow>

                    <DetailRow label="Submission status">
                      {selectedVisitor.status || "submitted"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Discord invitation">
                    <DetailRow label="Invite generated">
                      <BooleanValue
                        value={Boolean(
                          selectedVisitor.inviteGenerated
                        )}
                      />
                    </DetailRow>

                    <DetailRow label="Invite URL">
                      {selectedVisitor.inviteUrl ? (
                        <div className="space-y-3">
                          <p className="break-all text-zinc-300">
                            {selectedVisitor.inviteUrl}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                selectedVisitor.inviteUrl,
                                "Invite URL copied."
                              )
                            }
                            className="cursor-pointer border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
                            style={{ borderRadius: 7 }}
                          >
                            Copy invite URL
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </DetailRow>

                    <DetailRow label="Invite code">
                      {selectedVisitor.inviteCode || "—"}
                    </DetailRow>

                    <DetailRow label="Maximum uses">
                      {selectedVisitor.inviteMaxUses ?? "—"}
                    </DetailRow>

                    <DetailRow label="Expires after">
                      {selectedVisitor.inviteExpiresInSeconds
                        ? `${Math.round(
                            selectedVisitor.inviteExpiresInSeconds /
                              3600
                          )} hours`
                        : "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Technical details">
                    <DetailRow label="Turnstile hostname">
                      {selectedVisitor.turnstileHostname ||
                        "—"}
                    </DetailRow>

                    <DetailRow label="Turnstile challenge">
                      {selectedVisitor
                        .turnstileChallengeTimestamp || "—"}
                    </DetailRow>

                    <DetailRow label="User agent">
                      {selectedVisitor.userAgent || "—"}
                    </DetailRow>
                  </DetailSection>
                </div>
              ) : null}

              {selectedPortfolio ? (
                <div className="space-y-6">
                  {selectedPortfolio.isMinor ? (
                    <div
                      className="border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200"
                      style={{ borderRadius: 8 }}
                    >
                      This applicant is under 18. Take
                      appropriate care with direct contact,
                      meetings, and the sharing of personal
                      information.
                    </div>
                  ) : null}

                  <DetailSection title="Creator details">
                    <DetailRow label="Creator, alias, or studio">
                      {selectedPortfolio.creatorName}
                    </DetailRow>

                    <DetailRow label="Exact age">
                      {selectedPortfolio.age ?? "—"}
                    </DetailRow>

                    <DetailRow label="Minor">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio.isMinor
                        )}
                      />
                    </DetailRow>

                    <DetailRow label="Email">
                      {selectedPortfolio.email ? (
                        <a
                          href={`mailto:${selectedPortfolio.email}`}
                          className="text-blue-300 hover:text-blue-200 hover:underline"
                        >
                          {selectedPortfolio.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </DetailRow>

                    <DetailRow label="Discord username">
                      {selectedPortfolio.discordUsername ||
                        "—"}
                    </DetailRow>

                    <DetailRow label="Meeting availability">
                      {getMeetingLabel(
                        selectedPortfolio.meetingPreference
                      )}
                    </DetailRow>

                    <DetailRow label="Submitted">
                      {formatDate(selectedPortfolio.createdAt)}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Portfolio">
                    <DetailRow label="Roblox profile">
                      {safeExternalUrl(
                        selectedPortfolio.robloxProfileUrl
                      ) ? (
                        <a
                          href={safeExternalUrl(
                            selectedPortfolio.robloxProfileUrl
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-blue-300 hover:text-blue-200 hover:underline"
                        >
                          {
                            selectedPortfolio.robloxProfileUrl
                          }
                        </a>
                      ) : (
                        selectedPortfolio.robloxProfileUrl ||
                        "—"
                      )}
                    </DetailRow>

                    <DetailRow label="Best game or portfolio">
                      {safeExternalUrl(
                        selectedPortfolio.workLink
                      ) ? (
                        <a
                          href={safeExternalUrl(
                            selectedPortfolio.workLink
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-blue-300 hover:text-blue-200 hover:underline"
                        >
                          {selectedPortfolio.workLink}
                        </a>
                      ) : (
                        selectedPortfolio.workLink || "—"
                      )}
                    </DetailRow>

                    <DetailRow label="Contribution">
                      {selectedPortfolio.contribution || "—"}
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Preferences and consent">
                    <DetailRow label="Consent to share with GeekOut">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio.consentToShare
                        )}
                      />
                    </DetailRow>

                    <DetailRow label="Interested in future opportunities">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio.futureOpportunities
                        )}
                      />
                    </DetailRow>

                    <DetailRow label="Wants a Discord invite if qualified">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio.wantsDiscordInvite
                        )}
                      />
                    </DetailRow>

                    <DetailRow label="Candidate invite generated">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio
                            .candidateInviteGenerated
                        )}
                      />
                    </DetailRow>

                    <DetailRow label="Candidate invite emailed">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio
                            .candidateInviteEmailSent
                        )}
                      />
                    </DetailRow>

                    {selectedPortfolio.candidateInviteEmailSentAt ? (
                      <DetailRow label="Invite last emailed">
                        {formatDate(
                          selectedPortfolio.candidateInviteEmailSentAt
                        )}
                      </DetailRow>
                    ) : null}

                    {selectedPortfolio.candidateInviteEmailError ? (
                      <DetailRow label="Last invite error">
                        <span className="text-red-300">
                          {
                            selectedPortfolio
                              .candidateInviteEmailError
                          }
                        </span>
                      </DetailRow>
                    ) : null}

                    <DetailRow label="Sent to GeekOut">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio.sentToGeekOut
                        )}
                      />
                    </DetailRow>

                    <DetailRow label="Selected by GeekOut">
                      <BooleanValue
                        value={Boolean(
                          selectedPortfolio.selectedByGeekOut
                        )}
                      />
                    </DetailRow>
                  </DetailSection>

                  <DetailSection title="Technical details">
                    <DetailRow label="Turnstile hostname">
                      {selectedPortfolio.turnstileHostname ||
                        "—"}
                    </DetailRow>

                    <DetailRow label="Turnstile challenge">
                      {selectedPortfolio
                        .turnstileChallengeTimestamp || "—"}
                    </DetailRow>

                    <DetailRow label="User agent">
                      {selectedPortfolio.userAgent || "—"}
                    </DetailRow>
                  </DetailSection>
                </div>
              ) : null}

              <div className="mt-6 border-t border-zinc-800 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                  Internal review
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="review-status"
                      className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Review status
                    </label>

                    {selectedVisitor ? (
                      <select
                        id="review-status"
                        value={visitorReviewStatus}
                        onChange={(event) =>
                          setVisitorReviewStatus(
                            event.target
                              .value as VisitorReviewStatus
                          )
                        }
                        className="w-full border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                        style={{ borderRadius: 8 }}
                      >
                        {VISITOR_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {getVisitorStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        id="review-status"
                        value={portfolioReviewStatus}
                        onChange={(event) =>
                          setPortfolioReviewStatus(
                            event.target
                              .value as PortfolioReviewStatus
                          )
                        }
                        className="w-full border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                        style={{ borderRadius: 8 }}
                      >
                        {PORTFOLIO_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {getPortfolioStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="review-note"
                      className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Review note
                    </label>

                    <textarea
                      id="review-note"
                      value={reviewNote}
                      onChange={(event) =>
                        setReviewNote(event.target.value)
                      }
                      rows={6}
                      maxLength={5000}
                      placeholder="Add an internal note about this record..."
                      className="w-full resize-y border border-zinc-700 bg-zinc-950 px-3.5 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                      style={{ borderRadius: 8 }}
                    />

                    <p className="mt-1 text-right text-xs text-zinc-600">
                      {reviewNote.length.toLocaleString()} /
                      5,000
                    </p>
                  </div>

                  {(selectedVisitor?.reviewedAt ||
                    selectedPortfolio?.reviewedAt) ? (
                    <p className="text-xs leading-5 text-zinc-500">
                      Last reviewed{" "}
                      {formatDate(
                        selectedVisitor?.reviewedAt ||
                          selectedPortfolio?.reviewedAt
                      )}
                      {selectedVisitor?.reviewedByName ||
                      selectedPortfolio?.reviewedByName
                        ? ` by ${
                            selectedVisitor?.reviewedByName ||
                            selectedPortfolio?.reviewedByName
                          }`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                {selectedPortfolio &&
                selectedPortfolio.reviewStatus === "candidate" &&
                selectedPortfolio.wantsDiscordInvite ? (
                  <button
                    type="button"
                    onClick={() =>
                      sendCandidateInvite({
                        submission: selectedPortfolio,
                        isResend:
                          selectedPortfolio
                            .candidateInviteEmailSent === true,
                      })
                    }
                    disabled={
                      savingReview ||
                      sendingCandidateInvite
                    }
                    className="w-full cursor-pointer border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    style={{ borderRadius: 8 }}
                  >
                    {sendingCandidateInvite
                      ? "Sending invite..."
                      : selectedPortfolio
                            .candidateInviteEmailSent
                        ? "Resend Discord invite"
                        : "Send Discord invite"}
                  </button>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeReviewPanel}
                  disabled={
                    savingReview ||
                    sendingCandidateInvite
                  }
                  className="cursor-pointer border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: 8 }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={saveReview}
                  disabled={
                    savingReview ||
                    sendingCandidateInvite
                  }
                  className="cursor-pointer bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: 8 }}
                >
                  {savingReview
                    ? "Saving..."
                    : "Save review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-[140] max-w-sm border px-4 py-3 text-sm font-medium shadow-2xl ${
            toast.tone === "success"
              ? "border-emerald-500/30 bg-emerald-950 text-emerald-100"
              : "border-red-500/30 bg-red-950 text-red-100"
          }`}
          style={{ borderRadius: 8 }}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}