export const DEVELOPER_PREMIUM_LAUNCH_ACTIVE =
  true;

export const DEVELOPER_PREMIUM_LAUNCH_LIMIT =
  30;

/**
 * July 27, 2026 at 11:00 AM Philippine time.
 *
 * Accounts created before this moment qualify for
 * grandfathered lifetime premium.
 *
 * Accounts created at or after this moment may qualify
 * for one of the 30 launch lifetime premium grants.
 */
export const DEVELOPER_PREMIUM_LAUNCH_STARTED_AT =
  new Date(
    "2026-07-27T11:00:00+08:00",
  );

export type DeveloperPremiumStatus =
  | "not_eligible"
  | "pending_review"
  | "qualified";

export type DeveloperPremiumGrantType =
  | ""
  | "grandfathered_lifetime"
  | "launch_lifetime"
  | "manual_lifetime"
  | "subscription";

function normalizeAccountPurpose(
  value: unknown,
):
  | "developer"
  | "talent_seeker"
  | "both"
  | "" {
  return value === "developer" ||
    value === "talent_seeker" ||
    value === "both"
    ? value
    : "";
}

function valueToDate(
  value: unknown,
): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime(),
    )
      ? null
      : value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    const converted = (
      value as {
        toDate: () => Date;
      }
    ).toDate();

    return Number.isNaN(
      converted.getTime(),
    )
      ? null
      : converted;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const converted =
      new Date(value);

    return Number.isNaN(
      converted.getTime(),
    )
      ? null
      : converted;
  }

  return null;
}

export function isDeveloperAccount(
  data:
    FirebaseFirestore.DocumentData,
): boolean {
  const accountPurpose =
    normalizeAccountPurpose(
      data.accountPurpose,
    );

  return (
    accountPurpose ===
      "developer" ||
    accountPurpose === "both"
  );
}

/**
 * Premium-only features must use this function.
 *
 * The grant type explains why access exists, but it does
 * not independently unlock anything.
 */
export function hasDeveloperPremiumAccess(
  data:
    FirebaseFirestore.DocumentData,
): boolean {
  return (
    data.developerPremiumStatus ===
    "qualified"
  );
}

/**
 * Existing developer-capable accounts created before the
 * campaign cutoff receive lifetime premium automatically.
 */
export function isEligibleForGrandfatheredPremium(
  data:
    FirebaseFirestore.DocumentData,
): boolean {
  if (!isDeveloperAccount(data)) {
    return false;
  }

  const createdAt =
    valueToDate(data.createdAt);

  if (!createdAt) {
    return false;
  }

  return (
    createdAt.getTime() <
    DEVELOPER_PREMIUM_LAUNCH_STARTED_AT.getTime()
  );
}

/**
 * Developer-capable accounts created at or after the
 * campaign cutoff may enter the first-30 launch review.
 */
export function isEligibleForLaunchPremiumReview(
  data:
    FirebaseFirestore.DocumentData,
): boolean {
  if (
    !DEVELOPER_PREMIUM_LAUNCH_ACTIVE ||
    !isDeveloperAccount(data)
  ) {
    return false;
  }

  const createdAt =
    valueToDate(data.createdAt);

  if (!createdAt) {
    return false;
  }

  return (
    createdAt.getTime() >=
    DEVELOPER_PREMIUM_LAUNCH_STARTED_AT.getTime()
  );
}

export function normalizeDeveloperPremiumStatus(
  value: unknown,
): DeveloperPremiumStatus {
  return value ===
      "pending_review" ||
    value === "qualified"
    ? value
    : "not_eligible";
}

export function normalizeDeveloperPremiumGrantType(
  value: unknown,
): DeveloperPremiumGrantType {
  return value ===
      "grandfathered_lifetime" ||
    value === "launch_lifetime" ||
    value === "manual_lifetime" ||
    value === "subscription"
    ? value
    : "";
}