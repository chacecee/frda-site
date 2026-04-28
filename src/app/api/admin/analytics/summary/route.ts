import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type AnalyticsMetadata = Record<string, unknown>;

type AnalyticsEvent = {
  id?: string;
  eventName?: string;
  path?: string;
  pageTitle?: string;
  visitorId?: string;
  sessionId?: string;
  metadata?: AnalyticsMetadata;
  createdAt?: Timestamp;
};

type AnalyticsRow = {
  label: string;
  count: number;
};

type AnalyticsEntityRow = {
  label: string;
  count: number;
};

type AnalyticsEntityMap = Map<
  string,
  {
    label: string;
    count: number;
  }
>;

type ApplicationRecord = {
  status?: string;
  region?: string;
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
  const safeKey = key.trim();
  if (!safeKey) return;

  map.set(safeKey, (map.get(safeKey) || 0) + amount);
}

function mapToRows(map: Map<string, number>, limit = 10): AnalyticsRow[] {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function incrementEntityMap(
  map: AnalyticsEntityMap,
  key: string,
  label: string,
  amount = 1
) {
  const safeKey = key.trim();
  const safeLabel = label.trim();

  if (!safeKey || !safeLabel) return;

  const existing = map.get(safeKey);

  if (existing) {
    existing.count += amount;
    map.set(safeKey, existing);
    return;
  }

  map.set(safeKey, {
    label: safeLabel,
    count: amount,
  });
}

function entityMapToRows(map: AnalyticsEntityMap, limit = 10): AnalyticsEntityRow[] {
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function formatApplicationStatus(value?: string) {
  switch ((value || "").trim()) {
    case "application_sent":
      return "Application Sent";
    case "manual_review":
      return "Manual Review";
    case "needs_more_info":
      return "Needs More Info";
    case "pending":
      return "Pending";
    case "accepted":
      return "Approved";
    case "rejected":
      return "Declined";
    case "expired":
      return "Expired";
    default:
      return value || "Unknown";
  }
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

function cleanPath(rawPath?: string) {
  const fallback = "/";

  if (!rawPath || typeof rawPath !== "string") return fallback;

  try {
    const withOrigin = rawPath.startsWith("http")
      ? rawPath
      : `https://frdaph.org${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`;

    const url = new URL(withOrigin);
    return url.pathname || fallback;
  } catch {
    const noQuery = rawPath.split("?")[0]?.split("#")[0] || fallback;
    return noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
  }
}

function normalizeTopPagePath(rawPath?: string) {
  const path = cleanPath(rawPath);

  if (path === "/") return "/";

  if (/^\/apply\/status\/[^/]+/i.test(path)) {
    return "/apply/status/[applicationId]";
  }

  if (/^\/apply\/submitted\/[^/]+/i.test(path)) {
    return "/apply/submitted/[applicationId]";
  }

  if (/^\/blog\/[^/]+/i.test(path)) {
    return "/blog/[slug]";
  }

  if (/^\/admin(\/|$)/i.test(path)) {
    return "/admin";
  }

  return path;
}

function getStringMetadata(
  metadata: AnalyticsMetadata | undefined,
  key: string,
  fallback = ""
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function getGameTitle(event: AnalyticsEvent) {
  return (
    getStringMetadata(event.metadata, "gameTitle") ||
    getStringMetadata(event.metadata, "title") ||
    "Untitled game"
  );
}

function getGameKey(event: AnalyticsEvent) {
  const gameId =
    getStringMetadata(event.metadata, "gameId") ||
    getStringMetadata(event.metadata, "id");

  if (gameId) {
    return `game:${gameId}`;
  }

  return `title:${getGameTitle(event).trim().toLowerCase()}`;
}

function getSearchTerm(event: AnalyticsEvent) {
  return getStringMetadata(event.metadata, "searchTerm").toLowerCase();
}

function getCategoryLabel(event: AnalyticsEvent) {
  return (
    getStringMetadata(event.metadata, "category") ||
    getStringMetadata(event.metadata, "categoryValue") ||
    "Unknown category"
  );
}

function getContentEntryLabel(event: AnalyticsEvent) {
  const title = (event.pageTitle || "").trim();
  const path = cleanPath(event.path);

  if (title && title !== path && title !== "FRDA") {
    return `${title} — ${path}`;
  }

  return path;
}

function isContentEntryView(event: AnalyticsEvent) {
  if (event.eventName !== "page_view") return false;

  const path = cleanPath(event.path);

  return /^\/blog\/[^/]+/i.test(path);
}

function isGameEngagementEvent(eventName: string) {
  return (
    eventName === "game_directory_visit" ||
    eventName === "game_card_click" ||
    eventName === "play_on_roblox_click" ||
    eventName === "submit_game_cta_click" ||
    eventName === "category_click" ||
    eventName === "search_used"
  );
}

function buildRecentEvent(event: AnalyticsEvent) {
  const rawPath = cleanPath(event.path);

  return {
    id: event.id || "",
    eventName: event.eventName || "unknown",
    path: rawPath,
    normalizedPath: normalizeTopPagePath(event.path),
    rawPath,
    pageTitle: event.pageTitle || "",
    metadata: event.metadata || {},
    createdAt: event.createdAt ? event.createdAt.toDate().toISOString() : null,
  };
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

    const applicationsSnapshot = await adminDb
      .collection("applications")
      .where("createdAt", ">=", Timestamp.fromDate(sinceDate))
      .orderBy("createdAt", "desc")
      .limit(5000)
      .get();

    const applications: ApplicationRecord[] = applicationsSnapshot.docs.map(
      (docSnap) => docSnap.data() as ApplicationRecord
    );

    const eventCounts = new Map<string, number>();

    const pageViewsByPath = new Map<string, number>();
    const contentEntries = new Map<string, number>();

    const featuredGameClicks = new Map<string, number>();
    const featuredGameImpressions = new Map<string, number>();
    const gameCardClicksByGame: AnalyticsEntityMap = new Map();
    const playClicksByGame: AnalyticsEntityMap = new Map();
    const gameEngagementByGame: AnalyticsEntityMap = new Map();

    const searchesByTerm = new Map<string, number>();
    const categoriesByLabel = new Map<string, number>();

    const dailyPageViews = new Map<string, number>();
    const dailyClicks = new Map<string, number>();
    const dailyGameActivity = new Map<string, number>();

    const dailyFeaturedImpressions = new Map<string, number>();
    const dailyFeaturedClicks = new Map<string, number>();

    const applicationsByRegion = new Map<string, number>();
    const applicationsByStatus = new Map<string, number>();
    const applicationsByDay = new Map<string, number>();

    const approvedDevelopersByRegion = new Map<string, number>();
    const approvedDevelopersByDay = new Map<string, number>();

    const visitorIds = new Set<string>();
    const sessionIds = new Set<string>();

    events.forEach((event) => {
      const eventName = event.eventName || "unknown";
      const dateKey = getDateKey(event.createdAt);

      incrementMap(eventCounts, eventName);

      if (event.visitorId) visitorIds.add(event.visitorId);
      if (event.sessionId) sessionIds.add(event.sessionId);

      if (eventName === "page_view") {
        const normalizedPath = normalizeTopPagePath(event.path);

        incrementMap(pageViewsByPath, normalizedPath);
        incrementMap(dailyPageViews, dateKey);

        if (isContentEntryView(event)) {
          incrementMap(contentEntries, getContentEntryLabel(event));
        }
      }

      if (
        eventName === "featured_game_click" ||
        eventName === "game_card_click" ||
        eventName === "play_on_roblox_click" ||
        eventName === "submit_game_cta_click"
      ) {
        incrementMap(dailyClicks, dateKey);
      }

      if (isGameEngagementEvent(eventName)) {
        incrementMap(dailyGameActivity, dateKey);
      }

      if (eventName === "featured_game_impression") {
        const title = getGameTitle(event);

        incrementMap(featuredGameImpressions, title);
        incrementMap(dailyFeaturedImpressions, dateKey);
      }

      if (eventName === "featured_game_click") {
        const title = getGameTitle(event);

        incrementMap(featuredGameClicks, title);
        incrementMap(dailyFeaturedClicks, dateKey);
      }

      if (eventName === "game_card_click") {
        const title = getGameTitle(event);
        const gameKey = getGameKey(event);

        incrementEntityMap(gameCardClicksByGame, gameKey, title);
        incrementEntityMap(gameEngagementByGame, gameKey, title);
      }

      if (eventName === "play_on_roblox_click") {
        const title = getGameTitle(event);
        const gameKey = getGameKey(event);

        incrementEntityMap(playClicksByGame, gameKey, title);
        incrementEntityMap(gameEngagementByGame, gameKey, title);
      }

      if (eventName === "search_used") {
        const term = getSearchTerm(event);

        if (term) {
          incrementMap(searchesByTerm, term);
        }
      }

      if (eventName === "category_click") {
        incrementMap(categoriesByLabel, getCategoryLabel(event));
      }
    });

    applications.forEach((application) => {
      const region = application.region?.trim() || "Unspecified region";
      const status = formatApplicationStatus(application.status);
      const dateKey = getDateKey(application.createdAt);

      incrementMap(applicationsByRegion, region);
      incrementMap(applicationsByStatus, status);
      incrementMap(applicationsByDay, dateKey);

      if (application.status === "accepted") {
        incrementMap(approvedDevelopersByRegion, region);
        incrementMap(approvedDevelopersByDay, dateKey);
      }
    });

    const totalPageViews = eventCounts.get("page_view") || 0;
    const totalFeaturedGameClicks = eventCounts.get("featured_game_click") || 0;
    const totalFeaturedGameImpressions =
      eventCounts.get("featured_game_impression") || 0;
    const totalGameCardClicks = eventCounts.get("game_card_click") || 0;
    const totalPlayClicks = eventCounts.get("play_on_roblox_click") || 0;
    const totalDirectoryVisits = eventCounts.get("game_directory_visit") || 0;
    const totalCategoryClicks = eventCounts.get("category_click") || 0;
    const totalSubmitGameCtaClicks =
      eventCounts.get("submit_game_cta_click") || 0;
    const totalCompletedSubmissions =
      eventCounts.get("game_submission_completed") || 0;
    const totalSearches = eventCounts.get("search_used") || 0;

    const totalApplications = applications.length;

    const totalApplicationSent = applications.filter(
      (application) => application.status === "application_sent"
    ).length;

    const totalManualReviewApplications = applications.filter(
      (application) => application.status === "manual_review"
    ).length;

    const totalApprovedApplications = applications.filter(
      (application) => application.status === "accepted"
    ).length;

    const totalNeedsMoreInfoApplications = applications.filter(
      (application) => application.status === "needs_more_info"
    ).length;

    const totalPendingApplications = applications.filter(
      (application) => application.status === "pending"
    ).length;

    const totalDeclinedApplications = applications.filter(
      (application) => application.status === "rejected"
    ).length;

    const totalExpiredApplications = applications.filter(
      (application) => application.status === "expired"
    ).length;

    const recentEvents = events.slice(0, 30).map(buildRecentEvent);

    const directoryFunnel = [
      {
        label: "Directory visits",
        count: totalDirectoryVisits,
      },
      {
        label: "Game card clicks",
        count: totalGameCardClicks,
      },
      {
        label: "Play on Roblox clicks",
        count: totalPlayClicks,
      },
    ];

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

        directoryVisits: totalDirectoryVisits,
        gameCardClicks: totalGameCardClicks,
        playOnRobloxClicks: totalPlayClicks,
        categoryClicks: totalCategoryClicks,

        featuredGameImpressions: totalFeaturedGameImpressions,
        featuredGameClicks: totalFeaturedGameClicks,
        submitGameCtaClicks: totalSubmitGameCtaClicks,
        completedSubmissions: totalCompletedSubmissions,
        searches: totalSearches,

        developerApplications: totalApplications,
        applicationSent: totalApplicationSent,
        manualReviewApplications: totalManualReviewApplications,
        approvedDevelopers: totalApprovedApplications,
        needsMoreInfoApplications: totalNeedsMoreInfoApplications,
        pendingApplications: totalPendingApplications,
        declinedApplications: totalDeclinedApplications,
        expiredApplications: totalExpiredApplications,
      },

      eventBreakdown: mapToRows(eventCounts, 20),
      recentEvents,

      topPages: mapToRows(pageViewsByPath, 10),
      topContentEntries: mapToRows(contentEntries, 10),

      directoryFunnel,
      topGames: entityMapToRows(gameEngagementByGame, 10),
      topGameCardClicks: entityMapToRows(gameCardClicksByGame, 10),
      topPlayOnRobloxGames: entityMapToRows(playClicksByGame, 10),
      topSearches: mapToRows(searchesByTerm, 10),
      topCategories: mapToRows(categoriesByLabel, 10),

      topFeaturedGameImpressions: mapToRows(featuredGameImpressions, 10),
      topFeaturedGames: mapToRows(featuredGameClicks, 10),

      dailyPageViews: mapToRows(dailyPageViews, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      dailyClicks: mapToRows(dailyClicks, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      dailyGameActivity: mapToRows(dailyGameActivity, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),

      dailyFeaturedImpressions: mapToRows(dailyFeaturedImpressions, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      dailyFeaturedClicks: mapToRows(dailyFeaturedClicks, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),

      applicationsByRegion: mapToRows(applicationsByRegion, 20),
      approvedDevelopersByRegion: mapToRows(approvedDevelopersByRegion, 20),

      applicationsByStatus: mapToRows(applicationsByStatus, 10),

      applicationsByDay: mapToRows(applicationsByDay, 90).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
      approvedDevelopersByDay: mapToRows(approvedDevelopersByDay, 90).sort((a, b) =>
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