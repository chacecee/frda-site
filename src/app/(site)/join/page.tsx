"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
    ArrowRight,
    BarChart3,
    Blocks,
    Check,
    Gamepad2,
    Globe2,
    Pause,
    Play,
    Search,
    ShieldCheck,
    Users,
    Wrench,
} from "lucide-react";
import OpenAccountModalButton from "@/components/site/OpenAccountModalButton";
import DeveloperPremiumCounter from "@/components/site/DeveloperPremiumCounter";

const audienceGroups = [
    {
        icon: Wrench,
        title: "Specialists",
        description:
            "Scripters, builders, UI designers, animators, VFX artists, audio developers, modelers, and others with a focused area of expertise.",
    },
    {
        icon: Blocks,
        title: "Generalists and solo developers",
        description:
            "Developers who work across several areas of production or can take a Roblox game from concept to release.",
    },
    {
        icon: Users,
        title: "Teams and project leads",
        description:
            "Studios, development groups, and leads who coordinate contributors and deliver complete Roblox experiences.",
    },
];

const profileBenefits = [
    {
        title: "Present your work with proper context",
        description:
            "Instead of sending potential clients loose Google Drive folders and scattered links, organize your work in one profile. Show the projects you contributed to, explain your role, and help people understand how you applied your skills.",
    },
    {
        title: "Publish up to three games for free",
        description:
            "List games you created or helped develop in FRDA’s public games directory. Each listing can also lead visitors back to your developer profile.",
    },
    {
        title: "Become an FRDA member",
        description:
            "Creating your profile also gives you free FRDA membership. You may join the members-only Discord, where we share developer opportunities and community updates.",
    },
];

const discoveryMethods = [
    {
        number: "01",
        title: "Through the developer directory",
        description:
            "Clients, studios, collaborators, and other developers can browse Filipino Roblox talent and open your public profile.",
    },
    {
        number: "02",
        title: "Through your public profile link",
        description:
            "Send your page with applications, Discord introductions, social posts, or direct outreach.",
    },
];

