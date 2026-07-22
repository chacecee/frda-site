"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { useAuthUser } from "@/lib/useAuthUser";
import MemberPortalHeader from "@/components/member/MemberPortalHeader";

type SentRequest = {
  requestId: string;
  status: string;
  inquiryType: string;
  opportunityTitle: string;
  organizationName: string;
  developerDisplayName: string;
  developerAvatarUrl: string;
  developerSlug: string;
  message: string;
  relevantUrl: string;
  adminReviewNote: string;
  developerResponseNote: string;
  createdAt: string | null;
  updatedAt: string | null;
  respondedAt: string | null;
};

function formatDate(
  value: string | null,
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "long",
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
  value: string,
): string {
  switch (value) {
    case "pending_frda_review":
      return "Awaiting FRDA Review";
    case "held":
      return "On Hold";
    case "pending_developer_response":
      return "Sent to Developer";
    case "connected":
      return "Connected";
    case "declined":
      return "Declined";
    case "rejected":
      return "Rejected";
    case "reported":
      return "Under FRDA Review";
    case "closed":
      return "Closed";
    default:
      return value || "Unknown";
  }
}

function getStatusClass(
  value: string,
): string {
  switch (value) {
    case "connected":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    case "pending_developer_response":
      return "border-sky-500/25 bg-sky-500/10 text-sky-200";
    case "pending_frda_review":
      return "border-blue-500/25 bg-blue-500/10 text-blue-200";
    case "held":
      return "border-amber-500/25 bg-amber-500/10 text-amber-200";
    case "declined":
    case "closed":
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
    case "rejected":
    case "reported":
      return "border-red-500/25 bg-red-500/10 text-red-200";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
}

function getInquiryLabel(
  value: string,
): string {
  switch (value) {
    case "paid_project":
      return "Paid Project";
    case "employment":
      return "Employment";
    case "collaboration":
      return "Collaboration";
    case "publishing":
      return "Publishing or Partnership";
    default:
      return "Other";
  }
}

export default function SentRequestsPage() {
  const router = useRouter();
  const { user, authLoading } =
    useAuthUser();

  const [requests, setRequests] =
    useState<SentRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedRequest, setSelectedRequest] =
    useState<SentRequest | null>(
      null,
    );

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
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadRequests() {
      setLoading(true);
      setPageError("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/member/sent-requests",
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
              "Could not load your sent requests.",
          );
        }

        if (!cancelled) {
          setRequests(
            result.requests || [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load your sent requests.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRequests();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredRequests =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase();

      return requests.filter(
        (request) => {
          if (
            statusFilter !== "all" &&
            request.status !==
              statusFilter
          ) {
            return false;
          }

          if (!normalized) {
            return true;
          }

          return [
            request.opportunityTitle,
            request.developerDisplayName,
            request.organizationName,
            request.message,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized);
        },
      );
    }, [
      requests,
      search,
      statusFilter,
    ]);

  if (
    authLoading ||
    !user
  ) {
    return (
      <main className="min-h-screen bg-[#071225] p-8 text-sm text-zinc-400">
        Loading sent requests...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071225] text-white">
      <MemberPortalHeader
        active="sent_requests"
        title="FRDA Member Portal"
        subtitle="Sent Requests"
        accountPurpose="talent_seeker"
      />

      <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div>
          <h1 className="text-3xl font-semibold">
            Sent Requests
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Track inquiries you submitted through the FRDA developer directory.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search developer, project, organization, or message"
            className="min-w-0 flex-1 border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
            style={{ borderRadius: 8 }}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            className="border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-sky-400"
            style={{
              borderRadius: 8,
              colorScheme: "dark",
            }}
          >
            <option value="all">
              All statuses
            </option>
            <option value="pending_frda_review">
              Awaiting FRDA Review
            </option>
            <option value="held">
              On Hold
            </option>
            <option value="pending_developer_response">
              Sent to Developer
            </option>
            <option value="connected">
              Connected
            </option>
            <option value="declined">
              Declined
            </option>
            <option value="rejected">
              Rejected
            </option>
            <option value="reported">
              Under FRDA Review
            </option>
            <option value="closed">
              Closed
            </option>
          </select>
        </div>

        {pageError ? (
          <div
            className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
            style={{ borderRadius: 8 }}
          >
            {pageError}
          </div>
        ) : null}

        <div
          className="mt-5 overflow-hidden border border-white/10 bg-white/[0.025]"
          style={{ borderRadius: 8 }}
        >
          {loading ? (
            <div className="p-6 text-sm text-zinc-400">
              Loading sent requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-sm text-zinc-400">
              No sent requests match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredRequests.map(
                (request) => (
                  <button
                    key={request.requestId}
                    type="button"
                    onClick={() =>
                      setSelectedRequest(
                        request,
                      )
                    }
                    className="block w-full cursor-pointer p-5 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        {request.developerAvatarUrl ? (
                          <img
                            src={request.developerAvatarUrl}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-200">
                            {request.developerDisplayName
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) =>
                                part.charAt(0).toUpperCase()
                              )
                              .join("") || "FD"}
                          </div>
                        )}

                        <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-white">
                            {request.opportunityTitle}
                          </h2>

                          <span
                            className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300"
                            style={{ borderRadius: 999 }}
                          >
                            {getInquiryLabel(
                              request.inquiryType,
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-zinc-300">
                          Sent to{" "}
                          {request.developerDisplayName}
                        </p>

                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                          {request.message}
                        </p>

                        <p className="mt-3 text-xs text-zinc-600">
                          {formatDate(
                            request.createdAt,
                          )}
                        </p>
                        </div>
                      </div>

                      <span
                        className={`w-fit shrink-0 border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                          request.status,
                        )}`}
                        style={{ borderRadius: 999 }}
                      >
                        {getStatusLabel(
                          request.status,
                        )}
                      </span>
                    </div>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      {selectedRequest ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedRequest(null);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-white/10 bg-[#081426] shadow-2xl"
            style={{ borderRadius: 10 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-sky-300">
                  Sent Connection Request
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  {selectedRequest.opportunityTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRequest(null)
                }
                className="cursor-pointer text-2xl text-zinc-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                    selectedRequest.status,
                  )}`}
                  style={{ borderRadius: 999 }}
                >
                  {getStatusLabel(
                    selectedRequest.status,
                  )}
                </span>

                <span
                  className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300"
                  style={{ borderRadius: 999 }}
                >
                  {getInquiryLabel(
                    selectedRequest.inquiryType,
                  )}
                </span>
              </div>

              <div className="mt-6 flex items-center gap-4">
                {selectedRequest.developerAvatarUrl ? (
                  <img
                    src={selectedRequest.developerAvatarUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-200">
                    {selectedRequest.developerDisplayName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) =>
                        part.charAt(0).toUpperCase()
                      )
                      .join("") || "FD"}
                  </div>
                )}

                <div>
                  <p className="font-semibold">
                    {selectedRequest.developerDisplayName}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Developer
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-zinc-600">
                Sent{" "}
                {formatDate(
                  selectedRequest.createdAt,
                )}
              </p>

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                  {selectedRequest.message}
                </p>
              </div>

              {selectedRequest.adminReviewNote ? (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    FRDA Review Note
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {selectedRequest.adminReviewNote}
                  </p>
                </div>
              ) : null}

              {selectedRequest.developerResponseNote ? (
                <div className="mt-6 border-t border-white/10 pt-6">
                  <div className="flex items-start gap-4">
                    {selectedRequest.developerAvatarUrl ? (
                      <img
                        src={selectedRequest.developerAvatarUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">
                        {selectedRequest.developerDisplayName
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) =>
                            part.charAt(0).toUpperCase()
                          )
                          .join("") || "FD"}
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Developer Response
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                        {selectedRequest.developerResponseNote}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end border-t border-white/10 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setSelectedRequest(null)
                }
                className="cursor-pointer text-sm font-medium text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}