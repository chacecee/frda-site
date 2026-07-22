"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

export type PublicProjectImage = {
    id: string;
    url: string;
};

export type PublicProjectMedia = {
    type: "image" | "youtube";
    id: string;
    url: string;
};

type ProjectImageGalleryProps = {
    media: PublicProjectMedia[];
    title: string;
};

function getYouTubeVideoId(
    value: string
): string {
    if (!value) return "";

    try {
        const url = new URL(value);
        const hostname =
            url.hostname
                .toLowerCase()
                .replace(/^www\./, "");

        if (hostname === "youtu.be") {
            return (
                url.pathname
                    .split("/")
                    .filter(Boolean)[0] ||
                ""
            );
        }

        if (
            hostname === "youtube.com" ||
            hostname === "m.youtube.com"
        ) {
            if (url.pathname === "/watch") {
                return (
                    url.searchParams.get("v") ||
                    ""
                );
            }

            const parts =
                url.pathname
                    .split("/")
                    .filter(Boolean);

            if (
                parts[0] === "shorts" ||
                parts[0] === "embed" ||
                parts[0] === "live"
            ) {
                return parts[1] || "";
            }
        }
    } catch {
        return "";
    }

    return "";
}

export default function ProjectImageGallery({
    media,
    title,
}: ProjectImageGalleryProps) {
    const [activeIndex, setActiveIndex] =
        useState(0);

    const touchStartX =
        useRef<number | null>(null);

    useEffect(() => {
        media.forEach((item) => {
            if (item.type !== "image") {
                return;
            }

            const preload = new Image();
            preload.src = item.url;
        });
    }, [media]);

    useEffect(() => {
        if (activeIndex >= media.length) {
            setActiveIndex(0);
        }
    }, [activeIndex, media.length]);

    if (media.length === 0) {
        return null;
    }

    function showPrevious() {
        setActiveIndex((current) =>
            current === 0
                ? media.length - 1
                : current - 1
        );
    }

    function showNext() {
        setActiveIndex((current) =>
            current === media.length - 1
                ? 0
                : current + 1
        );
    }

    function handleTouchStart(
        event: React.TouchEvent<HTMLDivElement>
    ) {
        if (
            activeMedia?.type ===
            "youtube"
        ) {
            touchStartX.current = null;
            return;
        }

        touchStartX.current =
            event.touches[0]?.clientX ?? null;
    }

    function handleTouchEnd(
        event: React.TouchEvent<HTMLDivElement>
    ) {
        if (
            activeMedia?.type ===
            "youtube"
        ) {
            touchStartX.current = null;
            return;
        }

        if (touchStartX.current === null) {
            return;
        }

        const endX =
            event.changedTouches[0]?.clientX ??
            touchStartX.current;

        const distance =
            endX - touchStartX.current;

        touchStartX.current = null;

        if (Math.abs(distance) < 45) {
            return;
        }

        if (distance > 0) {
            showPrevious();
        } else {
            showNext();
        }
    }

    const activeMedia =
        media[activeIndex];

    const youtubeVideoId =
        activeMedia?.type === "youtube"
            ? getYouTubeVideoId(
                activeMedia.url
            )
            : "";

    return (
        <div
            className="relative aspect-video overflow-hidden bg-black/40"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {activeMedia?.type === "image" ? (
                <img
                    key={activeMedia.id}
                    src={activeMedia.url}
                    alt={`${title} preview ${activeIndex + 1}`}
                    className="h-full w-full object-contain"
                />
            ) : youtubeVideoId ? (
                <iframe
                    key={activeMedia.id}
                    src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?playsinline=1`}
                    title={`${title} video`}
                    className="relative z-0 h-full w-full touch-auto"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            ) : null}

            {media.length > 1 ? (
                <>
                    <button
                        type="button"
                        onClick={showPrevious}
                        className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center bg-black/70 text-xl text-white backdrop-blur-sm transition hover:bg-black/85 sm:left-3 sm:h-10 sm:w-10 sm:text-2xl"
                        style={{ borderRadius: 5 }}
                        aria-label="Previous project media"
                    >
                        ‹
                    </button>

                    <button
                        type="button"
                        onClick={showNext}
                        className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center bg-black/70 text-xl text-white backdrop-blur-sm transition hover:bg-black/85 sm:right-3 sm:h-10 sm:w-10 sm:text-2xl"
                        style={{ borderRadius: 5 }}
                        aria-label="Next project media"
                    >
                        ›
                    </button>

                    <span
                        className="absolute bottom-3 right-3 z-10 bg-black/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
                        style={{ borderRadius: 5 }}
                    >
                        {activeIndex + 1} / {media.length}
                    </span>
                </>
            ) : null}
        </div>
    );
}