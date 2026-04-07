"use client";

import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

const inputClass =
  "w-full rounded-md border border-zinc-600/80 bg-zinc-800/95 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-md px-6 py-20">
          <p className="text-sm text-zinc-400">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-md px-6 py-20">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <img
              src="/frda-logo.png"
              alt="FRDA logo"
              className="h-20 w-20 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold">Admin Login</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Sign in to access the FRDA applications dashboard.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5 rounded-xl border border-zinc-700/80 bg-zinc-900/75 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.22)]"
        >
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
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
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Password
            </label>
            <input
              type="password"
              className={inputClass}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg ? <p className="text-sm text-red-400">{errorMsg}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}