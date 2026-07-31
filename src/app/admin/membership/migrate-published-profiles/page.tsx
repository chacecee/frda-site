"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  signOut,
} from "firebase/auth";
import {
  useRouter,
} from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  useAuthUser,
} from "@/lib/useAuthUser";
import {
  setPresenceOffline,
} from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { notify } from "@/components/ToastConfig";

type Preview = {
  candidateCount: number;
  alreadyMigratedCount: number;
  pendingMigrationCount: number;
  developers: Array<{
    uid: string;
    displayName: string;
    profileSlug: string;
    alreadyMigrated: boolean;
  }>;
};

export default function PublishedProfileMigrationPage() {
  const router =
    useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    preview,
    setPreview,
  ] = useState<Preview | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    migrating,
    setMigrating,
  ] = useState(false);

  const displayName =
    user?.displayName?.trim() ||
    (
      user?.email
        ? user.email.split("@")[0]
        : "Unknown User"
    );

  useEffect(() => {
    if (
      !authLoading &&
      !user
    ) {
      router.replace(
        "/admin/login",
      );
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  async function loadPreview() {
    if (!user) return;

    setLoading(true);

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/membership/migrate-published-profiles",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache:
              "no-store",
          },
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
          "Could not preview the migration.",
        );
      }

      setPreview(
        result.preview,
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not preview the migration.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, [user]);

  async function runMigration() {
    if (
      !user ||
      migrating
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Copy all currently published developer profiles into the new approved public snapshot collection?\n\nThis operation is designed to be safe to run once and skips profiles that were already migrated.",
      );

    if (!confirmed) {
      return;
    }

    setMigrating(true);

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/membership/migrate-published-profiles",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${idToken}`,
            },
            body:
              JSON.stringify({
                confirm:
                  "MIGRATE_PUBLISHED_PROFILES",
              }),
          },
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
          "Could not complete the migration.",
        );
      }

      notify.success(
        result.message,
      );

      await loadPreview();
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not complete the migration.",
      );
    } finally {
      setMigrating(false);
    }
  }

  async function handleSignOut() {
    await setPresenceOffline(
      user?.email,
    );

    await signOut(auth);

    router.replace(
      "/admin/login",
    );
  }

  if (
    authLoading ||
    !user
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-zinc-400">
        Loading migration tool...
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="membership_developer_accounts"
          sidebarOpen={
            sidebarOpen
          }
          onCloseSidebar={() =>
            setSidebarOpen(false)
          }
          onNavigate={(path) =>
            router.push(path)
          }
          onSignOut={
            handleSignOut
          }
          displayName={
            displayName
          }
          email={user.email}
        />

        <section className="min-w-0 bg-zinc-900 px-4 py-5 md:px-10 md:py-8 xl:px-14">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              One-time Admin Tool
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              Published Profile Migration
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              Copy every currently live developer profile into the new approved public snapshot collection. Existing public profiles are marked as previously approved and trusted for future updates.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-3">
              {[
                [
                  "Candidates",
                  preview?.candidateCount || 0,
                ],
                [
                  "Already migrated",
                  preview?.alreadyMigratedCount || 0,
                ],
                [
                  "Still pending",
                  preview?.pendingMigrationCount || 0,
                ],
              ].map(
                ([label, value]) => (
                  <div
                    key={
                      String(label)
                    }
                    className="border border-zinc-800 bg-zinc-950/35 p-4"
                    style={{
                      borderRadius: 8,
                    }}
                  >
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {label}
                    </p>

                    <p className="mt-3 text-3xl font-semibold">
                      {Number(
                        value,
                      )}
                    </p>
                  </div>
                ),
              )}
            </div>

            <div
              className="mt-6 border border-zinc-800 bg-zinc-950/25"
              style={{
                borderRadius: 8,
              }}
            >
              <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="font-semibold">
                  Profiles detected
                </h2>
              </div>

              <div className="divide-y divide-zinc-800">
                {loading ? (
                  <p className="p-5 text-sm text-zinc-400">
                    Loading migration preview...
                  </p>
                ) : !preview ||
                  preview.developers.length === 0 ? (
                  <p className="p-5 text-sm text-zinc-400">
                    No currently published profiles were found.
                  </p>
                ) : (
                  preview.developers.map(
                    (developer) => (
                      <div
                        key={developer.uid}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div>
                          <p className="font-medium">
                            {developer.displayName}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            {developer.profileSlug || developer.uid}
                          </p>
                        </div>

                        <span
                          className={
                            developer.alreadyMigrated
                              ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
                              : "rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200"
                          }
                        >
                          {developer.alreadyMigrated
                            ? "Migrated"
                            : "Pending"}
                        </span>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>

            <div className="mt-6 rounded-[8px] border border-amber-500/20 bg-amber-500/[0.07] p-4 text-sm leading-6 text-amber-100">
              Run this only after deploying Install 1. The public routes include a temporary legacy fallback, so the directory should remain available while migration is pending.
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={
                  loadPreview
                }
                disabled={
                  loading ||
                  migrating
                }
                className="cursor-pointer border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  borderRadius: 7,
                }}
              >
                Refresh Preview
              </button>

              <button
                type="button"
                onClick={
                  runMigration
                }
                disabled={
                  loading ||
                  migrating ||
                  !preview ||
                  preview.pendingMigrationCount === 0
                }
                className="cursor-pointer bg-emerald-600 px-5 py-3 text-sm font-semibold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderRadius: 7,
                }}
              >
                {migrating
                  ? "Migrating..."
                  : "Run Migration"}
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin/membership/developers",
                  )
                }
                disabled={
                  migrating
                }
                className="cursor-pointer border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  borderRadius: 7,
                }}
              >
                Back to Developer Accounts
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}