import SiteHeader from "@/components/site/SiteHeader";
import GamesVisitTracker from "@/components/analytics/GamesVisitTracker";
import PublicGamesDirectory from "@/components/games/PublicGamesDirectory";

export const metadata = {
  title: "Game Directory | FRDA",
  description:
    "Explore Roblox experiences made by Filipino developers and reviewed by FRDA.",
};

export default function GamesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030713] text-white">
      <GamesVisitTracker />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* base background */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#07101f_0%,#040817_42%,#030713_100%)]" />

        {/* left blue glow */}
        <div className="absolute left-[-180px] top-[-120px] h-[520px] w-[520px] rounded-full bg-blue-500/16 blur-[140px]" />

        {/* center blue mist */}
        <div className="absolute left-1/2 top-[80px] h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-blue-400/10 blur-[150px]" />

        {/* right teal glow */}
        <div className="absolute right-[-160px] top-[120px] h-[620px] w-[620px] rounded-full bg-cyan-400/14 blur-[170px]" />

        {/* lower right teal glow */}
        <div className="absolute right-[8%] top-[45%] h-[420px] w-[420px] rounded-full bg-teal-400/10 blur-[140px]" />

        {/* lower left indigo glow */}
        <div className="absolute bottom-[-180px] left-[-100px] h-[420px] w-[420px] rounded-full bg-indigo-500/12 blur-[150px]" />

        {/* frosted haze */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,0.10),transparent_26%),radial-gradient(circle_at_82%_22%,rgba(45,212,191,0.10),transparent_24%),radial-gradient(circle_at_72%_60%,rgba(34,211,238,0.08),transparent_18%),radial-gradient(circle_at_30%_85%,rgba(99,102,241,0.08),transparent_24%)]" />

        {/* faint grid */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.28)_1px,transparent_1px)] [background-size:72px_72px]" />

        {/* subtle vertical light sweep */}
        <div className="absolute inset-y-0 right-[14%] w-[280px] bg-[linear-gradient(90deg,transparent,rgba(45,212,191,0.06),transparent)] blur-[40px]" />

        {/* glass wash */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.015)_18%,rgba(2,6,23,0.08)_38%,rgba(2,6,23,0.22)_70%,rgba(2,6,23,0.45)_100%)]" />

        {/* tiny blur to soften everything */}
        <div className="absolute inset-0 backdrop-[blur(1.2px)]" />
      </div>

      <div className="relative z-10">
        <SiteHeader />
        <PublicGamesDirectory />
      </div>
    </main>
  );
}