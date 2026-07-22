"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

type DeveloperProfile = {
  uid: string;
  memberId: string;
  email: string;
  displayName: string;
  headline: string;
  bio: string;
  skills: string[];
  availability: string;
  robloxProfileUrl: string;
  portfolioUrl: string;
  profileStatus: string;
  isPublished: boolean;
};

function getAvailabilityLabel(value: string): string {
  switch (value) {
    case "available":
      return "Available for work";
    case "limited":
      return "Limited availability";
    case "not_available":
      return "Not currently available";
    case "collaborations_only":
      return "Open to collaborations only";
    default:
      return "Availability not listed";
  }
}

export default function DeveloperProfilePreviewPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [profile, setProfile] =
    useState<DeveloperProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/member/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setErrorMessage("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/member/profile",
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
            cache: "no-store",
          }
        );

        const result = await response
          .json()
          .catch(() => null);

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error ||
              "Could not load your developer profile."
          );
        }

        if (!cancelled) {
          setProfile(result.profile);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load your developer profile."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#071225] px-5 py-12 text-white">
        <p className="text-center text-sm text-zinc-400">
          Loading profile preview...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071225] text-white">
      <header className="border-b border-white/10 bg-[#050d1c]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <button
            type="button"
            onClick={() =>
              router.push("/member/profile")
            }
            className="flex cursor-pointer items-center gap-3 text-left"
          >
            <img
              src="/frda-logo.png"
              alt="FRDA logo"
              className="h-11 w-11 object-contain"
            />

            <div>
              <p className="text-lg font-semibold text-white">
                FRDA Member Portal
              </p>

              <p className="text-xs text-zinc-500">
                Profile Preview
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/member/profile")
            }
            className="cursor-pointer border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            style={{ borderRadius: 5 }}
          >
            Back to Editor
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-12">
        {errorMessage ? (
          <div
            className="border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200"
            style={{ borderRadius: 8 }}
          >
            {errorMessage}
          </div>
        ) : profile ? (
          <>
            <div
              className="mb-6 border border-blue-400/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100"
              style={{ borderRadius: 8 }}
            >
              This is a private preview. Your profile is not
              publicly listed unless FRDA approves it for
              publication.
            </div>

            <article
              className="overflow-hidden border border-white/10 bg-[#0b172b]"
              style={{ borderRadius: 10 }}
            >
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.20),transparent_40%)] px-6 py-8 md:px-10 md:py-10">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-300">
                      FRDA Developer
                    </p>

                    <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
                      {profile.displayName || "Developer"}
                    </h1>

                    <p className="mt-3 max-w-2xl text-lg leading-7 text-zinc-300">
                      {profile.headline ||
                        "Professional headline not added yet"}
                    </p>
                  </div>

                  <span
                    className="inline-flex w-fit border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200"
                    style={{ borderRadius: 999 }}
                  >
                    {getAvailabilityLabel(
                      profile.availability
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-8 px-6 py-8 md:px-10">
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    About
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {profile.bio ||
                      "No biography has been added yet."}
                  </p>
                </section>

                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Skills
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.skills.length > 0 ? (
                      profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200"
                          style={{ borderRadius: 999 }}
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">
                        No skills have been added yet.
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Links
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-3">
                    {profile.robloxProfileUrl ? (
                      <a
                        href={profile.robloxProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-200 hover:bg-blue-500/20"
                        style={{ borderRadius: 5 }}
                      >
                        Roblox Profile
                      </a>
                    ) : null}

                    {profile.portfolioUrl ? (
                      <a
                        href={profile.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                        style={{ borderRadius: 5 }}
                      >
                        Portfolio or Website
                      </a>
                    ) : null}

                    {!profile.robloxProfileUrl &&
                    !profile.portfolioUrl ? (
                      <p className="text-sm text-zinc-500">
                        No profile links have been added yet.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="border-t border-white/10 pt-6">
                  <p className="text-xs text-zinc-500">
                    FRDA Member ID — {profile.memberId}
                  </p>
                </section>
              </div>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}