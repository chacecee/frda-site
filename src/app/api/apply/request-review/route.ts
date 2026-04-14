import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createApplicationLog } from "@/lib/server/applicationLogs";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const applicationId = normalizeText(body?.applicationId);
    const trackerToken = normalizeText(body?.trackerToken);

    if (!applicationId || !trackerToken) {
      return NextResponse.json(
        { error: "Missing application ID or tracker token." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("applications").doc(applicationId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const app = docSnap.data() as {
      trackerToken?: string;
      status?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      verificationAttempts?: number;
    };

    if (!app?.trackerToken || app.trackerToken !== trackerToken) {
      return NextResponse.json(
        { error: "Invalid tracker token." },
        { status: 403 }
      );
    }

    if (app.status === "accepted" || app.status === "rejected" || app.status === "expired") {
      return NextResponse.json(
        { error: "This application can no longer be submitted for review." },
        { status: 400 }
      );
    }

    const nextAttempts = Number(app.verificationAttempts || 0) + 1;

    await docRef.update({
      status: "manual_review",
      verificationRequestedAt: new Date(),
      verificationMethod: "manual",
      verificationAttempts: nextAttempts,
      updatedAt: new Date(),
    });

    await createApplicationLog({
      applicationId,
      type: "review_requested",
      actorType: "applicant",
      actorName: `${app.firstName || ""} ${app.lastName || ""}`.trim(),
      actorEmail: app.email || null,
      message: "Applicant submitted the application for manual review.",
      meta: {
        status: "manual_review",
        verificationMethod: "manual",
        verificationAttempts: nextAttempts,
      },
    });

    return NextResponse.json({
      success: true,
      status: "manual_review",
    });
  } catch (error) {
    console.error("Request review route error:", error);
    return NextResponse.json(
      { error: "Something went wrong while submitting the application for review." },
      { status: 500 }
    );
  }
}