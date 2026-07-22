import {
    NextResponse,
} from "next/server";

import {
    adminDb,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function sanitizeUrl(
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

function getStandaloneCovers(
    value: unknown
) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
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
                url:
                    sanitizeUrl(
                        raw.url
                    ),

                order:
                    typeof raw.order ===
                        "number"
                        ? raw.order
                        : null,
            };
        })
        .filter((image) =>
            Boolean(
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
}

function getLegacyProjectCovers(
    value: unknown
) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .flatMap((item) => {
            const raw =
                typeof item ===
                    "object" &&
                item !== null
                    ? item as Record<
                        string,
                        unknown
                    >
                    : {};

            const projectImages =
                Array.isArray(
                    raw.images
                )
                    ? raw.images
                    : [];

            return projectImages.map(
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
                        url:
                            sanitizeUrl(
                                rawImage
                                    .showcaseUrl
                            ),

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

function getDirectoryShowcase(
    standaloneValue: unknown,
    legacyWorkSamples: unknown
) {
    const standalone =
        getStandaloneCovers(
            standaloneValue
        );

    const images =
        standalone.length > 0
            ? standalone
            : getLegacyProjectCovers(
                legacyWorkSamples
            );

    return {
        images: images.map(
            (image, index) => ({
                id: `cover-${index + 1}`,
                url: image.url,
                order:
                    image.order === 1 ||
                    image.order === 2 ||
                    image.order === 3
                        ? image.order
                        : index + 1,
            })
        ),

        previewUrl:
            images[0]?.url || "",

        showcaseCount:
            images.length,
    };
}

export async function GET() {
    try {
        const snapshot =
            await adminDb
                .collection(
                    "developerProfiles"
                )
                .where(
                    "isPublished",
                    "==",
                    true
                )
                .get();

        const developers =
            snapshot.docs
                .map((document) => {
                    const profile =
                        document.data();

                    if (
                        String(
                            profile
                                .profileStatus ||
                            ""
                        ) !== "live"
                    ) {
                        return null;
                    }

                    const skills =
                        Array.isArray(
                            profile.skills
                        )
                            ? profile.skills
                                .filter(
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

                    const showcase =
                        getDirectoryShowcase(
                            profile
                                .coverShowcaseImages,

                            profile.workSamples
                        );

                    return {
                        uid: document.id,

                        memberId:
                            String(
                                profile.memberId ||
                                ""
                            ),

                        slug:
                            String(
                                profile
                                    .profileSlug ||
                                ""
                            ),

                        customSubdomain:
                            String(
                                profile
                                    .customSubdomain ||
                                ""
                            ),

                        displayName:
                            String(
                                profile
                                    .displayName ||
                                "FRDA Developer"
                            ),

                        headline:
                            String(
                                profile.headline ||
                                ""
                            ),

                        bio:
                            String(
                                profile.bio || ""
                            ),

                        skills,

                        availability:
                            String(
                                profile
                                    .availability ||
                                ""
                            ),

                        availabilityLabel:
                            getAvailabilityLabel(
                                profile
                                    .availability
                            ),

                        avatarUrl:
                            sanitizeUrl(
                                profile.avatarUrl
                            ),

                        showcaseImages:
                            showcase.images,

                        showcasePreviewUrl:
                            showcase.previewUrl,

                        showcaseCount:
                            showcase
                                .showcaseCount,

                        isVerified:
                            profile.isVerified ===
                            true,

                        isFeatured:
                            profile.isFeatured ===
                            true,
                    };
                })
                .filter(
                    (
                        item
                    ): item is NonNullable<
                        typeof item
                    > =>
                        item !== null
                );

        developers.sort(
            (first, second) => {
                if (
                    first.isFeatured !==
                    second.isFeatured
                ) {
                    return first.isFeatured
                        ? -1
                        : 1;
                }

                return first
                    .displayName
                    .localeCompare(
                        second.displayName
                    );
            }
        );

        return NextResponse.json({
            ok: true,
            developers,
        });
    } catch (error) {
        console.error(
            "Load public developer directory error:",
            error
        );

        return NextResponse.json(
            {
                ok: false,
                error:
                    "Could not load the developer directory.",
            },
            { status: 500 }
        );
    }
}