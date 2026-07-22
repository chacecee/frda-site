import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { findValidMembershipInvitation } from "@/lib/server/membershipInvites";
import { createDiscordMemberInvite } from "@/lib/server/discordMemberInvites";

export const runtime = "nodejs";

function isValidPassword(value: string): boolean {
  return value.length >= 8;
}

function getInitialTalentSeekerStatus(
  accountPurpose: string,
): "not_required" | "not_submitted" {
  return accountPurpose === "talent_seeker" ||
    accountPurpose === "both"
    ? "not_submitted"
    : "not_required";
}

export async function POST(request: NextRequest) {
  let createdUid = "";

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          token?: unknown;
          password?: unknown;
          displayName?: unknown;
        }
      | null;

    const token =
      typeof body?.token === "string"
        ? body.token.trim()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    const requestedDisplayName =
      typeof body?.displayName === "string"
        ? body.displayName.trim()
        : "";

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing membership invitation token.",
        },
        { status: 400 },
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your password must contain at least eight characters.",
        },
        { status: 400 },
      );
    }

    const validInvitation =
      await findValidMembershipInvitation(token);

    const invitation = validInvitation.data;

    const email = String(invitation.email || "")
      .trim()
      .toLowerCase();

    const memberId = String(
      invitation.memberId || "",
    ).trim();

    const accountPurpose = String(
      invitation.accountPurpose || "developer",
    );

    const displayName =
      requestedDisplayName ||
      String(invitation.displayName || "").trim();

    if (!email || !memberId || !displayName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This invitation is missing required membership information.",
        },
        { status: 400 },
      );
    }

    const memberReference = adminDb
      .collection("members")
      .doc(memberId);

    const memberSnapshot =
      await memberReference.get();

    if (!memberSnapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The permanent member record could not be found.",
        },
        { status: 404 },
      );
    }

    const existingMember =
      memberSnapshot.data() || {};

    if (
      typeof existingMember.authUid === "string" &&
      existingMember.authUid
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This member already has an activated account.",
        },
        { status: 409 },
      );
    }

    try {
      const existingUser =
        await adminAuth.getUserByEmail(email);

      if (existingUser) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "An account already exists for this email address. Please contact FRDA for assistance.",
          },
          { status: 409 },
        );
      }
    } catch (error: unknown) {
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String(
              (error as { code?: unknown }).code || "",
            )
          : "";

      if (errorCode !== "auth/user-not-found") {
        throw error;
      }
    }

    const createdUser = await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });

    createdUid = createdUser.uid;

    await adminDb.runTransaction(
      async (transaction) => {
        const freshInviteSnapshot =
          await transaction.get(
            validInvitation.reference,
          );

        const freshMemberSnapshot =
          await transaction.get(memberReference);

        if (!freshInviteSnapshot.exists) {
          throw new Error(
            "The membership invitation no longer exists.",
          );
        }

        if (!freshMemberSnapshot.exists) {
          throw new Error(
            "The permanent member record no longer exists.",
          );
        }

        const freshInvite =
          freshInviteSnapshot.data() || {};

        if (
          String(freshInvite.status || "") !==
          "pending"
        ) {
          throw new Error(
            "This membership invitation can no longer be used.",
          );
        }

        const expiresAt = freshInvite.expiresAt;

        if (
          !expiresAt ||
          typeof expiresAt.toDate !== "function" ||
          expiresAt.toDate().getTime() <= Date.now()
        ) {
          throw new Error(
            "This membership invitation has expired.",
          );
        }

        const freshMember =
          freshMemberSnapshot.data() || {};

        if (
          typeof freshMember.authUid === "string" &&
          freshMember.authUid
        ) {
          throw new Error(
            "This member already has an activated account.",
          );
        }

        transaction.update(
          validInvitation.reference,
          {
            status: "claimed",
            claimedAt:
              FieldValue.serverTimestamp(),
            claimedByUid: createdUser.uid,
            claimedEmail: email,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        transaction.set(
          memberReference,
          {
            displayName,
            accountPurpose,

            authUid: createdUser.uid,
            accountStatus: "active",
            emailVerified: true,
            activatedAt:
              FieldValue.serverTimestamp(),

            profileStatus:
              accountPurpose === "developer" ||
              accountPurpose === "both"
                ? "draft"
                : "not_applicable",

            talentSeekerStatus:
              typeof freshMember.talentSeekerStatus ===
                "string"
                ? freshMember.talentSeekerStatus
                : getInitialTalentSeekerStatus(
                    accountPurpose,
                  ),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        if (
          accountPurpose === "developer" ||
          accountPurpose === "both"
        ) {
          const profileReference = adminDb
            .collection("developerProfiles")
            .doc(createdUser.uid);

          transaction.set(
            profileReference,
            {
              uid: createdUser.uid,
              memberId,
              email,
              displayName,

              bio: "",
              avatarUrl: "",
              profileSlug: "",
              skills: [],
              availability: "",

              featuredExperiences: [],
              portfolioItems: [],

              profileStatus: "draft",
              isPublished: false,

              createdAt:
                FieldValue.serverTimestamp(),
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      },
    );

    let discordInvite:
      | {
          code: string;
          inviteUrl: string;
          expiresAt: string;
        }
      | null = null;

    let discordInviteError = "";

    try {
      discordInvite =
        await createDiscordMemberInvite({
          memberId,
          authUid: createdUser.uid,
        });
    } catch (error) {
      console.error(
        "Discord member invite error:",
        error,
      );

      discordInviteError =
        error instanceof Error
          ? error.message
          : "Could not generate the Discord invitation.";

      await memberReference.set(
        {
          discordInviteError:
            discordInviteError.slice(0, 500),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return NextResponse.json({
      ok: true,
      account: {
        uid: createdUser.uid,
        email,
        displayName,
        memberId,
        accountPurpose,
      },
      discordInvite,
      discordInviteError,
      message:
        "Your FRDA membership account has been activated.",
    });
  } catch (error) {
    console.error(
      "Membership account activation error:",
      error,
    );

    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
      } catch (deleteError) {
        console.error(
          "Could not roll back Firebase user:",
          deleteError,
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not activate your FRDA membership account.",
      },
      { status: 500 },
    );
  }
}
