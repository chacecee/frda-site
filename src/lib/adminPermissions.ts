export type StaffRole = "Admin" | "Moderator" | "Reviewer" | "Staff";

export type AdminSidebarActive =
  | "applications"
  | "staff"
  | "admin_tools"
  | "content_featured_games"
  | "content_announcements"
  | "content_blog";

export type ApplicationsTabKey = "applications_developers";

export type ContentTabKey =
  | "content_featured_games"
  | "content_announcements"
  | "content_blog";

export type SidebarPermissionKey = ApplicationsTabKey | ContentTabKey;

export type SidebarPermissionMap = Partial<Record<SidebarPermissionKey, string[]>>;

function normalizeRole(role?: string | null): string {
  return role?.trim().toLowerCase() || "";
}

export function isAdminRole(role?: string | null): boolean {
  return normalizeRole(role) === "admin";
}

export function canViewSidebarTab(
  role: string | null | undefined,
  staffId: string | null | undefined,
  permissionMap: SidebarPermissionMap | null | undefined,
  tabKey: SidebarPermissionKey
): boolean {
  if (isAdminRole(role)) return true;
  if (!staffId) return false;

  const allowedIds = permissionMap?.[tabKey] || [];
  return allowedIds.includes(staffId);
}

export function canViewApplicationsSection(
  role: string | null | undefined,
  staffId: string | null | undefined,
  permissionMap: SidebarPermissionMap | null | undefined
): boolean {
  if (isAdminRole(role)) return true;

  return canViewSidebarTab(role, staffId, permissionMap, "applications_developers");
}

export function canViewContentSection(
  role: string | null | undefined,
  staffId: string | null | undefined,
  permissionMap: SidebarPermissionMap | null | undefined
): boolean {
  if (isAdminRole(role)) return true;

  return (
    canViewSidebarTab(role, staffId, permissionMap, "content_featured_games") ||
    canViewSidebarTab(role, staffId, permissionMap, "content_announcements") ||
    canViewSidebarTab(role, staffId, permissionMap, "content_blog")
  );
}

export function canManageApplications(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(role, staffId, permissionMap, "applications_developers");
}

export function canManageFeaturedGames(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(role, staffId, permissionMap, "content_featured_games");
}

export function canManageAnnouncements(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(role, staffId, permissionMap, "content_announcements");
}

export function canManageBlog(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(role, staffId, permissionMap, "content_blog");
}