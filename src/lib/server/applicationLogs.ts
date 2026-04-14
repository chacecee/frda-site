import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type LogActorType = "applicant" | "admin" | "system";

type CreateApplicationLogInput = {
  applicationId: string;
  type: string;
  actorType: LogActorType;
  actorName?: string | null;
  actorEmail?: string | null;
  message: string;
  meta?: Record<string, unknown>;
};

export async function createApplicationLog({
  applicationId,
  type,
  actorType,
  actorName,
  actorEmail,
  message,
  meta = {},
}: CreateApplicationLogInput) {
  const logsRef = adminDb
    .collection("applications")
    .doc(applicationId)
    .collection("activityLogs");

  await logsRef.add({
    type,
    actorType,
    actorName: actorName || null,
    actorEmail: actorEmail || null,
    message,
    meta,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export type ApplicationLogRecord = {
  id: string;
  type: string;
  actorType: LogActorType;
  actorName?: string | null;
  actorEmail?: string | null;
  message: string;
  meta?: Record<string, unknown>;
  createdAt?: Timestamp | null;
};