"use client";

import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-md px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500";

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
      <div className="relative z-10 mx-auto max-w-md px-6 py-20">
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
          className="space-y-5 rounded-xl p-6 backdrop-blur-xl"
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(10, 12, 18, 0.84)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.48), 0 0 0 1px rgba(59,130,246,0.05) inset",
          }}
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
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                color: "#ffffff",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.02)",
              }}
            />
          </div>

          {errorMsg ? <p className="text-sm text-red-400">{errorMsg}</p> : null}

          {successMsg ? (
            <p className="text-sm text-blue-400">{successMsg}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer rounded-md px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              background: "#3b82f6",
              boxShadow: "0 10px 30px rgba(59,130,246,0.18)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#60a5fa";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#3b82f6";
            }}
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>

          <div className="text-center">
            <Link
              href="/admin/login"
              className="text-sm transition hover:text-blue-300"
              style={{ color: "#60a5fa" }}
            >
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}