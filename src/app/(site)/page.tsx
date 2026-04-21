import Link from "next/link";
import { Users, ShieldCheck, Briefcase } from "lucide-react";
import FeaturedWorkShowcase from "@/components/site/FeaturedWorkShowcase";
import HomepageAnnouncement from "@/components/site/HomepageAnnouncement";

const featuredCreations = [
    {
        title: "Project Showcase One",
        type: "Game Experience",
        description:
            "A featured Roblox creation from a Filipino builder or team helping shape the local scene.",
    },
    {
        title: "Project Showcase Two",
        type: "Studio / Team",
        description:
            "A space to spotlight promising work from creators, scripters, designers, or emerging studios.",
    },
    {
        title: "Project Showcase Three",
        type: "Rising Talent",
        description:
            "A curated feature that can later be replaced with real community work, screenshots, and creator credits.",
    },
];

const faqItems = [
    {
        question: "What is FRDA?",
        answer:
            "FRDA is the Filipino Roblox Developers Association. We support Filipino Roblox developers through stronger representation, responsible development, trust, and future opportunities.",
    },
    {
        question: "Who can register as a developer?",
        answer:
            "The registration system is for Filipino Roblox developers and related creators who want to be part of a more structured network and review process.",
    },
    {
        question: "Is FRDA officially affiliated with Roblox?",
        answer:
            "FRDA is a community-driven organization for Filipino Roblox developers. Unless officially stated elsewhere, it should not be presented as an official Roblox-operated body.",
    },
    {
        question: "What does registration do?",
        answer:
            "Registration helps FRDA build a more organized developer network while laying the groundwork for greater visibility, credibility, and future opportunities.",
    },
    {
        question: "Can organizations or partners reach out to FRDA?",
        answer: (
            <>
                Yes. Organizations interested in supporting the local creator
                community or exploring collaboration are welcome to connect
                through FRDA’s{" "}
                <Link
                    href="/contact"
                    className="text-blue-200 underline decoration-blue-400/50 underline-offset-4 transition hover:text-white hover:decoration-blue-300"
                >
                    contact channels
                </Link>
                .
            </>
        ),
    },
];

