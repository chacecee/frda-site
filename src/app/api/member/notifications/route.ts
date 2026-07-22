import { NextRequest, NextResponse } from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";

export const runtime = "nodejs";

function timestampToIso(
  value: unknown,
): string | null {
  if (
    value instanceof Timestamp ||
    (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    )
  ) {
    return (value as { toDate: () => Date })
      .toDate()
      .toISOString();
  }

  return null;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } = authorization;

    const snapshot =
      await adminDb
        .collection("memberNotifications")
        .where("memberId", "==", member.memberId)
        .get();

    const notifications =
      snapshot.docs
        .map((document) => {
          const data = document.data();

          return {
            notificationId: document.id,
            type: String(data.type || "general"),
            title: String(data.title || "Notification"),
            message: String(data.message || ""),
            href: String(data.href || ""),
            gameId: String(data.gameId || ""),
            gameTitle: String(data.gameTitle || ""),
            isUnread: data.isRead !== true,
            createdAt:
              timestampToIso(data.createdAt),
          };
        })
        .sort(
          (first, second) =>
            new Date(second.createdAt || 0).getTime() -
            new Date(first.createdAt || 0).getTime(),
        )
        .slice(0, 12);

    return NextResponse.json({
      ok: true,
      notifications,
    });
  } catch (error) {
    console.error(
      "Load member notifications error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your notifications.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } = authorization;
    const body =
      await request.json().catch(() => null);

    const notificationId =
      typeof body?.notificationId === "string"
        ? body.notificationId.trim()
        : "";

    if (!notificationId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A notification ID is required.",
        },
        { status: 400 },
      );
    }

    const reference =
      adminDb
        .collection("memberNotifications")
        .doc(notificationId);

    const snapshot =
      await reference.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error: "Notification not found.",
        },
        { status: 404 },
      );
    }

    if (
      String(snapshot.data()?.memberId || "") !==
      member.memberId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You cannot update this notification.",
        },
        { status: 403 },
      );
    }

    await reference.set(
      {
        isRead: true,
        readAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Mark member notification read error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not update this notification.",
      },
      { status: 500 },
    );
  }
}