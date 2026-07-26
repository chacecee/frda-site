"use client";

export default function ApplyPage() {
  function openDeveloperSignup() {
    window.dispatchEvent(
      new CustomEvent("frda:open-account-modal", {
        detail: {
          tab: "signup",
          accountPurpose: "developer",
        },
      }),
    );
  }

  return (
    <main className="min-h-screen bg-[#02040a] px-6 py-24 text-white">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div
          className="w-full border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl sm:p-12"
          style={{ borderRadius: 10 }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
            FRDA Developer Directory
          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            Developer applications have moved
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            FRDA&apos;s old developer registration form is no longer active.
            Developers can now create an FRDA member account, build a public
            developer profile, and request publication in the FRDA Developer
            Directory.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openDeveloperSignup}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              style={{ borderRadius: 6 }}
            >
              Create an FRDA member account
            </button>

            <a
              href="/developers"
              className="inline-flex min-h-11 items-center justify-center border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
              style={{ borderRadius: 6 }}
            >
              View the Developer Directory
            </a>
          </div>

          <p className="mt-7 text-xs leading-5 text-zinc-500">
            Existing application records remain available to authorized FRDA
            staff for administrative review and recordkeeping.
          </p>
        </div>
      </section>
    </main>
  );
}