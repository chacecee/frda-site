import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    Timestamp,
} from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function timestampToIso(
    value: unknown
): string | null {
    if (
        value instanceof Timestamp ||
        (
            typeof value === "object" &&
            value !== null &&
            "toDate" in value &&
            typeof (
                value as {
                    toDate?: unknown;
                }
            ).toDate === "function"
        )
    ) {
        return (
            value as {
                toDate: () => Date;
            }
        )
            .toDate()
            .toISOString();
    }

    return null;
}

function sanitizePublicUrl(
    value: unknown
): string {
    if (typeof value !== "string") {
        return "";
    }

    try {
        const url = new URL(value);

        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {
            return "";
        }

        return url.toString();
    } catch {
        return "";
    }
}

function sanitizePublicYoutubeUrl(
    value: unknown
): string {
    const urlValue =
        sanitizePublicUrl(value);

    if (!urlValue) {
        return "";
    }

    try {
        const url = new URL(urlValue);
        const hostname =
            url.hostname
                .toLowerCase()
                .replace(/^www\./, "");

        let videoId = "";

        if (hostname === "youtu.be") {
            videoId =
                url.pathname
                    .split("/")
                    .filter(Boolean)[0] || "";
        } else if (
            hostname === "youtube.com" ||
            hostname === "m.youtube.com"
        ) {
            if (url.pathname === "/watch") {
                videoId =
                    url.searchParams.get("v") || "";
            } else {
                const parts =
                    url.pathname
                        .split("/")
                        .filter(Boolean);

                if (
                    parts[0] === "shorts" ||
                    parts[0] === "embed" ||
                    parts[0] === "live"
                ) {
                    videoId = parts[1] || "";
                }
            }
        }

        if (
            !/^[A-Za-z0-9_-]{6,20}$/.test(
                videoId
            )
        ) {
            return "";
        }

        return `https://www.youtube.com/watch?v=${videoId}`;
    } catch {
        return "";
    }
}

function getAvailabilityLabel(
    value: unknown
): string {
    switch (String(value || "")) {
        case "available":
            return "Available for work";

        case "limited":
            return "Limited availability";

        case "not_available":
            return "Not currently available";

        case "collaborations_only":
            return "Open to collaborations only";

        default:
            return "";
    }
}

function getPublicMediaOrder(
    value: unknown,
    images: Array<{
        id: string;
        url: string;
    }>,
    youtubeVideoUrl: string
) {
    const validImageIds =
        new Set(
            images.map(
                (image) => image.id
            )
        );

    const used =
        new Set<string>();

    const ordered: Array<{
        type: "image" | "youtube";
        id: string;
    }> = [];

    if (Array.isArray(value)) {
        value.forEach((item) => {
            const raw =
                typeof item === "object" &&
                item !== null
                    ? item as Record<
                        string,
                        unknown
                    >
                    : {};

            const type =
                raw.type === "image" ||
                raw.type === "youtube"
                    ? raw.type
                    : null;

            const id =
                String(raw.id || "");

            if (!type || !id) {
                return;
            }

            if (
                type === "image" &&
                !validImageIds.has(id)
            ) {
                return;
            }

            if (
                type === "youtube" &&
                (
                    !youtubeVideoUrl ||
                    id !== "youtube"
                )
            ) {
                return;
            }

            const key =
                `${type}:${id}`;

            if (used.has(key)) {
                return;
            }

            used.add(key);
            ordered.push({
                type,
                id,
            });
        });
    }

    if (
        youtubeVideoUrl &&
        !used.has(
            "youtube:youtube"
        )
    ) {
        ordered.push({
            type: "youtube",
            id: "youtube",
        });

        used.add(
            "youtube:youtube"
        );
    }

    images.forEach((image) => {
        const key =
            `image:${image.id}`;

        if (!used.has(key)) {
            ordered.push({
                type: "image",
                id: image.id,
            });

            used.add(key);
        }
    });

    return ordered;
}

