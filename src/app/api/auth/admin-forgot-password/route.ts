import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminAuth } from "@/lib/firebaseAdmin";
import { readFile } from "fs/promises";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const email = String(body?.email || "").trim().toLowerCase();

        if (!email) {
            return NextResponse.json(
                { error: "Missing email." },
                { status: 400 }
            );
        }

        // Always return a generic success response to avoid leaking whether
        // an email exists in the system.
        let resetLink: string | null = null;
        let displayName = "there";

        try {
            const userRecord = await adminAuth.getUserByEmail(email);
            displayName = userRecord.displayName?.trim() || "there";

            resetLink = await adminAuth.generatePasswordResetLink(email, {
                url: "https://frdaph.org/admin/reset-password",
                handleCodeInApp: false,
            });
        } catch (error) {
            console.warn("Forgot password lookup/generation skipped:", error);
        }

        if (resetLink) {
            const logoPath = path.join(process.cwd(), "public", "frda-logo.png");
            const logoBuffer = await readFile(logoPath);

            const html = `
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
                Reset your FRDA Portal password
              </h1>

              <p style="margin:0 0 18px 0;font-size:18px;line-height:1.75;color:#374151;">
                Hi ${escapeHtml(displayName)},
              </p>

              <p style="margin:0 0 28px 0;font-size:18px;line-height:1.75;color:#374151;">
                We received a request to reset your FRDA Portal password. Click the button below to choose a new one.
              </p>

              <div style="margin:0 0 32px 0;">
                <a
                  href="${resetLink}"
                  style="display:inline-block;background:#10b981;color:#06281f;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 24px;border-radius:10px;"
                >
                  Reset Password
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

              <p style="margin:28px 0 0 0;font-size:14px;line-height:1.75;color:#6b7280;">
                If you didn’t request this, you can safely ignore this email.
              </p>
            </div>
          </div>
        </div>
      `;

            const text = `
Reset your FRDA Portal password

Hi ${displayName},

We received a request to reset your FRDA Portal password.

Reset your password here:
${resetLink}

If you didn’t request this, you can safely ignore this email.
      `.trim();

            await resend.emails.send({
                from: "FRDA Team <admin@frdaph.org>",
                to: [email],
                subject: "Reset your FRDA Portal password",
                replyTo: "admin@frdaph.org",
                html,
                text,
                attachments: [
                    {
                        filename: "frda-logo.png",
                        content: logoBuffer.toString("base64"),
                        contentType: "image/png",
                        contentId: "frda-logo",
                    },
                ],
            });
        }

        return NextResponse.json({
            success: true,
            message:
                "If that email exists in the system, a password reset link has been sent.",
        });
    } catch (error) {
        console.error("Forgot password route error:", error);
        return NextResponse.json(
            { error: "Failed to process request." },
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