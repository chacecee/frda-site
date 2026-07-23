import {
  createHash,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const ALLOWED_EVENTS =
  new Set([
    "page_view",
    "featured_game_click",
    "featured_game_impression",
    "game_directory_visit",
    "game_card_click",
    "play_on_roblox_click",
    "submit_game_cta_click",
    "game_submission_completed",
    "category_click",
    "search_used",
    "developer_profile_view",
    "developer_contact_click",
    "developer_project_view",
    "developer_project_link_click",
    "developer_portfolio_click",
  ]);

const DEVELOPER_EVENTS =
  new Set([
    "developer_profile_view",
    "developer_contact_click",
    "developer_project_view",
    "developer_project_link_click",
    "developer_portfolio_click",
  ]);

const globalForRateLimit =
  globalThis as unknown as {
    analyticsRateLimit?: Map<
      string,
      {
        count: number;
        resetAt: number;
      }
    >;
  };

const rateLimitStore =
  globalForRateLimit
    .analyticsRateLimit ||
  new Map<
    string,
    {
      count: number;
      resetAt: number;
    }
  >();

globalForRateLimit.analyticsRateLimit =
  rateLimitStore;

function getClientIp(
  request: NextRequest,
) {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get(
      "x-real-ip",
    ) ||
    "unknown"
  );
}

function isRateLimited(
  ip: string,
) {
  const now = Date.now();
  const windowMs =
    60 * 1000;
  const maxEvents = 100;

  const existing =
    rateLimitStore.get(ip);

  if (
    !existing ||
    existing.resetAt < now
  ) {
    rateLimitStore.set(
      ip,
      {
        count: 1,
        resetAt:
          now + windowMs,
      },
    );

    return false;
  }

  existing.count += 1;

  rateLimitStore.set(
    ip,
    existing,
  );

  return (
    existing.count >
    maxEvents
  );
}

function cleanString(
  value: unknown,
  maxLength = 500,
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
}

function cleanMetadata(
  value: unknown,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  const cleaned: Record<
    string,
    | string
    | number
    | boolean
    | null
  > = {};

  Object.entries(source)
    .slice(0, 30)
    .forEach(
      ([key, rawValue]) => {
        const safeKey =
          key.trim().slice(0, 60);

        if (!safeKey) {
          return;
        }

        if (
          typeof rawValue ===
            "string" ||
          typeof rawValue ===
            "number" ||
          typeof rawValue ===
            "boolean" ||
          rawValue === null
        ) {
          cleaned[safeKey] =
            typeof rawValue ===
              "string"
              ? rawValue
                  .trim()
                  .slice(0, 500)
              : rawValue;
        }
      },
    );

  return cleaned;
}

function getDateParts(
  date: Date,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );

  const parts =
    formatter.formatToParts(
      date,
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value || "0000";

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value || "00";

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value || "00";

  return {
    year,
    month,
    day,
    dayKey:
      `${year}-${month}-${day}`,
    monthKey:
      `${year}-${month}`,
    yearKey: year,
  };
}

function getIsoWeekKey(
  date: Date,
) {
  const utcDate =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );

  const day =
    utcDate.getUTCDay() ||
    7;

  utcDate.setUTCDate(
    utcDate.getUTCDate() +
      4 -
      day,
  );

  const yearStart =
    new Date(
      Date.UTC(
        utcDate.getUTCFullYear(),
        0,
        1,
      ),
    );

  const week =
    Math.ceil(
      (
        (
          utcDate.getTime() -
          yearStart.getTime()
        ) /
          86400000 +
        1
      ) /
        7,
    );

  return `${utcDate.getUTCFullYear()}-W${String(
    week,
  ).padStart(2, "0")}`;
}

function hashVisitor(
  value: string,
) {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 32);
}

function getIncrementField(
  eventName: string,
) {
  switch (eventName) {
    case "developer_profile_view":
      return "profileViews";

    case "developer_contact_click":
      return "contactClicks";

    case "developer_project_view":
      return "projectViews";

    case "developer_project_link_click":
      return "projectLinkClicks";

    case "developer_portfolio_click":
      return "portfolioClicks";

    default:
      return "";
  }
}

