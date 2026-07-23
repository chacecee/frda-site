import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/lib/firebaseAdmin";

const INVITE_MAX_AGE_SECONDS =
  60 * 60 * 24 * 30;

const INVITE_MAX_USES = 1;

type DiscordInviteResponse = {
  code?: string;
};

export type DiscordMemberInvite = {
  code: string;
  inviteUrl: string;
  expiresAt: string;
};

export async function createDiscordMemberInvite({
  memberId,
  authUid,
}: {
  memberId: string;
  authUid: string;
}): Promise<DiscordMemberInvite> {
  const botToken =
    process.env
      .DISCORD_BOT_TOKEN
      ?.trim();

  const channelId =
    process.env
      .DISCORD_MEMBER_INVITE_CHANNEL_ID
      ?.trim();

  const memberRoleId =
    process.env
      .DISCORD_MEMBER_ROLE_ID
      ?.trim();

  if (!botToken) {
    throw new Error(
      "Missing DISCORD_BOT_TOKEN.",
    );
  }

  if (!channelId) {
    throw new Error(
      "Missing DISCORD_MEMBER_INVITE_CHANNEL_ID.",
    );
  }

  if (!memberRoleId) {
    throw new Error(
      "Missing DISCORD_MEMBER_ROLE_ID.",
    );
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/invites`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bot ${botToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        max_age:
          INVITE_MAX_AGE_SECONDS,
        max_uses:
          INVITE_MAX_USES,
        temporary: false,
        unique: true,
        role_ids: [
          memberRoleId,
        ],
      }),
      cache: "no-store",
    },
  );

  const responseText =
    await response.text();

  let result:
    | DiscordInviteResponse
    | string
    | null = null;

  try {
    result = responseText
      ? JSON.parse(
          responseText,
        ) as DiscordInviteResponse
      : null;
  } catch {
    result = responseText;
  }

  if (
    !response.ok ||
    typeof result !== "object" ||
    result === null ||
    !result.code
  ) {
    console.error(
      "FRDA Member Discord invite creation failed:",
      {
        status:
          response.status,
        statusText:
          response.statusText,
        response:
          result,
        channelId,
        memberRoleId,
      },
    );

    throw new Error(
      `Discord returned ${response.status} ${response.statusText}.`,
    );
  }

  const expiresAtDate =
    new Date(
      Date.now() +
        INVITE_MAX_AGE_SECONDS *
          1000,
    );

  const inviteUrl =
    `https://discord.gg/${result.code}`;

  await adminDb
    .collection("members")
    .doc(memberId)
    .set(
      {
        discordInviteCode:
          result.code,
        discordInviteUrl:
          inviteUrl,
        discordInviteCreatedAt:
          FieldValue
            .serverTimestamp(),
        discordInviteExpiresAt:
          Timestamp.fromDate(
            expiresAtDate,
          ),
        discordInviteMaxUses:
          INVITE_MAX_USES,
        discordInviteGeneratedForUid:
          authUid,
        updatedAt:
          FieldValue
            .serverTimestamp(),
      },
      { merge: true },
    );

  return {
    code: result.code,
    inviteUrl,
    expiresAt:
      expiresAtDate
        .toISOString(),
  };
}