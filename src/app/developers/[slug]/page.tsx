"use client";

import {
    useEffect,
    useState,
} from "react";

import {
    useParams,
    useRouter,
} from "next/navigation";

import {
    motion,
} from "framer-motion";

import {
    Bookmark,
    LoaderCircle,
} from "lucide-react";

import {
    signOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { notify } from "@/components/ToastConfig";
import {
    getGameGenreLabel,
    type GameDirectoryGenre,
} from "@/lib/gameDirectory";
import {
    logAnalyticsEvent,
} from "@/lib/analytics";

import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

import ProfileShowcase, {
    type PublicShowcaseImage,
} from "@/components/developers/ProfileShowcase";

import ProjectDetailsModal, {
    type PublicProjectDetails,
} from "@/components/developers/ProjectDetailsModal";

type PublicWorkSample =
    PublicProjectDetails;

type PublicDeveloperProfile = {
    uid: string;
    memberId: string;
    slug: string;

    displayName: string;
    headline: string;
    bio: string;

    skills: string[];
    genreExperience: GameDirectoryGenre[];

    availability: string;
    availabilityLabel: string;

    deliveryScope: string;
    deliveryScopeLabel: string;

    portfolioUrl: string;
    avatarUrl: string;

    workSamples:
    PublicWorkSample[];

    showcaseImages:
    PublicShowcaseImage[];

    publishedAt: string | null;
    updatedAt: string | null;

    isVerified: boolean;
    isFeatured: boolean;
    saveCount: number;
};

type ReportReason =
    | "false_claims"
    | "stolen_work"
    | "impersonation"
    | "inappropriate_content"
    | "spam"
    | "other";

type ContactAccessState =
    | "checking"
    | "logged_out"
    | "developer_only"
    | "not_submitted"
    | "pending"
    | "rejected"
    | "suspended"
    | "verified";

type ContactFormState = {
    inquiryType:
    | "paid_project"
    | "employment"
    | "collaboration"
    | "publishing"
    | "other";

    opportunityTitle: string;
    organizationName: string;
    relevantUrl: string;
    message: string;
};

const EMPTY_CONTACT_FORM:
    ContactFormState = {
    inquiryType: "paid_project",
    opportunityTitle: "",
    organizationName: "",
    relevantUrl: "",
    message: "",
};

function getAvailabilityClass(
    label: string,
): string {
    const normalized =
        label.trim().toLowerCase();

    if (
        normalized.includes("limited")
    ) {
        return "border-amber-400/30 bg-amber-500/12 text-amber-200";
    }

    if (
        normalized.includes(
            "not currently",
        )
    ) {
        return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
    }

    if (
        normalized.includes(
            "collaboration",
        )
    ) {
        return "border-violet-400/30 bg-violet-500/12 text-violet-200";
    }

    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
}

function getInitials(value: string): string {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}


type LoadingImageProps = {
    src: string;
    alt: string;
    className: string;
};

function LoadingImage({
    src,
    alt,
    className,
}: LoadingImageProps) {
    const [loaded, setLoaded] =
        useState(false);

    return (
        <div className="relative h-full w-full">
            {!loaded ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                    <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                </div>
            ) : null}

            <img
                src={src}
                alt={alt}
                onLoad={() =>
                    setLoaded(true)
                }
                onError={() =>
                    setLoaded(true)
                }
                className={`${className} transition-opacity duration-300 ${loaded
                    ? "opacity-100"
                    : "opacity-0"
                    }`}
            />
        </div>
    );
}

function getYouTubeVideoId(
    value: string
): string {
    if (!value) return "";

    try {
        const url = new URL(value);
        const hostname =
            url.hostname
                .toLowerCase()
                .replace(/^www\./, "");

        if (hostname === "youtu.be") {
            return (
                url.pathname
                    .split("/")
                    .filter(Boolean)[0] ||
                ""
            );
        }

        if (
            hostname === "youtube.com" ||
            hostname === "m.youtube.com"
        ) {
            if (url.pathname === "/watch") {
                return (
                    url.searchParams.get("v") ||
                    ""
                );
            }

            const parts =
                url.pathname
                    .split("/")
                    .filter(Boolean);

            if (
                parts[0] === "shorts" ||
                parts[0] === "embed" ||
                parts[0] === "live"
            ) {
                return parts[1] || "";
            }
        }
    } catch {
        return "";
    }

    return "";
}

