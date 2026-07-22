import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";
import {
  normalizeGameDirectoryStatus,
  type GameDirectoryStatus,
} from "@/lib/gameDirectory";

export const runtime = "nodejs";

function isAllowedStatus(
  value: unknown,
): value is GameDirectoryStatus {
  return (
    value === "for_approval" ||
    value === "published" ||
    value === "pending" ||
    value === "declined" ||
    value === "archived"
  );
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        "content_game_directory",
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body =
      await request.json().catch(() => null);

    const gameId =
      typeof body?.gameId === "string"
        ? body.gameId.trim()
        : "";

    const nextStatus =
      body?.nextStatus;

    if (!gameId || !isAllowedStatus(nextStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid game and review status are required.",
        },
        { status: 400 },
      );
    }

    const gameReference =
      adminDb
        .collection("gameDirectory")
        .doc(gameId);

    const gameSnapshot =
      await gameReference.get();

    if (!gameSnapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error: "Game listing not found.",
        },
        { status: 404 },
      );
    }

    const gameData =
      gameSnapshot.data() || {};

    const previousStatus =
      normalizeGameDirectoryStatus(
        gameData.status,
      );

    const title =
      String(
        gameData.title ||
        "Your submitted game",
      );

    const memberId =
      String(
        gameData.memberId ||
        gameData.submittedByMemberId ||
        "",
      );

    await gameReference.set(
      {
        status: nextStatus,
        isHiddenFromPublic:
          nextStatus !== "published",
        reviewedByUid:
          authorization.staff.uid,
        reviewedByName:
          authorization.staff.displayName ||
          "FRDA Staff",
        reviewedAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const shouldNotify =
      Boolean(memberId) &&
      nextStatus === "published" &&
      previousStatus !== "published";

    if (shouldNotify) {
      await adminDb
        .collection("memberNotifications")
        .add({
          memberId,
          type: "game_approved",
          title: `${title} was approved`,
          message:
            "Your game is now published in the FRDA Game Directory.",
          href:
            `/games?game=${encodeURIComponent(gameId)}`,
          gameId,
          gameTitle: title,
          isRead: false,
          createdAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        });
    }

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      notificationCreated:
        shouldNotify,
    });
  } catch (error) {
    console.error(
      "Update game review status error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update the game review status.",
      },
      { status: 500 },
    );
  }
}