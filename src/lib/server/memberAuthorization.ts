import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export type TalentSeekerStatus =
  | "not_required"
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export type AuthorizedMember = {
  uid: string;
  memberId: string;
  email: string;
  displayName: string;
  accountPurpose:
    | "developer"
    | "talent_seeker"
    | "both";
  accountStatus: string;
  memberStatus: string;
  profileStatus: string;
  talentSeekerStatus: TalentSeekerStatus;
};

type MemberAuthorizationResult =
  | {
      ok: true;
      member: AuthorizedMember;
      memberData: FirebaseFirestore.DocumentData;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function getBearerToken(
  request: NextRequest,
): string {
  const authorization =
    request.headers.get("authorization") || "";

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return "";
  }

  return authorization.slice(7).trim();
}

function normalizeTalentSeekerStatus(
  value: unknown,
  accountPurpose:
    AuthorizedMember["accountPurpose"],
): TalentSeekerStatus {
  if (
    value === "not_required" ||
    value === "not_submitted" ||
    value === "pending" ||
    value === "verified" ||
    value === "rejected" ||
    value === "suspended"
  ) {
    return value;
  }

  return accountPurpose === "talent_seeker" ||
    accountPurpose === "both"
    ? "not_submitted"
    : "not_required";
}

export async function authorizeMemberRequest(
  request: NextRequest,
): Promise<MemberAuthorizationResult> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Missing authentication token.",
        },
        { status: 401 },
      ),
    };
  }

  let decodedToken;

  try {
    decodedToken =
      await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.error(
      "Member token verification error:",
      error,
    );

    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "Your session is invalid or has expired.",
        },
        { status: 401 },
      ),
    };
  }

  if (decodedToken.email_verified !== true) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "Verify your email address before accessing the FRDA member portal.",
        },
        { status: 403 },
      ),
    };
  }

  const memberSnapshot = await adminDb
    .collection("members")
    .where("authUid", "==", decodedToken.uid)
    .limit(1)
    .get();

  if (memberSnapshot.empty) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "No FRDA membership account is linked to this login.",
        },
        { status: 403 },
      ),
    };
  }

  const memberDocument =
    memberSnapshot.docs[0];

  const memberData =
    memberDocument.data();

  const accountStatus = String(
    memberData.accountStatus || "",
  );

  const memberStatus = String(
    memberData.memberStatus || "",
  );

  const rawAccountPurpose = String(
    memberData.accountPurpose || "developer",
  );

  const accountPurpose:
    AuthorizedMember["accountPurpose"] =
      rawAccountPurpose === "talent_seeker" ||
      rawAccountPurpose === "both"
        ? rawAccountPurpose
        : "developer";

  if (accountStatus !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "This FRDA membership account is not active.",
        },
        { status: 403 },
      ),
    };
  }

  if (
    memberStatus === "suspended" ||
    memberStatus === "inactive" ||
    memberStatus === "removed"
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "This FRDA membership is currently unavailable.",
        },
        { status: 403 },
      ),
    };
  }

  if (memberData.emailVerified !== true) {
    await memberDocument.ref.set(
      { emailVerified: true },
      { merge: true },
    );
  }

  return {
    ok: true,
    member: {
      uid: decodedToken.uid,
      memberId: memberDocument.id,
      email: String(memberData.email || ""),
      displayName: String(
        memberData.displayName || "",
      ),
      accountPurpose,
      accountStatus,
      memberStatus,
      profileStatus: String(
        memberData.profileStatus ||
          "not_started",
      ),
      talentSeekerStatus:
        normalizeTalentSeekerStatus(
          memberData.talentSeekerStatus,
          accountPurpose,
        ),
    },
    memberData,
  };
}