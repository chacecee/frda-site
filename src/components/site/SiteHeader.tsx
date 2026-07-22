"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Send,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

const SHOW_GAMES_IN_HEADER = true;
const SHOW_BLOG_IN_HEADER = true;
const SHOW_DEVELOPERS_IN_HEADER = true;

type AccountPurpose =
  | "developer"
  | "talent_seeker"
  | "both";

type AccountModalTab =
  | "signup"
  | "login";

type OpenAccountModalDetail = {
  tab?: AccountModalTab;
  accountPurpose?: AccountPurpose;
};

type HeaderMember = {
  displayName: string;
  email: string;
  accountPurpose:
    | "developer"
    | "talent_seeker"
    | "both";
  avatarUrl: string;
};


type JoinFormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountPurpose: AccountPurpose;
  companyWebsite: string;
};

const EMPTY_JOIN_FORM: JoinFormState = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  accountPurpose: "developer",
  companyWebsite: "",
};

function getMainSiteOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const hostname =
    window.location.hostname.toLowerCase();

  const port = window.location.port
    ? `:${window.location.port}`
    : "";

  if (hostname.endsWith(".localhost")) {
    return `http://localhost${port}`;
  }

  if (
    hostname.endsWith(".frdaph.org") &&
    hostname !== "www.frdaph.org"
  ) {
    return "https://frdaph.org";
  }

  return "";
}

function isDeveloperSubdomain(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname =
    window.location.hostname.toLowerCase();

  return (
    hostname.endsWith(".localhost") ||
    (
      hostname.endsWith(".frdaph.org") &&
      hostname !== "frdaph.org" &&
      hostname !== "www.frdaph.org"
    )
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    authLoading,
  } = useAuthUser();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [accountTab, setAccountTab] =
    useState<AccountModalTab>("signup");

  const [loginEmail, setLoginEmail] =
    useState("");
  const [loginPassword, setLoginPassword] =
    useState("");
  const [showLoginPassword, setShowLoginPassword] =
    useState(false);
  const [loggingIn, setLoggingIn] =
    useState(false);
  const [resettingPassword, setResettingPassword] =
    useState(false);
  const [loginError, setLoginError] =
    useState("");
  const [loginSuccess, setLoginSuccess] =
    useState("");

  const [joinForm, setJoinForm] =
    useState<JoinFormState>(EMPTY_JOIN_FORM);
  const [showJoinPassword, setShowJoinPassword] =
    useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");

  const [headerMember, setHeaderMember] =
    useState<HeaderMember | null>(null);

  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false);

  const [loadingHeaderMember, setLoadingHeaderMember] =
    useState(false);

  const [mainSiteOrigin, setMainSiteOrigin] =
    useState("");

  const [
    viewingDeveloperSubdomain,
    setViewingDeveloperSubdomain,
  ] = useState(false);

  const navItems = useMemo(() => {
    const items = [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ];

    if (SHOW_GAMES_IN_HEADER) {
      items.splice(1, 0, {
        href: "/games",
        label: "Games",
      });
    }

    if (SHOW_BLOG_IN_HEADER) {
      const newsPosition =
        SHOW_GAMES_IN_HEADER ? 2 : 1;

      items.splice(newsPosition, 0, {
        href: "/blog",
        label: "News",
      });
    }

    if (SHOW_DEVELOPERS_IN_HEADER) {
      const developerPosition =
        1 +
        (SHOW_GAMES_IN_HEADER ? 1 : 0) +
        (SHOW_BLOG_IN_HEADER ? 1 : 0);

      items.splice(developerPosition, 0, {
        href: "/developers",
        label: "Devs",
      });
    }

    return items;
  }, []);

  useEffect(() => {
    setMainSiteOrigin(getMainSiteOrigin());

    setViewingDeveloperSubdomain(
      isDeveloperSubdomain()
    );

    const url =
      new URL(window.location.href);

    const requestedAccountTab =
      url.searchParams.get("account");

    const requestedPurpose =
      url.searchParams.get("purpose");

    if (
      requestedAccountTab === "signup" ||
      requestedAccountTab === "login"
    ) {
      const accountPurpose:
        | AccountPurpose
        | undefined =
        requestedPurpose === "developer" ||
        requestedPurpose === "talent_seeker" ||
        requestedPurpose === "both"
          ? requestedPurpose
          : undefined;

      openAccountModal(
        requestedAccountTab,
        accountPurpose,
      );

      url.searchParams.delete("account");
      url.searchParams.delete("purpose");

      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
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
    if (
      authLoading ||
      !user ||
      !user.emailVerified
    ) {
      setHeaderMember(null);
      setAccountMenuOpen(false);
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadHeaderMember() {
      setLoadingHeaderMember(true);

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/member/me",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
          },
        );

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !result?.ok
        ) {
          return;
        }

        if (!cancelled) {
          setHeaderMember({
            displayName:
              String(
                result.member
                  .displayName ||
                currentUser.displayName ||
                "FRDA Member",
              ),
            email:
              String(
                result.member.email ||
                currentUser.email ||
                "",
              ),
            accountPurpose:
              result.member
                .accountPurpose,
            avatarUrl:
              String(
                result.member
                  .avatarUrl ||
                "",
              ),
          });
        }
      } catch (error) {
        console.error(
          "Load public header member error:",
          error,
        );
      } finally {
        if (!cancelled) {
          setLoadingHeaderMember(false);
        }
      }
    }

    loadHeaderMember();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    authLoading,
  ]);

  function getPublicHref(href: string): string {
    if (!mainSiteOrigin) {
      return href;
    }

    return `${mainSiteOrigin}${href}`;
  }

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);


