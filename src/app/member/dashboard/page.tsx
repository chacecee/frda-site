"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    BadgeCheck,
    Gamepad2,
    IdCard,
    LoaderCircle,
    UserRound,
} from "lucide-react";
import MemberSubmitGameModal from "@/components/games/MemberSubmitGameModal";
import { notify } from "@/components/ToastConfig";
import MemberPortalHeader from "@/components/member/MemberPortalHeader";
import { useAuthUser } from "@/lib/useAuthUser";

type AccountPurpose =
    | "developer"
    | "talent_seeker"
    | "both";

type MemberAccount = {
    uid: string;
    memberId: string;
    email: string;
    displayName: string;
    accountPurpose: AccountPurpose;
    accountStatus: string;
    memberStatus: string;
    profileStatus: string;
    avatarUrl: string;
    talentSeekerStatus:
        | "not_required"
        | "not_submitted"
        | "pending"
        | "verified"
        | "rejected"
        | "suspended";
    talentSeekerReviewerNote: string;
    talentSeekerSubmittedAt: string | null;
    talentSeekerReviewedAt: string | null;

    memberListingLimit: number;
    paidListingCredits: number;
    sponsoredPlacementsPurchased: number;

    listingsApproved: number;
    listingsPendingReview: number;
    availableListings: number;

    source: string;
    sourceApplicationId: string;
    activatedAt: string | null;

    discordInviteUrl: string;
    discordInviteExpiresAt: string | null;
    discordInviteError: string;
};

function getPurposeLabel(
    value: AccountPurpose
): string {
    switch (value) {
        case "developer":
            return "Developer";
        case "talent_seeker":
            return "Talent Seeker";
        case "both":
            return "Developer and Talent Seeker";
        default:
            return value;
    }
}

function getProfileStatusLabel(
    value: string
): string {
    switch (value) {
        case "draft":
            return "Draft";
        case "live":
            return "Published";
        case "hidden":
            return "Hidden";
        case "not_started":
            return "Not Started";
        case "not_applicable":
            return "Not Applicable";
        default:
            return value || "—";
    }
}

function getTalentSeekerStatusLabel(
    value: MemberAccount["talentSeekerStatus"]
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
            return "Not Applicable";
    }
}

function getTalentSeekerStatusClass(
    value: MemberAccount["talentSeekerStatus"]
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
            return "border-zinc-600 bg-zinc-800 text-zinc-300";
    }
}

function formatDate(
    value?: string | null
): string {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
    }).format(date);
}

