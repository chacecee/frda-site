import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

export const PUBLISHED_DEVELOPER_PROFILES_COLLECTION =
  "publishedDeveloperProfiles";

const PUBLIC_PROFILE_FIELDS = [
  "uid",
  "memberId",
  "displayName",
  "headline",
  "bio",
  "skills",
  "genreExperience",
  "availability",
  "experienceTier",
  "experienceTierIsSelfDeclared",
  "deliveryScope",
  "portfolioUrl",
  "workSamples",
  "coverShowcaseImages",
  "avatarUrl",
  "avatarStoragePath",
  "customSubdomain",
  "customProfileAddress",
  "profileSlug",
  "isVerified",
  "isFeatured",
  "publishedAt",
  "lastPublishedAt",
] as const;

function copySafeValue(
  value: unknown,
): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value ?? null;
  }

  if (
    value instanceof Timestamp
  ) {
    return value;
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      copySafeValue,
    );
  }

  if (
    typeof value === "object"
  ) {
    const result:
      Record<string, unknown> = {};

    Object.entries(
      value as Record<
        string,
        unknown
      >,
    ).forEach(
      ([key, item]) => {
        result[key] =
          copySafeValue(item);
      },
    );

    return result;
  }

  return null;
}

export function buildPublishedDeveloperProfile({
  uid,
  profile,
  approvedBy,
  source = "staff_approval",
}: {
  uid: string;
  profile:
    FirebaseFirestore.DocumentData;
  approvedBy?: {
    uid?: string;
    email?: string;
    name?: string;
  };
  source?:
    | "staff_approval"
    | "trusted_update"
    | "migration";
}) {
  const snapshot:
    Record<string, unknown> = {};

  PUBLIC_PROFILE_FIELDS.forEach(
    (field) => {
      if (
        field in profile
      ) {
        snapshot[field] =
          copySafeValue(
            profile[field],
          );
      }
    },
  );

  snapshot.uid = uid;
  snapshot.profileStatus =
    "live";
  snapshot.isPublished =
    true;
  snapshot.publicSnapshotSource =
    source;
  snapshot.publicSnapshotVersion =
    1;
  snapshot.approvedAt =
    FieldValue.serverTimestamp();
  snapshot.approvedByUid =
    approvedBy?.uid || "";
  snapshot.approvedByEmail =
    approvedBy?.email || "";
  snapshot.approvedByName =
    approvedBy?.name ||
    approvedBy?.email ||
    "";
  snapshot.updatedAt =
    FieldValue.serverTimestamp();

  if (
    !snapshot.createdAt
  ) {
    snapshot.createdAt =
      profile.createdAt ||
      FieldValue.serverTimestamp();
  }

  if (
    !snapshot.publishedAt
  ) {
    snapshot.publishedAt =
      FieldValue.serverTimestamp();
  }

  return snapshot;
}