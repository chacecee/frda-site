import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/lib/firebaseAdmin";

import {
  authorizeMemberRequest,
} from "@/lib/server/memberAuthorization";

export const runtime = "nodejs";

type RangeValue =
  | "today"
  | "7d"
  | "30d"
  | "all";

type DailyAnalytics = {
  profileViews: number;
  uniqueProfileViews: number;
  contactClicks: number;
  projectViews: number;
  projectLinkClicks: number;
  portfolioClicks: number;
};

function numberValue(
  value: unknown,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function getDayKey(
  date: Date,
): string {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(date);
}

function getRangeStart(
  range: RangeValue,
): Date | null {
  if (range === "all") {
    return null;
  }

  const now = new Date();
  const start = new Date(now);

  if (range === "today") {
    return start;
  }

  start.setDate(
    start.getDate() -
      (
        range === "7d"
          ? 6
          : 29
      ),
  );

  return start;
}

function getRangeValue(
  value: string | null,
): RangeValue {
  return value === "today" ||
    value === "7d" ||
    value === "30d" ||
    value === "all"
    ? value
    : "30d";
}

export async function GET(
  request: NextRequest,
) {
  try {
    const authorization =
      await authorizeMemberRequest(
        request,
      );

    if (!authorization.ok) {
      return authorization.response;
    }

    const {
      member,
      memberData,
    } = authorization;

    if (
      member.accountPurpose !== "developer" &&
      member.accountPurpose !== "both"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Developer analytics are available only to developer accounts.",
        },
        { status: 403 },
      );
    }

    const analyticsAccess =
      memberData.analyticsAccess === "pro" ||
      memberData.analyticsAccess === "disabled"
        ? memberData.analyticsAccess
        : "basic";

    if (analyticsAccess === "disabled") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Analytics access is not enabled for this account.",
        },
        { status: 403 },
      );
    }

    const range =
      getRangeValue(
        request.nextUrl.searchParams.get(
          "range",
        ),
      );

    const [
      aggregateSnapshot,
      dailySnapshot,
      projectsSnapshot,
      savesSnapshot,
    ] = await Promise.all([
      adminDb
        .collection("developerAnalytics")
        .doc(member.uid)
        .get(),

      adminDb
        .collection("developerAnalyticsDaily")
        .where(
          "developerUid",
          "==",
          member.uid,
        )
        .get(),

      adminDb
        .collection("developerProjectAnalytics")
        .where(
          "developerUid",
          "==",
          member.uid,
        )
        .get(),

      adminDb
        .collection("developerSaves")
        .where(
          "developerUid",
          "==",
          member.uid,
        )
        .get(),
    ]);

    const aggregate =
      aggregateSnapshot.data() || {};

    const rangeStart =
      getRangeStart(range);

    const startDayKey =
      rangeStart
        ? getDayKey(rangeStart)
        : "";

    const dailyRows =
      dailySnapshot.docs
        .map((document) => {
          const data =
            document.data();

          return {
            dayKey:
              String(
                data.dayKey || "",
              ),
            profileViews:
              numberValue(
                data.profileViews,
              ),
            uniqueProfileViews:
              numberValue(
                data.uniqueProfileViews,
              ),
            contactClicks:
              numberValue(
                data.contactClicks,
              ),
            projectViews:
              numberValue(
                data.projectViews,
              ),
            projectLinkClicks:
              numberValue(
                data.projectLinkClicks,
              ),
            portfolioClicks:
              numberValue(
                data.portfolioClicks,
              ),
          };
        })
        .filter(
          (row) =>
            Boolean(row.dayKey) &&
            (
              !startDayKey ||
              row.dayKey >= startDayKey
            ),
        )
        .sort(
          (first, second) =>
            first.dayKey.localeCompare(
              second.dayKey,
            ),
        );

    const totals: DailyAnalytics =
      range === "all"
        ? {
            profileViews:
              numberValue(
                aggregate.profileViews,
              ),
            uniqueProfileViews:
              numberValue(
                aggregate.uniqueProfileViews,
              ),
            contactClicks:
              numberValue(
                aggregate.contactClicks,
              ),
            projectViews:
              numberValue(
                aggregate.projectViews,
              ),
            projectLinkClicks:
              numberValue(
                aggregate.projectLinkClicks,
              ),
            portfolioClicks:
              numberValue(
                aggregate.portfolioClicks,
              ),
          }
        : dailyRows.reduce<DailyAnalytics>(
            (current, row) => ({
              profileViews:
                current.profileViews +
                row.profileViews,
              uniqueProfileViews:
                current.uniqueProfileViews +
                row.uniqueProfileViews,
              contactClicks:
                current.contactClicks +
                row.contactClicks,
              projectViews:
                current.projectViews +
                row.projectViews,
              projectLinkClicks:
                current.projectLinkClicks +
                row.projectLinkClicks,
              portfolioClicks:
                current.portfolioClicks +
                row.portfolioClicks,
            }),
            {
              profileViews: 0,
              uniqueProfileViews: 0,
              contactClicks: 0,
              projectViews: 0,
              projectLinkClicks: 0,
              portfolioClicks: 0,
            },
          );

    const projects =
      projectsSnapshot.docs
        .map((document) => {
          const data =
            document.data();

          const detailViews =
            numberValue(
              data.detailViews,
            );

          const linkClicks =
            numberValue(
              data.linkClicks,
            );

          return {
            projectId:
              String(
                data.projectId || "",
              ),
            projectTitle:
              String(
                data.projectTitle ||
                "Untitled project",
              ),
            detailViews,
            linkClicks,
            engagement:
              detailViews +
              linkClicks,
          };
        })
        .sort(
          (first, second) =>
            second.engagement -
              first.engagement ||
            first.projectTitle.localeCompare(
              second.projectTitle,
            ),
        )
        .slice(0, 10);

    return NextResponse.json({
      ok: true,
      analyticsAccess,
      range,
      totals: {
        ...totals,
        bookmarks:
          savesSnapshot.size,
      },
      series: dailyRows,
      projects,
    });
  } catch (error) {
    console.error(
      "Load member analytics error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not load your developer analytics.",
      },
      { status: 500 },
    );
  }
}