import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";

export const runtime = "nodejs";

type AdminAction =
  | "approve"
  | "reject"
  | "hold"
  | "dismiss_report"
  | "close_report"
  | "suspend_requester"
  | "mark_viewed";

function timestampToIso(value: unknown): string | null {
  if (
    value instanceof Timestamp ||
    (typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function")
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return null;
}

function sanitizeText(value: unknown, maximumLength: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeRequest(
  requestId: string,
  data: FirebaseFirestore.DocumentData,
) {
  return {
    requestId,
    status: String(data.status || "pending_frda_review"),
    inquiryType: String(data.inquiryType || ""),
    opportunityTitle: String(data.opportunityTitle || ""),
    organizationName: String(data.organizationName || ""),
    message: String(data.message || ""),
    relevantUrl: String(data.relevantUrl || ""),
    requesterMemberId: String(data.requesterMemberId || ""),
    requesterDisplayName: String(data.requesterDisplayName || ""),
    requesterAvatarUrl: String(data.requesterAvatarUrl || ""),
    requesterContactEmail: String(data.requesterContactEmail || ""),
    requesterOrganizationName: String(
      data.requesterOrganizationName || "",
    ),
    requesterRole: String(data.requesterRole || ""),
    developerMemberId: String(data.developerMemberId || ""),
    developerDisplayName: String(data.developerDisplayName || ""),
    developerAvatarUrl: String(data.developerAvatarUrl || ""),
    developerSlug: String(data.developerSlug || ""),
    adminReviewNote: String(data.adminReviewNote || ""),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    reviewedAt: timestampToIso(data.reviewedAt),
    firstAdminViewedAt:
      timestampToIso(
        data.firstAdminViewedAt,
      ),
    isUnreadAdmin:
      String(
        data.status ||
        "pending_frda_review",
      ) ===
        "pending_frda_review" &&
      !data.firstAdminViewedAt,
  };
}

async function notifyDeveloper({
  developerEmail,
  developerName,
  requesterName,
  opportunityTitle,
}: {
  developerEmail: string;
  developerName: string;
  requesterName: string;
  opportunityTitle: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");

  const resend = new Resend(apiKey);
  const logoBuffer = await readFile(
    path.join(process.cwd(), "public", "frda-logo.png"),
  );

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.SITE_URL ||
    "https://frdaph.org"
  ).replace(/\/$/, "");

  const { error } = await resend.emails.send({
    from: "FRDA Connections <admin@frdaph.org>",
    to: [developerEmail],
    subject: `New FRDA connection request: ${opportunityTitle}`,
    replyTo: "admin@frdaph.org",
    html: `
      <div style="margin:0;padding:48px 20px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:36px 30px;">
          <img src="cid:frda-logo" alt="FRDA logo" style="width:64px;height:64px;display:block;margin:0 0 24px;" />
          <h1 style="margin:0 0 18px;font-size:25px;color:#111827;">You received a connection request</h1>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151;">
            Hi ${escapeHtml(developerName)}, FRDA reviewed and approved a protected inquiry from ${escapeHtml(requesterName)}.
          </p>
          <div style="margin:24px 0;padding:18px;background:#f1f5f9;border-radius:10px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Opportunity</p>
            <p style="margin:0;font-size:17px;color:#111827;">${escapeHtml(opportunityTitle)}</p>
          </div>
          <a href="${baseUrl}/member/connection-requests" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:9px;">
            Review Request
          </a>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: "frda-logo.png",
        content: logoBuffer.toString("base64"),
        contentType: "image/png",
        contentId: "frda-logo",
      },
    ],
  });

  if (error) throw new Error("Could not notify the developer by email.");
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      "membership_connection_requests",
    );

    if (!authorization.ok) return authorization.response;

    const snapshot = await adminDb
      .collection("developerConnectionRequests")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    const requestRows =
      snapshot.docs.map((document) => ({
        document,
        data: document.data(),
      }));

    const requesterIds = Array.from(
      new Set(
        requestRows
          .map(({ data }) =>
            String(
              data.requesterMemberId || "",
            ),
          )
          .filter(Boolean),
      ),
    );

    const developerIds = Array.from(
      new Set(
        requestRows
          .map(({ data }) =>
            String(
              data.developerMemberId || "",
            ),
          )
          .filter(Boolean),
      ),
    );

    const requesterAvatarMap =
      new Map<string, string>();

    const developerAvatarMap =
      new Map<string, string>();

    await Promise.all([
      ...requesterIds.map(async (memberId) => {
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

        const profile =
          typeof memberSnapshot
            .data()?.talentSeekerProfile ===
              "object" &&
          memberSnapshot
            .data()?.talentSeekerProfile !== null
            ? memberSnapshot
                .data()!
                .talentSeekerProfile as
                  Record<string, unknown>
            : {};

        const talentSeekerAvatar =
          String(profile.avatarUrl || "");

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

      ...developerIds.map(async (memberId) => {
        const [
          profileSnapshot,
          memberSnapshot,
        ] = await Promise.all([
          adminDb
            .collection("developerProfiles")
            .where("memberId", "==", memberId)
            .limit(1)
            .get(),

          adminDb
            .collection("members")
            .doc(memberId)
            .get(),
        ]);

        const developerAvatar =
          !profileSnapshot.empty
            ? String(
                profileSnapshot.docs[0]
                  .data().avatarUrl || "",
              )
            : "";

        const memberData =
          memberSnapshot.data() || {};

        const talentSeekerProfile =
          typeof memberData
            .talentSeekerProfile ===
              "object" &&
          memberData
            .talentSeekerProfile !== null
            ? memberData
                .talentSeekerProfile as
                  Record<string, unknown>
            : {};

        developerAvatarMap.set(
          memberId,
          developerAvatar ||
          String(
            talentSeekerProfile.avatarUrl ||
            "",
          ),
        );
      }),
    ]);

    const requests =
      requestRows.map(({ document, data }) => {
        const serialized =
          serializeRequest(
            document.id,
            data,
          );

        return {
          ...serialized,
          requesterAvatarUrl:
            serialized.requesterAvatarUrl ||
            requesterAvatarMap.get(
              serialized.requesterMemberId,
            ) ||
            "",
          developerAvatarUrl:
            serialized.developerAvatarUrl ||
            developerAvatarMap.get(
              serialized.developerMemberId,
            ) ||
            "",
        };
      });

    return NextResponse.json({
      ok: true,
      requests,
      unreadCount:
        requests.filter(
          (item) =>
            item.isUnreadAdmin,
        ).length,
    });
  } catch (error) {
    console.error("Load connection requests error:", error);
    return NextResponse.json(
      { ok: false, error: "Could not load connection requests." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      "membership_connection_requests",
    );

    if (!authorization.ok) return authorization.response;

    const body = await request.json().catch(() => null);
    const requestId = sanitizeText(body?.requestId, 160);
    const action = body?.action as AdminAction;
    const reviewNote = sanitizeText(body?.reviewNote, 3000);

    if (!requestId) {
      return NextResponse.json(
        { ok: false, error: "A connection request ID is required." },
        { status: 400 },
      );
    }

    if (
      action !== "approve" &&
      action !== "reject" &&
      action !== "hold" &&
      action !== "dismiss_report" &&
      action !== "close_report" &&
      action !== "suspend_requester" &&
      action !== "mark_viewed"
    ) {
      return NextResponse.json(
        { ok: false, error: "Choose a valid review action." },
        { status: 400 },
      );
    }

    if (
      (
        action === "reject" ||
        action === "hold" ||
        action === "suspend_requester"
      ) &&
      !reviewNote
    ) {
      return NextResponse.json(
        { ok: false, error: "Add a review note for this action." },
        { status: 400 },
      );
    }

    const requestReference = adminDb
      .collection("developerConnectionRequests")
      .doc(requestId);

    const requestSnapshot = await requestReference.get();

    if (!requestSnapshot.exists) {
      return NextResponse.json(
        { ok: false, error: "Connection request not found." },
        { status: 404 },
      );
    }

    const requestData = requestSnapshot.data() || {};
    const currentStatus = String(
      requestData.status || "pending_frda_review",
    );
    if (action === "mark_viewed") {
      if (!requestData.firstAdminViewedAt) {
        await requestReference.set(
          {
            firstAdminViewedAt:
              FieldValue.serverTimestamp(),
            firstAdminViewedByUid:
              authorization.staff.uid,
            firstAdminViewedByEmail:
              authorization.staff.emailAddress,
            firstAdminViewedByName:
              authorization.staff.displayName ||
              authorization.staff.emailAddress,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      const viewedSnapshot =
        await requestReference.get();

      return NextResponse.json({
        ok: true,
        request: serializeRequest(
          viewedSnapshot.id,
          viewedSnapshot.data() || {},
        ),
        message:
          "Connection request marked as viewed.",
      });
    }


    const isInitialReviewAction =
      action === "approve" ||
      action === "reject" ||
      action === "hold";

    const isReportAction =
      action === "dismiss_report" ||
      action === "close_report" ||
      action === "suspend_requester";

    if (
      isInitialReviewAction &&
      currentStatus !== "pending_frda_review" &&
      currentStatus !== "held"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This request has already moved past FRDA review.",
        },
        { status: 409 },
      );
    }

    if (
      isReportAction &&
      currentStatus !== "reported"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This request is not awaiting report review.",
        },
        { status: 409 },
      );
    }

    if (action === "approve") {
      const developerMemberId = String(
        requestData.developerMemberId || "",
      );

      const developerSnapshot = await adminDb
        .collection("members")
        .doc(developerMemberId)
        .get();

      if (!developerSnapshot.exists) {
        return NextResponse.json(
          {
            ok: false,
            error: "The developer member account could not be found.",
          },
          { status: 409 },
        );
      }

      const developerData = developerSnapshot.data() || {};
      const developerEmail = String(developerData.email || "");

      if (!developerEmail) {
        return NextResponse.json(
          {
            ok: false,
            error: "The developer does not have a contact email on file.",
          },
          { status: 409 },
        );
      }

      await notifyDeveloper({
        developerEmail,
        developerName: String(
          requestData.developerDisplayName ||
            developerData.displayName ||
            "FRDA Developer",
        ),
        requesterName: String(
          requestData.requesterDisplayName || "FRDA Member",
        ),
        opportunityTitle: String(
          requestData.opportunityTitle || "Connection request",
        ),
      });
    }

    if (
      action === "suspend_requester"
    ) {
      const requesterMemberId =
        String(
          requestData.requesterMemberId ||
          "",
        );

      if (requesterMemberId) {
        await adminDb
          .collection("members")
          .doc(requesterMemberId)
          .set(
            {
              talentSeekerStatus:
                "suspended",
              talentSeekerReviewerNote:
                reviewNote,
              talentSeekerReviewedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      }
    }

    const nextStatus =
      action === "approve"
        ? "pending_developer_response"
        : action === "reject"
          ? "rejected"
          : action === "hold"
            ? "held"
            : action === "dismiss_report"
              ? "pending_developer_response"
              : "closed";

    await requestReference.set(
      {
        status: nextStatus,
        adminReviewNote: reviewNote,

        developerNotifiedAt:
          action === "approve"
            ? FieldValue.serverTimestamp()
            : null,

        developerViewedAt:
          action === "approve"
            ? null
            : requestData.developerViewedAt || null,

        reviewedAt: FieldValue.serverTimestamp(),
        reviewedByUid: authorization.staff.uid,
        reviewedByEmail: authorization.staff.emailAddress,
        reviewedByName:
          authorization.staff.displayName ||
          authorization.staff.emailAddress,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const updatedSnapshot = await requestReference.get();

    return NextResponse.json({
      ok: true,
      request: serializeRequest(
        updatedSnapshot.id,
        updatedSnapshot.data() || {},
      ),
      message:
        action === "approve"
          ? "The request was approved and sent to the developer."
          : action === "reject"
            ? "The request was rejected."
            : action === "hold"
              ? "The request was placed on hold."
              : action === "dismiss_report"
                ? "The concern was dismissed and the request was returned to the developer."
                : action === "suspend_requester"
                  ? "The requester was suspended and the request was closed."
                  : "The reported request was closed.",
    });
  } catch (error) {
    console.error("Review connection request error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not review this connection request.",
      },
      { status: 500 },
    );
  }
}