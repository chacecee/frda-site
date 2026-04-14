import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { readFile } from "fs/promises";
import path from "path";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type CorrectionRequest = {
  fieldKey:
    | "roblox"
    | "placeLink"
    | "placeContribution"
    | "supportingLinks"
    | "facebookProfile"
    | "discordId"
    | "email"
    | "idPhoto";
  label: string;
  note?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getBaseUrl(req: NextRequest) {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_BASE_URL ||
    process.env.SITE_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    if (!resend) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY." },
        { status: 500 }
      );
    }

    const {
      email,
      firstName,
      applicationId,
      trackerToken,
      correctionRequests,
      reviewerNote,
    } = (await req.json()) as {
      email?: string;
      firstName?: string;
      applicationId?: string;
      trackerToken?: string;
      correctionRequests?: CorrectionRequest[];
      reviewerNote?: string;
    };

    if (!email || !firstName || !applicationId || !trackerToken) {
      return NextResponse.json(
        { error: "Missing applicant email, name, application ID, or tracker token." },
        { status: 400 }
      );
    }

    if (!Array.isArray(correctionRequests) || correctionRequests.length === 0) {
      return NextResponse.json(
        { error: "At least one correction request is required." },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(req);
    const statusTrackerUrl = `${baseUrl}/apply/status/${applicationId}?token=${encodeURIComponent(
      trackerToken
    )}`;

    const safeFirstName = escapeHtml(firstName);
    const safeStatusTrackerUrl = escapeHtml(statusTrackerUrl);
    const safeReviewerNote = reviewerNote?.trim()
      ? escapeHtml(reviewerNote.trim())
      : "";

    const correctionListHtml = correctionRequests
      .map((item) => {
        const safeLabel = escapeHtml(item.label || "Requested update");
        const safeNote = item.note?.trim() ? escapeHtml(item.note.trim()) : "";

        return `
          <li style="margin-bottom:12px;">
            <div style="font-weight:700;color:#111827;">${safeLabel}</div>
            ${
              safeNote
                ? `<div style="margin-top:4px;color:#4b5563;font-size:14px;line-height:1.7;">${safeNote}</div>`
                : ""
            }
          </li>
        `;
      })
      .join("");

    const logoPath = path.join(process.cwd(), "public", "frda-logo.png");
    const logoBuffer = await readFile(logoPath);

    const { error } = await resend.emails.send({
      from: "FRDA Team <admin@frdaph.org>",
      to: [email],
      subject: "More information needed for your FRDA application",
      replyTo: "admin@frdaph.org",
      html: `
        <div style="margin:0;padding:56px 24px 64px 24px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:40px 32px;box-shadow:0 16px 50px rgba(15,23,42,0.08);">
            <div style="text-align:center;margin-bottom:28px;">
              <img
                src="cid:frda-logo"
                alt="FRDA logo"
                style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto 14px auto;"
              />
            </div>

            <h1 style="margin:0 0 18px 0;font-size:28px;line-height:1.2;color:#111827;">
              More information needed for your FRDA application
            </h1>

            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
              Hi ${safeFirstName},
            </p>

            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
              A reviewer checked your FRDA application and requested a few corrections or additional details before we can continue the review.
            </p>

            <p style="margin:0 0 22px 0;font-size:16px;line-height:1.75;color:#374151;">
              <strong>Your application is still active</strong>, but it is currently waiting on your response.
            </p>

            <div style="margin:0 0 22px 0;padding:22px 20px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;">
              <p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#2563eb;">
                Requested Updates
              </p>

              <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.8;color:#374151;">
                ${correctionListHtml}
              </ul>
            </div>

            ${
              safeReviewerNote
                ? `
            <div style="margin:0 0 22px 0;padding:20px;border-radius:14px;background:#fafafa;border:1px solid #e5e7eb;">
              <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">
                Reviewer Note
              </p>
              <p style="margin:0;font-size:15px;line-height:1.8;color:#374151;">
                ${safeReviewerNote}
              </p>
            </div>
            `
                : ""
            }

            <p style="margin:0 0 22px 0;font-size:15px;line-height:1.75;color:#6b7280;">
              Please use the button below to open your status tracker page and submit the requested updates.
            </p>

            <div style="margin:0 0 18px 0;">
              <a
                href="${safeStatusTrackerUrl}"
                style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 24px;border-radius:10px;"
              >
                Open My Status Tracker
              </a>
            </div>

            <p style="margin:0;font-size:14px;line-height:1.75;color:#6b7280;">
              Once you submit the updated information, your application will return to the review queue.
            </p>
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

    if (error) {
      console.error("Request more info email error:", error);
      return NextResponse.json(
        { error: "Could not send request-more-info email." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Request more info route error:", error);
    return NextResponse.json(
      { error: "Unexpected error while sending request-more-info email." },
      { status: 500 }
    );
  }
}