function openAccountModal(
  tab: AccountModalTab = "signup",
  accountPurpose?: AccountPurpose,
) {
  setMobileOpen(false);
  setAccountTab(tab);

  if (accountPurpose) {
    setJoinForm((current) => ({
      ...current,
      accountPurpose,
    }));
  }

  setJoinError("");
  setJoinSuccess("");
  setLoginError("");
  setLoginSuccess("");
  setJoinOpen(true);
}

function closeJoinModal() {
  if (joining || loggingIn) return;

  setJoinOpen(false);
  setJoinError("");
  setJoinSuccess("");
  setLoginError("");
  setLoginSuccess("");
  setShowJoinPassword(false);
  setShowLoginPassword(false);
}

function switchAccountTab(
  tab: AccountModalTab
) {
  setAccountTab(tab);
  setJoinError("");
  setJoinSuccess("");
  setLoginError("");
  setLoginSuccess("");
}

async function submitLoginForm(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setLoggingIn(true);
  setLoginError("");
  setLoginSuccess("");

  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        loginEmail.trim(),
        loginPassword
      );

    await credential.user.reload();

    if (!credential.user.emailVerified) {
      await signOut(auth);

      setLoginError(
        "Verify your email address before signing in. Check the verification message sent by FRDA."
      );

      return;
    }

    setJoinOpen(false);
    router.push(
      getPublicHref(
        "/member/dashboard"
      )
    );
  } catch (error) {
    console.error(
      "Member login error:",
      error
    );

    setLoginError(
      "The email or password you entered is incorrect."
    );
  } finally {
    setLoggingIn(false);
  }
}

async function handleForgotPassword() {
  const normalizedEmail =
    loginEmail.trim();

  if (!normalizedEmail) {
    setLoginError(
      "Enter your email address first, then select Forgot password."
    );
    return;
  }

  setResettingPassword(true);
  setLoginError("");
  setLoginSuccess("");

  try {
    await sendPasswordResetEmail(
      auth,
      normalizedEmail
    );

    setLoginSuccess(
      "A password reset email has been sent if an account exists for that address."
    );
  } catch (error) {
    console.error(
      "Member password reset error:",
      error
    );

    setLoginError(
      "The password reset email could not be sent."
    );
  } finally {
    setResettingPassword(false);
  }
}

