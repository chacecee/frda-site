"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import {
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    Clock3,
    Loader2,
    Trophy,
    Users,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { setPresenceOffline } from "@/lib/usePresence";
import { isAdminRole } from "@/lib/adminPermissions";
import { notify } from "@/components/ToastConfig";
import {
    calculateMeetingOverlaps,
    formatDateLabel,
    formatTimeLabel,
    MeetingInvitedMember,
    MeetingPollResponse,
    MeetingSlot,
    SlotScore,
} from "@/lib/meetingPolls";

type StaffProfile = {
    id: string;
    emailAddress?: string;
    role?: string;
};

type MeetingPoll = {
    id: string;
    title: string;
    description?: string;
    timezone?: string;
    slots?: MeetingSlot[];
    dateOptions?: string[];
    timeOptions?: string[];
    invitedMembers?: MeetingInvitedMember[];
    status?: "open" | "finalized" | "cancelled";
    finalSlotId?: string | null;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    deadline?: Timestamp;
};

function normalizeEmail(value?: string | null): string {
    return value?.trim().toLowerCase() || "";
}

function formatTimestamp(timestamp?: Timestamp) {
    if (!timestamp) return "—";

    return timestamp.toDate().toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getStatusStyles(status?: string) {
    if (status === "finalized") {
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    }

    if (status === "cancelled") {
        return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
    }

    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

function getMemberNames(members: MeetingInvitedMember[]) {
    if (members.length === 0) return "None";
    return members.map((member) => member.displayName).join(", ");
}

function getAllSlots(poll: MeetingPoll | null) {
    if (!poll) return [];

    if (poll.slots && poll.slots.length > 0) {
        return [...poll.slots].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });
    }

    const slots: MeetingSlot[] = [];

    (poll.dateOptions || []).forEach((date) => {
        (poll.timeOptions || []).forEach((time) => {
            slots.push({
                id: `${date}__${time}`,
                date,
                time,
            });
        });
    });

    return slots;
}

function getSlotScore(
    rankedSlots: SlotScore[],
    slotId: string
): SlotScore | null {
    return rankedSlots.find((slot) => slot.slotId === slotId) || null;
}

