import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { readFile } from "fs/promises";
import path from "path";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const PORTFOLIO_COLLECTION = "geekOutPortfolioSubmissions";

const GEEKOUT_CANDIDATE_CHANNEL_ID = "1523964602155536394";
const OPPORTUNITY_GUEST_ROLE_ID = "1523920686727561276";
const GEEKOUT_CANDIDATE_ROLE_ID = "1523920812124540939";

const INVITE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const INVITE_MAX_USES = 1;

type AuthorizedStaff = {
    id: string;
    emailAddress: string;
    displayName: string;
    role: string;
};

type DiscordInviteResponse = {
    code?: string;
};

function normalizeEmail(value?: string | null): string {
    return value?.trim().toLowerCase() || "";
}

function normalizeRole(value?: string | null): string {
    return value?.trim().toLowerCase() || "";
}

function isAdminRole(value?: string | null): boolean {
    return normalizeRole(value) === "admin";
}

function getBearerToken(request: NextRequest): string {
    const authorization =
        request.headers.get("authorization") || "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
        return "";
    }

    return authorization.slice(7).trim();
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findStaffByEmail(
    email: string
): Promise<AuthorizedStaff | null> {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) return null;

    const exactSnapshot = await adminDb
        .collection("staff")
        .where("emailAddress", "==", email)
        .limit(1)
        .get();

    if (!exactSnapshot.empty) {
        const document = exactSnapshot.docs[0];
        const data = document.data();

        return {
            id: document.id,
            emailAddress: String(data.emailAddress || email),
            displayName: String(data.displayName || ""),
            role: String(data.role || ""),
        };
    }

    const allStaffSnapshot = await adminDb
        .collection("staff")
        .get();

    const matchingDocument =
        allStaffSnapshot.docs.find((document) => {
            const data = document.data();

            return (
                normalizeEmail(
                    String(data.emailAddress || "")
                ) === normalizedEmail
            );
        });

    if (!matchingDocument) return null;

    const data = matchingDocument.data();

    return {
        id: matchingDocument.id,
        emailAddress: String(
            data.emailAddress || email
        ),
        displayName: String(data.displayName || ""),
        role: String(data.role || ""),
    };
}

async function authorizeRequest(
    request: NextRequest
): Promise<
    | {
        ok: true;
        staff: AuthorizedStaff;
    }
    | {
        ok: false;
        response: NextResponse;
    }
> {
    const token = getBearerToken(request);

    if (!token) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    ok: false,
                    error: "Missing authentication token.",
                },
                { status: 401 }
            ),
        };
    }

    let decodedToken;

    try {
        decodedToken =
            await adminAuth.verifyIdToken(token);
    } catch (error) {
        console.error(
            "GeekOut candidate invite token verification error:",
            error
        );

        return {
            ok: false,
            response: NextResponse.json(
                {
                    ok: false,
                    error:
                        "Your session is invalid or has expired.",
                },
                { status: 401 }
            ),
        };
    }

    const email = normalizeEmail(decodedToken.email);

    if (!email) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    ok: false,
                    error:
                        "This account does not have an email address.",
                },
                { status: 403 }
            ),
        };
    }

    const staff = await findStaffByEmail(email);

    if (!staff) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    ok: false,
                    error:
                        "No matching FRDA staff profile was found.",
                },
                { status: 403 }
            ),
        };
    }

    if (isAdminRole(staff.role)) {
        return {
            ok: true,
            staff,
        };
    }

    const permissionsSnapshot = await adminDb
        .collection("adminUiPermissions")
        .doc("sidebar")
        .get();

    const permissions = permissionsSnapshot.exists
        ? permissionsSnapshot.data()
        : null;

    const allowedStaffIds = Array.isArray(
        permissions?.admin_community_survey
    )
        ? permissions.admin_community_survey.filter(
            (value: unknown): value is string =>
                typeof value === "string"
        )
        : [];

    if (!allowedStaffIds.includes(staff.id)) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    ok: false,
                    error:
                        "You do not have permission to send GeekOut candidate invitations.",
                },
                { status: 403 }
            ),
        };
    }

    return {
        ok: true,
        staff,
    };
}

