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
import MemberPortalHeader from "@/components/member/MemberPortalHeader";
import { notify } from "@/components/ToastConfig";

type ConnectionRequest = {
  requestId: string;
  status:
    | "pending_developer_response"
    | "connected"
    | "declined"
    | "reported"
    | "closed";

  inquiryType: string;
  opportunityTitle: string;
  organizationName: string;
  requesterDisplayName: string;
  requesterAvatarUrl: string;
  requesterContactEmail: string;
  requesterRole: string;
  message: string;
  relevantUrl: string;
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

function getStatusLabel(
  value: ConnectionRequest["status"],
): string {
  switch (value) {
    case "connected":
      return "Connected";

    case "declined":
      return "Declined";

    case "reported":
      return "Reported";

    case "closed":
      return "Closed";

    default:
      return "Awaiting Your Response";
  }
}

function getStatusClass(
  value: ConnectionRequest["status"],
): string {
  switch (value) {
    case "connected":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";

    case "declined":
      return "border-zinc-600 bg-zinc-800 text-zinc-300";

    case "reported":
      return "border-red-500/25 bg-red-500/10 text-red-200";

    case "closed":
      return "border-zinc-700 bg-zinc-900 text-zinc-500";

    default:
      return "border-blue-500/25 bg-blue-500/10 text-blue-200";
  }
}

export default function MemberConnectionRequestsPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [requests, setRequests] =
    useState<ConnectionRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<
      ConnectionRequest["status"] |
      "all"
    >("all");

  const [
    selectedRequest,
    setSelectedRequest,
  ] =
    useState<ConnectionRequest | null>(
      null,
    );

  const [responseNote, setResponseNote] =
    useState("");

  const [
    processingAction,
    setProcessingAction,
  ] = useState<
    "connect" |
    "decline" |
    "report" |
    null
  >(null);

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
          "/api/member/connection-requests",
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
            "Could not load your connection requests.",
          );
        }

        if (!cancelled) {
          setRequests(
            result.requests ||
            [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load your connection requests.",
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
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return requests.filter(
        (request) => {
          const matchesStatus =
            statusFilter === "all" ||
            request.status ===
              statusFilter;

          if (!matchesStatus) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return [
            request.opportunityTitle,
            request.organizationName,
            request.requesterDisplayName,
            request.requesterRole,
            request.message,
          ]
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch,
            );
        },
      );
    }, [
      requests,
      search,
      statusFilter,
    ]);

  function openRequest(
    request: ConnectionRequest,
  ) {
    setSelectedRequest(request);
    setResponseNote(
      request.developerResponseNote ||
      "",
    );
  }

  function closeRequest() {
    if (processingAction) {
      return;
    }

    setSelectedRequest(null);
    setResponseNote("");
  }

  async function respond(
    action:
      | "connect"
      | "decline"
      | "report",
  ) {
    if (
      !user ||
      !selectedRequest ||
      processingAction
    ) {
      return;
    }

    if (
      action === "report" &&
      !responseNote.trim()
    ) {
      notify.error(
        "Add a note explaining the concern.",
      );
      return;
    }

    setProcessingAction(action);

    try {
      const idToken =
        await user.getIdToken();

      const response = await fetch(
        `/api/member/connection-requests/${selectedRequest.requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            action,
            responseNote:
              responseNote.trim(),
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
          "Could not update this connection request.",
        );
      }

      const updated: ConnectionRequest = {
        ...selectedRequest,
        status: result.status,
        developerResponseNote:
          responseNote.trim(),
        respondedAt:
          new Date().toISOString(),
      };

      setRequests((current) =>
        current.map((request) =>
          request.requestId ===
          updated.requestId
            ? updated
            : request,
        ),
      );

      notify.success(
        result.message,
      );

      setSelectedRequest(null);
      setResponseNote("");
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not update this connection request.",
      );
    } finally {
      setProcessingAction(null);
    }
  }


  if (
    authLoading ||
    !user
  ) {
    return (
      <main className="min-h-screen bg-[#071225] p-8 text-sm text-zinc-400">
        Loading connection requests...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071225] text-white">
      <MemberPortalHeader
        active="connection_requests"
        title="FRDA Member Portal"
        subtitle="Connection Requests"
        accountPurpose="developer"
      />

      <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div>
          <h1 className="text-3xl font-semibold">
            Connection Requests
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Review inquiries sent through your public developer profile.
            Requester contact details remain private until you choose Connect.
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
            placeholder="Search opportunity, requester, organization, or message"
            className="min-w-0 flex-1 border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
            style={{ borderRadius: 8 }}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | ConnectionRequest["status"]
                  | "all",
              )
            }
            className="border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-400"
            style={{
              borderRadius: 8,
              colorScheme: "dark",
            }}
          >
            <option value="all">
              All statuses
            </option>

            <option value="pending_developer_response">
              Awaiting Your Response
            </option>

            <option value="connected">
              Connected
            </option>

            <option value="declined">
              Declined
            </option>

            <option value="reported">
              Reported
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
              Loading connection requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-sm text-zinc-400">
              No connection requests match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredRequests.map(
                (request) => (
                  <button
                    key={request.requestId}
                    type="button"
                    onClick={() =>
                      openRequest(request)
                    }
                    className="block w-full cursor-pointer p-5 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        {request.requesterAvatarUrl ? (
                          <img
                            src={request.requesterAvatarUrl}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">
                            {request.requesterDisplayName
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) =>
                                part.charAt(0).toUpperCase(),
                              )
                              .join("") || "TS"}
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
                          {request.requesterDisplayName}
                          {request.organizationName
                            ? ` · ${request.organizationName}`
                            : ""}
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
              closeRequest();
            }
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-white/10 bg-[#081426] shadow-2xl"
            style={{ borderRadius: 10 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-300">
                  Connection Request
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  {selectedRequest.opportunityTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeRequest}
                disabled={Boolean(
                  processingAction,
                )}
                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
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
                  {getStatusLabel(selectedRequest.status)}
                </span>

                <span
                  className="border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300"
                  style={{ borderRadius: 999 }}
                >
                  {getInquiryLabel(selectedRequest.inquiryType)}
                </span>
              </div>

              <div className="mt-6 flex items-center gap-4">
                {selectedRequest.requesterAvatarUrl ? (
                  <img
                    src={selectedRequest.requesterAvatarUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-sky-200">
                    {selectedRequest.requesterDisplayName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) =>
                        part.charAt(0).toUpperCase()
                      )
                      .join("") || "TS"}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {selectedRequest.requesterDisplayName}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedRequest.organizationName ||
                      "No organization submitted"}
                  </p>

                  <p className="mt-0.5 text-xs text-zinc-500">
                    {selectedRequest.requesterRole ||
                      "No role submitted"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-zinc-600">
                Sent {formatDate(selectedRequest.createdAt)}
              </p>

              {selectedRequest.status === "connected" &&
              selectedRequest.requesterContactEmail ? (
                <div className="mt-5 bg-emerald-500/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    Contact Email
                  </p>

                  <a
                    href={`mailto:${selectedRequest.requesterContactEmail}`}
                    className="mt-2 block break-all text-sm font-medium text-emerald-100 underline"
                  >
                    {selectedRequest.requesterContactEmail}
                  </a>
                </div>
              ) : null}

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                  {selectedRequest.message}
                </p>
              </div>

              {selectedRequest.relevantUrl ? (
                <a
                  href={selectedRequest.relevantUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex text-sm font-medium text-sky-300 hover:text-sky-200"
                >
                  Open Relevant Link
                </a>
              ) : null}

              {selectedRequest.status === "pending_developer_response" ? (
                <div className="mt-7 border-t border-white/10 pt-6">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Optional Response Note
                  </label>

                  <textarea
                    value={responseNote}
                    onChange={(event) =>
                      setResponseNote(event.target.value)
                    }
                    rows={4}
                    maxLength={2000}
                    placeholder="A note is required only when reporting a concern."
                    className="w-full resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
                    style={{ borderRadius: 8 }}
                  />
                </div>
              ) : selectedRequest.developerResponseNote ? (
                <div className="mt-7 border-t border-white/10 pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-200">
                      You
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Your Response
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                        {selectedRequest.developerResponseNote}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {selectedRequest.status === "pending_developer_response" ? (
                  <button
                    type="button"
                    onClick={() =>
                      respond("report")
                    }
                    disabled={Boolean(
                      processingAction,
                    )}
                    className="w-full cursor-pointer border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50 sm:w-auto"
                    style={{ borderRadius: 6 }}
                  >
                    {processingAction === "report"
                      ? "Reporting..."
                      : "Report Concern"}
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeRequest}
                  disabled={Boolean(
                    processingAction,
                  )}
                  className="cursor-pointer border border-white/15 bg-transparent px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                  style={{ borderRadius: 6 }}
                >
                  Close
                </button>

                {selectedRequest.status === "pending_developer_response" ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        respond("decline")
                      }
                      disabled={Boolean(
                        processingAction,
                      )}
                      className="cursor-pointer border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 disabled:opacity-50"
                      style={{ borderRadius: 6 }}
                    >
                      {processingAction === "decline"
                        ? "Declining..."
                        : "Decline"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        respond("connect")
                      }
                      disabled={Boolean(
                        processingAction,
                      )}
                      className="cursor-pointer bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      style={{ borderRadius: 6 }}
                    >
                      {processingAction === "connect"
                        ? "Connecting..."
                        : "Connect"}
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