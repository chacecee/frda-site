import { NextRequest, NextResponse } from "next/server";
import { findValidMembershipInvitation } from "@/lib/server/membershipInvites";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token =
      request.nextUrl.searchParams.get("token")?.trim() ||
      "";

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing membership invitation token.",
        },
        { status: 400 }
      );
    }

    const invitation =
      await findValidMembershipInvitation(token);

    return NextResponse.json({
      ok: true,
      invitation: invitation.publicInvitation,
    });
  } catch (error) {
    console.error(
      "Membership invitation validation error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not validate this membership invitation.",
      },
      { status: 400 }
    );
  }
}