function getPublicWorkSamples(
    value: unknown
) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .slice(0, 6)
        .map((item) => {
            const raw =
                typeof item === "object" &&
                    item !== null
                    ? item as Record<
                        string,
                        unknown
                    >
                    : {};

            const projectType =
                String(
                    raw.projectType || ""
                );

            const images = Array.isArray(
                raw.images
            )
                ? raw.images
                    .slice(0, 5)
                    .map((image) => {
                        const rawImage =
                            typeof image ===
                                "object" &&
                                image !== null
                                ? image as Record<
                                    string,
                                    unknown
                                >
                                : {};

                        return {
                            id: String(
                                rawImage.id || ""
                            ),

                            url:
                                sanitizePublicUrl(
                                    rawImage.url
                                ),
                        };
                    })
                    .filter(
                        (image) =>
                            Boolean(
                                image.id &&
                                image.url
                            )
                    )
                : [];

            const youtubeVideoUrl =
                sanitizePublicYoutubeUrl(
                    raw.youtubeVideoUrl
                );

            return {
                id: String(raw.id || ""),

                title:
                    String(
                        raw.title || ""
                    ).trim(),

                projectUrl:
                    sanitizePublicUrl(
                        raw.projectUrl
                    ),

                youtubeVideoUrl,

                mediaOrder:
                    getPublicMediaOrder(
                        raw.mediaOrder,
                        images,
                        youtubeVideoUrl
                    ),

                role:
                    String(
                        raw.role || ""
                    ).trim(),

                contribution:
                    String(
                        raw.contribution || ""
                    ).trim(),

                teamName:
                    String(
                        raw.teamName || ""
                    ).trim(),

                projectType:
                    projectType === "owned" ||
                        projectType === "team" ||
                        projectType === "client" ||
                        projectType === "other"
                        ? projectType
                        : "other",

                isInDevelopment:
                    raw.isInDevelopment ===
                    true,

                images,
            };
        })
        .filter((item) =>
            Boolean(
                item.id &&
                item.title &&
                item.role &&
                item.contribution
            )
        );
}

function getLegacyShowcaseImages(
    value: unknown
) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .flatMap((item) => {
            const raw =
                typeof item === "object" &&
                    item !== null
                    ? item as Record<
                        string,
                        unknown
                    >
                    : {};

            const projectId =
                String(raw.id || "");

            const projectTitle =
                String(
                    raw.title || ""
                ).trim();

            const images =
                Array.isArray(raw.images)
                    ? raw.images
                    : [];

            return images.map(
                (image) => {
                    const rawImage =
                        typeof image ===
                            "object" &&
                            image !== null
                            ? image as Record<
                                string,
                                unknown
                            >
                            : {};

                    return {
                        id:
                            `${projectId}-${String(
                                rawImage.id ||
                                ""
                            )}`,

                        url:
                            sanitizePublicUrl(
                                rawImage
                                    .showcaseUrl
                            ),

                        projectTitle,
                        projectUrl: "",

                        order:
                            typeof rawImage
                                .showcaseOrder ===
                                "number"
                                ? rawImage
                                    .showcaseOrder
                                : null,
                    };
                }
            );
        })
        .filter((image) =>
            Boolean(
                image.id &&
                image.url &&
                (
                    image.order === 1 ||
                    image.order === 2 ||
                    image.order === 3
                )
            )
        )
        .sort(
            (first, second) =>
                Number(first.order) -
                Number(second.order)
        )
        .slice(0, 3);
}

function getPublicCoverShowcaseImages(
    value: unknown,
    legacyWorkSamples: unknown
) {
    if (Array.isArray(value)) {
        const covers = value
            .slice(0, 3)
            .map((item) => {
                const raw =
                    typeof item ===
                        "object" &&
                        item !== null
                        ? item as Record<
                            string,
                            unknown
                        >
                        : {};

                return {
                    id:
                        String(
                            raw.id || ""
                        ),

                    url:
                        sanitizePublicUrl(
                            raw.url
                        ),

                    projectTitle: "",
                    projectUrl: "",

                    order:
                        typeof raw.order ===
                            "number"
                            ? raw.order
                            : null,
                };
            })
            .filter((image) =>
                Boolean(
                    image.id &&
                    image.url &&
                    (
                        image.order === 1 ||
                        image.order === 2 ||
                        image.order === 3
                    )
                )
            )
            .sort(
                (first, second) =>
                    Number(first.order) -
                    Number(second.order)
            );

        if (covers.length > 0) {
            return covers;
        }
    }

    return getLegacyShowcaseImages(
        legacyWorkSamples
    );
}

