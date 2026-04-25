import SiteHeader from "@/components/site/SiteHeader";

export const metadata = {
  title: "Submit Your Game | FRDA",
  description: "Submit a Roblox experience for FRDA game directory review.",
};

export default function SubmitGamePage() {
  return (
    <main className="min-h-screen bg-[#060913] text-white">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-[128px] md:px-8 md:pt-[150px]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
          Submit Your Game
        </p>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Game submissions are coming soon
        </h1>

        <p className="mt-4 text-base leading-7 text-zinc-400">
          We’re preparing a reviewed submission flow for FRDA members. Once ready,
          developers will be able to submit their Roblox experience for directory
          review here.
        </p>

        <div
          className="mt-8 border border-zinc-800 bg-zinc-950/35 p-5"
          style={{ borderRadius: 8 }}
        >
          <p className="text-sm leading-6 text-zinc-400">
            For now, please contact{" "}
            <a
              href="mailto:admin@frdaph.org"
              className="text-blue-300 underline underline-offset-4 hover:text-blue-200"
            >
              admin@frdaph.org
            </a>{" "}
            for listing questions.
          </p>
        </div>
      </section>
    </main>
  );
}