import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { CallOverlay } from './CallOverlay';
import { GlobalComposerModal } from './GlobalComposerModal';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { CallProvider } from '../../contexts/CallContext';
import { LevelGiftOverlay } from '../ui/LevelGiftOverlay';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { Menu } from 'lucide-react';
import { EventBanner } from '../ui/EventBanner';
import { EventEffects } from '../ui/EventEffects';
import { SnapLinkEventRecord, getShellActiveEvent, maybeBootstrapScheduledEvents, subscribeToEvents } from '../../lib/events';
import { createNotification } from '../../lib/notifications';
import { EventProvider } from '../../contexts/EventContext';

export function Layout() {
  const { currentUser, userProfile, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [events, setEvents] = useState<SnapLinkEventRecord[]>([]);
  const location = useLocation();
  const isMakeSpaceRoute = location.pathname === '/makespace';
  const isFocusRoute = location.pathname === '/ripoai' || isMakeSpaceRoute;
  const previousActiveEventIdRef = useRef<string | null>(null);
  React.useEffect(() => {
    const openComposer = () => setIsComposerOpen(true);
    window.addEventListener('snaplink:open-composer', openComposer);
    return () => window.removeEventListener('snaplink:open-composer', openComposer);
  }, []);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsubscribe = subscribeToEvents(setEvents);
    return () => unsubscribe();
  }, [userProfile?.uid]);

  useEffect(() => {
    if (userProfile?.role !== 'admin' || !userProfile.uid) return;
    void maybeBootstrapScheduledEvents(userProfile.uid);
  }, [userProfile?.role, userProfile?.uid]);

  const activeEvent = useMemo(
    () => getShellActiveEvent(events),
    [events]
  );

  useEffect(() => {
    if (!userProfile?.uid) return;

    const previousId = previousActiveEventIdRef.current;
    const nextId = activeEvent?.id || null;

    if (previousId && previousId !== nextId) {
      void createNotification({
        type: 'event',
        sourceUserId: activeEvent?.createdBy || userProfile.uid,
        targetUserId: userProfile.uid,
        title: 'Event ended',
        message: 'The live SnapLink event has wrapped up and the app is back to normal mode.',
        dedupeKey: `${previousId}_ended`,
      });
    }

    previousActiveEventIdRef.current = nextId;
  }, [activeEvent?.createdBy, activeEvent?.id, userProfile?.uid]);

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center">Loading...</div>;
  }

  if (!currentUser) {
    // Preserve the intended destination so login can redirect back
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!userProfile) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#f7f9fc] px-6 text-center dark:bg-[#030711]">
        <div className="max-w-md rounded-[2rem] border border-slate-200/80 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92">
          <div className="mx-auto mb-5 h-16 w-16">
            <Logo animate />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight text-slate-950 dark:text-white">Repairing your SnapLink profile</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            You are signed in. SnapLink is rebuilding the missing profile fields instead of sending you back through onboarding.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Retry Loading
            </button>
            <Link
              to="/settings"
              className="rounded-full border border-slate-300 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Open Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <CallProvider>
      <EventProvider value={{ events, activeEvent }}>
      <div
        data-event-theme={activeEvent?.themeKey || 'none'}
        data-event-type={activeEvent?.type || 'none'}
        className="snaplink-shell snaplink-app-shell flex h-[100dvh] min-h-[100dvh] w-full min-h-0 overflow-hidden bg-slate-50 pb-14 text-slate-950 dark:bg-[#020617] dark:text-white md:pb-0"
      >
        <EventEffects event={activeEvent} />
        {!isMakeSpaceRoute && (
          <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
        )}
        <main className={`snaplink-main-panel relative flex-1 min-w-0 min-h-0 overflow-y-auto ${isFocusRoute ? 'bg-transparent' : 'border-x border-slate-200/80 dark:border-slate-800/90 bg-transparent'}`}>
          {!isMakeSpaceRoute && <EventBanner event={activeEvent} />}
          {/* Mobile Header */}
          {!isMakeSpaceRoute && <div className="snaplink-mobile-header safe-area-top safe-area-left safe-area-right md:hidden sticky top-0 z-20 border-b border-slate-200/80 bg-[rgba(255,255,255,0.94)] px-4 pb-2 pt-2 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[rgba(2,6,23,0.94)]">
            <div className="snaplink-topbar flex items-center justify-between gap-3 px-0 py-1.5">
              <button onClick={() => setIsMobileMenuOpen(true)} className="snaplink-mobile-icon-button flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                <Menu className="h-5 w-5" />
              </button>
              <Link to="/" className="flex min-w-0 items-center space-x-2">
                <Logo className="h-9 w-9" />
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">SnapLink</div>
                  <span className="block truncate text-[1.08rem] font-black tracking-tight">Social feed</span>
                </div>
              </Link>
              <Link to="/profile" className="snaplink-mobile-profile-button rounded-2xl border border-gray-200 bg-white/90 p-1 dark:border-gray-700 dark:bg-gray-900/90" aria-label="Open your profile">
                <Avatar src={userProfile.photoURL} alt={userProfile.displayName} size="sm" />
              </Link>
            </div>
          </div>}
          
          <Outlet />
        </main>
        {!isFocusRoute && !isMakeSpaceRoute && <RightSidebar />}
        <CallOverlay />
        <LevelGiftOverlay />
        <GlobalComposerModal isOpen={isComposerOpen} onClose={() => setIsComposerOpen(false)} />
      </div>
      </EventProvider>
      </CallProvider>
    </NotificationProvider>
  );
}
