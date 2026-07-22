"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { setPresenceOffline } from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { notify } from "@/components/ToastConfig";

type AccountPurpose = "developer" | "talent_seeker" | "both";

type InviteStatus =
    | "pending"
    | "claimed"
    | "expired"
    | "revoked";

type MembershipInvitation = {
    id: string;
    email: string;
    normalizedEmail: string;
    displayName: string;
    accountPurpose: AccountPurpose;
    memberId: string;
    sourceApplicationId: string;
    status: InviteStatus;
    createdAt: string | null;
    expiresAt: string | null;
    claimedAt: string | null;
    revokedAt: string | null;
    invitedByEmail: string;
    invitedByName: string;
    emailSentAt: string | null;
    emailSendCount: number;
    emailError: string;
};

type InviteFormState = {
    displayName: string;
    email: string;
    accountPurpose: AccountPurpose;
};

const EMPTY_FORM: InviteFormState = {
    displayName: "",
    email: "",
    accountPurpose: "developer",
};

function formatDate(value?: string | null): string {
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

function getPurposeLabel(value: AccountPurpose): string {
    switch (value) {
        case "developer":
            return "Developer";
        case "talent_seeker":
            return "Talent Seeker";
        case "both":
            return "Both";
        default:
            return value;
    }
}

function getStatusLabel(value: InviteStatus): string {
    switch (value) {
        case "pending":
            return "Pending";
        case "claimed":
            return "Claimed";
        case "expired":
            return "Expired";
        case "revoked":
            return "Revoked";
        default:
            return value;
    }
}

function getStatusClass(value: InviteStatus): string {
    switch (value) {
        case "pending":
            return "border-amber-500/30 bg-amber-500/10 text-amber-300";
        case "claimed":
            return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
        case "expired":
            return "border-zinc-600 bg-zinc-800 text-zinc-300";
        case "revoked":
            return "border-red-500/30 bg-red-500/10 text-red-300";
        default:
            return "border-zinc-600 bg-zinc-800 text-zinc-300";
    }
}

export default function MembershipInvitationsPage() {
    const router = useRouter();
    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [invitations, setInvitations] = useState<MembershipInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        InviteStatus | "all"
    >("all");

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState<InviteFormState>(EMPTY_FORM);
    const [savingInvite, setSavingInvite] = useState(false);

    const [processingInviteId, setProcessingInviteId] =
        useState<string | null>(null);

    const [pendingRevoke, setPendingRevoke] =
        useState<MembershipInvitation | null>(null);

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

        loadInvitations();
    }, [user]);

    async function getIdToken(): Promise<string> {
        if (!user) {
            throw new Error("You are not signed in.");
        }

        return user.getIdToken();
    }

    async function loadInvitations() {
        if (!user) return;

        setLoading(true);
        setPageError("");

        try {
            const idToken = await user.getIdToken();

            const response = await fetch(
                "/api/admin/membership/invitations",
                {
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                    },
                    cache: "no-store",
                }
            );

            const result = await response.json().catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error ||
                    "Could not load membership invitations."
                );
            }

            setInvitations(result.invitations || []);
        } catch (error) {
            console.error(
                "Membership invitation load error:",
                error
            );

            setPageError(
                error instanceof Error
                    ? error.message
                    : "Could not load membership invitations."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleSignOut() {
        try {
            await setPresenceOffline(user?.email);
            await signOut(auth);
            router.replace("/admin/login");
        } catch (error) {
            console.error("Sign out error:", error);
        }
    }

    function openInviteModal() {
        setForm(EMPTY_FORM);
        setModalOpen(true);
    }

    function closeInviteModal() {
        if (savingInvite) return;

        setModalOpen(false);
        setForm(EMPTY_FORM);
    }

    async function submitInvitation(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!form.displayName.trim()) {
            notify.error("Please enter a display name.");
            return;
        }

        if (!form.email.trim()) {
            notify.error("Please enter an email address.");
            return;
        }

        setSavingInvite(true);

        try {
            const idToken = await getIdToken();

            const response = await fetch(
                "/api/admin/membership/invitations",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        displayName: form.displayName.trim(),
                        email: form.email.trim(),
                        accountPurpose: form.accountPurpose,
                    }),
                }
            );

            const result = await response.json().catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error ||
                    "Could not send the membership invitation."
                );
            }

            setInvitations((current) => [
                result.invitation,
                ...current.filter(
                    (item) => item.id !== result.invitation.id
                ),
            ]);

            closeInviteModal();
            notify.success("Membership invitation sent.");
        } catch (error) {
            console.error(
                "Membership invitation send error:",
                error
            );

            notify.error(
                error instanceof Error
                    ? error.message
                    : "Could not send the membership invitation."
            );
        } finally {
            setSavingInvite(false);
        }
    }

    async function performInviteAction(
        invitation: MembershipInvitation,
        action: "resend" | "revoke"
    ) {
        if (processingInviteId) return;

        setProcessingInviteId(invitation.id);

        try {
            const idToken = await getIdToken();

            const response = await fetch(
                "/api/admin/membership/invitations",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        inviteId: invitation.id,
                        action,
                    }),
                }
            );

            const result = await response.json().catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error ||
                    "Could not update the membership invitation."
                );
            }

            setInvitations((current) =>
                current.map((item) =>
                    item.id === result.invitation.id
                        ? result.invitation
                        : item
                )
            );

            if (action === "revoke") {
                setPendingRevoke(null);
                notify.success("Membership invitation revoked.");
            } else {
                notify.success(
                    "A new three-day invitation was sent."
                );
            }
        } catch (error) {
            console.error(
                "Membership invitation action error:",
                error
            );

            notify.error(
                error instanceof Error
                    ? error.message
                    : "Could not update the membership invitation."
            );
        } finally {
            setProcessingInviteId(null);
        }
    }

    const filteredInvitations = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return invitations.filter((invitation) => {
            const matchesStatus =
                statusFilter === "all" ||
                invitation.status === statusFilter;

            if (!matchesStatus) return false;
            if (!normalizedSearch) return true;

            return [
                invitation.displayName,
                invitation.email,
                invitation.memberId,
                invitation.sourceApplicationId,
                invitation.accountPurpose,
                invitation.status,
                invitation.invitedByName,
                invitation.invitedByEmail,
            ]
                .join(" ")
                .toLowerCase()
                .includes(normalizedSearch);
        });
    }, [invitations, search, statusFilter]);

    const counts = useMemo(() => {
        return {
            total: invitations.length,
            pending: invitations.filter(
                (item) => item.status === "pending"
            ).length,
            claimed: invitations.filter(
                (item) => item.status === "claimed"
            ).length,
            expired: invitations.filter(
                (item) => item.status === "expired"
            ).length,
        };
    }, [invitations]);

    if (authLoading || !user) {
        return (
            <main className="min-h-screen bg-zinc-950 text-white">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <p className="text-sm text-zinc-400">
                        Loading membership invitations...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen w-full overflow-x-hidden bg-[#060913] text-white">
            <div className="grid min-h-screen w-full lg:grid-cols-[290px_minmax(0,1fr)]">
                <AdminSidebar
                    active="membership_invitations"
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
                            className="cursor-pointer bg-zinc-800 px-3 py-2 text-sm text-white"
                            style={{ borderRadius: 8 }}
                        >
                            ☰
                        </button>

                        <p className="text-2xl font-semibold leading-none text-white">
                            Membership Invitations
                        </p>
                    </div>

                    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">
                                Membership Invitations
                            </h1>

                            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                                Send and manage secure membership activation
                                links. Each new or resent invitation expires
                                after three days.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={openInviteModal}
                            className="cursor-pointer px-5 py-3 text-sm font-semibold text-white transition"
                            style={{
                                borderRadius: 5,
                                background: "rgb(59, 130, 246)",
                                border:
                                    "1px solid rgba(96, 165, 250, 0.45)",
                            }}
                        >
                            INVITE MEMBER
                        </button>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                        {[
                            ["Total", counts.total],
                            ["Pending", counts.pending],
                            ["Claimed", counts.claimed],
                            ["Expired", counts.expired],
                        ].map(([label, value]) => (
                            <div
                                key={String(label)}
                                className="border border-zinc-800 bg-zinc-950/35 px-4 py-4"
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
                            placeholder="Search name, email, Member ID, or application ID"
                            className="min-w-0 flex-1 border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                            style={{ borderRadius: 8 }}
                        />

                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(
                                    event.target.value as InviteStatus | "all"
                                )
                            }
                            className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                            style={{ borderRadius: 8 }}
                        >
                            <option value="all">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="claimed">Claimed</option>
                            <option value="expired">Expired</option>
                            <option value="revoked">Revoked</option>
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
                            <table className="w-full min-w-[1100px] border-collapse">
                                <thead className="bg-zinc-950/80">
                                    <tr className="border-b border-zinc-800 text-left">
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Member
                                        </th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Purpose
                                        </th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Member ID
                                        </th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Sent
                                        </th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Expires
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
                                                colSpan={7}
                                                className="px-4 py-8 text-sm text-zinc-400"
                                            >
                                                Loading membership invitations...
                                            </td>
                                        </tr>
                                    ) : filteredInvitations.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-4 py-8 text-sm text-zinc-400"
                                            >
                                                No membership invitations found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvitations.map((invitation) => {
                                            const processing =
                                                processingInviteId === invitation.id;

                                            return (
                                                <tr
                                                    key={invitation.id}
                                                    className="border-b border-zinc-800/80 last:border-b-0"
                                                >
                                                    <td className="px-4 py-4 align-top">
                                                        <p className="font-medium text-white">
                                                            {invitation.displayName || "—"}
                                                        </p>
                                                        <p className="mt-1 text-xs text-zinc-500">
                                                            {invitation.email}
                                                        </p>
                                                    </td>

                                                    <td className="px-4 py-4 align-top text-sm text-zinc-300">
                                                        {getPurposeLabel(
                                                            invitation.accountPurpose
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4 align-top text-sm text-zinc-300">
                                                        {invitation.memberId || "—"}
                                                    </td>

                                                    <td className="px-4 py-4 align-top text-sm text-zinc-300">
                                                        {formatDate(
                                                            invitation.emailSentAt ||
                                                            invitation.createdAt
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4 align-top text-sm text-zinc-300">
                                                        {formatDate(invitation.expiresAt)}
                                                    </td>

                                                    <td className="px-4 py-4 align-top">
                                                        <span
                                                            className={`inline-flex border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                                                invitation.status
                                                            )}`}
                                                            style={{ borderRadius: 999 }}
                                                        >
                                                            {getStatusLabel(
                                                                invitation.status
                                                            )}
                                                        </span>

                                                        {invitation.emailError ? (
                                                            <p className="mt-2 max-w-[220px] text-xs leading-5 text-red-300">
                                                                {invitation.emailError}
                                                            </p>
                                                        ) : null}
                                                    </td>

                                                    <td className="px-4 py-4 text-right align-top">
                                                        <div className="flex justify-end gap-2">
                                                            {invitation.status !== "claimed" &&
                                                                invitation.status !== "revoked" ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        performInviteAction(
                                                                            invitation,
                                                                            "resend"
                                                                        )
                                                                    }
                                                                    disabled={processing}
                                                                    className="cursor-pointer border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    style={{ borderRadius: 7 }}
                                                                >
                                                                    {processing
                                                                        ? "Working..."
                                                                        : "Resend"}
                                                                </button>
                                                            ) : null}

                                                            {invitation.status !== "claimed" &&
                                                                invitation.status !== "revoked" ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setPendingRevoke(invitation)
                                                                    }
                                                                    disabled={processing}
                                                                    className="cursor-pointer border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    style={{ borderRadius: 7 }}
                                                                >
                                                                    Revoke
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-zinc-800 lg:hidden">
                            {loading ? (
                                <div className="p-5 text-sm text-zinc-400">
                                    Loading membership invitations...
                                </div>
                            ) : filteredInvitations.length === 0 ? (
                                <div className="p-5 text-sm text-zinc-400">
                                    No membership invitations found.
                                </div>
                            ) : (
                                filteredInvitations.map((invitation) => {
                                    const processing =
                                        processingInviteId === invitation.id;

                                    return (
                                        <div
                                            key={invitation.id}
                                            className="p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-white">
                                                        {invitation.displayName}
                                                    </p>
                                                    <p className="mt-1 truncate text-sm text-zinc-400">
                                                        {invitation.email}
                                                    </p>
                                                </div>

                                                <span
                                                    className={`shrink-0 border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                                        invitation.status
                                                    )}`}
                                                    style={{ borderRadius: 999 }}
                                                >
                                                    {getStatusLabel(invitation.status)}
                                                </span>
                                            </div>

                                            <div className="mt-4 space-y-2 text-sm text-zinc-300">
                                                <p>
                                                    <span className="text-zinc-500">
                                                        Purpose —
                                                    </span>{" "}
                                                    {getPurposeLabel(
                                                        invitation.accountPurpose
                                                    )}
                                                </p>

                                                <p>
                                                    <span className="text-zinc-500">
                                                        Member ID —
                                                    </span>{" "}
                                                    {invitation.memberId || "—"}
                                                </p>

                                                <p>
                                                    <span className="text-zinc-500">
                                                        Expires —
                                                    </span>{" "}
                                                    {formatDate(invitation.expiresAt)}
                                                </p>
                                            </div>

                                            {invitation.emailError ? (
                                                <p className="mt-3 text-xs leading-5 text-red-300">
                                                    {invitation.emailError}
                                                </p>
                                            ) : null}

                                            {invitation.status !== "claimed" &&
                                                invitation.status !== "revoked" ? (
                                                <div className="mt-4 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            performInviteAction(
                                                                invitation,
                                                                "resend"
                                                            )
                                                        }
                                                        disabled={processing}
                                                        className="flex-1 cursor-pointer border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                        style={{ borderRadius: 7 }}
                                                    >
                                                        {processing
                                                            ? "Working..."
                                                            : "Resend"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPendingRevoke(invitation)
                                                        }
                                                        disabled={processing}
                                                        className="flex-1 cursor-pointer border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                        style={{ borderRadius: 7 }}
                                                    >
                                                        Revoke
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {modalOpen ? (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
                    <div
                        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-zinc-800 bg-zinc-900 shadow-2xl"
                        style={{ borderRadius: 8 }}
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
                            <div>
                                <h2 className="text-2xl font-semibold text-white">
                                    Invite Member
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-zinc-400">
                                    The activation link will expire after three
                                    days.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeInviteModal}
                                disabled={savingInvite}
                                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <form
                            onSubmit={submitInvitation}
                            className="p-6"
                        >
                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                        Display Name
                                    </label>

                                    <input
                                        type="text"
                                        value={form.displayName}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                displayName: event.target.value,
                                            }))
                                        }
                                        placeholder="Developer, studio, or contact name"
                                        className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                        Email Address
                                    </label>

                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                email: event.target.value,
                                            }))
                                        }
                                        placeholder="member@example.com"
                                        className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                        required
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                        Account Purpose
                                    </label>

                                    <select
                                        value={form.accountPurpose}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                accountPurpose:
                                                    event.target.value as AccountPurpose,
                                            }))
                                        }
                                        className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                                        style={{ borderRadius: 5 }}
                                    >
                                        <option value="developer">
                                            Developer
                                        </option>
                                        <option value="talent_seeker">
                                            Talent Seeker
                                        </option>
                                        <option value="both">Both</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeInviteModal}
                                    disabled={savingInvite}
                                    className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ borderRadius: 5 }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={savingInvite}
                                    className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ borderRadius: 5 }}
                                >
                                    {savingInvite
                                        ? "Sending..."
                                        : "Send Invitation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {pendingRevoke ? (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
                    <div
                        className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
                        style={{ borderRadius: 8 }}
                    >
                        <h2 className="text-xl font-semibold text-white">
                            Revoke Invitation
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-zinc-300">
                            Revoke the membership invitation sent to{" "}
                            <span className="font-medium text-white">
                                {pendingRevoke.email}
                            </span>
                            ? The current activation link will stop working.
                        </p>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPendingRevoke(null)}
                                disabled={Boolean(processingInviteId)}
                                className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ borderRadius: 5 }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    performInviteAction(
                                        pendingRevoke,
                                        "revoke"
                                    )
                                }
                                disabled={Boolean(processingInviteId)}
                                className="cursor-pointer border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ borderRadius: 5 }}
                            >
                                {processingInviteId
                                    ? "Revoking..."
                                    : "Confirm Revoke"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
}