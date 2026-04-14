export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 0%, rgba(59,130,246,0.38) 0%, rgba(59,130,246,0.20) 18%, rgba(59,130,246,0.08) 34%, rgba(59,130,246,0) 58%),
              radial-gradient(circle at 85% 8%, rgba(37,99,235,0.22) 0%, rgba(37,99,235,0.10) 18%, rgba(37,99,235,0) 42%),
              radial-gradient(circle at 15% 10%, rgba(96,165,250,0.20) 0%, rgba(96,165,250,0.08) 16%, rgba(96,165,250,0) 40%)
            `,
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-[5px] border border-zinc-700/80 bg-zinc-900/75 p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:p-10">
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