"use client";

import { useEffect, useState } from "react";
import NeedsMoreInfoForm from "./NeedsMoreInfoForm";

type CorrectionRequest = {
  fieldKey:
  | "roblox"
  | "placeLink"
  | "placeContribution"
  | "supportingLinks"
  | "facebookProfile"
  | "discordId"
  | "email"
  | "idPhoto";
  label: string;
  note?: string;
};

export type ApplicationRecord = {
  firstName?: string;
  lastName?: string;
  email?: string;
  discordId?: string;
  facebookProfile?: string;
  roblox?: string;
  placeLink?: string;
  placeContribution?: string;
  supportingLinks?: string;
  verificationCode?: string;
  discordInviteUrl?: string | null;
  status?: string;
  trackerToken?: string;
  reviewerNote?: string | null;
  correctionRequests?: CorrectionRequest[];
  applicantResubmittedAt?: string | null;
};

function getDisplayStatusTitle(status?: string) {
  switch (status) {
    case "application_sent":
      return "APPLICATION SENT";
    case "manual_review":
    case "needs_more_info":
    case "pending":
      return "IN PROGRESS";
    case "accepted":
      return "ACCEPTED";
    case "rejected":
      return "DECLINED";
    case "expired":
      return "EXPIRED";
    default:
      return "STATUS UNAVAILABLE";
  }
}

function getStatusSubLabel(app: ApplicationRecord) {
  switch (app.status) {
    case "application_sent":
      return "We're waiting for you to take the next step";
    case "manual_review":
      return app.applicantResubmittedAt
        ? "Application updated — waiting for further review"
        : "Application in queue for review";
    case "needs_more_info":
      return "More information requested by reviewer";
    case "pending":
      return "Application under internal follow-up";
    case "accepted":
      return "Final decision completed";
    case "rejected":
      return "Application review completed";
    case "expired":
      return "Application window closed";
    default:
      return "Status unavailable";
  }
}

function getStatusDescription(app: ApplicationRecord) {
  switch (app.status) {
    case "application_sent":
      return "We received your application, but it is not yet in the review queue. Please complete the verification step below first, then use the button to start manual review.";
    case "manual_review":
      return app.applicantResubmittedAt
        ? "Your updated information has been received and your application is back in the review queue."
        : "Your application is currently in the review queue and will be checked by our team.";
    case "needs_more_info":
      return (
        app.reviewerNote ||
        "We need a bit more information before we can continue reviewing your application."
      );
    case "pending":
      return "Your application is still active and is currently under internal follow-up by our team.";
    case "accepted":
      return "Your application has been accepted. You may use the Discord invite below to join the FRDA server using the same Discord account tied to your submitted Discord user ID.";
    case "rejected":
      return app.reviewerNote || "Your application was not approved at this time.";
    case "expired":
      return "Your application expired because it was not submitted for review within 7 days. Please submit a new application if you would still like to proceed.";
    default:
      return "We could not determine the current application status.";
  }
}

function getProgressStep(status?: string) {
  switch (status) {
    case "application_sent":
      return 1;
    case "manual_review":
    case "needs_more_info":
    case "pending":
      return 2;
    case "accepted":
    case "rejected":
    case "expired":
      return 3;
    default:
      return 1;
  }
}

type Props = {
  applicationId: string;
  token: string;
  initialApp: ApplicationRecord;
};

