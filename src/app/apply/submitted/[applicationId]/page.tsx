"use client";

import { useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";

export default function ApplySubmittedPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const applicationId = String(params?.applicationId || "");
  const code = searchParams.get("code") || "";
  const token = searchParams.get("token") || "";

  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  async function handleSubmitForReview() {
    if (!token) {
      setReviewError("Missing tracker token. Please use the link from your email.");
      return;
    }

    if (!applicationId) {
      setReviewError("Missing application ID. Please use the link from your email.");
      return;
    }

    try {
      setIsSubmittingReview(true);
      setReviewError("");

      const response = await fetch("/api/apply/request-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId,
          trackerToken: token,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Something went wrong while submitting your application for review."
        );
      }

      router.push(
        `/apply/status/${applicationId}?token=${encodeURIComponent(token)}`
      );
    } catch (error) {
      console.error("Error requesting review:", error);
      setReviewError(
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting your application for review."
      );
      setIsSubmittingReview(false);
    }
  }

  return (
    <main className="min-h-screen text-white" style={{
      background: `
    radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.24) 0%, rgba(59, 130, 246, 0.14) 12%, rgba(59, 130, 246, 0.055) 22%, rgba(59, 130, 246, 0) 34%),
    radial-gradient(circle at 82% 10%, rgba(37, 99, 235, 0.09) 0%, rgba(37, 99, 235, 0.035) 12%, rgba(37, 99, 235, 0) 24%),
    radial-gradient(circle at 18% 10%, rgba(96, 165, 250, 0.07) 0%, rgba(96, 165, 250, 0.03) 10%, rgba(96, 165, 250, 0) 22%),
    linear-gradient(to bottom, #02040a 0%, #010309 32%, #000000 100%)
  `,
    }}>
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <div
          className="w-full rounded-2xl p-8 backdrop-blur-sm sm:p-10"
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(10, 12, 18, 0.84)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.48), 0 0 0 1px rgba(59,130,246,0.05) inset",
          }}
        >
          <div className="mb-6 flex justify-center">
            <div className="rounded-full p-3 ring-1 backdrop-blur-sm" style={{
              background: "rgba(255, 255, 255, 0.05)",
              boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.10) inset",
            }}>
              <img
                src="/frda-logo.png"
                alt="FRDA logo"
                className="h-24 w-24 object-contain"
              />
            </div>
          </div>

          <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Application Sent
          </h1>

          <p className="mt-4 text-center text-sm leading-7 text-zinc-300 sm:text-base">
            Your application has been received. The next step is to verify that
            you own or manage the Roblox place you submitted.
          </p>

          <p className="mt-8 text-center text-2xl font-bold leading-10 text-white sm:text-3xl">
            Please place this code somewhere in the description of the Roblox
            experience you submitted.
          </p>

          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
              Your Verification Code
            </p>

            <p className="mt-3 break-all text-3xl font-bold tracking-[0.12em] text-white sm:text-4xl">
              {code || "Code unavailable"}
            </p>
          </div>

          <div className="mt-8 space-y-4 text-sm leading-7 text-zinc-300 sm:text-base">
            <p>
              After you have added the code, use the button below to submit your
              application for manual review by our team.
            </p>

            <p>
              For the fastest review, make sure the submitted experience is public
              before submitting it for review.
            </p>

            <p>
              If the experience is private, someone from our team may contact you by
              email and ask you to grant one of our reviewers Playtest access to the
              experience so we can inspect the submission and verify the code.
            </p>

            <p>
              If you do not submit your application for review within 7 days, your
              application will expire and you will need to apply again.
            </p>

            <p>
              We’ve also sent these instructions to your email, so you can come back
              and submit for review later if needed.
            </p>
          </div>

          {reviewError ? (
            <p className="mt-6 text-sm text-red-400">
              {reviewError}
            </p>
          ) : null}

          <div className="mt-8">
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={isSubmittingReview}
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-md px-5 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
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
              {isSubmittingReview
                ? "Submitting for Review..."
                : "I’ve added the code to my place — Submit for Review"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs leading-6 text-zinc-500">
            Once submitted, your application will move into manual review.
          </p>
        </div>
      </div>
    </main>
  );
}