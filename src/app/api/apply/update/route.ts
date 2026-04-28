import { NextResponse } from "next/server";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type CorrectionFieldKey =
    | "roblox"
    | "placeLink"
    | "placeContribution"
    | "supportingLinks"
    | "facebookProfile"
    | "discordId"
    | "email";

type CorrectionRequest = {
    fieldKey: CorrectionFieldKey;
    label: string;
    note?: string;
};

function safeString(value: FormDataEntryValue | null) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeOptional(value: string) {
    return value.trim() || "";
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        const applicationId = safeString(formData.get("applicationId"));
        const token = safeString(formData.get("token"));

        if (!applicationId || !token) {
            return NextResponse.json(
                { error: "Missing application ID or token." },
                { status: 400 }
            );
        }

        const docRef = adminDb.collection("applications").doc(applicationId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json(
                { error: "Application not found." },
                { status: 404 }
            );
        }

        const app = docSnap.data() as {
            trackerToken?: string;
            status?: string;
            correctionRequests?: CorrectionRequest[];
        };

        if (!app?.trackerToken || app.trackerToken !== token) {
            return NextResponse.json({ error: "Invalid token." }, { status: 403 });
        }

        if (app.status !== "needs_more_info") {
            return NextResponse.json(
                { error: "This application is not currently awaiting more information." },
                { status: 400 }
            );
        }

        const requestedFields = Array.isArray(app.correctionRequests)
            ? app.correctionRequests
            : [];

        const requestedKeys = new Set(requestedFields.map((item) => item.fieldKey));

        const updates: Record<string, unknown> = {
            status: "manual_review",
            correctionRequests: [],
            reviewerNote: "",
            correctionRequestedAt: null,
            correctedFieldKeys: Array.from(requestedKeys),
            correctedFieldLabels: requestedFields.map((item) => item.label),
            applicantResubmittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (requestedKeys.has("email")) {
            const email = safeString(formData.get("email"));
            if (!email) {
                return NextResponse.json(
                    { error: "Email is required." },
                    { status: 400 }
                );
            }
            updates.email = email;
        }

        if (requestedKeys.has("facebookProfile")) {
            updates.facebookProfile = normalizeOptional(
                safeString(formData.get("facebookProfile"))
            );
        }

        if (requestedKeys.has("discordId")) {
            updates.discordId = normalizeOptional(safeString(formData.get("discordId")));
        }

        if (requestedKeys.has("roblox")) {
            updates.roblox = normalizeOptional(safeString(formData.get("roblox")));
        }

        if (requestedKeys.has("placeLink")) {
            updates.placeLink = normalizeOptional(safeString(formData.get("placeLink")));
        }

        if (requestedKeys.has("placeContribution")) {
            updates.placeContribution = normalizeOptional(
                safeString(formData.get("placeContribution"))
            );
        }

        if (requestedKeys.has("supportingLinks")) {
            updates.supportingLinks = normalizeOptional(
                safeString(formData.get("supportingLinks"))
            );
        }

        await docRef.update(updates);

        await docRef.collection("activityLogs").add({
            type: "applicant_submitted_corrections",
            message: "Applicant submitted the requested corrections or additional information.",
            actorType: "applicant",
            actorEmail: null,
            actorName: "Applicant",
            createdAt: FieldValue.serverTimestamp(),
            meta: {
                correctedFieldKeys: Array.from(requestedKeys),
                correctedFieldLabels: requestedFields.map((item) => item.label),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Applicant correction update error:", error);
        return NextResponse.json(
            { error: "Could not submit updated information." },
            { status: 500 }
        );
    }
}