"use client";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { notify } from "@/components/ToastConfig";

type RequestStatus =
    | "pending_frda_review"
    | "held"
    | "pending_developer_response"
    | "connected"
    | "declined"
    | "rejected"
    | "reported"
    | "closed";

type ConnectionRequest = {
    requestId: string;
    status: RequestStatus;
    inquiryType: string;
    opportunityTitle: string;
    organizationName: string;
    message: string;
    relevantUrl: string;
    requesterMemberId: string;
    requesterDisplayName: string;
    requesterAvatarUrl: string;
    requesterContactEmail: string;
    requesterOrganizationName: string;
    requesterRole: string;
    developerMemberId: string;
    developerDisplayName: string;
    developerAvatarUrl: string;
    developerSlug: string;
    adminReviewNote: string;
    createdAt: string | null;
    updatedAt: string | null;
    reviewedAt: string | null;
    firstAdminViewedAt: string | null;
    isUnreadAdmin: boolean;
};

function formatDate(value: string | null): string {
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

function getInquiryLabel(value: string): string {
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

function getStatusLabel(value: RequestStatus): string {
    switch (value) {
        case "pending_frda_review":
            return "Needs FRDA Review";
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
            return "Reported";
        default:
            return "Closed";
    }
}

function getStatusClass(value: RequestStatus): string {
    switch (value) {
        case "pending_frda_review":
            return "border-blue-500/25 bg-blue-500/10 text-blue-200";
        case "held":
            return "border-amber-500/25 bg-amber-500/10 text-amber-200";
        case "pending_developer_response":
            return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
        case "connected":
            return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
        case "reported":
        case "rejected":
            return "border-red-500/25 bg-red-500/10 text-red-200";
        default:
            return "border-zinc-700 bg-zinc-900 text-zinc-400";
    }
}

export default function ConnectionRequestsPage() {
    const router = useRouter();
    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [requests, setRequests] = useState<ConnectionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] =
        useState<RequestStatus | "all">("all");
    const [selectedRequest, setSelectedRequest] =
        useState<ConnectionRequest | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [processingAction, setProcessingAction] =
        useState<
            | "approve"
            | "reject"
            | "hold"
            | "dismiss_report"
            | "close_report"
            | "suspend_requester"
            | null
        >(null);

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

        async function loadRequests() {
            setLoading(true);
            setPageError("");

            try {
                const idToken = await currentUser.getIdToken();

                const response = await fetch(
                    "/api/admin/membership/connection-requests",
                    {
                        headers: {
                            Authorization: `Bearer ${idToken}`,
                        },
                        cache: "no-store",
                    },
                );

                const result = await response.json().catch(() => null);

                if (!response.ok || !result?.ok) {
                    throw new Error(
                        result?.error || "Could not load connection requests.",
                    );
                }

                if (!cancelled) {
                    setRequests(result.requests || []);
                }
            } catch (error) {
                if (!cancelled) {
                    setPageError(
                        error instanceof Error
                            ? error.message
                            : "Could not load connection requests.",
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

    const filteredRequests = useMemo(() => {
        const normalized = search.trim().toLowerCase();

        return requests.filter((request) => {
            if (
                statusFilter !== "all" &&
                request.status !== statusFilter
            ) {
                return false;
            }

            if (!normalized) {
                return true;
            }

            return [
                request.opportunityTitle,
                request.requesterDisplayName,
                request.requesterOrganizationName,
                request.developerDisplayName,
                request.requesterMemberId,
                request.developerMemberId,
            ]
                .join(" ")
                .toLowerCase()
                .includes(normalized);
        });
    }, [requests, search, statusFilter]);

    async function openRequest(
        request: ConnectionRequest,
    ) {
        setSelectedRequest(request);
        setReviewNote(request.adminReviewNote || "");

        if (
            !user ||
            !request.isUnreadAdmin
        ) {
            return;
        }

        setRequests((current) =>
            current.map((item) =>
                item.requestId ===
                request.requestId
                    ? {
                        ...item,
                        isUnreadAdmin: false,
                        firstAdminViewedAt:
                            new Date().toISOString(),
                    }
                    : item,
            ),
        );

        setSelectedRequest((current) =>
            current &&
            current.requestId ===
                request.requestId
                ? {
                    ...current,
                    isUnreadAdmin: false,
                    firstAdminViewedAt:
                        new Date().toISOString(),
                }
                : current,
        );

        window.dispatchEvent(
            new CustomEvent(
                "frda-admin-connection-request-viewed",
            ),
        );

        try {
            const idToken =
                await user.getIdToken();

            await fetch(
                "/api/admin/membership/connection-requests",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        requestId:
                            request.requestId,
                        action: "mark_viewed",
                    }),
                },
            );
        } catch (error) {
            console.error(
                "Mark admin request viewed error:",
                error,
            );
        }
    }

    function closeRequest() {
        if (processingAction) return;

        setSelectedRequest(null);
        setReviewNote("");
    }

    async function reviewRequest(
        action:
            | "approve"
            | "reject"
            | "hold"
            | "dismiss_report"
            | "close_report"
            | "suspend_requester",
    ) {
        if (!user || !selectedRequest || processingAction) {
            return;
        }

        if (
            (
                action === "reject" ||
                action === "hold" ||
                action === "suspend_requester"
            ) &&
            !reviewNote.trim()
        ) {
            notify.error("Add a review note for this action.");
            return;
        }

        setProcessingAction(action);

        try {
            const idToken = await user.getIdToken();

            const response = await fetch(
                "/api/admin/membership/connection-requests",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        requestId: selectedRequest.requestId,
                        action,
                        reviewNote: reviewNote.trim(),
                    }),
                },
            );

            const result = await response.json().catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error || "Could not review this request.",
                );
            }

            const updated = result.request as ConnectionRequest;

            setRequests((current) =>
                current.map((request) =>
                    request.requestId === updated.requestId
                        ? updated
                        : request,
                ),
            );

            notify.success(result.message);
            setSelectedRequest(null);
            setReviewNote("");
        } catch (error) {
            notify.error(
                error instanceof Error
                    ? error.message
                    : "Could not review this request.",
            );
        } finally {
            setProcessingAction(null);
        }
    }

    async function handleSignOut() {
        await setPresenceOffline(user?.email);
        await signOut(auth);
        router.replace("/admin/login");
    }

    if (authLoading || !user) {
        return (
            <main className="min-h-screen bg-zinc-950 p-8 text-sm text-zinc-400">
                Loading connection requests...
            </main>
        );
    }

    return (
        <main className="min-h-screen w-full overflow-x-hidden bg-[#060913] text-white">
            <div className="grid min-h-screen w-full lg:grid-cols-[290px_minmax(0,1fr)]">
                <AdminSidebar
                    active="membership_connection_requests"
                    sidebarOpen={sidebarOpen}
                    onCloseSidebar={() => setSidebarOpen(false)}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    displayName={displayName}
                    email={user.email}
                />

                <section className="min-w-0 overflow-x-hidden bg-zinc-900 px-4 py-5 md:px-10 md:py-8 xl:px-14">
                    <div className="mb-5 flex items-center gap-3 lg:hidden">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="cursor-pointer bg-zinc-800 px-3 py-2 text-sm"
                            style={{ borderRadius: 8 }}
                        >
                            ☰
                        </button>

                        <p className="text-2xl font-semibold">
                            Connection Requests
                        </p>
                    </div>

                    <h1 className="text-2xl font-semibold">
                        Connection Requests
                    </h1>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                        Review each inquiry before it is delivered to the developer.
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search requester, developer, organization, or opportunity"
                            className="min-w-0 flex-1 border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                            style={{ borderRadius: 8 }}
                        />

                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(
                                    event.target.value as RequestStatus | "all",
                                )
                            }
                            className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                            style={{
                                borderRadius: 8,
                                colorScheme: "dark",
                            }}
                        >
                            <option value="all">All statuses</option>
                            <option value="pending_frda_review">
                                Needs FRDA Review
                            </option>
                            <option value="held">On Hold</option>
                            <option value="pending_developer_response">
                                Sent to Developer
                            </option>
                            <option value="connected">Connected</option>
                            <option value="declined">Declined</option>
                            <option value="rejected">Rejected</option>
                            <option value="reported">Reported</option>
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
                        className="mt-5 overflow-hidden border border-zinc-800 bg-zinc-950/25"
                        style={{ borderRadius: 8 }}
                    >
                        {loading ? (
                            <div className="p-6 text-sm text-zinc-400">
                                Loading connection requests...
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="p-6 text-sm text-zinc-400">
                                No connection requests were found.
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-800">
                                {filteredRequests.map((request) => (
                                    <button
                                        key={request.requestId}
                                        type="button"
                                        onClick={() => openRequest(request)}
                                        className={`block w-full cursor-pointer p-5 text-left hover:bg-zinc-950/40 ${
                                            request.isUnreadAdmin
                                                ? "bg-blue-500/[0.06]"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {request.isUnreadAdmin ? (
                                                        <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]" />
                                                    ) : null}

                                                    <h2 className="font-semibold text-white">
                                                        {request.opportunityTitle}
                                                    </h2>

                                                    <span
                                                        className="border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200"
                                                        style={{ borderRadius: 999 }}
                                                    >
                                                        {getInquiryLabel(request.inquiryType)}
                                                    </span>
                                                </div>

                                                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                                                    {request.requesterAvatarUrl ? (
                                                        <img
                                                            src={request.requesterAvatarUrl}
                                                            alt=""
                                                            className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-[10px] font-semibold text-sky-200">
                                                            {(request.requesterDisplayName || "TS")
                                                                .split(/\s+/)
                                                                .filter(Boolean)
                                                                .slice(0, 2)
                                                                .map((part) => part.charAt(0).toUpperCase())
                                                                .join("")}
                                                        </div>
                                                    )}

                                                    <span>{request.requesterDisplayName}</span>
                                                    <span className="text-zinc-600">→</span>

                                                    {request.developerAvatarUrl ? (
                                                        <img
                                                            src={request.developerAvatarUrl}
                                                            alt=""
                                                            className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-semibold text-blue-200">
                                                            {(request.developerDisplayName || "FD")
                                                                .split(/\s+/)
                                                                .filter(Boolean)
                                                                .slice(0, 2)
                                                                .map((part) => part.charAt(0).toUpperCase())
                                                                .join("")}
                                                        </div>
                                                    )}

                                                    <span>{request.developerDisplayName}</span>
                                                </div>

                                                <p className="mt-1 text-xs text-zinc-500">
                                                    {request.requesterOrganizationName ||
                                                        request.organizationName ||
                                                        "No organization"}{" "}
                                                    · {formatDate(request.createdAt)}
                                                </p>
                                            </div>

                                            <span
                                                className={`w-fit border px-2.5 py-1 text-xs ${getStatusClass(
                                                    request.status,
                                                )}`}
                                                style={{ borderRadius: 999 }}
                                            >
                                                {getStatusLabel(request.status)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {selectedRequest ? (
                <div
                    className="fixed inset-0 z-[100] flex justify-end bg-black/70"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeRequest();
                        }
                    }}
                >
                    <div className="flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-blue-300">
                                    Connection Request
                                </p>

                                <h2 className="mt-2 text-2xl font-semibold">
                                    {selectedRequest.opportunityTitle}
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={closeRequest}
                                disabled={Boolean(processingAction)}
                                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
                            >
                                ×
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                            <span
                                className={`inline-flex border px-3 py-1.5 text-xs ${getStatusClass(
                                    selectedRequest.status,
                                )}`}
                                style={{ borderRadius: 999 }}
                            >
                                {getStatusLabel(selectedRequest.status)}
                            </span>

                            <div className="mt-6 space-y-5">
                                <section
                                    className="border border-zinc-800 bg-zinc-950/35 p-5"
                                    style={{ borderRadius: 8 }}
                                >
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                        Requester
                                    </h3>

                                    <div className="mt-4 flex items-center gap-3">
                                        {selectedRequest.requesterAvatarUrl ? (
                                            <img
                                                src={selectedRequest.requesterAvatarUrl}
                                                alt=""
                                                className="h-11 w-11 rounded-full border border-zinc-700 object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-200">
                                                {(selectedRequest.requesterDisplayName || "TS")
                                                    .split(/\s+/)
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((part) => part.charAt(0).toUpperCase())
                                                    .join("")}
                                            </div>
                                        )}

                                        <p className="font-medium">
                                            {selectedRequest.requesterDisplayName}
                                        </p>
                                    </div>

                                    <p className="mt-1 text-sm text-zinc-400">
                                        {selectedRequest.requesterContactEmail}
                                    </p>

                                    <p className="mt-1 text-sm text-zinc-400">
                                        {selectedRequest.requesterOrganizationName ||
                                            "No organization submitted"}
                                    </p>

                                    <p className="mt-1 text-sm text-zinc-500">
                                        {selectedRequest.requesterRole ||
                                            "No role submitted"}
                                    </p>
                                </section>

                                <section
                                    className="border border-zinc-800 bg-zinc-950/35 p-5"
                                    style={{ borderRadius: 8 }}
                                >
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                        Developer
                                    </h3>

                                    <div className="mt-4 flex items-center gap-3">
                                        {selectedRequest.developerAvatarUrl ? (
                                            <img
                                                src={selectedRequest.developerAvatarUrl}
                                                alt=""
                                                className="h-11 w-11 rounded-full border border-zinc-700 object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-200">
                                                {(selectedRequest.developerDisplayName || "FD")
                                                    .split(/\s+/)
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((part) => part.charAt(0).toUpperCase())
                                                    .join("")}
                                            </div>
                                        )}

                                        <p className="font-medium">
                                            {selectedRequest.developerDisplayName}
                                        </p>
                                    </div>

                                    <p className="mt-1 text-sm text-zinc-500">
                                        {selectedRequest.developerMemberId}
                                    </p>
                                </section>

                                <section
                                    className="border border-zinc-800 bg-zinc-950/35 p-5"
                                    style={{ borderRadius: 8 }}
                                >
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                        Message
                                    </h3>

                                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                                        {selectedRequest.message}
                                    </p>
                                </section>

                                {selectedRequest.relevantUrl ? (
                                    <a
                                        href={selectedRequest.relevantUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-200"
                                        style={{ borderRadius: 6 }}
                                    >
                                        Open Relevant Link
                                    </a>
                                ) : null}

                                {(selectedRequest.status ===
                                    "pending_frda_review" ||
                                    selectedRequest.status === "held" ||
                                    selectedRequest.status === "reported") ? (
                                    <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                            FRDA Review Note
                                        </label>

                                        <textarea
                                            value={reviewNote}
                                            onChange={(event) =>
                                                setReviewNote(event.target.value)
                                            }
                                            rows={5}
                                            maxLength={3000}
                                            placeholder={
                                                selectedRequest.status === "reported"
                                                    ? "Add an internal note. Required when suspending the requester."
                                                    : "Required when rejecting or placing the request on hold."
                                            }
                                            className="w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                                            style={{ borderRadius: 8 }}
                                        />
                                    </div>
                                ) : selectedRequest.adminReviewNote ? (
                                    <section
                                        className="border border-zinc-800 bg-zinc-950/35 p-5"
                                        style={{ borderRadius: 8 }}
                                    >
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            FRDA Review Note
                                        </h3>

                                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                                            {selectedRequest.adminReviewNote}
                                        </p>
                                    </section>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                            <button
                                type="button"
                                onClick={closeRequest}
                                disabled={Boolean(processingAction)}
                                className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                                style={{ borderRadius: 7 }}
                            >
                                Close
                            </button>

                            {(selectedRequest.status ===
                                "pending_frda_review" ||
                                selectedRequest.status === "held") ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => reviewRequest("hold")}
                                        disabled={Boolean(processingAction)}
                                        className="cursor-pointer border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 disabled:opacity-50"
                                        style={{ borderRadius: 7 }}
                                    >
                                        {processingAction === "hold"
                                            ? "Holding..."
                                            : "Place on Hold"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => reviewRequest("reject")}
                                        disabled={Boolean(processingAction)}
                                        className="cursor-pointer border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50"
                                        style={{ borderRadius: 7 }}
                                    >
                                        {processingAction === "reject"
                                            ? "Rejecting..."
                                            : "Reject"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => reviewRequest("approve")}
                                        disabled={Boolean(processingAction)}
                                        className="cursor-pointer bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                        style={{ borderRadius: 7 }}
                                    >
                                        {processingAction === "approve"
                                            ? "Approving..."
                                            : "Approve and Send"}
                                    </button>
                                </>
                            ) : selectedRequest.status === "reported" ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            reviewRequest("dismiss_report")
                                        }
                                        disabled={Boolean(processingAction)}
                                        className="cursor-pointer border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200 disabled:opacity-50"
                                        style={{ borderRadius: 7 }}
                                    >
                                        {processingAction === "dismiss_report"
                                            ? "Returning..."
                                            : "Dismiss and Return"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            reviewRequest("close_report")
                                        }
                                        disabled={Boolean(processingAction)}
                                        className="cursor-pointer border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 disabled:opacity-50"
                                        style={{ borderRadius: 7 }}
                                    >
                                        {processingAction === "close_report"
                                            ? "Closing..."
                                            : "Close Request"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            reviewRequest("suspend_requester")
                                        }
                                        disabled={Boolean(processingAction)}
                                        className="cursor-pointer border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50"
                                        style={{ borderRadius: 7 }}
                                    >
                                        {processingAction === "suspend_requester"
                                            ? "Suspending..."
                                            : "Suspend Requester"}
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
}