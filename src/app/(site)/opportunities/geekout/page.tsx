"use client";

import Image from "next/image";
import Script from "next/script";
import {
    ArrowRight,
    Check,
    ExternalLink,
    MessageCircle,
    Send,
    X,
} from "lucide-react";
import {
    FormEvent,
    MutableRefObject,
    ReactNode,
    RefObject,
    useEffect,
    useRef,
    useState,
} from "react";

type ModalType =
    | "discord"
    | "portfolio"
    | null;

type TurnstileWidgetId =
    | string
    | number;

type TurnstileApi = {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string;
            theme?: "dark" | "light" | "auto";
            size?:
            | "normal"
            | "compact"
            | "flexible";
            callback?: (token: string) => void;
            "expired-callback"?: () => void;
            "error-callback"?: () => void;
        },
    ) => TurnstileWidgetId;

    reset: (
        widgetId?: TurnstileWidgetId,
    ) => void;

    remove: (
        widgetId: TurnstileWidgetId,
    ) => void;
};

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

const TURNSTILE_SITE_KEY =
    process.env
        .NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    "";

const INTEREST_OPTIONS = [
    {
        value: "geekout_opportunity",
        label:
            "I’m interested in the GeekOut opportunity",
    },
    {
        value: "future_opportunities",
        label:
            "I want to hear about future developer opportunities",
    },
];

const inputClassName =
    "w-full rounded-[7px] border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400";

