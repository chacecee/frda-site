import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { readFile } from "fs/promises";
import path from "path";
import { createApplication } from "@/lib/server/applications";
import { adminDb } from "@/lib/firebaseAdmin";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function isValidFacebookProfileUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedHosts = new Set([
      "facebook.com",
      "www.facebook.com",
      "m.facebook.com",
      "web.facebook.com",
      "fb.com",
      "www.fb.com",
    ]);

    if (!allowedHosts.has(host)) {
      return false;
    }

    const path = url.pathname.trim();
    if (!path || path === "/") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

const ACTIVE_APPLICATION_STATUSES = new Set([
  "application_sent",
  "manual_review",
  "needs_more_info",
  "pending",
  "accepted",
]);

const DUPLICATE_APPLICATION_MESSAGE =
  "It looks like an application may already exist for these details. Please check your email for the verification instructions or use the status tracker. If you believe this is a mistake, please contact FRDA support.";

function isActiveApplicationStatus(value: unknown) {
  return ACTIVE_APPLICATION_STATUSES.has(String(value || ""));
}

async function hasActiveApplicationWithField(
  fieldName: "email" | "discordId",
  values: string[]
) {
  const uniqueValues = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );

  for (const value of uniqueValues) {
    const snapshot = await adminDb
      .collection("applications")
      .where(fieldName, "==", value)
      .limit(5)
      .get();

    const activeMatch = snapshot.docs.some((docSnap) => {
      const data = docSnap.data();
      return isActiveApplicationStatus(data.status);
    });

    if (activeMatch) {
      return true;
    }
  }

  return false;
}

async function hasActiveDuplicateApplication({
  email,
  discordId,
}: {
  email: string;
  discordId: string;
}) {
  if (await hasActiveApplicationWithField("email", [email])) {
    return true;
  }

  if (await hasActiveApplicationWithField("discordId", [discordId])) {
    return true;
  }

  return false;
}

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

