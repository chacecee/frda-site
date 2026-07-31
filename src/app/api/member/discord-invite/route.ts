import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  authorizeMemberRequest,
} from "@/lib/server/memberAuthorization";

import {
  adminDb,
} from "@/lib/firebaseAdmin";

import {
  createDiscordMemberInvite,
} from "@/lib/server/discordMemberInvites";

export const runtime = "nodejs";

function errorResponse(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status },
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(
        request,
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const {
      member,
    } = authorization;

    if (
      member.accountPurpose !== "developer" &&
      member.accountPurpose !== "both"
    ) {
      return errorResponse(
        "Discord member access is available after a developer profile has been approved.",
        403,
      );
    }

    const memberReference =
      adminDb
        .collection("members")
        .doc(member.memberId);

    let existingInvite:
      | {
          inviteUrl: string;
          expiresAt: string;
        }
      | null = null;

    await adminDb.runTransaction(
      async (transaction) => {
        const snapshot =
          await transaction.get(
            memberReference,
          );

        if (!snapshot.exists) {
          throw new Error(
            "Your membership record could not be found.",
          );
        }

        const data =
          snapshot.data() || {};

        const hasBeenApprovedBefore =
          data.hasBeenApprovedBefore === true;

        if (!hasBeenApprovedBefore) {
          throw new Error(
            "Your developer profile must be approved by FRDA before you can receive a Discord invitation.",
          );
        }

        const existingUrl =
          String(
            data.discordInviteUrl || "",
          );

        const existingExpiresAt =
          data.discordInviteExpiresAt;

        const generatedOnce =
          data.discordInviteGeneratedOnce === true ||
          Boolean(
            data.discordInviteCode ||
            data.discordInviteCreatedAt,
          );

        if (generatedOnce) {
          if (
            existingUrl &&
            existingExpiresAt instanceof Timestamp &&
            existingExpiresAt.toMillis() >
              Date.now() + 60_000
          ) {
            existingInvite = {
              inviteUrl:
                existingUrl,
              expiresAt:
                existingExpiresAt
                  .toDate()
                  .toISOString(),
            };

            return;
          }

          throw new Error(
            "Your original Discord invitation is no longer active. Email official@frdaph.org if you need a replacement.",
          );
        }

        if (
          data.discordInviteGenerationStatus ===
          "creating"
        ) {
          throw new Error(
            "Your Discord invitation is already being generated. Refresh the page in a moment.",
          );
        }

        transaction.set(
          memberReference,
          {
            discordInviteGenerationStatus:
              "creating",

            discordInviteGenerationStartedAt:
              FieldValue.serverTimestamp(),

            discordInviteError:
              "",

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      },
    );

    if (existingInvite) {
      return NextResponse.json({
        ok: true,
        invite:
          existingInvite,
        reused: true,
        message:
          "Your active Discord invitation is ready.",
      });
    }

    try {
      const invite =
        await createDiscordMemberInvite({
          memberId:
            member.memberId,
          authUid:
            member.uid,
        });

      return NextResponse.json({
        ok: true,
        invite,
        reused: false,
        message:
          "Your one-time Discord invitation was generated.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not generate a Discord invitation.";

      await memberReference.set(
        {
          discordInviteGenerationStatus:
            "failed",

          discordInviteError:
            message,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      throw error;
    }
  } catch (error) {
    console.error(
      "Generate member Discord invite error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Could not generate a Discord invitation.";

    const status =
      message.includes(
        "must be approved",
      ) ||
      message.includes(
        "available after",
      )
        ? 403
        : message.includes(
            "original Discord invitation",
          ) ||
          message.includes(
            "already being generated",
          )
          ? 409
          : message.includes(
              "could not be found",
            )
            ? 404
            : 500;

    return errorResponse(
      message,
      status,
    );
  }
}