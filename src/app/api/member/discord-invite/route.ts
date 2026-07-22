import {
  NextRequest,
  NextResponse,
} from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";
import { createDiscordMemberInvite } from "@/lib/server/discordMemberInvites";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const {
      member,
      memberData,
    } = authorization;

    const existingUrl =
      String(
        memberData.discordInviteUrl || "",
      );

    const existingExpiresAt =
      memberData.discordInviteExpiresAt;

    if (
      existingUrl &&
      existingExpiresAt instanceof Timestamp &&
      existingExpiresAt.toMillis() >
        Date.now() + 60_000
    ) {
      return NextResponse.json({
        ok: true,
        invite: {
          inviteUrl: existingUrl,
          expiresAt:
            existingExpiresAt
              .toDate()
              .toISOString(),
        },
        reused: true,
      });
    }

    const invite =
      await createDiscordMemberInvite({
        memberId: member.memberId,
        authUid: member.uid,
      });

    return NextResponse.json({
      ok: true,
      invite,
      reused: false,
      message:
        "A new Discord invitation was generated.",
    });
  } catch (error) {
    console.error(
      "Generate member Discord invite error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not generate a Discord invitation.",
      },
      { status: 500 },
    );
  }
}