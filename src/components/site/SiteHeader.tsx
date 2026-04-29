"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const SHOW_GAMES_IN_HEADER = true;
const SHOW_BLOG_IN_HEADER = true;

export default function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(() => {
    const items = [
      { href: "/", label: "Home" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ];

    if (SHOW_GAMES_IN_HEADER) {
      items.splice(2, 0, { href: "/games", label: "Games" });
    }

    if (SHOW_BLOG_IN_HEADER) {
      items.splice(SHOW_GAMES_IN_HEADER ? 3 : 2, 0, {
        href: "/blog",
        label: "News",
      });
    }

    return items;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 w-full transition-all duration-300 ${scrolled
            ? "bg-[#03153a]/68 backdrop-blur-lg shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
            : "bg-transparent"
          }`}
      >
        <div
          className={`mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 transition-all duration-300 md:px-8 ${scrolled ? "border-b border-white/10" : "border-b border-transparent"
            }`}
        >
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-[5px] text-white md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <Link href="/" className="flex min-w-0 items-center gap-3 md:gap-4">
              <Image
                src="/frda-logo.png"
                alt="FRDA logo"
                width={56}
                height={56}
                className="h-12 w-12 shrink-0 object-contain md:h-14 md:w-14"
                priority
              />

              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-white sm:text-[12px] md:text-[13px] md:tracking-[0.14em]">
                <span>Filipino Roblox Developers</span>
                <span className="block md:inline md:ml-1">Association</span>
              </p>
            </Link>
          </div>

          <div className="ml-8 hidden items-center gap-5 md:flex">
            <nav className="flex items-center gap-6">
              {navItems.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative px-1 py-2 text-[13px] uppercase tracking-[0.14em] text-zinc-100 transition hover:text-white"
                  >
                    <span className={active ? "text-white" : "text-zinc-200"}>
                      {item.label}
                    </span>

                    {active ? (
                      <motion.span
                        layoutId="site-nav-underline"
                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-cyan-400"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 38,
                        }}
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/apply"
              className="rounded-[5px] border border-blue-400/30 bg-blue-500 px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] text-white shadow-[0_0_20px_rgba(37,99,235,0.18)] transition hover:bg-blue-400"
            >
              Register as a Developer
            </Link>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.aside
              className="fixed left-0 top-0 z-[70] h-full w-[82vw] max-w-[320px] border-r border-white/10 bg-[#08111f] p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)] md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Image
                    src="/frda-logo.png"
                    alt="FRDA logo"
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 object-contain"
                  />
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                    FRDA
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-[5px] text-white"
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <nav className="flex flex-col gap-3">
                {navItems.map((item) => {
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-[5px] px-3 py-3 text-[13px] uppercase tracking-[0.14em] transition ${active
                          ? "bg-white/5 text-white"
                          : "text-zinc-300 hover:bg-white/5 hover:text-white"
                        }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                <Link
                  href="/apply"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 rounded-[5px] border border-blue-400/30 bg-blue-500 px-3 py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-white"
                >
                  Register as a Developer
                </Link>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}