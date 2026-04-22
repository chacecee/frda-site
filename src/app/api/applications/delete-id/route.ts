import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function getBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_STORAGE_BUCKET ||
    ""
  );
}

function getAllowedAdminEmails() {
  return (process.env.FRDA_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function deleteIdFileIfPresent(idFilePath?: string | null) {
  if (!idFilePath) {
    return { deleted: false, reason: "No idFilePath found on application." };
  }

  const bucketName = getBucketName();

  if (!bucketName) {
    throw new Error(
      "No Firebase Storage bucket name is configured in environment variables."
    );
  }

  const bucket = getStorage().bucket(bucketName);

  await bucket.file(idFilePath).delete({ ignoreNotFound: true });

  return { deleted: true, path: idFilePath, bucketName };
}

async function requireAuthorizedAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const prefix = "Bearer ";

  if (!authHeader.startsWith(prefix)) {
    throw new Error("Missing or invalid authorization header.");
  }

  const idToken = authHeader.slice(prefix.length).trim();

  if (!idToken) {
    throw new Error("Missing Firebase ID token.");
  }

  const decoded = await adminAuth.verifyIdToken(idToken);
  const email = (decoded.email || "").trim().toLowerCase();

  if (!email) {
    throw new Error("Authenticated user has no email address.");
  }

  const allowedAdmins = getAllowedAdminEmails();

  if (!allowedAdmins.includes(email)) {
    throw new Error("You are not authorized to delete uploaded IDs.");
  }

  return {
    uid: decoded.uid,
    email,
  };
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAuthorizedAdmin(request);

    const body = await request.json().catch(() => null);
    const applicationId = String(body?.applicationId || "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId." },
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

    const app = docSnap.data();

    console.log("delete-id route called for application:", applicationId);
    console.log("Authorized admin:", adminUser.email);
    console.log("Stored idFilePath:", app?.idFilePath || null);

    const deleteResult = await deleteIdFileIfPresent(app?.idFilePath || null);

    await docRef.update({
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
        type: "id_deleted",
        actorType: "admin",
        actorName: adminUser.email,
        actorEmail: adminUser.email,
        message: "Uploaded ID image was deleted through the secure delete route.",
        meta: {
          deleteResult,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

    console.log("ID delete result:", deleteResult);

    return NextResponse.json({
      ok: true,
      deleteResult,
    });
  } catch (error) {
    console.error("Delete ID API error:", error);

    const message =
      error instanceof Error ? error.message : "Could not delete uploaded ID.";

    const unauthorizedMessages = [
      "Missing or invalid authorization header.",
      "Missing Firebase ID token.",
      "Authenticated user has no email address.",
      "You are not authorized to delete uploaded IDs.",
    ];

    const status = unauthorizedMessages.includes(message) ? 403 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }
}