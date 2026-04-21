"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { Radio, ExternalLink, Megaphone } from "lucide-react";
import { db } from "@/lib/firebase";

type AnnouncementType = "standard" | "livestream";

type Announcement = {
  id: string;
  type: AnnouncementType;
  title: string;
  description: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaLink?: string;
  facebookVideoUrl?: string;
  livestreamProvider?: string;
  isActive: boolean;
};

type HomepageSettings = {
  announcementSectionEnabled?: boolean;
};

function buildFacebookEmbedUrl(videoUrl?: string) {
  if (!videoUrl) return "";

  try {
    const encodedHref = encodeURIComponent(videoUrl);
    return `https://www.facebook.com/plugins/video.php?href=${encodedHref}&show_text=false&width=800`;
  } catch {
    return "";
  }
}

export default function HomepageAnnouncement() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const settingsRef = doc(db, "homepageSettings", "homepage");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setEnabled(true);
          return;
        }

        const data = snapshot.data() as HomepageSettings;
        setEnabled(
          typeof data.announcementSectionEnabled === "boolean"
            ? data.announcementSectionEnabled
            : true
        );
      },
      (error) => {
        console.error("Error loading homepage announcement settings:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      where("isActive", "==", true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setAnnouncement(null);
          setLoading(false);
          return;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as Omit<Announcement, "id">;

        setAnnouncement({
          id: docSnap.id,
          ...data,
        });

        setLoading(false);
      },
      (error) => {
        console.error("Error loading active homepage announcement:", error);
        setAnnouncement(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const facebookEmbedUrl = useMemo(() => {
    if (!announcement || announcement.type !== "livestream") return "";
    return buildFacebookEmbedUrl(announcement.facebookVideoUrl);
  }, [announcement]);

  if (loading) {
    return (
      <section className="relative bg-[linear-gradient(180deg,#05163b_0%,#040914_100%)] px-6 pt-10 pb-10 md:px-8 md:pt-12 md:pb-14">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse rounded-[10px] border border-white/8 bg-[#09111d]/90 p-5 md:p-6">
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="mt-4 h-8 w-3/4 rounded bg-white/10" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-2/3 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!enabled || !announcement) {
    return null;
  }

  const isLivestream = announcement.type === "livestream";

  return (
    <section className="relative bg-[linear-gradient(180deg,#05163b_0%,#040914_100%)] px-6 pb-10 md:px-8 md:pb-14">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_30%)]" />
        <div className="absolute left-1/2 top-0 h-40 w-[680px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[10px] border border-blue-400/12 bg-[#09111d]/92 shadow-[0_0_40px_rgba(0,0,0,0.28)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">
                  {isLivestream ? (
                    <>
                      <Radio className="h-3.5 w-3.5" />
                      <span>Live Now</span>
                    </>
                  ) : (
                    <>
                      <Megaphone className="h-3.5 w-3.5" />
                      <span>Announcement</span>
                    </>
                  )}
                </span>
              </div>

              <h2 className="mt-5 max-w-3xl text-2xl font-semibold leading-tight text-white md:text-3xl">
                {announcement.title}
              </h2>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base md:leading-8">
                {announcement.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {isLivestream && announcement.facebookVideoUrl ? (
                  <a
                    href={announcement.facebookVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-blue-400/30 bg-blue-500 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-[0_0_20px_rgba(37,99,235,0.18)] transition hover:bg-blue-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Watch on Facebook</span>
                  </a>
                ) : announcement.ctaLink ? (
                  <a
                    href={announcement.ctaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-[5px] border border-blue-400/30 bg-blue-500 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-[0_0_20px_rgba(37,99,235,0.18)] transition hover:bg-blue-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>{announcement.ctaLabel || "Learn More"}</span>
                  </a>
                ) : null}
              </div>
            </div>

            <div className="border-t border-white/8 bg-[#050b14] lg:border-l lg:border-t-0">
              {isLivestream && facebookEmbedUrl ? (
                <div className="h-full p-4 md:p-5">
                  <div className="overflow-hidden rounded-[8px] border border-white/8 bg-black/30">
                    <div className="aspect-video w-full">
                      <iframe
                        src={facebookEmbedUrl}
                        width="100%"
                        height="100%"
                        style={{ border: "none", overflow: "hidden" }}
                        scrolling="no"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        allowFullScreen
                        title={announcement.title}
                        className="h-full w-full"
                      />
                    </div>
                  </div>
                </div>
              ) : announcement.imageUrl ? (
                <div className="h-full">
                  <img
                    src={announcement.imageUrl}
                    alt={announcement.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-[220px] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_35%)] p-6 text-center">
                  <div>
                    {isLivestream ? (
                      <Radio className="mx-auto mb-3 h-10 w-10 text-blue-300" />
                    ) : (
                      <Megaphone className="mx-auto mb-3 h-10 w-10 text-blue-300" />
                    )}
                    <p className="text-sm font-medium text-zinc-200">
                      {isLivestream ? "Livestream announcement" : "Announcement"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}