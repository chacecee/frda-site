"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import {
  ClipboardList,
  Users,
  ShieldUser,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Trophy,
  Megaphone,
  Newspaper,
  Settings2,
  FileCheck,
  BarChart3,
  Gamepad2,
  CalendarClock,
} from "lucide-react";
import { usePresence } from "@/lib/usePresence";
import {
  AdminSidebarActive,
  ApplicationsTabKey,
  ContentTabKey,
  SidebarPermissionKey,
  SidebarPermissionMap,
  canViewApplicationsSection,
  canViewAnalyticsSection,
  canViewContentSection,
  canViewSidebarTab,
  isAdminRole,
} from "@/lib/adminPermissions";

type AdminSidebarProps = {
  active: AdminSidebarActive;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  displayName: string;
  email?: string | null;
};

type StaffProfile = {
  id: string;
  displayName: string;
  discordProfile: string;
  robloxInput: string;
  emailAddress: string;
  role?: string;
  status?: string;
};

type SelectableStaff = {
  id: string;
  displayName: string;
  emailAddress: string;
  role?: string;
  status?: string;
};

type ProfileFormState = {
  displayName: string;
  discordProfile: string;
  robloxInput: string;
};

type PermissionModalState = {
  open: boolean;
  tabKey: SidebarPermissionKey | null;
  title: string;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function SidebarLink({
  label,
  active = false,
  onClick,
  icon,
  className = "",
  rightSlot,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div
      className={`flex w-full items-center ${className}`}
      style={{
        borderRadius: 0,
        borderLeft: active ? "2px solid #60a5fa" : "2px solid transparent",
        background: active
          ? "linear-gradient(90deg, rgba(59,130,246,0.34) 0%, rgba(96,165,250,0.16) 42%, rgba(24,24,27,0.96) 100%)"
          : "transparent",
        boxShadow: active
          ? "inset 0 0 0 1px rgba(59,130,246,0.08)"
          : "none",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-5 py-4 text-left text-base font-medium transition ${active
          ? "text-white"
          : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white"
          }`}
      >
        <span
          className={`shrink-0 ${active ? "opacity-100 text-blue-300" : "opacity-70"}`}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </button>

      {rightSlot ? <div className="pr-3">{rightSlot}</div> : null}
    </div>
  );
}

function SidebarSectionToggle({
  label,
  active = false,
  open = false,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  open?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left text-base font-medium transition ${active
        ? "text-white"
        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white"
        }`}
      style={{
        borderRadius: 0,
        borderLeft: active ? "2px solid #60a5fa" : "2px solid transparent",
        background: active
          ? "linear-gradient(90deg, rgba(59,130,246,0.22) 0%, rgba(96,165,250,0.10) 42%, rgba(24,24,27,0.96) 100%)"
          : "transparent",
        boxShadow: active
          ? "inset 0 0 0 1px rgba(59,130,246,0.06)"
          : "none",
      }}
    >
      <span
        className={`shrink-0 ${active ? "opacity-100 text-blue-300" : "opacity-70"}`}
      >
        {icon}
      </span>

      <span className="flex-1">{label}</span>

      <span className={`shrink-0 ${active ? "text-blue-300" : "text-zinc-500"}`}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </span>
    </button>
  );
}

export default function AdminSidebar({
  active,
  sidebarOpen,
  onCloseSidebar,
  onNavigate,
  onSignOut,
  displayName,
  email,
}: AdminSidebarProps) {
  const { user } = useAuthUser();
  usePresence(user);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [applicationsOpen, setApplicationsOpen] = useState(active === "applications");

  const [contentOpen, setContentOpen] = useState(
    active === "content_featured_games" ||
    active === "content_game_directory" ||
    active === "content_announcements" ||
    active === "content_blog"
  );

  const [adminOpen, setAdminOpen] = useState(
    active === "admin_tools" ||
    active === "admin_reassign_applications" ||
    active === "admin_staff_meetings"
  );

  const [analyticsOpen, setAnalyticsOpen] = useState(
    active === "analytics_overview" ||
    active === "analytics_games" ||
    active === "analytics_featured" ||
    active === "analytics_sponsor" ||
    active === "analytics_developers"
  );

  const [form, setForm] = useState<ProfileFormState>({
    displayName: "",
    discordProfile: "",
    robloxInput: "",
  });

  const [permissionMap, setPermissionMap] = useState<SidebarPermissionMap>({});
  const [permissionModal, setPermissionModal] = useState<PermissionModalState>({
    open: false,
    tabKey: null,
    title: "",
  });
  const [selectableStaff, setSelectableStaff] = useState<SelectableStaff[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");

  const signedInEmail = normalizeEmail(user?.email || email);

  useEffect(() => {
    if (!signedInEmail) {
      setStaffProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError("");

    const q = query(
      collection(db, "staff"),
      where("emailAddress", "==", signedInEmail),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data() as Omit<StaffProfile, "id">;

          setStaffProfile({
            id: docSnap.id,
            ...data,
          });
          setProfileLoading(false);
          return;
        }

        try {
          const allStaffSnapshot = await getDocs(collection(db, "staff"));
          const match = allStaffSnapshot.docs.find((docSnap) => {
            const data = docSnap.data() as { emailAddress?: string };
            return normalizeEmail(data.emailAddress) === signedInEmail;
          });

          if (!match) {
            setStaffProfile(null);
            setProfileLoading(false);
            return;
          }

          setStaffProfile({
            id: match.id,
            ...(match.data() as Omit<StaffProfile, "id">),
          });
        } catch (error) {
          console.error("Error loading sidebar profile:", error);
          setProfileError("Could not load your profile details.");
        } finally {
          setProfileLoading(false);
        }
      },
      (error) => {
        console.error("Error loading sidebar profile:", error);
        setProfileError("Could not load your profile details.");
        setProfileLoading(false);
      }
    );

    return () => unsubscribe();
  }, [signedInEmail]);

  useEffect(() => {
    const permissionsRef = doc(db, "adminUiPermissions", "sidebar");

    const unsubscribe = onSnapshot(
      permissionsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setPermissionMap({});
          return;
        }

        setPermissionMap(snapshot.data() as SidebarPermissionMap);
      },
      (error) => {
        console.error("Error loading sidebar permissions:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (active === "applications") {
      setApplicationsOpen(true);
    }

    if (
      active === "content_featured_games" ||
      active === "content_game_directory" ||
      active === "content_announcements" ||
      active === "content_blog"
    ) {
      setContentOpen(true);
    }

    if (
      active === "admin_tools" ||
      active === "admin_reassign_applications" ||
      active === "admin_staff_meetings"
    ) {
      setAdminOpen(true);
    }

    if (
      active === "analytics_overview" ||
      active === "analytics_games" ||
      active === "analytics_featured" ||
      active === "analytics_sponsor" ||
      active === "analytics_developers"
    ) {
      setAnalyticsOpen(true);
    }
  }, [active]);

  const displayedName = useMemo(() => {
    return staffProfile?.displayName?.trim() || displayName;
  }, [staffProfile?.displayName, displayName]);

  const displayedEmail = useMemo(() => {
    return staffProfile?.emailAddress?.trim() || email || "—";
  }, [staffProfile?.emailAddress, email]);

  const isAdmin = isAdminRole(staffProfile?.role);

  const canSeeApplicationsDevelopers = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "applications_developers"
  );

  const canSeeFeaturedGames = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "content_featured_games"
  );

  const canSeeGameDirectory = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "content_game_directory"
  );

  const canSeeAnnouncements = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "content_announcements"
  );

  const canSeeBlog = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "content_blog"
  );

  const hasApplicationsAccess = canViewApplicationsSection(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap
  );

  const hasContentAccess = canViewContentSection(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap
  );

  const hasAnalyticsAccess = canViewAnalyticsSection(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap
  );

  const canSeeAnalyticsOverview = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "analytics_overview"
  );

  const canSeeAnalyticsGames = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "analytics_games"
  );

  const canSeeAnalyticsFeatured = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "analytics_featured"
  );

  const canSeeAnalyticsSponsor = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "analytics_sponsor"
  );

  const canSeeAnalyticsDevelopers = canViewSidebarTab(
    staffProfile?.role,
    staffProfile?.id,
    permissionMap,
    "analytics_developers"
  );

  async function openPermissionsModal(
    tabKey: SidebarPermissionKey,
    title: string
  ) {
    setPermissionsLoading(true);
    setPermissionsError("");
    setPermissionModal({
      open: true,
      tabKey,
      title,
    });

    try {
      const snapshot = await getDocs(collection(db, "staff"));
      const rows = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SelectableStaff, "id">),
        }))
        .filter((item) => !isAdminRole(item.role))
        .sort((a, b) =>
          (a.displayName || a.emailAddress || "").localeCompare(
            b.displayName || b.emailAddress || ""
          )
        );

      setSelectableStaff(rows);
      setSelectedStaffIds(permissionMap[tabKey] || []);
    } catch (error) {
      console.error("Error loading selectable staff:", error);
      setPermissionsError("Could not load staff members.");
    } finally {
      setPermissionsLoading(false);
    }
  }

  function closePermissionsModal() {
    if (permissionsSaving) return;
    setPermissionModal({
      open: false,
      tabKey: null,
      title: "",
    });
    setPermissionsError("");
    setSelectableStaff([]);
    setSelectedStaffIds([]);
  }

  function toggleSelectedStaff(staffId: string) {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  }

  async function handleSavePermissions() {
    if (!permissionModal.tabKey) return;

    setPermissionsSaving(true);
    setPermissionsError("");

    try {
      await setDoc(
        doc(db, "adminUiPermissions", "sidebar"),
        {
          [permissionModal.tabKey]: selectedStaffIds,
        },
        { merge: true }
      );

      closePermissionsModal();
    } catch (error) {
      console.error("Error saving tab permissions:", error);
      setPermissionsError("Could not save permissions.");
    } finally {
      setPermissionsSaving(false);
    }
  }

  function openProfileModal() {
    setProfileError("");

    setForm({
      displayName: staffProfile?.displayName || displayName || "",
      discordProfile: staffProfile?.discordProfile || "",
      robloxInput: staffProfile?.robloxInput || "",
    });

    setProfileModalOpen(true);
  }

  function closeProfileModal() {
    if (savingProfile) return;
    setProfileModalOpen(false);
    setProfileError("");
  }

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!staffProfile) {
      setProfileError("No matching staff profile was found for this account.");
      return;
    }

    if (!form.displayName.trim()) {
      setProfileError("Display Name is required.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");

    try {
      await updateDoc(doc(db, "staff", staffProfile.id), {
        displayName: form.displayName.trim(),
        discordProfile: form.discordProfile.trim(),
        robloxInput: form.robloxInput.trim(),
      });

      setProfileModalOpen(false);
    } catch (error) {
      console.error("Error saving own profile:", error);
      setProfileError("Could not save your profile changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseSidebar}
        />
      ) : null}

      <div className="hidden lg:block lg:w-[290px] lg:shrink-0" aria-hidden="true" />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[290px] flex-col overflow-y-auto bg-[#02040a] transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.07) 16%, rgba(59,130,246,0.02) 28%, rgba(59,130,246,0) 40%), linear-gradient(to bottom, #02040a 0%, #010309 32%, #000000 100%)",
        }}
      >
        <div className="p-5">
          <div className="mb-8 flex items-center gap-3">
            <img
              src="/frda-logo.png"
              alt="FRDA logo"
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="text-2xl font-semibold leading-tight text-white">
                FRDA Portal
              </p>
              <p className="text-xs text-zinc-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="space-y-0">
          {hasApplicationsAccess ? (
            <>
              <SidebarSectionToggle
                label="Applications"
                icon={<ClipboardList size={18} strokeWidth={1.3} />}
                active={active === "applications"}
                open={applicationsOpen}
                onClick={() => setApplicationsOpen((prev) => !prev)}
              />

              {applicationsOpen ? (
                <div className="bg-zinc-950/25">
                  {canSeeApplicationsDevelopers ? (
                    <SidebarLink
                      label="Developers"
                      icon={<FileCheck size={16} strokeWidth={1.3} />}
                      active={active === "applications"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "applications_developers",
                                "Applications — Developers"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          <SidebarLink
            label="Staff"
            icon={<Users size={18} strokeWidth={1.3} />}
            active={active === "staff"}
            onClick={() => {
              onCloseSidebar();
              onNavigate("/admin/staff");
            }}
          />

          {hasContentAccess ? (
            <>
              <SidebarSectionToggle
                label="Content"
                icon={<FolderKanban size={18} strokeWidth={1.3} />}
                active={
                  active === "content_featured_games" ||
                  active === "content_announcements" ||
                  active === "content_blog"
                }
                open={contentOpen}
                onClick={() => setContentOpen((prev) => !prev)}
              />

              {contentOpen ? (
                <div className="bg-zinc-950/25">
                  {canSeeFeaturedGames ? (
                    <SidebarLink
                      label="Featured Games"
                      icon={<Trophy size={16} strokeWidth={1.3} />}
                      active={active === "content_featured_games"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/content/featured-games");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "content_featured_games",
                                "Featured Games"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}

                  {canSeeGameDirectory ? (
                    <SidebarLink
                      label="Game Directory"
                      icon={<Gamepad2 size={16} strokeWidth={1.3} />}
                      active={active === "content_game_directory"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/content/games");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "content_game_directory",
                                "Game Directory"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}

                  {canSeeAnnouncements ? (
                    <SidebarLink
                      label="Announcements"
                      icon={<Megaphone size={16} strokeWidth={1.3} />}
                      active={active === "content_announcements"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/content/announcements");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "content_announcements",
                                "Announcements"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}

                  {canSeeBlog ? (
                    <SidebarLink
                      label="Blog"
                      icon={<Newspaper size={16} strokeWidth={1.3} />}
                      active={active === "content_blog"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/content/blog");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal("content_blog", "Blog");
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}


          {isAdmin ? (
            <>
              <SidebarSectionToggle
                label="Admin"
                icon={<ShieldUser size={18} strokeWidth={1.3} />}
                active={
                  active === "admin_tools" ||
                  active === "admin_reassign_applications" ||
                  active === "admin_staff_meetings"
                }
                open={adminOpen}
                onClick={() => setAdminOpen((prev) => !prev)}
              />

              {adminOpen ? (
                <div className="bg-zinc-950/25">
                  <SidebarLink
                    label="Reassign Applications"
                    icon={<ShieldUser size={16} strokeWidth={1.3} />}
                    active={
                      active === "admin_tools" ||
                      active === "admin_reassign_applications"
                    }
                    className="pl-6"
                    onClick={() => {
                      onCloseSidebar();
                      onNavigate("/admin/reassign");
                    }}
                  />

                  <SidebarLink
                    label="Staff Meetings"
                    icon={<CalendarClock size={16} strokeWidth={1.3} />}
                    active={active === "admin_staff_meetings"}
                    className="pl-6"
                    onClick={() => {
                      onCloseSidebar();
                      onNavigate("/admin/meeting-polls");
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {hasAnalyticsAccess ? (
            <>
              <SidebarSectionToggle
                label="Analytics"
                icon={<BarChart3 size={18} strokeWidth={1.3} />}
                active={
                  active === "analytics_overview" ||
                  active === "analytics_games" ||
                  active === "analytics_featured" ||
                  active === "analytics_sponsor" ||
                  active === "analytics_developers"
                }
                open={analyticsOpen}
                onClick={() => setAnalyticsOpen((prev) => !prev)}
              />

              {analyticsOpen ? (
                <div className="bg-zinc-950/25">
                  {canSeeAnalyticsOverview ? (
                    <SidebarLink
                      label="Overview"
                      icon={<BarChart3 size={16} strokeWidth={1.3} />}
                      active={active === "analytics_overview"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/analytics");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "analytics_overview",
                                "Analytics — Overview"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}

                  {canSeeAnalyticsGames ? (
                    <SidebarLink
                      label="Game Directory"
                      icon={<Gamepad2 size={16} strokeWidth={1.3} />}
                      active={active === "analytics_games"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/analytics/games");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "analytics_games",
                                "Analytics — Game Directory"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}

                  {canSeeAnalyticsFeatured ? (
                    <SidebarLink
                      label="Featured Games"
                      icon={<Trophy size={16} strokeWidth={1.3} />}
                      active={active === "analytics_featured"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/analytics/featured");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "analytics_featured",
                                "Analytics — Featured Games"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}

                  {canSeeAnalyticsSponsor ? (
                    <SidebarLink
                      label="Sponsor Report"
                      icon={<Megaphone size={16} strokeWidth={1.3} />}
                      active={active === "analytics_sponsor"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/analytics/sponsor");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "analytics_sponsor",
                                "Analytics — Sponsor Report"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}

                  {canSeeAnalyticsDevelopers ? (
                    <SidebarLink
                      label="Developers"
                      icon={<Users size={16} strokeWidth={1.3} />}
                      active={active === "analytics_developers"}
                      className="pl-6"
                      onClick={() => {
                        onCloseSidebar();
                        onNavigate("/admin/analytics/developers");
                      }}
                      rightSlot={
                        isAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPermissionsModal(
                                "analytics_developers",
                                "Analytics — Developers"
                              );
                            }}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[5px] text-zinc-400 transition hover:bg-zinc-800 hover:text-blue-300"
                            title="Permissions"
                            aria-label="Permissions"
                          >
                            <Settings2 size={14} />
                          </button>
                        ) : null
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

        </nav>

        <div className="mt-auto p-5">
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Signed in as
              </p>

              <button
                type="button"
                onClick={openProfileModal}
                className="shrink-0 cursor-pointer bg-transparent p-0 text-2xl leading-none text-zinc-400 transition hover:text-blue-300"
                aria-label="Edit profile"
                title="Edit profile"
              >
                ⚙
              </button>
            </div>

            <p className="mt-4 break-words text-base font-semibold text-white">
              {displayedName}
            </p>
            <p className="mt-1 break-words text-sm text-zinc-400">
              {displayedEmail}
            </p>
          </div>

          <button
            onClick={onSignOut}
            className="mt-4 cursor-pointer text-sm font-medium text-zinc-400 transition hover:text-blue-300"
          >
            Log out
          </button>
        </div>
      </aside>

      {permissionModal.open ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-lg border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 5 }}
          >
            <div className="border-b border-zinc-800 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    Permissions
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Who can view this tab
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {permissionModal.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePermissionsModal}
                  aria-label="Close"
                  className="cursor-pointer text-white hover:text-zinc-300"
                  style={{
                    width: 42,
                    height: 42,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 5,
                    border: "1px solid rgba(63, 63, 70, 1)",
                    background: "rgba(9, 9, 11, 0.9)",
                    fontSize: 22,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {permissionsLoading ? (
                <p className="text-sm text-zinc-400">Loading staff members...</p>
              ) : (
                <div>
                  <div className="max-h-[320px] overflow-y-auto rounded-[5px] border border-zinc-800 bg-zinc-950/40">
                    {selectableStaff.length === 0 ? (
                      <p className="p-4 text-sm text-zinc-500">
                        No non-admin staff members found.
                      </p>
                    ) : (
                      <div className="divide-y divide-zinc-800">
                        {selectableStaff.map((item) => {
                          const checked = selectedStaffIds.includes(item.id);

                          return (
                            <label
                              key={item.id}
                              className="flex cursor-pointer items-start gap-3 p-4 hover:bg-zinc-900/60"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectedStaff(item.id)}
                                className="mt-1"
                              />

                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white">
                                  {item.displayName || item.emailAddress}
                                </p>
                                <p className="mt-1 break-words text-xs text-zinc-500">
                                  {item.emailAddress}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {permissionsError ? (
                    <p className="mt-4 text-sm text-red-400">{permissionsError}</p>
                  ) : null}

                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closePermissionsModal}
                      className="cursor-pointer px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800/30 disabled:cursor-not-allowed disabled:opacity-70"
                      style={{
                        borderRadius: 5,
                        background: "transparent",
                        border: "1px solid rgba(113, 113, 122, 0.45)",
                      }}
                      disabled={permissionsSaving}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSavePermissions}
                      disabled={permissionsSaving || permissionsLoading}
                      className="px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                      style={{
                        borderRadius: 5,
                        background:
                          "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                        border: "1px solid rgba(96, 165, 250, 0.55)",
                        boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                        minWidth: 130,
                      }}
                    >
                      {permissionsSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {profileModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-lg border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 5 }}
          >
            <div className="border-b border-zinc-800 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    Edit My Details
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Update your staff profile details.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeProfileModal}
                  aria-label="Close"
                  className="cursor-pointer text-white hover:text-zinc-300"
                  style={{
                    width: 42,
                    height: 42,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 5,
                    border: "1px solid rgba(63, 63, 70, 1)",
                    background: "rgba(9, 9, 11, 0.9)",
                    fontSize: 22,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        displayName: e.target.value,
                      }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    style={{ borderRadius: 5 }}
                    placeholder="Enter your display name"
                    disabled={profileLoading || savingProfile}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Discord Profile
                  </label>
                  <input
                    type="text"
                    value={form.discordProfile}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        discordProfile: e.target.value,
                      }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    style={{ borderRadius: 5 }}
                    placeholder="Enter your Discord profile"
                    disabled={profileLoading || savingProfile}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Roblox Username / User ID / Link
                  </label>
                  <input
                    type="text"
                    value={form.robloxInput}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        robloxInput: e.target.value,
                      }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    style={{ borderRadius: 5 }}
                    placeholder="Optional"
                    disabled={profileLoading || savingProfile}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={displayedEmail}
                    readOnly
                    className="w-full border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400 outline-none"
                    style={{ borderRadius: 5 }}
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Your login email can’t be changed from this window.
                  </p>
                </div>

                {profileError ? (
                  <p className="text-sm text-red-400">{profileError}</p>
                ) : null}

                {!profileLoading && !staffProfile ? (
                  <p className="text-sm text-amber-300">
                    No matching staff profile was found for your signed-in email.
                  </p>
                ) : null}
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeProfileModal}
                  className="cursor-pointer px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800/30 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    borderRadius: 5,
                    background: "transparent",
                    border: "1px solid rgba(113, 113, 122, 0.45)",
                  }}
                  disabled={savingProfile}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingProfile || profileLoading || !staffProfile}
                  className="px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    borderRadius: 5,
                    background:
                      "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                    border: "1px solid rgba(96, 165, 250, 0.55)",
                    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                    minWidth: 130,
                  }}
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}