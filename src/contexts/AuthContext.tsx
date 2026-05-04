import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { SocialLinks } from '../lib/profileLinks';
import type { BusinessAffiliation } from '../lib/business';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio?: string;
  websiteUrl?: string;
  socialLinks?: SocialLinks;
  photoURL?: string;
  bannerURL?: string;
  photoStoragePath?: string | null;
  bannerStoragePath?: string | null;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  role: 'user' | 'admin' | 'member' | 'moderator';
  isBanned: boolean;
  timeoutUntil?: string;
  banReason?: string;
  bannedAt?: string;
  bannedBy?: string;
  banExpiresAt?: string;
  isVerified: boolean;
  snapCoins: number;
  level?: number;
  xp?: number;
  totalXp?: number;
  premiumUntil?: string;
  isPremium?: boolean;
  profileDecoration?: string;
  profileWallpaper?: string;
  profileTheme?: string;
  unlockedDecorations?: string[];
  badges?: { id: string; name: string; imageURL: string; assignedAt: string }[];
  hiddenBadges?: string[];
  warnings?: number;
  activityStatus?: 'online' | 'offline' | 'dnd' | 'idle';
  actualPresenceStatus?: 'online' | 'offline' | 'idle';
  lastSeen?: string;
  statusSetAt?: string;
  notificationsEnabled?: boolean;
  notificationPermission?: 'default' | 'granted' | 'denied';
  isPrivate?: boolean;
  accountSwitcherId?: string;
  blockedUserIds?: string[];
  isBusinessAccount?: boolean;
  businessName?: string;
  businessCategory?: string;
  businessBadgeLabel?: string;
  businessAffiliations?: BusinessAffiliation[];
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  sessionId: string | null;
}

const SESSION_KEY = 'snaplink_session_id';

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return { browser, os, userAgent: ua };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildSafeUsername(user: FirebaseUser) {
  const base =
    user.displayName ||
    user.email?.split('@')[0] ||
    `snaplink_${user.uid.slice(0, 6)}`;
  const cleaned = base.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);
  return `${cleaned || 'snaplink'}_${user.uid.slice(0, 6).toLowerCase()}`;
}

function buildDefaultProfile(user: FirebaseUser): UserProfile {
  const createdAt = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toISOString()
    : new Date().toISOString();
  const username = buildSafeUsername(user);

  return {
    uid: user.uid,
    username,
    displayName: user.displayName || username,
    bio: '',
    photoURL: user.photoURL || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
    bannerURL: 'https://picsum.photos/seed/snaplink/800/200',
    createdAt,
    followersCount: 0,
    followingCount: 0,
    role: user.email === 'ripo.ripoteam@gmail.com' ? 'admin' : 'user',
    isBanned: false,
    isVerified: false,
    snapCoins: 100,
    level: 1,
    xp: 0,
    totalXp: 0,
    activityStatus: 'online',
    actualPresenceStatus: 'online',
    statusSetAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    notificationsEnabled: false,
    notificationPermission: 'default',
    unlockedDecorations: [],
    blockedUserIds: [],
    isPrivate: false,
  };
}

