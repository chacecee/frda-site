import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type MeetingSlot = {
  id: string;
  date: string;
  time: string;
};

type InvitedMember = {
  discordUserId: string;
  displayName: string;
};

function isExpired(value: any) {
  if (!value || typeof value.toDate !== "function") return false;
  return value.toDate().getTime() < Date.now();
}

function createSlotId(date: string, time: string) {
  return `${date}__${time}`;
}

function buildFallbackSlots(dateOptions?: string[], timeOptions?: string[]) {
  const slots: MeetingSlot[] = [];

  (dateOptions || []).forEach((date) => {
    (timeOptions || []).forEach((time) => {
      slots.push({
        id: createSlotId(date, time),
        date,
        time,
      });
    });
  });

  return slots;
}

function formatDeadline(value: any) {
  if (!value || typeof value.toDate !== "function") return "—";

  return value.toDate().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMemberNames(members: InvitedMember[]) {
  if (members.length === 0) return "None";
  return members.map((member) => member.displayName).join(", ");
}

async function updateDiscordAvailabilityMessage(pollId: string) {
  const token = process.env.DISCORD_SCHEDULER_BOT_TOKEN;
  const roleId = process.env.DISCORD_MEETING_ROLE_ID;

  if (!token || !roleId) {
    console.warn("Skipping Discord update: missing scheduler token or role ID.");
    return;
  }

  const pollDoc = await adminDb.collection("meetingPolls").doc(pollId).get();

  if (!pollDoc.exists) {
    console.warn("Skipping Discord update: meeting poll not found.");
    return;
  }

  const poll = pollDoc.data() || {};

  const channelId =
    poll.discordAvailabilityAnnouncementChannelId ||
    poll.discordMeetingChannelId ||
    process.env.DISCORD_MEETING_CHANNEL_ID;

  const messageId = poll.discordAvailabilityAnnouncementMessageId;

  if (!channelId || !messageId) {
    console.warn(
      "Skipping Discord update: missing original announcement channel/message ID."
    );
    return;
  }

  const invitedMembers: InvitedMember[] = Array.isArray(poll.invitedMembers)
    ? poll.invitedMembers
    : [];

  const responsesSnapshot = await adminDb
    .collection("meetingPollResponses")
    .where("pollId", "==", pollId)
    .get();

  const submittedIds = new Set<string>();

  responsesSnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.discordUserId) {
      submittedIds.add(data.discordUserId);
    }
  });

  const submittedMembers = invitedMembers.filter((member) =>
    submittedIds.has(member.discordUserId)
  );

  const waitingMembers = invitedMembers.filter(
    (member) => !submittedIds.has(member.discordUserId)
  );

  const participantCount = invitedMembers.length;
  const submittedCount = submittedMembers.length;

  const discordResponse = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `<@&${roleId}>`,
        allowed_mentions: {
          roles: [roleId],
          parse: [],
        },
        embeds: [
          {
            title: "📅 FRDA is checking meeting availability",
            description: [
              `**${poll.title || "FRDA Staff Meeting"}**`,
              poll.description ? `\n${poll.description}` : "",
              "",
              "Please expect a DM from **FRDA Scheduler** shortly with your private availability form.",
              "",
              `**Response deadline:** ${formatDeadline(poll.deadline)}`,
              "",
              "**Availability status:**",
              `${submittedCount}/${participantCount} submitted`,
              "",
              "**Submitted:**",
              getMemberNames(submittedMembers),
              "",
              "**Waiting:**",
              getMemberNames(waitingMembers),
            ].join("\n"),
            color: 3447003,
            footer: {
              text: "FRDA Scheduler",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    }
  );

  const discordResult = await discordResponse.json().catch(() => null);

  if (!discordResponse.ok) {
    console.error("Discord availability message update failed:", discordResult);
    return;
  }

  await adminDb.collection("meetingPolls").doc(pollId).set(
    {
      discordAvailabilityLastUpdatedAt: new Date(),
      discordAvailabilitySubmittedCount: submittedCount,
      discordAvailabilityWaitingCount: waitingMembers.length,
    },
    { merge: true }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const token = typeof body.token === "string" ? body.token.trim() : "";
    const availability =
      body.availability && typeof body.availability === "object"
        ? body.availability
        : null;

    if (!id || !token || !availability) {
      return NextResponse.json(
        { error: "Missing required submission details." },
        { status: 400 }
      );
    }

    const tokenSnapshot = await adminDb
      .collection("meetingPollTokens")
      .where("pollId", "==", id)
      .where("token", "==", token)
      .limit(1)
      .get();

    if (tokenSnapshot.empty) {
      return NextResponse.json(
        { error: "This availability link is invalid." },
        { status: 403 }
      );
    }

    const tokenData = tokenSnapshot.docs[0].data();

    if (isExpired(tokenData.expiresAt)) {
      return NextResponse.json(
        { error: "This availability link has expired." },
        { status: 403 }
      );
    }

    const pollRef = adminDb.collection("meetingPolls").doc(id);
    const pollDoc = await pollRef.get();

    if (!pollDoc.exists) {
      return NextResponse.json(
        { error: "This meeting poll no longer exists." },
        { status: 404 }
      );
    }

    const pollData = pollDoc.data() || {};

    if ((pollData.status || "open") !== "open") {
      return NextResponse.json(
        { error: "This meeting poll is no longer accepting responses." },
        { status: 403 }
      );
    }

    if (isExpired(pollData.deadline)) {
      return NextResponse.json(
        { error: "The response deadline has already passed." },
        { status: 403 }
      );
    }

    const slots =
      Array.isArray(pollData.slots) && pollData.slots.length > 0
        ? pollData.slots
        : buildFallbackSlots(pollData.dateOptions, pollData.timeOptions);

    const allowedSlotIds = new Set(slots.map((slot: any) => slot.id));
    const cleanAvailability: Record<string, boolean> = {};

    Object.entries(availability).forEach(([slotId, value]) => {
      if (allowedSlotIds.has(slotId)) {
        cleanAvailability[slotId] = Boolean(value);
      }
    });

    const responseId = `${id}_${tokenData.discordUserId}`;
    const responseRef = adminDb
      .collection("meetingPollResponses")
      .doc(responseId);

    const existingResponse = await responseRef.get();
    const now = FieldValue.serverTimestamp();

    await responseRef.set(
      {
        pollId: id,
        discordUserId: tokenData.discordUserId,
        displayName: tokenData.displayName || "Member",
        availability: cleanAvailability,
        submittedAt: existingResponse.exists
          ? existingResponse.data()?.submittedAt || now
          : now,
        updatedAt: now,
      },
      { merge: true }
    );

    await pollRef.set(
      {
        submittedUserIds: FieldValue.arrayUnion(tokenData.discordUserId),
        updatedAt: now,
      },
      { merge: true }
    );

    await updateDiscordAvailabilityMessage(id);

    return NextResponse.json({
      ok: true,
      message: "Availability submitted.",
    });
  } catch (error) {
    console.error("Error submitting meeting availability:", error);

    return NextResponse.json(
      { error: "Could not submit your availability." },
      { status: 500 }
    );
  }
}