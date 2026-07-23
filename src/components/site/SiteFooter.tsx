"use client";

import PublicSiteLink from "@/components/site/PublicSiteLink";

export default function SiteFooter() {
  function openRegistration() {
    window.dispatchEvent(
      new CustomEvent(
        "frda:open-account-modal",
        {
          detail: {
            tab: "signup",
            accountPurpose: "developer",
          },
        },
      ),
    );
  }

  return (
    <footer className="border-t border-white/10 bg-[#020817]">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 md:grid-cols-3 md:px-8">
        <div>
          <h3 className="text-lg font-semibold text-white">
            FRDA
          </h3>

          <p className="mt-3 max-w-sm text-sm leading-7 text-zinc-400">
            Supporting Filipino Roblox developers through community,
            visibility, standards, and opportunities for growth.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200/70">
            Pages
          </h4>

          <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-400">
            <PublicSiteLink
              href="/"
              className="hover:text-white"
            >
              Home
            </PublicSiteLink>

            <PublicSiteLink
              href="/about"
              className="hover:text-white"
            >
              About
            </PublicSiteLink>

            <PublicSiteLink
              href="/games"
              className="hover:text-white"
            >
              Games
            </PublicSiteLink>

            <PublicSiteLink
              href="/developers"
              className="hover:text-white"
            >
              Developers
            </PublicSiteLink>

            <PublicSiteLink
              href="/contact"
              className="hover:text-white"
            >
              Contact
            </PublicSiteLink>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200/70">
            Developer Membership
          </h4>

          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Create a free FRDA account to list your games, build a
            public developer profile, connect with the community, and
            access developer opportunities.
          </p>

          <button
            type="button"
            onClick={openRegistration}
            className="mt-4 inline-flex cursor-pointer rounded-[5px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Create a Free Account
          </button>
        </div>
      </div>

      <div className="border-t border-white/5 px-6 py-4 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} FRDA. All rights reserved.
      </div>
    </footer>
  );
}