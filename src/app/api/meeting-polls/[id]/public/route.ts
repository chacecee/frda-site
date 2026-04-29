import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

type MeetingSlot = {
  id: string;
  date: string;
  time: string;
};

function serializeTimestamp(value: any) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const token = request.nextUrl.searchParams.get("token")?.trim();

    if (!id || !token) {
      return NextResponse.json(
        { error: "Missing meeting poll or token." },
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

    const tokenDoc = tokenSnapshot.docs[0];
    const tokenData = tokenDoc.data();

    if (isExpired(tokenData.expiresAt)) {
      return NextResponse.json(
        { error: "This availability link has expired." },
        { status: 403 }
      );
    }

    const pollDoc = await adminDb.collection("meetingPolls").doc(id).get();

    if (!pollDoc.exists) {
      return NextResponse.json(
        { error: "This meeting poll no longer exists." },
        { status: 404 }
      );
    }

    const pollData = pollDoc.data() || {};

    if (pollData.status === "cancelled") {
      return NextResponse.json(
        { error: "This meeting poll has been cancelled." },
        { status: 403 }
      );
    }

    const responseId = `${id}_${tokenData.discordUserId}`;
    const responseDoc = await adminDb
      .collection("meetingPollResponses")
      .doc(responseId)
      .get();

    const responseData = responseDoc.exists ? responseDoc.data() || {} : null;

    const slots =
      Array.isArray(pollData.slots) && pollData.slots.length > 0
        ? pollData.slots
        : buildFallbackSlots(pollData.dateOptions, pollData.timeOptions);

    return NextResponse.json({
      poll: {
        id: pollDoc.id,
        title: pollData.title || "Untitled Meeting",
        description: pollData.description || "",
        timezone: pollData.timezone || "Asia/Manila",
        slots,
        deadline: serializeTimestamp(pollData.deadline),
        status: pollData.status || "open",
        finalSlotId: pollData.finalSlotId || null,
      },
      member: {
        discordUserId: tokenData.discordUserId,
        displayName: tokenData.displayName || "Member",
      },
      response: responseData
        ? {
            availability: responseData.availability || {},
            submittedAt: serializeTimestamp(responseData.submittedAt),
            updatedAt: serializeTimestamp(responseData.updatedAt),
          }
        : null,
    });
  } catch (error) {
    console.error("Error loading public meeting poll:", error);

    return NextResponse.json(
      { error: "Could not load this availability check." },
      { status: 500 }
    );
  }
}