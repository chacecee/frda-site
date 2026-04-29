"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
    collection,
    getDocs,
    limit,
    query,
    where,
} from "firebase/firestore";
import {
    ArrowLeft,
    CalendarClock,
    CalendarDays,
    CheckCircle2,
    Clipboard,
    Clock3,
    Link as LinkIcon,
    Loader2,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { setPresenceOffline } from "@/lib/usePresence";
import { isAdminRole } from "@/lib/adminPermissions";
import { notify } from "@/components/ToastConfig";
import { buildSlotsFromDateTimeRows } from "@/lib/meetingPolls";

type StaffProfile = {
    id: string;
    emailAddress?: string;
    role?: string;
};

type DateTimeRow = {
    localId: string;
    date: string;
    times: string[];
};

type FailedDmMember = {
    displayName: string;
    discordUserId: string;
    url: string;
    error: string;
};

type CreatedResult = {
    pollId: string;
    participantCount: number;
    dmSentCount: number;
    failedDmMembers: FailedDmMember[];
};

function normalizeEmail(value?: string | null): string {
    return value?.trim().toLowerCase() || "";
}

function getLocalDateTimeValue(date: Date) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
}

function getLocalDateValue(date: Date) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 10);
}

function getLocalTimeValue(date: Date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

function formatReadableDate(dateValue: string) {
    if (!dateValue) return "Select date";

    const parsed = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return "Select date";
    }

    return parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function isPastSlot(dateValue: string, timeValue: string) {
    if (!dateValue || !timeValue) return false;

    const slotDate = new Date(`${dateValue}T${timeValue}:00`);
    const now = new Date();

    return slotDate.getTime() < now.getTime();
}

function createLocalRow(): DateTimeRow {
    return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        date: "",
        times: [""],
    };
}

function openNativePicker(input: HTMLInputElement | null) {
    if (!input) return;

    input.focus();

    try {
        const pickerInput = input as HTMLInputElement & {
            showPicker?: () => void;
        };

        if (typeof pickerInput.showPicker === "function") {
            pickerInput.showPicker();
            return;
        }

        input.click();
    } catch {
        input.click();
    }
}