export default function MeetingPollDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const pollId = typeof params.id === "string" ? params.id : "";

    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    const [poll, setPoll] = useState<MeetingPoll | null>(null);
    const [responses, setResponses] = useState<MeetingPollResponse[]>([]);
    const [loadingPoll, setLoadingPoll] = useState(true);

    const [pageError, setPageError] = useState("");
    const [finalizingSlotId, setFinalizingSlotId] = useState("");
    const [pendingFinalSlotId, setPendingFinalSlotId] = useState<string | null>(
        null
    );

    const displayName =
        user?.displayName?.trim() ||
        (user?.email ? user.email.split("@")[0] : "Unknown User");

    const signedInEmail = normalizeEmail(user?.email);

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/admin/login");
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        let isMounted = true;

        async function loadRole() {
            if (!user?.email) {
                if (!isMounted) return;
                setStaffProfile(null);
                setRoleLoading(false);
                return;
            }

            setRoleLoading(true);
            setPageError("");

            try {
                const exactQuery = query(
                    collection(db, "staff"),
                    where("emailAddress", "==", user.email),
                    limit(1)
                );

                const exactSnapshot = await getDocs(exactQuery);

                if (!exactSnapshot.empty) {
                    const docSnap = exactSnapshot.docs[0];
                    if (!isMounted) return;

                    setStaffProfile({
                        id: docSnap.id,
                        ...(docSnap.data() as Omit<StaffProfile, "id">),
                    });
                    setRoleLoading(false);
                    return;
                }

                const lowerQuery = query(
                    collection(db, "staff"),
                    where("emailAddress", "==", signedInEmail),
                    limit(1)
                );

                const lowerSnapshot = await getDocs(lowerQuery);

                if (!lowerSnapshot.empty) {
                    const docSnap = lowerSnapshot.docs[0];
                    if (!isMounted) return;

                    setStaffProfile({
                        id: docSnap.id,
                        ...(docSnap.data() as Omit<StaffProfile, "id">),
                    });
                    setRoleLoading(false);
                    return;
                }

                const allStaffSnapshot = await getDocs(collection(db, "staff"));
                const match = allStaffSnapshot.docs.find((docSnap) => {
                    const data = docSnap.data() as {
                        emailAddress?: string;
                        role?: string;
                    };
                    return normalizeEmail(data.emailAddress) === signedInEmail;
                });

                if (!isMounted) return;

                if (!match) {
                    setStaffProfile(null);
                    setRoleLoading(false);
                    return;
                }

                setStaffProfile({
                    id: match.id,
                    ...(match.data() as Omit<StaffProfile, "id">),
                });
                setRoleLoading(false);
            } catch (error) {
                console.error("Error checking staff meetings access:", error);
                if (!isMounted) return;
                setPageError("Could not verify your permissions.");
                setRoleLoading(false);
            }
        }

        loadRole();

        return () => {
            isMounted = false;
        };
    }, [user?.email, signedInEmail]);

    const hasAccess = useMemo(() => {
        return isAdminRole(staffProfile?.role);
    }, [staffProfile?.role]);

    useEffect(() => {
        if (!user || roleLoading || !hasAccess || !pollId) {
            setLoadingPoll(false);
            return;
        }

        setLoadingPoll(true);
        setPageError("");

        const pollRef = doc(db, "meetingPolls", pollId);

        const unsubscribePoll = onSnapshot(
            pollRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    setPoll(null);
                    setPageError("This meeting poll could not be found.");
                    setLoadingPoll(false);
                    return;
                }

                setPoll({
                    id: snapshot.id,
                    ...(snapshot.data() as Omit<MeetingPoll, "id">),
                });
                setLoadingPoll(false);
            },
            (error) => {
                console.error("Error loading meeting poll:", error);
                setPageError("Could not load this meeting poll.");
                setLoadingPoll(false);
            }
        );

        const responsesQuery = query(
            collection(db, "meetingPollResponses"),
            where("pollId", "==", pollId)
        );

        const unsubscribeResponses = onSnapshot(
            responsesQuery,
            (snapshot) => {
                const rows: MeetingPollResponse[] = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...(docSnap.data() as Omit<MeetingPollResponse, "id">),
                }));

                setResponses(rows);
            },
            (error) => {
                console.error("Error loading meeting responses:", error);
                setPageError("Could not load meeting responses.");
            }
        );

        return () => {
            unsubscribePoll();
            unsubscribeResponses();
        };
    }, [user, roleLoading, hasAccess, pollId]);

    const allSlots = useMemo(() => getAllSlots(poll), [poll]);

    const overlapResults = useMemo(() => {
        if (!poll) {
            return {
                rankedSlots: [],
                submittedMembers: [],
                waitingMembers: [],
                bestSlot: null,
            };
        }

        return calculateMeetingOverlaps({
            invitedMembers: poll.invitedMembers || [],
            responses,
            slots: poll.slots,
            dateOptions: poll.dateOptions,
            timeOptions: poll.timeOptions,
        });
    }, [poll, responses]);

    const responseByUserId = useMemo(() => {
        const map = new Map<string, MeetingPollResponse>();

        responses.forEach((response) => {
            map.set(response.discordUserId, response);
        });

        return map;
    }, [responses]);

    const finalSlot = useMemo(() => {
        if (!poll?.finalSlotId) return null;
        return allSlots.find((slot) => slot.id === poll.finalSlotId) || null;
    }, [poll?.finalSlotId, allSlots]);

    const pendingFinalSlot = useMemo(() => {
        if (!pendingFinalSlotId) return null;
        return allSlots.find((slot) => slot.id === pendingFinalSlotId) || null;
    }, [pendingFinalSlotId, allSlots]);

    async function handleSignOut() {
        try {
            await setPresenceOffline(user?.email);
            await signOut(auth);
            router.replace("/admin/login");
        } catch (error) {
            console.error("Sign out error:", error);
        }
    }

    function openFinalizeModal(slotId: string) {
        if (!poll) return;

        if (poll.status === "finalized") {
            notify.warning("This meeting has already been finalized.");
            return;
        }

        setPendingFinalSlotId(slotId);
    }

    function closeFinalizeModal() {
        if (finalizingSlotId) return;
        setPendingFinalSlotId(null);
    }

    async function confirmFinalizeSlot() {
        if (!poll || !pendingFinalSlotId || !user) return;

        const slot = allSlots.find((item) => item.id === pendingFinalSlotId);

        if (!slot) {
            notify.error("Could not find the selected meeting time.");
            return;
        }

        setFinalizingSlotId(pendingFinalSlotId);
        setPageError("");

        try {
            await updateDoc(doc(db, "meetingPolls", poll.id), {
                status: "finalized",
                finalSlotId: pendingFinalSlotId,
                updatedAt: serverTimestamp(),
            });

            const idToken = await user.getIdToken();

            const discordResponse = await fetch("/api/discord/meeting-finalized", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    pollId: poll.id,
                }),
            });

            const discordResult = await discordResponse.json().catch(() => null);

            if (!discordResponse.ok) {
                console.error("Discord announcement failed:", discordResult);

                notify.warning(
                    "Final meeting time was saved, but the Discord announcement could not be posted."
                );
            } else if (discordResult?.alreadyPosted) {
                notify.success("Final meeting time saved. Discord was already notified.");
            } else {
                notify.success(
                    `Final meeting time saved and posted to Discord: ${formatDateLabel(
                        slot.date
                    )} at ${formatTimeLabel(slot.time)}.`
                );
            }

            setPendingFinalSlotId(null);
        } catch (error) {
            console.error("Error finalizing meeting poll:", error);
            setPageError("Could not finalize this meeting time.");
            notify.error("Could not finalize this meeting time. Please try again.");
        } finally {
            setFinalizingSlotId("");
        }
    }

    if (authLoading || !user || roleLoading) {
        return (
            <main className="min-h-screen bg-zinc-950 text-white">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <p className="text-sm text-zinc-400">Loading dashboard...</p>
                </div>
            </main>
        );
    }

    if (!hasAccess) {
        return (
            <main className="min-h-screen bg-zinc-950 text-white">
                <div className="mx-auto max-w-3xl px-6 py-10">
                    <p className="text-sm text-red-400">
                        You do not have permission to access Staff Meetings.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <>
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

                        <button
                            type="button"
                            onClick={() => router.push("/admin/meeting-polls")}
                            className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
                        >
                            <ArrowLeft size={16} strokeWidth={1.6} />
                            Back to Staff Meetings
                        </button>

                        {loadingPoll ? (
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <Loader2 className="animate-spin text-blue-300" size={18} />
                                Loading meeting poll...
                            </div>
                        ) : !poll ? (
                            <p className="text-sm text-red-400">
                                {pageError || "This meeting poll could not be found."}
                            </p>
                        ) : (
                            <>
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="hidden h-11 w-11 shrink-0 items-center justify-center border border-blue-400/30 bg-blue-500/10 text-blue-300 sm:flex"
                                                style={{ borderRadius: 8 }}
                                            >
                                                <CalendarClock size={21} strokeWidth={1.5} />
                                            </div>

                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h1 className="text-2xl font-semibold text-white">
                                                        {poll.title}
                                                    </h1>
                                                    <span
                                                        className={`inline-flex border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusStyles(
                                                            poll.status
                                                        )}`}
                                                        style={{ borderRadius: 999 }}
                                                    >
                                                        {poll.status || "open"}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-zinc-400">
                                                    {poll.description || "No description added."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-sm text-zinc-400 md:text-right">
                                        <p>
                                            Deadline:{" "}
                                            <span className="font-semibold text-white">
                                                {formatTimestamp(poll.deadline)}
                                            </span>
                                        </p>
                                        {finalSlot ? (
                                            <p className="mt-1 text-emerald-300">
                                                Final time:{" "}
                                                <span className="font-semibold">
                                                    {formatDateLabel(finalSlot.date)} at{" "}
                                                    {formatTimeLabel(finalSlot.time)}
                                                </span>
                                            </p>
                                        ) : null}
                                    </div>
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
                                            <Users className="text-blue-300" size={18} />
                                            <p className="text-sm font-semibold text-white">
                                                Submitted
                                            </p>
                                        </div>
                                        <div className="mt-3 flex items-end gap-3">
                                            <p className="text-3xl font-semibold text-white">
                                                {overlapResults.submittedMembers.length} /{" "}
                                                {poll.invitedMembers?.length || 0}
                                            </p>
                                        </div>
                                        <p className="mt-2 break-words text-xs leading-5 text-zinc-400">
                                            {getMemberNames(overlapResults.submittedMembers)}
                                        </p>
                                    </div>

                                    <div
                                        className="border border-zinc-800 bg-zinc-950/35 p-4"
                                        style={{ borderRadius: 10 }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Clock3 className="text-zinc-300" size={18} />
                                            <p className="text-sm font-semibold text-white">
                                                Waiting
                                            </p>
                                        </div>
                                        <div className="mt-3 flex items-end gap-3">
                                            <p className="text-3xl font-semibold text-white">
                                                {overlapResults.waitingMembers.length}
                                            </p>
                                        </div>
                                        <p className="mt-2 break-words text-xs leading-5 text-zinc-400">
                                            {getMemberNames(overlapResults.waitingMembers)}
                                        </p>
                                    </div>

                                    <div
                                        className="border border-zinc-800 bg-zinc-950/35 p-4"
                                        style={{ borderRadius: 10 }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Trophy className="text-emerald-300" size={18} />
                                            <p className="text-sm font-semibold text-white">
                                                Best Match
                                            </p>
                                        </div>
                                        <p className="mt-3 text-sm font-semibold text-white">
                                            {overlapResults.bestSlot
                                                ? overlapResults.bestSlot.label
                                                : "—"}
                                        </p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            {overlapResults.bestSlot
                                                ? `${overlapResults.bestSlot.availableCount} of ${overlapResults.bestSlot.totalInvited} available`
                                                : "No slots found."}
                                        </p>
                                    </div>
                                </div>

                                <section
                                    className="mt-7 max-w-full overflow-hidden border border-zinc-800 bg-zinc-950/35"
                                    style={{ borderRadius: 12 }}
                                >
                                    <div className="border-b border-zinc-800 px-5 py-4">
                                        <p className="text-sm font-semibold text-white">
                                            Availability Grid
                                        </p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            Review the overlaps visually, then set the final meeting
                                            time under the best column.
                                        </p>
                                    </div>

                                    <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
                                        <table className="w-max min-w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="sticky left-0 z-20 w-[125px] min-w-[125px] bg-zinc-950 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:w-[180px] sm:min-w-[180px] sm:px-4">
                                                        Member
                                                    </th>

                                                    {allSlots.map((slot) => {
                                                        const score = getSlotScore(
                                                            overlapResults.rankedSlots,
                                                            slot.id
                                                        );
                                                        const isBest =
                                                            overlapResults.bestSlot?.slotId === slot.id;
                                                        const isFinal = poll.finalSlotId === slot.id;

                                                        return (
                                                            <th
                                                                key={slot.id}
                                                                className={`min-w-[160px] px-3 py-3 text-left align-top text-xs font-semibold uppercase tracking-[0.14em] sm:min-w-[190px] sm:px-4 ${isFinal
                                                                    ? "bg-emerald-500/10 text-emerald-200"
                                                                    : isBest
                                                                        ? "bg-blue-500/10 text-blue-200"
                                                                        : "text-zinc-500"
                                                                    }`}
                                                            >
                                                                <div className="flex flex-col gap-1">
                                                                    <span>{formatDateLabel(slot.date)}</span>
                                                                    <span className="text-zinc-300">
                                                                        {formatTimeLabel(slot.time)}
                                                                    </span>
                                                                    <span
                                                                        className={`mt-1 text-[11px] normal-case tracking-normal ${score?.availableCount ===
                                                                            score?.totalInvited
                                                                            ? "text-emerald-300"
                                                                            : "text-zinc-400"
                                                                            }`}
                                                                    >
                                                                        {score
                                                                            ? `${score.availableCount}/${score.totalInvited} available`
                                                                            : "0 available"}
                                                                    </span>
                                                                </div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {(poll.invitedMembers || []).map((member) => {
                                                    const response = responseByUserId.get(
                                                        member.discordUserId
                                                    );

                                                    return (
                                                        <tr
                                                            key={member.discordUserId}
                                                            className="border-b border-zinc-900"
                                                        >
                                                            <td className="sticky left-0 z-10 w-[125px] min-w-[125px] bg-zinc-950 px-3 py-4 text-sm font-semibold text-white sm:w-[180px] sm:min-w-[180px] sm:px-4">
                                                                <span className="block max-w-[105px] break-words sm:max-w-[160px]">
                                                                    {member.displayName}
                                                                </span>
                                                            </td>

                                                            {allSlots.map((slot) => {
                                                                const hasResponded = Boolean(response);
                                                                const isAvailable = Boolean(
                                                                    response?.availability?.[slot.id]
                                                                );
                                                                const isFinal = poll.finalSlotId === slot.id;
                                                                const isBest =
                                                                    overlapResults.bestSlot?.slotId === slot.id;

                                                                return (
                                                                    <td
                                                                        key={slot.id}
                                                                        className={`px-3 py-4 sm:px-4 ${isFinal
                                                                            ? "bg-emerald-500/10"
                                                                            : isBest
                                                                                ? "bg-blue-500/5"
                                                                                : ""
                                                                            }`}
                                                                    >
                                                                        {!hasResponded ? (
                                                                            <span className="inline-flex border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-600">
                                                                                No response
                                                                            </span>
                                                                        ) : isAvailable ? (
                                                                            <span
                                                                                className="inline-flex items-center gap-2 border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200"
                                                                                style={{ borderRadius: 999 }}
                                                                            >
                                                                                <CheckCircle2
                                                                                    size={13}
                                                                                    strokeWidth={1.8}
                                                                                />
                                                                                Available
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-400">
                                                                                —
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}

                                                <tr>
                                                    <td className="sticky left-0 z-10 w-[125px] min-w-[125px] bg-zinc-950 px-3 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:w-[180px] sm:min-w-[180px] sm:px-4">
                                                        Final
                                                    </td>

                                                    {allSlots.map((slot) => {
                                                        const isFinal = poll.finalSlotId === slot.id;

                                                        return (
                                                            <td key={slot.id} className="px-3 py-4 sm:px-4">
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        poll.status === "finalized" ||
                                                                        finalizingSlotId === slot.id
                                                                    }
                                                                    onClick={() => openFinalizeModal(slot.id)}
                                                                    className={`inline-flex w-full min-w-[135px] cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[150px] sm:px-4 ${isFinal
                                                                        ? "text-emerald-100"
                                                                        : "text-white"
                                                                        }`}
                                                                    style={{
                                                                        borderRadius: 5,
                                                                        background: isFinal
                                                                            ? "linear-gradient(180deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.2) 100%)"
                                                                            : "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                                                                        border: isFinal
                                                                            ? "1px solid rgba(52, 211, 153, 0.45)"
                                                                            : "1px solid rgba(96, 165, 250, 0.55)",
                                                                    }}
                                                                >
                                                                    {finalizingSlotId === slot.id ? (
                                                                        <>
                                                                            <Loader2
                                                                                size={15}
                                                                                className="animate-spin"
                                                                            />
                                                                            Setting...
                                                                        </>
                                                                    ) : isFinal ? (
                                                                        <>
                                                                            <CheckCircle2 size={15} />
                                                                            Final Time
                                                                        </>
                                                                    ) : (
                                                                        "Set Final Time"
                                                                    )}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </>
                        )}
                    </section>
                </div>
            </main>

            {pendingFinalSlot ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
                    <div
                        className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                        style={{ borderRadius: 10 }}
                    >
                        <h3 className="text-xl font-semibold text-white">
                            Confirm Final Meeting Time
                        </h3>

                        <p className="mt-3 text-sm leading-6 text-zinc-300">
                            Set the final meeting time to{" "}
                            <span className="font-semibold text-white">
                                {formatDateLabel(pendingFinalSlot.date)} at{" "}
                                {formatTimeLabel(pendingFinalSlot.time)}
                            </span>
                            ?
                        </p>

                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                            This will mark the meeting poll as finalized. Members will no
                            longer be able to update their availability.
                        </p>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeFinalizeModal}
                                disabled={Boolean(finalizingSlotId)}
                                className="cursor-pointer px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800/30 disabled:cursor-not-allowed disabled:opacity-70"
                                style={{
                                    borderRadius: 5,
                                    background: "transparent",
                                    border: "1px solid rgba(113, 113, 122, 0.45)",
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={confirmFinalizeSlot}
                                disabled={Boolean(finalizingSlotId)}
                                className="cursor-pointer px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                                style={{
                                    borderRadius: 5,
                                    background:
                                        "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                                    border: "1px solid rgba(96, 165, 250, 0.55)",
                                    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                                    minWidth: 120,
                                }}
                            >
                                <span className="inline-flex items-center justify-center gap-2">
                                    {finalizingSlotId ? (
                                        <>
                                            <span
                                                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                                                aria-hidden="true"
                                            />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        "Confirm"
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}