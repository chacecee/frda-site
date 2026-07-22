"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AccountPurpose =
  | "developer"
  | "talent_seeker"
  | "both";

type PublicInvitation = {
  inviteId: string;
  email: string;
  displayName: string;
  accountPurpose: AccountPurpose;
  memberId: string;
  expiresAt: string;
};

type ActivationResult = {
  account: {
    uid: string;
    email: string;
    displayName: string;
    memberId: string;
    accountPurpose: AccountPurpose;
  };
  discordInvite: {
    code: string;
    inviteUrl: string;
    expiresAt: string;
  } | null;
  discordInviteError: string;
};

function getPurposeLabel(
  value: AccountPurpose
): string {
  switch (value) {
    case "developer":
      return "Developer";
    case "talent_seeker":
      return "Talent Seeker";
    case "both":
      return "Developer and Talent Seeker";
    default:
      return value;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(date);
}

export default function MemberRegistrationPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [invitation, setInvitation] =
    useState<PublicInvitation | null>(null);

  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] =
    useState("");

  const [displayName, setDisplayName] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [formError, setFormError] =
    useState("");

  const [activationResult, setActivationResult] =
    useState<ActivationResult | null>(null);

  useEffect(() => {
    if (!token) {
      setValidationError(
        "This membership invitation link is incomplete."
      );
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function validateInvitation() {
      setLoading(true);
      setValidationError("");

      try {
        const response = await fetch(
          `/api/membership/invitations/validate?token=${encodeURIComponent(
            token
          )}`,
          {
            cache: "no-store",
          }
        );

        const result = await response
          .json()
          .catch(() => null);

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error ||
            "Could not validate this membership invitation."
          );
        }

        if (!cancelled) {
          setInvitation(result.invitation);
          setDisplayName(
            result.invitation.displayName || ""
          );
        }
      } catch (error) {
        if (!cancelled) {
          setValidationError(
            error instanceof Error
              ? error.message
              : "Could not validate this membership invitation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    validateInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function activateAccount(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setFormError("");

    if (!displayName.trim()) {
      setFormError(
        "Please enter the name you want displayed on FRDA."
      );
      return;
    }

    if (password.length < 8) {
      setFormError(
        "Your password must contain at least eight characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setFormError(
        "Your passwords do not match."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/membership/activate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
            displayName: displayName.trim(),
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
          "Could not activate your FRDA membership account."
        );
      }

      try {
        await signInWithEmailAndPassword(
          auth,
          result.account.email,
          password
        );
      } catch (signInError) {
        console.error(
          "Automatic member sign-in error:",
          signInError
        );
      }

      setActivationResult({
        account: result.account,
        discordInvite:
          result.discordInvite || null,
        discordInviteError:
          result.discordInviteError || "",
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not activate your FRDA membership account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061533] px-5 py-12 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_34%)]" />
        <div className="absolute left-[-120px] top-24 h-[340px] w-[340px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-100px] top-20 h-[340px] w-[340px] rounded-full bg-fuchsia-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <img
            src="/frda-logo.png"
            alt="FRDA logo"
            className="mx-auto h-20 w-20 object-contain"
          />

          <h1 className="mt-5 text-3xl font-semibold">
            FRDA Membership
          </h1>
        </div>

        <section
          className="border border-white/10 bg-[#081328]/90 p-6 shadow-2xl backdrop-blur md:p-8"
          style={{ borderRadius: 8 }}
        >
          {loading ? (
            <p className="text-center text-sm text-zinc-400">
              Checking your membership invitation...
            </p>
          ) : validationError ? (
            <div>
              <h2 className="text-xl font-semibold text-white">
                Invitation unavailable
              </h2>

              <p className="mt-3 text-sm leading-6 text-red-200">
                {validationError}
              </p>

              <p className="mt-5 text-sm leading-6 text-zinc-400">
                Please contact FRDA if you need a new membership invitation.
              </p>
            </div>
          ) : activationResult ? (
            <div>
              <div
                className="border border-emerald-500/30 bg-emerald-500/10 p-4"
                style={{ borderRadius: 8 }}
              >
                <h2 className="text-xl font-semibold text-emerald-100">
                  Your account is active
                </h2>

                <p className="mt-2 text-sm leading-6 text-emerald-200">
                  Welcome to the FRDA Dev Network,{" "}
                  {activationResult.account.displayName}.
                </p>
              </div>

              <div className="mt-6 space-y-3 text-sm text-zinc-300">
                <p>
                  <span className="text-zinc-500">
                    Email —
                  </span>{" "}
                  {activationResult.account.email}
                </p>

                <p>
                  <span className="text-zinc-500">
                    Member ID —
                  </span>{" "}
                  {activationResult.account.memberId}
                </p>

                <p>
                  <span className="text-zinc-500">
                    Account type —
                  </span>{" "}
                  {getPurposeLabel(
                    activationResult.account
                      .accountPurpose
                  )}
                </p>
              </div>

              {activationResult.discordInvite ? (
                <div
                  className="mt-7 border border-indigo-400/25 bg-indigo-500/10 p-5"
                  style={{ borderRadius: 8 }}
                >
                  <h3 className="font-semibold text-white">
                    Join the FRDA Discord server
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    This private invitation can be used once
                    and expires after three days. Joining
                    through it will automatically add your
                    FRDA Member role.
                  </p>

                  <a
                    href={
                      activationResult.discordInvite
                        .inviteUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-block bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
                    style={{ borderRadius: 5 }}
                  >
                    Join FRDA Discord
                  </a>
                </div>
              ) : (
                <div
                  className="mt-7 border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200"
                  style={{ borderRadius: 8 }}
                >
                  Your account was activated, but a Discord
                  invitation could not be generated. FRDA can
                  issue one separately.
                  {activationResult.discordInviteError
                    ? ` ${activationResult.discordInviteError}`
                    : ""}
                </div>
              )}

              <p className="mt-6 text-sm leading-6 text-zinc-400">
                Your developer profile will remain private
                until you complete the required profile
                details.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/member/dashboard";
                }}
                className="mt-5 w-full cursor-pointer border border-blue-400/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/20"
                style={{ borderRadius: 5 }}
              >
                Open My Member Dashboard
              </button>
            </div>
          ) : invitation ? (
            <form onSubmit={activateAccount}>
              <h2 className="text-2xl font-semibold text-white">
                Create your account
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                This invitation expires on{" "}
                {formatDate(invitation.expiresAt)}.
              </p>

              <div
                className="mt-6 border border-white/10 bg-white/[0.035] p-4"
                style={{ borderRadius: 8 }}
              >
                <p className="text-sm text-zinc-300">
                  <span className="text-zinc-500">
                    Email —
                  </span>{" "}
                  {invitation.email}
                </p>

                <p className="mt-2 text-sm text-zinc-300">
                  <span className="text-zinc-500">
                    Member ID —
                  </span>{" "}
                  {invitation.memberId}
                </p>

                <p className="mt-2 text-sm text-zinc-300">
                  <span className="text-zinc-500">
                    Account type —
                  </span>{" "}
                  {getPurposeLabel(
                    invitation.accountPurpose
                  )}
                </p>
              </div>

              <div className="mt-6">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Display Name
                </label>

                <input
                  type="text"
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                  style={{ borderRadius: 5 }}
                  required
                />
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    minLength={8}
                    className="w-full border border-white/10 bg-black/20 px-4 py-3 pr-16 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                    style={{ borderRadius: 5 }}
                    placeholder="At least 8 characters"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Confirm Password
                </label>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  minLength={8}
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                  style={{ borderRadius: 5 }}
                  required
                />
              </div>

              {formError ? (
                <div
                  className="mt-5 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                  style={{ borderRadius: 8 }}
                >
                  {formError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-7 w-full bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderRadius: 5 }}
              >
                {submitting
                  ? "Activating Account..."
                  : "Activate Membership"}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}