export default function StatusTrackerClient({
  applicationId,
  token,
  initialApp,
}: Props) {
  const [app, setApp] = useState<ApplicationRecord>(initialApp);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function refreshStatus() {
      try {
        setIsRefreshing(true);

        const response = await fetch(
          `/api/application-status/${applicationId}?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled && data?.application) {
          setApp(data.application);
        }
      } catch (error) {
        console.error("Status refresh failed:", error);
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    const interval = window.setInterval(refreshStatus, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applicationId, token]);

  async function handleSubmitForReview() {
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

      setApp((current) => ({
        ...current,
        status: "manual_review",
      }));
    } catch (error) {
      console.error("Error requesting review:", error);
      setReviewError(
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting your application for review."
      );
    } finally {
      setIsSubmittingReview(false);
    }
  }

  const progressStep = getProgressStep(app.status);
  const applicantName = app.firstName?.trim()
    ? `${app.firstName}'s Application Status`
    : "Application Status";

  const fillWidth =
    progressStep === 1 ? "0%" : progressStep === 2 ? "33.333%" : "66.666%";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 0%, rgba(59,130,246,0.38) 0%, rgba(59,130,246,0.20) 18%, rgba(59,130,246,0.08) 34%, rgba(59,130,246,0) 58%),
              radial-gradient(circle at 85% 8%, rgba(37,99,235,0.22) 0%, rgba(37,99,235,0.10) 18%, rgba(37,99,235,0) 42%),
              radial-gradient(circle at 15% 10%, rgba(96,165,250,0.20) 0%, rgba(96,165,250,0.08) 16%, rgba(96,165,250,0) 40%)
            `,
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl">
          <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {applicantName}
          </h1>

          <div style={{ marginTop: 44, marginBottom: 84 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 700,
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "16.666%",
                  width: "66.666%",
                  top: 22,
                  height: 8,
                  background: "rgba(113,113,122,0.85)",
                  borderRadius: 9999,
                }}
              />

              <div
                style={{
                  position: "absolute",
                  left: "16.666%",
                  width: fillWidth,
                  top: 22,
                  height: 8,
                  borderRadius: 9999,
                  background:
                    "linear-gradient(90deg, rgb(59,130,246) 0%, rgb(96,165,250) 35%, rgb(37,99,235) 55%, rgb(96,165,250) 75%, rgb(59,130,246) 100%)",
                  transition: "width 500ms ease",
                }}
              />

              <div
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  alignItems: "start",
                  justifyItems: "center",
                }}
              >
                {[
                  { step: 1, label: ["Application", "Sent"] },
                  { step: 2, label: ["In Progress"] },
                  { step: 3, label: ["Final", "Decision"] },
                ].map(({ step, label }) => {
                  const active = progressStep >= step;

                  return (
                    <div
                      key={step}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "9999px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          fontWeight: 700,
                          background: active ? "rgb(37, 99, 235)" : "rgb(113,113,122)",
                          color: "#fff",
                          boxSizing: "border-box",
                          flex: "0 0 auto",
                        }}
                      >
                        {step}
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          fontWeight: 700,
                          fontSize: 14,
                          lineHeight: 1.2,
                          color: "#fff",
                          minHeight: 34,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          flexDirection: "column",
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        {label.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-sm border border-zinc-600 bg-black/40 px-10 py-16 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
              Current Status
            </p>

            <h2 className="mt-5 text-3xl font-extrabold tracking-wide text-white sm:text-4xl">
              {getDisplayStatusTitle(app.status)}
            </h2>

            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">
              {getStatusSubLabel(app)}
            </p>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-300">
              {getStatusDescription(app)}
            </p>

            {app.status === "application_sent" ? (
              <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-blue-500/20 bg-blue-500/10 p-6 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                  What you need to do next
                </p>

                <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
                    Your Verification Code
                  </p>

                  <p className="mt-3 break-all text-3xl font-bold tracking-[0.12em] text-white sm:text-4xl">
                    {app.verificationCode || "Code unavailable"}
                  </p>
                </div>

                <ol className="mt-5 space-y-3 text-sm leading-7 text-zinc-200">
                  <li>
                    1. Copy the verification code above.
                  </li>
                  <li>
                    2. Paste it into the description of your submitted Roblox experience.
                  </li>
                  <li>
                    3. Please make sure it appears in the description of{" "}
                    {app.placeLink ? (
                      <a
                        href={app.placeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-300 underline underline-offset-4 hover:text-blue-200"
                      >
                        this submitted Roblox place
                      </a>
                    ) : (
                      <span className="font-semibold text-white">the Roblox place you submitted</span>
                    )}
                    .
                  </li>
                  <li>
                    4. Once that is done, click the button below to prompt our team to check your application.
                  </li>
                </ol>

                <p className="mt-5 text-xs leading-6 text-zinc-400">
                  Clicking the review button before adding the code may delay your review.
                </p>

                {reviewError ? (
                  <p className="mt-5 text-sm text-red-400">{reviewError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={handleSubmitForReview}
                  disabled={isSubmittingReview}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-md px-5 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
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
                    : "Done — Review My Application"}
                </button>

                <p className="mt-4 text-xs leading-6 text-zinc-400">
                  Your application will only enter manual review after you complete this step.
                </p>
              </div>
            ) : null}

            <p className="mt-5 text-xs text-zinc-500">
              {isRefreshing ? "Checking for updates..." : "Updates automatically every 10 seconds"}
            </p>

            {app.status === "accepted" && app.discordInviteUrl ? (
              <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Next Step
                </p>

                <p className="mt-4 text-sm leading-7 text-zinc-200">
                  Your application has been approved. Use the button below to join the FRDA Discord server.
                  This invite is intended only for the Discord account tied to your submitted Discord user ID.
                </p>

                <a
                  href={app.discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-md px-5 py-4 text-base font-semibold text-white transition sm:text-lg"
                  style={{
                    background: "#10b981",
                    boxShadow: "0 10px 30px rgba(16,185,129,0.18)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#34d399";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#10b981";
                  }}
                >
                  Join FRDA Discord
                </a>

                <p className="mt-4 text-xs leading-6 text-zinc-400">
                  If the button doesn’t work, please check your approval email for the same invite link.
                </p>
              </div>
            ) : null}

            {app.status === "needs_more_info" &&
              Array.isArray(app.correctionRequests) &&
              app.correctionRequests.length > 0 ? (
              <div className="mt-10 text-left">
                <NeedsMoreInfoForm
                  applicationId={applicationId}
                  token={token}
                  correctionRequests={app.correctionRequests}
                  initialValues={{
                    email: app.email || "",
                    discordId: app.discordId || "",
                    facebookProfile: app.facebookProfile || "",
                    roblox: app.roblox || "",
                    placeLink: app.placeLink || "",
                    placeContribution: app.placeContribution || "",
                    supportingLinks: app.supportingLinks || "",
                  }}
                />
              </div>
            ) : null}
          </div>

          {/*
<div style={{ marginTop: 32 }}>
  <p className="text-center text-sm leading-7 text-zinc-400">
    If you have any questions or would like to provide more details
    about your application,{" "}
    <button
      type="button"
      className="cursor-pointer font-semibold text-blue-300 underline underline-offset-4 hover:text-blue-200"
    >
      please click here
    </button>
    .
  </p>
</div>
*/}
        </div>
      </div>
    </main>
  );
}