async function createCandidateDiscordInvite(): Promise<{
    code: string;
    inviteUrl: string;
}> {
    const botToken =
        process.env.DISCORD_BOT_TOKEN?.trim();

    if (!botToken) {
        throw new Error(
            "Missing DISCORD_BOT_TOKEN."
        );
    }

    const response = await fetch(
        `https://discord.com/api/v10/channels/${GEEKOUT_CANDIDATE_CHANNEL_ID}/invites`,
        {
            method: "POST",
            headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                max_age: INVITE_MAX_AGE_SECONDS,
                max_uses: INVITE_MAX_USES,
                temporary: false,
                unique: true,
                role_ids: [
                    OPPORTUNITY_GUEST_ROLE_ID,
                    GEEKOUT_CANDIDATE_ROLE_ID,
                ],
            }),
            cache: "no-store",
        }
    );

    const responseText = await response.text();

    let result: DiscordInviteResponse | string | null =
        null;

    try {
        result = responseText
            ? (JSON.parse(
                responseText
            ) as DiscordInviteResponse)
            : null;
    } catch {
        result = responseText;
    }

    if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !result.code
    ) {
        console.error(
            "GeekOut candidate invite creation failed:",
            {
                status: response.status,
                statusText: response.statusText,
                response: result,
                channelId:
                    GEEKOUT_CANDIDATE_CHANNEL_ID,
                roleIds: [
                    OPPORTUNITY_GUEST_ROLE_ID,
                    GEEKOUT_CANDIDATE_ROLE_ID,
                ],
            }
        );

        throw new Error(
            `Discord returned ${response.status} ${response.statusText}.`
        );
    }

    return {
        code: result.code,
        inviteUrl: `https://discord.gg/${result.code}`,
    };
}

