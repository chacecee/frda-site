import Image from "next/image";
import Link from "next/link";
import {
    ArrowRight,
    BarChart3,
    Check,
    Globe2,
    Search,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import OpenAccountModalButton from "@/components/site/OpenAccountModalButton";
import DeveloperPremiumCounter from "@/components/site/DeveloperPremiumCounter";

const profileBenefits = [
    {
        icon: Search,
        title: "Be discovered through the directory",
        description:
            "Clients, studios, collaborators, and other developers can browse Filipino Roblox talent and open your public profile.",
        href: "/developers",
        linkLabel: "View the developer directory",
        disclaimer: "",
    },
    {
        icon: Globe2,
        title: "Share your public page directly",
        description:
            "Your profile also works as a standalone public page you can send in applications, Discord introductions, social posts, and direct outreach.",
        href: "",
        linkLabel: "",
        disclaimer:
            "Custom FRDA subdomains are currently available only to the first 30 approved published profiles and may later be offered as a paid upgrade.",
    },
];

const profileContents = [
    "Your display name, avatar, and short introduction",
    "Skills, availability, and the roles you can handle",
    "Selected Roblox projects with your contribution clearly explained",
    "Portfolio images and links to your work",
    "Optional social links and contact routing through FRDA",
];

const priorityProfiles = [
    "Solo developers or teams capable of taking a Roblox game from concept to completion",
    "Project leads who can coordinate specialists and deliver a finished experience",
    "Developers with completed games or substantial contributions they can clearly demonstrate",
    "Specialists with strong, focused work in scripting, building, UI, animation, VFX, audio, or related areas",
];

export default function DeveloperJoinPage() {
    return (
        <div className="overflow-x-hidden text-white">
            <section className="relative overflow-hidden pt-[104px] md:pt-[120px]">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,#06132d_0%,#071a40_42%,#041126_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_30%)]" />
                    <div className="absolute left-[-100px] top-24 h-[340px] w-[340px] rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="absolute right-[-100px] top-20 h-[360px] w-[360px] rounded-full bg-fuchsia-400/10 blur-3xl" />
                </div>

                <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 md:grid-cols-[0.9fr_1.1fr] md:items-center md:px-8 md:pb-32 md:pt-24">
                    <div className="max-w-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/75">
                            FRDA Developer Marketplace
                        </p>

                        <h1 className="mt-5 text-4xl font-semibold leading-[1.08] text-white md:text-[52px]">
                            Give your Roblox work a professional home
                        </h1>

                        <p className="mt-6 text-base leading-8 text-zinc-300 md:text-lg">
                            Create a free public developer profile, appear in FRDA’s directory of Filipino Roblox talent, and share your work through a page built to help people understand what you can do.
                        </p>

                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <OpenAccountModalButton
                                tab="signup"
                                accountPurpose="developer"
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
                            Creating and publishing a standard developer profile is free.
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-8 rounded-full bg-blue-500/15 blur-3xl" />

                        <div className="relative overflow-hidden rounded-[12px] border border-blue-300/20 bg-[#dce8ff] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.44)] sm:p-4">
                            <div className="flex items-center gap-2 rounded-t-[8px] border-b border-slate-300 bg-slate-100 px-4 py-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                <div className="ml-2 flex-1 rounded-[5px] border border-slate-300 bg-white px-3 py-1.5 text-center text-[11px] font-semibold text-slate-700 sm:text-xs">
                                    yourname.frdaph.org
                                </div>
                            </div>

                            <div className="relative min-h-[420px] overflow-hidden rounded-b-[8px] bg-[#071326]">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%)]" />

                                <Image
                                    src="/devdirectory.jpg"
                                    alt="Sample FRDA developer profile preview"
                                    fill
                                    priority
                                    className="object-cover object-top"
                                />

                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,rgba(7,19,38,0.88)_0%,rgba(7,19,38,0.38)_58%,rgba(7,19,38,0)_100%)]" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-white/10 bg-[#040b19] px-6 py-18 md:px-8 md:py-24">
                <div className="mx-auto max-w-7xl">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                            Two ways to be seen with your profile
                        </p>

                        <h2 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                            Get discovered through FRDA or share your page directly
                        </h2>

                        <p className="mt-5 text-base leading-8 text-zinc-400">
                            Your profile can appear in the public developer directory while also working as a standalone public page you can send anywhere.
                        </p>
                    </div>

                    <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
                        {profileBenefits.map((benefit) => {
                            const Icon = benefit.icon;

                            return (
                                <article
                                    key={benefit.title}
                                    className="rounded-[8px] border border-white/10 bg-[#081730]/70 p-6"
                                >
                                    <div className="flex h-11 w-11 items-center justify-center rounded-[7px] border border-blue-400/20 bg-blue-500/10 text-blue-300">
                                        <Icon className="h-5 w-5" />
                                    </div>

                                    <h3 className="mt-5 text-lg font-semibold text-white">
                                        {benefit.title}
                                    </h3>

                                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                                        {benefit.description}
                                    </p>

                                    {benefit.title === "Be discovered through the directory" ? (
                                        <Link
                                            href="/developers"
                                            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition hover:text-blue-200"
                                        >
                                            View the developer directory
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    ) : (
                                        <p className="mt-5 text-xs leading-6 text-zinc-500">
                                            Custom <span className="font-semibold text-zinc-400">yourname.frdaph.org</span> addresses are currently available only to the first 30 approved published profiles and may later be offered as a paid upgrade.
                                        </p>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 md:px-8 md:py-28">
                <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                            Show what you can do
                        </p>

                        <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
                            Build a clearer picture of your skills and experience
                        </h2>

                        <p className="mt-6 text-base leading-8 text-zinc-400">
                            Instead of sending people a loose collection of files and links, you can give them one organized page that explains your work and the role you played in it.
                        </p>

                        <ul className="mt-8 space-y-4">
                            {profileContents.map((item) => (
                                <li key={item} className="flex gap-3 text-sm leading-7 text-zinc-300 sm:text-base">
                                    <Check className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-[10px] border border-dashed border-blue-300/30 bg-blue-500/[0.06] p-7 sm:p-10">
                        <div className="flex min-h-[360px] items-center justify-center text-center">
                            <div className="max-w-md">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                                    Secondary image space
                                </p>

                                <h3 className="mt-3 text-2xl font-semibold text-white">
                                    Add another screenshot here if you want
                                </h3>

                                <p className="mt-4 text-sm leading-7 text-zinc-400">
                                    This area can hold a directory screenshot, profile editor preview, or a side-by-side image showing how developers are discovered and viewed.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-white/10 bg-[#08152f] px-6 py-20 md:px-8 md:py-24">
                <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.92fr] lg:items-start">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/75">
                            Who this is for
                        </p>

                        <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
                            Built for developers and teams with work worth showing
                        </h2>

                        <p className="mt-6 text-base leading-8 text-zinc-300">
                            FRDA especially wants to make it easier to find developers and teams capable of building or leading a complete Roblox game. Strong specialists are also welcome when they can clearly demonstrate their contribution.
                        </p>

                        <div className="mt-8 space-y-4">
                            {priorityProfiles.map((item) => (
                                <div key={item} className="flex gap-3 text-sm leading-7 text-zinc-300 sm:text-base">
                                    <Check className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <aside className="rounded-[9px] border border-white/10 bg-[#050d1b] p-6 sm:p-7">
                        <p className="text-sm font-semibold text-white">
                            Still building your experience?
                        </p>

                        <p className="mt-3 text-sm leading-7 text-zinc-400">
                            Aspiring developers may create an account and begin building a profile, but public profiles should contain genuine work that gives visitors a useful sense of the developer’s present ability.
                        </p>

                        <p className="mt-4 text-sm leading-7 text-zinc-400">
                            Placeholder images, unrelated uploads, or profiles with too little meaningful work may be removed from public view or found ineligible for promotional and premium benefits.
                        </p>
                    </aside>
                </div>
            </section>

            <section className="relative overflow-hidden px-6 py-20 md:px-8 md:py-28">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.11),transparent_40%)]" />

                <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[12px] border border-blue-300/20 bg-[linear-gradient(135deg,#0a1e45_0%,#08162f_55%,#07101f_100%)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-10 lg:p-12">
                    <div className="grid gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
                                <Sparkles className="h-3.5 w-3.5" />
                                Limited launch benefit
                            </div>

                            <h2 className="mt-5 text-3xl font-semibold leading-tight text-white md:text-4xl">
                                The first 30 approved profiles receive premium access free for life
                            </h2>

                            <p className="mt-5 text-base leading-8 text-zinc-300">
                                Publish early and your profile may qualify for lifetime access to the premium profile features planned for the marketplace.
                            </p>

                            <div className="mt-7 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-[8px] border border-white/10 bg-black/15 p-5">
                                    <BarChart3 className="h-5 w-5 text-blue-300" />
                                    <p className="mt-3 font-semibold text-white">Profile analytics</p>
                                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                                        See how people are finding and viewing your public profile.
                                    </p>
                                </div>

                                <div className="rounded-[8px] border border-white/10 bg-black/15 p-5">
                                    <Globe2 className="h-5 w-5 text-blue-300" />
                                    <p className="mt-3 font-semibold text-white">Custom FRDA subdomain</p>
                                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                                        A custom address such as yourname.frdaph.org. This is currently available only to the first 30 FRDA-approved published profiles and may later be offered as a paid upgrade.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DeveloperPremiumCounter />
                    </div>

                    <div className="mt-8 flex gap-3 rounded-[8px] border border-amber-300/15 bg-amber-300/[0.06] p-4">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                        <p className="text-xs leading-6 text-zinc-400 sm:text-sm">
                            Premium qualification is subject to FRDA review. Publishing early does not automatically reserve a slot. Profiles should be sufficiently complete, presentable, and supported by genuine work samples. Placeholder images or weak sample content may be found ineligible. FRDA aims to review eligible published profiles within three business days.
                        </p>
                    </div>
                </div>
            </section>

            <section className="border-t border-white/10 bg-[#040914] px-6 py-20 text-center md:px-8 md:py-24">
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