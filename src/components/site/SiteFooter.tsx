import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#020817]">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 md:grid-cols-3 md:px-8">
        <div>
          <h3 className="text-lg font-semibold text-white">FRDA</h3>
          <p className="mt-3 max-w-sm text-sm leading-7 text-zinc-400">
            Supporting Filipino Roblox developers through community, standards,
            and opportunities for growth.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200/70">
            Pages
          </h4>
          <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-400">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/about" className="hover:text-white">
              About
            </Link>
            <Link href="/contact" className="hover:text-white">
              Contact
            </Link>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200/70">
            Registration
          </h4>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Apply to become a registered developer and, once approved, be added
            to the FRDA Discord community.
          </p>
          <Link
            href="/apply"
            className="mt-4 inline-flex rounded-[5px] bg-white/5 px-4 py-2 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/10"
          >
            Open registration
          </Link>
        </div>
      </div>

      <div className="border-t border-white/5 px-6 py-4 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} FRDA. All rights reserved.
      </div>
    </footer>
  );
}