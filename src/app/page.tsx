export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.24),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.12),_transparent_20%),radial-gradient(circle_at_top_left,_rgba(6,182,212,0.08),_transparent_18%),linear-gradient(to_bottom,_#0b100d,_#09090b_34%,_#09090b)] text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-2xl border border-zinc-700/80 bg-zinc-900/75 p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:p-10">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur-sm">
              <img
                src="/frda-logo.png"
                alt="FRDA logo"
                className="h-24 w-24 object-contain"
              />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Our site is under construction
          </h1>

          <p className="mt-4 text-sm leading-7 text-zinc-300 sm:text-base">
            We’re working on a better Registration System.
          </p>

          <p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base">
            It goes live on April 20, 2026. Stay tuned!
          </p>
        </div>
      </div>
    </main>
  );
}