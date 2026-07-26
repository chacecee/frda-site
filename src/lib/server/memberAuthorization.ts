import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

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
  talentSeekerStatus:
    TalentSeekerStatus;
};

type MemberAuthorizationResult =
  | {
      ok: true;
      member: AuthorizedMember;
      memberData:
        FirebaseFirestore.DocumentData;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function getBearerToken(
  request: NextRequest,
): string {
  const authorization =
    request.headers.get(
      "authorization",
    ) || "";

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return "";
  }

  return authorization
    .slice(7)
    .trim();
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

  return (
    accountPurpose ===
      "talent_seeker" ||
    accountPurpose === "both"
  )
    ? "not_submitted"
    : "not_required";
}

function unauthorizedResponse(
  message: string,
  status: number,
): MemberAuthorizationResult {
  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    ),
  };
}

export async function authorizeMemberRequest(
  request: NextRequest,
): Promise<MemberAuthorizationResult> {
  const token =
    getBearerToken(request);

  if (!token) {
    return unauthorizedResponse(
      "Missing authentication token.",
      401,
    );
  }

  let decodedToken;

  try {
    decodedToken =
      await adminAuth.verifyIdToken(
        token,
        true,
      );
  } catch (error) {
    console.error(
      "Member token verification error:",
      error,
    );

    return unauthorizedResponse(
      "Your session is invalid or has expired.",
      401,
    );
  }

  if (
    decodedToken.email_verified !==
    true
  ) {
    return unauthorizedResponse(
      "Verify your email address before accessing the FRDA member portal.",
      403,
    );
  }

  const tokenEmail =
    typeof decodedToken.email ===
    "string"
      ? decodedToken.email
          .trim()
          .toLowerCase()
      : "";

  if (!tokenEmail) {
    return unauthorizedResponse(
      "Your login does not contain a valid email address.",
      403,
    );
  }

  const memberSnapshot =
    await adminDb
      .collection("members")
      .where(
        "authUid",
        "==",
        decodedToken.uid,
      )
      .limit(2)
      .get();

  if (memberSnapshot.empty) {
    return unauthorizedResponse(
      "No FRDA membership account is linked to this login.",
      403,
    );
  }

  if (
    memberSnapshot.size !== 1
  ) {
    console.error(
      "Multiple member records found for Firebase UID:",
      decodedToken.uid,
    );

    return unauthorizedResponse(
      "This membership account could not be verified.",
      403,
    );
  }

  const memberDocument =
    memberSnapshot.docs[0];

  const memberData =
    memberDocument.data();

  const memberEmail =
    String(
      memberData.normalizedEmail ||
        memberData.email ||
        "",
    )
      .trim()
      .toLowerCase();

  if (
    !memberEmail ||
    memberEmail !== tokenEmail
  ) {
    console.error(
      "Member email mismatch:",
      {
        uid: decodedToken.uid,
        memberId:
          memberDocument.id,
      },
    );

    return unauthorizedResponse(
      "This membership account could not be verified.",
      403,
    );
  }

  const accountStatus =
    String(
      memberData.accountStatus ||
        "",
    );

  const memberStatus =
    String(
      memberData.memberStatus ||
        "",
    );

  const rawAccountPurpose =
    String(
      memberData.accountPurpose ||
        "developer",
    );

  const accountPurpose:
    AuthorizedMember["accountPurpose"] =
      rawAccountPurpose ===
        "talent_seeker" ||
      rawAccountPurpose === "both"
        ? rawAccountPurpose
        : "developer";

  if (
    accountStatus !== "active"
  ) {
    return unauthorizedResponse(
      "This FRDA membership account is not active.",
      403,
    );
  }

  if (
    memberStatus !== "active"
  ) {
    return unauthorizedResponse(
      "This FRDA membership is currently unavailable.",
      403,
    );
  }

  if (
    memberData.emailVerified !==
    true
  ) {
    await memberDocument.ref.set(
      {
        emailVerified: true,
        emailVerifiedAt:
          new Date(),
        updatedAt:
          new Date(),
      },
      { merge: true },
    );
  }

  return {
    ok: true,
    member: {
      uid: decodedToken.uid,
      memberId:
        memberDocument.id,
      email: memberEmail,
      displayName: String(
        memberData.displayName ||
          "",
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
          memberData
            .talentSeekerStatus,
          accountPurpose,
        ),
    },
    memberData,
  };
}