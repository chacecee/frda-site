import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import StatusTrackerClient from "./StatusTrackerClient";

type StatusPageProps = {
    params: Promise<{
        applicationId: string;
    }>;
    searchParams: Promise<{
        token?: string;
    }>;
};

type CorrectionRequest = {
    fieldKey:
    | "roblox"
    | "placeLink"
    | "placeContribution"
    | "supportingLinks"
    | "facebookProfile"
    | "discordId"
    | "email";
    label: string;
    note?: string;
};

type ApplicationRecord = {
    firstName?: string;
    lastName?: string;
    email?: string;
    discordId?: string;
    facebookProfile?: string;
    roblox?: string;
    placeLink?: string;
    placeContribution?: string;
    supportingLinks?: string;
    verificationCode?: string;
    discordInviteUrl?: string | null;
    status?: string;
    trackerToken?: string;
    reviewerNote?: string | null;
    correctionRequests?: CorrectionRequest[];
    applicantResubmittedAt?: string | null;
};

function serializeApplicationForClient(raw: Record<string, unknown>): ApplicationRecord {
    const applicantResubmittedAt =
        raw.applicantResubmittedAt &&
            typeof raw.applicantResubmittedAt === "object" &&
            raw.applicantResubmittedAt !== null &&
            "toDate" in raw.applicantResubmittedAt &&
            typeof (raw.applicantResubmittedAt as { toDate: () => Date }).toDate === "function"
            ? (raw.applicantResubmittedAt as { toDate: () => Date }).toDate().toISOString()
            : null;

    return {
        firstName: typeof raw.firstName === "string" ? raw.firstName : "",
        lastName: typeof raw.lastName === "string" ? raw.lastName : "",
        email: typeof raw.email === "string" ? raw.email : "",
        discordId: typeof raw.discordId === "string" ? raw.discordId : "",
        facebookProfile:
            typeof raw.facebookProfile === "string" ? raw.facebookProfile : "",
        roblox: typeof raw.roblox === "string" ? raw.roblox : "",
        placeLink: typeof raw.placeLink === "string" ? raw.placeLink : "",
        placeContribution:
            typeof raw.placeContribution === "string" ? raw.placeContribution : "",
        supportingLinks:
            typeof raw.supportingLinks === "string" ? raw.supportingLinks : "",
        verificationCode:
            typeof raw.verificationCode === "string" ? raw.verificationCode : "",
        discordInviteUrl:
            typeof raw.discordInviteUrl === "string" ? raw.discordInviteUrl : "",
        status: typeof raw.status === "string" ? raw.status : "",
        trackerToken: typeof raw.trackerToken === "string" ? raw.trackerToken : "",
        reviewerNote:
            typeof raw.reviewerNote === "string" ? raw.reviewerNote : null,
        correctionRequests: Array.isArray(raw.correctionRequests)
            ? (raw.correctionRequests as Array<CorrectionRequest | { fieldKey?: string; label?: string; note?: string }>)
                .filter((item) => item.fieldKey !== "idPhoto")
                .filter((item): item is CorrectionRequest =>
                    item.fieldKey === "roblox" ||
                    item.fieldKey === "placeLink" ||
                    item.fieldKey === "placeContribution" ||
                    item.fieldKey === "supportingLinks" ||
                    item.fieldKey === "facebookProfile" ||
                    item.fieldKey === "discordId" ||
                    item.fieldKey === "email"
                )
            : [],
        applicantResubmittedAt,
    };
}

export default async function ApplicationStatusPage({
    params,
    searchParams,
}: StatusPageProps) {
    const { applicationId } = await params;
    const { token } = await searchParams;

    if (!token) notFound();

    const docSnap = await adminDb.collection("applications").doc(applicationId).get();
    if (!docSnap.exists) notFound();

    const rawApp = docSnap.data() as Record<string, unknown>;
    if (!rawApp?.trackerToken || rawApp.trackerToken !== token) notFound();

    const app = serializeApplicationForClient(rawApp);

    return (
        <StatusTrackerClient
            applicationId={applicationId}
            token={token}
            initialApp={app}
        />
    );
}