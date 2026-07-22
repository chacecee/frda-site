export type StaffRole = "Admin" | "Moderator" | "Reviewer" | "Staff";

export type AdminSidebarActive =
  | "applications"
  | "membership_developer_accounts"
  | "membership_talent_seeker_accounts"
  | "membership_connection_requests"
  | "membership_invitations"
  | "staff"
  | "admin_tools"
  | "admin_reassign_applications"
  | "admin_staff_meetings"
  | "admin_community_survey"
  | "admin_geekout_opportunity"
  | "content_featured_games"
  | "content_game_directory"
  | "content_announcements"
  | "content_blog"
  | "analytics_overview"
  | "analytics_games"
  | "analytics_featured"
  | "analytics_sponsor"
  | "analytics_developers";

export type ApplicationsTabKey = "applications_developers";

export type MembershipTabKey =
  | "membership_developer_accounts"
  | "membership_talent_seeker_accounts"
  | "membership_connection_requests"
  | "membership_invitations";

export type AdminTabKey = "admin_community_survey";

export type ContentTabKey =
  | "content_featured_games"
  | "content_game_directory"
  | "content_announcements"
  | "content_blog";

export type AnalyticsTabKey =
  | "analytics_overview"
  | "analytics_games"
  | "analytics_featured"
  | "analytics_sponsor"
  | "analytics_developers";

export type SidebarPermissionKey =
  | ApplicationsTabKey
  | MembershipTabKey
  | AdminTabKey
  | ContentTabKey
  | AnalyticsTabKey;

export type SidebarPermissionMap = Partial<
  Record<SidebarPermissionKey, string[]>
>;

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

  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "applications_developers"
  );
}

export function canViewMembershipSection(
  role: string | null | undefined,
  staffId: string | null | undefined,
  permissionMap: SidebarPermissionMap | null | undefined
): boolean {
  if (isAdminRole(role)) return true;

  return (
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "membership_developer_accounts"
    ) ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "membership_talent_seeker_accounts"
    ) ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "membership_connection_requests"
    ) ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "membership_invitations"
    )
  );
}

export function canViewAdminSection(
  role: string | null | undefined,
  staffId: string | null | undefined,
  permissionMap: SidebarPermissionMap | null | undefined
): boolean {
  if (isAdminRole(role)) return true;

  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "admin_community_survey"
  );
}

export function canViewContentSection(
  role: string | null | undefined,
  staffId: string | null | undefined,
  permissionMap: SidebarPermissionMap | null | undefined
): boolean {
  if (isAdminRole(role)) return true;

  return (
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "content_featured_games"
    ) ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "content_game_directory"
    ) ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "content_announcements"
    ) ||
    canViewSidebarTab(role, staffId, permissionMap, "content_blog")
  );
}

export function canViewAnalyticsSection(
  role: string | null | undefined,
  staffId: string | null | undefined,
  permissionMap: SidebarPermissionMap | null | undefined
): boolean {
  if (isAdminRole(role)) return true;

  return (
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "analytics_overview"
    ) ||
    canViewSidebarTab(role, staffId, permissionMap, "analytics_games") ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "analytics_featured"
    ) ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "analytics_sponsor"
    ) ||
    canViewSidebarTab(
      role,
      staffId,
      permissionMap,
      "analytics_developers"
    )
  );
}

export function canManageApplications(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "applications_developers"
  );
}

export function canManageDeveloperAccounts(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "membership_developer_accounts"
  );
}

export function canManageTalentSeekerAccounts(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "membership_talent_seeker_accounts"
  );
}

export function canManageConnectionRequests(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "membership_connection_requests"
  );
}

export function canManageMembershipInvitations(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "membership_invitations"
  );
}

export function canViewCommunitySurvey(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "admin_community_survey"
  );
}

export function canViewGeekOutOpportunity(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "admin_community_survey"
  );
}

export function canManageFeaturedGames(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "content_featured_games"
  );
}

export function canManageGameDirectory(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "content_game_directory"
  );
}

export function canManageAnnouncements(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "content_announcements"
  );
}

export function canManageBlog(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "content_blog"
  );
}

export function canViewAnalyticsOverview(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "analytics_overview"
  );
}

export function canViewAnalyticsGames(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "analytics_games"
  );
}

export function canViewAnalyticsFeatured(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "analytics_featured"
  );
}

export function canViewAnalyticsSponsor(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "analytics_sponsor"
  );
}

export function canViewAnalyticsDevelopers(
  role: string | null | undefined,
  staffId?: string | null,
  permissionMap?: SidebarPermissionMap | null
): boolean {
  return canViewSidebarTab(
    role,
    staffId,
    permissionMap,
    "analytics_developers"
  );
}