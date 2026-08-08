"use client";

import {
  useState,
} from "react";

import {
  auth,
} from "@/lib/firebase";

type RepairCandidate = {
  memberId: string;
  uid: string;
  displayName: string;
  currentPremiumStatus?: string;
};

type RepairResult = {
  ok: boolean;

  mode?:
    | "preview"
    | "apply";

  candidateCount?: number;

  candidates?:
    RepairCandidate[];

  repairedCount?: number;

  repairedMembers?:
    RepairCandidate[];

  skipped?: {
    alreadyQueued?: number;
    alreadyPremium?: number;
    notEligible?: number;
    notPublished?: number;
  };

  message?: string;
  error?: string;
};

export default function RepairLaunchPremiumPage() {
  const [
    result,
    setResult,
  ] =
    useState<RepairResult | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  async function runRepair(
    mode:
      | "preview"
      | "apply",
  ) {
    if (loading) {
      return;
    }

    if (
      mode === "apply"
    ) {
      const confirmed =
        window.confirm(
          "This will move every currently published, launch-eligible, non-premium developer into pending premium review. It will NOT grant premium or change the 30-profile counter. Continue?",
        );

      if (!confirmed) {
        return;
      }
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const user =
        auth.currentUser;

      if (!user) {
        throw new Error(
          "You are not signed in. Open the normal FRDA Admin portal and sign in first.",
        );
      }

      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/membership/repair-launch-premium-queue",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                mode,
              }),
          },
        );

      const responseResult =
        await response
          .json()
          .catch(
            () => null,
          ) as
        | RepairResult
        | null;

      if (
        !response.ok ||
        !responseResult?.ok
      ) {
        throw new Error(
          responseResult?.error ||
          "The repair could not be completed.",
        );
      }

      setResult(
        responseResult,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The repair could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const displayedMembers =
    result?.mode ===
      "apply"
      ? result
        .repairedMembers ||
      []
      : result
        ?.candidates ||
      [];

  return (
    <main className="min-h-screen bg-[#05080f] px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
          FRDA Admin Utility
        </p>

        <h1 className="mt-3 text-2xl font-semibold">
          Repair Launch Premium Queue
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          This temporary tool finds
          published developers who are
          eligible for the launch
          promotion but were not placed
          into premium review after
          approval.
        </p>

        <div className="mt-6 border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <p className="text-sm font-semibold text-amber-200">
            This does not grant Premium.
          </p>

          <p className="mt-1 text-sm leading-6 text-zinc-400">
            It only changes eligible
            affected developers to
            pending_review. The public
            30-profile counter will not
            change until Premium is
            actually granted through the
            normal Developer Profiles
            Admin screen.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              loading
            }
            onClick={() =>
              runRepair(
                "preview",
              )
            }
            className="cursor-pointer bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderRadius: 6,
            }}
          >
            {loading
              ? "Working..."
              : "Preview Repair"}
          </button>

          <button
            type="button"
            disabled={
              loading
            }
            onClick={() =>
              runRepair(
                "apply",
              )
            }
            className="cursor-pointer border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderRadius: 6,
            }}
          >
            Apply Repair
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-6 border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {result ? (
          <div className="mt-8 border border-white/10 bg-white/[0.025] p-5">
            <p className="text-sm font-semibold text-white">
              {result.message}
            </p>

            {result.mode ===
              "preview" &&
              result.skipped ? (
              <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                <p>
                  Already queued:{" "}
                  {result
                    .skipped
                    .alreadyQueued ||
                    0}
                </p>

                <p>
                  Already premium:{" "}
                  {result
                    .skipped
                    .alreadyPremium ||
                    0}
                </p>

                <p>
                  Not launch eligible:{" "}
                  {result
                    .skipped
                    .notEligible ||
                    0}
                </p>

                <p>
                  Not currently
                  published:{" "}
                  {result
                    .skipped
                    .notPublished ||
                    0}
                </p>
              </div>
            ) : null}

            {displayedMembers.length >
              0 ? (
              <div className="mt-5 overflow-hidden border border-white/10">
                {displayedMembers.map(
                  (
                    member,
                  ) => (
                    <div
                      key={
                        member.memberId
                      }
                      className="border-b border-white/10 px-4 py-3 last:border-b-0"
                    >
                      <p className="text-sm font-semibold text-white">
                        {
                          member.displayName
                        }
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        {
                          member.memberId
                        }
                      </p>

                      {member.currentPremiumStatus ? (
                        <p className="mt-1 text-xs text-zinc-600">
                          Current
                          status:{" "}
                          {
                            member.currentPremiumStatus
                          }
                        </p>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm text-zinc-500">
                No affected developers
                found.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}