export default function PublicDeveloperProfilePage() {
    const router = useRouter();

    const {
        user,
        authLoading,
    } = useAuthUser();

    const params = useParams<{
        slug: string;
    }>();

    const slug =
        typeof params?.slug === "string"
            ? params.slug
            : "";

    const [profile, setProfile] =
        useState<PublicDeveloperProfile | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [pageError, setPageError] =
        useState("");

    const [reportOpen, setReportOpen] =
        useState(false);

    const [reportReason, setReportReason] =
        useState<ReportReason>("false_claims");

    const [reportDetails, setReportDetails] =
        useState("");

    const [reporterEmail, setReporterEmail] =
        useState("");

    const [submittingReport, setSubmittingReport] =
        useState(false);

    const [reportError, setReportError] =
        useState("");

    const [reportSuccess, setReportSuccess] =
        useState("");

    const [contactOpen, setContactOpen] =
        useState(false);

    const [contactAccess, setContactAccess] =
        useState<ContactAccessState>("checking");

    const [contactForm, setContactForm] =
        useState<ContactFormState>(
            EMPTY_CONTACT_FORM
        );

    const [contactError, setContactError] =
        useState("");

    const [submittingContact, setSubmittingContact] =
        useState(false);

    const [
        selectedProject,
        setSelectedProject,
    ] = useState<PublicWorkSample | null>(
        null
    );

    const [isStandalone, setIsStandalone] =
        useState(false);

    const [
        browseDevelopersHref,
        setBrowseDevelopersHref,
    ] = useState("/developers");

    const [
        showStickyContact,
        setShowStickyContact,
    ] = useState(false);

    const [isSaved, setIsSaved] =
        useState(false);

    const [initiallySaved, setInitiallySaved] =
        useState(false);

    const [savingDeveloper, setSavingDeveloper] =
        useState(false);

    const [saveAccountPromptOpen, setSaveAccountPromptOpen] =
        useState(false);

    const isOwnProfile =
        Boolean(
            user &&
            profile &&
            user.uid === profile.uid
        );

    useEffect(() => {
        const hostname =
            window.location.hostname
                .toLowerCase();

        const isDeveloperSubdomain =
            (
                hostname.endsWith(
                    ".frdaph.org"
                ) &&
                hostname !==
                "www.frdaph.org"
            ) ||
            hostname.endsWith(
                ".localhost"
            );

        setIsStandalone(
            isDeveloperSubdomain
        );

        if (
            hostname.endsWith(
                ".localhost"
            )
        ) {
            setBrowseDevelopersHref(
                `http://localhost${window.location.port
                    ? `:${window.location.port}`
                    : ""
                }/developers`
            );
        } else if (
            hostname.endsWith(
                ".frdaph.org"
            ) &&
            hostname !==
                "www.frdaph.org"
        ) {
            setBrowseDevelopersHref(
                "https://frdaph.org/developers"
            );
        }
    }, []);

    useEffect(() => {
        function handleScroll() {
            setShowStickyContact(
                window.scrollY > 420
            );
        }

        handleScroll();

        window.addEventListener(
            "scroll",
            handleScroll,
            { passive: true }
        );

        return () => {
            window.removeEventListener(
                "scroll",
                handleScroll
            );
        };
    }, []);

    useEffect(() => {
        if (!slug) return;

        let cancelled = false;

        async function loadProfile() {
            setLoading(true);
            setPageError("");

            try {
                const response = await fetch(
                    `/api/public/developers/${encodeURIComponent(
                        slug
                    )}`,
                    {
                        cache: "no-store",
                    }
                );

                const result = await response
                    .json()
                    .catch(() => null);

                if (!response.ok || !result?.ok) {
                    throw new Error(
                        result?.error ||
                        "Developer profile not found."
                    );
                }

                if (!cancelled) {
                    setProfile(result.profile);
                }
            } catch (error) {
                if (!cancelled) {
                    setPageError(
                        error instanceof Error
                            ? error.message
                            : "Developer profile not found."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    useEffect(() => {
        if (!profile) {
            return;
        }

        void logAnalyticsEvent({
            eventName:
                "developer_profile_view",
            metadata: {
                developerUid:
                    profile.uid,
                developerSlug:
                    profile.slug,
                developerName:
                    profile.displayName,
            },
        });
    }, [profile]);

    useEffect(() => {
        if (!user || !profile) {
            setIsSaved(false);
            return;
        }

        const currentUser = user;
        const developerUid =
            profile.uid;
        let cancelled = false;

        async function loadSavedState() {
            try {
                const idToken =
                    await currentUser.getIdToken();

                const response = await fetch(
                    "/api/member/saved-developers",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${idToken}`,
                        },
                        cache: "no-store",
                    },
                );

                const result = await response
                    .json()
                    .catch(() => null);

                if (
                    response.ok &&
                    result?.ok &&
                    !cancelled
                ) {
                    const saved =
                        (
                            result.savedDeveloperUids ||
                            []
                        ).includes(
                            developerUid,
                        );

                    setIsSaved(saved);
                    setInitiallySaved(saved);
                }
            } catch (error) {
                console.error(
                    "Load saved developer state error:",
                    error,
                );
            }
        }

        loadSavedState();

        return () => {
            cancelled = true;
        };
    }, [user, profile]);

    async function toggleSavedDeveloper() {
        if (
            authLoading ||
            !profile ||
            savingDeveloper
        ) {
            return;
        }

        if (!user) {
            setSaveAccountPromptOpen(true);
            return;
        }

        if (isOwnProfile) {
            notify.error(
                "You cannot save your own developer profile.",
            );
            return;
        }

        const previousState = isSaved;

        setSavingDeveloper(true);
        setIsSaved(!previousState);

        try {
            const idToken =
                await user.getIdToken();

            const response = await fetch(
                "/api/member/saved-developers",
                {
                    method:
                        previousState
                            ? "DELETE"
                            : "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        developerUid:
                            profile.uid,
                    }),
                },
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error ||
                    "Could not update your bookmarked developers.",
                );
            }

            notify.success(
                previousState
                    ? "Developer removed from your bookmarks."
                    : "Developer bookmarked.",
            );
        } catch (error) {
            setIsSaved(previousState);

            notify.error(
                error instanceof Error
                    ? error.message
                    : "Could not update your bookmarked developers.",
            );
        } finally {
            setSavingDeveloper(false);
        }
    }

    function openAccountModal(
        tab: "signup" | "login",
        purpose?: "talent_seeker",
    ) {
        closeContactModal();

        const hostname =
            window.location.hostname.toLowerCase();

        const port =
            window.location.port
                ? `:${window.location.port}`
                : "";

        const mainOrigin =
            hostname.endsWith(".localhost")
                ? `http://localhost${port}`
                : "https://frdaph.org";

        const targetUrl =
            new URL(
                `/developers/${encodeURIComponent(
                    slug
                )}`,
                mainOrigin
            );

        targetUrl.searchParams.set(
            "account",
            tab
        );

        if (purpose) {
            targetUrl.searchParams.set(
                "purpose",
                purpose
            );
        }

        window.location.assign(
            targetUrl.toString()
        );
    }

    async function openContactModal() {
        if (profile) {
            void logAnalyticsEvent({
                eventName:
                    "developer_contact_click",
                metadata: {
                    developerUid:
                        profile.uid,
                    developerSlug:
                        profile.slug,
                    developerName:
                        profile.displayName,
                },
            });
        }

        setContactOpen(true);
        setContactError("");
        setContactForm(
            EMPTY_CONTACT_FORM
        );

        if (
            authLoading ||
            !user
        ) {
            setContactAccess(
                authLoading
                    ? "checking"
                    : "logged_out"
            );
            return;
        }

        setContactAccess("checking");

        try {
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

            if (
                !response.ok ||
                !result?.ok
            ) {
                throw new Error(
                    result?.error ||
                    "Could not verify your account access."
                );
            }

            const member =
                result.member;

            if (
                member.accountPurpose !==
                "talent_seeker" &&
                member.accountPurpose !==
                "both"
            ) {
                setContactAccess(
                    "developer_only"
                );
                return;
            }

            const status =
                member.talentSeekerStatus;

            if (
                status === "verified"
            ) {
                setContactAccess(
                    "verified"
                );

                setContactForm(
                    (current) => ({
                        ...current,
                        organizationName:
                            member
                                .talentSeekerProfile
                                ?.organizationName ||
                            "",
                    })
                );

                return;
            }

            if (
                status === "pending" ||
                status === "rejected" ||
                status === "suspended" ||
                status === "not_submitted"
            ) {
                setContactAccess(status);
                return;
            }

            setContactAccess(
                "not_submitted"
            );
        } catch (error) {
            setContactError(
                error instanceof Error
                    ? error.message
                    : "Could not verify your account access."
            );
            setContactAccess(
                "logged_out"
            );
        }
    }

    function closeContactModal() {
        if (submittingContact) {
            return;
        }

        setContactOpen(false);
        setContactError("");
    }

    async function submitContactRequest(
        event:
            React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (
            !user ||
            !profile ||
            submittingContact
        ) {
            return;
        }

        setSubmittingContact(true);
        setContactError("");

        try {
            const idToken =
                await user.getIdToken();

            const response = await fetch(
                "/api/member/developer-connection-requests",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                        developerSlug:
                            profile.slug,
                        inquiryType:
                            contactForm.inquiryType,
                        opportunityTitle:
                            contactForm
                                .opportunityTitle
                                .trim(),
                        organizationName:
                            contactForm
                                .organizationName
                                .trim(),
                        relevantUrl:
                            contactForm
                                .relevantUrl
                                .trim(),
                        message:
                            contactForm
                                .message
                                .trim(),
                    }),
                }
            );

            const result = await response
                .json()
                .catch(() => null);

            if (
                !response.ok ||
                !result?.ok
            ) {
                throw new Error(
                    result?.error ||
                    "Could not send your connection request."
                );
            }

            notify.success(
                result.message
            );

            setContactForm(
                EMPTY_CONTACT_FORM
            );

            setContactOpen(false);
        } catch (error) {
            setContactError(
                error instanceof Error
                    ? error.message
                    : "Could not send your connection request."
            );
        } finally {
            setSubmittingContact(false);
        }
    }

    function openProjectDetails(
        project: PublicWorkSample
    ) {
        if (profile) {
            void logAnalyticsEvent({
                eventName:
                    "developer_project_view",
                metadata: {
                    developerUid:
                        profile.uid,
                    developerSlug:
                        profile.slug,
                    developerName:
                        profile.displayName,
                    projectId:
                        project.id,
                    projectTitle:
                        project.title,
                },
            });
        }

        setSelectedProject(
            project
        );
    }

    function trackProjectLink(
        project: PublicWorkSample
    ) {
        if (!profile) {
            return;
        }

        void logAnalyticsEvent({
            eventName:
                "developer_project_link_click",
            metadata: {
                developerUid:
                    profile.uid,
                developerSlug:
                    profile.slug,
                developerName:
                    profile.displayName,
                projectId:
                    project.id,
                projectTitle:
                    project.title,
            },
        });
    }

    function trackPortfolioClick() {
        if (!profile) {
            return;
        }

        void logAnalyticsEvent({
            eventName:
                "developer_portfolio_click",
            metadata: {
                developerUid:
                    profile.uid,
                developerSlug:
                    profile.slug,
                developerName:
                    profile.displayName,
            },
        });
    }

    function openReportModal() {
        setReportReason("false_claims");
        setReportDetails("");
        setReporterEmail("");
        setReportError("");
        setReportSuccess("");
        setReportOpen(true);
    }

    function closeReportModal() {
        if (submittingReport) return;

        setReportOpen(false);
        setReportError("");
        setReportSuccess("");
    }

    async function submitReport(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!slug || submittingReport) return;

        setSubmittingReport(true);
        setReportError("");
        setReportSuccess("");

        try {
            const response = await fetch(
                `/api/public/developers/${encodeURIComponent(
                    slug
                )}/report`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        reason: reportReason,
                        details: reportDetails.trim(),
                        reporterEmail: reporterEmail.trim(),
                    }),
                }
            );

            const result = await response
                .json()
                .catch(() => null);

            if (!response.ok || !result?.ok) {
                throw new Error(
                    result?.error ||
                    "Could not submit this profile report."
                );
            }

            setReportSuccess(result.message);
            setReportDetails("");
            setReporterEmail("");
        } catch (error) {
            setReportError(
                error instanceof Error
                    ? error.message
                    : "Could not submit this profile report."
            );
        } finally {
            setSubmittingReport(false);
        }
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#030713] text-white">
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#07101f_0%,#040817_42%,#030713_100%)]" />

                <div className="absolute left-[-180px] top-[-120px] h-[520px] w-[520px] rounded-full bg-blue-500/16 blur-[140px]" />

                <div className="absolute left-1/2 top-[80px] h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-blue-400/10 blur-[150px]" />

                <div className="absolute right-[-160px] top-[120px] h-[620px] w-[620px] rounded-full bg-cyan-400/14 blur-[170px]" />

                <div className="absolute right-[8%] top-[45%] h-[420px] w-[420px] rounded-full bg-teal-400/10 blur-[140px]" />

                <div className="absolute bottom-[-180px] left-[-100px] h-[420px] w-[420px] rounded-full bg-indigo-500/12 blur-[150px]" />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.10),transparent_26%),radial-gradient(circle_at_82%_22%,rgba(45,212,191,0.10),transparent_24%),radial-gradient(circle_at_72%_60%,rgba(34,211,238,0.08),transparent_18%),radial-gradient(circle_at_30%_85%,rgba(99,102,241,0.08),transparent_24%)]" />

                <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:72px_72px]" />

                <div className="absolute inset-y-0 right-[14%] w-[280px] bg-[linear-gradient(90deg,transparent,rgba(45,212,191,0.06),transparent)] blur-[40px]" />

                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.015)_18%,rgba(2,6,23,0.08)_38%,rgba(2,6,23,0.22)_70%,rgba(2,6,23,0.45)_100%)]" />

                <div className="absolute inset-0 backdrop-[blur(1.2px)]" />
            </div>

            <div className="relative z-10">
                {!isStandalone ? (
                    <SiteHeader />
                ) : null}

            <section
                className={`mx-auto w-full max-w-6xl px-3 pb-20 sm:px-5 md:px-8 md:pb-24 ${isStandalone
                    ? "pt-10 md:pt-16"
                    : "pt-32 md:pt-40"
                    }`}
            >
                {!isStandalone ? (
                    <a
                        href={browseDevelopersHref}
                        className="mb-6 inline-flex text-sm font-medium text-blue-300 hover:text-blue-200"
                    >
                        ← Browse all developers
                    </a>
                ) : null}
                {loading ? (
                    <div
                        className="border border-white/10 bg-white/[0.025] p-6 text-sm text-zinc-400"
                        style={{ borderRadius: 8 }}
                    >
                        Loading developer profile...
                    </div>
                ) : pageError ? (
                    <div
                        className="border border-red-500/25 bg-red-500/10 p-6"
                        style={{ borderRadius: 8 }}
                    >
                        <h1 className="text-xl font-semibold text-white">
                            Profile unavailable
                        </h1>

                        <p className="mt-3 text-sm leading-6 text-red-200">
                            {pageError}
                        </p>
                    </div>
                ) : profile ? (
                    <>
                        <article
                            className="overflow-hidden rounded-[11px] bg-transparent shadow-none sm:border sm:border-white/15 sm:bg-[#0a172a]/68 sm:backdrop-blur-3xl sm:shadow-[0_22px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(59,130,246,0.05),0_0_62px_rgba(37,99,235,0.16),0_0_120px_rgba(14,165,233,0.07)]"
                        >
                            <div className="relative overflow-hidden bg-transparent sm:border-b sm:border-white/10 sm:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_46%)]">
                                {profile.availabilityLabel ? (
                                    <span
                                        className={`absolute left-5 top-5 z-30 hidden items-center gap-2 border px-3 py-1.5 text-xs font-medium backdrop-blur-sm sm:inline-flex ${getAvailabilityClass(
                                            profile.availabilityLabel,
                                        )}`}
                                        style={{
                                            borderRadius: 999,
                                        }}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                profile.availabilityLabel
                                                    .toLowerCase()
                                                    .includes("limited")
                                                    ? "bg-amber-300"
                                                    : "bg-emerald-300"
                                            }`}
                                        />

                                        {profile.availabilityLabel}
                                    </span>
                                ) : null}
                                <div
                                    className={`relative z-10 px-6 py-8 md:px-10 md:py-10 ${profile.showcaseImages.length > 0
                                        ? "lg:flex lg:min-h-[390px] lg:w-[40%] lg:items-center"
                                        : ""
                                        }`}
                                >
                                    <div className="w-full min-w-0 text-center sm:text-left">
                                        <div className="mt-2 flex min-w-0 flex-col items-center gap-4 sm:mt-12 sm:flex-row sm:items-center sm:gap-5 md:mt-10">
                                            <div className="flex shrink-0 flex-col items-center gap-3">
                                            {profile.avatarUrl ? (
                                                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20 shadow-xl">
                                                    <LoadingImage
                                                        src={profile.avatarUrl}
                                                        alt={`${profile.displayName} profile`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 text-2xl font-semibold text-blue-200">
                                                    {getInitials(
                                                        profile.displayName
                                                    ) || "FD"}
                                                </div>
                                            )}

                                            {profile.availabilityLabel ? (
                                                <span
                                                    className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-medium backdrop-blur-sm sm:hidden ${getAvailabilityClass(
                                                        profile.availabilityLabel,
                                                    )}`}
                                                    style={{
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    <span
                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                        profile.availabilityLabel
                                                            .toLowerCase()
                                                            .includes("limited")
                                                            ? "bg-amber-300"
                                                            : "bg-emerald-300"
                                                    }`}
                                                />

                                                    {profile.availabilityLabel}
                                                </span>
                                            ) : null}
                                            </div>

                                            <div className="min-w-0 flex-1 text-center sm:text-left">
                                                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                                    <h1 className="text-3xl font-semibold text-white md:text-4xl">
                                                        {profile.displayName}
                                                    </h1>

                                                    {profile.isVerified ? (
                                                        <span
                                                            className="border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200"
                                                            style={{
                                                                borderRadius: 999,
                                                            }}
                                                        >
                                                            Verified
                                                        </span>
                                                    ) : null}

                                                    {profile.isFeatured ? (
                                                        <span
                                                            className="border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200"
                                                            style={{
                                                                borderRadius: 999,
                                                            }}
                                                        >
                                                            Featured
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {profile.headline ? (
                                                    <p className="mt-2 max-w-full break-words text-lg leading-7 text-zinc-300">
                                                        {profile.headline}
                                                    </p>
                                                ) : null}

                                                {profile.deliveryScopeLabel ? (
                                                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300">
                                                        {profile.deliveryScopeLabel}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        {profile.skills.length > 0 ? (
                                            <div className="mt-7">
                                                <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-left">
                                                    Skills
                                                </p>

                                                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                                                    {profile.skills
                                                        .slice(0, 5)
                                                        .map((skill) => (
                                                            <span
                                                                key={skill}
                                                                className="border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur-sm"
                                                                style={{
                                                                    borderRadius: 5,
                                                                }}
                                                            >
                                                                {skill}
                                                            </span>
                                                        ))}

                                                    {profile.skills.length > 5 ? (
                                                        <span
                                                            className="border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-400"
                                                            style={{
                                                                borderRadius: 5,
                                                            }}
                                                        >
                                                            +{profile.skills.length - 5} more
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}

                                        {profile.genreExperience.length > 0 ? (
                                            <div className="mt-5">
                                                <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-left">
                                                    Genre Experience
                                                </p>

                                                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                                                    {profile.genreExperience.map(
                                                        (genre) => (
                                                            <span
                                                                key={genre}
                                                                className="border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-100"
                                                                style={{
                                                                    borderRadius: 999,
                                                                }}
                                                            >
                                                                {getGameGenreLabel(
                                                                    genre
                                                                )}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:justify-start">
                                            <button
                                                type="button"
                                                onClick={
                                                    isOwnProfile
                                                        ? undefined
                                                        : openContactModal
                                                }
                                                disabled={isOwnProfile}
                                                title={
                                                    isOwnProfile
                                                        ? "You cannot contact your own developer profile."
                                                        : undefined
                                                }
                                                className={`inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 border px-6 py-3.5 text-sm font-semibold backdrop-blur-md transition sm:w-auto ${
                                                    isOwnProfile
                                                        ? "cursor-not-allowed border-white/10 bg-white/[0.035] text-zinc-500 shadow-none"
                                                        : "cursor-pointer border-sky-300/70 bg-sky-500/20 text-sky-50 shadow-[0_0_18px_rgba(56,189,248,0.35),0_0_42px_rgba(37,99,235,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] hover:border-sky-200 hover:bg-sky-500/30"
                                                }`}
                                                style={{
                                                    borderRadius: 5,
                                                }}
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    aria-hidden="true"
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.8"
                                                >
                                                    <path
                                                        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-8Z"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />

                                                    <path
                                                        d="M8 8h8M8 11.5h5"
                                                        strokeLinecap="round"
                                                    />
                                                </svg>

                                                Contact Developer
                                            </button>

                                            {!isOwnProfile ? (
                                                <button
                                                    type="button"
                                                    onClick={
                                                        toggleSavedDeveloper
                                                    }
                                                    disabled={
                                                        savingDeveloper
                                                    }
                                                    className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 border px-4 py-3.5 text-sm font-semibold transition disabled:cursor-wait ${
                                                        isSaved
                                                            ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
                                                            : "border-white/15 bg-white/[0.04] text-zinc-200 hover:border-rose-300/35 hover:text-rose-200"
                                                    }`}
                                                    style={{
                                                        borderRadius: 5,
                                                    }}
                                                    aria-label={
                                                        isSaved
                                                            ? "Remove bookmarked developer"
                                                            : "Bookmark developer"
                                                    }
                                                    title={
                                                        isSaved
                                                            ? "Bookmarked"
                                                            : "Bookmark developer"
                                                    }
                                                >
                                                    {savingDeveloper ? (
                                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Bookmark
                                                            className="h-4 w-4"
                                                            fill={
                                                                isSaved
                                                                    ? "currentColor"
                                                                    : "none"
                                                            }
                                                        />
                                                    )}

                                                    <span>
                                                        {Math.max(
                                                            0,
                                                            profile.saveCount +
                                                                (
                                                                    isSaved
                                                                        ? (
                                                                            initiallySaved
                                                                                ? 0
                                                                                : 1
                                                                        )
                                                                        : (
                                                                            initiallySaved
                                                                                ? -1
                                                                                : 0
                                                                        )
                                                                ),
                                                        )}
                                                    </span>
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {profile.showcaseImages.length > 0 ? (
                                    <div className="relative aspect-video w-full lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[60%] lg:aspect-auto">
                                        <ProfileShowcase
                                            images={
                                                profile.showcaseImages
                                            }
                                            blended
                                        />
                                    </div>
                                ) : null}
                            </div>

                            <div className="space-y-9 px-6 py-9 md:px-10 md:py-8">
                                <section>
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                                        About
                                    </h2>

                                    <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-zinc-300 md:text-[15px] md:leading-7">
                                        {profile.bio}
                                    </p>
                                </section>

                                {profile.workSamples.length > 0 ? (
                                    <section>
                                        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                                            Featured Work
                                        </h2>

                                        <div className="mt-4 space-y-3">
                                            {profile.workSamples.map(
                                                (item) => {
                                                    const videoId =
                                                        getYouTubeVideoId(
                                                            item.youtubeVideoUrl
                                                        );

                                                    const previewImage =
                                                        item.images[0]?.url ||
                                                        (
                                                            videoId
                                                                ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                                                                : ""
                                                        );

                                                    const robloxLink =
                                                        item.projectUrl;

                                                    return (
                                                        <motion.div
                                                            key={item.id}
                                                            whileHover={{
                                                                y: -3,
                                                            }}
                                                            transition={{
                                                                duration: 0.2,
                                                                ease: [0.22, 1, 0.36, 1],
                                                            }}
                                                            className="group/work flex flex-col gap-4 border border-white/10 bg-black/10 p-4 transition-[border-color,background-color,box-shadow] duration-200 hover:border-sky-300/30 hover:bg-sky-500/[0.035] hover:shadow-[0_12px_32px_rgba(0,0,0,0.26),0_0_24px_rgba(56,189,248,0.10)] sm:flex-row sm:items-center"
                                                            style={{
                                                                borderRadius: 8,
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openProjectDetails(
                                                                        item
                                                                    )
                                                                }
                                                                className="flex min-w-0 flex-1 cursor-pointer flex-col gap-4 text-left sm:flex-row sm:items-center"
                                                            >
                                                                {previewImage ? (
                                                                    <div
                                                                        className="aspect-video w-full shrink-0 overflow-hidden border border-white/10 bg-black/20 sm:h-20 sm:w-32"
                                                                        style={{
                                                                            borderRadius: 6,
                                                                        }}
                                                                    >
                                                                        <LoadingImage
                                                                            src={previewImage}
                                                                            alt=""
                                                                            className="h-full w-full object-cover transition-transform duration-300 group-hover/work:scale-[1.025]"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        className="flex aspect-video w-full shrink-0 items-center justify-center border border-dashed border-white/10 bg-white/[0.02] text-xs text-zinc-600 sm:h-20 sm:w-32"
                                                                        style={{
                                                                            borderRadius: 6,
                                                                        }}
                                                                    >
                                                                        No image
                                                                    </div>
                                                                )}

                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                                                        <h3 className="text-base font-semibold text-white">
                                                                            {item.title}
                                                                        </h3>

                                                                        {item.isInDevelopment ? (
                                                                            <span
                                                                                className="border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200"
                                                                                style={{
                                                                                    borderRadius: 999,
                                                                                }}
                                                                            >
                                                                                In development
                                                                            </span>
                                                                        ) : null}
                                                                    </div>

                                                                    <p className="mt-1 text-sm font-medium text-zinc-300">
                                                                        {item.role}
                                                                    </p>

                                                                    {item.teamName ? (
                                                                        <p className="mt-1 text-xs text-zinc-500">
                                                                            {item.teamName}
                                                                        </p>
                                                                    ) : null}

                                                                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                                                                        {item.contribution}
                                                                    </p>

                                                                    <p className="mt-2 text-xs font-medium text-blue-300">
                                                                        View details
                                                                    </p>
                                                                </div>
                                                            </button>

                                                            {robloxLink ? (
                                                                <a
                                                                    href={robloxLink}
                                                                    onClick={() =>
                                                                        trackProjectLink(
                                                                            item
                                                                        )
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex shrink-0 items-center justify-center border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-200 hover:bg-blue-500/20"
                                                                    style={{
                                                                        borderRadius: 5,
                                                                    }}
                                                                >
                                                                    Open on Roblox
                                                                </a>
                                                            ) : null}
                                                        </motion.div>
                                                    );
                                                }
                                            )}
                                        </div>

                                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-xs leading-5 text-zinc-500">
                                                Roles and contributions shown here are
                                                self-reported by the member.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={openReportModal}
                                                className="inline-flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-zinc-300 transition hover:text-red-300"
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    aria-hidden="true"
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.8"
                                                >
                                                    <path
                                                        d="M5 21V4m0 0h10.5l-1.8 3 1.8 3H5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>

                                                Report Profile
                                            </button>
                                        </div>
                                    </section>
                                ) : null}

                                {profile.portfolioUrl ? (
                                    <section>
                                        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                                            Website
                                        </h2>

                                        <div className="mt-3">
                                            <a
                                                href={
                                                    profile.portfolioUrl
                                                }
                                                onClick={
                                                    trackPortfolioClick
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                                                style={{
                                                    borderRadius: 5,
                                                }}
                                            >
                                                Portfolio or Website
                                            </a>
                                        </div>
                                    </section>
                                ) : null}
                            </div>
                        </article>
                    </>
                ) : null}
            </section>

            {!isStandalone ? (
                <SiteFooter />
            ) : (
                <footer className="px-5 pb-10 pt-2 text-center">
                    <a
                        href="https://frdaph.org"
                        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 transition hover:text-zinc-400"
                    >
                        <img
                            src="/frda-logo.png"
                            alt=""
                            className="h-5 w-5 object-contain opacity-65"
                        />

                        Powered by FRDA
                    </a>
                </footer>
            )}

            {profile && !isOwnProfile ? (
                <div
                    className={`fixed inset-x-0 bottom-0 z-[90] px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-all duration-300 sm:hidden ${
                        showStickyContact
                            ? "translate-y-0 opacity-100"
                            : "pointer-events-none translate-y-full opacity-0"
                    }`}
                >
                    <button
                        type="button"
                        onClick={openContactModal}
                        className="flex min-h-14 w-full items-center justify-center gap-2 border border-sky-300/70 bg-sky-500/20 px-6 py-4 text-sm font-semibold text-sky-50 shadow-[0_-10px_30px_rgba(0,0,0,0.38),0_0_20px_rgba(56,189,248,0.38),0_0_48px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl"
                        style={{
                            borderRadius: 8,
                        }}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                        >
                            <path
                                d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-8Z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M8 8h8M8 11.5h5"
                                strokeLinecap="round"
                            />
                        </svg>

                        Contact Developer
                    </button>
                </div>
            ) : null}

            <ProjectDetailsModal
                project={selectedProject}
                onProjectLinkClick={
                    trackProjectLink
                }
                onClose={() =>
                    setSelectedProject(null)
                }
            />

            {contactOpen ? (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            closeContactModal();
                        }
                    }}
                >
                    <div
                        className="max-h-[92vh] w-full max-w-xl overflow-y-auto border border-white/10 bg-[#081426] shadow-2xl"
                        style={{ borderRadius: 10 }}
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-blue-300">
                                    Contact Developer
                                </p>

                                <h2 className="mt-1 text-xl font-semibold text-white">
                                    Contact {profile?.displayName}
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-zinc-400">
                                    Your contact details stay private until
                                    the developer chooses to connect.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeContactModal}
                                disabled={submittingContact}
                                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        {contactAccess === "checking" ? (
                            <div className="p-6 text-sm text-zinc-400">
                                Checking your account access...
                            </div>
                        ) : contactAccess === "logged_out" ? (
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-white">
                                    Create an account or log in
                                </h3>

                                <p className="mt-3 text-sm leading-6 text-zinc-400">
                                    You need a free FRDA account to contact this
                                    developer. Talent-seeker accounts are verified
                                    before they can send connection requests.
                                </p>

                                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openAccountModal(
                                                "signup",
                                                "talent_seeker"
                                            )
                                        }
                                        className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                                        style={{ borderRadius: 5 }}
                                    >
                                        Sign Up
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            openAccountModal(
                                                "login",
                                                "talent_seeker"
                                            )
                                        }
                                        className="cursor-pointer border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
                                        style={{ borderRadius: 5 }}
                                    >
                                        Log In
                                    </button>
                                </div>
                            </div>
                        ) : contactAccess === "developer_only" ? (
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-white">
                                    Talent-seeker access required
                                </h3>

                                <p className="mt-3 text-sm leading-6 text-zinc-400">
                                    This account is registered only as a
                                    developer. Contact access is reserved for
                                    verified talent seekers and accounts marked
                                    as both.
                                </p>
                            </div>
                        ) : contactAccess === "not_submitted" ||
                            contactAccess === "rejected" ? (
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-white">
                                    Complete talent-seeker verification
                                </h3>

                                <p className="mt-3 text-sm leading-6 text-zinc-400">
                                    FRDA needs to verify your account before you
                                    can contact developers.
                                </p>

                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            "/member/talent-seeker-profile"
                                        )
                                    }
                                    className="mt-6 cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                                    style={{ borderRadius: 5 }}
                                >
                                    {contactAccess === "rejected"
                                        ? "Review and Resubmit"
                                        : "Start Verification"}
                                </button>
                            </div>
                        ) : contactAccess === "pending" ? (
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-white">
                                    Verification is under review
                                </h3>

                                <p className="mt-3 text-sm leading-6 text-zinc-400">
                                    You can send connection requests once FRDA
                                    verifies your talent-seeker account.
                                </p>
                            </div>
                        ) : contactAccess === "suspended" ? (
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-white">
                                    Contact access is suspended
                                </h3>

                                <p className="mt-3 text-sm leading-6 text-zinc-400">
                                    This account cannot send developer
                                    connection requests at this time.
                                </p>
                            </div>
                        ) : (
                            <form
                                onSubmit={submitContactRequest}
                                className="p-6"
                            >
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                            Inquiry Type
                                        </label>

                                        <select
                                            value={
                                                contactForm.inquiryType
                                            }
                                            onChange={(event) =>
                                                setContactForm(
                                                    (current) => ({
                                                        ...current,
                                                        inquiryType:
                                                            event.target
                                                                .value as
                                                            ContactFormState["inquiryType"],
                                                    })
                                                )
                                            }
                                            className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-400"
                                            style={{
                                                borderRadius: 5,
                                                colorScheme: "dark",
                                            }}
                                        >
                                            <option value="paid_project">
                                                Paid project
                                            </option>

                                            <option value="employment">
                                                Employment opportunity
                                            </option>

                                            <option value="collaboration">
                                                Collaboration
                                            </option>

                                            <option value="publishing">
                                                Publishing or partnership
                                            </option>

                                            <option value="other">
                                                Other
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                            Organization or Team
                                        </label>

                                        <input
                                            type="text"
                                            value={
                                                contactForm
                                                    .organizationName
                                            }
                                            onChange={(event) =>
                                                setContactForm(
                                                    (current) => ({
                                                        ...current,
                                                        organizationName:
                                                            event.target
                                                                .value,
                                                    })
                                                )
                                            }
                                            maxLength={160}
                                            placeholder="Optional"
                                            className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                                            style={{ borderRadius: 5 }}
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                            Opportunity or Project Title
                                        </label>

                                        <input
                                            type="text"
                                            value={
                                                contactForm
                                                    .opportunityTitle
                                            }
                                            onChange={(event) =>
                                                setContactForm(
                                                    (current) => ({
                                                        ...current,
                                                        opportunityTitle:
                                                            event.target
                                                                .value,
                                                    })
                                                )
                                            }
                                            maxLength={160}
                                            placeholder="Example — UI designer needed for an upcoming Roblox game"
                                            className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                                            style={{ borderRadius: 5 }}
                                            required
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                            Relevant Link
                                        </label>

                                        <input
                                            type="url"
                                            value={
                                                contactForm.relevantUrl
                                            }
                                            onChange={(event) =>
                                                setContactForm(
                                                    (current) => ({
                                                        ...current,
                                                        relevantUrl:
                                                            event.target
                                                                .value,
                                                    })
                                                )
                                            }
                                            maxLength={500}
                                            placeholder="Optional project, company, or opportunity link"
                                            className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                                            style={{ borderRadius: 5 }}
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <div className="mb-2 flex items-center justify-between gap-4">
                                            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                                Message
                                            </label>

                                            <span className="text-xs text-zinc-600">
                                                {
                                                    contactForm
                                                        .message
                                                        .length
                                                }{" "}
                                                / 4,000
                                            </span>
                                        </div>

                                        <textarea
                                            value={
                                                contactForm.message
                                            }
                                            onChange={(event) =>
                                                setContactForm(
                                                    (current) => ({
                                                        ...current,
                                                        message:
                                                            event.target
                                                                .value,
                                                    })
                                                )
                                            }
                                            rows={7}
                                            minLength={40}
                                            maxLength={4000}
                                            placeholder="Describe the project, expected role, compensation or arrangement, timeline, and why you think this developer may be a good fit."
                                            className="w-full resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                                            style={{ borderRadius: 5 }}
                                            required
                                        />
                                    </div>
                                </div>

                                {contactError ? (
                                    <div
                                        className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                                        style={{ borderRadius: 8 }}
                                    >
                                        {contactError}
                                    </div>
                                ) : null}

                                <p className="mt-5 text-xs leading-5 text-zinc-500">
                                    FRDA may review requests for safety and
                                    relevance. Your private contact information
                                    is not shown publicly.
                                </p>

                                <div className="mt-7 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={closeContactModal}
                                        disabled={submittingContact}
                                        className="cursor-pointer border border-white/15 bg-transparent px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                                        style={{ borderRadius: 5 }}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={
                                            submittingContact
                                        }
                                        className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{ borderRadius: 5 }}
                                    >
                                        {submittingContact ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                                Sending...
                                            </span>
                                        ) : (
                                            "Send Request"
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            ) : null}

            {saveAccountPromptOpen ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setSaveAccountPromptOpen(
                                false
                            );
                        }
                    }}
                >
                    <div
                        className="w-full max-w-md border border-white/10 bg-[#081426] p-6 shadow-2xl"
                        style={{ borderRadius: 10 }}
                    >
                        <h2 className="text-xl font-semibold text-white">
                            Bookmark this developer
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-zinc-400">
                            Create a free FRDA account or log in to keep a private shortlist of developers you may want to contact or collaborate with later.
                        </p>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() =>
                                    openAccountModal(
                                        "signup"
                                    )
                                }
                                className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                                style={{ borderRadius: 6 }}
                            >
                                Sign Up
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    openAccountModal(
                                        "login"
                                    )
                                }
                                className="cursor-pointer border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/[0.08]"
                                style={{ borderRadius: 6 }}
                            >
                                Log In
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {reportOpen ? (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
                    <div
                        className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-zinc-800 bg-zinc-900 shadow-2xl"
                        style={{ borderRadius: 8 }}
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5">
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    Report this profile
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-zinc-400">
                                    Reports are reviewed by FRDA staff. Please
                                    provide accurate and relevant information.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeReportModal}
                                disabled={submittingReport}
                                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <form
                            onSubmit={submitReport}
                            className="p-6"
                        >
                            <div>
                                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                    Reason
                                </label>

                                <select
                                    value={reportReason}
                                    onChange={(event) =>
                                        setReportReason(
                                            event.target
                                                .value as ReportReason
                                        )
                                    }
                                    className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                                    style={{
                                        borderRadius: 5,
                                        colorScheme: "dark",
                                    }}
                                >
                                    <option value="false_claims">
                                        False or misleading claims
                                    </option>

                                    <option value="stolen_work">
                                        Work appears stolen or misrepresented
                                    </option>

                                    <option value="impersonation">
                                        Impersonation
                                    </option>

                                    <option value="inappropriate_content">
                                        Inappropriate content
                                    </option>

                                    <option value="spam">
                                        Spam
                                    </option>

                                    <option value="other">
                                        Other
                                    </option>
                                </select>
                            </div>

                            <div className="mt-5">
                                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                    Details
                                </label>

                                <textarea
                                    value={reportDetails}
                                    onChange={(event) =>
                                        setReportDetails(
                                            event.target.value
                                        )
                                    }
                                    rows={6}
                                    maxLength={3000}
                                    placeholder="Explain the concern and include relevant context or links."
                                    className="w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                                    style={{ borderRadius: 5 }}
                                />
                            </div>

                            <div className="mt-5">
                                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                                    Your Email
                                </label>

                                <input
                                    type="email"
                                    value={reporterEmail}
                                    onChange={(event) =>
                                        setReporterEmail(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Optional"
                                    className="w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                                    style={{ borderRadius: 5 }}
                                />

                                <p className="mt-2 text-xs leading-5 text-zinc-500">
                                    Add an email only if you are comfortable
                                    being contacted for more information.
                                </p>
                            </div>

                            {reportError ? (
                                <div
                                    className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
                                    style={{ borderRadius: 8 }}
                                >
                                    {reportError}
                                </div>
                            ) : null}

                            {reportSuccess ? (
                                <div
                                    className="mt-5 border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200"
                                    style={{ borderRadius: 8 }}
                                >
                                    {reportSuccess}
                                </div>
                            ) : null}

                            <div className="mt-7 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeReportModal}
                                    disabled={submittingReport}
                                    className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                                    style={{ borderRadius: 5 }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        submittingReport ||
                                        Boolean(reportSuccess)
                                    }
                                    className="cursor-pointer border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ borderRadius: 5 }}
                                >
                                    {submittingReport
                                        ? "Submitting..."
                                        : "Submit Report"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
            </div>
        </main>
    );
}