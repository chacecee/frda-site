"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    Loader2,
    Lock,
} from "lucide-react";

type MeetingSlot = {
    id: string;
    date: string;
    time: string;
};

type PublicPoll = {
    id: string;
    title: string;
    description: string;
    timezone: string;
    slots: MeetingSlot[];
    deadline: string | null;
    status: "open" | "finalized" | "cancelled";
    finalSlotId?: string | null;
};

type PublicMember = {
    discordUserId: string;
    displayName: string;
};

type PublicResponse = {
    availability: Record<string, boolean>;
    submittedAt: string | null;
    updatedAt: string | null;
};

function formatDateLabel(dateValue: string) {
    if (!dateValue) return "Date";

    const parsed = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return dateValue;
    }

    return parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function formatTimeLabel(timeValue: string) {
    if (!timeValue) return "Time";

    const [hourRaw, minuteRaw] = timeValue.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw || "0");

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return timeValue;
    }

    const parsed = new Date();
    parsed.setHours(hour, minute, 0, 0);

    return parsed.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatDateTimeLabel(value: string | null) {
    if (!value) return "—";

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return parsed.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function groupSlotsByDate(slots: MeetingSlot[]) {
    const grouped = new Map<string, MeetingSlot[]>();

    slots.forEach((slot) => {
        if (!grouped.has(slot.date)) {
            grouped.set(slot.date, []);
        }

        grouped.get(slot.date)?.push(slot);
    });

    return Array.from(grouped.entries()).map(([date, dateSlots]) => ({
        date,
        slots: dateSlots.sort((a, b) => a.time.localeCompare(b.time)),
    }));
}

export default function PublicMeetingPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const pollId = typeof params.id === "string" ? params.id : "";
    const token = searchParams.get("token") || "";

    const [poll, setPoll] = useState<PublicPoll | null>(null);
    const [member, setMember] = useState<PublicMember | null>(null);
    const [availability, setAvailability] = useState<Record<string, boolean>>({});
    const [existingResponse, setExistingResponse] =
        useState<PublicResponse | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [pageError, setPageError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const groupedSlots = useMemo(() => {
        return groupSlotsByDate(poll?.slots || []);
    }, [poll?.slots]);

    const finalSlot = useMemo(() => {
        if (!poll?.finalSlotId) return null;
        return poll.slots.find((slot) => slot.id === poll.finalSlotId) || null;
    }, [poll]);

    const isFinalized = poll?.status === "finalized";
    const isCancelled = poll?.status === "cancelled";
    const canSubmit = poll?.status === "open";

    useEffect(() => {
        let isMounted = true;

        async function loadPoll() {
            setLoading(true);
            setPageError("");
            setSuccessMessage("");

            if (!pollId || !token) {
                setPageError("This availability link is missing required details.");
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(
                    `/api/meeting-polls/${pollId}/public?token=${encodeURIComponent(
                        token
                    )}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Could not load this meeting poll.");
                }

                if (!isMounted) return;

                setPoll(data.poll);
                setMember(data.member);
                setExistingResponse(data.response || null);
                setAvailability(data.response?.availability || {});
            } catch (error) {
                console.error("Error loading public meeting page:", error);

                if (!isMounted) return;

                setPageError(
                    error instanceof Error
                        ? error.message
                        : "Could not load this meeting poll."
                );
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadPoll();

        return () => {
            isMounted = false;
        };
    }, [pollId, token]);

    function toggleSlot(slotId: string) {
        if (!canSubmit) return;

        setSuccessMessage("");

        setAvailability((current) => ({
            ...current,
            [slotId]: !current[slotId],
        }));
    }

    async function handleSubmit() {
        if (!poll || !token || !canSubmit) return;

        setSaving(true);
        setPageError("");
        setSuccessMessage("");

        try {
            const response = await fetch(`/api/meeting-polls/${poll.id}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    availability,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Could not submit your availability.");
            }

            setSuccessMessage("Your availability has been submitted.");
            setExistingResponse({
                availability,
                submittedAt: existingResponse?.submittedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Error submitting availability:", error);

            setPageError(
                error instanceof Error
                    ? error.message
                    : "Could not submit your availability."
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-zinc-950 px-5 py-12 text-white md:py-16">
                <div className="mx-auto flex max-w-2xl items-center gap-3 border border-zinc-800 bg-zinc-900/70 p-5">
                    <Loader2 className="animate-spin text-blue-300" size={20} />
                    <p className="text-sm text-zinc-300">Loading availability check...</p>
                </div>
            </main>
        );
    }

    if (pageError && !poll) {
        return (
            <main className="min-h-screen bg-zinc-950 px-5 py-12 text-white md:py-16">
                <div className="mx-auto max-w-2xl border border-red-500/25 bg-red-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 text-red-300" size={20} />
                        <div>
                            <p className="text-sm font-semibold text-red-100">
                                Could not open this link
                            </p>
                            <p className="mt-1 text-sm text-red-100/80">{pageError}</p>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 px-5 py-12 text-white md:py-16">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center">
                        <Image
                            src="/frda-logo-small.png"
                            alt="FRDA logo"
                            width={56}
                            height={56}
                            priority
                        />
                    </div>

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                            FRDA Meeting Availability
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold text-white">
                            {poll?.title || "Meeting Availability Check"}
                        </h1>
                    </div>
                </div>

                {isFinalized && finalSlot ? (
                    <section
                        className="mb-5 border border-emerald-500/25 bg-emerald-500/10 p-5"
                        style={{ borderRadius: 12 }}
                    >
                        <div className="flex items-start gap-3">
                            <CheckCircle2
                                className="mt-0.5 text-emerald-300"
                                size={20}
                                strokeWidth={1.8}
                            />
                            <div>
                                <p className="text-sm font-semibold text-emerald-100">
                                    This meeting has been finalized.
                                </p>
                                <p className="mt-2 text-lg font-semibold text-white">
                                    {formatDateLabel(finalSlot.date)} at{" "}
                                    {formatTimeLabel(finalSlot.time)}
                                </p>
                                <p className="mt-2 text-sm text-emerald-100/75">
                                    Availability updates are now closed.
                                </p>
                            </div>
                        </div>
                    </section>
                ) : null}

                {isCancelled ? (
                    <section
                        className="mb-5 border border-red-500/25 bg-red-500/10 p-5"
                        style={{ borderRadius: 12 }}
                    >
                        <div className="flex items-start gap-3">
                            <AlertCircle
                                className="mt-0.5 text-red-300"
                                size={20}
                                strokeWidth={1.8}
                            />
                            <div>
                                <p className="text-sm font-semibold text-red-100">
                                    This meeting poll has been cancelled.
                                </p>
                                <p className="mt-2 text-sm text-red-100/75">
                                    Availability updates are no longer accepted.
                                </p>
                            </div>
                        </div>
                    </section>
                ) : null}

                <section
                    className="border border-zinc-800 bg-zinc-900/70 p-5"
                    style={{ borderRadius: 12 }}
                >
                    {poll?.description ? (
                        <p className="text-sm leading-6 text-zinc-300">
                            {poll.description}
                        </p>
                    ) : null}

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <div
                            className="border border-zinc-800 bg-zinc-950/55 p-4"
                            style={{ borderRadius: 8 }}
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                Submitting as
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                                {member?.displayName || "Member"}
                            </p>
                        </div>

                        <div
                            className="border border-zinc-800 bg-zinc-950/55 p-4"
                            style={{ borderRadius: 8 }}
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                Response deadline
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                                {formatDateTimeLabel(poll?.deadline || null)}
                            </p>
                        </div>
                    </div>

                    {existingResponse && canSubmit ? (
                        <div
                            className="mt-5 border border-emerald-500/25 bg-emerald-500/10 p-4"
                            style={{ borderRadius: 8 }}
                        >
                            <div className="flex items-start gap-3">
                                <CheckCircle2
                                    className="mt-0.5 text-emerald-300"
                                    size={18}
                                    strokeWidth={1.7}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-emerald-100">
                                        You already submitted availability.
                                    </p>
                                    <p className="mt-1 text-sm text-emerald-100/75">
                                        You can still update it until the deadline.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {!canSubmit ? (
                        <div
                            className="mt-5 border border-zinc-800 bg-zinc-950/55 p-4"
                            style={{ borderRadius: 8 }}
                        >
                            <div className="flex items-start gap-3">
                                <Lock className="mt-0.5 text-zinc-400" size={18} />
                                <div>
                                    <p className="text-sm font-semibold text-white">
                                        Availability is closed.
                                    </p>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        {isFinalized
                                            ? "This meeting has already been finalized, so there’s nothing else you need to select here."
                                            : "This availability check is no longer accepting responses."}
                                    </p>
                                    {existingResponse?.updatedAt ? (
                                        <p className="mt-2 text-xs text-zinc-500">
                                            Your last submitted response was saved on{" "}
                                            {formatDateTimeLabel(existingResponse.updatedAt)}.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </section>

                {canSubmit ? (
                    <section
                        className="mt-5 border border-zinc-800 bg-zinc-900/70 p-5"
                        style={{ borderRadius: 12 }}
                    >
                        <div className="flex items-start gap-3">
                            <Clock3 className="mt-0.5 text-blue-300" size={18} />
                            <div>
                                <h2 className="text-sm font-semibold text-white">
                                    Select all times you are available
                                </h2>
                                <p className="mt-1 text-sm text-zinc-400">
                                    Times are shown in Philippine time.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-5">
                            {groupedSlots.map((group) => (
                                <div key={group.date}>
                                    <p className="text-sm font-semibold text-white">
                                        {formatDateLabel(group.date)}
                                    </p>

                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {group.slots.map((slot) => {
                                            const selected = Boolean(availability[slot.id]);

                                            return (
                                                <button
                                                    key={slot.id}
                                                    type="button"
                                                    onClick={() => toggleSlot(slot.id)}
                                                    className={`flex cursor-pointer items-center justify-between border px-4 py-3 text-left text-sm transition ${selected
                                                            ? "border-blue-400/60 bg-blue-500/15 text-blue-100"
                                                            : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-blue-400/35"
                                                        }`}
                                                    style={{ borderRadius: 8 }}
                                                >
                                                    <span>{formatTimeLabel(slot.time)}</span>

                                                    <span
                                                        className={`flex h-5 w-5 items-center justify-center border text-[11px] ${selected
                                                                ? "border-blue-300 bg-blue-400 text-zinc-950"
                                                                : "border-zinc-600 text-transparent"
                                                            }`}
                                                        style={{ borderRadius: 999 }}
                                                    >
                                                        ✓
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {pageError ? (
                            <p className="mt-5 text-sm text-red-400">{pageError}</p>
                        ) : null}

                        {successMessage ? (
                            <div
                                className="mt-5 border border-emerald-500/25 bg-emerald-500/10 p-4"
                                style={{ borderRadius: 8 }}
                            >
                                <p className="text-sm font-semibold text-emerald-100">
                                    {successMessage}
                                </p>
                                <p className="mt-1 text-sm text-emerald-100/75">
                                    You may update this link again until the deadline.
                                </p>
                            </div>
                        ) : null}

                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleSubmit}
                            className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            style={{
                                borderRadius: 5,
                                background:
                                    "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                                border: "1px solid rgba(96, 165, 250, 0.55)",
                                boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                            }}
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : existingResponse ? (
                                "Update Availability"
                            ) : (
                                "Submit Availability"
                            )}
                        </button>
                    </section>
                ) : null}
            </div>
        </main>
    );
}