"use client";

import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-md border border-zinc-600/80 bg-zinc-800/95 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetch("/api/auth/admin-forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to send reset email.");
      }

      setSuccessMsg(
        "If that email exists in the system, a password reset link has been sent."
      );
      setEmail("");
    } catch (error) {
      console.error("Password reset error:", error);
      setErrorMsg("Could not process your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
          <h1 className="text-3xl font-bold">Reset Password</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Enter your admin email and we’ll send you a reset link.
          </p>
        </div>

        <form
          onSubmit={handleReset}
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

          {errorMsg ? <p className="text-sm text-red-400">{errorMsg}</p> : null}

          {successMsg ? (
            <p className="text-sm text-emerald-400">{successMsg}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>

          <div className="text-center">
            <Link
              href="/admin/login"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}