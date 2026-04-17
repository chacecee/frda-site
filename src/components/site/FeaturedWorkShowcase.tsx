"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type FeaturedGame = {
    id: string;
    title: string;
    creator: string;
    description: string;
    image: string;
    href: string;
};

const featuredGames: FeaturedGame[] = [
    {
        id: "game-1",
        title: "🚍Diesel n' Steel",
        creator: "Diesel n' Steel Official Group",
        description:
            "Get ready to hit the streets in Diesel n' Steel, the ORIGINAL Jeepney simulator on Roblox! Compete for passengers, calculate fares and earn cash, drive iconic Jeepneys, and buy and customize your very own Jeepneys, and more!",
        image: "/game8.png",
        href: "https://www.roblox.com/games/131667667758514/Diesel-n-Steel",
    },
    {
        id: "game-2",
        title: "The Binding: Chapter 1",
        creator: "Black Pirate Studios",
        description:
            "Sent into an abandoned hotel to recover what was left behind, your team finds something still listening in the walls.",
        image: "/game5.png",
        href: "https://www.roblox.com/games/16822767308/The-Binding-Chapter-1-First-Descent",
    },
    {
        id: "game-3",
        title: "SM City Tanza (Shopping Mall)",
        creator: "SM Supermall on Roblox (Official)",
        description:
            "This is SM City Tanza, a premier hotspot in Tanza, Cavite, Philippines for your Shopping, Dining, and MORE!",
        image: "/game6.png",
        href: "https://www.roblox.com/games/14197996531/SM-City-Tanza",
    },
    {
        id: "game-4",
        title: "Pinoy Holy Week Procession 2026",
        creator: "Batak Studios",
        description:
            "Experience the solemn beauty of a Traditional Filipino Holy Week procession! Join the procession with life-sized Santo statues. Light candles, pray, and follow the procession.",
        image: "/game7.png",
        href: "https://www.roblox.com/games/115538041257249/Pinoy-Holy-Week-Procession-2026",
    },

    // EASY TO EXTEND LATER
    // {
    //   id: "game-5",
    //   title: "Project Showcase Four",
    //   creator: "Another Studio",
    //   description: "Optional fourth item.",
    //   image: "/game4.jpg",
    //   href: "https://www.roblox.com/games/",
    // },
    // {
    //   id: "game-6",
    //   title: "Project Showcase Five",
    //   creator: "Another Creator",
    //   description: "Optional fifth item.",
    //   image: "/game5.jpg",
    //   href: "https://www.roblox.com/games/",
    // },
];

const AUTO_ADVANCE_MS = 5000;

export default function FeaturedWorkShowcase() {
    const items = useMemo(() => featuredGames, []);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (items.length <= 1) return;

        const timer = window.setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % items.length);
        }, AUTO_ADVANCE_MS);

        return () => window.clearInterval(timer);
    }, [items.length]);

    const activeItem = items[activeIndex];

    const goToSlide = (index: number) => {
        setActiveIndex(index);
    };

    const goPrev = () => {
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
    };

    const goNext = () => {
        setActiveIndex((prev) => (prev + 1) % items.length);
    };

    return (
        <div className="relative z-20 md:-mt-24">
            <div className="rounded-[8px] border border-white/6 bg-[#0d1522] p-4 shadow-[0_0_60px_rgba(0,0,0,0.35)] md:p-5">
                <div className="overflow-hidden rounded-[6px] bg-[#101a2a]">
                    <div className="relative aspect-[16/10] overflow-hidden">
                        <Image
                            key={activeItem.id}
                            src={activeItem.image}
                            alt={activeItem.title}
                            fill
                            className="object-cover"
                            priority
                        />

                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,22,0.10)_0%,rgba(3,10,22,0.18)_100%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_35%)]" />

                        <div className="absolute left-4 top-4 rounded-[5px] border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100/80 backdrop-blur-sm">
                            Featured project
                        </div>

                        <button
                            type="button"
                            onClick={goPrev}
                            aria-label="Previous slide"
                            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[5px] border border-white/10 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45"
                        >
                            ‹
                        </button>

                        <button
                            type="button"
                            onClick={goNext}
                            aria-label="Next slide"
                            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[5px] border border-white/10 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/45"
                        >
                            ›
                        </button>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 bg-[#09111d] px-5 py-4">
                        <div className="flex items-center gap-2">
                            {items.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-label={`Go to slide ${index + 1}`}
                                    onClick={() => goToSlide(index)}
                                    className={`h-2.5 w-2.5 rounded-full transition ${index === activeIndex ? "bg-blue-400" : "bg-white/15 hover:bg-white/30"
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                            {activeIndex + 1} / {items.length}
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-[6px] bg-black/30 p-5 backdrop-blur-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <a
                                href={activeItem.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lg font-semibold text-white transition hover:text-blue-300"
                            >
                                {activeItem.title}
                            </a>
                            <p className="mt-1 text-sm text-zinc-400">
                                Created by {activeItem.creator}
                            </p>
                        </div>

                        <a
                            href={activeItem.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center justify-center rounded-[5px] border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-blue-200 transition hover:border-blue-300/30 hover:bg-blue-500/15 hover:text-white"
                        >
                            Play This Game
                        </a>
                    </div>

                    <p className="mt-4 text-sm leading-7 text-zinc-300">
                        {activeItem.description}
                    </p>
                </div>
            </div>
        </div>
    );
}