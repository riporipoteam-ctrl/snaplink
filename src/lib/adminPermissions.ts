export type SnapLinkRole = 'user' | 'member' | 'moderator' | 'admin' | null | undefined;

export function isAdminRole(role: SnapLinkRole) {
  return role === 'admin';
}

export function isModeratorRole(role: SnapLinkRole) {
  return role === 'moderator';
}

export function isStaffRole(role: SnapLinkRole) {
  return role === 'admin' || role === 'moderator';
}

export function isTeamRole(role: SnapLinkRole) {
  return role === 'admin' || role === 'moderator' || role === 'member';
}

export function canOpenAdminPanel(role: SnapLinkRole) {
  return isStaffRole(role);
}

export function canViewAdminDashboard(role: SnapLinkRole) {
  return isTeamRole(role);
}

export function canManageUsers(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function canManageTeam(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function canManagePremium(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function canManageCurrencyAndProgress(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function canModerateUsers(role: SnapLinkRole) {
  return isStaffRole(role);
}

export function canManageTasks(role: SnapLinkRole) {
  return isStaffRole(role);
}

export function canCreateBadges(role: SnapLinkRole) {
  return isStaffRole(role);
}

export function canDeleteBadges(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function canWriteAttendance(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function canSendAnnouncements(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function canViewAdminLogs(role: SnapLinkRole) {
  return isAdminRole(role);
}

export function getRoleLabel(role: SnapLinkRole) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderator';
    case 'member':
      return 'Member';
    default:
      return 'User';
  }
}
