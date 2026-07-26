export const DEVELOPER_PREMIUM_LAUNCH_ACTIVE = true;
export const DEVELOPER_PREMIUM_LAUNCH_LIMIT = 30;

export type DeveloperPremiumStatus =
  | "not_eligible"
  | "pending_review"
  | "qualified";

export function hasDeveloperPremiumAccess(
  data: FirebaseFirestore.DocumentData,
): boolean {
  return (
    data.developerPremiumStatus === "qualified" ||
    data.analyticsAccess === "pro" ||
    Boolean(
      String(data.customSubdomain || "").trim(),
    )
  );
}