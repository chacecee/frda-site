import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const MEMBER_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function generateRandomMemberId() {
  let code = "";

  for (let i = 0; i < 8; i += 1) {
    const index = Math.floor(Math.random() * MEMBER_ID_ALPHABET.length);
    code += MEMBER_ID_ALPHABET[index];
  }

  return `FRDA-M-${code}`;
}

async function verifyStaffRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "").trim()
    : "";

  if (!token) return null;

  const decoded = await adminAuth.verifyIdToken(token);
  const email = normalizeEmail(decoded.email);

  if (!email) return null;

  const exactSnapshot = await adminDb
    .collection("staff")
    .where("emailAddress", "==", email)
    .limit(1)
    .get();

  if (!exactSnapshot.empty) {
    return {
      uid: decoded.uid,
      email,
      staffId: exactSnapshot.docs[0].id,
    };
  }

  const allStaffSnapshot = await adminDb.collection("staff").get();

  const matchingStaff = allStaffSnapshot.docs.find((docSnap) => {
    const data = docSnap.data() as { emailAddress?: string };
    return normalizeEmail(data.emailAddress) === email;
  });

  if (!matchingStaff) return null;

  return {
    uid: decoded.uid,
    email,
    staffId: matchingStaff.id,
  };
}

export async function POST(request: NextRequest) {
  try {
    const staff = await verifyStaffRequest(request);

    if (!staff) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const applicationId =
      typeof body?.applicationId === "string" ? body.applicationId.trim() : "";

    if (!applicationId) {
      return NextResponse.json(
        { ok: false, error: "Missing application ID." },
        { status: 400 }
      );
    }

    const appRef = adminDb.collection("applications").doc(applicationId);

    const assigned = await adminDb.runTransaction(async (transaction) => {
      const appSnap = await transaction.get(appRef);

      if (!appSnap.exists) {
        throw new Error("Application not found.");
      }

      const appData = appSnap.data() as {
        memberId?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        memberListingLimit?: number;
        paidListingCredits?: number;
        sponsoredPlacementsPurchased?: number;
        memberStatus?: string;
      };

      if (appData.memberId) {
        return {
          memberId: appData.memberId,
          memberListingLimit: appData.memberListingLimit || 3,
          paidListingCredits: appData.paidListingCredits || 0,
          sponsoredPlacementsPurchased:
            appData.sponsoredPlacementsPurchased || 0,
          memberStatus: appData.memberStatus || "active",
        };
      }

      let memberId = "";

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = generateRandomMemberId();
        const memberIdRef = adminDb.collection("memberIds").doc(candidate);
        const memberIdSnap = await transaction.get(memberIdRef);

        if (!memberIdSnap.exists) {
          memberId = candidate;

          transaction.set(memberIdRef, {
            memberId,
            applicationId,
            applicantEmail: normalizeEmail(appData.email),
            applicantName: `${appData.firstName || ""} ${
              appData.lastName || ""
            }`.trim(),
            createdAt: FieldValue.serverTimestamp(),
            createdByUid: staff.uid,
            createdByEmail: staff.email,
          });

          break;
        }
      }

      if (!memberId) {
        throw new Error("Could not generate a unique member ID.");
      }

      const memberFields = {
        memberId,
        memberListingLimit: 3,
        paidListingCredits: 0,
        sponsoredPlacementsPurchased: 0,
        memberStatus: "active",
      };

      transaction.update(appRef, {
        ...memberFields,
        memberAcceptedAt: FieldValue.serverTimestamp(),
        memberIdAssignedAt: FieldValue.serverTimestamp(),
        memberIdAssignedByUid: staff.uid,
        memberIdAssignedByEmail: staff.email,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return memberFields;
    });

    return NextResponse.json({
      ok: true,
      ...assigned,
    });
  } catch (error) {
    console.error("Assign member ID error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not assign a member ID.",
      },
      { status: 500 }
    );
  }
}