export default function GeekOutOpportunityPage() {
    const [activeModal, setActiveModal] =
        useState<ModalType>(null);

    useEffect(() => {
        document.body.style.overflow =
            activeModal ? "hidden" : "";

        return () => {
            document.body.style.overflow = "";
        };
    }, [activeModal]);

    return (
        <>
            <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                strategy="afterInteractive"
            />

            <main className="min-h-screen text-white">
                <section className="px-5 pb-20 pt-32 sm:px-6 sm:pb-24 sm:pt-40">
                    <div className="mx-auto max-w-6xl text-center">
                        <div className="mx-auto flex max-w-xl items-center justify-center gap-2 sm:gap-3">
                            <Image
                                src="/frda-logo.png"
                                alt="Filipino Roblox Developers Association"
                                width={88}
                                height={88}
                                className="h-[82px] w-[82px] object-contain sm:h-[88px] sm:w-[88px]"
                                priority
                            />

                            <span
                                aria-hidden="true"
                                className="text-4xl font-medium leading-none text-sky-300 sm:text-5xl"
                            >
                                ×
                            </span>

                            <Image
                                src="/geekout-logo.png"
                                alt="GeekOut K.K."
                                width={280}
                                height={90}
                                className="h-auto max-h-[72px] w-auto max-w-[220px] object-contain sm:max-w-[270px]"
                                priority
                            />
                        </div>

                        <p className="mx-auto mt-7 w-fit text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300 sm:text-xs">
                            In-person meetups around PGDX + online conversations · July 24–27, 2026
                        </p>

                        <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-[52px] lg:leading-[1.08]">
                            Built something remarkable on Roblox? GeekOut wants to meet you.
                        </h1>

                        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-zinc-200 sm:text-lg">
                            GeekOut K.K. is a Tokyo-based company working across Roblox development,
                            publishing, creator support, and collaborations with entertainment partners. The GeekOut
                            team will be meeting developers around PGDX this July and is also open to
                            online conversations with experienced Filipino Roblox creators.
                        </p>

                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() =>
                                    setActiveModal("portfolio")
                                }
                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[7px] border border-blue-300/25 bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.22)] transition hover:bg-blue-400"
                            >
                                <Send className="h-5 w-5" />
                                Submit Your Portfolio
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setActiveModal("discord")
                                }
                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[7px] border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
                            >
                                <MessageCircle className="h-5 w-5" />
                                Join Opportunity Discord
                            </button>
                        </div>

                        <p className="mx-auto mt-4 max-w-2xl text-xs leading-6 text-zinc-500 sm:text-sm">
                            Cannot attend in person? You may still indicate availability for an online
                            conversation. Joining Discord is optional, but it is the easiest way to
                            receive updates about the GeekOut opportunity, candidate shortlisting,
                            and future developer opportunities from FRDA.
                        </p>
                    </div>
                </section>

                <section className="border-y border-white/10 bg-[#08152f] px-5 py-16 sm:px-6 sm:py-20">
                    <div className="mx-auto max-w-6xl">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                                What may be possible
                            </p>

                            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                                What the conversation could open up
                            </h2>

                            <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
                                Depending on the developer, project, and mutual fit, discussions may explore:
                            </p>
                        </div>

                        <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-10">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.13em] text-blue-300">
                                    Development funding
                                </p>

                                <p className="mt-3 text-sm leading-7 text-zinc-300">
                                    Potential support that could help a promising Roblox project move
                                    further or scale faster.
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.13em] text-blue-300">
                                    Japanese anime and entertainment IP
                                </p>

                                <p className="mt-3 text-sm leading-7 text-zinc-300">
                                    Possible licensed collaborations involving established Japanese
                                    properties.
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.13em] text-blue-300">
                                    Publishing and growth
                                </p>

                                <p className="mt-3 text-sm leading-7 text-zinc-300">
                                    Publishing, marketing, merchandising, or other ways to expand
                                    your work.
                                </p>
                            </div>
                        </div>

                        <p className="mt-10 text-xs leading-6 text-zinc-500">
                            These are possible discussion areas, not guaranteed offers or outcomes.
                        </p>
                    </div>
                </section>

                <section className="px-5 py-16 sm:px-6 sm:py-20">
                    <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start lg:gap-16">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                                Why GeekOut
                            </p>

                            <h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                                A path to larger projects, stronger support, and new audiences
                            </h2>

                            <p className="mt-6 text-sm leading-7 text-zinc-400 sm:text-base">
                                GeekOut works with Roblox creators, Japanese brands, and entertainment
                                IP owners across development, publishing, licensing, promotion, and
                                community initiatives.
                            </p>

                            <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
                                For Filipino developers, that could mean conversations about
                                strengthening an existing project, supporting a new production,
                                collaborating around licensed IP, or reaching a wider audience.
                            </p>

                            <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
                                GeekOut also creates opportunities for developers to connect with
                                entertainment partners and explore projects that can reach audiences
                                beyond their existing Roblox communities.
                            </p>

                            <div className="mt-7">
                                <a
                                    href="https://geek-out.io/en/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-[7px] border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
                                >
                                    Visit GeekOut&apos;s website
                                    <ExternalLink className="h-4 w-4" />
                                </a>

                            </div>
                        </div>

                        <div className="border-l border-white/10 pl-0 lg:pl-10">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                Who should submit
                            </p>

                            <ul className="mt-5 space-y-4 text-sm leading-7 text-zinc-300 sm:text-base">
                                <li className="flex gap-3">
                                    <Check className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
                                    <span>You built or helped complete a Roblox game.</span>
                                </li>

                                <li className="flex gap-3">
                                    <Check className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
                                    <span>You made a clear and substantial contribution to the finished project.</span>
                                </li>

                                <li className="flex gap-3">
                                    <Check className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
                                    <span>You can clearly show what you personally contributed.</span>
                                </li>
                            </ul>

                            <button
                                type="button"
                                onClick={() =>
                                    setActiveModal("portfolio")
                                }
                                className="mt-7 inline-flex cursor-pointer items-center justify-center gap-2 rounded-[7px] bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                            >
                                Submit Portfolio
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </section>

                <section className="border-y border-white/10 bg-[#040b19] px-5 py-16 sm:px-6 sm:py-20">
                    <div className="mx-auto max-w-6xl">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                                GeekOut&apos;s creator community
                            </p>

                            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                                Connecting creators across Asia and beyond
                            </h2>

                            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                                From regional creator gatherings to large international events,
                                GeekOut brings Roblox developers and industry partners together to
                                exchange ideas, build relationships, and explore new opportunities.
                            </p>
                        </div>

                        <div className="mt-10 grid gap-8 lg:grid-cols-2">
                            <div>
                                <div className="overflow-hidden rounded-[10px] border border-white/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                                    <iframe
                                        title="GeekOut CreatorCon 2026 in Tokyo post on X"
                                        src="https://platform.twitter.com/embed/Tweet.html?id=2066450833106182282&dnt=true&theme=light"
                                        className="block h-[690px] w-full border-0 sm:h-[650px]"
                                        loading="lazy"
                                    />
                                </div>

                                <p className="mt-4 text-center text-xs leading-6 text-zinc-500">
                                    GeekOut CreatorCon 2026 brought nearly 200 creators and partners
                                    from around the world together in Tokyo.
                                </p>
                            </div>

                            <div>
                                <div className="overflow-hidden rounded-[10px] border border-white/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                                    <iframe
                                        title="GeekOut Thailand creator event post on X"
                                        src="https://platform.twitter.com/embed/Tweet.html?id=2042528023057174825&dnt=true&theme=light"
                                        className="block h-[690px] w-full border-0 sm:h-[650px]"
                                        loading="lazy"
                                    />
                                </div>

                                <p className="mt-4 text-center text-xs leading-6 text-zinc-500">
                                    GeekOut has also hosted regional gatherings that connect Roblox
                                    creators with members of Japan&apos;s entertainment industry.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-blue-600/10 px-5 py-16 text-center sm:px-6 sm:py-20">
                    <div className="mx-auto max-w-3xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                            Ready to be considered?
                        </p>

                        <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                            Show us what you can build
                        </h2>

                        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
                            Share your strongest Roblox work and explain what you personally
                            contributed. FRDA will review submissions and may introduce a limited
                            number of suitable developers to GeekOut for possible project, funding,
                            publishing, licensing, or collaboration discussions.
                        </p>

                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() =>
                                    setActiveModal("portfolio")
                                }
                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[7px] bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.2)] transition hover:bg-blue-400"
                            >
                                Submit Your Portfolio
                                <ArrowRight className="h-4 w-4" />
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setActiveModal("discord")
                                }
                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[7px] border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
                            >
                                <MessageCircle className="h-5 w-5" />
                                Join the Discord
                            </button>
                        </div>

                        <p className="mx-auto mt-5 max-w-2xl text-xs leading-6 text-zinc-500">
                            Joining Discord is optional. Submission does not guarantee selection, a
                            meeting, funding, licensing, or collaboration.
                        </p>
                    </div>
                </section>
            </main>

            {activeModal === "discord" ? (
                <DiscordGuestModal
                    onClose={() =>
                        setActiveModal(null)
                    }
                />
            ) : null}

            {activeModal === "portfolio" ? (
                <PortfolioModal
                    onClose={() =>
                        setActiveModal(null)
                    }
                />
            ) : null}
        </>
    );
}

