import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { PostDetail } from './pages/PostDetail';
import { AdminPanel } from './pages/AdminPanel';
import { Notifications } from './pages/Notifications';
import { Groups } from './pages/Groups';
import { GroupDetail } from './pages/GroupDetail';
import { LiveStreams } from './pages/LiveStreams';
import { Shop } from './pages/Shop';
import { Premium } from './pages/Premium';
import { Challenges } from './pages/Challenges';
import { Messages } from './pages/Messages';
import Friends from './pages/Friends';
import { Settings } from './pages/Settings';
import { HashtagPage } from './pages/HashtagPage';
import { SearchPage } from './pages/SearchPage';
import { RecRoom } from './pages/games/RecRoom';
import { RipoAI } from './pages/RipoAI';
import { FeatureLaunchTeaser } from './pages/FeatureLaunchTeaser';
import { canAccessFeature } from './lib/featureGates';
import { useAuth } from './contexts/AuthContext';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminTasks } from './pages/admin/AdminTasks';
import { AdminBans } from './pages/admin/AdminBans';
import { AdminWarnings } from './pages/admin/AdminWarnings';
import { AdminAttendance } from './pages/admin/AdminAttendance';
import { AdminMeetings } from './pages/admin/AdminMeetings';
import { AdminTeam } from './pages/admin/AdminTeam';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminBadges } from './pages/admin/AdminBadges';
import { AdminAnnouncements } from './pages/admin/AdminAnnouncements';
import { AdminLogs } from './pages/admin/AdminLogs';
import { Announcements } from './pages/Announcements';
import { Suggestions } from './pages/Suggestions';
import { Events } from './pages/Events';
import { UsernameProfileRedirect } from './pages/UsernameProfileRedirect';
import { MakeSpace } from './pages/MakeSpace';

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className="h-full w-full"
  >
    {children}
  </motion.div>
);

export function AnimatedRoutes() {
  const location = useLocation();
  const { userProfile } = useAuth();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/onboarding" element={<PageWrapper><Onboarding /></PageWrapper>} />
        <Route path="/" element={<Layout />}>
          <Route index element={<PageWrapper><Home /></PageWrapper>} />
          <Route path="profile" element={<PageWrapper><Profile /></PageWrapper>} />
          <Route path="profile/:userId" element={<PageWrapper><Profile /></PageWrapper>} />
          <Route path="post/:postId" element={<PageWrapper><PostDetail /></PageWrapper>} />
          <Route path="admin" element={<PageWrapper><AdminPanel /></PageWrapper>} />
          <Route path="admin/dashboard" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
          <Route path="admin/users" element={<PageWrapper><AdminUsers /></PageWrapper>} />
          <Route path="admin/reports" element={<PageWrapper><AdminReports /></PageWrapper>} />
          <Route path="admin/team" element={<PageWrapper><AdminTeam /></PageWrapper>} />
          <Route path="admin/tasks" element={<PageWrapper><AdminTasks /></PageWrapper>} />
          <Route path="admin/bans" element={<PageWrapper><AdminBans /></PageWrapper>} />
          <Route path="admin/warnings" element={<PageWrapper><AdminWarnings /></PageWrapper>} />
          <Route path="admin/attendance" element={<PageWrapper><AdminAttendance /></PageWrapper>} />
          <Route path="admin/meetings" element={<PageWrapper><AdminMeetings /></PageWrapper>} />
          <Route path="admin/badges" element={<PageWrapper><AdminBadges /></PageWrapper>} />
          <Route path="admin/announcements" element={<PageWrapper><AdminAnnouncements /></PageWrapper>} />
          <Route path="admin/logs" element={<PageWrapper><AdminLogs /></PageWrapper>} />
          <Route path="announcements" element={<PageWrapper><Announcements /></PageWrapper>} />
          <Route path="events" element={<PageWrapper><Events /></PageWrapper>} />
          <Route path="shop" element={<PageWrapper><Shop /></PageWrapper>} />
          <Route path="premium" element={<PageWrapper><Premium /></PageWrapper>} />
          <Route path="notifications" element={<PageWrapper><Notifications /></PageWrapper>} />
          <Route path="messages" element={<PageWrapper><Messages /></PageWrapper>} />
          <Route path="friends" element={<PageWrapper><Friends /></PageWrapper>} />
          <Route path="bookmarks" element={<PageWrapper><div className="p-8 text-center text-gray-500">Bookmarks coming soon</div></PageWrapper>} />
          <Route path="challenges" element={<PageWrapper><Challenges /></PageWrapper>} />
          <Route path="groups" element={<PageWrapper><Groups /></PageWrapper>} />
          <Route path="group/:groupId" element={<PageWrapper><GroupDetail /></PageWrapper>} />
          <Route path="live" element={<PageWrapper><LiveStreams /></PageWrapper>} />
          <Route path="suggestions" element={<PageWrapper><Suggestions /></PageWrapper>} />
          <Route path="settings" element={<PageWrapper><Settings /></PageWrapper>} />
          <Route path="hashtag/:tag" element={<PageWrapper><HashtagPage /></PageWrapper>} />
          <Route path="search" element={<PageWrapper><SearchPage /></PageWrapper>} />
          <Route path="u/:username" element={<PageWrapper><UsernameProfileRedirect /></PageWrapper>} />
          <Route path="recroom" element={<PageWrapper><RecRoom /></PageWrapper>} />
          <Route
            path="makespace"
            element={
              <PageWrapper>
                {userProfile?.role === 'admin' ? <MakeSpace /> : <Navigate to="/" replace />}
              </PageWrapper>
            }
          />
          <Route
            path="ripoai"
            element={
              <PageWrapper>
                {canAccessFeature('ripoai', userProfile?.role) ? <RipoAI /> : <FeatureLaunchTeaser feature="ripoai" />}
              </PageWrapper>
            }
          />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}
