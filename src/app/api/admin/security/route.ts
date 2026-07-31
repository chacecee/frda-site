import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authorizeAdminRequest,
} from "@/lib/server/adminAuthorization";
import {
  SECURITY_CONNECTIONS_COLLECTION,
  SECURITY_EVENTS_COLLECTION,
  recordSecurityEvent,
} from "@/lib/server/securitySignals";

export const runtime = "nodejs";

function timestampToIso(
  value: unknown,
): string | null {
  if (
    value instanceof Timestamp
  ) {
    return value
      .toDate()
      .toISOString();
  }

  return null;
}

function serializeConnection(
  document:
    FirebaseFirestore.QueryDocumentSnapshot,
  membersById:
    Map<
      string,
      FirebaseFirestore.DocumentData
    >,
) {
  const data =
    document.data();

  const memberIds =
    Array.isArray(
      data.memberIds,
    )
      ? data.memberIds.filter(
          (
            value: unknown,
          ): value is string =>
            typeof value ===
            "string",
        )
      : [];

  return {
    fingerprint:
      document.id,
    label:
      String(
        data.connectionLabel ||
        document.id
          .slice(0, 10)
          .toUpperCase(),
      ),
    accountCount:
      memberIds.length,
    suspendedAccountCount:
      typeof data.suspendedAccountCount ===
      "number"
        ? data.suspendedAccountCount
        : 0,
    watched:
      data.watched === true,
    permanentBlock:
      data.permanentBlock === true,
    blockedUntil:
      timestampToIso(
        data.blockedUntil,
      ),
    blockReason:
      String(
        data.blockReason || "",
      ),
    riskLevel:
      String(
        data.riskLevel || "none",
      ),
    lastRegistrationAt:
      timestampToIso(
        data.lastRegistrationAt,
      ),
    lastActivityAt:
      timestampToIso(
        data.lastActivityAt,
      ),
    members:
      memberIds.map(
        (memberId) => {
          const member =
            membersById.get(
              memberId,
            ) || {};

          return {
            memberId,
            authUid:
              String(
                member.authUid ||
                "",
              ),
            email:
              String(
                member.email ||
                "",
              ),
            displayName:
              String(
                member.displayName ||
                "",
              ),
            accountStatus:
              String(
                member.accountStatus ||
                "",
              ),
            memberStatus:
              String(
                member.memberStatus ||
                "",
              ),
            profileStatus:
              String(
                member.profileStatus ||
                "",
              ),
          };
        },
      ),
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request,
        undefined,
        true,
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const [
      connectionsSnapshot,
      eventsSnapshot,
      membersSnapshot,
    ] = await Promise.all([
      adminDb
        .collection(
          SECURITY_CONNECTIONS_COLLECTION,
        )
        .orderBy(
          "lastActivityAt",
          "desc",
        )
        .limit(200)
        .get(),

      adminDb
        .collection(
          SECURITY_EVENTS_COLLECTION,
        )
        .orderBy(
          "createdAt",
          "desc",
        )
        .limit(200)
        .get(),

      adminDb
        .collection("members")
        .get(),
    ]);

    const membersById =
      new Map<
        string,
        FirebaseFirestore.DocumentData
      >();

    membersSnapshot.docs.forEach(
      (document) => {
        membersById.set(
          document.id,
          document.data(),
        );
      },
    );

    const connections =
      connectionsSnapshot.docs.map(
        (document) =>
          serializeConnection(
            document,
            membersById,
          ),
      );

    const events =
      eventsSnapshot.docs.map(
        (document) => {
          const data =
            document.data();

          return {
            id:
              document.id,
            eventType:
              String(
                data.eventType ||
                "",
              ),
            connectionFingerprint:
              String(
                data.connectionFingerprint ||
                "",
              ),
            connectionLabel:
              String(
                data.connectionLabel ||
                "",
              ),
            memberId:
              String(
                data.memberId ||
                "",
              ),
            authUid:
              String(
                data.authUid ||
                "",
              ),
            displayName:
              String(
                data.displayName ||
                "",
              ),
            outcome:
              String(
                data.outcome ||
                "",
              ),
            details:
              typeof data.details ===
                "object" &&
              data.details !== null
                ? data.details
                : {},
            createdAt:
              timestampToIso(
                data.createdAt,
              ),
          };
        },
      );

    return NextResponse.json({
      ok: true,
      connections,
      events,
    });
  } catch (error) {
    console.error(
      "Load security console error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load security signals.",
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
      await authorizeAdminRequest(
        request,
        undefined,
        true,
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const body =
      await request
        .json()
        .catch(() => null) as
      | {
          fingerprint?: unknown;
          action?: unknown;
          reason?: unknown;
        }
      | null;

    const fingerprint =
      typeof body?.fingerprint ===
      "string"
        ? body.fingerprint.trim()
        : "";

    const action =
      typeof body?.action ===
      "string"
        ? body.action.trim()
        : "";

    const reason =
      typeof body?.reason ===
      "string"
        ? body.reason
            .trim()
            .slice(0, 1000)
        : "";

    if (!fingerprint) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A connection fingerprint is required.",
        },
        { status: 400 },
      );
    }

    const allowedActions = [
      "watch",
      "unwatch",
      "block_24h",
      "block_7d",
      "block_permanent",
      "unblock",
    ];

    if (
      !allowedActions.includes(
        action,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid security action is required.",
        },
        { status: 400 },
      );
    }

    if (
      (
        action === "watch" ||
        action.startsWith(
          "block_",
        )
      ) &&
      !reason
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add an internal reason for this action.",
        },
        { status: 400 },
      );
    }

    const reference =
      adminDb
        .collection(
          SECURITY_CONNECTIONS_COLLECTION,
        )
        .doc(fingerprint);

    const snapshot =
      await reference.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This connection record no longer exists.",
        },
        { status: 404 },
      );
    }

    const currentData =
      snapshot.data() || {};

    const accountCount =
      typeof currentData.accountCount ===
      "number"
        ? currentData.accountCount
        : Array.isArray(
            currentData.memberIds,
          )
          ? currentData.memberIds.length
          : 0;

    const suspendedAccountCount =
      typeof currentData.suspendedAccountCount ===
      "number"
        ? currentData.suspendedAccountCount
        : 0;

    function calculateRiskLevel(
      watched: boolean,
    ) {
      if (
        watched ||
        suspendedAccountCount > 0
      ) {
        return "high";
      }

      if (
        accountCount >= 5
      ) {
        return "high";
      }

      if (
        accountCount >= 3
      ) {
        return "watch";
      }

      if (
        accountCount >= 2
      ) {
        return "low";
      }

      return "none";
    }

    const now =
      Timestamp.now();

    const updates:
      Record<
        string,
        unknown
      > = {
        updatedAt:
          FieldValue.serverTimestamp(),
        lastActivityAt:
          FieldValue.serverTimestamp(),
        lastSecurityActionByUid:
          authorization.staff.uid,
        lastSecurityActionByEmail:
          authorization.staff
            .emailAddress,
        lastSecurityActionByName:
          authorization.staff
            .displayName ||
          authorization.staff
            .emailAddress,
      };

    let eventType:
      | "connection_watched"
      | "connection_unwatched"
      | "connection_blocked"
      | "connection_unblocked";

    if (action === "watch") {
      updates.watched = true;
      updates.riskLevel =
        calculateRiskLevel(true);
      updates.watchReason =
        reason;
      updates.watchedAt =
        FieldValue.serverTimestamp();
      eventType =
        "connection_watched";
    } else if (
      action === "unwatch"
    ) {
      updates.watched = false;
      updates.riskLevel =
        calculateRiskLevel(false);
      updates.watchReason =
        FieldValue.delete();
      updates.watchedAt =
        FieldValue.delete();
      eventType =
        "connection_unwatched";
    } else if (
      action === "block_24h"
    ) {
      updates.permanentBlock =
        false;
      updates.blockedUntil =
        Timestamp.fromMillis(
          now.toMillis() +
          24 * 60 * 60 * 1000,
        );
      updates.blockReason =
        reason;
      eventType =
        "connection_blocked";
    } else if (
      action === "block_7d"
    ) {
      updates.permanentBlock =
        false;
      updates.blockedUntil =
        Timestamp.fromMillis(
          now.toMillis() +
          7 *
            24 *
            60 *
            60 *
            1000,
        );
      updates.blockReason =
        reason;
      eventType =
        "connection_blocked";
    } else if (
      action ===
      "block_permanent"
    ) {
      updates.permanentBlock =
        true;
      updates.blockedUntil =
        FieldValue.delete();
      updates.blockReason =
        reason;
      eventType =
        "connection_blocked";
    } else {
      updates.permanentBlock =
        false;
      updates.blockedUntil =
        FieldValue.delete();
      updates.blockReason =
        FieldValue.delete();
      eventType =
        "connection_unblocked";
    }

    await reference.set(
      updates,
      { merge: true },
    );

    await recordSecurityEvent({
      eventType,
      connectionFingerprint:
        fingerprint,
      outcome: "observed",
      details: {
        action,
        reason,
        staffId:
          authorization.staff.id,
        staffEmail:
          authorization.staff
            .emailAddress,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        action === "watch"
          ? "Connection added to the watch list."
          : action === "unwatch"
            ? "Connection removed from the watch list."
            : action === "unblock"
              ? "Connection block removed."
              : "Connection signup block applied.",
    });
  } catch (error) {
    console.error(
      "Update security connection error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not update this security connection.",
      },
      { status: 500 },
    );
  }
}