function ModalShell({
    title,
    description,
    onClose,
    children,
}: {
    title: string;
    description: string;
    onClose: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        function handleEscape(
            event: KeyboardEvent,
        ) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener(
            "keydown",
            handleEscape,
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleEscape,
            );
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div className="flex min-h-full items-start justify-center py-5 sm:items-center">
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="opportunity-modal-title"
                    className="w-full max-w-xl overflow-hidden border border-zinc-700 bg-[#08111f] shadow-[0_30px_100px_rgba(0,0,0,0.62)]"
                    style={{ borderRadius: 12 }}
                >
                    <div className="flex items-start justify-between gap-5 border-b border-zinc-800 px-5 py-5 sm:px-6">
                        <div>
                            <h2
                                id="opportunity-modal-title"
                                className="text-xl font-semibold text-white"
                            >
                                {title}
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-zinc-400">
                                {description}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-zinc-400 transition hover:bg-white/5 hover:text-white"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="max-h-[calc(100vh-130px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DiscordGuestModal({
    onClose,
}: {
    onClose: () => void;
}) {
    const [creatorAlias, setCreatorAlias] =
        useState("");

    const [interests, setInterests] =
        useState<string[]>([
            "geekout_opportunity",
        ]);

    const [rulesAccepted, setRulesAccepted] =
        useState(false);

    const [
        turnstileToken,
        setTurnstileToken,
    ] = useState("");

    const turnstileContainerRef =
        useRef<HTMLDivElement | null>(null);

    const turnstileWidgetIdRef =
        useRef<TurnstileWidgetId | null>(
            null,
        );

    const [isSubmitting, setIsSubmitting] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    const [inviteUrl, setInviteUrl] =
        useState("");

    useTurnstile({
        containerRef:
            turnstileContainerRef,

        widgetIdRef:
            turnstileWidgetIdRef,

        onToken: setTurnstileToken,
    });

    function toggleInterest(
        value: string,
    ) {
        setInterests((current) =>
            current.includes(value)
                ? current.filter(
                    (item) => item !== value,
                )
                : [...current, value],
        );

        setErrorMessage("");
    }

    async function submitGuestForm(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (isSubmitting) return;

        setErrorMessage("");

        if (!creatorAlias.trim()) {
            setErrorMessage(
                "Please enter your creator name or alias.",
            );
            return;
        }

        if (interests.length === 0) {
            setErrorMessage(
                "Please select at least one reason for joining.",
            );
            return;
        }

        if (!rulesAccepted) {
            setErrorMessage(
                "Please agree to the opportunity channel rules.",
            );
            return;
        }

        if (!turnstileToken) {
            setErrorMessage(
                "Please complete the security check.",
            );
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(
                "/api/opportunities/geekout/guest-invite",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        creatorAlias,
                        interests,
                        rulesAccepted,
                        turnstileToken,
                        companyWebsite: "",
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
                    "Could not prepare the Discord invite.",
                );
            }

            setInviteUrl(result.inviteUrl);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not prepare the Discord invite.",
            );

            resetTurnstile(
                turnstileWidgetIdRef.current,
                setTurnstileToken,
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (inviteUrl) {
        return (
            <ModalShell
                title="Your Discord invite is ready"
                description="This invite gives you access to FRDA’s public opportunity channels."
                onClose={onClose}
            >
                <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                        <Check className="h-7 w-7" />
                    </div>

                    <h3 className="mt-5 text-xl font-semibold text-white">
                        Welcome to the opportunity area
                    </h3>

                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-zinc-400">
                        This invite is valid for one use
                        and expires after 24 hours. It
                        automatically gives you the
                        Opportunity Guest role.
                    </p>

                    <a
                        href={inviteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-[7px] bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                        Join Discord
                        <ArrowRight className="h-4 w-4" />
                    </a>

                    <p className="mt-4 text-xs leading-5 text-zinc-600">
                        Accidentally left later? You may
                        request another invite, subject to
                        the daily request limit.
                    </p>
                </div>
            </ModalShell>
        );
    }

    return (
        <ModalShell
            title="Join the opportunity Discord"
            description="Complete this short check before we prepare your guest invite."
            onClose={onClose}
        >
            <form
                onSubmit={submitGuestForm}
                className="space-y-5"
            >
                <input
                    type="text"
                    name="companyWebsite"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute left-[-9999px] h-px w-px opacity-0"
                />

                <FormField
                    label="Creator name or alias"
                    required
                >
                    <input
                        value={creatorAlias}
                        onChange={(event) =>
                            setCreatorAlias(
                                event.target.value,
                            )
                        }
                        maxLength={100}
                        placeholder="The name other developers know you by"
                        className={inputClassName}
                    />
                </FormField>

                <FormField
                    label="What brings you here?"
                    required
                >
                    <div className="space-y-2">
                        {INTEREST_OPTIONS.map(
                            (option) => {
                                const checked =
                                    interests.includes(
                                        option.value,
                                    );

                                return (
                                    <label
                                        key={option.value}
                                        className="flex cursor-pointer items-start gap-3 rounded-[7px] border border-zinc-800 bg-zinc-950/35 p-3 text-sm text-zinc-300 transition hover:border-zinc-700"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                                toggleInterest(
                                                    option.value,
                                                )
                                            }
                                            className="mt-0.5"
                                        />

                                        <span>
                                            {option.label}
                                        </span>
                                    </label>
                                );
                            },
                        )}
                    </div>

                    <p className="mt-2 text-xs leading-5 text-zinc-600">
                        You may choose both.
                    </p>
                </FormField>

                <label className="flex cursor-pointer items-start gap-3 rounded-[7px] border border-zinc-800 bg-zinc-950/35 p-4">
                    <input
                        type="checkbox"
                        checked={rulesAccepted}
                        onChange={(event) =>
                            setRulesAccepted(
                                event.target.checked,
                            )
                        }
                        className="mt-1"
                    />

                    <span className="text-sm leading-6 text-zinc-300">
                        I agree not to spam, troll,
                        harass members, post suspicious
                        links, or misuse the opportunity
                        channels. FRDA may remove access
                        when these rules are broken.
                    </span>
                </label>

                <TurnstileBox
                    containerRef={
                        turnstileContainerRef
                    }
                />

                {errorMessage ? (
                    <p className="rounded-[7px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                        {errorMessage}
                    </p>
                ) : null}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[7px] bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting
                        ? "Preparing your invite..."
                        : "Join Discord"}
                </button>

                <p className="text-center text-xs leading-5 text-zinc-600">
                    No email address is required.
                </p>
            </form>
        </ModalShell>
    );
}

function PortfolioModal({
    onClose,
}: {
    onClose: () => void;
}) {
    const [creatorName, setCreatorName] =
        useState("");

    const [age, setAge] = useState("");

    const [
        robloxProfileUrl,
        setRobloxProfileUrl,
    ] = useState("");

    const [workLink, setWorkLink] =
        useState("");

    const [
        contribution,
        setContribution,
    ] = useState("");

    const [
        meetingPreference,
        setMeetingPreference,
    ] = useState("");

    const [
        discordUsername,
        setDiscordUsername,
    ] = useState("");

    const [email, setEmail] =
        useState("");

    const [
        consentToShare,
        setConsentToShare,
    ] = useState(false);

    const [
        futureOpportunities,
        setFutureOpportunities,
    ] = useState(false);

    const [
        wantsDiscordInvite,
        setWantsDiscordInvite,
    ] = useState(false);

    const [
        turnstileToken,
        setTurnstileToken,
    ] = useState("");

    const turnstileContainerRef =
        useRef<HTMLDivElement | null>(null);

    const turnstileWidgetIdRef =
        useRef<TurnstileWidgetId | null>(
            null,
        );

    const [isSubmitting, setIsSubmitting] =
        useState(false);

    const [submitted, setSubmitted] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    useTurnstile({
        containerRef:
            turnstileContainerRef,

        widgetIdRef:
            turnstileWidgetIdRef,

        onToken: setTurnstileToken,
    });

    async function submitPortfolio(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (isSubmitting) return;

        setErrorMessage("");

        if (!creatorName.trim()) {
            setErrorMessage(
                "Please enter your creator name, alias, or studio.",
            );
            return;
        }

        const numericAge = Number(age);

        if (
            !age.trim() ||
            !Number.isInteger(numericAge) ||
            numericAge < 1 ||
            numericAge > 120
        ) {
            setErrorMessage(
                "Please enter your current age.",
            );
            return;
        }

        if (
            !robloxProfileUrl.trim() ||
            !workLink.trim()
        ) {
            setErrorMessage(
                "Please include your Roblox profile and best work link.",
            );
            return;
        }

        if (
            contribution.trim().length < 20
        ) {
            setErrorMessage(
                "Please briefly explain what you did on the project.",
            );
            return;
        }

        if (!meetingPreference) {
            setErrorMessage(
                "Please select your meeting availability.",
            );
            return;
        }

        if (!email.trim()) {
            setErrorMessage(
                "Please provide a valid email address so FRDA can contact you about this opportunity.",
            );
            return;
        }

        if (!consentToShare) {
            setErrorMessage(
                "We need permission to share your submitted profile with GeekOut.",
            );
            return;
        }

        if (!turnstileToken) {
            setErrorMessage(
                "Please complete the security check.",
            );
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(
                "/api/opportunities/geekout/submit",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        creatorName,
                        age: Number(age),
                        robloxProfileUrl,
                        workLink,
                        contribution,
                        meetingPreference,
                        discordUsername,
                        email,
                        consentToShare,
                        futureOpportunities,
                        wantsDiscordInvite,
                        turnstileToken,
                        companyWebsite: "",
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
                    "Could not submit your portfolio.",
                );
            }

            setSubmitted(true);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not submit your portfolio.",
            );

            resetTurnstile(
                turnstileWidgetIdRef.current,
                setTurnstileToken,
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <ModalShell
                title="Portfolio received"
                description="FRDA will review your submission against the experience GeekOut described."
                onClose={onClose}
            >
                <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                        <Check className="h-7 w-7" />
                    </div>

                    <h3 className="mt-5 text-xl font-semibold text-white">
                        Thank you for sending your work
                    </h3>

                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-zinc-400">
                        FRDA will contact you through the email address you
                        provided if clarification or further coordination is
                        needed.
                    </p>

                    <p className="mx-auto mt-3 max-w-md text-xs leading-6 text-zinc-600">
                        Submitting does not guarantee
                        selection, a meeting, funding, or
                        partnership.
                    </p>

                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-6 rounded-[7px] bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                        Done
                    </button>
                </div>
            </ModalShell>
        );
    }

    return (
        <ModalShell
            title="Submit your portfolio"
            description="Share enough information for FRDA to check whether your work may fit this opportunity."
            onClose={onClose}
        >
            <form
                onSubmit={submitPortfolio}
                className="space-y-5"
            >
                <input
                    type="text"
                    name="companyWebsite"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute left-[-9999px] h-px w-px opacity-0"
                />

                <FormField
                    label="Creator name, alias, or studio"
                    required
                >
                    <input
                        value={creatorName}
                        onChange={(event) =>
                            setCreatorName(
                                event.target.value,
                            )
                        }
                        maxLength={100}
                        placeholder="The public name other developers know you by"
                        className={inputClassName}
                    />
                </FormField>

                <FormField label="Current age" required>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={120}
                        value={age}
                        onChange={(event) => setAge(event.target.value)}
                        placeholder="Enter your age"
                        className={inputClassName}
                    />

                    {age && Number(age) < 18 ? (
                        <p className="mt-2 text-xs leading-5 text-amber-300/80">
                            A parent or legal guardian will need to approve and attend any
                            meeting arranged for a minor.
                        </p>
                    ) : null}
                </FormField>

                <FormField
                    label="Roblox profile link"
                    required
                >
                    <input
                        type="url"
                        value={robloxProfileUrl}
                        onChange={(event) =>
                            setRobloxProfileUrl(
                                event.target.value,
                            )
                        }
                        maxLength={500}
                        placeholder="https://www.roblox.com/users/..."
                        className={inputClassName}
                    />
                </FormField>

                <FormField
                    label="Best game or portfolio link"
                    required
                >
                    <input
                        type="url"
                        value={workLink}
                        onChange={(event) =>
                            setWorkLink(
                                event.target.value,
                            )
                        }
                        maxLength={500}
                        placeholder="Link to the project that best represents your work"
                        className={inputClassName}
                    />
                </FormField>

                <FormField
                    label="What did you do on this project?"
                    required
                >
                    <textarea
                        value={contribution}
                        onChange={(event) =>
                            setContribution(
                                event.target.value,
                            )
                        }
                        rows={4}
                        maxLength={1200}
                        placeholder="For example — creator, lead scripter, builder, UI designer, animator, or another role that helped bring the game to completion."
                        className={`${inputClassName} resize-y leading-6`}
                    />

                    <p className="mt-2 text-right text-xs text-zinc-600">
                        {contribution.length}/1200
                    </p>
                </FormField>

                <FormField
                    label="Meeting availability"
                    required
                >
                    <select
                        value={meetingPreference}
                        onChange={(event) =>
                            setMeetingPreference(
                                event.target.value,
                            )
                        }
                        className={inputClassName}
                    >
                        <option value="">
                            Select one
                        </option>

                        <option value="manila">
                            In person in Manila during PGDX
                        </option>

                        <option value="online">
                            Online only
                        </option>

                        <option value="either">
                            Either Manila or online
                        </option>
                    </select>
                </FormField>

                <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Email address" required>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(
                                    event.target.value,
                                )
                            }
                            maxLength={200}
                            placeholder="you@example.com"
                            className={inputClassName}
                        />
                    </FormField>

                    <FormField label="Discord username">
                        <input
                            value={discordUsername}
                            onChange={(event) =>
                                setDiscordUsername(
                                    event.target.value,
                                )
                            }
                            maxLength={100}
                            placeholder="Optional"
                            className={inputClassName}
                        />
                    </FormField>
                </div>

                <p className="-mt-2 text-xs leading-5 text-zinc-600">
                    Email is required for possible introductions and follow-up.
                    Discord is optional.
                </p>

                <CheckboxField
                    checked={consentToShare}
                    onChange={setConsentToShare}
                    required
                >
                    I allow FRDA to share the
                    information and links in this
                    submission with GeekOut K.K. for
                    this opportunity.
                </CheckboxField>

                <CheckboxField
                    checked={futureOpportunities}
                    onChange={
                        setFutureOpportunities
                    }
                >
                    Keep me updated about future FRDA
                    developer opportunities.
                </CheckboxField>

                <CheckboxField
                    checked={wantsDiscordInvite}
                    onChange={
                        setWantsDiscordInvite
                    }
                >
                    Send me a Discord invitation if FRDA marks my
                    submission as a GeekOut candidate.
                </CheckboxField>

                <TurnstileBox
                    containerRef={
                        turnstileContainerRef
                    }
                />

                {errorMessage ? (
                    <p className="rounded-[7px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                        {errorMessage}
                    </p>
                ) : null}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full cursor-pointer items-center justify-center rounded-[7px] bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting
                        ? "Submitting..."
                        : "Submit Portfolio"}
                </button>
            </form>
        </ModalShell>
    );
}

