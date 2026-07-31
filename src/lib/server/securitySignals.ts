import crypto from "crypto";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const SECURITY_CONNECTIONS_COLLECTION =
  "membershipSecurityConnections";

export const SECURITY_EVENTS_COLLECTION =
  "membershipSecurityEvents";

export type SecurityEventType =
  | "registration_succeeded"
  | "registration_blocked"
  | "registration_rate_limited"
  | "registration_turnstile_failed"
  | "registration_honeypot"
  | "registration_failed"
  | "connection_watched"
  | "connection_unwatched"
  | "connection_blocked"
  | "connection_unblocked";

export type SecurityConnectionControl = {
  watched: boolean;
  permanentBlock: boolean;
  blockedUntil: Timestamp | null;
  blockReason: string;
};

function getFingerprintSecret(): string {
  const secret =
    process.env.SECURITY_FINGERPRINT_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      "Missing SECURITY_FINGERPRINT_SECRET. Add a random secret of at least 32 characters.",
    );
  }

  return secret;
}

export function getClientAddress(
  request: NextRequest,
): string {
  const cloudflareAddress =
    request.headers
      .get("cf-connecting-ip")
      ?.trim();

  if (cloudflareAddress) {
    return cloudflareAddress;
  }

  const forwarded =
    request.headers.get("x-forwarded-for");

  if (forwarded) {
    return (
      forwarded.split(",")[0]?.trim() ||
      "unknown"
    );
  }

  return (
    request.headers
      .get("x-real-ip")
      ?.trim() ||
    "unknown"
  );
}

export function createConnectionFingerprint(
  address: string,
): string {
  return crypto
    .createHmac(
      "sha256",
      getFingerprintSecret(),
    )
    .update(address || "unknown")
    .digest("hex");
}

export function createEmailFingerprint(
  email: string,
): string {
  return crypto
    .createHmac(
      "sha256",
      getFingerprintSecret(),
    )
    .update(
      email.trim().toLowerCase(),
    )
    .digest("hex");
}

export function shortFingerprint(
  fingerprint: string,
): string {
  return fingerprint
    .slice(0, 10)
    .toUpperCase();
}

export async function getConnectionControl(
  connectionFingerprint: string,
): Promise<
  SecurityConnectionControl & {
    exists: boolean;
    accountCount: number;
    suspendedAccountCount: number;
  }
> {
  const snapshot =
    await adminDb
      .collection(
        SECURITY_CONNECTIONS_COLLECTION,
      )
      .doc(connectionFingerprint)
      .get();

  const data =
    snapshot.data() || {};

  return {
    exists:
      snapshot.exists,
    watched:
      data.watched === true,
    permanentBlock:
      data.permanentBlock === true,
    blockedUntil:
      data.blockedUntil instanceof
      Timestamp
        ? data.blockedUntil
        : null,
    blockReason:
      String(
        data.blockReason || "",
      ),
    accountCount:
      Array.isArray(
        data.memberIds,
      )
        ? data.memberIds.length
        : 0,
    suspendedAccountCount:
      typeof data.suspendedAccountCount ===
      "number"
        ? data.suspendedAccountCount
        : 0,
  };
}

export function isConnectionBlocked(
  control: SecurityConnectionControl,
): boolean {
  if (control.permanentBlock) {
    return true;
  }

  return Boolean(
    control.blockedUntil &&
    control.blockedUntil.toMillis() >
      Date.now(),
  );
}

