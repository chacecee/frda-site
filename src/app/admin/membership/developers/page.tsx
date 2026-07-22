"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { notify } from "@/components/ToastConfig";

type ProfileStatus =
  | "not_started"
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "live"
  | "hidden";

type DeveloperAccount = {
  uid: string;
  memberId: string;

  email: string;
  displayName: string;

  accountPurpose: string;
  accountStatus: string;
  memberStatus: string;
  profileStatus: ProfileStatus;

  headline: string;
  bio: string;
  avatarUrl: string;
  skills: string[];
  availability: string;

  robloxProfileUrl: string;
  portfolioUrl: string;
  profileSlug: string;

  isPublished: boolean;

  memberListingLimit: number;
  paidListingCredits: number;

  activatedAt: string | null;
  profileCreatedAt: string | null;
  profileUpdatedAt: string | null;

  publicationRequestedAt: string | null;
  publicationReviewedAt: string | null;
  publicationReviewedByName: string;
  publicationReviewerNote: string;
};

function formatDate(
  value?: string | null
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

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

function getStatusLabel(
  status: ProfileStatus
): string {
  switch (status) {
    case "not_started":
      return "Not Started";
    case "draft":
      return "Draft";
    case "pending_review":
      return "Waiting for Review";
    case "changes_requested":
      return "Changes Requested";
    case "live":
      return "Published";
    case "hidden":
      return "Hidden";
    default:
      return status || "—";
  }
}

function getStatusClass(
  status: ProfileStatus
): string {
  switch (status) {
    case "pending_review":
      return "border-blue-500/30 bg-blue-500/10 text-blue-200";

    case "changes_requested":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";

    case "live":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";

    case "hidden":
      return "border-red-500/30 bg-red-500/10 text-red-200";

    case "draft":
      return "border-zinc-600 bg-zinc-800 text-zinc-300";

    case "not_started":
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}

function getAvailabilityLabel(
  value: string
): string {
  switch (value) {
    case "available":
      return "Available for work";
    case "limited":
      return "Limited availability";
    case "not_available":
      return "Not currently available";
    case "collaborations_only":
      return "Open to collaborations only";
    default:
      return "Not listed";
  }
}

function safeExternalUrl(
  value: string
): string {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

export default function DeveloperAccountsPage() {
  const router = useRouter();
  const { user, authLoading } =
    useAuthUser();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [developers, setDevelopers] =
    useState<DeveloperAccount[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<ProfileStatus | "all">("all");

  const [selectedDeveloper, setSelectedDeveloper] =
    useState<DeveloperAccount | null>(null);

  const [reviewerNote, setReviewerNote] =
    useState("");

  const [processingAction, setProcessingAction] =
    useState<
      "approve" | "request_changes" | "hide" | null
    >(null);

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

    async function loadDevelopers() {
      setLoading(true);
      setPageError("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/admin/membership/developer-profiles",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
          }
        );

        const result = await response
          .json()
          .catch(() => null);

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error ||
              "Could not load developer accounts."
          );
        }

        if (!cancelled) {
          setDevelopers(
            result.developers || []
          );
        }
      } catch (error) {
        console.error(
          "Developer account load error:",
          error
        );

        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load developer accounts."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDevelopers();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const counts = useMemo(() => {
    return {
      total: developers.length,

      pending: developers.filter(
        (developer) =>
          developer.profileStatus ===
          "pending_review"
      ).length,

      published: developers.filter(
        (developer) =>
          developer.profileStatus === "live"
      ).length,

      changesRequested: developers.filter(
        (developer) =>
          developer.profileStatus ===
          "changes_requested"
      ).length,
    };
  }, [developers]);

  const filteredDevelopers = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return developers.filter((developer) => {
      const matchesStatus =
        statusFilter === "all" ||
        developer.profileStatus === statusFilter;

      if (!matchesStatus) return false;
      if (!normalizedSearch) return true;

      return [
        developer.displayName,
        developer.email,
        developer.memberId,
        developer.headline,
        developer.bio,
        developer.skills.join(" "),
        developer.profileStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [
    developers,
    search,
    statusFilter,
  ]);

  function openDeveloper(
    developer: DeveloperAccount
  ) {
    setSelectedDeveloper(developer);

    setReviewerNote(
      developer.publicationReviewerNote || ""
    );
  }

  function closeDeveloper() {
    if (processingAction) return;

    setSelectedDeveloper(null);
    setReviewerNote("");
  }

  async function reviewProfile(
    action:
      | "approve"
      | "request_changes"
      | "hide"
  ) {
    if (
      !user ||
      !selectedDeveloper ||
      processingAction
    ) {
      return;
    }

    if (
      action === "request_changes" &&
      !reviewerNote.trim()
    ) {
      notify.error(
        "Add a reviewer note explaining the requested changes."
      );
      return;
    }

    setProcessingAction(action);

    try {
      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/admin/membership/developer-profiles",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },

          body: JSON.stringify({
            uid: selectedDeveloper.uid,
            memberId:
              selectedDeveloper.memberId,
            action,
            reviewerNote:
              reviewerNote.trim(),
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            "Could not update the developer profile."
        );
      }

      const updatedDeveloper =
        result.developer as DeveloperAccount;

      setDevelopers((current) =>
        current.map((developer) =>
          developer.memberId ===
          updatedDeveloper.memberId
            ? updatedDeveloper
            : developer
        )
      );

      setSelectedDeveloper(
        updatedDeveloper
      );

      setReviewerNote(
        updatedDeveloper
          .publicationReviewerNote || ""
      );

      notify.success(result.message);
    } catch (error) {
      console.error(
        "Developer profile review error:",
        error
      );

      notify.error(
        error instanceof Error
          ? error.message
          : "Could not update the developer profile."
      );
    } finally {
      setProcessingAction(null);
    }
  }

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.email);
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error(
        "Admin sign-out error:",
        error
      );
    }
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <p className="p-8 text-sm text-zinc-400">
          Loading developer accounts...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="membership_developer_accounts"
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() =>
            setSidebarOpen(false)
          }
          onNavigate={(path) =>
            router.push(path)
          }
          onSignOut={handleSignOut}
          displayName={displayName}
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
              style={{ borderRadius: 8 }}
            >
              ☰
            </button>

            <p className="text-2xl font-semibold text-white">
              Developer Accounts
            </p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">
              Developer Accounts
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Review developer membership accounts,
              profile drafts, and publication
              requests.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["Total Developers", counts.total],
              ["Waiting for Review", counts.pending],
              ["Published", counts.published],
              [
                "Changes Requested",
                counts.changesRequested,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="border border-zinc-800 bg-zinc-950/35 p-4"
                style={{ borderRadius: 8 }}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {label}
                </p>

                <p className="mt-3 text-3xl font-semibold text-white">
                  {Number(value).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search developer, email, Member ID, headline, or skill"
              className="min-w-0 flex-1 border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
              style={{ borderRadius: 8 }}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | ProfileStatus
                    | "all"
                )
              }
              className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
              style={{
                borderRadius: 8,
                colorScheme: "dark",
              }}
            >
              <option value="all">
                All profile statuses
              </option>
              <option value="not_started">
                Not Started
              </option>
              <option value="draft">
                Draft
              </option>
              <option value="pending_review">
                Waiting for Review
              </option>
              <option value="changes_requested">
                Changes Requested
              </option>
              <option value="live">
                Published
              </option>
              <option value="hidden">
                Hidden
              </option>
            </select>
          </div>

          {pageError ? (
            <div
              className="mb-5 border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
              style={{ borderRadius: 8 }}
            >
              {pageError}
            </div>
          ) : null}

          <div
            className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
            style={{ borderRadius: 8 }}
          >
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead className="bg-zinc-950/80">
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Developer
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Member ID
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Headline
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Updated
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Profile Status
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
                        Loading developer accounts...
                      </td>
                    </tr>
                  ) : filteredDevelopers.length ===
                    0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-sm text-zinc-400"
                      >
                        No developer accounts match
                        the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredDevelopers.map(
                      (developer) => (
                        <tr
                          key={developer.memberId}
                          className="border-b border-zinc-800/80 last:border-b-0"
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center gap-3">
                              {developer.avatarUrl ? (
                                <img
                                  src={developer.avatarUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-full border border-zinc-700 object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-200">
                                  {(developer.displayName ||
                                    "Developer")
                                    .split(/\s+/)
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((part) =>
                                      part.charAt(0).toUpperCase()
                                    )
                                    .join("")}
                                </div>
                              )}

                              <div className="min-w-0">
                                <p className="font-medium text-white">
                                  {developer.displayName ||
                                    "Unnamed Developer"}
                                </p>

                                <p className="mt-1 text-xs text-zinc-500">
                                  {developer.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-300">
                            {developer.memberId}
                          </td>

                          <td className="max-w-[300px] px-4 py-4 align-top text-sm leading-6 text-zinc-300">
                            {developer.headline ||
                              "—"}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-300">
                            {formatDate(
                              developer.profileUpdatedAt ||
                              developer.activatedAt
                            )}
                          </td>

                          <td className="px-4 py-4 align-top">
                            <span
                              className={`inline-flex border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                developer.profileStatus
                              )}`}
                              style={{
                                borderRadius: 999,
                              }}
                            >
                              {getStatusLabel(
                                developer.profileStatus
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right align-top">
                            <button
                              type="button"
                              onClick={() =>
                                openDeveloper(
                                  developer
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
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-800 lg:hidden">
              {loading ? (
                <div className="p-5 text-sm text-zinc-400">
                  Loading developer accounts...
                </div>
              ) : filteredDevelopers.length ===
                0 ? (
                <div className="p-5 text-sm text-zinc-400">
                  No developer accounts match
                  the current filters.
                </div>
              ) : (
                filteredDevelopers.map(
                  (developer) => (
                    <button
                      key={developer.memberId}
                      type="button"
                      onClick={() =>
                        openDeveloper(developer)
                      }
                      className="block w-full cursor-pointer p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {developer.avatarUrl ? (
                            <img
                              src={developer.avatarUrl}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-full border border-zinc-700 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-200">
                              {(developer.displayName ||
                                "Developer")
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) =>
                                  part.charAt(0).toUpperCase()
                                )
                                .join("")}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {developer.displayName ||
                                "Unnamed Developer"}
                            </p>

                            <p className="mt-1 truncate text-sm text-zinc-400">
                              {developer.email}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 border px-2.5 py-1 text-xs ${getStatusClass(
                            developer.profileStatus
                          )}`}
                          style={{
                            borderRadius: 999,
                          }}
                        >
                          {getStatusLabel(
                            developer.profileStatus
                          )}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-zinc-300">
                        {developer.headline || "—"}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        {developer.memberId}
                      </p>
                    </button>
                  )
                )
              )}
            </div>
          </div>
        </section>
      </div>

      {selectedDeveloper ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/70"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeDeveloper();
            }
          }}
        >
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                {selectedDeveloper.avatarUrl ? (
                  <img
                    src={selectedDeveloper.avatarUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border border-zinc-700 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-200">
                    {(selectedDeveloper.displayName ||
                      "Developer")
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) =>
                        part.charAt(0).toUpperCase()
                      )
                      .join("")}
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Developer Profile
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {selectedDeveloper.displayName}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedDeveloper.memberId}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDeveloper}
                disabled={Boolean(
                  processingAction
                )}
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
                    selectedDeveloper.profileStatus
                  )}`}
                  style={{
                    borderRadius: 999,
                  }}
                >
                  {getStatusLabel(
                    selectedDeveloper.profileStatus
                  )}
                </span>

                <span className="text-sm text-zinc-500">
                  {getAvailabilityLabel(
                    selectedDeveloper.availability
                  )}
                </span>
              </div>

              <div className="space-y-6">
                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{ borderRadius: 8 }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Account
                  </h3>

                  <div className="mt-4 space-y-3 text-sm">
                    <p>
                      <span className="text-zinc-500">
                        Email —
                      </span>{" "}
                      {selectedDeveloper.email}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Account status —
                      </span>{" "}
                      {selectedDeveloper.accountStatus ||
                        "—"}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Activated —
                      </span>{" "}
                      {formatDate(
                        selectedDeveloper.activatedAt
                      )}
                    </p>
                  </div>
                </section>

                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{ borderRadius: 8 }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Profile Introduction
                  </h3>

                  <p className="mt-4 text-lg font-semibold text-white">
                    {selectedDeveloper.headline ||
                      "No headline"}
                  </p>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {selectedDeveloper.bio ||
                      "No biography has been added."}
                  </p>
                </section>

                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{ borderRadius: 8 }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Skills
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedDeveloper.skills.length >
                    0 ? (
                      selectedDeveloper.skills.map(
                        (skill) => (
                          <span
                            key={skill}
                            className="border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
                            style={{
                              borderRadius: 999,
                            }}
                          >
                            {skill}
                          </span>
                        )
                      )
                    ) : (
                      <p className="text-sm text-zinc-500">
                        No skills added.
                      </p>
                    )}
                  </div>
                </section>

                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{ borderRadius: 8 }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Links
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {safeExternalUrl(
                      selectedDeveloper
                        .robloxProfileUrl
                    ) ? (
                      <a
                        href={
                          selectedDeveloper
                            .robloxProfileUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-200"
                        style={{
                          borderRadius: 6,
                        }}
                      >
                        Roblox Profile
                      </a>
                    ) : null}

                    {safeExternalUrl(
                      selectedDeveloper.portfolioUrl
                    ) ? (
                      <a
                        href={
                          selectedDeveloper
                            .portfolioUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200"
                        style={{
                          borderRadius: 6,
                        }}
                      >
                        Portfolio or Website
                      </a>
                    ) : null}
                  </div>
                </section>

                {selectedDeveloper
                  .publicationRequestedAt ? (
                  <section
                    className="border border-zinc-800 bg-zinc-950/35 p-5"
                    style={{ borderRadius: 8 }}
                  >
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      Publication Review
                    </h3>

                    <p className="mt-4 text-sm text-zinc-300">
                      Requested{" "}
                      {formatDate(
                        selectedDeveloper
                          .publicationRequestedAt
                      )}
                    </p>

                    {selectedDeveloper
                      .publicationReviewedAt ? (
                      <p className="mt-2 text-sm text-zinc-400">
                        Last reviewed{" "}
                        {formatDate(
                          selectedDeveloper
                            .publicationReviewedAt
                        )}
                        {selectedDeveloper
                          .publicationReviewedByName
                          ? ` by ${selectedDeveloper.publicationReviewedByName}`
                          : ""}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <section>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Reviewer Note
                  </label>

                  <textarea
                    value={reviewerNote}
                    onChange={(event) =>
                      setReviewerNote(
                        event.target.value
                      )
                    }
                    rows={6}
                    maxLength={3000}
                    placeholder="Required when requesting changes. Optional for approval or hiding."
                    className="w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                    style={{ borderRadius: 8 }}
                  />
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                {selectedDeveloper.profileStatus ===
                "live" ? (
                  <button
                    type="button"
                    onClick={() =>
                      reviewProfile("hide")
                    }
                    disabled={Boolean(
                      processingAction
                    )}
                    className="w-full cursor-pointer border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50 sm:w-auto"
                    style={{ borderRadius: 7 }}
                  >
                    {processingAction === "hide"
                      ? "Hiding..."
                      : "Hide Profile"}
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeDeveloper}
                  disabled={Boolean(
                    processingAction
                  )}
                  className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                  style={{ borderRadius: 7 }}
                >
                  Close
                </button>

                {selectedDeveloper.profileStatus ===
                "pending_review" ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        reviewProfile(
                          "request_changes"
                        )
                      }
                      disabled={Boolean(
                        processingAction
                      )}
                      className="cursor-pointer border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 disabled:opacity-50"
                      style={{
                        borderRadius: 7,
                      }}
                    >
                      {processingAction ===
                      "request_changes"
                        ? "Sending..."
                        : "Request Changes"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        reviewProfile("approve")
                      }
                      disabled={Boolean(
                        processingAction
                      )}
                      className="cursor-pointer bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      style={{
                        borderRadius: 7,
                      }}
                    >
                      {processingAction ===
                      "approve"
                        ? "Publishing..."
                        : "Approve and Publish"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}