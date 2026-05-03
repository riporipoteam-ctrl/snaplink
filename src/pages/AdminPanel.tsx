import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, FileText, AlertTriangle, Calendar, Clock, Video, Ban, Flag, CheckCircle, Award, Megaphone, ScrollText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canCreateBadges, canManageTeam, canManageUsers, canOpenAdminPanel, canSendAnnouncements, canViewAdminLogs, canWriteAttendance, getRoleLabel } from '../lib/adminPermissions';

export function AdminPanel() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;

  if (!canOpenAdminPanel(role)) {
    return <div className="p-8 text-center text-red-500">Access Denied. Staff only.</div>;
  }

  const adminLinks = [
    { to: '/admin/dashboard', icon: Shield, label: 'Dashboard', description: 'Overview and statistics', color: 'from-blue-500 to-blue-600' },
    ...(canManageUsers(role) ? [{ to: '/admin/users', icon: Users, label: 'User Management', description: 'Manage users, verification, and Plus status', color: 'from-indigo-500 to-indigo-600' }] : []),
    ...(canCreateBadges(role) ? [{ to: '/admin/badges', icon: Award, label: 'Badges', description: 'Create and assign custom badges', color: 'from-purple-500 to-purple-600' }] : []),
    ...(canSendAnnouncements(role) ? [{ to: '/admin/announcements', icon: Megaphone, label: 'Announcements', description: 'Post updates visible to all users', color: 'from-pink-500 to-rose-600' }] : []),
    { to: '/admin/reports', icon: Flag, label: 'Reports', description: 'Review and resolve user reports', color: 'from-orange-500 to-orange-600' },
    ...(canManageTeam(role) ? [{ to: '/admin/team', icon: Shield, label: 'Manage Team', description: 'Add or remove RIPO team members', color: 'from-cyan-500 to-cyan-600' }] : []),
    { to: '/admin/tasks', icon: FileText, label: 'Tasks', description: 'Assign and track team tasks', color: 'from-green-500 to-green-600' },
    { to: '/admin/warnings', icon: AlertTriangle, label: 'Warnings', description: 'Manage user warnings', color: 'from-amber-500 to-amber-600' },
    { to: '/admin/bans', icon: Ban, label: 'Bans & Timeouts', description: 'Manage user access restrictions', color: 'from-red-500 to-red-600' },
    ...(canWriteAttendance(role) ? [{ to: '/admin/attendance', icon: Clock, label: 'Attendance', description: 'Track team member activity', color: 'from-teal-500 to-teal-600' }] : []),
    { to: '/admin/meetings', icon: Video, label: 'Meetings', description: 'Schedule and host team meetings', color: 'from-violet-500 to-violet-600' },
    ...(canViewAdminLogs(role) ? [{ to: '/admin/logs', icon: ScrollText, label: 'Admin Logs', description: 'Audit what staff are doing', color: 'from-slate-500 to-slate-700' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center dark:text-white"><Shield className="mr-2 text-blue-500" /> Staff Control Center</h1>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">Signed in as</div>
          <div className="mt-2 text-2xl font-black text-gray-950 dark:text-white">{getRoleLabel(role)}</div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your panel only shows the tools your rank can use.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.to} to={link.to} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex items-start space-x-4 group">
                <div className={`bg-gradient-to-br ${link.color} p-3 rounded-xl text-white shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{link.label}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{link.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
