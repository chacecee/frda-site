import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";
import {
  createMembershipInvitation,
  listMembershipInvitations,
  resendMembershipInvitation,
  revokeMembershipInvitation,
  type MembershipAccountPurpose,
} from "@/lib/server/membershipInvites";

export const runtime = "nodejs";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAccountPurpose(
  value: unknown
): value is MembershipAccountPurpose {
  return (
    value === "developer" ||
    value === "talent_seeker" ||
    value === "both"
  );
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      "membership_invitations"
    );

    if (!authorization.ok) {
      return authorization.response;
    }

    const invitations = await listMembershipInvitations();

    return NextResponse.json({
      ok: true,
      invitations,
    });
  } catch (error) {
    console.error("Load membership invitations error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load membership invitations.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      "membership_invitations"
    );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body = (await request.json().catch(() => null)) as
      | {
          email?: unknown;
          displayName?: unknown;
          accountPurpose?: unknown;
          memberId?: unknown;
          sourceApplicationId?: unknown;
        }
      | null;

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const displayName =
      typeof body?.displayName === "string"
        ? body.displayName.trim()
        : "";

    const memberId =
      typeof body?.memberId === "string"
        ? body.memberId.trim()
        : "";

    const sourceApplicationId =
      typeof body?.sourceApplicationId === "string"
        ? body.sourceApplicationId.trim()
        : "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid email address is required.",
        },
        { status: 400 }
      );
    }

    if (!displayName) {
      return NextResponse.json(
        {
          ok: false,
          error: "A display name is required.",
        },
        { status: 400 }
      );
    }

    if (!isAccountPurpose(body?.accountPurpose)) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid account purpose is required.",
        },
        { status: 400 }
      );
    }

    const invitation = await createMembershipInvitation({
      email,
      displayName,
      accountPurpose: body.accountPurpose,
      memberId,
      sourceApplicationId,
      staff: authorization.staff,
    });

    return NextResponse.json({
      ok: true,
      invitation,
      message: "Membership invitation sent successfully.",
    });
  } catch (error) {
    console.error("Create membership invitation error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not create the membership invitation.";

    const status = message.includes("already has an active")
      ? 409
      : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      "membership_invitations"
    );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body = (await request.json().catch(() => null)) as
      | {
          inviteId?: unknown;
          action?: unknown;
        }
      | null;

    const inviteId =
      typeof body?.inviteId === "string"
        ? body.inviteId.trim()
        : "";

    const action =
      typeof body?.action === "string"
        ? body.action.trim()
        : "";

    if (!inviteId) {
      return NextResponse.json(
        {
          ok: false,
          error: "A membership invitation ID is required.",
        },
        { status: 400 }
      );
    }

    if (action === "resend") {
      const invitation = await resendMembershipInvitation({
        inviteId,
        staff: authorization.staff,
      });

      return NextResponse.json({
        ok: true,
        invitation,
        message: "Membership invitation resent successfully.",
      });
    }

    if (action === "revoke") {
      const invitation = await revokeMembershipInvitation({
        inviteId,
        staff: authorization.staff,
      });

      return NextResponse.json({
        ok: true,
        invitation,
        message: "Membership invitation revoked successfully.",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "A valid invitation action is required.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Update membership invitation error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update the membership invitation.",
      },
      { status: 500 }
    );
  }
}