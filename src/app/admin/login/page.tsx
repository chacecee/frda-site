"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

const inputClass =
  "w-full rounded-md px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500";

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
      <main className="min-h-screen bg-[#02040a] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <p className="text-sm text-zinc-500">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{
        background: `
      radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.24) 0%, rgba(59, 130, 246, 0.14) 12%, rgba(59, 130, 246, 0.055) 22%, rgba(59, 130, 246, 0) 34%),
      radial-gradient(circle at 82% 10%, rgba(37, 99, 235, 0.09) 0%, rgba(37, 99, 235, 0.035) 12%, rgba(37, 99, 235, 0) 24%),
      radial-gradient(circle at 18% 10%, rgba(96, 165, 250, 0.07) 0%, rgba(96, 165, 250, 0.03) 10%, rgba(96, 165, 250, 0) 22%),
      linear-gradient(to bottom, #02040a 0%, #010309 32%, #000000 100%)
    `,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div
        className="absolute left-1/2 top-0 h-[18rem] w-[38rem] -translate-x-1/2 blur-3xl"
        style={{ background: "rgba(59, 130, 246, 0.16)" }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-16">
        <section className="w-full max-w-md">
          <div
            className="rounded-xl p-7 backdrop-blur-xl sm:p-8"
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(10, 12, 18, 0.84)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.48), 0 0 0 1px rgba(59,130,246,0.05) inset",
            }}
          >
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
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#ffffff",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.02)",
                  }}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Password
                  </label>

                  <Link
                    href="/admin/forgot-password"
                    className="text-xs font-medium transition"
                    style={{ color: "#60a5fa" }}
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
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#ffffff",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.02)",
                    }}
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
                className="w-full cursor-pointer rounded-md px-5 py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  background: "#3b82f6",
                  boxShadow: "0 10px 30px rgba(59, 130, 246, 0.18)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#60a5fa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#3b82f6";
                }}
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