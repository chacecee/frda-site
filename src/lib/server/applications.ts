import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
    ApplicationStatus,
    DecisionType,
    VerificationResult,
} from "@/lib/server/applicationStatus";
import {
    generateTrackerToken,
    generateVerificationCode,
} from "@/lib/server/applicationCodes";
import { createApplicationLog } from "@/lib/server/applicationLogs";

export type CreateApplicationInput = {
    firstName: string;
    lastName: string;
    email: string;
    age: number;
    region: string;
    skills: string;
    organization: string;
    roblox: string;
    discordId: string;
    facebookProfile: string;
    placeLink: string;
    placeContribution: string;
    supportingLinks: string;
};

export async function createApplication(input: CreateApplicationInput) {
    const verificationCode = generateVerificationCode();
    const trackerToken = generateTrackerToken();

    const docRef = await adminDb.collection("applications").add({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        age: input.age,
        region: input.region,
        skills: input.skills,
        organization: input.organization,
        roblox: input.roblox,
        discordId: input.discordId,
        facebookProfile: input.facebookProfile,
        placeLink: input.placeLink,
        placeContribution: input.placeContribution,
        supportingLinks: input.supportingLinks,

        status: "application_sent" as ApplicationStatus,
        decisionType: null as DecisionType,

        verificationCode,
        verificationRequestedAt: null,
        verificationResult: "pending" as VerificationResult,
        verificationMethod: null,
        verificationAttempts: 0,

        trackerToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),

        reviewerName: null,
        reviewerEmail: null,
        reviewerNote: null,
        correctionFields: [],

        discordInviteCode: null,
        discordInviteUrl: null,
        discordInviteSentAt: null,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    await createApplicationLog({
        applicationId: docRef.id,
        type: "application_submitted",
        actorType: "applicant",
        actorName: `${input.firstName} ${input.lastName}`.trim(),
        actorEmail: input.email,
        message: "Application submitted.",
        meta: {
            email: input.email,
            roblox: input.roblox,
            discordId: input.discordId,
            facebookProfile: input.facebookProfile,
            placeLink: input.placeLink,
            placeContribution: input.placeContribution,
            supportingLinks: input.supportingLinks,
        },
    });

    return {
        applicationId: docRef.id,
        verificationCode,
        trackerToken,
    };
}