"use client";

import {
  useEffect,
  useState,
} from "react";

type PremiumCount = {
  limit: number;
  claimed: number;
  remaining: number;
};

const DEFAULT_COUNT: PremiumCount = {
  limit: 30,
  claimed: 0,
  remaining: 30,
};

export default function DeveloperPremiumCounter() {
  const [count, setCount] =
    useState<PremiumCount>(
      DEFAULT_COUNT,
    );

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      try {
        const response = await fetch(
          "/api/public/developer-premium-count",
          {
            cache: "no-store",
          },
        );

        const result = await response
          .json()
          .catch(() => null);

        if (
          !cancelled &&
          response.ok &&
          result?.ok
        ) {
          setCount({
            limit:
              typeof result.limit === "number"
                ? result.limit
                : DEFAULT_COUNT.limit,
            claimed:
              typeof result.claimed === "number"
                ? result.claimed
                : 0,
            remaining:
              typeof result.remaining === "number"
                ? result.remaining
                : DEFAULT_COUNT.remaining,
          });
        }
      } catch {
        // Keep the default display if the live count is unavailable.
      }
    }

    loadCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const percentage =
    count.limit > 0
      ? Math.min(
          100,
          (count.claimed /
            count.limit) *
            100,
        )
      : 0;

  return (
    <div className="rounded-[10px] border border-white/10 bg-[#050d1b]/85 p-6 text-center sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Lifetime premium availability
      </p>

      <p className="mt-4 text-5xl font-semibold text-white">
        {count.remaining}
      </p>

      <p className="mt-2 text-sm text-zinc-400">
        approved profiles remaining
      </p>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-blue-400 transition-all"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <p className="mt-5 text-xs leading-6 text-zinc-500">
        {count.claimed} of {count.limit}{" "}
        lifetime premium spots have
        been awarded.
      </p>
    </div>
  );
}