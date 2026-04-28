"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAnalyticsEvent } from "@/lib/analytics";

type FeaturedGameDoc = {
  id: string;
  projectTitle: string;
  creatorName: string;
  projectDescription: string;
  projectLink: string;
  imageUrl: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type ShowcaseItem = {
  id: string;
  title: string;
  creator: string;
  description: string;
  image: string;
  href: string;
};

const AUTO_ADVANCE_MS = 5000;

export default function FeaturedWorkShowcase() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const sectionVisibleRef = useRef(false);
  const loggedImpressionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collection(db, "featuredGames"), orderBy("sortOrder", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const publishedItems: ShowcaseItem[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Omit<FeaturedGameDoc, "id">;

            return {
              id: docSnap.id,
              title: data.projectTitle || "",
              creator: data.creatorName || "",
              description: data.projectDescription || "",
              image: data.imageUrl || "",
              href: data.projectLink || "",
              isPublished: !!data.isPublished,
              sortOrder: data.sortOrder ?? 0,
            };
          })
          .filter((item) => item.isPublished && item.title && item.image && item.href)
          .map(({ isPublished, sortOrder, ...item }) => item);

        setItems(publishedItems);
        setLoading(false);
        setActiveIndex(0);
        loggedImpressionsRef.current.clear();
      },
      (error) => {
        console.error("Error loading featured showcase games:", error);
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (activeIndex > items.length - 1) {
      setActiveIndex(0);
    }
  }, [items.length, activeIndex]);

  const activeItem = useMemo(() => {
    return items[activeIndex];
  }, [items, activeIndex]);

  function logFeaturedGameImpression(item: ShowcaseItem, index: number) {
    const impressionKey = `${item.id}:${index}`;

    if (loggedImpressionsRef.current.has(impressionKey)) return;

    loggedImpressionsRef.current.add(impressionKey);

    logAnalyticsEvent({
      eventName: "featured_game_impression",
      path: "/",
      metadata: {
        gameId: item.id,
        gameTitle: item.title,
        creator: item.creator,
        slideIndex: index,
        placement: "homepage_featured_work",
      },
    });
  }

  useEffect(() => {
    const node = showcaseRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        sectionVisibleRef.current = entry.isIntersecting;

        if (entry.isIntersecting && activeItem) {
          logFeaturedGameImpression(activeItem, activeIndex);
        }
      },
      {
        threshold: 0.45,
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [activeItem, activeIndex]);

  useEffect(() => {
    if (!activeItem) return;
    if (!sectionVisibleRef.current) return;

    logFeaturedGameImpression(activeItem, activeIndex);
  }, [activeItem, activeIndex]);

  const goToSlide = (index: number) => {
    setActiveIndex(index);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  function logFeaturedGameClick(clickType: "title" | "play_button") {
    if (!activeItem) return;

    logAnalyticsEvent({
      eventName: "featured_game_click",
      path: "/",
      metadata: {
        gameId: activeItem.id,
        gameTitle: activeItem.title,
        creator: activeItem.creator,
        clickType,
        placement: "homepage_featured_work",
      },
    });
  }

  if (loading) {
    return (
      <div className="relative z-20 md:-mt-24">
        <div className="rounded-[8px] border border-white/6 bg-[#0d1522] p-4 shadow-[0_0_60px_rgba(0,0,0,0.35)] md:p-5">
          <div className="overflow-hidden rounded-[6px] bg-[#101a2a]">
            <div className="relative aspect-[16/10] animate-pulse bg-[#0f1724]" />
            <div className="flex items-center justify-between border-t border-white/10 bg-[#09111d] px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>
              <div className="h-4 w-14 rounded bg-white/10" />
            </div>
          </div>

          <div className="mt-4 rounded-[6px] bg-black/30 p-5 backdrop-blur-sm">
            <div className="h-6 w-48 rounded bg-white/10" />
            <div className="mt-2 h-4 w-36 rounded bg-white/10" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-3/4 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeItem || items.length === 0) {
    return (
      <div className="relative z-20 md:-mt-24">
        <div className="rounded-[8px] border border-white/6 bg-[#0d1522] p-6 shadow-[0_0_60px_rgba(0,0,0,0.35)]">
          <div className="rounded-[6px] bg-black/30 p-6">
            <p className="text-lg font-semibold text-white">
              Featured projects coming soon
            </p>
            <p className="mt-2 text-sm leading-7 text-zinc-400">
              We’re preparing selected works to spotlight here soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={showcaseRef} className="relative z-20 md:-mt-24">
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
              unoptimized
            />

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,22,0.10)_0%,rgba(3,10,22,0.18)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_35%)]" />

            <div className="absolute left-4 top-4 rounded-[5px] border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100/80 backdrop-blur-sm">
              Featured project
            </div>

            {items.length > 1 ? (
              <>
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
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-[#09111d] px-5 py-4">
            <div className="flex items-center gap-2">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => goToSlide(index)}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === activeIndex
                      ? "bg-blue-400"
                      : "bg-white/15 hover:bg-white/30"
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
                onClick={() => logFeaturedGameClick("title")}
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
              onClick={() => logFeaturedGameClick("play_button")}
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