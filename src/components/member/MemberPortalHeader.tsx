"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  UserRound,
  MessagesSquare,
  Send,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";

type AccountPurpose =
  | "developer"
  | "talent_seeker"
  | "both";

type MemberPortalHeaderProps = {
  active:
    | "dashboard"
    | "profile"
    | "connection_requests"
    | "sent_requests";
  title?: string;
  subtitle?: string;
  accountPurpose?: AccountPurpose;
};

type GeneralMemberNotification = {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  href: string;
  gameId: string;
  gameTitle: string;
  isUnread: boolean;
  createdAt: string | null;
};

type ConnectionNotification = {
  requestId: string;
  status:
    | "pending_developer_response"
    | "connected"
    | "declined"
    | "reported"
    | "closed";
  inquiryType: string;
  opportunityTitle: string;
  organizationName: string;
  requesterDisplayName: string;
  requesterAvatarUrl: string;
  requesterRole: string;
  message: string;
  relevantUrl: string;
  isUnread: boolean;
  developerViewedAt: string | null;
  createdAt: string | null;
};

function getInitials(value: string): string {
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
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    },
  ).format(date);
}

export default function MemberPortalHeader({
  active,
  title = "FRDA Member Portal",
  subtitle = "FRDA Dev Network",
  accountPurpose,
}: MemberPortalHeaderProps) {
  const router = useRouter();
  const { user } = useAuthUser();

  const [memberPurpose, setMemberPurpose] =
    useState<AccountPurpose | null>(() => {
      if (accountPurpose) {
        return accountPurpose;
      }

      if (
        typeof window !== "undefined"
      ) {
        const cachedPurpose =
          window.sessionStorage.getItem(
            "frdaMemberAccountPurpose",
          );

        if (
          cachedPurpose === "developer" ||
          cachedPurpose === "talent_seeker" ||
          cachedPurpose === "both"
        ) {
          return cachedPurpose;
        }
      }

      return null;
    });

  const [
    connectionNotifications,
    setConnectionNotifications,
  ] = useState<
    ConnectionNotification[]
  >([]);

  const [
    generalNotifications,
    setGeneralNotifications,
  ] = useState<
    GeneralMemberNotification[]
  >([]);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [
    selectedNotification,
    setSelectedNotification,
  ] =
    useState<ConnectionNotification | null>(
      null,
    );

  useEffect(() => {
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadHeaderData() {
      try {
        const idToken =
          await currentUser.getIdToken();

        const memberResponse = await fetch(
          "/api/member/me",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
          },
        );

        const memberResult =
          await memberResponse
            .json()
            .catch(() => null);

        if (
          memberResponse.ok &&
          memberResult?.ok &&
          !cancelled
        ) {
          const loadedPurpose =
            memberResult.member
              .accountPurpose as
                AccountPurpose;

          setMemberPurpose(
            loadedPurpose,
          );

          window.sessionStorage.setItem(
            "frdaMemberAccountPurpose",
            loadedPurpose,
          );
        }

        const notificationResponse =
          await fetch(
            "/api/member/notifications",
            {
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },
              cache: "no-store",
            },
          );

        const notificationResult =
          await notificationResponse
            .json()
            .catch(() => null);

        if (
          notificationResponse.ok &&
          notificationResult?.ok &&
          !cancelled
        ) {
          setGeneralNotifications(
            (
              notificationResult.notifications ||
              []
            ).slice(0, 8),
          );
        }

        const resolvedPurpose =
          memberResult?.member
            ?.accountPurpose ||
          accountPurpose;

        if (
          resolvedPurpose !==
            "developer" &&
          resolvedPurpose !== "both"
        ) {
          return;
        }

        const requestResponse = await fetch(
          "/api/member/connection-requests",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
          },
        );

        const requestResult =
          await requestResponse
            .json()
            .catch(() => null);

        if (
          requestResponse.ok &&
          requestResult?.ok &&
          !cancelled
        ) {
          setConnectionNotifications(
            (
              requestResult.requests || []
            ).slice(0, 8),
          );
        }
      } catch (error) {
        console.error(
          "Load member portal header error:",
          error,
        );
      }
    }

    loadHeaderData();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    accountPurpose,
  ]);


  const unreadNotificationCount =
    useMemo(
      () =>
        connectionNotifications.filter(
          (notification) =>
            notification.isUnread,
        ).length +
        generalNotifications.filter(
          (notification) =>
            notification.isUnread,
        ).length,
      [
        connectionNotifications,
        generalNotifications,
      ],
    );

  async function openGeneralNotification(
    notification:
      GeneralMemberNotification,
  ) {
    setNotificationsOpen(false);

    if (user && notification.isUnread) {
      setGeneralNotifications(
        (current) =>
          current.map((item) =>
            item.notificationId ===
            notification.notificationId
              ? {
                  ...item,
                  isUnread: false,
                }
              : item,
          ),
      );

      try {
        const idToken =
          await user.getIdToken();

        await fetch(
          "/api/member/notifications",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              notificationId:
                notification.notificationId,
            }),
          },
        );
      } catch (error) {
        console.error(
          "Mark member notification viewed error:",
          error,
        );
      }
    }

    if (notification.href) {
      router.push(notification.href);
    }
  }

  async function openNotification(
    notification:
      ConnectionNotification,
  ) {
    setNotificationsOpen(false);
    setSelectedNotification(
      notification,
    );

    if (
      !user ||
      !notification.isUnread
    ) {
      return;
    }

    setConnectionNotifications(
      (current) =>
        current.map((item) =>
          item.requestId ===
          notification.requestId
            ? {
                ...item,
                isUnread: false,
              }
            : item,
        ),
    );

    try {
      const idToken =
        await user.getIdToken();

      await fetch(
        "/api/member/connection-requests",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            requestId:
              notification.requestId,
          }),
        },
      );
    } catch (error) {
      console.error(
        "Mark notification viewed error:",
        error,
      );
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/member/login");
  }

  const developerAccount =
    memberPurpose === "developer" ||
    memberPurpose === "both";

  const talentSeekerAccount =
    memberPurpose ===
      "talent_seeker" ||
    memberPurpose === "both";

  const tabs = [
    {
      key: "dashboard",
      label: "Dashboard",
      path: "/member/dashboard",
      icon: LayoutDashboard,
      show: true,
    },
    {
      key: "profile",
      label: "Profile",
      path: "/member/profile",
      icon: UserRound,
      show: developerAccount,
    },
    {
      key: "connection_requests",
      label: `Connection Requests${
        unreadNotificationCount > 0
          ? ` (${unreadNotificationCount})`
          : ""
      }`,
      path:
        "/member/connection-requests",
      icon: MessagesSquare,
      show: developerAccount,
    },
    {
      key: "sent_requests",
      label: "Sent Requests",
      path: "/member/sent-requests",
      icon: Send,
      show: talentSeekerAccount,
    },
  ] as const;

  return (
    <>
      <header className="border-b border-white/10 bg-[#050d1c]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/member/dashboard",
              )
            }
            className="flex min-w-0 cursor-pointer items-center gap-3 text-left"
          >
            <img
              src="/frda-logo.png"
              alt="FRDA logo"
              className="h-11 w-11 shrink-0 object-contain"
            />

            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-white">
                {title}
              </p>

              <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                {subtitle}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-3">
            {developerAccount ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setNotificationsOpen(
                      (current) =>
                        !current,
                    )
                  }
                  className="relative flex h-10 w-10 cursor-pointer items-center justify-center text-zinc-400 transition hover:text-white"
                  aria-label="Open notifications"
                >
                  <Bell
                    size={19}
                    strokeWidth={1.8}
                  />

                  {unreadNotificationCount >
                  0 ? (
                    <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-300 px-1 text-[10px] font-bold text-slate-950 shadow-[0_0_14px_rgba(125,211,252,0.85)]">
                      {unreadNotificationCount >
                      9
                        ? "9+"
                        : unreadNotificationCount}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() =>
                        setNotificationsOpen(
                          false,
                        )
                      }
                      className="fixed inset-0 z-40 cursor-default"
                    />

                    <div
                      className="fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden bg-[#081426] shadow-2xl md:absolute md:inset-auto md:right-0 md:top-12 md:h-auto md:w-[min(360px,calc(100vw-32px))] md:border md:border-white/10"
                      style={{
                        borderRadius: 0,
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setNotificationsOpen(false)
                            }
                            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/5 hover:text-white md:hidden"
                            aria-label="Close notifications"
                          >
                            <ArrowLeft size={20} />
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">
                              Notifications
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              Account activity
                            </p>
                          </div>
                        </div>

                        {unreadNotificationCount >
                        0 ? (
                          <span className="text-xs font-medium text-sky-300">
                            {
                              unreadNotificationCount
                            }{" "}
                            new
                          </span>
                        ) : null}
                      </div>

                      {connectionNotifications.length ===
                        0 &&
                      generalNotifications.length ===
                        0 ? (
                        <div className="px-4 py-6 text-center text-sm text-zinc-500">
                          No notifications yet.
                        </div>
                      ) : (
                        <div className="min-h-0 flex-1 overflow-y-auto md:max-h-[420px]">
                          {generalNotifications.map(
                            (notification) => (
                              <button
                                key={
                                  notification.notificationId
                                }
                                type="button"
                                onClick={() =>
                                  openGeneralNotification(
                                    notification,
                                  )
                                }
                                className={`block w-full cursor-pointer border-b border-white/10 px-4 py-4 text-left transition hover:bg-white/[0.04] ${
                                  notification.isUnread
                                    ? "bg-emerald-400/[0.07]"
                                    : ""
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
                                    {notification.type ===
                                    "game_approved" ? (
                                      <Gamepad2 size={18} />
                                    ) : (
                                      <CheckCircle2 size={18} />
                                    )}

                                    <span
                                      className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#081426] ${
                                        notification.isUnread
                                          ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]"
                                          : "bg-zinc-700"
                                      }`}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">
                                      {notification.title}
                                    </p>

                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                                      {notification.message}
                                    </p>

                                    <p className="mt-2 text-[11px] text-zinc-600">
                                      {formatDate(
                                        notification.createdAt,
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ),
                          )}

                          {connectionNotifications.map(
                            (notification) => (
                              <button
                                key={
                                  notification.requestId
                                }
                                type="button"
                                onClick={() =>
                                  openNotification(
                                    notification,
                                  )
                                }
                                className={`block w-full cursor-pointer border-b border-white/10 px-4 py-4 text-left transition last:border-b-0 hover:bg-white/[0.04] ${
                                  notification.isUnread
                                    ? "bg-sky-400/[0.07]"
                                    : ""
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="relative shrink-0">
                                    {notification.requesterAvatarUrl ? (
                                      <img
                                        src={notification.requesterAvatarUrl}
                                        alt=""
                                        className="h-10 w-10 rounded-full border border-white/10 object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">
                                        {getInitials(
                                          notification.requesterDisplayName,
                                        ) || "TS"}
                                      </div>
                                    )}

                                    <span
                                      className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#081426] ${
                                        notification.isUnread
                                          ? "bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]"
                                          : "bg-zinc-700"
                                      }`}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">
                                      {notification.opportunityTitle}
                                    </p>

                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                                      {notification.requesterDisplayName}
                                      {notification.organizationName
                                        ? ` from ${notification.organizationName}`
                                        : ""}{" "}
                                      sent you a connection request.
                                    </p>

                                    <p className="mt-2 text-[11px] text-zinc-600">
                                      {formatDate(
                                        notification.createdAt,
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          router.push(
                            "/member/connection-requests",
                          );
                        }}
                        className="block w-full shrink-0 cursor-pointer border-t border-white/10 px-4 py-4 text-center text-sm font-semibold text-sky-300 hover:bg-white/[0.03] md:py-3 md:text-xs"
                      >
                        View All Connection Requests
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-10 w-10 cursor-pointer items-center justify-center text-zinc-400 transition hover:text-white"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={19} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl overflow-x-auto px-5 md:px-8">
          <nav className="flex min-w-max items-center gap-8">
            {tabs
              .filter(
                (tab) => tab.show,
              )
              .map((tab) => {
                const Icon = tab.icon;
                const isActive =
                  active === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() =>
                      router.push(
                        tab.path,
                      )
                    }
                    className={`relative flex cursor-pointer items-center gap-2 py-4 text-sm font-medium transition ${
                      isActive
                        ? "text-sky-300"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    <Icon
                      size={15}
                      strokeWidth={1.7}
                    />

                    {tab.label}

                    {isActive ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-300" />
                    ) : null}
                  </button>
                );
              })}
          </nav>
        </div>
      </header>

      {selectedNotification ? (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedNotification(
                null,
              );
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-white/10 bg-[#081426] shadow-2xl"
            style={{ borderRadius: 10 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-sky-300">
                  New Connection Request
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  {
                    selectedNotification.opportunityTitle
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedNotification(
                    null,
                  )
                }
                className="cursor-pointer text-2xl text-zinc-400 hover:text-white"
                aria-label="Close notification"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4">
                {selectedNotification.requesterAvatarUrl ? (
                  <img
                    src={selectedNotification.requesterAvatarUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-sky-200">
                    {getInitials(
                      selectedNotification.requesterDisplayName,
                    ) || "TS"}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {
                      selectedNotification.requesterDisplayName
                    }
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedNotification.organizationName ||
                      "No organization submitted"}
                  </p>

                  <p className="mt-0.5 text-xs text-zinc-500">
                    {selectedNotification.requesterRole ||
                      "No role submitted"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-zinc-600">
                Sent{" "}
                {formatDate(
                  selectedNotification.createdAt,
                )}
              </p>

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                  {
                    selectedNotification.message
                  }
                </p>
              </div>

              {selectedNotification.relevantUrl ? (
                <a
                  href={
                    selectedNotification.relevantUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex text-sm font-medium text-sky-300 hover:text-sky-200"
                >
                  Open Relevant Link
                </a>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  setSelectedNotification(
                    null,
                  )
                }
                className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedNotification(
                    null,
                  );

                  router.push(
                    "/member/connection-requests",
                  );
                }}
                className="cursor-pointer bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                style={{ borderRadius: 6 }}
              >
                Review and Respond
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}