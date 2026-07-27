"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  Users,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { setPresenceOffline } from "@/lib/usePresence";
import { isAdminRole } from "@/lib/adminPermissions";

type StaffProfile = {
  id: string;
  emailAddress?: string;
  role?: string;
};

type MeetingInvitedMember = {
  discordUserId: string;
  displayName: string;
};

type MeetingPoll = {
  id: string;
  title: string;
  description?: string;
  timezone?: string;
  dateOptions?: string[];
  timeOptions?: string[];
  invitedMembers?: MeetingInvitedMember[];
  status?: "open" | "finalized" | "cancelled";
  finalSlotId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deadline?: string | null;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function formatTimestamp(timestamp?: string | null) {
  if (!timestamp) return "—";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(status?: string) {
  if (status === "finalized") return "Finalized";
  if (status === "cancelled") return "Cancelled";
  return "Open";
}

function getStatusStyles(status?: string) {
  if (status === "finalized") {
    return {
      label: "Finalized",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Cancelled",
      className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    };
  }

  return {
    label: "Open",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  };
}

export default function MeetingPollsAdminPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);


  const [meetingPolls, setMeetingPolls] = useState<MeetingPoll[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(true);

  const [pageError, setPageError] = useState("");

  const displayName =
    user?.displayName?.trim() ||
    (user?.email ? user.email.split("@")[0] : "Unknown User");


  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/admin/login");
    }
  }, [authLoading, user, router]);

  async function loadMeetingPolls() {
    if (!user) return;

    setLoadingPolls(true);
    setPageError("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/admin/meeting-polls", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error || "Could not load staff meetings."
        );
      }

      setMeetingPolls(
        Array.isArray(result.polls) ? result.polls : []
      );
    } catch (error) {
      console.error("Error loading meeting polls:", error);
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not load staff meetings."
      );
      setMeetingPolls([]);
    } finally {
      setLoadingPolls(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadMeetingPolls();
    }
  }, [user]);

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.uid, user?.email);
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
          <p className="text-sm text-zinc-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="grid min-h-screen overflow-x-hidden lg:grid-cols-[250px_minmax(0,1fr)]">
        <AdminSidebar
          active="admin_staff_meetings"
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onNavigate={(path) => router.push(path)}
          onSignOut={handleSignOut}
          displayName={displayName}
          email={user.email}
        />

        <section className="relative min-w-0 overflow-x-hidden bg-zinc-900/75 px-4 py-5 md:px-10 md:py-8 xl:px-14">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="bg-zinc-900 px-3 py-2 text-sm text-white"
              style={{ borderRadius: 5 }}
            >
              ☰
            </button>
            <p className="text-2xl font-semibold leading-none text-white">
              Staff Meetings
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="hidden h-11 w-11 shrink-0 items-center justify-center border border-blue-400/30 bg-blue-500/10 text-blue-300 sm:flex"
                  style={{ borderRadius: 8 }}
                >
                  <CalendarClock size={21} strokeWidth={1.5} />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold text-white">
                    Staff Meetings
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Create availability checks, review overlaps, and finalize meeting schedules.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/admin/meeting-polls/new")}
              className="inline-flex w-full max-w-full cursor-pointer items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white md:w-auto md:px-5"
              style={{
                borderRadius: 5,
                background:
                  "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                border: "1px solid rgba(96, 165, 250, 0.55)",
                boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
              }}
            >
              <Plus size={16} strokeWidth={1.8} />
              Create Availability Check
            </button>
          </div>

          {pageError ? (
            <p className="mt-5 text-sm text-red-400">{pageError}</p>
          ) : null}

          <div className="mt-7 grid min-w-0 gap-4 md:grid-cols-3">
            <div
              className="border border-zinc-800 bg-zinc-950/35 p-4"
              style={{ borderRadius: 10 }}
            >
              <div className="flex items-center gap-3">
                <Clock className="text-blue-300" size={18} strokeWidth={1.5} />
                <p className="text-sm font-semibold text-white">Open</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">
                {meetingPolls.filter((poll) => (poll.status || "open") === "open").length}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Availability checks still collecting responses.
              </p>
            </div>

            <div
              className="border border-zinc-800 bg-zinc-950/35 p-4"
              style={{ borderRadius: 10 }}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2
                  className="text-emerald-300"
                  size={18}
                  strokeWidth={1.5}
                />
                <p className="text-sm font-semibold text-white">Finalized</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">
                {meetingPolls.filter((poll) => poll.status === "finalized").length}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Meetings with a selected final time.
              </p>
            </div>

            <div
              className="border border-zinc-800 bg-zinc-950/35 p-4"
              style={{ borderRadius: 10 }}
            >
              <div className="flex items-center gap-3">
                <Users className="text-zinc-300" size={18} strokeWidth={1.5} />
                <p className="text-sm font-semibold text-white">Total Polls</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">
                {meetingPolls.length}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                All staff meeting availability checks.
              </p>
            </div>
          </div>

          <div
            className="mt-7 max-w-full overflow-hidden border border-zinc-800 bg-zinc-950/35"
            style={{ borderRadius: 12 }}
          >
            <div className="border-b border-zinc-800 px-5 py-4">
              <p className="text-sm font-semibold text-white">Meeting Polls</p>
              <p className="mt-1 text-xs text-zinc-500">
                Open a poll to view overlaps and set the final meeting time.
              </p>
            </div>

            {loadingPolls ? (
              <div className="px-5 py-8 text-sm text-zinc-400">
                Loading staff meetings...
              </div>
            ) : meetingPolls.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold text-white">
                  No meeting polls yet.
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Create the first availability check for Berry or the admin team.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/admin/meeting-polls/new")}
                  className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white"
                  style={{
                    borderRadius: 5,
                    background:
                      "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                    border: "1px solid rgba(96, 165, 250, 0.55)",
                  }}
                >
                  <Plus size={16} strokeWidth={1.8} />
                  Create Availability Check
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {meetingPolls.map((poll) => {
                  const status = getStatusStyles(poll.status);
                  const invitedCount = poll.invitedMembers?.length || 0;
                  const slotCount =
                    (poll.dateOptions?.length || 0) * (poll.timeOptions?.length || 0);

                  return (
                    <button
                      key={poll.id}
                      type="button"
                      onClick={() => router.push(`/admin/meeting-polls/${poll.id}`)}
                      className="block w-full min-w-0 cursor-pointer px-4 py-4 text-left transition hover:bg-zinc-900/85 md:px-5"
                    >
                      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 max-w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="max-w-full break-words text-sm font-semibold text-white md:truncate">
                              {poll.title || "Untitled Meeting Poll"}
                            </p>
                            <span
                              className={`inline-flex border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.className}`}
                              style={{ borderRadius: 999 }}
                            >
                              {status.label}
                            </span>
                          </div>

                          <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                            {poll.description || "No description added."}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                            <span>{invitedCount} invited</span>
                            <span>{slotCount} slots</span>
                            <span>Deadline: {formatTimestamp(poll.deadline)}</span>
                            <span>Updated: {formatTimestamp(poll.updatedAt)}</span>
                          </div>
                        </div>

                        <div className="text-sm text-blue-300 md:shrink-0">
                          View overlaps →
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}