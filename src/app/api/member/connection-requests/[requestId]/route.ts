import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeMemberRequest } from "@/lib/server/memberAuthorization";

export const runtime = "nodejs";

type ResponseAction =
  | "connect"
  | "decline"
  | "report";

function sanitizeText(
  value: unknown,
  maximumLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function isResponseAction(
  value: unknown,
): value is ResponseAction {
  return (
    value === "connect" ||
    value === "decline" ||
    value === "report"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function getLogoAttachment() {
  const logoPath = path.join(
    process.cwd(),
    "public",
    "frda-logo.png",
  );

  const logoBuffer =
    await readFile(logoPath);

  return {
    filename: "frda-logo.png",
    content:
      logoBuffer.toString("base64"),
    contentType: "image/png",
    contentId: "frda-logo",
  };
}

async function sendConnectEmail({
  developerEmail,
  developerName,
  requesterEmail,
  requesterName,
  opportunityTitle,
}: {
  developerEmail: string;
  developerName: string;
  requesterEmail: string;
  requesterName: string;
  opportunityTitle: string;
}) {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const resend = new Resend(apiKey);
  const attachment = await getLogoAttachment();

  const { error } = await resend.emails.send({
    from: "FRDA Connections <admin@frdaph.org>",
    to: [requesterEmail],
    subject:
      `${developerName} responded to your FRDA inquiry`,
    replyTo: developerEmail,
    html: `
      <div style="margin:0;padding:48px 20px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:36px 30px;">
          <img src="cid:frda-logo" alt="FRDA logo" style="width:64px;height:64px;display:block;margin:0 0 24px;" />
          <h1 style="margin:0 0 18px;font-size:26px;line-height:1.3;color:#111827;">${escapeHtml(developerName)} responded to your inquiry</h1>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151;">
            Hi ${escapeHtml(requesterName)}, ${escapeHtml(developerName)} chose to connect regarding “${escapeHtml(opportunityTitle)}.”
          </p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">
            Reply to this email to contact the developer directly. FRDA facilitated the introduction but does not manage or guarantee any agreement that follows.
          </p>
        </div>
      </div>
    `,
    attachments: [attachment],
  });

  if (error) {
    throw new Error("Could not send the connection email.");
  }
}

async function sendDeclineEmail({
  requesterEmail,
  requesterName,
  developerName,
  opportunityTitle,
}: {
  requesterEmail: string;
  requesterName: string;
  developerName: string;
  opportunityTitle: string;
}) {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY.",
    );
  }

  const resend =
    new Resend(apiKey);

  const attachment =
    await getLogoAttachment();

  const { error } =
    await resend.emails.send({
      from:
        "FRDA Connections <admin@frdaph.org>",
      to: [requesterEmail],
      subject:
        `Update on your FRDA connection request`,
      replyTo:
        "admin@frdaph.org",
      html: `
        <div style="margin:0;padding:48px 20px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:36px 30px;">
            <img src="cid:frda-logo" alt="FRDA logo" style="width:64px;height:64px;display:block;margin:0 0 24px;" />
            <h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;color:#111827;">Connection request update</h1>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151;">
              Hi ${escapeHtml(requesterName)}, ${escapeHtml(developerName)} has declined the connection request regarding “${escapeHtml(opportunityTitle)}.”
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">
              Their private contact information has not been shared. Thank you for using FRDA’s protected contact system.
            </p>
          </div>
        </div>
      `,
      attachments: [attachment],
    });

  if (error) {
    throw new Error(
      "Could not send the decline notification.",
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      requestId: string;
    }>;
  },
) {
  try {
    const authorization =
      await authorizeMemberRequest(request);

    if (!authorization.ok) {
      return authorization.response;
    }

    const { member } =
      authorization;

    if (
      member.accountPurpose !==
        "developer" &&
      member.accountPurpose !==
        "both"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A developer account is required to respond to connection requests.",
        },
        { status: 403 },
      );
    }

    const {
      requestId,
    } = await context.params;

    const body =
      await request
        .json()
        .catch(() => null);

    if (
      !isResponseAction(
        body?.action,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Choose a valid response action.",
        },
        { status: 400 },
      );
    }

    const responseNote =
      sanitizeText(
        body?.responseNote,
        2000,
      );

    if (
      body.action === "report" &&
      !responseNote
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Explain why this request should be reviewed by FRDA.",
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
            "You cannot respond to this connection request.",
        },
        { status: 403 },
      );
    }

    if (
      String(
        requestData.status || "",
      ) !== "pending_developer_response"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This connection request has already been handled.",
        },
        { status: 409 },
      );
    }

    const developerMemberSnapshot =
      await adminDb
        .collection("members")
        .doc(member.memberId)
        .get();

    const requesterMemberId =
      String(
        requestData.requesterMemberId ||
        "",
      );

    const requesterMemberSnapshot =
      await adminDb
        .collection("members")
        .doc(requesterMemberId)
        .get();

    if (
      !developerMemberSnapshot.exists ||
      !requesterMemberSnapshot.exists
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "One of the member accounts linked to this request is unavailable.",
        },
        { status: 409 },
      );
    }

    const developerMemberData =
      developerMemberSnapshot.data() ||
      {};

    const requesterMemberData =
      requesterMemberSnapshot.data() ||
      {};

    const developerEmail =
      String(
        developerMemberData.email ||
        member.email ||
        "",
      );

    const requesterProfile =
      typeof requesterMemberData
        .talentSeekerProfile ===
        "object" &&
      requesterMemberData
        .talentSeekerProfile !== null
        ? requesterMemberData
            .talentSeekerProfile as
              Record<string, unknown>
        : {};

    const requesterEmail =
      String(
        requesterProfile.contactEmail ||
        requesterMemberData.email ||
        "",
      );

    if (
      body.action !== "report" &&
      (
        !developerEmail ||
        !requesterEmail
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The contact email for one of these members is unavailable.",
        },
        { status: 409 },
      );
    }

    const nextStatus =
      body.action === "connect"
        ? "connected"
        : body.action === "decline"
          ? "declined"
          : "reported";

    if (
      body.action === "connect"
    ) {
      await sendConnectEmail({
        developerEmail,
        developerName:
          member.displayName ||
          String(
            requestData
              .developerDisplayName ||
            "FRDA Developer",
          ),
        requesterEmail,
        requesterName:
          String(
            requestData
              .requesterDisplayName ||
            "FRDA Member",
          ),
        opportunityTitle:
          String(
            requestData
              .opportunityTitle ||
            "Connection request",
          ),
      });
    }

    if (
      body.action === "decline"
    ) {
      await sendDeclineEmail({
        requesterEmail,
        requesterName:
          String(
            requestData
              .requesterDisplayName ||
            "FRDA Member",
          ),
        developerName:
          member.displayName ||
          String(
            requestData
              .developerDisplayName ||
            "FRDA Developer",
          ),
        opportunityTitle:
          String(
            requestData
              .opportunityTitle ||
            "Connection request",
          ),
      });
    }

    await requestReference.set(
      {
        status: nextStatus,
        developerResponseNote:
          responseNote,
        respondedAt:
          FieldValue.serverTimestamp(),
        respondedByUid:
          member.uid,
        updatedAt:
          FieldValue.serverTimestamp(),

        requesterEmailShared:
          body.action === "connect",

        developerEmailShared:
          body.action === "connect",

        reportedAt:
          body.action === "report"
            ? FieldValue.serverTimestamp()
            : null,
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      message:
        body.action === "connect"
          ? "The introduction email was sent to both parties."
          : body.action === "decline"
            ? "The connection request was declined."
            : "The request was reported to FRDA for review.",
    });
  } catch (error) {
    console.error(
      "Respond to connection request error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update this connection request.",
      },
      { status: 500 },
    );
  }
}