import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import {
    GAME_CONTENT_MATURITY_OPTIONS,
    GAME_GENRE_OPTIONS,
    isProbablyRobloxGameUrl,
    normalizeGameContentMaturity,
    normalizeGameGenre,
} from "@/lib/gameDirectory";

export const runtime = "nodejs";

const DESCRIPTION_LIMIT = 500;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const globalForSubmitRateLimit = globalThis as unknown as {
    gameSubmitRateLimit?: Map<string, { count: number; resetAt: number }>;
};

const rateLimitStore =
    globalForSubmitRateLimit.gameSubmitRateLimit ||
    new Map<string, { count: number; resetAt: number }>();

globalForSubmitRateLimit.gameSubmitRateLimit = rateLimitStore;

function getClientIp(request: NextRequest) {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
    );
}

function isRateLimited(ip: string) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const maxSubmissions = 5;

    const existing = rateLimitStore.get(ip);

    if (!existing || existing.resetAt < now) {
        rateLimitStore.set(ip, {
            count: 1,
            resetAt: now + windowMs,
        });
        return false;
    }

    existing.count += 1;
    rateLimitStore.set(ip, existing);

    return existing.count > maxSubmissions;
}

function cleanString(value: FormDataEntryValue | null, maxLength = 500) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

function cleanEmail(value: string) {
    return value.trim().toLowerCase().slice(0, 180);
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanRobloxUrl(value: string) {
    const trimmed = value.trim();

    try {
        const url = new URL(trimmed);
        return url.toString();
    } catch {
        return trimmed;
    }
}

function getFileExtension(file: File) {
    if (file.type === "image/png") return "png";
    if (file.type === "image/webp") return "webp";
    return "jpg";
}

function validateImageFile(file: File | null) {
    if (!file || file.size === 0) return "";

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return "Please upload JPG, PNG, or WEBP images only.";
    }

    if (file.size > MAX_FILE_SIZE) {
        return "Each uploaded image must be smaller than 5MB.";
    }

    return "";
}

async function uploadSubmissionImage(args: {
    file: File;
    folder: "thumbnails" | "covers";
    submissionId: string;
}) {
    const extension = getFileExtension(args.file);
    const safeBase = `${Date.now()}-${crypto.randomUUID()}`;
    const imagePath = `game-directory/submissions/${args.submissionId}/${args.folder}/${safeBase}.${extension}`;

    const arrayBuffer = await args.file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(imagePath);

    await storageFile.save(buffer, {
        metadata: {
            contentType: args.file.type,
            cacheControl: "public, max-age=31536000",
        },
    });

    await storageFile.makePublic();

    return {
        imagePath,
        imageUrl: `https://storage.googleapis.com/${bucket.name}/${imagePath}`,
    };
}

async function hasDuplicateRobloxUrl(robloxUrl: string) {
    const snapshot = await adminDb
        .collection("gameDirectory")
        .where("robloxUrl", "==", robloxUrl)
        .limit(1)
        .get();

    return !snapshot.empty;
}

function normalizeMemberId(value: string) {
    const cleaned = value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "");

    if (!cleaned) return "";

    if (cleaned.startsWith("FRDAM")) {
        const code = cleaned.replace("FRDAM", "");
        return code ? `FRDA-M-${code}` : "";
    }

    if (cleaned.startsWith("FRDA")) {
        const code = cleaned.replace("FRDA", "").replace(/^M/, "");
        return code ? `FRDA-M-${code}` : "";
    }

    return `FRDA-M-${cleaned}`;
}

type VerifiedMember = {
    applicationId: string;
    memberId: string;
    email: string;
    fullName: string;
    listingLimit: number;
    paidListingCredits: number;
    sponsoredPlacementsPurchased: number;
};

async function verifyMemberForSubmission(args: {
    memberId: string;
    contactEmail: string;
}): Promise<
    | { ok: true; member: VerifiedMember }
    | { ok: false; error: string; status: number }
