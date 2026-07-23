"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
} from "lucide-react";

import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

type LoginView =
  | "login"
  | "forgot_password"
  | "reset_sent";

export default function MemberLoginPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [view, setView] =
    useState<LoginView>("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    if (
      !authLoading &&
      user?.emailVerified
    ) {
      router.replace(
        "/member/dashboard",
      );
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        window.location.search,
      );

    if (
      parameters.get(
        "verified",
      ) === "1"
    ) {
      setSuccessMessage(
        "Your email has been verified. You can now sign in.",
      );
    }
  }, []);

  function openForgotPassword() {
    setView(
      "forgot_password",
    );

    setErrorMessage("");
    setSuccessMessage("");
    setPassword("");
  }

  function returnToLogin() {
    setView("login");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleLogin(
    event:
      React.FormEvent<HTMLFormElement>,
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

      if (
        !credential.user.emailVerified
      ) {
        await signOut(auth);

        setErrorMessage(
          "Verify your email address before signing in. Check the verification message sent by FRDA.",
        );

        return;
      }

      router.replace(
        "/member/dashboard",
      );
    } catch (error) {
      console.error(
        "Member login error:",
        error,
      );

      setErrorMessage(
        "The email or password you entered is incorrect.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedEmail =
      email.trim();

    if (!normalizedEmail) {
      setErrorMessage(
        "Enter the email address connected to your FRDA account.",
      );
      return;
    }

    setResettingPassword(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          "/api/membership/password-reset",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email:
                normalizedEmail,
            }),
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
        throw new Error(
          result?.error ||
          "The password reset email could not be sent.",
        );
      }

      setView("reset_sent");
    } catch (error) {
      console.error(
        "Member password reset error:",
        error,
      );

      setErrorMessage(
        "The password reset email could not be sent. Please try again.",
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
            {view === "login"
              ? "Member Login"
              : view ===
                  "forgot_password"
                ? "Reset Your Password"
                : "Check Your Email"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {view === "login"
              ? "Access your FRDA membership account."
              : view ===
                  "forgot_password"
                ? "Enter the email address connected to your FRDA account."
                : "We sent password-reset instructions if an account exists for that address."}
          </p>
        </div>

        <section
          className="border border-white/10 bg-[#081328]/90 p-6 shadow-2xl backdrop-blur md:p-8"
          style={{ borderRadius: 8 }}
        >
          {view !== "login" ? (
            <button
              type="button"
              onClick={returnToLogin}
              className="mb-6 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Log In
            </button>
          ) : null}

          {view === "login" ? (
            <form
              onSubmit={handleLogin}
            >
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                  style={{
                    borderRadius: 5,
                  }}
                  placeholder="member@example.com"
                  autoComplete="email"
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
                    onClick={
                      openForgotPassword
                    }
                    className="cursor-pointer text-xs font-medium text-blue-300 hover:text-blue-200"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    className="w-full border border-white/10 bg-black/20 px-4 py-3 pr-12 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                    style={{
                      borderRadius: 5,
                    }}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current,
                      )
                    }
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center text-zinc-400 hover:text-white"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <div
                  className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div
                  className="mt-5 border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  {successMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-7 w-full cursor-pointer bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  borderRadius: 5,
                }}
              >
                {submitting
                  ? "Signing In..."
                  : "Sign In"}
              </button>
            </form>
          ) : view ===
            "forgot_password" ? (
            <form
              onSubmit={
                handleForgotPassword
              }
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-sky-400/10 text-sky-300">
                <Mail className="h-5 w-5" />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
                  style={{
                    borderRadius: 5,
                  }}
                  placeholder="member@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              {errorMessage ? (
                <div
                  className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                  style={{
                    borderRadius: 8,
                  }}
                >
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  resettingPassword
                }
                className="mt-7 w-full cursor-pointer bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  borderRadius: 5,
                }}
              >
                {resettingPassword ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>
          ) : (
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <p className="mt-5 text-sm leading-7 text-zinc-300">
                If an FRDA account exists for{" "}
                <span className="font-semibold text-white">
                  {email.trim()}
                </span>
                , a password-reset email has been sent.
              </p>

              <p className="mt-3 text-xs leading-5 text-zinc-500">
                Check your inbox and spam folder. The reset link may take a few minutes to arrive.
              </p>

              <button
                type="button"
                onClick={returnToLogin}
                className="mt-7 w-full cursor-pointer bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-500"
                style={{
                  borderRadius: 5,
                }}
              >
                Back to Log In
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}