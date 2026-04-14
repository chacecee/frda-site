import { NextResponse } from "next/server";
import { getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type CorrectionFieldKey =
    | "roblox"
    | "placeLink"
    | "placeContribution"
    | "supportingLinks"
    | "facebookProfile"
    | "discordId"
    | "email"
    | "idPhoto";

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

function fileExtensionFromType(contentType?: string) {
    switch (contentType) {
        case "image/jpeg":
            return "jpg";
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        default:
            return "jpg";
    }
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

        if (requestedKeys.has("idPhoto")) {
            const idFileEntry = formData.get("idFile");

            if (!(idFileEntry instanceof File) || idFileEntry.size === 0) {
                return NextResponse.json(
                    { error: "A replacement ID photo is required." },
                    { status: 400 }
                );
            }

            const buffer = Buffer.from(await idFileEntry.arrayBuffer());

            const appInstance = getApps()[0];
            if (!appInstance) {
                return NextResponse.json(
                    { error: "Firebase Admin is not initialized." },
                    { status: 500 }
                );
            }

            const ext = fileExtensionFromType(idFileEntry.type);
            const storagePath = `application_ids/${applicationId}/updated-id-${Date.now()}.${ext}`;

            const bucket = getStorage(appInstance).bucket();
            const storageFile = bucket.file(storagePath);

            await storageFile.save(buffer, {
                metadata: {
                    contentType: idFileEntry.type || "image/jpeg",
                },
                resumable: false,
            });

            const [signedUrl] = await storageFile.getSignedUrl({
                action: "read",
                expires: "03-01-2500",
            });

            updates.idFileUrl = signedUrl;
            updates.idFilePath = storagePath;
            updates.idFileName = idFileEntry.name || `updated-id.${ext}`;
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