export default function MemberDashboardPage() {
    const router = useRouter();
    const { user, authLoading } =
        useAuthUser();

    const [member, setMember] =
        useState<MemberAccount | null>(null);

    const [loadingMember, setLoadingMember] =
        useState(true);

    const [errorMessage, setErrorMessage] =
        useState("");

    const [
        submitGameModalOpen,
        setSubmitGameModalOpen,
    ] = useState(false);

    const [
        generatingDiscordInvite,
        setGeneratingDiscordInvite,
    ] = useState(false);


    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/member/login");
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!user) return;

        const currentUser = user;
        let cancelled = false;

        async function loadMember() {
            setLoadingMember(true);
            setErrorMessage("");

            try {
                const idToken =
                    await currentUser.getIdToken();

                const response = await fetch(
                    "/api/member/me",
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
                        "Could not load your membership account."
                    );
                }

                if (!cancelled) {
                    setMember(result.member);
                }
            } catch (error) {
                console.error(
                    "Member dashboard load error:",
                    error
                );

                if (!cancelled) {
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : "Could not load your membership account."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingMember(false);
                }
            }
        }

        loadMember();

        return () => {
            cancelled = true;
        };
    }, [user]);



    async function refreshMember() {
        if (!user) return;

        const idToken =
            await user.getIdToken();

        const response = await fetch(
            "/api/member/me",
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
                "Could not refresh your membership account."
            );
        }

        setMember(result.member);
    }

    async function generateDiscordInvite() {
        if (
            !user ||
            generatingDiscordInvite
        ) {
            return;
        }

        setGeneratingDiscordInvite(true);

        try {
            const idToken =
                await user.getIdToken();

            const response = await fetch(
                "/api/member/discord-invite",
                {
                    method: "POST",
                    headers: {
                        Authorization:
                            `Bearer ${idToken}`,
                    },
                }
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error ||
                    "Could not generate a Discord invitation."
                );
            }

            await refreshMember();

            notify.success(
                result.reused
                    ? "Your active Discord invitation is ready."
                    : "A new Discord invitation was generated."
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not generate a Discord invitation.";

            notify.error(message);
        } finally {
            setGeneratingDiscordInvite(false);
        }
    }

    async function handleSignOut() {
        try {
            const { signOut } =
                await import("firebase/auth");

            const { auth } =
                await import("@/lib/firebase");

            await signOut(auth);

            router.replace(
                "/member/login"
            );
        } catch (error) {
            console.error(
                "Member sign-out error:",
                error
            );
        }
    }

    const discordInviteActive =
        Boolean(member?.discordInviteUrl) &&
        Boolean(
            member?.discordInviteExpiresAt
        ) &&
        new Date(
            member?.discordInviteExpiresAt || ""
        ).getTime() > Date.now();

    if (
        authLoading ||
        (!user && !errorMessage)
    ) {
        return (
            <main className="min-h-screen bg-[#061533] px-5 py-12 text-white">
                <p className="text-center text-sm text-zinc-400">
                    Checking your account...
                </p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#071225] text-white">
            <MemberPortalHeader
                active="dashboard"
                accountPurpose={member?.accountPurpose}
            />

            <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
                {loadingMember ? (
                    <div
                        className="border border-white/10 bg-white/[0.025] p-6 text-sm text-zinc-400"
                        style={{ borderRadius: 8 }}
                    >
                        Loading your membership account...
                    </div>
                ) : errorMessage ? (
                    <div
                        className="border border-red-500/25 bg-red-500/10 p-5 text-sm leading-6 text-red-200"
                        style={{ borderRadius: 8 }}
                    >
                        <p>{errorMessage}</p>

                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="mt-4 cursor-pointer border border-red-400/30 px-4 py-2 text-sm font-medium text-red-100"
                            style={{ borderRadius: 5 }}
                        >
                            Return to login
                        </button>
                    </div>
                ) : member ? (
                    <>
                        <div className="mb-8 flex items-center gap-4">
                            {member.avatarUrl ? (
                                <img
                                    src={member.avatarUrl}
                                    alt=""
                                    className="h-16 w-16 rounded-full object-cover"
                                />
                            ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15 text-lg font-semibold text-blue-200">
                                    {member.displayName
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
                                <p className="text-sm font-medium text-sky-300">
                                    Welcome back
                                </p>

                                <h1 className="mt-1 text-3xl font-semibold text-white">
                                    {member.displayName}
                                </h1>

                                <p className="mt-2 text-sm text-zinc-400">
                                    Manage your FRDA membership and developer presence.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                            <div className="space-y-5">
                                <section
                                    className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
                                    style={{ borderRadius: 8 }}
                                >
                                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                                        <IdCard size={19} className="text-sky-300" />
                                        Membership Details
                                    </h2>

                                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Member ID
                                            </p>
                                            <p className="mt-2 text-base font-semibold text-white">
                                                {member.memberId}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Account Type
                                            </p>
                                            <p className="mt-2 text-sm text-zinc-200">
                                                {getPurposeLabel(
                                                    member.accountPurpose
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Email
                                            </p>
                                            <p className="mt-2 break-words text-sm text-zinc-200">
                                                {member.email}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Activated
                                            </p>
                                            <p className="mt-2 text-sm text-zinc-200">
                                                {formatDate(
                                                    member.activatedAt
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {(member.accountPurpose ===
                                    "developer" ||
                                    member.accountPurpose ===
                                    "both") ? (
                                    <section
                                        className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
                                        style={{ borderRadius: 8 }}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                                                    <UserRound size={19} className="text-sky-300" />
                                                    Developer Profile
                                                </h2>

                                                <p className="mt-2 text-sm leading-6 text-zinc-400">
                                                    Complete your profile before
                                                    requesting publication in the
                                                    developer directory.
                                                </p>
                                            </div>

                                            <span
                                                className="inline-flex w-fit border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200"
                                                style={{
                                                    borderRadius: 999,
                                                }}
                                            >
                                                {getProfileStatusLabel(
                                                    member.profileStatus
                                                )}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push("/member/profile")
                                            }
                                            className="mt-5 cursor-pointer bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                                            style={{ borderRadius: 5 }}
                                        >
                                            Edit Developer Profile
                                        </button>
                                    </section>
                                ) : null}

                                {(member.accountPurpose ===
                                    "talent_seeker" ||
                                    member.accountPurpose ===
                                    "both") ? (
                                    <section
                                        className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
                                        style={{ borderRadius: 8 }}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                                                    <BadgeCheck size={19} className="text-sky-300" />
                                                    Talent-Seeker Verification
                                                </h2>

                                                <p className="mt-2 text-sm leading-6 text-zinc-400">
                                                    Verification is required before
                                                    this account can contact developers
                                                    through the FRDA directory.
                                                </p>
                                            </div>

                                            <span
                                                className={`inline-flex w-fit border px-3 py-1.5 text-xs font-medium ${getTalentSeekerStatusClass(
                                                    member.talentSeekerStatus
                                                )}`}
                                                style={{
                                                    borderRadius: 999,
                                                }}
                                            >
                                                {getTalentSeekerStatusLabel(
                                                    member.talentSeekerStatus
                                                )}
                                            </span>
                                        </div>

                                        {member.talentSeekerReviewerNote ? (
                                            <div
                                                className="mt-5 border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100"
                                                style={{ borderRadius: 8 }}
                                            >
                                                <p className="font-semibold">
                                                    FRDA review note
                                                </p>

                                                <p className="mt-2">
                                                    {
                                                        member
                                                            .talentSeekerReviewerNote
                                                    }
                                                </p>
                                            </div>
                                        ) : null}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(
                                                    "/member/talent-seeker-profile"
                                                )
                                            }
                                            className="mt-5 cursor-pointer bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                                            style={{ borderRadius: 5 }}
                                        >
                                            {member.talentSeekerStatus ===
                                            "not_submitted"
                                                ? "Complete Verification"
                                                : member.talentSeekerStatus ===
                                                    "rejected"
                                                  ? "Review and Resubmit"
                                                  : "View Verification"}
                                        </button>
                                    </section>
                                ) : null}

                                {(member.accountPurpose ===
                                    "developer" ||
                                    member.accountPurpose ===
                                    "both") ? (
                                    <section
                                        className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
                                        style={{ borderRadius: 8 }}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                                                    <Gamepad2 size={19} className="text-sky-300" />
                                                    Game Directory Access
                                                </h2>

                                                <p className="mt-2 text-sm leading-6 text-zinc-400">
                                                    Submit up to your available listing allowance for FRDA review.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSubmitGameModalOpen(true)
                                                }
                                                disabled={
                                                    member.availableListings <= 0
                                                }
                                                className="cursor-pointer bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                style={{ borderRadius: 6 }}
                                            >
                                                Submit Your Game
                                            </button>
                                        </div>

                                        <div className="mt-6 grid grid-cols-3 divide-x divide-white/10">
                                            <div className="min-w-0 pr-3 sm:pr-5">
                                                <p className="truncate text-[10px] uppercase tracking-[0.08em] text-zinc-500 sm:text-xs sm:tracking-wide">
                                                    Approved
                                                </p>

                                                <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                                                    {member.listingsApproved}
                                                </p>
                                            </div>

                                            <div className="min-w-0 px-3 sm:px-5">
                                                <p className="truncate text-[10px] uppercase tracking-[0.08em] text-zinc-500 sm:text-xs sm:tracking-wide">
                                                    Pending
                                                </p>

                                                <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                                                    {member.listingsPendingReview}
                                                </p>
                                            </div>

                                            <div className="min-w-0 pl-3 sm:pl-5">
                                                <p className="truncate text-[10px] uppercase tracking-[0.08em] text-zinc-500 sm:text-xs sm:tracking-wide">
                                                    Available
                                                </p>

                                                <p className="mt-2 text-2xl font-semibold text-sky-200 sm:text-3xl">
                                                    {member.availableListings}
                                                </p>
                                            </div>
                                        </div>

                                        {member.availableListings <= 0 ? (
                                            <p className="mt-5 text-xs leading-5 text-zinc-500">
                                                You currently have no available listing slots. Rejected or archived submissions do not consume a slot.
                                            </p>
                                        ) : null}
                                    </section>
                                ) : null}
                            </div>

                            <aside className="space-y-5">
                                <section
                                    className="border border-indigo-400/20 bg-indigo-500/10 p-5"
                                    style={{ borderRadius: 8 }}
                                >
                                    <h2 className="font-semibold text-white">
                                        FRDA Discord
                                    </h2>

                                    {discordInviteActive ? (
                                        <>
                                            <p className="mt-2 text-sm leading-6 text-zinc-300">
                                                Your private Discord invitation is ready. It grants the FRDA Member role automatically.
                                            </p>

                                            <a
                                                href={member.discordInviteUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-5 inline-flex items-center gap-2 bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
                                                style={{ borderRadius: 6 }}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    className="h-4 w-4 fill-current"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M19.54 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.03a15.3 15.3 0 0 0-5.88 0L8.55 4a16.5 16.5 0 0 0-4.1 1.35C1.86 9.2 1.16 12.95 1.5 16.65a16.7 16.7 0 0 0 5.03 2.55l1.22-1.67a10.7 10.7 0 0 1-1.92-.92l.47-.36c3.7 1.72 7.72 1.72 11.38 0l.48.36c-.62.37-1.26.68-1.93.92l1.22 1.67a16.6 16.6 0 0 0 5.03-2.55c.4-4.29-.7-8-2.94-11.31ZM8.67 14.56c-1.11 0-2.03-1.03-2.03-2.3s.9-2.31 2.03-2.31c1.14 0 2.05 1.04 2.03 2.31 0 1.27-.9 2.3-2.03 2.3Zm6.66 0c-1.11 0-2.03-1.03-2.03-2.3s.9-2.31 2.03-2.31c1.14 0 2.05 1.04 2.03 2.31 0 1.27-.89 2.3-2.03 2.3Z" />
                                                </svg>
                                                Join FRDA Discord
                                            </a>

                                            <p className="mt-3 text-xs leading-5 text-zinc-400">
                                                Expires{" "}
                                                {formatDate(
                                                    member.discordInviteExpiresAt
                                                )}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="mt-2 text-sm leading-6 text-zinc-300">
                                                Your previous invitation has expired or is unavailable.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={generateDiscordInvite}
                                                disabled={generatingDiscordInvite}
                                                className="mt-5 inline-flex cursor-pointer items-center gap-2 bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                                                style={{ borderRadius: 6 }}
                                            >
                                                {generatingDiscordInvite ? (
                                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        className="h-4 w-4 fill-current"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="M19.54 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.03a15.3 15.3 0 0 0-5.88 0L8.55 4a16.5 16.5 0 0 0-4.1 1.35C1.86 9.2 1.16 12.95 1.5 16.65a16.7 16.7 0 0 0 5.03 2.55l1.22-1.67a10.7 10.7 0 0 1-1.92-.92l.47-.36c3.7 1.72 7.72 1.72 11.38 0l.48.36c-.62.37-1.26.68-1.93.92l1.22 1.67a16.6 16.6 0 0 0 5.03-2.55c.4-4.29-.7-8-2.94-11.31ZM8.67 14.56c-1.11 0-2.03-1.03-2.03-2.3s.9-2.31 2.03-2.31c1.14 0 2.05 1.04 2.03 2.31 0 1.27-.9 2.3-2.03 2.3Zm6.66 0c-1.11 0-2.03-1.03-2.03-2.3s.9-2.31 2.03-2.31c1.14 0 2.05 1.04 2.03 2.31 0 1.27-.89 2.3-2.03 2.3Z" />
                                                    </svg>
                                                )}
                                                {generatingDiscordInvite
                                                    ? "Generating..."
                                                    : "Generate New Invite"}
                                            </button>
                                        </>
                                    )}
                                </section>


                            </aside>
                        </div>
                    </>
                ) : null}
            </section>

            {member ? (
                <MemberSubmitGameModal
                    open={submitGameModalOpen}
                    displayName={member.displayName}
                    onClose={() =>
                        setSubmitGameModalOpen(false)
                    }
                    onSuccess={async () => {
                        setSubmitGameModalOpen(false);

                        try {
                            await refreshMember();
                        } catch (error) {
                            console.error(
                                "Refresh listing counts error:",
                                error
                            );
                        }
                    }}
                />
            ) : null}

        </main>
    );
}