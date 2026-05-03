import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  User,
  Bell,
  Mail,
  LogOut,
  Users,
  Video,
  Shield,
  ShoppingBag,
  Crown,
  Target,
  X,
  Settings,
  LayoutDashboard,
  CheckSquare,
  Ban,
  AlertTriangle,
  CalendarCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bot,
  Lightbulb,
  Trophy,
  Gamepad2,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import { motion, AnimatePresence } from 'motion/react';
import { getAvatarDecorationClass } from '../../lib/profileAppearance';
import { resolveOwnedShopUrl } from '../../lib/shopCatalog';
import { canAccessFeature } from '../../lib/featureGates';
import { useSnapLinkEvents } from '../../contexts/EventContext';
import { canManageTasks, canModerateUsers, canOpenAdminPanel, canViewAdminDashboard, canWriteAttendance, isStaffRole } from '../../lib/adminPermissions';

interface SidebarProps {
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (isOpen: boolean) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (isCollapsed: boolean) => void;
}

interface NavItemConfig {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: number;
}

interface NavSectionConfig {
  id: string;
  label: string;
  items: NavItemConfig[];
  collapsible?: boolean;
}

export function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen, isCollapsed = false, setIsCollapsed }: SidebarProps) {
  const { userProfile, logout } = useAuth();
  const { unreadCount, markAllAsRead } = useNotifications();
  const { activeEvent } = useSnapLinkEvents();
  const location = useLocation();
  const navigate = useNavigate();
  const visibleProfileDecoration = resolveOwnedShopUrl(
    userProfile?.profileDecoration || null,
    'avatar',
    userProfile?.unlockedDecorations
  );

  const primaryItems: NavItemConfig[] = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Bell, label: 'Notifications', path: '/notifications', badge: unreadCount },
    { icon: Mail, label: 'Messages', path: '/messages' },
    { icon: Users, label: 'Friends', path: '/friends' },
  ];

  const teamItems: NavItemConfig[] =
    canViewAdminDashboard(userProfile?.role)
      ? [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
          ...(userProfile?.role === 'member' || canManageTasks(userProfile?.role) ? [{ icon: CheckSquare, label: 'Tasks', path: '/admin/tasks' }] : []),
          ...(userProfile?.role === 'member' || isStaffRole(userProfile?.role) ? [{ icon: Video, label: 'Meetings', path: '/admin/meetings' }] : []),
          ...(userProfile?.role === 'member' || canWriteAttendance(userProfile?.role) ? [{ icon: CalendarCheck, label: 'Attendance', path: '/admin/attendance' }] : []),
          ...(userProfile?.role === 'member' || canModerateUsers(userProfile?.role) ? [{ icon: Ban, label: 'Bans', path: '/admin/bans' }] : []),
          ...(userProfile?.role === 'member' || canModerateUsers(userProfile?.role) ? [{ icon: AlertTriangle, label: 'Warnings', path: '/admin/warnings' }] : []),
          ...(canOpenAdminPanel(userProfile?.role) ? [{ icon: Shield, label: 'Admin Panel', path: '/admin' }] : []),
        ]
      : [];

  const ripoAIUnlocked = canAccessFeature('ripoai', userProfile?.role);
  const makeSpaceVisible = userProfile?.role === 'admin';
  const showEventsHub = isStaffRole(userProfile?.role) || Boolean(activeEvent);

  const exploreItems: NavItemConfig[] = [
    ...(showEventsHub ? [{ icon: Trophy, label: 'Events', path: '/events' }] : []),
    { icon: Megaphone, label: 'Announcements', path: '/announcements' },
    { icon: Target, label: 'Challenges', path: '/challenges' },
    { icon: Users, label: 'Groups', path: '/groups' },
    { icon: Video, label: 'Live', path: '/live' },
    { icon: Lightbulb, label: 'Suggestions', path: '/suggestions' },
    ...(makeSpaceVisible ? [{ icon: Gamepad2, label: 'MakeSpace', path: '/makespace' }] : []),
    ...(ripoAIUnlocked ? [{ icon: Bot, label: 'RipoAI', path: '/ripoai' }] : []),
    { icon: ShoppingBag, label: 'Shop', path: '/shop' },
    { icon: Crown, label: 'Plus', path: '/premium' },
  ];

  const personalItems: NavItemConfig[] = [
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const navSections: NavSectionConfig[] = [
    { id: 'primary', label: 'Quick Access', items: primaryItems, collapsible: false },
    ...(teamItems.length > 0 ? [{ id: 'team', label: 'Team Space', items: teamItems }] : []),
    { id: 'explore', label: 'Explore', items: exploreItems },
    { id: 'personal', label: 'Your Account', items: personalItems },
  ];
  const desktopNavSections = navSections;
  const mobileNavSections = navSections;
  const isExploreRoute = exploreItems.some((item) => location.pathname === item.path || location.pathname.startsWith(item.path));
  const isPersonalRoute = personalItems.some((item) => location.pathname === item.path || location.pathname.startsWith(item.path));

  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    team: location.pathname.startsWith('/admin'),
    explore: isExploreRoute,
    personal: isPersonalRoute,
  });

  React.useEffect(() => {
    if (location.pathname === '/notifications' && unreadCount > 0) {
      markAllAsRead();
    }
  }, [location.pathname, unreadCount, markAllAsRead]);

  React.useEffect(() => {
    const matchingSection = navSections.find((section) =>
      section.items.some((item) => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)))
    );

    if (matchingSection && matchingSection.collapsible !== false) {
      setOpenSections((prev) => ({
        ...prev,
        [matchingSection.id]: true,
      }));
    }
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isMobileMenuOpen]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const NavItem = React.memo(function NavItem({ item }: { item: NavItemConfig }) {
    return (
      <NavLink
        to={item.path}
        onClick={() => setIsMobileMenuOpen?.(false)}
        title={isCollapsed ? item.label : undefined}
        className={({ isActive }) =>
          `snaplink-nav-item group flex items-center gap-3 rounded-2xl transition-all duration-200 ${
            isCollapsed ? 'h-11 w-11 justify-center' : 'px-4 py-3'
          } ${
            isActive
              ? 'snaplink-nav-item-active bg-slate-950 text-white dark:bg-white dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100/90 dark:text-slate-300 dark:hover:bg-slate-900/70'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <div className="relative shrink-0">
              <item.icon className={`h-[21px] w-[21px] ${isActive ? '' : 'group-hover:scale-105'} transition-transform`} strokeWidth={isActive ? 2.35 : 2} />
              {(item.badge || 0) > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1">
                  <span className="text-[10px] font-bold leading-none text-white">
                    {(item.badge || 0) > 99 ? '99+' : item.badge}
                  </span>
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate text-[15px] font-semibold">{item.label}</span>
              </div>
            )}
          </>
        )}
      </NavLink>
    );
  });

  const SectionBlock = ({ section }: { section: NavSectionConfig }) => {
    if (isCollapsed) {
      return (
        <div className="space-y-1">
          {section.items.map((item) => (
            <NavItem key={`${section.id}-${item.path}`} item={item} />
          ))}
        </div>
      );
    }

    const isOpen = section.collapsible === false ? true : openSections[section.id];

    return (
      <div className="snaplink-sidebar-section pb-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">{section.label}</p>
          {section.collapsible !== false && (
            <button
              onClick={() => toggleSection(section.id)}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title={isOpen ? 'Collapse section' : 'Expand section'}
            >
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-1 px-1 pt-1">
                {section.items.map((item) => (
                  <NavItem key={`${section.id}-${item.path}`} item={item} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const mobileNavItems: NavItemConfig[] = [
    primaryItems[0],
    primaryItems[1],
    primaryItems[2],
    { icon: Users, label: 'Groups', path: '/groups' },
    personalItems[0],
  ];

  const openComposer = () => {
    window.dispatchEvent(new Event('snaplink:open-composer'));
    setIsMobileMenuOpen?.(false);
  };

  return (
    <>
      <aside
        className={`snaplink-sidebar-shell sticky top-0 z-30 hidden h-[100dvh] min-h-0 shrink-0 overflow-hidden border-r border-slate-200/80 dark:border-slate-800/80 md:flex ${
          isCollapsed ? 'w-[var(--snaplink-left-rail-collapsed-width)]' : 'w-[var(--snaplink-left-rail-width)]'
        } flex-col transition-all duration-300`}
      >
        <div className={`snaplink-sidebar-brand shrink-0 ${isCollapsed ? 'px-3 pt-4 pb-2' : 'px-5 pt-5 pb-3'}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            {isCollapsed ? (
              <Logo className="h-10 w-10" animate={false} />
            ) : (
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10" animate={false} />
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-500">SnapLink</div>
                  <div className="font-display text-xl font-black tracking-tight text-slate-950 dark:text-white">Menu</div>
                </div>
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={() => setIsCollapsed?.(true)}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {isCollapsed && (
            <button
              onClick={() => setIsCollapsed?.(false)}
              className="mt-3 flex w-full justify-center rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

        </div>

        <nav className={`flex-1 min-h-0 overflow-y-auto overscroll-y-contain ${isCollapsed ? 'px-3 pb-4' : 'px-4 pb-5'} space-y-4`}>
          {desktopNavSections.map((section) => (
            <React.Fragment key={section.id}>
              <SectionBlock section={section} />
            </React.Fragment>
          ))}

          {!isCollapsed && (
            <button
              className="snaplink-create-post-button h-12 w-full rounded-full bg-slate-950 text-base font-bold text-white transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              onClick={openComposer}
            >
              Create Post
            </button>
          )}
        </nav>
      </aside>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setIsMobileMenuOpen?.(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="safe-area-top safe-area-left safe-area-right fixed inset-y-0 left-0 z-50 flex min-h-0 h-[100dvh] w-[min(24rem,calc(100vw-0.5rem))] flex-col overflow-hidden rounded-r-[28px] bg-[rgba(255,255,255,0.98)] shadow-2xl dark:bg-[rgba(2,6,23,0.98)] md:hidden"
            >
              <div className="shrink-0 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-500">SnapLink</div>
                    <div className="font-display text-lg font-black text-slate-950 dark:text-white">Menu</div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen?.(false)}
                    className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="h-5 w-5 dark:text-white" />
                  </button>
                </div>
              </div>

              {userProfile && (
                <div className="shrink-0 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/profile');
                      setIsMobileMenuOpen?.(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                  >
                    <Avatar
                      src={userProfile.photoURL}
                      alt={userProfile.displayName}
                      className={`h-12 w-12 ${getAvatarDecorationClass(visibleProfileDecoration, '')}`}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-bold dark:text-white">{userProfile.displayName}</div>
                      <div className="truncate text-sm text-gray-500 dark:text-gray-400">@{userProfile.username}</div>
                    </div>
                  </button>
                </div>
              )}

              <nav className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 space-y-2.5">
                <button
                  onClick={openComposer}
                  className="snaplink-create-post-button mb-2 flex h-12 w-full items-center justify-center rounded-[20px] border border-slate-950 bg-slate-950 text-sm font-bold text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)] dark:border-white dark:bg-white dark:text-slate-950"
                >
                  Create Post
                </button>
                {mobileNavSections.map((section) => (
                  <React.Fragment key={`mobile-${section.id}`}>
                    <SectionBlock section={section} />
                  </React.Fragment>
                ))}
              </nav>

              <div className="safe-area-bottom shrink-0 border-t border-gray-200 px-4 py-3 dark:border-gray-800">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Log out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="snaplink-mobile-tabbar safe-area-bottom safe-area-left safe-area-right fixed bottom-0 left-0 right-0 z-50 flex h-[calc(4.65rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-slate-200/80 bg-[rgba(248,250,252,0.94)] px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800/80 dark:bg-[rgba(2,6,23,0.94)] md:hidden">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `snaplink-mobile-tab relative flex min-w-[3.7rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-2 transition-colors ${
                isActive
                  ? 'bg-gray-100 text-black dark:bg-gray-800 dark:text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
                {(item.badge || 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5">
                    <span className="text-[9px] font-bold text-white">{(item.badge || 0) > 9 ? '9+' : item.badge}</span>
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
