import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type ReportReason =
  | "false_claims"
  | "stolen_work"
  | "impersonation"
  | "inappropriate_content"
  | "spam"
  | "other";

function isReportReason(value: unknown): value is ReportReason {
  return (
    value === "false_claims" ||
    value === "stolen_work" ||
    value === "impersonation" ||
    value === "inappropriate_content" ||
    value === "spam" ||
    value === "other"
  );
}

function getClientFingerprint(request: NextRequest): string {
  const forwardedFor =
    request.headers.get("x-forwarded-for") || "";

  const realIp =
    request.headers.get("x-real-ip") || "";

  const userAgent =
    request.headers.get("user-agent") || "";

  const rawValue = [
    forwardedFor.split(",")[0]?.trim(),
    realIp.trim(),
    userAgent.trim(),
  ].join("|");

  const salt =
    process.env.SURVEY_HASH_SALT ||
    process.env.TURNSTILE_SECRET_KEY ||
    "frda-profile-report";

  return crypto
    .createHash("sha256")
    .update(`${salt}|${rawValue}`)
    .digest("hex");
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
    }>;
  }
) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = slug.trim().toLowerCase();

    if (!normalizedSlug) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing developer profile.",
        },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          reason?: unknown;
          details?: unknown;
          reporterEmail?: unknown;
        }
      | null;

    if (!isReportReason(body?.reason)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Select a valid report reason.",
        },
        { status: 400 }
      );
    }

    const details =
      typeof body?.details === "string"
        ? body.details.trim().slice(0, 3000)
        : "";

    const reporterEmail =
      typeof body?.reporterEmail === "string"
        ? body.reporterEmail.trim().toLowerCase().slice(0, 320)
        : "";

    if (
      body.reason === "other" &&
      details.length < 10
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please explain the concern when selecting Other.",
        },
        { status: 400 }
      );
    }

    const profileSnapshot = await adminDb
      .collection("developerProfiles")
      .where("profileSlug", "==", normalizedSlug)
      .where("isPublished", "==", true)
      .limit(1)
      .get();

    if (profileSnapshot.empty) {
      return NextResponse.json(
        {
          ok: false,
          error: "Developer profile not found.",
        },
        { status: 404 }
      );
    }

    const profileDocument = profileSnapshot.docs[0];
    const profile = profileDocument.data();

    const fingerprint = getClientFingerprint(request);

    const duplicateSnapshot = await adminDb
      .collection("developerProfileReports")
      .where("profileUid", "==", profileDocument.id)
      .where("reporterFingerprint", "==", fingerprint)
      .where("status", "==", "open")
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A report from this browser or connection is already under review.",
        },
        { status: 409 }
      );
    }

    const reportReference = adminDb
      .collection("developerProfileReports")
      .doc();

    await reportReference.set({
      profileUid: profileDocument.id,
      profileSlug: normalizedSlug,

      memberId: String(profile.memberId || ""),
      developerDisplayName: String(
        profile.displayName || ""
      ),

      reason: body.reason,
      details,

      reporterEmail,
      reporterFingerprint: fingerprint,

      status: "open",

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),

      reviewedAt: null,
      reviewedByUid: "",
      reviewedByEmail: "",
      reviewerNote: "",
    });

    return NextResponse.json({
      ok: true,
      message:
        "Your report has been submitted to FRDA for review.",
    });
  } catch (error) {
    console.error("Submit developer profile report error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not submit this profile report.",
      },
      { status: 500 }
    );
  }
}