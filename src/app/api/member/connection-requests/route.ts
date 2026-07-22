import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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
      typeof (value as { toDate?: unknown })
        .toDate === "function"
    )
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toISOString();
  }

  return null;
}

function isDeveloperPurpose(
  value: string,
): boolean {
  return (
    value === "developer" ||
    value === "both"
  );
}

function getTalentSeekerAvatar(
  data: FirebaseFirestore.DocumentData,
): string {
  const profile =
    typeof data.talentSeekerProfile === "object" &&
    data.talentSeekerProfile !== null
      ? data.talentSeekerProfile as
          Record<string, unknown>
      : {};

  return String(profile.avatarUrl || "");
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

    if (
      !isDeveloperPurpose(
        member.accountPurpose,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A developer account is required to view connection requests.",
        },
        { status: 403 },
      );
    }

    const snapshot = await adminDb
      .collection(
        "developerConnectionRequests",
      )
      .where(
        "developerMemberId",
        "==",
        member.memberId,
      )
      .get();

    const visibleStatuses =
      new Set([
        "pending_developer_response",
        "connected",
        "declined",
        "reported",
        "closed",
      ]);

    const visibleDocuments =
      snapshot.docs.filter((document) =>
        visibleStatuses.has(
          String(document.data().status || ""),
        ),
      );

    const requesterIds = Array.from(
      new Set(
        visibleDocuments
          .map((document) =>
            String(
              document.data()
                .requesterMemberId || "",
            ),
          )
          .filter(Boolean),
      ),
    );

    const requesterAvatarMap =
      new Map<string, string>();

    await Promise.all(
      requesterIds.map(async (memberId) => {
        const [
          memberSnapshot,
          developerProfileSnapshot,
        ] = await Promise.all([
          adminDb
            .collection("members")
            .doc(memberId)
            .get(),

          adminDb
            .collection("developerProfiles")
            .where(
              "memberId",
              "==",
              memberId,
            )
            .limit(1)
            .get(),
        ]);

        const talentSeekerAvatar =
          memberSnapshot.exists
            ? getTalentSeekerAvatar(
                memberSnapshot.data() || {},
              )
            : "";

        const developerAvatar =
          !developerProfileSnapshot.empty
            ? String(
                developerProfileSnapshot.docs[0]
                  .data().avatarUrl ||
                "",
              )
            : "";

        requesterAvatarMap.set(
          memberId,
          talentSeekerAvatar ||
          developerAvatar,
        );
      }),
    );

    const requests =
      visibleDocuments
        .map((document) => {
          const data = document.data();
          const requesterMemberId =
            String(
              data.requesterMemberId || "",
            );

          return {
            requestId: document.id,
            status: String(
              data.status ||
              "pending_developer_response",
            ),
            inquiryType: String(
              data.inquiryType || "",
            ),
            opportunityTitle: String(
              data.opportunityTitle || "",
            ),
            organizationName: String(
              data.requesterOrganizationName ||
              data.organizationName ||
              "",
            ),
            requesterDisplayName: String(
              data.requesterDisplayName || "",
            ),
            requesterAvatarUrl:
              String(
                data.requesterAvatarUrl || "",
              ) ||
              requesterAvatarMap.get(
                requesterMemberId,
              ) ||
              "",
            requesterContactEmail:
              String(data.status || "") ===
              "connected"
                ? String(
                    data.requesterContactEmail ||
                    "",
                  )
                : "",
            requesterRole: String(
              data.requesterRole || "",
            ),
            message: String(
              data.message || "",
            ),
            relevantUrl: String(
              data.relevantUrl || "",
            ),
            developerResponseNote: String(
              data.developerResponseNote || "",
            ),
            developerViewedAt:
              timestampToIso(
                data.developerViewedAt,
              ),
            isUnread:
              String(data.status || "") ===
                "pending_developer_response" &&
              !data.developerViewedAt,
            createdAt: timestampToIso(
              data.createdAt,
            ),
            updatedAt: timestampToIso(
              data.updatedAt,
            ),
            respondedAt: timestampToIso(
              data.respondedAt,
            ),
          };
        })
        .sort((first, second) => {
          const firstTime = new Date(
            first.createdAt || 0,
          ).getTime();

          const secondTime = new Date(
            second.createdAt || 0,
          ).getTime();

          return secondTime - firstTime;
        });

    return NextResponse.json({
      ok: true,
      requests,
    });
  } catch (error) {
    console.error(
      "Load member connection requests error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your connection requests.",
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

    if (
      !isDeveloperPurpose(
        member.accountPurpose,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A developer account is required to update connection-request notifications.",
        },
        { status: 403 },
      );
    }

    const body =
      await request
        .json()
        .catch(() => null);

    const requestId =
      typeof body?.requestId ===
        "string"
        ? body.requestId.trim()
        : "";

    if (!requestId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A connection request ID is required.",
        },
        { status: 400 },
      );
    }

    const requestReference =
      adminDb
        .collection(
          "developerConnectionRequests",
        )
        .doc(requestId);

    const requestSnapshot =
      await requestReference.get();

    if (!requestSnapshot.exists) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Connection request not found.",
        },
        { status: 404 },
      );
    }

    const requestData =
      requestSnapshot.data() || {};

    if (
      String(
        requestData.developerMemberId ||
        "",
      ) !== member.memberId
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

    await requestReference.set(
      {
        developerViewedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      message:
        "Notification marked as viewed.",
    });
  } catch (error) {
    console.error(
      "Mark connection notification viewed error:",
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