import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "featured_game_click",
  "game_directory_visit",
  "game_card_click",
  "play_on_roblox_click",
  "submit_game_cta_click",
  "game_submission_completed",
  "category_click",
  "search_used",
]);

const globalForRateLimit = globalThis as unknown as {
  analyticsRateLimit?: Map<string, { count: number; resetAt: number }>;
};

const rateLimitStore =
  globalForRateLimit.analyticsRateLimit ||
  new Map<string, { count: number; resetAt: number }>();

globalForRateLimit.analyticsRateLimit = rateLimitStore;

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxEvents = 80;

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

  return existing.count > maxEvents;
}

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const cleaned: Record<string, string | number | boolean | null> = {};

  Object.entries(source).slice(0, 30).forEach(([key, rawValue]) => {
    const safeKey = key.trim().slice(0, 60);
    if (!safeKey) return;

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      cleaned[safeKey] =
        typeof rawValue === "string" ? rawValue.trim().slice(0, 500) : rawValue;
    }
  });

  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many analytics events." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid analytics payload." },
        { status: 400 }
      );
    }

    const eventName = cleanString(body.eventName, 80);

    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported analytics event." },
        { status: 400 }
      );
    }

    const path = cleanString(body.path, 500) || "/";
    const visitorId = cleanString(body.visitorId, 120);
    const sessionId = cleanString(body.sessionId, 120);

    await adminDb.collection("analyticsEvents").add({
      eventName,
      path,
      pageTitle: cleanString(body.pageTitle, 300),
      referrer: cleanString(body.referrer, 500),
      visitorId,
      sessionId,
      metadata: cleanMetadata(body.metadata),
      userAgent: cleanString(request.headers.get("user-agent"), 500),
      country: cleanString(request.headers.get("x-vercel-ip-country"), 20),
      city: cleanString(request.headers.get("x-vercel-ip-city"), 120),
      source: "website",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Analytics log error:", error);

    return NextResponse.json(
      { ok: false, error: "Could not log analytics event." },
      { status: 500 }
    );
  }
}