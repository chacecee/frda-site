"use client";

export type AnalyticsEventName =
  | "page_view"
  | "featured_game_click"
  | "featured_game_impression"
  | "game_directory_visit"
  | "game_card_click"
  | "play_on_roblox_click"
  | "submit_game_cta_click"
  | "game_submission_completed"
  | "category_click"
  | "search_used";

type AnalyticsMetadata = Record<string, string | number | boolean | null | undefined>;

type LogAnalyticsArgs = {
  eventName: AnalyticsEventName;
  path?: string;
  metadata?: AnalyticsMetadata;
};

function safeRandomId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getStoredId(key: string, prefix: string) {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;

    const next = safeRandomId(prefix);
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return safeRandomId(prefix);
  }
}

export async function logAnalyticsEvent({
  eventName,
  path,
  metadata = {},
}: LogAnalyticsArgs) {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getStoredId("frda_analytics_visitor_id", "visitor");
    const sessionId = getStoredId("frda_analytics_session_id", "session");

    const payload = {
      eventName,
      path: path || window.location.pathname,
      pageTitle: document.title || "",
      referrer: document.referrer || "",
      visitorId,
      sessionId,
      metadata,
    };

    await fetch("/api/analytics/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Analytics event was not logged:", error);
  }
}