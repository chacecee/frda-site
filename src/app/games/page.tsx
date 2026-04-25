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
    <main className="min-h-screen bg-[#060913] text-white">
      <GamesVisitTracker />
      <SiteHeader />
      <PublicGamesDirectory />
    </main>
  );
}