import SiteHeader from "@/components/site/SiteHeader";
import SubmitGameForm from "@/components/games/SubmitGameForm";

export const metadata = {
  title: "Submit Your Game | FRDA",
  description: "Submit a Roblox experience for FRDA game directory review.",
};

export default function SubmitGamePage() {
  return (
    <main className="min-h-screen bg-[#060913] text-white">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-[128px] md:px-8 md:pt-[150px]">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
            Submit Your Game
          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Submit a Roblox experience for directory review
          </h1>

          <p className="mt-4 text-base leading-7 text-zinc-400">
            FRDA reviews submitted games before they appear in the public Game
            Directory. Please provide accurate details so reviewers can evaluate
            your listing properly.
          </p>
        </div>

        <SubmitGameForm />
      </section>
    </main>
  );
}