export async function recordSecurityEvent({
  eventType,
  connectionFingerprint,
  email,
  memberId = "",
  authUid = "",
  displayName = "",
  outcome,
  details = {},
  request,
}: {
  eventType: SecurityEventType;
  connectionFingerprint: string;
  email?: string;
  memberId?: string;
  authUid?: string;
  displayName?: string;
  outcome:
    | "allowed"
    | "blocked"
    | "failed"
    | "observed";
  details?: Record<string, unknown>;
  request?: NextRequest;
}) {
  await adminDb
    .collection(
      SECURITY_EVENTS_COLLECTION,
    )
    .add({
      eventType,
      connectionFingerprint,
      connectionLabel:
        shortFingerprint(
          connectionFingerprint,
        ),
      emailFingerprint:
        email
          ? createEmailFingerprint(email)
          : "",
      memberId,
      authUid,
      displayName,
      outcome,
      details,
      userAgent:
        request
          ?.headers
          .get("user-agent")
          ?.slice(0, 500) ||
        "",
      createdAt:
        FieldValue.serverTimestamp(),
    });
}

export async function registerConnectionAccount({
  connectionFingerprint,
  memberId,
  authUid,
  email,
  displayName,
  accountPurpose,
  turnstileHostname,
}: {
  connectionFingerprint: string;
  memberId: string;
  authUid: string;
  email: string;
  displayName: string;
  accountPurpose: string;
  turnstileHostname: string;
}) {
  const reference =
    adminDb
      .collection(
        SECURITY_CONNECTIONS_COLLECTION,
      )
      .doc(connectionFingerprint);

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(reference);

      const data =
        snapshot.data() || {};

      const existingMemberIds =
        Array.isArray(
          data.memberIds,
        )
          ? data.memberIds.filter(
              (
                value: unknown,
              ): value is string =>
                typeof value ===
                "string",
            )
          : [];

      const nextMemberIds =
        existingMemberIds.includes(
          memberId,
        )
          ? existingMemberIds
          : [
              ...existingMemberIds,
              memberId,
            ];

      const watched =
        data.watched === true;

      const suspendedAccountCount =
        typeof data.suspendedAccountCount ===
        "number"
          ? data.suspendedAccountCount
          : 0;

      const riskLevel =
        watched ||
        suspendedAccountCount > 0
          ? "high"
          : nextMemberIds.length >= 5
            ? "high"
            : nextMemberIds.length >= 3
              ? "watch"
              : nextMemberIds.length >= 2
                ? "low"
                : "none";

      transaction.set(
        reference,
        {
          connectionFingerprint,
          connectionLabel:
            shortFingerprint(
              connectionFingerprint,
            ),
          memberIds:
            nextMemberIds,
          accountCount:
            nextMemberIds.length,
          watched,
          suspendedAccountCount,
          riskLevel,
          lastRegistrationAt:
            FieldValue.serverTimestamp(),
          lastActivityAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
          createdAt:
            snapshot.exists
              ? data.createdAt ||
                FieldValue.serverTimestamp()
              : FieldValue.serverTimestamp(),
          lastAccount: {
            memberId,
            authUid,
            email,
            displayName,
            accountPurpose,
            turnstileHostname,
          },
        },
        { merge: true },
      );
    },
  );
}

export async function markConnectionSuspension({
  connectionFingerprint,
  suspended,
}: {
  connectionFingerprint: string;
  suspended: boolean;
}) {
  const reference =
    adminDb
      .collection(
        SECURITY_CONNECTIONS_COLLECTION,
      )
      .doc(connectionFingerprint);

  await adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(reference);

      if (!snapshot.exists) {
        return;
      }

      const data =
        snapshot.data() || {};

      const currentCount =
        typeof data.suspendedAccountCount ===
        "number"
          ? data.suspendedAccountCount
          : 0;

      const nextCount =
        suspended
          ? currentCount + 1
          : Math.max(
              0,
              currentCount - 1,
            );

      transaction.set(
        reference,
        {
          suspendedAccountCount:
            nextCount,
          riskLevel:
            nextCount > 0 ||
            data.watched === true
              ? "high"
              : (
                  typeof data.accountCount ===
                    "number" &&
                  data.accountCount >= 3
                )
                ? "watch"
                : (
                    typeof data.accountCount ===
                      "number" &&
                    data.accountCount >= 2
                  )
                  ? "low"
                  : "none",
          lastActivityAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    },
  );
}