async function updateDeveloperAnalytics({
  eventName,
  metadata,
  visitorId,
  createdAt,
}: {
  eventName: string;
  metadata: Record<
    string,
    | string
    | number
    | boolean
    | null
  >;
  visitorId: string;
  createdAt: Date;
}) {
  const developerUid =
    cleanString(
      metadata.developerUid,
      128,
    );

  if (
    !developerUid ||
    !DEVELOPER_EVENTS.has(
      eventName,
    )
  ) {
    return;
  }

  const {
    dayKey,
    monthKey,
    yearKey,
  } = getDateParts(
    createdAt,
  );

  const weekKey =
    getIsoWeekKey(
      createdAt,
    );

  const aggregateReference =
    adminDb
      .collection(
        "developerAnalytics",
      )
      .doc(developerUid);

  const dailyReference =
    adminDb
      .collection(
        "developerAnalyticsDaily",
      )
      .doc(
        `${developerUid}_${dayKey}`,
      );

  const incrementField =
    getIncrementField(
      eventName,
    );

  if (!incrementField) {
    return;
  }

  const commonUpdate = {
    developerUid,
    dayKey,
    weekKey,
    monthKey,
    yearKey,
    updatedAt:
      FieldValue
        .serverTimestamp(),
  };

  if (
    eventName ===
    "developer_profile_view"
  ) {
    const visitorHash =
      hashVisitor(
        visitorId ||
          "anonymous",
      );

    const uniqueReference =
      adminDb
        .collection(
          "developerAnalyticsDailyVisitors",
        )
        .doc(
          `${developerUid}_${dayKey}_${visitorHash}`,
        );

    await adminDb.runTransaction(
      async (transaction) => {
        const uniqueSnapshot =
          await transaction.get(
            uniqueReference,
          );

        transaction.set(
          aggregateReference,
          {
            developerUid,
            profileViews:
              FieldValue.increment(
                1,
              ),
            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          { merge: true },
        );

        transaction.set(
          dailyReference,
          {
            ...commonUpdate,
            profileViews:
              FieldValue.increment(
                1,
              ),
          },
          { merge: true },
        );

        if (
          !uniqueSnapshot.exists
        ) {
          transaction.set(
            uniqueReference,
            {
              developerUid,
              visitorHash,
              dayKey,
              weekKey,
              monthKey,
              yearKey,
              createdAt:
                FieldValue
                  .serverTimestamp(),
            },
          );

          transaction.set(
            aggregateReference,
            {
              uniqueProfileViews:
                FieldValue.increment(
                  1,
                ),
            },
            { merge: true },
          );

          transaction.set(
            dailyReference,
            {
              uniqueProfileViews:
                FieldValue.increment(
                  1,
                ),
            },
            { merge: true },
          );
        }
      },
    );

    return;
  }

  await Promise.all([
    aggregateReference.set(
      {
        developerUid,
        [incrementField]:
          FieldValue.increment(
            1,
          ),
        updatedAt:
          FieldValue
            .serverTimestamp(),
      },
      { merge: true },
    ),

    dailyReference.set(
      {
        ...commonUpdate,
        [incrementField]:
          FieldValue.increment(
            1,
          ),
      },
      { merge: true },
    ),
  ]);

  const projectId =
    cleanString(
      metadata.projectId,
      128,
    );

  if (
    (
      eventName ===
        "developer_project_view" ||
      eventName ===
        "developer_project_link_click"
    ) &&
    projectId
  ) {
    const projectTitle =
      cleanString(
        metadata.projectTitle,
        240,
      );

    const projectReference =
      adminDb
        .collection(
          "developerProjectAnalytics",
        )
        .doc(
          `${developerUid}_${projectId}`,
        );

    const projectDailyReference =
      adminDb
        .collection(
          "developerProjectAnalyticsDaily",
        )
        .doc(
          `${developerUid}_${projectId}_${dayKey}`,
        );

    const projectField =
      eventName ===
      "developer_project_view"
        ? "detailViews"
        : "linkClicks";

    await Promise.all([
      projectReference.set(
        {
          developerUid,
          projectId,
          projectTitle,
          [projectField]:
            FieldValue.increment(
              1,
            ),
          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        { merge: true },
      ),

      projectDailyReference.set(
        {
          developerUid,
          projectId,
          projectTitle,
          dayKey,
          weekKey,
          monthKey,
          yearKey,
          [projectField]:
            FieldValue.increment(
              1,
            ),
          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const ip =
      getClientIp(
        request,
      );

    if (
      isRateLimited(ip)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Too many analytics events.",
        },
        { status: 429 },
      );
    }

    const body =
      await request
        .json()
        .catch(() => null);

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid analytics payload.",
        },
        { status: 400 },
      );
    }

    const eventName =
      cleanString(
        body.eventName,
        80,
      );

    if (
      !ALLOWED_EVENTS.has(
        eventName,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unsupported analytics event.",
        },
        { status: 400 },
      );
    }

    const path =
      cleanString(
        body.path,
        500,
      ) || "/";

    const visitorId =
      cleanString(
        body.visitorId,
        120,
      );

    const sessionId =
      cleanString(
        body.sessionId,
        120,
      );

    const metadata =
      cleanMetadata(
        body.metadata,
      );

    const createdAt =
      new Date();

    const {
      dayKey,
      monthKey,
      yearKey,
    } = getDateParts(
      createdAt,
    );

    const weekKey =
      getIsoWeekKey(
        createdAt,
      );

    await adminDb
      .collection(
        "analyticsEvents",
      )
      .add({
        eventName,
        path,
        pageTitle:
          cleanString(
            body.pageTitle,
            300,
          ),
        referrer:
          cleanString(
            body.referrer,
            500,
          ),
        visitorId,
        sessionId,
        metadata,
        dayKey,
        weekKey,
        monthKey,
        yearKey,
        userAgent:
          cleanString(
            request.headers.get(
              "user-agent",
            ),
            500,
          ),
        country:
          cleanString(
            request.headers.get(
              "x-vercel-ip-country",
            ),
            20,
          ),
        city:
          cleanString(
            request.headers.get(
              "x-vercel-ip-city",
            ),
            120,
          ),
        source: "website",
        createdAt:
          Timestamp.fromDate(
            createdAt,
          ),
        createdAtServer:
          FieldValue
            .serverTimestamp(),
      });

    await updateDeveloperAnalytics({
      eventName,
      metadata,
      visitorId:
        visitorId ||
        `${ip}:${sessionId}`,
      createdAt,
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Analytics log error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not log analytics event.",
      },
      { status: 500 },
    );
  }
}