async function sendCandidateEmail({
    email,
    creatorName,
    inviteUrl,
}: {
    email: string;
    creatorName: string;
    inviteUrl: string;
}) {
    const resendApiKey =
        process.env.RESEND_API_KEY?.trim();

    if (!resendApiKey) {
        throw new Error("Missing RESEND_API_KEY.");
    }

    const resend = new Resend(resendApiKey);

    const logoPath = path.join(
        process.cwd(),
        "public",
        "frda-logo.png"
    );

    const logoBuffer = await readFile(logoPath);

    const safeCreatorName = escapeHtml(
        creatorName || "Creator"
    );

    const safeInviteUrl = escapeHtml(inviteUrl);

    const { error } = await resend.emails.send({
        from: "FRDA Team <admin@frdaph.org>",
        to: [email],
        subject:
            "Your GeekOut Candidate Discord invitation",
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

          <p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#2563eb;">
            GeekOut Opportunity
          </p>

          <h1 style="margin:0 0 18px 0;font-size:28px;line-height:1.25;color:#111827;">
            You’ve been marked as a GeekOut Candidate
          </h1>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            Hi ${safeCreatorName},
          </p>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            FRDA has reviewed your portfolio submission and marked it as a potential candidate for introduction to the GeekOut team.
          </p>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#374151;">
            We’ve prepared a Discord invitation that gives you the <strong>GeekOut Candidate</strong> role and access to the private candidate channel, where FRDA can share updates and coordinate possible next steps.
          </p>

          <div style="margin:26px 0 28px 0;">
            <a
              href="${safeInviteUrl}"
              style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 24px;border-radius:10px;"
            >
              Join the GeekOut Candidate Channel
            </a>
          </div>

          <div style="margin:0 0 24px 0;padding:18px 20px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;">
            <p style="margin:0;font-size:14px;line-height:1.75;color:#374151;">
              Joining Discord is not required, but it is the fastest way to receive updates because FRDA posts important GeekOut opportunity announcements there first.
            </p>
          </div>

          <p style="margin:0 0 18px 0;font-size:15px;line-height:1.75;color:#4b5563;">
            If you are already in the FRDA Discord server, accepting this invitation should add the GeekOut Candidate role while keeping your existing roles and server access.
          </p>

          <p style="margin:0 0 10px 0;font-size:14px;line-height:1.75;color:#6b7280;">
            This invitation is valid for one use and expires after seven days. If the button does not work, copy and paste this link into your browser:
          </p>

          <p style="margin:0 0 24px 0;font-size:14px;line-height:1.8;color:#2563eb;word-break:break-word;">
            <a
              href="${safeInviteUrl}"
              style="color:#2563eb;text-decoration:underline;"
            >
              ${safeInviteUrl}
            </a>
          </p>

          <p style="margin:0;font-size:14px;line-height:1.75;color:#6b7280;">
            Candidate status means your submission is moving forward in FRDA’s review and coordination process. Any meeting, introduction, or collaboration remains subject to further review and availability.
          </p>
        </div>
      </div>
    `,
        attachments: [
            {
                filename: "frda-logo.png",
                content:
                    logoBuffer.toString("base64"),
                contentType: "image/png",
                contentId: "frda-logo",
            },
        ],
    });

    if (error) {
        console.error(
            "GeekOut candidate invite email error:",
            error
        );

        throw new Error(
            "The Discord invite was created, but the email could not be sent."
        );
    }
}

export async function POST(
    request: NextRequest
) {
    let submissionReference:
        | FirebaseFirestore.DocumentReference
        | null = null;

    let hadPreviouslySentEmail = false;

    try {
        const authorization =
            await authorizeRequest(request);

        if (!authorization.ok) {
            return authorization.response;
        }

        const body = (await request
            .json()
            .catch(() => null)) as
            | {
                submissionId?: unknown;
                resend?: unknown;
            }
            | null;

        const submissionId =
            typeof body?.submissionId === "string"
                ? body.submissionId.trim()
                : "";

        const resendRequested = body?.resend === true;

        if (!submissionId) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "A valid portfolio submission ID is required.",
                },
                { status: 400 }
            );
        }

        submissionReference = adminDb
            .collection(PORTFOLIO_COLLECTION)
            .doc(submissionId);

        const submissionSnapshot =
            await submissionReference.get();

        if (!submissionSnapshot.exists) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "The selected portfolio submission no longer exists.",
                },
                { status: 404 }
            );
        }

        const submission =
            submissionSnapshot.data() || {};

        const creatorName = String(
            submission.creatorName || ""
        ).trim();

        const email = normalizeEmail(
            String(submission.email || "")
        );

        const reviewStatus = String(
            submission.reviewStatus || ""
        );

        const wantsDiscordInvite =
            submission.wantsDiscordInvite === true;

        const candidateInviteEmailSent =
            submission.candidateInviteEmailSent === true;

        hadPreviouslySentEmail = candidateInviteEmailSent;

        if (reviewStatus !== "candidate") {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Mark this submission as Candidate and save the review before sending the invitation.",
                },
                { status: 400 }
            );
        }

        if (!wantsDiscordInvite) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "This developer did not request a Discord invitation.",
                },
                { status: 400 }
            );
        }

        if (!email || !isValidEmail(email)) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "This submission does not have a valid email address.",
                },
                { status: 400 }
            );
        }

        if (candidateInviteEmailSent && !resendRequested) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "A candidate invitation has already been emailed to this developer.",
                },
                { status: 409 }
            );
        }

        let inviteCode = String(
            submission.candidateInviteCode || ""
        ).trim();

        let inviteUrl = String(
            submission.candidateInviteUrl || ""
        ).trim();

        if (resendRequested || !inviteCode || !inviteUrl) {
            const newInvite =
                await createCandidateDiscordInvite();

            inviteCode = newInvite.code;
            inviteUrl = newInvite.inviteUrl;

            await submissionReference.update({
                candidateInviteGenerated: true,
                candidateInviteCode: inviteCode,
                candidateInviteUrl: inviteUrl,
                candidateInviteGeneratedAt:
                    FieldValue.serverTimestamp(),
                candidateInviteGeneratedByEmail:
                    authorization.staff.emailAddress,
                candidateInviteGeneratedByName:
                    authorization.staff.displayName ||
                    authorization.staff.emailAddress,
                candidateInviteEmailSent: false,
                candidateInviteEmailError: "",
                updatedAt:
                    FieldValue.serverTimestamp(),
            });
        }

        await sendCandidateEmail({
            email,
            creatorName,
            inviteUrl,
        });

        await submissionReference.update({
            candidateInviteGenerated: true,
            candidateInviteCode: inviteCode,
            candidateInviteUrl: inviteUrl,

            candidateInviteEmailSent: true,
            candidateInviteEmailSentAt:
                FieldValue.serverTimestamp(),
            candidateInviteEmailSentTo: email,
            candidateInviteEmailError: "",
            candidateInviteEmailSendCount:
                FieldValue.increment(1),

            candidateInviteSentByEmail:
                authorization.staff.emailAddress,
            candidateInviteSentByName:
                authorization.staff.displayName ||
                authorization.staff.emailAddress,

            updatedAt:
                FieldValue.serverTimestamp(),
        });

        const updatedSnapshot =
            await submissionReference.get();

        return NextResponse.json({
            ok: true,
            message:
                "The GeekOut Candidate invitation was emailed successfully.",
            record: {
                id: updatedSnapshot.id,
                ...(updatedSnapshot.data() || {}),
            },
        });
    } catch (error) {
        console.error(
            "Send GeekOut candidate invitation error:",
            error
        );

        if (submissionReference) {
            try {
                await submissionReference.update({
                    candidateInviteEmailSent:
                        hadPreviouslySentEmail,
                    candidateInviteEmailError:
                        error instanceof Error
                            ? error.message.slice(0, 500)
                            : "Unknown invitation error.",
                    updatedAt:
                        FieldValue.serverTimestamp(),
                });
            } catch (updateError) {
                console.error(
                    "Could not record candidate invitation error:",
                    updateError
                );
            }
        }

        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not send the GeekOut Candidate invitation.",
            },
            { status: 500 }
        );
    }
}