function mergeProfileDefaults(user: FirebaseUser, data: Partial<UserProfile>) {
  const defaults = buildDefaultProfile(user);
  return {
    ...defaults,
    ...data,
    uid: user.uid,
    username: data.username || defaults.username,
    displayName: data.displayName || defaults.displayName,
    photoURL: data.photoURL || defaults.photoURL,
    createdAt: data.createdAt || defaults.createdAt,
    followersCount: data.followersCount ?? defaults.followersCount,
    followingCount: data.followingCount ?? defaults.followingCount,
    role: data.role || defaults.role,
    isBanned: data.isBanned ?? defaults.isBanned,
    isVerified: data.isVerified ?? defaults.isVerified,
    snapCoins: data.snapCoins ?? defaults.snapCoins,
    blockedUserIds: data.blockedUserIds || defaults.blockedUserIds,
    unlockedDecorations: data.unlockedDecorations || defaults.unlockedDecorations,
  } as UserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const profileLookupIdRef = useRef(0);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user?.uid);
      
      // Cleanup previous profile listener if it exists
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!user) {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // We have a user, set loading to true while we fetch the profile
      setLoading(true);
      setCurrentUser(user);

      // Listen to user profile
      const userRef = doc(db, 'users', user.uid);
      unsubProfile = onSnapshot(userRef, (docSnap) => {
        const lookupId = ++profileLookupIdRef.current;

        if (docSnap.exists()) {
          const rawData = docSnap.data() as Partial<UserProfile>;
          const data = mergeProfileDefaults(user, rawData);
          console.log('User profile loaded:', data.username);
          if (!rawData.username || !rawData.displayName || rawData.snapCoins === undefined) {
            setDoc(userRef, data, { merge: true }).catch((err) => {
              console.error('Failed to repair incomplete profile:', err);
            });
          }
          if (data.isPremium && data.premiumUntil && new Date(data.premiumUntil) <= new Date()) {
            const clearedPremiumProfile: UserProfile = {
              ...data,
              isPremium: false,
              premiumUntil: undefined,
            };
            setUserProfile(clearedPremiumProfile);
            updateDoc(userRef, {
              isPremium: false,
              premiumUntil: null,
            }).catch((err) => {
              console.error('Failed to clear expired premium:', err);
            });
            setLoading(false);
            return;
          }
          if (data.isBanned && data.banExpiresAt && new Date(data.banExpiresAt) <= new Date()) {
            const clearedProfile: UserProfile = {
              ...data,
              isBanned: false,
              banReason: undefined,
              bannedAt: undefined,
              bannedBy: undefined,
              banExpiresAt: undefined,
            };
            setUserProfile(clearedProfile);
            updateDoc(userRef, {
              isBanned: false,
              banReason: null,
              bannedAt: null,
              bannedBy: null,
              banExpiresAt: null,
            }).catch((err) => {
              console.error('Failed to clear expired ban:', err);
            });
          } else {
            setUserProfile(data);
          }
          setLoading(false);
          return;
        }

        void getDoc(userRef).then(async (confirmedSnap) => {
          if (lookupId !== profileLookupIdRef.current) return;

          if (confirmedSnap.exists()) {
            const confirmedData = mergeProfileDefaults(user, confirmedSnap.data() as Partial<UserProfile>);
            console.log('Recovered user profile after retry:', confirmedData.username);
            setDoc(userRef, confirmedData, { merge: true }).catch((err) => {
              console.error('Failed to repair recovered profile:', err);
            });
            setUserProfile(confirmedData);
          } else {
            console.log('No user profile found for UID:', user.uid);
            const repairedProfile = buildDefaultProfile(user);
            await setDoc(userRef, repairedProfile, { merge: true });
            console.log('Created fallback profile instead of forcing onboarding:', repairedProfile.username);
            setUserProfile(repairedProfile);
          }
          setLoading(false);
        }).catch((retryError) => {
          if (lookupId !== profileLookupIdRef.current) return;
          console.error('Error retrying user profile lookup:', retryError);
          setUserProfile(null);
          setLoading(false);
        });
      }, (error) => {
        console.error('Error in user profile listener:', error);
        setLoading(false);
        try {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        } catch (e) {
          // Already logged above
        }
      });
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // Presence tracking: update lastSeen and handle visibility changes without overriding the user's chosen visible status
  const activityStatusRef = useRef(userProfile?.activityStatus);
  useEffect(() => {
    activityStatusRef.current = userProfile?.activityStatus;
  }, [userProfile?.activityStatus]);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const userRef = doc(db, 'users', userProfile.uid);
    let idleTimeout: ReturnType<typeof setTimeout> | null = null;

    const updatePresence = (presence: 'online' | 'idle' | 'offline') => {
      const payload: Record<string, string> = {
        actualPresenceStatus: presence,
        lastSeen: new Date().toISOString(),
      };

      if (!activityStatusRef.current) {
        payload.activityStatus = 'online';
        payload.statusSetAt = new Date().toISOString();
      }

      return updateDoc(userRef, payload).catch((err) => {
        console.error(`Failed to set ${presence} presence:`, err);
      });
    };
    
    const setOnline = () => {
      if (idleTimeout) { clearTimeout(idleTimeout); idleTimeout = null; }
      void updatePresence('online');
    };
    
    const setAway = () => {
      void updatePresence('idle');
      idleTimeout = setTimeout(() => {
        void updatePresence('offline');
      }, 5 * 60 * 1000);
    };

    const setOffline = () => {
      if (idleTimeout) { clearTimeout(idleTimeout); idleTimeout = null; }
      void updatePresence('offline');
    };

    setOnline();

    const handleVisibilityChange = () => {
      if (document.hidden) setAway();
      else setOnline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', setOffline);
    
    // Heartbeat to keep actual presence fresh without leaking an invisible status change
    const heartbeat = setInterval(() => {
      if (!document.hidden) {
        updateDoc(userRef, {
          actualPresenceStatus: 'online',
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      } else {
        updateDoc(userRef, {
          actualPresenceStatus: 'idle',
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      }
    }, 60000);

    return () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', setOffline);
      clearInterval(heartbeat);
    };
  }, [userProfile?.uid]);

  // Session tracking: record device login and validate session
  useEffect(() => {
    if (!userProfile?.uid) return;

    // Use a session key scoped to this user to avoid cross-user conflicts
    const userSessionKey = `${SESSION_KEY}_${userProfile.uid}`;
    const sid = localStorage.getItem(userSessionKey) || crypto.randomUUID();
    localStorage.setItem(userSessionKey, sid);
    setSessionId(sid);

    const sessionRef = doc(db, 'sessions', sid);
    const { browser, os } = getDeviceInfo();

    // Create/update session record
    setDoc(sessionRef, {
      uid: userProfile.uid,
      browser,
      os,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }, { merge: true }).catch((err) => {
      console.error('Failed to create session:', err);
    });

    // Periodically check if session is still valid (not revoked)
    const checkSession = setInterval(async () => {
      try {
        const snap = await getDoc(sessionRef);
        if (snap.exists()) {
          // Session valid — update lastActive
          await updateDoc(sessionRef, { lastActive: new Date().toISOString() }).catch(() => {});
        } else {
          // Session was revoked by user from another device
          localStorage.removeItem(userSessionKey);
          await signOut(auth);
        }
      } catch {
        // Permission error or network issue — don't sign out, just skip
      }
    }, 30000);

    return () => clearInterval(checkSession);
  }, [userProfile?.uid]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Error signing in with Google (popup):', error);
      // If popup was blocked or failed, try redirect
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error('Error signing in with Google (redirect):', redirectError);
          throw redirectError;
        }
      } else {
        throw error;
      }
    }
  };

  const logout = async () => {
    try {
      // Delete current session on logout
      const uid = userProfile?.uid || currentUser?.uid;
      if (uid) {
        const userSessionKey = `${SESSION_KEY}_${uid}`;
        const sid = localStorage.getItem(userSessionKey);
        if (sid) {
          await deleteDoc(doc(db, 'sessions', sid)).catch(() => {});
          localStorage.removeItem(userSessionKey);
        }
      }
      setSessionId(null);
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, signInWithGoogle, logout, sessionId }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