function FormField({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">
                {label}

                {required ? (
                    <span className="ml-1 text-blue-300">
                        *
                    </span>
                ) : null}
            </span>

            {children}
        </label>
    );
}

function CheckboxField({
    checked,
    onChange,
    required,
    children,
}: {
    checked: boolean;
    onChange: (
        checked: boolean,
    ) => void;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-3 rounded-[7px] border border-zinc-800 bg-zinc-950/35 p-4">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                    onChange(
                        event.target.checked,
                    )
                }
                className="mt-1"
            />

            <span className="text-sm leading-6 text-zinc-300">
                {children}

                {required ? (
                    <span className="ml-1 text-blue-300">
                        *
                    </span>
                ) : null}
            </span>
        </label>
    );
}

function TurnstileBox({
    containerRef,
}: {
    containerRef:
    RefObject<HTMLDivElement | null>;
}) {
    return (
        <div className="overflow-hidden rounded-[7px] border border-zinc-800 bg-zinc-950/40 p-3">
            <div ref={containerRef} />
        </div>
    );
}

function useTurnstile({
    containerRef,
    widgetIdRef,
    onToken,
}: {
    containerRef:
    RefObject<HTMLDivElement | null>;

    widgetIdRef:
    MutableRefObject<
        TurnstileWidgetId | null
    >;

    onToken: (
        token: string,
    ) => void;
}) {
    useEffect(() => {
        let cancelled = false;

        let timer:
            | ReturnType<typeof setInterval>
            | null = null;

        function tryRender() {
            if (
                cancelled ||
                !containerRef.current ||
                !window.turnstile ||
                !TURNSTILE_SITE_KEY ||
                widgetIdRef.current !== null
            ) {
                return;
            }

            widgetIdRef.current =
                window.turnstile.render(
                    containerRef.current,
                    {
                        sitekey:
                            TURNSTILE_SITE_KEY,

                        theme: "dark",
                        size: "flexible",

                        callback: (token) =>
                            onToken(token),

                        "expired-callback": () =>
                            onToken(""),

                        "error-callback": () =>
                            onToken(""),
                    },
                );

            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }

        tryRender();

        timer = setInterval(
            tryRender,
            250,
        );

        return () => {
            cancelled = true;

            if (timer) {
                clearInterval(timer);
            }

            if (
                widgetIdRef.current !== null &&
                window.turnstile
            ) {
                try {
                    window.turnstile.remove(
                        widgetIdRef.current,
                    );
                } catch {
                    // Widget may already be gone.
                }
            }

            widgetIdRef.current = null;
        };
    }, [
        containerRef,
        widgetIdRef,
        onToken,
    ]);
}

function resetTurnstile(
    widgetId:
        | TurnstileWidgetId
        | null,

    setToken: (
        token: string,
    ) => void,
) {
    setToken("");

    if (
        widgetId !== null &&
        window.turnstile
    ) {
        try {
            window.turnstile.reset(
                widgetId,
            );
        } catch {
            // Ignore reset errors.
        }
    }
}