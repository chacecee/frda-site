"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const inputClass =
  "w-full rounded-md px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checkingLink, setCheckingLink] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isValidResetMode = useMemo(() => mode === "resetPassword", [mode]);

  useEffect(() => {
    async function validateCode() {
      if (!oobCode || !isValidResetMode) {
        setErrorMsg("This password reset link is invalid or incomplete.");
        setCheckingLink(false);
        return;
      }

      try {
        const restoredEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(restoredEmail);
      } catch (error) {
        console.error("Invalid or expired reset code:", error);
        setErrorMsg("This password reset link is invalid or has expired.");
      } finally {
        setCheckingLink(false);
      }
    }

    validateCode();
  }, [oobCode, isValidResetMode]);

  useEffect(() => {
    if (!successMsg) return;

    const timer = setTimeout(() => {
      router.replace("/admin/login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [successMsg, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!oobCode) {
      setErrorMsg("This password reset link is missing its reset code.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("Your new password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg("Your passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccessMsg(
        "Your password has been reset successfully. Redirecting you to login..."
      );
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      console.error("Confirm password reset error:", error);
      setErrorMsg("This password reset link is invalid, expired, or already used.");
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
          <h1 className="text-3xl font-bold">Set a New Password</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Choose a new password for your FRDA admin account.
          </p>
        </div>

        <div
          className="rounded-xl p-6 backdrop-blur-xl"
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(10, 12, 18, 0.84)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.48), 0 0 0 1px rgba(59,130,246,0.05) inset",
          }}
        >
          {checkingLink ? (
            <p className="text-sm text-zinc-400">Checking your reset link...</p>
          ) : errorMsg && !email ? (
            <div className="space-y-4">
              <p className="text-sm text-red-400">{errorMsg}</p>
              <Link
                href="/admin/forgot-password"
                className="inline-block cursor-pointer rounded-md px-5 py-3 text-sm font-semibold text-white transition"
                style={{ background: "#3b82f6", boxShadow: "0 10px 30px rgba(59,130,246,0.18)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#60a5fa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#3b82f6";
                }}
              >
                Request a New Link
              </Link>
            </div>
          ) : successMsg ? (
            <div className="space-y-4">
              <p className="text-sm text-blue-400">{successMsg}</p>
              <Link
                href="/admin/login"
                className="inline-block cursor-pointer rounded-md px-5 py-3 text-sm font-semibold text-white transition"
                style={{ background: "#3b82f6", boxShadow: "0 10px 30px rgba(59,130,246,0.18)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#60a5fa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#3b82f6";
                }}
              >
                Go to Admin Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Account
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className={`${inputClass} opacity-70`}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#ffffff",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.02)",
                  }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputClass} pr-16`}
                    placeholder="Enter your new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className={`${inputClass} pr-16`}
                    placeholder="Re-enter your new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
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
                    onClick={() =>
                      setShowConfirmPassword((prev) => !prev)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {errorMsg ? <p className="text-sm text-red-400">{errorMsg}</p> : null}

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
                {isSubmitting ? "Updating Password..." : "Reset Password"}
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
          )}
        </div>
      </div>
    </main>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen text-white"
          style={{
            background: `
      radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.24) 0%, rgba(59, 130, 246, 0.14) 12%, rgba(59, 130, 246, 0.055) 22%, rgba(59, 130, 246, 0) 34%),
      radial-gradient(circle at 82% 10%, rgba(37, 99, 235, 0.09) 0%, rgba(37, 99, 235, 0.035) 12%, rgba(37, 99, 235, 0) 24%),
      radial-gradient(circle at 18% 10%, rgba(96, 165, 250, 0.07) 0%, rgba(96, 165, 250, 0.03) 10%, rgba(96, 165, 250, 0) 22%),
      linear-gradient(to bottom, #02040a 0%, #010309 32%, #000000 100%)
    `,
          }}
        >
          <div className="mx-auto max-w-md px-6 py-20">
            <p className="text-sm text-zinc-400">Loading reset page...</p>
          </div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}