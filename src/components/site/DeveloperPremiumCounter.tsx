"use client";

import {
  LoaderCircle,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

type PremiumCount = {
  limit: number;
  claimed: number;
  remaining: number;
};

export default function DeveloperPremiumCounter() {
  const [
    count,
    setCount,
  ] = useState<PremiumCount | null>(
    null,
  );

  const [
    countUnavailable,
    setCountUnavailable,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      try {
        const response =
          await fetch(
            "/api/public/developer-premium-count",
            {
              cache: "no-store",
            },
          );

        const result =
          await response
            .json()
            .catch(() => null);

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !result?.ok ||
          typeof result.limit !==
            "number" ||
          typeof result.claimed !==
            "number" ||
          typeof result.remaining !==
            "number"
        ) {
          setCountUnavailable(true);
          return;
        }

        setCount({
          limit:
            Math.max(
              0,
              result.limit,
            ),

          claimed:
            Math.max(
              0,
              result.claimed,
            ),

          remaining:
            Math.max(
              0,
              result.remaining,
            ),
        });
      } catch {
        if (!cancelled) {
          setCountUnavailable(true);
        }
      }
    }

    loadCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const percentage =
    count &&
    count.limit > 0
      ? Math.min(
          100,
          (
            count.claimed /
            count.limit
          ) * 100,
        )
      : 0;

  return (
    <div className="rounded-[10px] border border-white/10 bg-[#050d1b]/85 p-6 text-center sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Lifetime premium availability
      </p>

      {!count &&
      !countUnavailable ? (
        <div className="flex min-h-40 flex-col items-center justify-center">
          <LoaderCircle className="h-5 w-5 animate-spin text-blue-300" />

          <p className="mt-3 text-sm text-zinc-400">
            Checking availability...
          </p>
        </div>
      ) : countUnavailable ? (
        <div className="flex min-h-40 flex-col items-center justify-center">
          <p className="text-lg font-semibold text-white">
            Availability temporarily unavailable
          </p>

          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            Please refresh the page to check the latest number of remaining lifetime premium spots.
          </p>
        </div>
      ) : count ? (
        <>
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
                width:
                  `${percentage}%`,
              }}
            />
          </div>

          <p className="mt-5 text-xs leading-6 text-zinc-500">
            {count.claimed} of{" "}
            {count.limit} lifetime
            premium spots have been
            awarded.
          </p>
        </>
      ) : null}
    </div>
  );
}