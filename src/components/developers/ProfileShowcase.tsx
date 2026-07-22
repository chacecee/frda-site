"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

export type PublicShowcaseImage = {
    id: string;
    url: string;
    projectTitle?: string;
    projectUrl?: string;
    order: number;
};

type ProfileShowcaseProps = {
    images: PublicShowcaseImage[];
    blended?: boolean;
};

export default function ProfileShowcase({
    images,
    blended = false,
}: ProfileShowcaseProps) {
    const [activeIndex, setActiveIndex] =
        useState(0);

    const [isPaused, setIsPaused] =
        useState(false);

    const [loadedImages, setLoadedImages] =
        useState<Record<string, boolean>>({});

    const touchStartX =
        useRef<number | null>(null);

    useEffect(() => {
        images.forEach((image) => {
            const preload = new Image();
            preload.src = image.url;
        });
    }, [images]);

    useEffect(() => {
        if (activeIndex >= images.length) {
            setActiveIndex(0);
        }
    }, [activeIndex, images.length]);

    useEffect(() => {
        if (
            images.length <= 1 ||
            isPaused
        ) {
            return;
        }

        const timer = window.setInterval(
            () => {
                setActiveIndex((current) =>
                    current === images.length - 1
                        ? 0
                        : current + 1
                );
            },
            5500
        );

        return () => {
            window.clearInterval(timer);
        };
    }, [
        images.length,
        isPaused,
    ]);

    if (images.length === 0) {
        return null;
    }

    function showPrevious() {
        setActiveIndex((current) =>
            current === 0
                ? images.length - 1
                : current - 1
        );
    }

    function showNext() {
        setActiveIndex((current) =>
            current === images.length - 1
                ? 0
                : current + 1
        );
    }

    function handleTouchStart(
        event: React.TouchEvent<HTMLDivElement>
    ) {
        touchStartX.current =
            event.touches[0]?.clientX ?? null;
    }

    function handleTouchEnd(
        event: React.TouchEvent<HTMLDivElement>
    ) {
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

    return (
        <div
            className={`group relative h-full w-full overflow-hidden bg-black/30 ${
                blended
                    ? ""
                    : "aspect-video border border-white/10"
            }`}
            style={{
                borderRadius: blended ? 0 : 8,
            }}
            onMouseEnter={() =>
                setIsPaused(true)
            }
            onMouseLeave={() =>
                setIsPaused(false)
            }
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {!loadedImages[images[activeIndex]?.id] ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                </div>
            ) : null}

            {images.map((image, index) => (
                <img
                    key={image.id}
                    src={image.url}
                    alt=""
                    onLoad={() =>
                        setLoadedImages(
                            (current) => ({
                                ...current,
                                [image.id]: true,
                            })
                        )
                    }
                    onError={() =>
                        setLoadedImages(
                            (current) => ({
                                ...current,
                                [image.id]: true,
                            })
                        )
                    }
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
                        index === activeIndex &&
                        loadedImages[image.id]
                            ? "opacity-100"
                            : "pointer-events-none opacity-0"
                    }`}
                />
            ))}

            {blended ? (
                <>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a172a]/35 via-transparent to-black/10 lg:hidden" />

                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-[48%] bg-gradient-to-r from-[#0a172a] via-[#0a172a]/75 to-transparent lg:block" />

                    <div className="pointer-events-none absolute right-0 top-0 z-10 h-28 w-44 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_62%)]" />
                </>
            ) : null}

            {images.length > 1 ? (
                <>
                    <button
                        type="button"
                        onClick={showPrevious}
                        className="absolute inset-y-0 left-0 z-20 hidden w-20 cursor-pointer items-center justify-start bg-gradient-to-r from-black/45 to-transparent pl-4 text-4xl text-white opacity-0 transition-opacity hover:opacity-100 group-hover:flex"
                        aria-label="Previous showcase image"
                    >
                        ‹
                    </button>

                    <button
                        type="button"
                        onClick={showNext}
                        className="absolute inset-y-0 right-0 z-20 hidden w-20 cursor-pointer items-center justify-end bg-gradient-to-l from-black/45 to-transparent pr-4 text-4xl text-white opacity-0 transition-opacity hover:opacity-100 group-hover:flex"
                        aria-label="Next showcase image"
                    >
                        ›
                    </button>

                    <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-md">
                        {images.map((image, index) => (
                            <button
                                key={image.id}
                                type="button"
                                onClick={() =>
                                    setActiveIndex(index)
                                }
                                className={`h-2 cursor-pointer rounded-full transition-all ${
                                    index === activeIndex
                                        ? "w-6 bg-white"
                                        : "w-2 bg-white/45 hover:bg-white/75"
                                }`}
                                aria-label={`Show cover ${index + 1}`}
                            />
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}
