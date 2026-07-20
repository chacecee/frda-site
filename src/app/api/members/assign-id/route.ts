import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";
import { ensureMemberForApplication } from "@/lib/server/members";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      "applications_developers"
    );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body = await request.json().catch(() => null);

    const applicationId =
      typeof body?.applicationId === "string"
        ? body.applicationId.trim()
        : "";

    if (!applicationId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing application ID.",
        },
        { status: 400 }
      );
    }

    const assignedMember = await ensureMemberForApplication({
      applicationId,
      actor: {
        uid: authorization.staff.uid,
        email: authorization.staff.emailAddress,
        staffId: authorization.staff.id,
        displayName:
          authorization.staff.displayName ||
          authorization.staff.emailAddress,
      },
    });

    return NextResponse.json({
      ok: true,
      ...assignedMember,
    });
  } catch (error) {
    console.error("Assign member ID error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not assign a member ID.",
      },
      { status: 500 }
    );
  }
}