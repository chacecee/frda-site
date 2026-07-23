"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bookmark,
  LoaderCircle,
  Search,
  Trash2,
} from "lucide-react";

import { useRouter } from "next/navigation";
import MemberPortalHeader from "@/components/member/MemberPortalHeader";
import { useAuthUser } from "@/lib/useAuthUser";
import { notify } from "@/components/ToastConfig";

type SavedDeveloper = {
  saveId: string;
  developerUid: string;
  memberId: string;
  slug: string;
  customSubdomain: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  skills: string[];
  availability: string;
  availabilityLabel: string;
  deliveryScope: string;
  deliveryScopeLabel: string;
  savedAt: string | null;
};

function getInitials(
  value: string,
): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase(),
    )
    .join("");
}

function formatDate(
  value: string | null,
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    },
  ).format(date);
}

export default function SavedDevelopersPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [developers, setDevelopers] =
    useState<SavedDeveloper[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [
    removingDeveloperUid,
    setRemovingDeveloperUid,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(
        "/member/login",
      );
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadSavedDevelopers() {
      setLoading(true);
      setPageError("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/member/saved-developers",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
          },
        );

        const result = await response
          .json()
          .catch(() => null);

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error ||
            "Could not load your bookmarked developers.",
          );
        }

        if (!cancelled) {
          setDevelopers(
            result.developers || [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load your bookmarked developers.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSavedDevelopers();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredDevelopers =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      if (!normalizedSearch) {
        return developers;
      }

      return developers.filter(
        (developer) =>
          [
            developer.displayName,
            developer.headline,
            developer.bio,
            developer.skills.join(" "),
            developer.deliveryScopeLabel,
          ]
            .join(" ")
            .toLowerCase()
            .includes(
              normalizedSearch,
            ),
      );
    }, [
      developers,
      search,
    ]);

  async function removeDeveloper(
    developer:
      SavedDeveloper,
  ) {
    if (
      !user ||
      removingDeveloperUid
    ) {
      return;
    }

    setRemovingDeveloperUid(
      developer.developerUid,
    );

    try {
      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/member/saved-developers",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            developerUid:
              developer.developerUid,
          }),
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
          "Could not remove this bookmarked developer.",
        );
      }

      setDevelopers((current) =>
        current.filter(
          (item) =>
            item.developerUid !==
            developer.developerUid,
        ),
      );

      notify.success(
        "Developer removed from your bookmark list.",
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not remove this bookmarked developer.",
      );
    } finally {
      setRemovingDeveloperUid(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#071225] text-white">
      <MemberPortalHeader
        active="saved_developers"
        subtitle="Bookmarked Developers"
      />

      <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-300">
              Your Shortlist
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-white">
              Bookmarked Developers
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Keep a private list of developers you may want to contact, collaborate with, or revisit later.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/developers",
              )
            }
            className="cursor-pointer border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-200 hover:bg-sky-400/15"
            style={{ borderRadius: 7 }}
          >
            Browse Developers
          </button>
        </div>

        {developers.length > 0 ? (
          <div className="relative mt-7 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search your bookmarked developers"
              className="w-full border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400"
              style={{ borderRadius: 7 }}
            />
          </div>
        ) : null}

        {pageError ? (
          <div
            className="mt-7 border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200"
            style={{ borderRadius: 8 }}
          >
            {pageError}
          </div>
        ) : loading ? (
          <div
            className="mt-7 border border-white/10 bg-white/[0.025] p-6 text-sm text-zinc-400"
            style={{ borderRadius: 8 }}
          >
            Loading your bookmarked developers...
          </div>
        ) : developers.length === 0 ? (
          <div
            className="mt-7 border border-dashed border-white/15 bg-white/[0.025] px-6 py-12 text-center"
            style={{ borderRadius: 9 }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-200">
              <Bookmark className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-xl font-semibold text-white">
              No bookmarked developers yet
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              Tap the bookmark icon on a directory card or developer profile to add someone to this private list.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/developers",
                )
              }
              className="mt-6 cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
              style={{ borderRadius: 6 }}
            >
              Browse Developers
            </button>
          </div>
        ) : filteredDevelopers.length === 0 ? (
          <div
            className="mt-7 border border-white/10 bg-white/[0.025] p-8 text-center"
            style={{ borderRadius: 8 }}
          >
            <h2 className="text-lg font-semibold text-white">
              No matching bookmarked developers
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Try a different name, skill, or keyword.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {filteredDevelopers.map(
              (developer) => (
                <article
                  key={
                    developer.developerUid
                  }
                  className="border border-white/10 bg-white/[0.025] p-5"
                  style={{ borderRadius: 8 }}
                >
                  <div className="flex items-start gap-4">
                    {developer.avatarUrl ? (
                      <img
                        src={
                          developer.avatarUrl
                        }
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-200">
                        {getInitials(
                          developer.displayName,
                        ) || "FD"}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-semibold text-white">
                        {
                          developer.displayName
                        }
                      </h2>

                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-400">
                        {developer.headline ||
                          "FRDA developer"}
                      </p>

                      {developer.deliveryScopeLabel ? (
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">
                          {
                            developer.deliveryScopeLabel
                          }
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {developer.skills.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {developer.skills
                        .slice(0, 5)
                        .map((skill) => (
                          <span
                            key={skill}
                            className="border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-300"
                            style={{
                              borderRadius: 5,
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <p className="text-xs text-zinc-600">
                      Bookmarked{" "}
                      {formatDate(
                        developer.savedAt,
                      )}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          removeDeveloper(
                            developer,
                          )
                        }
                        disabled={
                          removingDeveloperUid ===
                          developer.developerUid
                        }
                        className="flex h-9 w-9 cursor-pointer items-center justify-center text-zinc-500 transition hover:text-red-300 disabled:cursor-wait disabled:opacity-60"
                        aria-label="Remove bookmarked developer"
                        title="Remove"
                      >
                        {removingDeveloperUid ===
                        developer.developerUid ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/developers/${encodeURIComponent(
                              developer.slug,
                            )}`,
                          )
                        }
                        className="cursor-pointer bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
                        style={{ borderRadius: 6 }}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}