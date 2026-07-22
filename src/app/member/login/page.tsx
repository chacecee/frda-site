"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

export default function MemberLoginPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    if (!authLoading && user?.emailVerified) {
      router.replace("/member/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const parameters =
      new URLSearchParams(window.location.search);

    if (parameters.get("verified") === "1") {
      setSuccessMessage(
        "Your email has been verified. You can now sign in.",
      );
    }
  }, []);

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

      await credential.user.reload();

      if (!credential.user.emailVerified) {
        await signOut(auth);

        setErrorMessage(
          "Verify your email address before signing in. Check the verification message sent by FRDA.",
        );

        return;
      }

      router.replace("/member/dashboard");
    } catch (error) {
      console.error("Member login error:", error);

      setErrorMessage(
        "The email or password you entered is incorrect.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage(
        "Enter your email address first, then select Forgot password.",
      );
      return;
    }

    setResettingPassword(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await sendPasswordResetEmail(
        auth,
        normalizedEmail,
      );

      setSuccessMessage(
        "A password reset email has been sent if an account exists for that address.",
      );
    } catch (error) {
      console.error(
        "Member password reset error:",
        error,
      );

      setErrorMessage(
        "The password reset email could not be sent.",
      );
    } finally {
      setResettingPassword(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#061533] px-5 py-12 text-white">
        <p className="text-center text-sm text-zinc-400">
          Checking your account...
        </p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061533] px-5 py-12 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_34%)]" />
        <div className="absolute left-[-120px] top-24 h-[340px] w-[340px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-100px] top-20 h-[340px] w-[340px] rounded-full bg-fuchsia-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-md">
        <div className="mb-8 text-center">
          <img
            src="/frda-logo.png"
            alt="FRDA logo"
            className="mx-auto h-20 w-20 object-contain"
          />

          <h1 className="mt-5 text-3xl font-semibold">
            Member Login
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Access your FRDA membership account.
          </p>
        </div>

        <section
          className="border border-white/10 bg-[#081328]/90 p-6 shadow-2xl backdrop-blur md:p-8"
          style={{ borderRadius: 8 }}
        >
          <form onSubmit={handleLogin}>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                style={{ borderRadius: 5 }}
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
                  className="cursor-pointer text-xs font-medium text-blue-300 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resettingPassword
                    ? "Sending..."
                    : "Forgot password?"}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 pr-16 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                  style={{ borderRadius: 5 }}
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current,
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-xs text-zinc-400 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div
                className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                style={{ borderRadius: 8 }}
              >
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div
                className="mt-5 border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200"
                style={{ borderRadius: 8 }}
              >
                {successMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-7 w-full cursor-pointer bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderRadius: 5 }}
            >
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}