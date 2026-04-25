import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { readFile } from "fs/promises";
import path from "path";

const DISCORD_CHANNEL_ID = "1497579914650587277";
const APPLICANT_ROLE_ID = "1493113453467140209";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/discord/create-applicant-invite",
    message: "Discord applicant invite route is active.",
  });
}

export async function POST(req: NextRequest) {

  console.log("DISCORD INVITE POST ROUTE HIT");
  try {
    const { discordUserId, email, firstName, memberId } = await req.json();

    if (!discordUserId || !/^\d+$/.test(discordUserId)) {
      return NextResponse.json(
        { error: "A valid Discord user ID is required." },
        { status: 400 }
      );
    }

    if (!email || !firstName) {
      return NextResponse.json(
        { error: "Missing applicant email or first name." },
        { status: 400 }
      );
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Missing DISCORD_BOT_TOKEN." },
        { status: 500 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY." },
        { status: 500 }
      );
    }

    const csvContent = `${discordUserId}\n`;
    const csvBlob = new Blob([csvContent], { type: "text/csv" });

    const formData = new FormData();
    formData.append("target_users_file", csvBlob, "target-users.csv");
    formData.append(
      "payload_json",
      JSON.stringify({
        role_ids: [APPLICANT_ROLE_ID],
        max_age: 60 * 60 * 24 * 7,
        max_uses: 1,
        unique: true,
      })
    );

    const response = await fetch(
      `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/invites`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        body: formData,
      }
    );

    const responseText = await response.text();

    let discordBody: any = null;

    try {
      discordBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      discordBody = responseText;
    }

    if (!response.ok) {
      console.error("Discord invite creation error:", {
        status: response.status,
        statusText: response.statusText,
        body: discordBody,
        channelId: DISCORD_CHANNEL_ID,
        roleId: APPLICANT_ROLE_ID,
      });

      return NextResponse.json(
        {
          ok: false,
          error: `Failed to create Discord invite. Discord returned ${response.status} ${response.statusText}.`,
          details: discordBody,
          channelId: DISCORD_CHANNEL_ID,
          roleId: APPLICANT_ROLE_ID,
        },
        { status: response.status }
      );
    }

    const invite = discordBody;
    const inviteUrl = `https://discord.gg/${invite.code}`;

    const logoPath = path.join(process.cwd(), "public", "frda-logo.png");
    const logoBuffer = await readFile(logoPath);

    const safeFirstName = escapeHtml(firstName);
    const safeInviteUrl = escapeHtml(inviteUrl);

    const { error: emailError } = await resend.emails.send({
      from: "FRDA Team <admin@frdaph.org>",
      to: [email],
      subject: "Your FRDA application has been approved",
      replyTo: "admin@frdaph.org",
      html: `
        <div style="margin:0;padding:56px 24px 64px 24px;background:#f8fafc;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:40px 32px;box-shadow:0 16px 50px rgba(15,23,42,0.08);">
            <div style="text-align:center;margin-bottom:28px;">
              <img
                src="cid:frda-logo"
                alt="FRDA logo"
                style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto;"
              />
            </div>

            <h1 style="margin:0 0 18px 0;font-size:28px;line-height:1.2;color:#111827;">
              Your FRDA application has been approved
            </h1>

            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
              Hi ${safeFirstName},
            </p>

                        <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
              Your developer registration has been accepted.
            </p>

            ${memberId
          ? `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
                    Your FRDA Member ID is <strong>${escapeHtml(memberId)}</strong>. Please keep this ID for future member-only submissions, including Game Directory listings.
                  </p>`
          : ""
        }

            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
              Use the button below to join the FRDA Discord server. This invite is intended only for the Discord account tied to your submitted Discord user ID.
            </p>

            <p style="margin:0 0 28px 0;font-size:16px;line-height:1.75;color:#374151;">
              Once you join, you will receive the <strong>Registered Developer</strong> role automatically through this invite.
            </p>

            <div style="margin:0 0 32px 0;">
              <a
                href="${safeInviteUrl}"
                style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 24px;border-radius:10px;"
              >
                Join FRDA Discord
              </a>
            </div>

            <p style="margin:0 0 10px 0;font-size:14px;line-height:1.75;color:#6b7280;">
              If the button doesn’t work, copy and paste this link into your browser:
            </p>

            <p style="margin:0;font-size:14px;line-height:1.8;color:#2563eb;word-break:break-word;">
              <a href="${safeInviteUrl}" style="color:#2563eb;text-decoration:underline;">
                ${safeInviteUrl}
              </a>
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

    if (emailError) {
      console.error("Applicant invite email error:", emailError);

      return NextResponse.json(
        {
          error: "Discord invite was created, but the email could not be sent.",
          inviteUrl,
          code: invite.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      code: invite.code,
      inviteUrl,
    });
  } catch (error) {
    console.error("Create applicant invite route error:", error);
    return NextResponse.json(
      { error: "Unexpected error while creating Discord invite." },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}