import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminAuth } from "@/lib/firebaseAdmin";
import { readFile } from "fs/promises";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { emailAddress, displayName, role } = body;

    if (!emailAddress || !displayName) {
      return NextResponse.json(
        { error: "Missing emailAddress or displayName." },
        { status: 400 }
      );
    }

    try {
      await adminAuth.getUserByEmail(emailAddress);
    } catch {
      await adminAuth.createUser({
        email: emailAddress,
        displayName,
      });
    }

    const resetLink = await adminAuth.generatePasswordResetLink(emailAddress, {
      url: "https://frdaph.org/admin/reset-password",
      handleCodeInApp: false,
    });

    const logoPath = path.join(process.cwd(), "public", "frda-logo.png");
    const logoBuffer = await readFile(logoPath);

    const article = role && /^[aeiou]/i.test(role.trim()) ? "an" : "a";

    const roleLine = role
      ? `You’ve been added as ${article} ${role} to FRDA Portal. Click the button below to set your password, activate your account, and access your dashboard.`
      : `You’ve been invited to access the FRDA Portal. Click the button below to set your password, activate your account, and access your dashboard.`;

    const { data, error } = await resend.emails.send({
      from: "FRDA Team <admin@frdaph.org>",
      to: [emailAddress],
      subject: "Set up your FRDA Portal account",
      replyTo: "admin@frdaph.org",
      html: `
        <div style="margin:0;padding:56px 24px 64px 24px;background:transparent;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:600px;margin:0 auto;">
            <div style="text-align:center;margin-bottom:40px;">
              <div style="display:inline-flex;align-items:center;gap:12px;">
                <img
                  src="cid:frda-logo"
                  alt="FRDA logo"
                  style="width:48px;height:48px;object-fit:contain;vertical-align:middle;"
                />
                <span style="font-size:28px;font-weight:800;letter-spacing:0.2px;color:#111827;vertical-align:middle;">
                  FRDA
                </span>
              </div>
            </div>

            <div style="max-width:520px;margin:0 auto;">
              <h1 style="margin:0 0 20px 0;font-size:32px;line-height:1.2;font-weight:800;color:#111827;">
                Welcome to the FRDA Portal
              </h1>

              <p style="margin:0 0 18px 0;font-size:18px;line-height:1.75;color:#374151;">
                Hi ${escapeHtml(displayName)},
              </p>

              <p style="margin:0 0 28px 0;font-size:18px;line-height:1.75;color:#374151;">
                ${escapeHtml(roleLine)}
              </p>

              <div style="margin:0 0 32px 0;">
                <a
                  href="${resetLink}"
                  style="display:inline-block;background:#10b981;color:#06281f;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 24px;border-radius:10px;"
                >
                  Set Your Password
                </a>
              </div>

              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.75;color:#6b7280;">
                If the button doesn’t work, copy and paste this link into your browser:
              </p>

              <p style="margin:0;font-size:14px;line-height:1.8;color:#2563eb;word-break:break-word;">
                <a href="${resetLink}" style="color:#2563eb;text-decoration:underline;">
                  ${resetLink}
                </a>
              </p>
            </div>
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
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Invite route error:", error);
    return NextResponse.json(
      { error: "Failed to create invite." },
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