export default function NewMeetingPollPage() {
    const router = useRouter();
    const { user, authLoading } = useAuthUser();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dateTimeRows, setDateTimeRows] = useState<DateTimeRow[]>([
        createLocalRow(),
    ]);
    const [deadlineInput, setDeadlineInput] = useState(() => {
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 3);
        defaultDeadline.setHours(23, 59, 0, 0);
        return getLocalDateTimeValue(defaultDeadline);
    });

    const [creating, setCreating] = useState(false);
    const [pageError, setPageError] = useState("");
    const [createdResult, setCreatedResult] = useState<CreatedResult | null>(null);

    const errorRef = useRef<HTMLParagraphElement | null>(null);
    const deadlineInputRef = useRef<HTMLInputElement | null>(null);
    const dateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const timeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const displayName =
        user?.displayName?.trim() ||
        (user?.email ? user.email.split("@")[0] : "Unknown User");

    const signedInEmail = normalizeEmail(user?.email);

    const todayDateValue = getLocalDateValue(new Date());
    const currentTimeValue = getLocalTimeValue(new Date());

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

    function updateDate(rowId: string, value: string) {
        setDateTimeRows((current) =>
            current.map((row) =>
                row.localId === rowId
                    ? {
                        ...row,
                        date: value,
                    }
                    : row
            )
        );
    }

    function updateTime(rowId: string, timeIndex: number, value: string) {
        setDateTimeRows((current) =>
            current.map((row) => {
                if (row.localId !== rowId) return row;

                return {
                    ...row,
                    times: row.times.map((time, index) =>
                        index === timeIndex ? value : time
                    ),
                };
            })
        );
    }

    function addDateRow() {
        setDateTimeRows((current) => [...current, createLocalRow()]);
    }

    function removeDateRow(rowId: string) {
        setDateTimeRows((current) => {
            if (current.length <= 1) return current;
            return current.filter((row) => row.localId !== rowId);
        });
    }

    function addTime(rowId: string) {
        setDateTimeRows((current) =>
            current.map((row) =>
                row.localId === rowId
                    ? {
                        ...row,
                        times: [...row.times, ""],
                    }
                    : row
            )
        );
    }

    function removeTime(rowId: string, timeIndex: number) {
        setDateTimeRows((current) =>
            current.map((row) => {
                if (row.localId !== rowId) return row;
                if (row.times.length <= 1) return row;

                return {
                    ...row,
                    times: row.times.filter((_, index) => index !== timeIndex),
                };
            })
        );
    }

    function showFormError(message: string) {
        setPageError(message);
        notify.error(message);

        window.setTimeout(() => {
            errorRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }, 50);
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

    async function handleCreatePoll(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!user || !hasAccess) return;

        setPageError("");
        setCreatedResult(null);

        const cleanTitle = title.trim();
        const cleanDescription = description.trim();
        const slots = buildSlotsFromDateTimeRows(dateTimeRows);

        if (!cleanTitle) {
            showFormError("Please add a meeting title.");
            return;
        }

        if (slots.length === 0) {
            showFormError("Please add at least one date and time option.");
            return;
        }

        const pastSlot = slots.find((slot) => isPastSlot(slot.date, slot.time));

        if (pastSlot) {
            showFormError(
                "Please remove past date/time options. Meeting options must be set in the future."
            );
            return;
        }

        const deadlineDate = deadlineInput ? new Date(deadlineInput) : null;

        if (!deadlineDate || Number.isNaN(deadlineDate.getTime())) {
            showFormError("Please add a valid response deadline.");
            return;
        }

        if (deadlineDate.getTime() < new Date().getTime()) {
            showFormError("Please set the response deadline in the future.");
            return;
        }

        setCreating(true);

        try {
            const idToken = await user.getIdToken();

            const response = await fetch("/api/meeting-polls/create-with-discord", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    title: cleanTitle,
                    description: cleanDescription,
                    slots,
                    deadlineIso: deadlineDate.toISOString(),
                    createdByUid: user.uid,
                    createdByName: displayName,
                }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.error || "Could not create the availability check.");
            }

            setCreatedResult({
                pollId: data.pollId,
                participantCount: data.participantCount || 0,
                dmSentCount: data.dmSentCount || 0,
                failedDmMembers: data.failedDmMembers || [],
            });

            setTitle("");
            setDescription("");
            setDateTimeRows([createLocalRow()]);
        } catch (error) {
            console.error("Error creating meeting poll:", error);
            showFormError(
                error instanceof Error
                    ? error.message
                    : "Could not create the availability check."
            );
        } finally {
            setCreating(false);
        }
    }

    async function copyFailedLinks() {
        if (!createdResult?.failedDmMembers?.length) return;

        const text = createdResult.failedDmMembers
            .map((member) => `${member.displayName}\n${member.url}`)
            .join("\n\n");

        await navigator.clipboard.writeText(text);
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
                        You do not have permission to create Staff Meeting polls.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 text-white">
            <style jsx global>{`
        .meeting-native-input {
          color-scheme: dark;
        }

        .meeting-native-input::-webkit-calendar-picker-indicator {
          opacity: 0;
          cursor: pointer;
        }

        .meeting-hidden-date-text {
          color: transparent;
          caret-color: transparent;
        }

        .meeting-hidden-date-text::-webkit-datetime-edit,
        .meeting-hidden-date-text::-webkit-datetime-edit-fields-wrapper,
        .meeting-hidden-date-text::-webkit-datetime-edit-text,
        .meeting-hidden-date-text::-webkit-datetime-edit-month-field,
        .meeting-hidden-date-text::-webkit-datetime-edit-day-field,
        .meeting-hidden-date-text::-webkit-datetime-edit-year-field {
          color: transparent;
        }

        .meeting-hidden-date-text::selection {
          background: transparent;
        }
      `}</style>

            <div className="grid min-h-screen lg:grid-cols-[250px_minmax(0,1fr)]">
                <AdminSidebar
                    active="admin_staff_meetings"
                    sidebarOpen={sidebarOpen}
                    onCloseSidebar={() => setSidebarOpen(false)}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    displayName={displayName}
                    email={user.email}
                />

                <section className="relative bg-zinc-900/75 px-5 py-5 md:px-10 md:py-8 xl:px-14">
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
                            Create Availability Check
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

                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-11 w-11 items-center justify-center border border-blue-400/30 bg-blue-500/10 text-blue-300"
                                    style={{ borderRadius: 8 }}
                                >
                                    <CalendarClock size={21} strokeWidth={1.5} />
                                </div>

                                <div>
                                    <h1 className="text-2xl font-semibold text-white">
                                        Create Availability Check
                                    </h1>
                                    <p className="mt-1 text-sm text-zinc-400">
                                        The system will ping the meeting role and DM each participant their private link.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {pageError ? (
                        <p
                            ref={errorRef}
                            className="mt-5 border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                            style={{ borderRadius: 8 }}
                        >
                            {pageError}
                        </p>
                    ) : null}

                    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                        <form
                            onSubmit={handleCreatePoll}
                            className="border border-zinc-800 bg-zinc-950/35 p-5"
                            style={{ borderRadius: 12 }}
                        >
                            <div className="grid gap-5">
                                <div>
                                    <label className="text-sm font-semibold text-white">
                                        Meeting title
                                    </label>
                                    <input
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        placeholder="FRDA Staff Planning Meeting"
                                        className="mt-2 w-full border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/60"
                                        style={{ borderRadius: 5 }}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-white">
                                        Description
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                        placeholder="Quick planning sync for upcoming FRDA tasks."
                                        rows={3}
                                        className="mt-2 w-full resize-none border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/60"
                                        style={{ borderRadius: 5 }}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-white">
                                        Response deadline
                                    </label>

                                    <div className="relative mt-2 max-w-[420px]">
                                        <input
                                            ref={deadlineInputRef}
                                            type="datetime-local"
                                            value={deadlineInput}
                                            min={getLocalDateTimeValue(new Date())}
                                            onChange={(event) => setDeadlineInput(event.target.value)}
                                            className="meeting-native-input w-full border border-zinc-800 bg-zinc-950 px-4 py-3 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/60"
                                            style={{ borderRadius: 5 }}
                                        />

                                        <button
                                            type="button"
                                            onClick={() => openNativePicker(deadlineInputRef.current)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#cccccc] transition hover:text-white"
                                            aria-label="Open date and time picker"
                                            title="Open date and time picker"
                                        >
                                            <CalendarClock size={17} strokeWidth={1.8} />
                                        </button>
                                    </div>

                                    <p className="mt-2 text-xs text-zinc-500">
                                        All times are treated as Philippine time.
                                    </p>
                                </div>

                                <div>
                                    <div>
                                        <label className="text-sm font-semibold text-white">
                                            Date and time options
                                        </label>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            Add dates, then add one or more meeting times under each
                                            date.
                                        </p>
                                    </div>

                                    <div className="mt-4 grid gap-4">
                                        {dateTimeRows.map((row, rowIndex) => (
                                            <div
                                                key={row.localId}
                                                className="relative max-w-[860px] pr-10"
                                            >
                                                <div
                                                    className="border border-zinc-800 bg-zinc-950/70 p-4"
                                                    style={{ borderRadius: 10 }}
                                                >
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start">
                                                        <div className="md:w-[260px]">
                                                            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                                                Date {rowIndex + 1}
                                                            </label>

                                                            <div
                                                                className="relative mt-2 cursor-pointer"
                                                                onClick={() =>
                                                                    openNativePicker(
                                                                        dateInputRefs.current[row.localId]
                                                                    )
                                                                }
                                                            >
                                                                <input
                                                                    ref={(element) => {
                                                                        dateInputRefs.current[row.localId] = element;
                                                                    }}
                                                                    type="date"
                                                                    value={row.date}
                                                                    min={todayDateValue}
                                                                    onChange={(event) =>
                                                                        updateDate(row.localId, event.target.value)
                                                                    }
                                                                    className="meeting-native-input meeting-hidden-date-text w-full cursor-pointer border border-zinc-800 bg-zinc-950 px-4 py-3 pr-11 text-sm outline-none transition focus:border-blue-400/60"
                                                                    style={{ borderRadius: 5 }}
                                                                    aria-label={`Date ${rowIndex + 1}`}
                                                                />

                                                                <div className="pointer-events-none absolute inset-y-0 left-4 right-11 flex items-center">
                                                                    <span
                                                                        className={
                                                                            row.date
                                                                                ? "truncate text-sm text-white"
                                                                                : "truncate text-sm text-zinc-500"
                                                                        }
                                                                    >
                                                                        {formatReadableDate(row.date)}
                                                                    </span>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        openNativePicker(
                                                                            dateInputRefs.current[row.localId]
                                                                        );
                                                                    }}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#cccccc] transition hover:text-white"
                                                                    aria-label={`Open date picker for date ${rowIndex + 1
                                                                        }`}
                                                                    title="Open date picker"
                                                                >
                                                                    <CalendarDays
                                                                        size={17}
                                                                        strokeWidth={1.8}
                                                                    />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                                                Times
                                                            </label>

                                                            <div className="mt-2 grid gap-2">
                                                                {row.times.map((time, timeIndex) => {
                                                                    const timeKey = `${row.localId}-${timeIndex}`;

                                                                    return (
                                                                        <div
                                                                            key={timeKey}
                                                                            className="flex items-center gap-2"
                                                                        >
                                                                            <div className="relative w-full max-w-[460px]">
                                                                                <input
                                                                                    ref={(element) => {
                                                                                        timeInputRefs.current[timeKey] =
                                                                                            element;
                                                                                    }}
                                                                                    type="time"
                                                                                    value={time}
                                                                                    min={
                                                                                        row.date === todayDateValue
                                                                                            ? currentTimeValue
                                                                                            : undefined
                                                                                    }
                                                                                    onChange={(event) =>
                                                                                        updateTime(
                                                                                            row.localId,
                                                                                            timeIndex,
                                                                                            event.target.value
                                                                                        )
                                                                                    }
                                                                                    className="meeting-native-input w-full border border-zinc-800 bg-zinc-950 px-4 py-3 pr-11 text-sm text-white outline-none transition focus:border-blue-400/60"
                                                                                    style={{ borderRadius: 5 }}
                                                                                />

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        openNativePicker(
                                                                                            timeInputRefs.current[timeKey]
                                                                                        )
                                                                                    }
                                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#cccccc] transition hover:text-white"
                                                                                    aria-label="Open time picker"
                                                                                    title="Open time picker"
                                                                                >
                                                                                    <Clock3
                                                                                        size={17}
                                                                                        strokeWidth={1.8}
                                                                                    />
                                                                                </button>
                                                                            </div>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    removeTime(row.localId, timeIndex)
                                                                                }
                                                                                disabled={row.times.length <= 1}
                                                                                className="inline-flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center text-zinc-300 transition hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                                                                                aria-label="Remove time"
                                                                                title="Remove time"
                                                                            >
                                                                                <X size={17} strokeWidth={2} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => addTime(row.localId)}
                                                                className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-blue-300 transition hover:text-blue-200"
                                                            >
                                                                <Plus size={14} strokeWidth={1.8} />
                                                                Add time
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => removeDateRow(row.localId)}
                                                    disabled={dateTimeRows.length <= 1}
                                                    className="absolute right-0 top-5 inline-flex h-10 w-8 cursor-pointer items-center justify-center text-zinc-300 transition hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                                                    aria-label="Remove date"
                                                    title="Remove date card"
                                                >
                                                    <Trash2 size={16} strokeWidth={1.8} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addDateRow}
                                        className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:border-blue-300/60"
                                        style={{ borderRadius: 5 }}
                                    >
                                        <Plus size={15} strokeWidth={1.8} />
                                        Add date
                                    </button>
                                </div>

                                <div
                                    className="border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100"
                                    style={{ borderRadius: 8 }}
                                >
                                    The system will use the Discord role{" "}
                                    <span className="font-semibold">@Meeting Participants</span>,
                                    post in <span className="font-semibold">#meeting-schedules</span>,
                                    and DM each participant their private availability link.
                                </div>

                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="inline-flex cursor-pointer items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{
                                        borderRadius: 5,
                                        background:
                                            "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                                        border: "1px solid rgba(96, 165, 250, 0.55)",
                                        boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                                    }}
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Creating and notifying...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={16} strokeWidth={1.8} />
                                            Create Availability Check
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        <aside
                            className="border border-zinc-800 bg-zinc-950/35 p-5"
                            style={{ borderRadius: 12 }}
                        >
                            <p className="text-sm font-semibold text-white">
                                Discord automation
                            </p>
                            <p className="mt-2 text-sm text-zinc-400">
                                When created, FRDA Scheduler will ping the meeting role in the
                                meeting channel and send private availability links by DM.
                            </p>

                            <div
                                className="mt-4 border border-zinc-800 bg-zinc-950 p-4"
                                style={{ borderRadius: 8 }}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                    Uses
                                </p>
                                <div className="mt-3 space-y-2 text-sm text-zinc-300">
                                    <p>Channel: #meeting-schedules</p>
                                    <p>Role: @Meeting Participants</p>
                                    <p>Timezone: Philippine time</p>
                                </div>
                            </div>

                            <div
                                className="mt-4 border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100"
                                style={{ borderRadius: 8 }}
                            >
                                If someone has DMs disabled, they will appear in a failed DM
                                list after creation.
                            </div>
                        </aside>
                    </div>

                    {createdResult ? (
                        <div
                            className="mt-7 border border-emerald-500/25 bg-emerald-500/10 p-5"
                            style={{ borderRadius: 12 }}
                        >
                            <div className="flex items-start gap-3">
                                <CheckCircle2
                                    size={18}
                                    strokeWidth={1.8}
                                    className="mt-0.5 text-emerald-300"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-emerald-100">
                                        Availability check created and posted to Discord.
                                    </p>
                                    <p className="mt-1 text-sm text-emerald-100/80">
                                        {createdResult.dmSentCount} of{" "}
                                        {createdResult.participantCount} participant DMs sent.
                                    </p>
                                </div>
                            </div>

                            {createdResult.failedDmMembers.length > 0 ? (
                                <div
                                    className="mt-5 border border-amber-500/25 bg-amber-500/10 p-4"
                                    style={{ borderRadius: 8 }}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-amber-100">
                                                Some DMs failed.
                                            </p>
                                            <p className="mt-1 text-sm text-amber-100/75">
                                                These members may have DMs disabled. You can manually
                                                send them their private links.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={copyFailedLinks}
                                            className="inline-flex cursor-pointer items-center justify-center gap-2 border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100"
                                            style={{ borderRadius: 5 }}
                                        >
                                            <Clipboard size={15} strokeWidth={1.7} />
                                            Copy failed links
                                        </button>
                                    </div>

                                    <div className="mt-4 grid gap-3">
                                        {createdResult.failedDmMembers.map((member) => (
                                            <div
                                                key={member.discordUserId}
                                                className="border border-amber-500/20 bg-zinc-950/60 p-4"
                                                style={{ borderRadius: 8 }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <LinkIcon
                                                        className="mt-0.5 shrink-0 text-amber-300"
                                                        size={16}
                                                        strokeWidth={1.6}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-white">
                                                            {member.displayName}
                                                        </p>
                                                        <p className="mt-1 break-all text-xs text-amber-100/80">
                                                            {member.url}
                                                        </p>
                                                        <p className="mt-1 text-xs text-zinc-500">
                                                            {member.error}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(`/admin/meeting-polls/${createdResult.pollId}`)
                                    }
                                    className="cursor-pointer border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60"
                                    style={{ borderRadius: 5 }}
                                >
                                    View results
                                </button>

                                <button
                                    type="button"
                                    onClick={() => router.push("/admin/meeting-polls")}
                                    className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:border-blue-400/60"
                                    style={{ borderRadius: 5 }}
                                >
                                    Back to Staff Meetings
                                </button>
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>
        </main>
    );
}