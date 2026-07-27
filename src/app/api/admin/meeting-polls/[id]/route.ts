import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";
import { getMeetingSlots, type MeetingSlot } from "@/lib/meetingPolls";

export const runtime = "nodejs";

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        serialize(item),
      ]),
    );
  }
  return value;
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
}

function formatTimeLabel(value: string) {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw || "0");
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const parsed = new Date();
  parsed.setHours(hour, minute, 0, 0);
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function postDiscordFinal({
  pollId,
  poll,
  finalSlot,
  actorEmail,
}: {
  pollId: string;
  poll: Record<string, unknown>;
  finalSlot: MeetingSlot;
  actorEmail: string;
}) {
  const existingMessageId =
    typeof poll.discordFinalAnnouncementMessageId === "string"
      ? poll.discordFinalAnnouncementMessageId.trim()
      : "";

  if (existingMessageId) {
    return { alreadyPosted: true, messageId: existingMessageId };
  }

  const token = process.env.DISCORD_SCHEDULER_BOT_TOKEN;
  const channelId = process.env.DISCORD_MEETING_CHANNEL_ID;
  const roleId = process.env.DISCORD_MEETING_ROLE_ID;

  if (!token || !channelId || !roleId) {
    throw new Error("Missing Discord scheduler environment variables.");
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `<@&${roleId}>`,
        allowed_mentions: { roles: [roleId], parse: [] },
        embeds: [
          {
            title: "📅 Final meeting schedule has been set",
            description: [
              `**${String(poll.title || "FRDA Staff Meeting")}**`,
              "",
              `**${formatDateLabel(finalSlot.date)} at ${formatTimeLabel(
                finalSlot.time,
              )}**`,
              "",
              "Please mark your calendars!",
            ].join("\n"),
            color: 3447003,
            footer: { text: "FRDA Scheduler" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || "Could not post to Discord.");
  }

  await adminDb.collection("meetingPolls").doc(pollId).set(
    {
      discordFinalAnnouncementMessageId: result?.id || "",
      discordFinalAnnouncementChannelId: channelId,
      discordFinalAnnouncementPostedAt: FieldValue.serverTimestamp(),
      discordFinalAnnouncementPostedBy: actorEmail,
    },
    { merge: true },
  );

  return { alreadyPosted: false, messageId: result?.id || "" };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeAdminRequest(request, undefined, true);
  if (!authorization.ok) return authorization.response;

  const { id } = await context.params;

  const pollSnapshot = await adminDb.collection("meetingPolls").doc(id).get();

  if (!pollSnapshot.exists) {
    return NextResponse.json(
      { ok: false, error: "This meeting poll could not be found." },
      { status: 404 },
    );
  }

  const responsesSnapshot = await adminDb
    .collection("meetingPollResponses")
    .where("pollId", "==", id)
    .get();

  return NextResponse.json(
    {
      ok: true,
      poll: {
        id: pollSnapshot.id,
        ...(serialize(pollSnapshot.data()) as Record<string, unknown>),
      },
      responses: responsesSnapshot.docs.map((document) => ({
        id: document.id,
        ...(serialize(document.data()) as Record<string, unknown>),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeAdminRequest(request, undefined, true);
  if (!authorization.ok) return authorization.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (body?.action !== "finalize") {
    return NextResponse.json(
      { ok: false, error: "The meeting-poll action is invalid." },
      { status: 400 },
    );
  }

  const finalSlotId =
    typeof body?.finalSlotId === "string" ? body.finalSlotId.trim() : "";

  if (!finalSlotId) {
    return NextResponse.json(
      { ok: false, error: "Choose a final meeting time." },
      { status: 400 },
    );
  }

  const pollReference = adminDb.collection("meetingPolls").doc(id);
  const pollSnapshot = await pollReference.get();

  if (!pollSnapshot.exists) {
    return NextResponse.json(
      { ok: false, error: "This meeting poll could not be found." },
      { status: 404 },
    );
  }

  const poll = pollSnapshot.data() || {};
  const slots = getMeetingSlots({
    slots: Array.isArray(poll.slots) ? poll.slots : undefined,
    dateOptions: Array.isArray(poll.dateOptions) ? poll.dateOptions : undefined,
    timeOptions: Array.isArray(poll.timeOptions) ? poll.timeOptions : undefined,
  });

  const finalSlot = slots.find((slot) => slot.id === finalSlotId);

  if (!finalSlot) {
    return NextResponse.json(
      { ok: false, error: "The selected meeting time is not part of this poll." },
      { status: 400 },
    );
  }

  if (String(poll.status || "open") === "cancelled") {
    return NextResponse.json(
      { ok: false, error: "A cancelled poll cannot be finalized." },
      { status: 400 },
    );
  }

  await pollReference.set(
    {
      status: "finalized",
      finalSlotId,
      finalizedByUid: authorization.staff.uid,
      finalizedByEmail: authorization.staff.emailAddress,
      finalizedByName: authorization.staff.displayName,
      finalizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  try {
    const discord = await postDiscordFinal({
      pollId: id,
      poll,
      finalSlot,
      actorEmail: authorization.staff.emailAddress,
    });

    return NextResponse.json({
      ok: true,
      finalSlotId,
      discordPosted: true,
      alreadyPosted: discord.alreadyPosted,
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      finalSlotId,
      discordPosted: false,
      warning:
        error instanceof Error
          ? error.message
          : "The meeting was finalized, but Discord could not be notified.",
    });
  }
}