export const APPLICATION_STATUSES = [
  "application_sent",
  "verification_requested",
  "manual_review",
  "needs_more_info",
  "accepted",
  "rejected",
  "expired",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type VerificationResult =
  | "pending"
  | "passed"
  | "failed"
  | "unavailable";

export type DecisionType = "auto" | "manual" | null;

export function getStatusLabel(status: ApplicationStatus) {
  switch (status) {
    case "application_sent":
      return "Application Sent";
    case "verification_requested":
      return "Verification Requested";
    case "manual_review":
      return "Manual Review";
    case "needs_more_info":
      return "Needs More Info";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}