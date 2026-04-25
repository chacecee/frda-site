import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type AnalyticsEvent = {
  id?: string;
  eventName?: string;
  path?: string;
  pageTitle?: string;
  visitorId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp;
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

async function verifyStaffRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "").trim()
    : "";

  if (!token) {
    return null;
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = normalizeEmail(decoded.email);

  if (!email) return null;

  const exactSnapshot = await adminDb
    .collection("staff")
    .where("emailAddress", "==", email)
    .limit(1)
    .get();

  if (!exactSnapshot.empty) {
    return {
      uid: decoded.uid,
      email,
      staffId: exactSnapshot.docs[0].id,
    };
  }

  const allStaffSnapshot = await adminDb.collection("staff").get();
  const matchingStaff = allStaffSnapshot.docs.find((docSnap) => {
    const data = docSnap.data() as { emailAddress?: string };
    return normalizeEmail(data.emailAddress) === email;
  });

  if (!matchingStaff) return null;

  return {
    uid: decoded.uid,
    email,
    staffId: matchingStaff.id,
  };
}

function incrementMap(map: Map<string, number>, key: string, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function mapToRows(map: Map<string, number>, limit = 10) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getDateKey(timestamp?: Timestamp) {
  if (!timestamp) return "Unknown";

  const date = timestamp.toDate();

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(request: NextRequest) {
  try {
    const staff = await verifyStaffRequest(request);

    if (!staff) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const daysParam = request.nextUrl.searchParams.get("days");
    const days = Math.min(Math.max(Number(daysParam || 30), 1), 90);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const snapshot = await adminDb
      .collection("analyticsEvents")
      .where("createdAt", ">=", Timestamp.fromDate(sinceDate))
      .orderBy("createdAt", "desc")
      .limit(5000)
      .get();

    const events: AnalyticsEvent[] = snapshot.docs.map((docSnap) => {
      return {
        id: docSnap.id,
        ...(docSnap.data() as AnalyticsEvent),
      };
    });

    const eventCounts = new Map<string, number>();
    const pageViewsByPath = new Map<string, number>();
    const featuredGameClicks = new Map<string, number>();
    const dailyPageViews = new Map<string, number>();
    const dailyClicks = new Map<string, number>();

    const visitorIds = new Set<string>();
    const sessionIds = new Set<string>();

    events.forEach((event) => {
      const eventName = event.eventName || "unknown";
      const path = event.path || "/";
      const dateKey = getDateKey(event.createdAt);

      incrementMap(eventCounts, eventName);

      if (event.visitorId) visitorIds.add(event.visitorId);
      if (event.sessionId) sessionIds.add(event.sessionId);

      if (eventName === "page_view") {
        incrementMap(pageViewsByPath, path);
        incrementMap(dailyPageViews, dateKey);
      }

      if (
        eventName === "featured_game_click" ||
        eventName === "game_card_click" ||
        eventName === "play_on_roblox_click" ||
        eventName === "submit_game_cta_click"
      ) {
        incrementMap(dailyClicks, dateKey);
      }

      if (eventName === "featured_game_click") {
        const title =
          typeof event.metadata?.gameTitle === "string"
            ? event.metadata.gameTitle
            : "Untitled game";

        incrementMap(featuredGameClicks, title);
      }
    });

    const totalPageViews = eventCounts.get("page_view") || 0;
    const totalFeaturedGameClicks = eventCounts.get("featured_game_click") || 0;
    const totalPlayClicks = eventCounts.get("play_on_roblox_click") || 0;
    const totalSubmitGameCtaClicks = eventCounts.get("submit_game_cta_click") || 0;
    const totalCompletedSubmissions =
      eventCounts.get("game_submission_completed") || 0;
    const totalSearches = eventCounts.get("search_used") || 0;

    const recentEvents = events.slice(0, 15).map((event) => ({
      id: event.id || "",
      eventName: event.eventName || "unknown",
      path: event.path || "/",
      pageTitle: event.pageTitle || "",
      metadata: event.metadata || {},
      createdAt: event.createdAt
        ? event.createdAt.toDate().toISOString()
        : null,
    }));

    return NextResponse.json({
      ok: true,
      range: {
        days,
        since: sinceDate.toISOString(),
      },
      totals: {
        events: events.length,
        pageViews: totalPageViews,
        uniqueVisitors: visitorIds.size,
        sessions: sessionIds.size,
        featuredGameClicks: totalFeaturedGameClicks,
        playOnRobloxClicks: totalPlayClicks,
        submitGameCtaClicks: totalSubmitGameCtaClicks,
        completedSubmissions: totalCompletedSubmissions,
        searches: totalSearches,
      },
      eventBreakdown: mapToRows(eventCounts, 20),
      recentEvents,
      topPages: mapToRows(pageViewsByPath, 10),
      topFeaturedGames: mapToRows(featuredGameClicks, 10),
      dailyPageViews: mapToRows(dailyPageViews, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      dailyClicks: mapToRows(dailyClicks, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
    });
  } catch (error) {
    console.error("Analytics summary error:", error);

    return NextResponse.json(
      { ok: false, error: "Could not load analytics summary." },
      { status: 500 }
    );
  }
}