export async function GET(
    request: NextRequest,
    context: {
        params: Promise<{
            slug: string;
        }>;
    }
) {
    try {
        const { slug } =
            await context.params;

        const normalizedSlug =
            slug.trim().toLowerCase();

        if (!normalizedSlug) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Missing developer profile slug.",
                },
                { status: 400 }
            );
        }

        let snapshot = await adminDb
            .collection(
                "developerProfiles"
            )
            .where(
                "profileSlug",
                "==",
                normalizedSlug
            )
            .where(
                "isPublished",
                "==",
                true
            )
            .limit(1)
            .get();

        if (snapshot.empty) {
            snapshot = await adminDb
                .collection(
                    "developerProfiles"
                )
                .where(
                    "customSubdomain",
                    "==",
                    normalizedSlug
                )
                .where(
                    "isPublished",
                    "==",
                    true
                )
                .limit(1)
                .get();
        }

        if (snapshot.empty) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Developer profile not found.",
                },
                { status: 404 }
            );
        }

        const document =
            snapshot.docs[0];

        const profile =
            document.data();

        if (
            String(
                profile.profileStatus ||
                ""
            ) !== "live"
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Developer profile not found.",
                },
                { status: 404 }
            );
        }

        const memberId =
            String(
                profile.memberId || ""
            );

        if (memberId) {
            const memberSnapshot =
                await adminDb
                    .collection("members")
                    .doc(memberId)
                    .get();

            const memberStatus =
                String(
                    memberSnapshot
                        .data()
                        ?.memberStatus ||
                    "active"
                );

            if (
                memberStatus ===
                "suspended" ||
                memberStatus ===
                "inactive" ||
                memberStatus ===
                "removed"
            ) {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            "Developer profile not found.",
                    },
                    { status: 404 }
                );
            }
        }

        const skills =
            Array.isArray(
                profile.skills
            )
                ? profile.skills.filter(
                    (
                        value: unknown
                    ): value is string =>
                        typeof value ===
                        "string" &&
                        Boolean(
                            value.trim()
                        )
                )
                : [];

        return NextResponse.json({
            ok: true,

            profile: {
                uid: document.id,
                memberId,

                slug:
                    String(
                        profile.profileSlug ||
                        normalizedSlug
                    ),

                displayName:
                    String(
                        profile.displayName ||
                        "FRDA Developer"
                    ),

                headline:
                    String(
                        profile.headline || ""
                    ),

                bio:
                    String(
                        profile.bio || ""
                    ),

                skills,

                availability:
                    String(
                        profile.availability ||
                        ""
                    ),

                availabilityLabel:
                    getAvailabilityLabel(
                        profile.availability
                    ),

                portfolioUrl:
                    sanitizePublicUrl(
                        profile.portfolioUrl
                    ),

                avatarUrl:
                    sanitizePublicUrl(
                        profile.avatarUrl
                    ),

                workSamples:
                    getPublicWorkSamples(
                        profile.workSamples
                    ),

                showcaseImages:
                    getPublicCoverShowcaseImages(
                        profile.coverShowcaseImages,
                        profile.workSamples
                    ),

                publishedAt:
                    timestampToIso(
                        profile.publishedAt
                    ),

                updatedAt:
                    timestampToIso(
                        profile.updatedAt
                    ),

                isVerified:
                    profile.isVerified ===
                    true,

                isFeatured:
                    profile.isFeatured ===
                    true,
            },
        });
    } catch (error) {
        console.error(
            "Load public developer profile error:",
            error
        );

        return NextResponse.json(
            {
                ok: false,
                error:
                    "Could not load this developer profile.",
            },
            { status: 500 }
        );
    }
}