async function submitJoinForm(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setJoinError("");
  setJoinSuccess("");

  if (!joinForm.fullName.trim()) {
    setJoinError("Enter your full name.");
    return;
  }

  if (joinForm.password.length < 8) {
    setJoinError(
      "Your password must contain at least eight characters."
    );
    return;
  }

  if (joinForm.password !== joinForm.confirmPassword) {
    setJoinError("Your passwords do not match.");
    return;
  }

  setJoining(true);

  try {
    const response = await fetch(
      "/api/membership/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: joinForm.fullName.trim(),
          email: joinForm.email.trim(),
          password: joinForm.password,
          accountPurpose: joinForm.accountPurpose,
          companyWebsite: joinForm.companyWebsite,
        }),
      }
    );

    const result = await response
      .json()
      .catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.error ||
        "Could not create your FRDA membership account."
      );
    }

    setJoinSuccess(result.message);
    setJoinForm(EMPTY_JOIN_FORM);
  } catch (error) {
    setJoinError(
      error instanceof Error
        ? error.message
        : "Could not create your FRDA membership account."
    );
  } finally {
    setJoining(false);
  }
}

  useEffect(() => {
    function handleOpenAccountModal(
      event: Event,
    ) {
      const customEvent =
        event as CustomEvent<
          OpenAccountModalDetail
        >;

      openAccountModal(
        customEvent.detail?.tab ||
          "signup",
        customEvent.detail
          ?.accountPurpose,
      );
    }

    window.addEventListener(
      "frda:open-account-modal",
      handleOpenAccountModal,
    );

    return () => {
      window.removeEventListener(
        "frda:open-account-modal",
        handleOpenAccountModal,
      );
    };
  }, []);

  function getMemberInitials(
    value: string,
  ): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join("");
  }

  async function handlePublicLogout() {
    setAccountMenuOpen(false);
    setMobileOpen(false);
    await signOut(auth);
    setHeaderMember(null);
    router.push(
      getPublicHref("/")
    );
  }

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 w-full border-b border-white/10 bg-[#03153a]/68 backdrop-blur-lg transition-all duration-300 ${scrolled
          ? "shadow-[0_10px_30px_rgba(0,0,0,0.24)]"
          : "shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          }`}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 transition-all duration-300 md:px-8">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-[5px] text-white md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <Link
              href={getPublicHref("/")}
              className="flex min-w-0 items-center gap-3 md:gap-4"
            >
              <Image
                src="/frda-logo.png"
                alt="FRDA logo"
                width={56}
                height={56}
                className="h-12 w-12 shrink-0 object-contain md:h-14 md:w-14"
                priority
              />

              <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-white sm:text-[12px] md:text-[12px] md:tracking-[0.12em] lg:text-[13px] lg:tracking-[0.14em]">
                <span>Filipino Roblox Developers</span>
                <span className="block md:ml-1 md:inline">Association</span>
              </p>
            </Link>
          </div>

          <div className="ml-5 hidden shrink-0 items-center gap-5 md:flex">
            <nav className="flex items-center gap-6">
              {navItems.map((item) => {
                const active =
                  viewingDeveloperSubdomain
                    ? item.href === "/developers"
                    : (
                      pathname === item.href ||
                      (
                        item.href !== "/" &&
                        pathname.startsWith(
                          `${item.href}/`
                        )
                      )
                    );

                return (
                  <Link
                    key={item.href}
                    href={getPublicHref(item.href)}
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

            {user?.emailVerified ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setAccountMenuOpen(
                      (current) => !current
                    )
                  }
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[7px] border border-white/10 bg-white/[0.045] px-2.5 py-1.5 text-sm text-white transition hover:border-sky-300/25 hover:bg-white/[0.075]"
                  aria-expanded={accountMenuOpen}
                >
                  {headerMember?.avatarUrl ? (
                    <img
                      src={headerMember.avatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-[11px] font-semibold text-sky-200">
                      {getMemberInitials(
                        headerMember?.displayName ||
                        user.displayName ||
                        user.email ||
                        "FRDA Member",
                      ) || "FM"}
                    </div>
                  )}

                  <span className="hidden max-w-[120px] truncate lg:block">
                    {headerMember?.displayName ||
                      user.displayName ||
                      "My Account"}
                  </span>

                  <ChevronDown
                    className={`h-4 w-4 text-zinc-400 transition ${
                      accountMenuOpen
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {accountMenuOpen ? (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        y: 6,
                        scale: 0.985,
                      }}
                      transition={{
                        duration: 0.18,
                      }}
                      className="absolute right-0 top-[calc(100%+10px)] w-60 overflow-hidden border border-sky-300/15 bg-[#081426]/98 shadow-[0_18px_46px_rgba(0,0,0,0.42),0_0_26px_rgba(56,189,248,0.10)] backdrop-blur-xl"
                      style={{
                        borderRadius: 9,
                      }}
                    >
                      <div className="border-b border-white/10 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-white">
                          {headerMember?.displayName ||
                            user.displayName ||
                            "FRDA Member"}
                        </p>

                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {headerMember?.email ||
                            user.email}
                        </p>
                      </div>

                      <div className="p-2">
                        <Link
                          href={getPublicHref(
                            "/member/dashboard"
                          )}
                          onClick={() =>
                            setAccountMenuOpen(false)
                          }
                          className="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <LayoutDashboard className="h-4 w-4 text-sky-300" />
                          My Dashboard
                        </Link>

                        {headerMember?.accountPurpose ===
                          "talent_seeker" ||
                        headerMember?.accountPurpose ===
                          "both" ? (
                          <Link
                            href={getPublicHref(
                              "/member/sent-requests"
                            )}
                            onClick={() =>
                              setAccountMenuOpen(false)
                            }
                            className="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            <Send className="h-4 w-4 text-sky-300" />
                            Sent Requests
                          </Link>
                        ) : null}

                        <button
                          type="button"
                          onClick={handlePublicLogout}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-[6px] px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:bg-red-500/10 hover:text-red-200"
                        >
                          <LogOut className="h-4 w-4" />
                          Log Out
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openAccountModal("signup")
                }
                className="inline-flex cursor-pointer items-center gap-2 rounded-[5px] border border-blue-400/30 bg-blue-500 px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] text-white shadow-[0_0_20px_rgba(37,99,235,0.18)] transition hover:bg-blue-400"
              >
                {loadingHeaderMember ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
                Account
              </button>
            )}
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
                  const active =
                    viewingDeveloperSubdomain
                      ? item.href === "/developers"
                      : (
                        pathname === item.href ||
                        (
                          item.href !== "/" &&
                          pathname.startsWith(
                            `${item.href}/`
                          )
                        )
                      );

                  return (
                    <Link
                      key={item.href}
                      href={getPublicHref(item.href)}
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

                {user?.emailVerified ? (
                  <div className="mt-3 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-3 px-3 pb-3">
                      {headerMember?.avatarUrl ? (
                        <img
                          src={headerMember.avatarUrl}
                          alt=""
                          className="h-11 w-11 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">
                          {getMemberInitials(
                            headerMember?.displayName ||
                            user.displayName ||
                            user.email ||
                            "FRDA Member",
                          ) || "FM"}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {headerMember?.displayName ||
                            user.displayName ||
                            "FRDA Member"}
                        </p>

                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {headerMember?.email ||
                            user.email}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={getPublicHref(
                        "/member/dashboard"
                      )}
                      onClick={() =>
                        setMobileOpen(false)
                      }
                      className="flex items-center gap-3 rounded-[5px] px-3 py-3 text-sm text-zinc-200 transition hover:bg-white/5"
                    >
                      <LayoutDashboard className="h-4 w-4 text-sky-300" />
                      My Dashboard
                    </Link>

                    {(headerMember?.accountPurpose ===
                      "talent_seeker" ||
                      headerMember?.accountPurpose ===
                      "both") ? (
                      <Link
                        href={getPublicHref(
                          "/member/sent-requests"
                        )}
                        onClick={() =>
                          setMobileOpen(false)
                        }
                        className="flex items-center gap-3 rounded-[5px] px-3 py-3 text-sm text-zinc-200 transition hover:bg-white/5"
                      >
                        <Send className="h-4 w-4 text-sky-300" />
                        Sent Requests
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      onClick={handlePublicLogout}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 py-3 text-left text-sm text-zinc-400 transition hover:bg-red-500/10 hover:text-red-200"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      openAccountModal("signup")
                    }
                    className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-[5px] border border-blue-400/30 bg-blue-500 px-3 py-3 text-left text-[13px] font-medium uppercase tracking-[0.08em] text-white"
                  >
                    <UserRound className="h-4 w-4" />
                    Account
                  </button>
                )}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {joinOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeJoinModal}
            />

            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeJoinModal();
                }
              }}
            >
              <div
                className="my-auto w-full max-w-xl border border-sky-300/20 bg-[#081328]/95 shadow-[0_0_0_1px_rgba(56,189,248,0.08),0_0_36px_rgba(37,99,235,0.24),0_0_80px_rgba(14,165,233,0.12),0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                style={{ borderRadius: 10 }}
              >
                <div className="flex items-start justify-between gap-4 px-6 pt-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400/10 text-sky-300">
                      <UsersRound className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold text-white">
                        FRDA Member Account
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Our membership is open to Roblox game developers and people looking to work with them.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeJoinModal}
                    disabled={joining || loggingIn}
                    className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 border-b border-white/10 px-6">
                  <button
                    type="button"
                    onClick={() =>
                      switchAccountTab("signup")
                    }
                    className={`relative cursor-pointer px-4 py-3 text-sm font-semibold transition ${
                      accountTab === "signup"
                        ? "text-sky-300"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    Sign Up

                    {accountTab === "signup" ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-300" />
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      switchAccountTab("login")
                    }
                    className={`relative cursor-pointer px-4 py-3 text-sm font-semibold transition ${
                      accountTab === "login"
                        ? "text-sky-300"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    Log In

                    {accountTab === "login" ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-300" />
                    ) : null}
                  </button>
                </div>

                {accountTab === "signup" && joinSuccess ? (
                  <div className="p-6">
                    <div
                      className="border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm leading-7 text-emerald-100"
                      style={{ borderRadius: 8 }}
                    >
                      <h3 className="text-lg font-semibold text-white">
                        Check your email
                      </h3>

                      <p className="mt-2">{joinSuccess}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        switchAccountTab("login")
                      }
                      className="mt-5 inline-flex bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                      style={{ borderRadius: 5 }}
                    >
                      Continue to Log In
                    </button>
                  </div>
                ) : accountTab === "signup" ? (
                  <form onSubmit={submitJoinForm} className="p-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Full Name
                        </label>

                        <input
                          type="text"
                          value={joinForm.fullName}
                          onChange={(event) =>
                            setJoinForm((current) => ({
                              ...current,
                              fullName: event.target.value,
                            }))
                          }
                          maxLength={120}
                          className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                          style={{ borderRadius: 5 }}
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Email Address
                        </label>

                        <input
                          type="email"
                          value={joinForm.email}
                          onChange={(event) =>
                            setJoinForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                          style={{ borderRadius: 5 }}
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Password
                        </label>

                        <div className="relative">
                          <input
                            type={showJoinPassword ? "text" : "password"}
                            value={joinForm.password}
                            onChange={(event) =>
                              setJoinForm((current) => ({
                                ...current,
                                password: event.target.value,
                              }))
                            }
                            minLength={8}
                            className="w-full border border-white/10 bg-black/20 px-4 py-3 pr-16 text-sm text-white outline-none focus:border-blue-400"
                            style={{ borderRadius: 5 }}
                            required
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowJoinPassword((current) => !current)
                            }
                            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center text-zinc-400 hover:text-white"
                            aria-label={
                              showJoinPassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {showJoinPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Confirm Password
                        </label>

                        <div className="relative">
                          <input
                            type={showJoinPassword ? "text" : "password"}
                            value={joinForm.confirmPassword}
                            onChange={(event) =>
                              setJoinForm((current) => ({
                                ...current,
                                confirmPassword: event.target.value,
                              }))
                            }
                            minLength={8}
                            className="w-full border border-white/10 bg-black/20 px-4 py-3 pr-12 text-sm text-white outline-none focus:border-blue-400"
                            style={{ borderRadius: 5 }}
                            required
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowJoinPassword((current) => !current)
                            }
                            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center text-zinc-400 hover:text-white"
                            aria-label={
                              showJoinPassword
                                ? "Hide confirmed password"
                                : "Show confirmed password"
                            }
                          >
                            {showJoinPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="hidden" aria-hidden="true">
                        <label>
                          Company Website
                          <input
                            type="text"
                            value={joinForm.companyWebsite}
                            onChange={(event) =>
                              setJoinForm((current) => ({
                                ...current,
                                companyWebsite: event.target.value,
                              }))
                            }
                            tabIndex={-1}
                            autoComplete="off"
                          />
                        </label>
                      </div>
                    </div>

                    <fieldset className="mt-6">
                      <legend className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        How will you use FRDA?
                      </legend>

                      <div className="mt-3 grid gap-3">
                        {[
                          ["developer", "I’m a developer"],
                          ["talent_seeker", "I’m looking for talent"],
                          ["both", "I’m both"],
                        ].map(([value, label]) => (
                          <label
                            key={value}
                            className="flex cursor-pointer items-center gap-3 border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-200"
                            style={{ borderRadius: 6 }}
                          >
                            <input
                              type="radio"
                              name="accountPurpose"
                              value={value}
                              checked={joinForm.accountPurpose === value}
                              onChange={() =>
                                setJoinForm((current) => ({
                                  ...current,
                                  accountPurpose: value as AccountPurpose,
                                }))
                              }
                            />

                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {joinError ? (
                      <div
                        className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                        style={{ borderRadius: 8 }}
                      >
                        {joinError}
                      </div>
                    ) : null}

                    <p className="mt-5 text-xs leading-5 text-zinc-500">
                      By creating an account, you agree to use FRDA responsibly
                      and not to spam, mislead, or harass members.
                    </p>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={closeJoinModal}
                        disabled={joining}
                        className="cursor-pointer border border-white/15 bg-transparent px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                        style={{ borderRadius: 5 }}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={joining}
                        className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ borderRadius: 5 }}
                      >
                        {joining ? (
                          <span className="inline-flex items-center gap-2">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Creating Account...
                          </span>
                        ) : (
                          "Create Account"
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={submitLoginForm}
                    className="p-6"
                  >
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Email Address
                      </label>

                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(event) =>
                          setLoginEmail(
                            event.target.value
                          )
                        }
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
                        style={{
                          borderRadius: 5,
                        }}
                        placeholder="member@example.com"
                        required
                      />
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Password
                        </label>

                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={resettingPassword}
                          className="cursor-pointer text-xs font-medium text-sky-300 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resettingPassword
                            ? "Sending..."
                            : "Forgot password?"}
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type={
                            showLoginPassword
                              ? "text"
                              : "password"
                          }
                          value={loginPassword}
                          onChange={(event) =>
                            setLoginPassword(
                              event.target.value
                            )
                          }
                          className="w-full border border-white/10 bg-black/20 px-4 py-3 pr-16 text-sm text-white outline-none focus:border-sky-400"
                          style={{
                            borderRadius: 5,
                          }}
                          required
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowLoginPassword(
                              (current) =>
                                !current
                            )
                          }
                          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center text-zinc-400 hover:text-white"
                          aria-label={
                            showLoginPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {loginError ? (
                      <div
                        className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                        style={{
                          borderRadius: 8,
                        }}
                      >
                        {loginError}
                      </div>
                    ) : null}

                    {loginSuccess ? (
                      <div
                        className="mt-5 border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200"
                        style={{
                          borderRadius: 8,
                        }}
                      >
                        {loginSuccess}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={loggingIn}
                      className="mt-7 w-full cursor-pointer bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        borderRadius: 5,
                      }}
                    >
                      {loggingIn ? (
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Signing In...
                        </span>
                      ) : (
                        "Log In"
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}