import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebaseAdmin";

function toMillis(value: unknown): number | null {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return ((value as { toDate: () => Date }).toDate()).getTime();
    } catch {
      return null;
    }
  }

  return null;
}

async function deleteIdFileIfPresent(idFilePath?: string | null) {
  if (!idFilePath) return;

  const bucket = getStorage().bucket();
  await bucket.file(idFilePath).delete({ ignoreNotFound: true });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await context.params;
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const docRef = adminDb.collection("applications").doc(applicationId);
    let docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const app = docSnap.data();

    if (!app?.trackerToken || app.trackerToken !== token) {
      return NextResponse.json({ error: "Invalid token." }, { status: 403 });
    }

    const expiresAtMs = toMillis(app.expiresAt);
    const nowMs = Date.now();

    const shouldExpire =
      app.status === "pending" &&
      typeof expiresAtMs === "number" &&
      nowMs >= expiresAtMs;

    if (shouldExpire) {
      try {
        await deleteIdFileIfPresent(app.idFilePath || null);

        await docRef.update({
          status: "expired",
          reviewerNote: app.reviewerNote || "",
          idFileUrl: null,
          idFilePath: null,
          idFileName: null,
          idDeletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await adminDb
          .collection("applications")
          .doc(applicationId)
          .collection("activityLogs")
          .add({
            type: "expired",
            actorType: "system",
            actorName: "System",
            actorEmail: null,
            message: "Application expired after reaching the pending review time limit.",
            meta: {
              previousStatus: "pending",
              idDeleted: true,
            },
            createdAt: FieldValue.serverTimestamp(),
          });

        docSnap = await docRef.get();
      } catch (expireError) {
        console.error("Could not expire application and delete ID:", expireError);
      }
    }

    const fresh = docSnap.data();

    return NextResponse.json({
      application: {
        firstName: fresh?.firstName || "",
        lastName: fresh?.lastName || "",
        email: fresh?.email || "",
        discordId: fresh?.discordId || "",
        facebookProfile: fresh?.facebookProfile || "",
        roblox: fresh?.roblox || "",
        placeLink: fresh?.placeLink || "",
        placeContribution: fresh?.placeContribution || "",
        supportingLinks: fresh?.supportingLinks || "",
        verificationCode: fresh?.verificationCode || "",
        discordInviteUrl: fresh?.discordInviteUrl || "",
        status: fresh?.status || "",
        trackerToken: fresh?.trackerToken || "",
        reviewerNote: fresh?.reviewerNote || "",
        correctionRequests: Array.isArray(fresh?.correctionRequests)
          ? fresh.correctionRequests
          : [],
        applicantResubmittedAt: fresh?.applicantResubmittedAt || null,
      },
    });
  } catch (error) {
    console.error("Application status API error:", error);
    return NextResponse.json(
      { error: "Could not load application status." },
      { status: 500 }
    );
  }
}