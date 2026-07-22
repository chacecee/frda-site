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

import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { notify } from "@/components/ToastConfig";

type VerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

type TalentSeekerAccount = {
  memberId: string;
  uid: string;
  email: string;
  displayName: string;
  accountPurpose: string;
  accountStatus: string;
  memberStatus: string;
  talentSeekerStatus:
    VerificationStatus;
  reviewerNote: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string;
  activatedAt: string | null;

  profile: {
    avatarUrl: string;
    entityType: string;
    organizationName: string;
    role: string;
    talentNeeds: string;
    websiteUrl: string;
    reasonForJoining: string;
    contactEmail: string;
  };
};

function formatDate(
  value?: string | null,
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
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
      timeZone: "Asia/Manila",
    },
  ).format(date);
}

function getStatusLabel(
  value: VerificationStatus,
): string {
  switch (value) {
    case "not_submitted":
      return "Not Submitted";

    case "pending":
      return "Waiting for Review";

    case "verified":
      return "Verified";

    case "rejected":
      return "Changes Required";

    case "suspended":
      return "Suspended";

    default:
      return value;
  }
}

function getStatusClass(
  value: VerificationStatus,
): string {
  switch (value) {
    case "pending":
      return "border-blue-500/30 bg-blue-500/10 text-blue-200";

    case "verified":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";

    case "rejected":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";

    case "suspended":
      return "border-red-500/30 bg-red-500/10 text-red-200";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}

function safeExternalUrl(
  value: string,
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

export default function TalentSeekerAccountsPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [accounts, setAccounts] =
    useState<TalentSeekerAccount[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<
      VerificationStatus | "all"
    >("all");

  const [
    selectedAccount,
    setSelectedAccount,
  ] =
    useState<TalentSeekerAccount | null>(
      null,
    );

  const [reviewerNote, setReviewerNote] =
    useState("");

  const [
    processingAction,
    setProcessingAction,
  ] =
    useState<
      | "verify"
      | "request_changes"
      | "reject"
      | "suspend"
      | null
    >(null);

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
      router.replace("/admin/login");
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadAccounts() {
      setLoading(true);
      setPageError("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/admin/membership/talent-seekers",
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
            "Could not load talent-seeker accounts.",
          );
        }

        if (!cancelled) {
          setAccounts(
            result.talentSeekers ||
              [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load talent-seeker accounts.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const counts = useMemo(() => {
    return {
      total:
        accounts.length,

      pending:
        accounts.filter(
          (account) =>
            account
              .talentSeekerStatus ===
            "pending",
        ).length,

      verified:
        accounts.filter(
          (account) =>
            account
              .talentSeekerStatus ===
            "verified",
        ).length,

      changes:
        accounts.filter(
          (account) =>
            account
              .talentSeekerStatus ===
            "rejected",
        ).length,
    };
  }, [accounts]);

  const filteredAccounts =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return accounts.filter(
        (account) => {
          const matchesStatus =
            statusFilter === "all" ||
            account
              .talentSeekerStatus ===
              statusFilter;

          if (!matchesStatus) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            account.displayName,
            account.email,
            account.memberId,
            account.profile
              .organizationName,
            account.profile.role,
            account.profile
              .talentNeeds,
          ]
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch,
            );
        },
      );
    }, [
      accounts,
      search,
      statusFilter,
    ]);

  function openAccount(
    account: TalentSeekerAccount,
  ) {
    setSelectedAccount(account);
    setReviewerNote(
      account.reviewerNote || "",
    );
  }

  function closeAccount() {
    if (processingAction) {
      return;
    }

    setSelectedAccount(null);
    setReviewerNote("");
  }

  async function reviewAccount(
    action:
      | "verify"
      | "request_changes"
      | "reject"
      | "suspend",
  ) {
    if (
      !user ||
      !selectedAccount ||
      processingAction
    ) {
      return;
    }

    if (
      (
        action ===
          "request_changes" ||
        action === "reject" ||
        action === "suspend"
      ) &&
      !reviewerNote.trim()
    ) {
      notify.error(
        "Add a reviewer note for this action.",
      );
      return;
    }

    setProcessingAction(action);

    try {
      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/admin/membership/talent-seekers",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            memberId:
              selectedAccount.memberId,
            action,
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
          "Could not update this talent-seeker account.",
        );
      }

      const updated =
        result.talentSeeker as
          TalentSeekerAccount;

      setAccounts((current) =>
        current.map((account) =>
          account.memberId ===
          updated.memberId
            ? updated
            : account,
        ),
      );

      setSelectedAccount(updated);
      setReviewerNote(
        updated.reviewerNote ||
          "",
      );

      notify.success(
        result.message,
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not update this talent-seeker account.",
      );
    } finally {
      setProcessingAction(null);
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
          Loading talent-seeker accounts...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="membership_talent_seeker_accounts"
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
              style={{
                borderRadius: 8,
              }}
            >
              ☰
            </button>

            <p className="text-2xl font-semibold text-white">
              Talent Seeker Accounts
            </p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">
              Talent Seeker Accounts
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Review accounts requesting
              permission to contact developers
              through the FRDA directory.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              [
                "Total Talent Seekers",
                counts.total,
              ],
              [
                "Waiting for Review",
                counts.pending,
              ],
              [
                "Verified",
                counts.verified,
              ],
              [
                "Changes Required",
                counts.changes,
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={String(label)}
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

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search name, organization, email, Member ID, role, or talent needs"
              className="min-w-0 flex-1 border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
              style={{
                borderRadius: 8,
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | VerificationStatus
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
                All verification statuses
              </option>

              <option value="not_submitted">
                Not Submitted
              </option>

              <option value="pending">
                Waiting for Review
              </option>

              <option value="verified">
                Verified
              </option>

              <option value="rejected">
                Changes Required
              </option>

              <option value="suspended">
                Suspended
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
              <table className="w-full min-w-[1050px] border-collapse">
                <thead className="bg-zinc-950/80">
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Talent Seeker
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Organization
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Role
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Submitted
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
                        Loading talent-seeker accounts...
                      </td>
                    </tr>
                  ) : filteredAccounts.length ===
                    0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-sm text-zinc-400"
                      >
                        No talent-seeker accounts match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map(
                      (account) => (
                        <tr
                          key={
                            account.memberId
                          }
                          className="border-b border-zinc-800/80 last:border-b-0"
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center gap-3">
                              {account.profile.avatarUrl ? (
                                <img
                                  src={account.profile.avatarUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-full border border-zinc-700 object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-200">
                                  {(account.displayName ||
                                    "Member")
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
                                  {account.displayName ||
                                    "Unnamed Member"}
                                </p>

                                <p className="mt-1 text-xs text-zinc-500">
                                  {account.email}
                                </p>

                                <p className="mt-1 text-xs text-zinc-600">
                                  {account.memberId}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-300">
                            {account.profile
                              .organizationName ||
                              (
                                account.profile
                                  .entityType ===
                                "individual"
                                  ? "Individual"
                                  : "—"
                              )}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-300">
                            {account.profile.role ||
                              "—"}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-300">
                            {formatDate(
                              account.submittedAt,
                            )}
                          </td>

                          <td className="px-4 py-4 align-top">
                            <span
                              className={`inline-flex border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                account.talentSeekerStatus,
                              )}`}
                              style={{
                                borderRadius: 999,
                              }}
                            >
                              {getStatusLabel(
                                account.talentSeekerStatus,
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right align-top">
                            <button
                              type="button"
                              onClick={() =>
                                openAccount(
                                  account,
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
                  Loading talent-seeker accounts...
                </div>
              ) : filteredAccounts.length ===
                0 ? (
                <div className="p-5 text-sm text-zinc-400">
                  No talent-seeker accounts match the current filters.
                </div>
              ) : (
                filteredAccounts.map(
                  (account) => (
                    <button
                      key={
                        account.memberId
                      }
                      type="button"
                      onClick={() =>
                        openAccount(
                          account,
                        )
                      }
                      className="block w-full cursor-pointer p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {account.profile.avatarUrl ? (
                            <img
                              src={account.profile.avatarUrl}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-full border border-zinc-700 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-200">
                              {(account.displayName ||
                                "Member")
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
                              {account.displayName ||
                                "Unnamed Member"}
                            </p>

                            <p className="mt-1 truncate text-sm text-zinc-400">
                              {account.profile
                                .organizationName ||
                                account.email}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 border px-2.5 py-1 text-xs ${getStatusClass(
                            account.talentSeekerStatus,
                          )}`}
                          style={{
                            borderRadius: 999,
                          }}
                        >
                          {getStatusLabel(
                            account.talentSeekerStatus,
                          )}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-zinc-300">
                        {account.profile.role ||
                          "No role submitted"}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        {account.memberId}
                      </p>
                    </button>
                  ),
                )
              )}
            </div>
          </div>
        </section>
      </div>

      {selectedAccount ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/70"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAccount();
            }
          }}
        >
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                {selectedAccount.profile.avatarUrl ? (
                  <img
                    src={selectedAccount.profile.avatarUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border border-zinc-700 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sm font-semibold text-sky-200">
                    {(selectedAccount.displayName ||
                      "Member")
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
                    Talent-Seeker Verification
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {selectedAccount.displayName}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedAccount.memberId}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeAccount}
                disabled={Boolean(
                  processingAction,
                )}
                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-6">
                <span
                  className={`inline-flex border px-3 py-1.5 text-xs font-medium ${getStatusClass(
                    selectedAccount.talentSeekerStatus,
                  )}`}
                  style={{
                    borderRadius: 999,
                  }}
                >
                  {getStatusLabel(
                    selectedAccount.talentSeekerStatus,
                  )}
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
                    Account
                  </h3>

                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <p>
                      <span className="text-zinc-500">
                        Login email —
                      </span>{" "}
                      {selectedAccount.email}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Contact email —
                      </span>{" "}
                      {selectedAccount.profile
                        .contactEmail ||
                        "—"}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Account purpose —
                      </span>{" "}
                      {selectedAccount.accountPurpose ===
                      "both"
                        ? "Developer and Talent Seeker"
                        : "Talent Seeker"}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Activated —
                      </span>{" "}
                      {formatDate(
                        selectedAccount.activatedAt,
                      )}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Submitted —
                      </span>{" "}
                      {formatDate(
                        selectedAccount.submittedAt,
                      )}
                    </p>
                  </div>
                </section>

                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Identity and Organization
                  </h3>

                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <p>
                      <span className="text-zinc-500">
                        Type —
                      </span>{" "}
                      {selectedAccount.profile
                        .entityType ||
                        "—"}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Organization —
                      </span>{" "}
                      {selectedAccount.profile
                        .organizationName ||
                        "—"}
                    </p>

                    <p>
                      <span className="text-zinc-500">
                        Role —
                      </span>{" "}
                      {selectedAccount.profile.role ||
                        "—"}
                    </p>

                    {safeExternalUrl(
                      selectedAccount.profile
                        .websiteUrl,
                    ) ? (
                      <a
                        href={
                          selectedAccount.profile
                            .websiteUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-200"
                        style={{
                          borderRadius: 6,
                        }}
                      >
                        Open Website
                      </a>
                    ) : null}
                  </div>
                </section>

                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Talent Needs
                  </h3>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {selectedAccount.profile
                      .talentNeeds ||
                      "No talent needs were submitted."}
                  </p>
                </section>

                <section
                  className="border border-zinc-800 bg-zinc-950/35 p-5"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Reason for Joining
                  </h3>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {selectedAccount.profile
                      .reasonForJoining ||
                      "No reason was submitted."}
                  </p>
                </section>

                <section>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Reviewer Note
                  </label>

                  <textarea
                    value={reviewerNote}
                    onChange={(event) =>
                      setReviewerNote(
                        event.target.value,
                      )
                    }
                    rows={6}
                    maxLength={3000}
                    placeholder="Required when requesting changes, rejecting, or suspending access."
                    className="w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                    style={{
                      borderRadius: 8,
                    }}
                  />
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                {selectedAccount.talentSeekerStatus ===
                "verified" ? (
                  <button
                    type="button"
                    onClick={() =>
                      reviewAccount(
                        "suspend",
                      )
                    }
                    disabled={Boolean(
                      processingAction,
                    )}
                    className="w-full cursor-pointer border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50 sm:w-auto"
                    style={{
                      borderRadius: 7,
                    }}
                  >
                    {processingAction ===
                    "suspend"
                      ? "Suspending..."
                      : "Suspend Access"}
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeAccount}
                  disabled={Boolean(
                    processingAction,
                  )}
                  className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                  style={{
                    borderRadius: 7,
                  }}
                >
                  Close
                </button>

                {selectedAccount.talentSeekerStatus ===
                "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        reviewAccount(
                          "request_changes",
                        )
                      }
                      disabled={Boolean(
                        processingAction,
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
                        reviewAccount(
                          "reject",
                        )
                      }
                      disabled={Boolean(
                        processingAction,
                      )}
                      className="cursor-pointer border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50"
                      style={{
                        borderRadius: 7,
                      }}
                    >
                      {processingAction ===
                      "reject"
                        ? "Rejecting..."
                        : "Reject"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        reviewAccount(
                          "verify",
                        )
                      }
                      disabled={Boolean(
                        processingAction,
                      )}
                      className="cursor-pointer bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      style={{
                        borderRadius: 7,
                      }}
                    >
                      {processingAction ===
                      "verify"
                        ? "Verifying..."
                        : "Verify Account"}
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