export default function HomePage() {
    return (
        <div className="overflow-x-hidden">
            <section className="relative overflow-hidden pt-[104px] md:pt-[120px]">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(113,92,255,0.12),transparent_30%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(54,189,248,0.08),transparent_20%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(236,72,153,0.08),transparent_22%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,#06132d_0%,#071a40_38%,#05163b_100%)]" />

                    <div className="absolute left-[-120px] top-24 h-[360px] w-[360px] rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="absolute right-[-100px] top-16 h-[340px] w-[340px] rounded-full bg-fuchsia-400/10 blur-3xl" />
                    <div className="absolute left-1/2 top-[420px] h-[220px] w-[760px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />

                    <div
                        className="absolute inset-0 opacity-[0.10] bg-center bg-cover bg-no-repeat mix-blend-screen"
                        style={{ backgroundImage: "url('/hero-overlay.png')" }}
                    />


                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,30,0.45)_0%,rgba(4,12,30,0.30)_18%,rgba(4,12,30,0.60)_100%)]" />
                </div>

                <div className="relative mx-auto max-w-5xl px-6 pb-28 pt-[112px] text-center md:px-8 md:pb-40 md:pt-[136px]">
                    <h1 className="mx-auto max-w-4xl text-3xl font-semibold leading-[1.12] text-white md:text-[46px]">
                        Championing higher standards for Filipino Roblox developers
                    </h1>

                    <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-zinc-300">
                        We bring Filipino Roblox developers together to strengthen their representation, connect them with opportunities, and encourage responsible game development.
                    </p>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                        <Link
                            href="/apply"
                            className="rounded-[5px] border border-blue-400/30 bg-blue-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-[0_0_20px_rgba(37,99,235,0.18)] transition hover:bg-blue-400"
                        >
                            Register as Developer
                        </Link>

                        <Link
                            href="/about"
                            className="rounded-[5px] border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#d6d6d6] transition hover:bg-white/10"
                        >
                            Learn About FRDA
                        </Link>
                    </div>

                </div>
            </section>

            <HomepageAnnouncement />

            <section className="relative bg-[linear-gradient(180deg,#040914_0%,#02060f_100%)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-0">
                    <div
                        className="absolute left-1/2 -top-[0.75px] h-[0.5px] w-[840px] -translate-x-1/2 opacity-90"
                        style={{
                            background:
                                "linear-gradient(to right, rgba(59,130,246,0) 0%, rgba(96,165,250,0.55) 18%, rgba(147,197,253,0.95) 50%, rgba(96,165,250,0.55) 82%, rgba(59,130,246,0) 100%)",
                            boxShadow:
                                "0 0 118px 6px rgba(207,250,254,0.55), 0 0 60px 18px rgba(96,165,250,0.32), 0 -200px 380px 180px rgba(59,130,246,0.18)",
                        }}
                    />

                    <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,#040914_0%,rgba(4,9,20,0.88)_18%,rgba(4,9,20,0.45)_46%,rgba(4,9,20,0)_100%)]" />
                </div>

                <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[0.8fr_1.1fr] md:px-8 md:py-28">
                    <div className="flex max-w-[420px] flex-col justify-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                            Conversations that matter
                        </p>

                        <h2 className="mt-4 text-2xl font-semibold leading-tight text-white md:text-3xl">
                            We show up where decisions can shape the community
                        </h2>

                        <p className="mt-6 text-base leading-8 text-zinc-300">
                            We take part in public, industry, and stakeholder conversations that can
                            affect Filipino Roblox developers and the wider community.
                        </p>

                        <p className="mt-5 text-base leading-8 text-zinc-300">
                            From public discussions to relevant meetings and stakeholder
                            conversations, we stay engaged where ideas and decisions can impact the
                            ecosystem in meaningful ways.
                        </p>

                        <p className="mt-5 text-base leading-8 text-zinc-300">
                            If you’d like to connect with us for an interview, appearance, or
                            related discussion,{" "}
                            <Link
                                href="/contact"
                                className="text-blue-200 underline decoration-blue-400/50 underline-offset-4 transition hover:text-white hover:decoration-blue-300"
                            >
                                we welcome the opportunity
                            </Link>
                            .
                        </p>
                    </div>

                    <div className="w-full max-w-[560px] rounded-[5px] bg-[#0a1220] p-5">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="h-[2px] w-10 bg-blue-400" />
                            <p className="text-lg font-semibold uppercase tracking-[0.12em] text-white">
                                Public mentions and involvement
                            </p>
                        </div>

                        <div
                            className="max-h-[420px] space-y-4 overflow-y-auto pr-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#08111d] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-500/50 [&::-webkit-scrollbar-thumb]:border-[1px] [&::-webkit-scrollbar-thumb]:border-[#08111d] hover:[&::-webkit-scrollbar-thumb]:bg-blue-400/60"
                            style={{
                                scrollbarWidth: "thin",
                                scrollbarColor: "rgba(59,130,246,0.5) #08111d",
                            }}
                        >
                            {[
                                {
                                    title: "CICC stakeholder meeting",
                                    href: "https://www.facebook.com/share/v/1LMHiFAWoY/",
                                    source: "CICC stakeholder meeting",
                                    date: "March 31, 2026",
                                    image: "/news1.png",
                                    description:
                                        "FRDA took part in the CICC stakeholder meeting on Roblox-related concerns, where child safety and wider digital space issues were discussed.",
                                },
                                {
                                    title: "News5 coverage",
                                    href: "https://www.facebook.com/share/p/1E8fHgQfCd/",
                                    source: "News5",
                                    date: "March 24, 2026",
                                    image: "/news2.png",
                                    description:
                                        "FRDA’s perspective on the possible Roblox ban surfaced in public News5 coverage discussing its impact on Filipino developers.",
                                },
                                {
                                    title: "BitPinas mention",
                                    href: "https://www.facebook.com/share/p/1bXcTyRJJe/",
                                    source: "BitPinas",
                                    date: "March 30, 2026",
                                    image: "/news3.png",
                                    description:
                                        "BitPinas highlighted FRDA’s warning that a nationwide restriction could affect the livelihoods of thousands of local Roblox creators.",
                                },
                            ].map((item, index) => (
                                <article
                                    key={index}
                                    className="flex flex-col gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0 sm:flex-row"
                                >
                                    <div className="h-40 w-full shrink-0 overflow-hidden rounded-[5px] bg-[#13284e] sm:h-24 sm:w-32">
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    <div className="min-w-0 pr-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/70">
                                            {item.source}
                                        </p>
                                        <p className="mt-1 text-xs text-zinc-500">{item.date}</p>

                                        <a
                                            href={item.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 block text-base font-semibold leading-6 text-white transition hover:text-blue-300"
                                        >
                                            {item.title}
                                        </a>

                                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                                            {item.description}
                                        </p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative overflow-hidden px-6 py-28 md:px-8 md:py-40">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_30%)]" />
                    <div className="absolute left-1/2 top-20 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/8 blur-3xl" />
                </div>

                <div className="relative mx-auto max-w-7xl">
                    <div className="mx-auto mb-20 max-w-2xl text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                            What FRDA is building
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                            These are the areas we’re focused on.
                        </h2>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-16 md:flex-row md:items-start md:gap-12 xl:gap-20">
                        <div className="max-w-[250px] text-center">
                            <div className="mx-auto flex justify-center text-blue-300 drop-shadow-[0_0_16px_rgba(59,130,246,0.22)]">
                                <Users className="h-16 w-16" strokeWidth={1} />
                            </div>
                            <h3 className="mt-6 text-xl font-semibold text-white">
                                Representing Filipino Roblox developers
                            </h3>
                            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-zinc-400">
                                Help give local developers a stronger and more visible collective
                                identity.
                            </p>
                        </div>

                        <div className="max-w-[250px] text-center">
                            <div className="mx-auto flex justify-center text-blue-300 drop-shadow-[0_0_16px_rgba(59,130,246,0.22)]">
                                <ShieldCheck className="h-16 w-16" strokeWidth={1} />
                            </div>
                            <h3 className="mt-6 text-xl font-semibold text-white">
                                Encouraging responsible development
                            </h3>
                            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-zinc-400">
                                Promote game development practices that build greater trust among
                                players, families, and the wider community.
                            </p>
                        </div>

                        <div className="max-w-[250px] text-center">
                            <div className="mx-auto flex justify-center text-blue-300 drop-shadow-[0_0_16px_rgba(59,130,246,0.22)]">
                                <Briefcase className="h-16 w-16" strokeWidth={1} />
                            </div>
                            <h3 className="mt-6 text-xl font-semibold text-white">
                                Connecting talent with opportunity
                            </h3>
                            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-zinc-400">
                                Create more paths for visibility, recognition, and future
                                collaboration.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative overflow-visible bg-[linear-gradient(180deg,#020409_0%,#04070d_100%)] px-6 py-6 md:px-8 md:py-8">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(37,99,235,0.12),transparent_30%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(59,130,246,0.07),transparent_26%)]" />

                    <div className="absolute left-[4%] top-[6%] h-[82%] w-[44%] opacity-100">
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage: `
            linear-gradient(rgba(59,130,246,0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.22) 1px, transparent 1px)
          `,
                                backgroundSize: "56px 56px, 56px 56px",
                                maskImage: "radial-gradient(circle at center, black 62%, transparent 96%)",
                                WebkitMaskImage:
                                    "radial-gradient(circle at center, black 62%, transparent 96%)",
                            }}
                        />

                        <div className="absolute left-[16%] top-[22%] h-[300px] w-[300px] rounded-full bg-blue-500/12 blur-3xl" />
                        <div className="absolute left-[34%] top-[42%] h-[260px] w-[260px] rounded-full bg-cyan-400/8 blur-3xl" />
                    </div>
                </div>

                <div className="relative mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
                    <div className="max-w-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                            Featured work
                        </p>

                        <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
                            We’re spotlighting what local talent can do
                        </h2>

                        <div
                            className="mt-4 h-[2px] w-[180px]"
                            style={{
                                background:
                                    "linear-gradient(to right, rgba(96,165,250,0.95) 0%, rgba(147,197,253,0.55) 55%, rgba(96,165,250,0) 100%)",
                                boxShadow:
                                    "0 0 14px rgba(96,165,250,0.35), 0 0 32px rgba(59,130,246,0.22)",
                            }}
                        />

                        <p className="mt-6 text-base leading-8 text-zinc-300">
                            Filipino Roblox developers are building experiences that draw on
                            design, scripting, worldbuilding, systems thinking, and creative
                            direction. These featured works offer a glimpse of the range, effort,
                            and skill behind the community.
                        </p>
                    </div>

                    <FeaturedWorkShowcase />
                </div>
            </section>

            <section className="mx-auto max-w-5xl px-6 py-16 md:px-8 md:py-24">
                <div className="mb-12 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                        COMMON QUESTIONS
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                        Frequently asked questions
                    </h2>
                </div>

                <div className="space-y-4">
                    {faqItems.map((item) => (
                        <details
                            key={item.question}
                            className="group rounded-[5px] border border-white/10 bg-[#081730]/70 p-5"
                        >
                            <summary className="cursor-pointer list-none text-left text-base font-normal text-white marker:hidden">
                                {item.question}
                            </summary>
                            <p className="mt-4 text-sm leading-7 text-zinc-400">
                                {item.answer}
                            </p>
                        </details>
                    ))}
                </div>
            </section>

        </div>
    );
}