> {
    const normalizedMemberId = normalizeMemberId(args.memberId);
    const normalizedEmail = cleanEmail(args.contactEmail);

    const snapshot = await adminDb
        .collection("applications")
        .where("memberId", "==", normalizedMemberId)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return {
            ok: false,
            status: 404,
            error:
                "This FRDA Member ID does not exist in our system. Please check your ID or apply as a developer first.",
        };
    }

    const memberDoc = snapshot.docs[0];
    const data = memberDoc.data() as {
        firstName?: string;
        lastName?: string;
        email?: string;
        status?: string;
        memberId?: string;
        memberStatus?: string;
        memberListingLimit?: number;
        paidListingCredits?: number;
        sponsoredPlacementsPurchased?: number;
    };

    if (data.status !== "accepted") {
        return {
            ok: false,
            status: 403,
            error:
                "This FRDA Member ID is not tied to an accepted developer account yet.",
        };
    }

    if (data.memberStatus && data.memberStatus !== "active") {
        return {
            ok: false,
            status: 403,
            error:
                "This FRDA Member ID is not currently active. Please contact moderator@frdaph.org for help.",
        };
    }

    const registeredEmail = cleanEmail(data.email || "");

    if (registeredEmail !== normalizedEmail) {
        return {
            ok: false,
            status: 403,
            error:
                "The email you entered does not match the email tied to this FRDA Member ID.",
        };
    }

    return {
        ok: true,
        member: {
            applicationId: memberDoc.id,
            memberId: data.memberId || normalizedMemberId,
            email: registeredEmail,
            fullName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
            listingLimit: Number(data.memberListingLimit || 3),
            paidListingCredits: Number(data.paidListingCredits || 0),
            sponsoredPlacementsPurchased: Number(
                data.sponsoredPlacementsPurchased || 0
            ),
        },
    };
}

