"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  signOut,
} from "firebase/auth";
import {
  useRouter,
} from "next/navigation";
import {
  Ban,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  useAuthUser,
} from "@/lib/useAuthUser";
import {
  setPresenceOffline,
} from "@/lib/usePresence";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { notify } from "@/components/ToastConfig";

type SecurityMember = {
  memberId: string;
  authUid: string;
  email: string;
  displayName: string;
  accountStatus: string;
  memberStatus: string;
  profileStatus: string;
};

type SecurityConnection = {
  fingerprint: string;
  label: string;
  accountCount: number;
  suspendedAccountCount: number;
  watched: boolean;
  permanentBlock: boolean;
  blockedUntil: string | null;
  blockReason: string;
  riskLevel: string;
  lastRegistrationAt: string | null;
  lastActivityAt: string | null;
  members: SecurityMember[];
};

type SecurityEvent = {
  id: string;
  eventType: string;
  connectionLabel: string;
  memberId: string;
  displayName: string;
  outcome: string;
  details: Record<string, unknown>;
  createdAt: string | null;
};

function formatDate(
  value?: string | null,
): string {
  if (!value) return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone:
        "Asia/Manila",
    },
  ).format(date);
}

function riskClass(
  riskLevel: string,
): string {
  if (
    riskLevel === "high"
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  if (
    riskLevel === "watch"
  ) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  if (
    riskLevel === "low"
  ) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-400";
}

export default function SecurityPage() {
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
    connections,
    setConnections,
  ] = useState<
    SecurityConnection[]
  >([]);

  const [
    events,
    setEvents,
  ] = useState<
    SecurityEvent[]
  >([]);

  const [
    selected,
    setSelected,
  ] = useState<
    SecurityConnection | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    reason,
    setReason,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

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

  async function loadSecurity() {
    if (!user) return;

    setLoading(true);

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/security",
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
          "Could not load security signals.",
        );
      }

      setConnections(
        result.connections ||
        [],
      );

      setEvents(
        result.events || [],
      );

      setSelected(
        (current) => {
          if (!current) {
            return null;
          }

          return (
            result.connections ||
            []
          ).find(
            (
              item:
                SecurityConnection,
            ) =>
              item.fingerprint ===
              current.fingerprint,
          ) || null;
        },
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not load security signals.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSecurity();
  }, [user]);

  const filtered =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return connections;
      }

      return connections.filter(
        (connection) =>
          [
            connection.label,
            connection.riskLevel,
            ...connection.members.flatMap(
              (member) => [
                member.displayName,
                member.email,
                member.memberId,
              ],
            ),
          ]
            .join(" ")
            .toLowerCase()
            .includes(value),
      );
    }, [
      search,
      connections,
    ]);

  const counts =
    useMemo(() => ({
      connections:
        connections.length,
      shared:
        connections.filter(
          (item) =>
            item.accountCount >= 2,
        ).length,
      watched:
        connections.filter(
          (item) =>
            item.watched,
        ).length,
      blocked:
        connections.filter(
          (item) =>
            item.permanentBlock ||
            Boolean(
              item.blockedUntil &&
              new Date(
                item.blockedUntil,
              ).getTime() >
                Date.now(),
            ),
        ).length,
    }), [connections]);

  async function applyAction(
    action: string,
  ) {
    if (
      !user ||
      !selected ||
      processing
    ) {
      return;
    }

    if (
      (
        action === "watch" ||
        action.startsWith(
          "block_",
        )
      ) &&
      !reason.trim()
    ) {
      notify.error(
        "Add an internal reason first.",
      );
      return;
    }

    if (
      action ===
      "block_permanent"
    ) {
      const confirmed =
        window.confirm(
          "Permanently block new signups from this connection?\n\nUse this only when repeated abuse is well documented.",
        );

      if (!confirmed) {
        return;
      }
    }

    setProcessing(true);

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/admin/security",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${idToken}`,
            },
            body:
              JSON.stringify({
                fingerprint:
                  selected.fingerprint,
                action,
                reason:
                  reason.trim(),
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
          "Could not update this connection.",
        );
      }

      notify.success(
        result.message,
      );

      setReason("");
      await loadSecurity();
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not update this connection.",
      );
    } finally {
      setProcessing(false);
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
        Loading security console...
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#060913] text-white">
      <div className="grid min-h-screen w-full lg:grid-cols-[290px_minmax(0,1fr)]">
        <AdminSidebar
          active="admin_security"
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
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">
              Security
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Review shared signup connections, watched fingerprints, security events, and signup blocks. A shared connection is a warning signal, not proof that accounts belong to the same person.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              [
                "Connections",
                counts.connections,
              ],
              [
                "Shared",
                counts.shared,
              ],
              [
                "Watched",
                counts.watched,
              ],
              [
                "Blocked",
                counts.blocked,
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
                    ).toLocaleString()}
                  </p>
                </div>
              ),
            )}
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search connection, member, email, or Member ID"
            className="mb-5 w-full border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-blue-500"
            style={{
              borderRadius: 8,
            }}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="overflow-hidden border border-zinc-800 bg-zinc-950/25"
              style={{ borderRadius: 8 }}>
              <div className="security-scrollbar overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead className="bg-zinc-950/80">
                    <tr className="border-b border-zinc-800 text-left">
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                        Connection
                      </th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                        Accounts
                      </th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                        Risk
                      </th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                        Last activity
                      </th>
                      <th className="px-4 py-3 text-right text-xs uppercase tracking-wide text-zinc-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-sm text-zinc-400"
                        >
                          Loading connections...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-sm text-zinc-400"
                        >
                          No connection records found.
                        </td>
                      </tr>
                    ) : (
                      filtered.map(
                        (connection) => (
                          <tr
                            key={connection.fingerprint}
                            className="border-b border-zinc-800/80 last:border-0"
                          >
                            <td className="px-4 py-4">
                              <p className="font-semibold">
                                {connection.label}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {connection.watched ? (
                                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                                    Watched
                                  </span>
                                ) : null}

                                {connection.permanentBlock ||
                                connection.blockedUntil ? (
                                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
                                    Signup blocked
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-4 py-4 text-sm text-zinc-300">
                              {connection.accountCount}
                              {connection.suspendedAccountCount > 0
                                ? ` · ${connection.suspendedAccountCount} suspended`
                                : ""}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${riskClass(connection.riskLevel)}`}
                              >
                                {connection.riskLevel}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-sm text-zinc-400">
                              {formatDate(connection.lastActivityAt)}
                            </td>

                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(connection);
                                  setReason("");
                                }}
                                className="cursor-pointer rounded-[7px] border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-zinc-800 bg-zinc-950/25 p-5"
              style={{ borderRadius: 8 }}>
              <h2 className="font-semibold">
                Recent security events
              </h2>

              <div className="security-scrollbar mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-2">
                {events.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No events recorded yet.
                  </p>
                ) : (
                  events.map(
                    (event) => (
                      <div
                        key={event.id}
                        className="border border-zinc-800 bg-zinc-950/50 p-3"
                        style={{ borderRadius: 7 }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">
                            {event.eventType.replaceAll("_", " ")}
                          </p>
                          <span className="text-xs text-zinc-600">
                            {event.connectionLabel}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-zinc-500">
                          {event.displayName ||
                          event.memberId ||
                          "No account"}{" "}
                          · {formatDate(event.createdAt)}
                        </p>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/70"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processing) {
              setSelected(null);
            }
          }}
        >
          <div className="flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-900">
            <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Connection
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selected.label}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={processing}
                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="security-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
              <div className="rounded-[8px] border border-amber-500/20 bg-amber-500/[0.07] p-4 text-sm leading-6 text-amber-100">
                A shared connection may be a household, school, office, café, mobile carrier, VPN, or one person using several accounts. Review the account history before blocking.
              </div>

              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Accounts on this connection
              </h3>

              <div className="mt-3 space-y-3">
                {selected.members.map(
                  (member) => (
                    <div
                      key={member.memberId}
                      className="border border-zinc-800 bg-zinc-950/45 p-4"
                      style={{ borderRadius: 8 }}
                    >
                      <p className="font-semibold">
                        {member.displayName || "Unnamed account"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {member.email}
                      </p>
                      <p className="mt-2 text-xs text-zinc-600">
                        {member.memberId} · {member.accountStatus || "—"} · {member.profileStatus || "—"}
                      </p>
                    </div>
                  ),
                )}
              </div>

              <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Internal reason
              </label>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={5}
                maxLength={1000}
                placeholder="Document why this connection is being watched or blocked."
                className="mt-2 w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-6 outline-none placeholder:text-zinc-600 focus:border-blue-500"
                style={{ borderRadius: 8 }}
              />

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    applyAction(
                      selected.watched ? "unwatch" : "watch",
                    )
                  }
                  disabled={processing}
                  className="cursor-pointer rounded-[7px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 disabled:opacity-50"
                >
                  {selected.watched ? "Remove from Watch List" : "Add to Watch List"}
                </button>

                <button
                  type="button"
                  onClick={() => applyAction("block_24h")}
                  disabled={processing}
                  className="cursor-pointer rounded-[7px] border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200 disabled:opacity-50"
                >
                  Block Signup for 24 Hours
                </button>

                <button
                  type="button"
                  onClick={() => applyAction("block_7d")}
                  disabled={processing}
                  className="cursor-pointer rounded-[7px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50"
                >
                  Block Signup for 7 Days
                </button>

                <button
                  type="button"
                  onClick={() => applyAction("block_permanent")}
                  disabled={processing}
                  className="cursor-pointer rounded-[7px] bg-red-600 px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Permanently Block Signup
                </button>

                {(selected.permanentBlock || selected.blockedUntil) ? (
                  <button
                    type="button"
                    onClick={() => applyAction("unblock")}
                    disabled={processing}
                    className="cursor-pointer rounded-[7px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 disabled:opacity-50 sm:col-span-2"
                  >
                    Remove Signup Block
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .security-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(82, 82, 91, 0.95) rgba(9, 9, 11, 0.55);
        }

        .security-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .security-scrollbar::-webkit-scrollbar-track {
          background: rgba(9, 9, 11, 0.72);
          border-radius: 999px;
        }

        .security-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(
            180deg,
            rgba(82, 82, 91, 0.96),
            rgba(63, 63, 70, 0.96)
          );
          border: 2px solid rgba(9, 9, 11, 0.72);
          border-radius: 999px;
        }

        .security-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            180deg,
            rgba(113, 113, 122, 0.98),
            rgba(82, 82, 91, 0.98)
          );
        }

        .security-scrollbar::-webkit-scrollbar-corner {
          background: rgba(9, 9, 11, 0.72);
        }
      `}</style>
    </main>
  );
}