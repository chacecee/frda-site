import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ applicationId: string }> }
) {
    try {
        const { applicationId } = await context.params;
        const token = request.nextUrl.searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Missing token." }, { status: 400 });
        }

        const docSnap = await adminDb.collection("applications").doc(applicationId).get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Application not found." }, { status: 404 });
        }

        const app = docSnap.data();

        if (!app?.trackerToken || app.trackerToken !== token) {
            return NextResponse.json({ error: "Invalid token." }, { status: 403 });
        }

        return NextResponse.json({
            application: {
                firstName: app.firstName || "",
                lastName: app.lastName || "",
                email: app.email || "",
                discordId: app.discordId || "",
                facebookProfile: app.facebookProfile || "",
                roblox: app.roblox || "",
                placeLink: app.placeLink || "",
                placeContribution: app.placeContribution || "",
                supportingLinks: app.supportingLinks || "",
                verificationCode: app.verificationCode || "",
                discordInviteUrl: app.discordInviteUrl || "",
                status: app.status || "",
                trackerToken: app.trackerToken || "",
                reviewerNote: app.reviewerNote || "",
                correctionRequests: Array.isArray(app.correctionRequests)
                    ? app.correctionRequests
                    : [],
                applicantResubmittedAt: app.applicantResubmittedAt || null,
            },
        });
    } catch (error) {
        console.error("Application status API error:", error);
        return NextResponse.json(
            { error: "Could not load application status." },
            { status: 500 }
        );
    }
}