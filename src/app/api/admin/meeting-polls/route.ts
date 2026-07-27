import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";

export const runtime = "nodejs";

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        serialize(item),
      ]),
    );
  }
  return value;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, undefined, true);
  if (!authorization.ok) return authorization.response;

  const snapshot = await adminDb
    .collection("meetingPolls")
    .orderBy("updatedAt", "desc")
    .get();

  return NextResponse.json(
    {
      ok: true,
      polls: snapshot.docs.map((document) => ({
        id: document.id,
        ...(serialize(document.data()) as Record<string, unknown>),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}