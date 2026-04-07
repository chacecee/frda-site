"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

const inputClass =
  "w-full rounded-md border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none placeholder:text-zinc-500 transition focus:border-emerald-400/70 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/admin");
    }
  }, [authLoading, user, router]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/admin");
    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg("Invalid email or password.");
      setIsSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#05070b] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <p className="text-sm text-zinc-400">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#04060a,#05070b_46%,#04060a)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(16,185,129,0.22),transparent_26%),radial-gradient(circle_at_50%_12%,rgba(16,185,129,0.10),transparent_34%)]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="absolute left-1/2 top-0 h-[18rem] w-[38rem] -translate-x-1/2 bg-emerald-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-16">
        <section className="w-full max-w-md">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:p-8">
            <div className="mb-8 text-center">
              <div className="mb-5 flex justify-center">
                <img
                  src="/frda-logo.png"
                  alt="FRDA logo"
                  className="h-20 w-20 object-contain"
                />
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Admin Login
              </h1>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Sign in to access the FRDA applications dashboard.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Email
                </label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="Enter your admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Password
                  </label>

                  <Link
                    href="/admin/forgot-password"
                    className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputClass} pr-16`}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {errorMsg ? (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMsg}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-[#05261b] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5 text-center">
              <p className="text-xs leading-6 text-zinc-500">
                Authorized FRDA staff only
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}