export default function DeveloperJoinPage() {
    const heroVideoRef = useRef<HTMLVideoElement | null>(null);
    const [isHeroVideoPaused, setIsHeroVideoPaused] = useState(false);

    useEffect(() => {
        const reduceMotionQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );

        function applyMotionPreference() {
            const video = heroVideoRef.current;

            if (!video) return;

            if (reduceMotionQuery.matches) {
                video.pause();
                setIsHeroVideoPaused(true);
            }
        }

        applyMotionPreference();
        reduceMotionQuery.addEventListener("change", applyMotionPreference);

        return () => {
            reduceMotionQuery.removeEventListener(
                "change",
                applyMotionPreference,
            );
        };
    }, []);

    async function toggleHeroVideo() {
        const video = heroVideoRef.current;

        if (!video) return;

        if (video.paused) {
            try {
                await video.play();
                setIsHeroVideoPaused(false);
            } catch {
                setIsHeroVideoPaused(true);
            }
        } else {
            video.pause();
            setIsHeroVideoPaused(true);
        }
    }

    return (
        <div className="overflow-x-hidden text-white">
            <section className="relative overflow-hidden pt-[104px] md:pt-[120px]">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,#06132d_0%,#071a40_42%,#041126_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_30%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,rgba(96,165,250,0.24),transparent_24%)]" />
                    <div className="absolute left-[-100px] top-24 h-[340px] w-[340px] rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="absolute right-[-80px] top-8 h-[500px] w-[500px] rounded-full bg-blue-400/20 blur-3xl" />
                    <div className="absolute right-[5%] top-24 h-[300px] w-[300px] rounded-full bg-fuchsia-400/12 blur-3xl" />
                </div>

                <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 md:grid-cols-[0.9fr_1.1fr] md:items-center md:px-8 md:pb-36 md:pt-28">
                    <div className="max-w-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/75">
                            FRDA Developer Marketplace
                        </p>

                        <h1 className="mt-5 text-3xl font-semibold leading-[1.1] text-white md:text-[44px]">
                            Build a professional presence as a Roblox game developer and get found
                        </h1>

                        <p className="mt-6 text-base leading-8 text-zinc-300 md:text-lg">
                            We built a developer marketplace where Filipino Roblox developers can showcase their work and get discovered by potential clients, collaborators, and teams.
                        </p>

                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <OpenAccountModalButton
                                tab="signup"
                                accountPurpose="developer"
                                signupOnly
                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_26px_rgba(37,99,235,0.24)] transition hover:bg-blue-400"
                            >
                                Create Your Profile
                                <ArrowRight className="h-4 w-4" />
                            </OpenAccountModalButton>

                            <Link
                                href="/developers"
                                className="inline-flex items-center justify-center rounded-[6px] border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/10"
                            >
                                View Developer Directory
                            </Link>
                        </div>

                        <p className="mt-4 text-xs leading-6 text-zinc-500">
                            Creating your free developer profile also enrolls you as an FRDA member. Membership is free.
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-8 rounded-full bg-blue-500/15 blur-3xl" />

                        <div className="relative overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.05] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-md sm:p-4">
                            <div className="flex items-center gap-2 rounded-t-[8px] border-b border-white/10 bg-white/[0.06] px-4 py-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                                <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                                <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                                <div className="ml-2 flex-1 rounded-[5px] border border-white/10 bg-black/15 px-3 py-1.5 text-center text-[11px] font-semibold text-zinc-400 sm:text-xs">
                                    yourname.frdaph.org
                                </div>
                            </div>

                            <div className="relative min-h-[420px] overflow-hidden rounded-b-[8px] bg-[#071326]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%)]" />

                                <video
                                    ref={heroVideoRef}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    preload="metadata"
                                    poster="/devdirectory.jpg"
                                    className="absolute inset-0 h-full w-full object-cover object-top"
                                    aria-label="Preview of an FRDA developer profile"
                                >
                                    <source
                                        src="/developer-profile-demo.mp4"
                                        type="video/mp4"
                                    />
                                </video>

                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,rgba(7,19,38,0.88)_0%,rgba(7,19,38,0.38)_58%,rgba(7,19,38,0)_100%)]" />

                                <button
                                    type="button"
                                    onClick={toggleHeroVideo}
                                    className="absolute bottom-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/75 shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-black/55 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/80"
                                    aria-label={
                                        isHeroVideoPaused
                                            ? "Play profile preview"
                                            : "Pause profile preview"
                                    }
                                >
                                    {isHeroVideoPaused ? (
                                        <Play
                                            className="h-4 w-4 translate-x-[1px]"
                                            fill="currentColor"
                                        />
                                    ) : (
                                        <Pause
                                            className="h-4 w-4"
                                            fill="currentColor"
                                        />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-white/10 bg-[#040b19] px-6 py-28 md:px-8 md:py-36">
                <div className="mx-auto max-w-7xl">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                            Who can create a profile
                        </p>

                        <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
                            Who is it for?
                        </h2>

                        <p className="mt-6 text-base leading-8 text-zinc-400">
                            You do not need to build an entire game alone. FRDA profiles are for developers who can clearly show the work they do and the role they played in a project.
                        </p>
                    </div>

                    <div className="mx-auto mt-20 flex max-w-4xl flex-col items-center justify-center gap-16 md:flex-row md:items-start md:gap-14 xl:gap-20">
                        {audienceGroups.map((group) => {
                            const Icon = group.icon;

                            return (
                                <article
                                    key={group.title}
                                    className="max-w-[235px] text-center"
                                >
                                    <div className="mx-auto flex justify-center text-blue-300 drop-shadow-[0_0_18px_rgba(59,130,246,0.30)]">
                                        <Icon className="h-11 w-11" strokeWidth={1.25} />
                                    </div>

                                    <h3 className="mt-7 text-xl font-semibold leading-snug text-white">
                                        {group.title}
                                    </h3>

                                    <p className="mt-6 text-base leading-7 text-zinc-400">
                                        {group.description}
                                    </p>
                                </article>
                            );
                        })}
                    </div>

                    <p className="mx-auto mt-16 max-w-4xl text-center text-sm leading-7 text-zinc-500">
                        <span className="font-semibold text-zinc-300">
                            Newer developers may join once they have genuine work to show.
                        </span>{" "}
                        Public profiles should give visitors a useful sense of their current ability.
                    </p>
                </div>
            </section>

            <section className="bg-[#08152f] px-6 py-28 md:px-8 md:py-36">
                <div className="mx-auto max-w-7xl">
                    <div className="grid gap-14 lg:grid-cols-[0.98fr_1.02fr] lg:items-start">
                        <div className="lg:sticky lg:top-28">
                            <div className="relative mx-auto max-w-[560px]">
                                <div className="pointer-events-none absolute -inset-3 rounded-[16px] bg-blue-400/25 blur-xl" />

                                <div className="relative overflow-hidden rounded-[10px] border border-blue-300/35 bg-[#050d1b] p-3 shadow-[0_0_18px_rgba(96,165,250,0.55),0_0_46px_rgba(37,99,235,0.32),0_24px_70px_rgba(0,0,0,0.30)] sm:p-4">
                                    <div className="relative aspect-[9/10] overflow-hidden rounded-[7px] bg-[#071326]">
                                        <Image
                                            src="/sample-profile.jpg"
                                            alt="Full FRDA developer profile example"
                                            fill
                                            className="object-contain object-top"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/75">
                                Profile benefits
                            </p>

                            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
                                Here’s what you’ll get with your free profile
                            </h2>

                            <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
                                {profileBenefits.map((benefit) => (
                                    <article
                                        key={benefit.title}
                                        className="grid gap-5 py-8 sm:grid-cols-[34px_1fr]"
                                    >
                                        <div className="pt-0.5">
                                            <Check className="h-6 w-6 text-blue-300 drop-shadow-[0_0_12px_rgba(96,165,250,0.85)]" />
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-semibold text-white">
                                                {benefit.title}
                                            </h3>

                                            <p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base">
                                                {benefit.title === "Publish up to three games for free" ? (
                                                    <>
                                                        List games you created or helped develop in{" "}
                                                        <Link
                                                            href="/games"
                                                            className="text-blue-300 underline decoration-blue-400/50 underline-offset-4 transition hover:text-blue-200"
                                                        >
                                                            FRDA’s public games directory
                                                        </Link>
                                                        . Each listing can also lead visitors back to your developer profile.
                                                    </>
                                                ) : (
                                                    benefit.description
                                                )}
                                            </p>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <div className="mt-8 border-l-2 border-blue-400/50 pl-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                                    Launch benefit
                                </p>

                                <p className="mt-2 text-sm leading-7 text-zinc-300 sm:text-base">
                                    The first 30 approved published profiles receive lifetime Profile Premium, including profile analytics and a custom address such as{" "}
                                    <span className="font-semibold text-white">
                                        yourname.frdaph.org
                                    </span>
                                    .
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative overflow-hidden border-y border-white/10 bg-[linear-gradient(180deg,#020409_0%,#04070d_100%)] px-6 py-28 md:px-8 md:py-36">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.10),transparent_42%)]" />
                    <div className="absolute left-[8%] top-[8%] h-[84%] w-[84%] opacity-70">
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage: `
                                    linear-gradient(rgba(59,130,246,0.16) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(59,130,246,0.16) 1px, transparent 1px)
                                `,
                                backgroundSize: "56px 56px, 56px 56px",
                                maskImage:
                                    "radial-gradient(circle at center, black 48%, transparent 88%)",
                                WebkitMaskImage:
                                    "radial-gradient(circle at center, black 48%, transparent 88%)",
                            }}
                        />
                    </div>
                </div>

                <div className="relative mx-auto max-w-7xl">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                            How people can find you
                        </p>

                        <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
                            Get discovered through FRDA or share your profile directly
                        </h2>
                    </div>

                    <div className="mx-auto mt-12 max-w-5xl">
                        <div className="relative overflow-hidden rounded-[10px] border border-white/10 bg-[#081730] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-4">
                            <div className="relative min-h-[340px] overflow-hidden rounded-[7px] bg-[#071326] md:min-h-[440px]">
                                <Image
                                    src="/developer-directory-preview2.jpg"
                                    alt="FRDA developer directory preview"
                                    fill
                                    className="object-cover object-top"
                                />
                            </div>
                        </div>

                        <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-0">
                            {discoveryMethods.map((method, index) => (
                                <article
                                    key={method.number}
                                    className={`md:px-10 ${index > 0 ? "md:border-l md:border-white/10" : ""
                                        }`}
                                >
                                    <p className="text-sm font-semibold tracking-[0.16em] text-blue-300">
                                        {method.number}
                                    </p>

                                    <h3 className="mt-4 text-lg font-semibold text-white">
                                        {method.title}
                                    </h3>

                                    <p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base">
                                        {method.description}
                                    </p>
                                </article>
                            ))}
                        </div>

                        <div className="mt-9 text-center">
                            <Link
                                href="/developers"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition hover:text-blue-200"
                            >
                                View the developer directory
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative overflow-hidden bg-[#08152f] px-6 py-28 md:px-8 md:py-36">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.10),transparent_42%)]" />

                <div className="relative mx-auto max-w-6xl">
                    <div className="grid gap-12 lg:grid-cols-[1fr_0.82fr] lg:items-center">
                        <div>
                            <h2 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
                                The first 30 approved profiles get premium access free for life
                            </h2>

                            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
                                Publish a complete developer profile during the launch campaign and it may qualify for lifetime access to Profile Premium.
                            </p>

                            <div className="mt-9 grid gap-8 sm:grid-cols-2">
                                <div>
                                    <BarChart3 className="h-6 w-6 text-blue-300" />
                                    <p className="mt-4 font-semibold text-white">
                                        Profile analytics
                                    </p>
                                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                                        See how people are finding and viewing your public profile.
                                    </p>
                                </div>

                                <div>
                                    <Globe2 className="h-6 w-6 text-blue-300" />
                                    <p className="mt-4 font-semibold text-white">
                                        Custom FRDA address
                                    </p>
                                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                                        Claim an address such as yourname.frdaph.org for your public profile.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DeveloperPremiumCounter />
                    </div>

                    <div className="mt-10 flex gap-3 border-t border-white/10 pt-6">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                        <p className="text-xs leading-6 text-zinc-400 sm:text-sm">
                            Premium qualification is subject to FRDA review. Registering or publishing does not reserve a slot. A spot is counted only after FRDA reviews the profile and grants lifetime premium. Profiles should be sufficiently complete, presentable, and supported by genuine work samples. Placeholder images or weak sample content may be found ineligible. FRDA aims to review eligible published profiles within three business days.
                        </p>
                    </div>
                </div>
            </section>

            <section className="border-t border-white/10 bg-[#040914] px-6 py-24 text-center md:px-8 md:py-32">
                <div className="mx-auto max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                        Ready to be seen?
                    </p>

                    <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                        Create your free developer profile
                    </h2>

                    <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-400">
                        Add your strongest work, explain what you contributed, and give potential clients, collaborators, and partners a clearer way to understand your capabilities.
                    </p>

                    <OpenAccountModalButton
                        tab="signup"
                        accountPurpose="developer"
                        signupOnly
                        className="mt-8 inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-blue-500 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                        Start Your Developer Profile
                        <ArrowRight className="h-4 w-4" />
                    </OpenAccountModalButton>
                </div>
            </section>
        </div>
    );
}