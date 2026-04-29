import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

type MeetingSlot = {
  id: string;
  date: string;
  time: string;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function formatDateLabel(dateValue: string) {
  if (!dateValue) return "Date";

  const parsed = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return dateValue;

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(timeValue: string) {
  if (!timeValue) return "Time";

  const [hourRaw, minuteRaw] = timeValue.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw || "0");

  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeValue;

  const parsed = new Date();
  parsed.setHours(hour, minute, 0, 0);

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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

async function getAuthorizedAdminEmail(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return null;
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = normalizeEmail(decoded.email);

  if (!email) {
    return null;
  }

  const exactSnapshot = await adminDb
    .collection("staff")
    .where("emailAddress", "==", email)
    .limit(1)
    .get();

  if (!exactSnapshot.empty) {
    const role = normalizeEmail(exactSnapshot.docs[0].data().role);
    return role === "admin" ? email : null;
  }

  const allStaffSnapshot = await adminDb.collection("staff").get();

  const match = allStaffSnapshot.docs.find((docSnap) => {
    const data = docSnap.data() as { emailAddress?: string; role?: string };
    return normalizeEmail(data.emailAddress) === email;
  });

  if (!match) {
    return null;
  }

  const role = normalizeEmail(match.data().role);
  return role === "admin" ? email : null;
}

export async function POST(request: NextRequest) {
  try {
    const adminEmail = await getAuthorizedAdminEmail(request);

    if (!adminEmail) {
      return NextResponse.json(
        { error: "You are not authorized to post meeting announcements." },
        { status: 403 }
      );
    }

    const token = process.env.DISCORD_SCHEDULER_BOT_TOKEN;
    const channelId = process.env.DISCORD_MEETING_CHANNEL_ID;
    const roleId = process.env.DISCORD_MEETING_ROLE_ID;

    if (!token || !channelId || !roleId) {
      return NextResponse.json(
        { error: "Missing Discord scheduler environment variables." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const pollId = typeof body.pollId === "string" ? body.pollId.trim() : "";

    if (!pollId) {
      return NextResponse.json(
        { error: "Missing meeting poll ID." },
        { status: 400 }
      );
    }

    const pollRef = adminDb.collection("meetingPolls").doc(pollId);
    const pollDoc = await pollRef.get();

    if (!pollDoc.exists) {
      return NextResponse.json(
        { error: "Meeting poll not found." },
        { status: 404 }
      );
    }

    const poll = pollDoc.data() || {};

    if ((poll.status || "open") !== "finalized") {
      return NextResponse.json(
        { error: "Meeting poll is not finalized yet." },
        { status: 400 }
      );
    }

    const finalSlotId = poll.finalSlotId || "";

    if (!finalSlotId) {
      return NextResponse.json(
        { error: "Meeting poll has no final slot selected." },
        { status: 400 }
      );
    }

    if (poll.discordFinalAnnouncementMessageId) {
      return NextResponse.json({
        ok: true,
        alreadyPosted: true,
        messageId: poll.discordFinalAnnouncementMessageId,
      });
    }

    const slots =
      Array.isArray(poll.slots) && poll.slots.length > 0
        ? (poll.slots as MeetingSlot[])
        : buildFallbackSlots(poll.dateOptions, poll.timeOptions);

    const finalSlot = slots.find((slot) => slot.id === finalSlotId);

    if (!finalSlot) {
      return NextResponse.json(
        { error: "Final slot could not be found." },
        { status: 404 }
      );
    }

    const finalDate = formatDateLabel(finalSlot.date);
    const finalTime = formatTimeLabel(finalSlot.time);

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
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
              title: "📅 Final meeting schedule has been set",
              description: [
                `**${poll.title || "FRDA Staff Meeting"}**`,
                "",
                `**${finalDate} at ${finalTime}**`,
                "",
                "Please mark your calendars!",
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
      console.error("Discord finalized meeting post failed:", discordResult);

      return NextResponse.json(
        {
          error: discordResult?.message || "Could not post to Discord.",
          discordResult,
        },
        { status: 500 }
      );
    }

    await pollRef.set(
      {
        discordFinalAnnouncementMessageId: discordResult?.id || "",
        discordFinalAnnouncementChannelId: channelId,
        discordFinalAnnouncementPostedAt: new Date(),
        discordFinalAnnouncementPostedBy: adminEmail,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      messageId: discordResult?.id || "",
    });
  } catch (error) {
    console.error("Error posting finalized meeting to Discord:", error);

    return NextResponse.json(
      { error: "Could not post finalized meeting to Discord." },
      { status: 500 }
    );
  }
}