async function sendApplicationReceivedEmail({
  email,
  firstName,
  verificationCode,
  submittedStepUrl,
  statusTrackerUrl,
  placeLink,
}: {
  email: string;
  firstName: string;
  verificationCode: string;
  submittedStepUrl: string;
  statusTrackerUrl: string;
  placeLink: string;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY is missing. Skipping application received email.");
    return;
  }

  const logoPath = path.join(process.cwd(), "public", "frda-logo.png");
  const logoBuffer = await readFile(logoPath);

  const safeFirstName = escapeHtml(firstName);
  const safeVerificationCode = escapeHtml(verificationCode);
  const safeSubmittedStepUrl = escapeHtml(submittedStepUrl);
  const safeStatusTrackerUrl = escapeHtml(statusTrackerUrl);
  const safePlaceLink = escapeHtml(placeLink);

  const { error } = await resend.emails.send({
    from: "FRDA Team <admin@frdaph.org>",
    to: [email],
    subject: "Action required — complete your FRDA review request",
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
            We received your FRDA application
          </h1>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            Hi ${safeFirstName},
          </p>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            Thank you for submitting your application.
          </p>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            <strong>Your application is not yet in the review queue.</strong> To start manual review, you still need to complete one more step.
          </p>

          <div style="margin:26px 0;padding:22px 20px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;text-align:center;">
            <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#059669;">
              Your Verification Code
            </p>
            <p style="margin:0;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:0.12em;color:#111827;word-break:break-word;">
              ${safeVerificationCode}
            </p>
          </div>

          <div style="margin:0 0 18px 0;font-size:16px;line-height:1.8;color:#374151;">
            <p style="margin:0 0 10px 0;"><strong>Please do the following</strong></p>
            <ol style="margin:0;padding-left:20px;">
              <li style="margin-bottom:10px;">Copy the verification code above.</li>
              <li style="margin-bottom:10px;">Paste it into the description of the Roblox experience you submitted.</li>
              <li style="margin-bottom:10px;">
                Make sure it appears in the description of this submitted place —
                <a href="${safePlaceLink}" style="color:#2563eb;text-decoration:underline;">${safePlaceLink}</a>
              </li>
              <li style="margin-bottom:0;">Once that is done, use the button below to prompt our team to check your application.</li>
            </ol>
          </div>

          <p style="margin:0 0 22px 0;font-size:15px;line-height:1.75;color:#6b7280;">
            Clicking the review button before adding the code may delay your review.
          </p>

          <div style="margin:0 0 16px 0;">
            <a
              href="${safeSubmittedStepUrl}"
              style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 24px;border-radius:10px;"
            >
              Complete Verification and Request Review
            </a>
          </div>

          <p style="margin:20px 0 10px 0;font-size:14px;line-height:1.75;color:#6b7280;">
            You can also check the progress of your application here
          </p>

          <div style="margin:0 0 24px 0;">
            <a
              href="${safeStatusTrackerUrl}"
              style="display:inline-block;background:#eff6ff;color:#1d4ed8;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 20px;border-radius:10px;border:1px solid #bfdbfe;"
            >
              Open My Status Tracker
            </a>
          </div>

          <p style="margin:0;font-size:14px;line-height:1.75;color:#6b7280;">
            If you do not request manual review within 7 days, your application will expire and you will need to apply again.
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
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const firstName = normalizeText(formData.get("firstName"));
    const lastName = normalizeText(formData.get("lastName"));
    const email = normalizeEmail(formData.get("email"));
    const birthYearRaw = normalizeText(formData.get("birthYear"));
    const ageRaw = normalizeText(formData.get("age"));
    const region = normalizeText(formData.get("region"));
    const skills = normalizeText(formData.get("skills"));
    const organization = normalizeText(formData.get("organization"));
    const roblox = normalizeText(formData.get("roblox"));
    const discordId = normalizeText(formData.get("discordId"));
    const facebookProfile = normalizeText(formData.get("facebookProfile"));
    const placeLink = normalizeText(formData.get("placeLink"));
    const placeContribution = normalizeText(formData.get("placeContribution"));
    const supportingLinks = normalizeText(formData.get("supportingLinks"));
    const privacyConsent = normalizeText(formData.get("privacyConsent"));
    const companyWebsite = normalizeText(formData.get("companyWebsite"));
    const formStartedAtRaw = normalizeText(formData.get("formStartedAt"));

    if (companyWebsite) {
      return NextResponse.json(
        { error: "Unable to submit application." },
        { status: 400 }
      );
    }

    const formStartedAt = Number(formStartedAtRaw);
    const elapsedMs = Date.now() - formStartedAt;

    if (
      !formStartedAtRaw ||
      Number.isNaN(formStartedAt) ||
      elapsedMs < 2000
    ) {
      return NextResponse.json(
        { error: "Unable to submit application. Please refresh the page and try again." },
        { status: 400 }
      );
    }

    if (
      !firstName ||
      !lastName ||
      !email ||
      (!birthYearRaw && !ageRaw) ||
      !skills ||
      !roblox ||
      !discordId ||
      !placeLink ||
      !placeContribution
    ) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    if (!privacyConsent) {
      return NextResponse.json(
        { error: "Please confirm that you have read the Privacy Notice and consent to the processing of your data." },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();

    let age: number;

    if (birthYearRaw) {
      const birthYear = Number(birthYearRaw);

      if (
        Number.isNaN(birthYear) ||
        !Number.isInteger(birthYear) ||
        birthYear < 1900 ||
        birthYear > currentYear
      ) {
        return NextResponse.json(
          { error: "Please enter a valid birth year." },
          { status: 400 }
        );
      }

      age = currentYear - birthYear;

      if (age < 18) {
        return NextResponse.json(
          { error: "Applicants must be at least 18 years old." },
          { status: 400 }
        );
      }
    } else {
      age = Number(ageRaw);

      if (Number.isNaN(age) || age < 18) {
        return NextResponse.json(
          { error: "Applicants must be at least 18 years old." },
          { status: 400 }
        );
      }
    }

    if (!/^\d{17,19}$/.test(discordId)) {
      return NextResponse.json(
        { error: "Please enter a valid Discord User ID." },
        { status: 400 }
      );
    }

    if (facebookProfile && !isValidFacebookProfileUrl(facebookProfile)) {
      return NextResponse.json(
        { error: "Please enter a valid Facebook profile URL." },
        { status: 400 }
      );
    }

    const hasDuplicate = await hasActiveDuplicateApplication({
      email,
      discordId,
    });

    if (hasDuplicate) {
      return NextResponse.json(
        { error: DUPLICATE_APPLICATION_MESSAGE },
        { status: 409 }
      );
    }

    const result = await createApplication({
      firstName,
      lastName,
      email,
      age,
      region,
      skills,
      organization,
      roblox,
      discordId,
      facebookProfile,
      placeLink,
      placeContribution,
      supportingLinks,
    });

    const baseUrl = getBaseUrl(req);
    const submittedStepUrl = `${baseUrl}/apply/submitted/${result.applicationId}?code=${encodeURIComponent(
      result.verificationCode
    )}&token=${encodeURIComponent(result.trackerToken)}`;
    const statusTrackerUrl = `${baseUrl}/apply/status/${result.applicationId}?token=${encodeURIComponent(
      result.trackerToken
    )}`;

    let emailSent = false;

    try {
      await sendApplicationReceivedEmail({
        email,
        firstName,
        verificationCode: result.verificationCode,
        submittedStepUrl,
        statusTrackerUrl,
        placeLink,
      });
      emailSent = true;
    } catch (emailError) {
      console.error("Application received email error:", emailError);
    }

    return NextResponse.json({
      success: true,
      applicationId: result.applicationId,
      verificationCode: result.verificationCode,
      trackerToken: result.trackerToken,
      emailSent,
    });
  } catch (error) {
    console.error("Application submit route error:", error);

    return NextResponse.json(
      { error: "Something went wrong while submitting the application." },
      { status: 500 }
    );
  }
}