async function countActiveListingsForMember(memberId: string) {
    const activeStatuses = new Set(["for_approval", "pending", "published"]);

    const snapshot = await adminDb
        .collection("gameDirectory")
        .where("memberId", "==", normalizeMemberId(memberId))
        .get();

    return snapshot.docs.filter((docSnap) => {
        const data = docSnap.data() as { status?: string };
        return activeStatuses.has(data.status || "");
    }).length;
}

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIp(request);

        if (isRateLimited(ip)) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Too many submissions were sent from this connection. Please try again later.",
                },
                { status: 429 }
            );
        }

        const formData = await request.formData();

        const honeypot = cleanString(formData.get("companyWebsite"), 200);
        if (honeypot) {
            return NextResponse.json({ ok: true });
        }

        const formStartedAt = Number(cleanString(formData.get("formStartedAt"), 30));
        const now = Date.now();

        if (!formStartedAt || now - formStartedAt < 5000) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Please review the form before submitting.",
                },
                { status: 400 }
            );
        }

        const memberId = normalizeMemberId(cleanString(formData.get("memberId"), 80));
        const contactEmail = cleanEmail(cleanString(formData.get("contactEmail"), 180));
        const title = cleanString(formData.get("title"), 120);
        const description = cleanString(formData.get("description"), DESCRIPTION_LIMIT + 20);
        const robloxUrl = cleanRobloxUrl(cleanString(formData.get("robloxUrl"), 500));
        const creatorName = cleanString(formData.get("creatorName"), 120);
        const creatorTypeRaw = cleanString(formData.get("creatorType"), 40);
        const creatorType = creatorTypeRaw === "group" ? "group" : "individual";
        const genre = normalizeGameGenre(cleanString(formData.get("genre"), 80));
        const contentMaturity = normalizeGameContentMaturity(
            cleanString(formData.get("contentMaturity"), 80)
        );

        const thumbnailFile = formData.get("thumbnail") as File | null;

        if (!memberId) {
            return NextResponse.json(
                { ok: false, error: "Please enter your FRDA member ID." },
                { status: 400 }
            );
        }

        if (!contactEmail || !isValidEmail(contactEmail)) {
            return NextResponse.json(
                { ok: false, error: "Please enter a valid contact email." },
                { status: 400 }
            );
        }

        if (!title) {
            return NextResponse.json(
                { ok: false, error: "Please enter your game title." },
                { status: 400 }
            );
        }

        if (!creatorName) {
            return NextResponse.json(
                { ok: false, error: "Please enter the developer or group name." },
                { status: 400 }
            );
        }

        if (!description) {
            return NextResponse.json(
                { ok: false, error: "Please enter a short game description." },
                { status: 400 }
            );
        }

        if (description.length > DESCRIPTION_LIMIT) {
            return NextResponse.json(
                {
                    ok: false,
                    error: `Description must be ${DESCRIPTION_LIMIT} characters or less.`,
                },
                { status: 400 }
            );
        }

        if (!robloxUrl || !isProbablyRobloxGameUrl(robloxUrl)) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Please enter a valid Roblox game, share, or community link.",
                },
                { status: 400 }
            );
        }

        const validGenreValues = GAME_GENRE_OPTIONS.map((item) => item.value);
        if (!validGenreValues.includes(genre)) {
            return NextResponse.json(
                { ok: false, error: "Please choose a valid genre." },
                { status: 400 }
            );
        }

        const validMaturityValues = GAME_CONTENT_MATURITY_OPTIONS.map(
            (item) => item.value
        );
        if (!validMaturityValues.includes(contentMaturity)) {
            return NextResponse.json(
                { ok: false, error: "Please choose a valid content maturity level." },
                { status: 400 }
            );
        }

        if (!thumbnailFile || thumbnailFile.size === 0) {
            return NextResponse.json(
                { ok: false, error: "Please upload a thumbnail image for your game." },
                { status: 400 }
            );
        }

        const thumbnailError = validateImageFile(thumbnailFile);
        if (thumbnailError) {
            return NextResponse.json(
                { ok: false, error: thumbnailError },
                { status: 400 }
            );
        }
        const verifiedMemberResult = await verifyMemberForSubmission({
            memberId,
            contactEmail,
        });

        if (!verifiedMemberResult.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    error: verifiedMemberResult.error,
                },
                { status: verifiedMemberResult.status }
            );
        }

        const verifiedMember = verifiedMemberResult.member;
        const activeListingCount = await countActiveListingsForMember(
            verifiedMember.memberId
        );

        const totalAllowedListings =
            verifiedMember.listingLimit + verifiedMember.paidListingCredits;

        if (activeListingCount >= totalAllowedListings) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "You already have 3 active directory listings. To submit another game, please email moderator@frdaph.org to request a listing replacement or ask about additional paid listings.",
                },
                { status: 403 }
            );
        }

        const duplicateExists = await hasDuplicateRobloxUrl(robloxUrl);

        if (duplicateExists) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "This Roblox experience has already been submitted or listed. Please contact admin@frdaph.org if this seems incorrect.",
                },
                { status: 409 }
            );
        }

        const submissionId = crypto.randomUUID();

        let thumbnailUrl = "";
        let thumbnailPath = "";

        if (thumbnailFile && thumbnailFile.size > 0) {
            const uploadedThumbnail = await uploadSubmissionImage({
                file: thumbnailFile,
                folder: "thumbnails",
                submissionId,
            });

            thumbnailUrl = uploadedThumbnail.imageUrl;
            thumbnailPath = uploadedThumbnail.imagePath;
        }

        const docRef = await adminDb.collection("gameDirectory").add({
            title,
            description,
            robloxUrl,

            creatorName,
            creatorType,
            memberId: verifiedMember.memberId,
            memberApplicationId: verifiedMember.applicationId,
            memberEmailSnapshot: verifiedMember.email,
            memberNameSnapshot: verifiedMember.fullName,

            listingSlotType: "free",
            listingLimitAtSubmission: verifiedMember.listingLimit,
            paidListingCreditsAtSubmission: verifiedMember.paidListingCredits,
            activeListingCountAtSubmission: activeListingCount + 1,

            genre,
            contentMaturity,

            thumbnailUrl,
            thumbnailPath,
            coverImageUrl: "",
            coverImagePath: "",

            isSponsored: false,
            isHighlighted: false,
            isHiddenFromPublic: true,

            status: "for_approval",
            source: "member_submission",

            submittedByName: creatorName,
            submittedByEmail: verifiedMember.email,
            submittedByMemberId: verifiedMember.memberId,
            submittedAt: FieldValue.serverTimestamp(),

            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),

            submissionMeta: {
                ipCountry: request.headers.get("x-vercel-ip-country") || "",
                userAgent: request.headers.get("user-agent") || "",
            },
        });

        return NextResponse.json({
            ok: true,
            id: docRef.id,
        });
    } catch (error) {
        console.error("Game submission error:", error);

        return NextResponse.json(
            {
                ok: false,
                error: "Could not submit your game right now. Please try again.",
            },
            { status: 500 }
        );
    }
}