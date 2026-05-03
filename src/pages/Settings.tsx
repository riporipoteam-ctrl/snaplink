import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, updateDoc, getDocs, collection, query, where, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { EmailAuthProvider, linkWithCredential, unlink, updatePassword, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Moon, Sun, User, LogOut, PlusCircle, Settings as SettingsIcon, Type, FileText, Globe, Bell, Shield, Palette, Circle, MinusCircle, Clock, Link2, QrCode, Copy, Check, Share2, Download, Monitor, Smartphone, Trash2, Loader2, AlertTriangle, Key, Lock, Eye, EyeOff } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { ensureNotificationWorker, getSystemNotificationSupport, requestSystemNotificationPermission } from '../lib/browserNotifications';
import { LinkedAccount, getLinkedAccountOwner, getLinkedAccounts, mergeLinkedAccounts, removeLinkedAccount, saveLinkedAccount, setLinkedAccountOwner } from '../lib/accountSwitcher';

interface SessionInfo {
  id: string;
  uid: string;
  browser: string;
  os: string;
  lastActive: string;
  createdAt: string;
}

export function Settings() {
  const { userProfile, logout, sessionId } = useAuth();
  const notificationSupport = getSystemNotificationSupport();
  const { theme, toggleTheme } = useTheme();
  const [newUsername, setNewUsername] = useState(userProfile?.username || '');
  const [newDisplayName, setNewDisplayName] = useState(userProfile?.displayName || '');
  const [newBio, setNewBio] = useState(userProfile?.bio || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Login link state
  const [loginLink, setLoginLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordMsgType, setPasswordMsgType] = useState<'success' | 'error'>('error');
  const [changingPassword, setChangingPassword] = useState(false);
  const [reauthed, setReauthed] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const linkedAccountScope = userProfile?.uid || null;
  const rememberedSwitcherOwner = getLinkedAccountOwner();
  const isSwitcherHubOwner = !!userProfile?.uid && (!userProfile?.accountSwitcherId || userProfile.accountSwitcherId === userProfile.uid);
  const cloudLinkedAccountOwner = isSwitcherHubOwner ? userProfile?.uid || rememberedSwitcherOwner || null : null;

  useEffect(() => {
    setLinkedAccounts(getLinkedAccounts(linkedAccountScope));
  }, [linkedAccountScope]);

  useEffect(() => {
    if (isSwitcherHubOwner && userProfile?.uid) {
      setLinkedAccountOwner(userProfile.uid);
    }
  }, [isSwitcherHubOwner, userProfile?.uid]);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const localAccounts = getLinkedAccounts(linkedAccountScope);
    setLinkedAccounts(localAccounts);

    if (!cloudLinkedAccountOwner) {
      return;
    }

    return onSnapshot(
      collection(db, 'account_switchers', cloudLinkedAccountOwner, 'accounts'),
      (snapshot) => {
        const remoteAccounts = snapshot.docs
          .map((accountDoc) => accountDoc.data() as LinkedAccount)
          .filter((account) => account?.uid && account?.loginLink);
        const mergedAccounts = mergeLinkedAccounts(linkedAccountScope, getLinkedAccounts(linkedAccountScope), remoteAccounts);
        setLinkedAccounts(mergedAccounts);
      },
      () => {
        setLinkedAccounts(getLinkedAccounts(linkedAccountScope));
      }
    );
  }, [cloudLinkedAccountOwner, linkedAccountScope, userProfile?.uid]);

  const syncLinkedAccountsCloud = async (ownerUid: string, accounts: LinkedAccount[]) => {
    await setDoc(doc(db, 'account_switchers', ownerUid), {
      ownerUid,
      updatedAt: new Date().toISOString(),
      accountsCount: accounts.length,
    }, { merge: true });

    const accountsRef = collection(db, 'account_switchers', ownerUid, 'accounts');
    const existingSnapshot = await getDocs(accountsRef);
    const nextIds = new Set(accounts.map((account) => account.uid));

    await Promise.all(accounts.map((account) =>
      setDoc(doc(db, 'account_switchers', ownerUid, 'accounts', account.uid), account, { merge: true })
    ));

    await Promise.all(
      existingSnapshot.docs
        .filter((accountDoc) => !nextIds.has(accountDoc.id))
        .map((accountDoc) => deleteDoc(accountDoc.ref))
    );
  };

  const ensureLinkedAccountOwner = async () => {
    if (!userProfile || !isSwitcherHubOwner) return null;

    const ownerUid = userProfile.uid;
    setLinkedAccountOwner(ownerUid);

    if (userProfile.accountSwitcherId !== ownerUid) {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        accountSwitcherId: ownerUid,
      });
    }

    return ownerUid;
  };

  // Load existing login token on mount
  useEffect(() => {
    if (!userProfile?.uid) return;
    const loadExistingToken = async () => {
      try {
        const tokensQ = query(collection(db, 'login_tokens'), where('uid', '==', userProfile.uid));
        const snap = await getDocs(tokensQ);
        if (!snap.empty) {
          const tokenDoc = snap.docs[0];
          setLoginLink(`${window.location.origin}/login?token=${tokenDoc.id}`);
        }
      } catch { /* silent */ }
    };
    loadExistingToken();
  }, [userProfile?.uid]);

  // Load sessions
  useEffect(() => {
    if (!userProfile?.uid) return;
    const loadSessions = async () => {
      setLoadingSessions(true);
      try {
        const sessionsQ = query(collection(db, 'sessions'), where('uid', '==', userProfile.uid));
        const snap = await getDocs(sessionsQ);
        const list: SessionInfo[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionInfo));
        list.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
        setSessions(list);
      } catch { /* silent */ }
      setLoadingSessions(false);
    };
    loadSessions();
  }, [userProfile?.uid]);

  const generateLoginLink = async () => {
    if (!auth.currentUser || !userProfile) return;
    setGeneratingLink(true);
    setLinkError('');

      try {
        const tokenId = crypto.randomUUID().replace(/-/g, '');
        const shareEmail = `share-${tokenId}@snaplink-share.app`;
        const sharePassword = `SL-${crypto.randomUUID()}`;
        const accountSwitcherId = isSwitcherHubOwner ? userProfile.uid : null;

      const providers = auth.currentUser.providerData.map(p => p.providerId);
      const hasPassword = providers.includes('password');

      // If user already has a password provider (from a previous link), unlink it first
      if (hasPassword) {
        try {
          await unlink(auth.currentUser, 'password');
        } catch { /* might fail if it's their only provider, that's ok we'll try linking anyway */ }
      }

      // Link the new shareable credential to this account
      const credential = EmailAuthProvider.credential(shareEmail, sharePassword);
      await linkWithCredential(auth.currentUser, credential);

      // Delete old login tokens for this user
      try {
        const oldTokensQ = query(collection(db, 'login_tokens'), where('uid', '==', userProfile.uid));
        const oldTokens = await getDocs(oldTokensQ);
        for (const d of oldTokens.docs) {
          await deleteDoc(d.ref);
        }
      } catch { /* silent - might fail if collection doesn't exist yet */ }

      // Store new token
      await setDoc(doc(db, 'login_tokens', tokenId), {
        email: shareEmail,
        password: sharePassword,
        uid: userProfile.uid,
        accountSwitcherId,
        createdAt: new Date().toISOString(),
      });

      const link = `${window.location.origin}/login?token=${tokenId}`;
      setLoginLink(link);
      return link;
    } catch (err: any) {
      console.error('Failed to generate login link:', err);
      const code = err?.code || '';
      if (code === 'auth/requires-recent-login') {
        setLinkError('Your session is too old. Please sign out, sign back in, then try again.');
      } else if (code === 'auth/provider-already-linked') {
        // Password provider already linked — try a different approach: unlink and relink
        try {
          await unlink(auth.currentUser!, 'password');
          // Retry the whole thing
          setGeneratingLink(false);
          return generateLoginLink();
        } catch (unlinkErr: any) {
          setLinkError(`Cannot replace existing link: ${unlinkErr?.code || unlinkErr?.message || 'Unknown error'}`);
        }
      } else if (code === 'auth/email-already-in-use') {
        // The generated email somehow exists — extremely unlikely, just retry
        setGeneratingLink(false);
        return generateLoginLink();
      } else {
        setLinkError(`Failed to generate login link: ${code || err?.message || 'Unknown error'}`);
      }
      return null;
    } finally {
      setGeneratingLink(false);
    }
  };

  const saveCurrentAccountForQuickSwitch = async () => {
    if (!userProfile) return;
    setMessage('');
    const link = loginLink || (await generateLoginLink());
    if (!link) return;

    const nextAccounts = saveLinkedAccount(linkedAccountScope, {
      uid: userProfile.uid,
      displayName: userProfile.displayName,
      username: userProfile.username,
      photoURL: userProfile.photoURL,
      loginLink: link,
    });

    setLinkedAccounts(nextAccounts);

    if (!isSwitcherHubOwner) {
      setMessage('Saved on this device. Open your main account to manage synced switching across devices.');
      return;
    }

    const ownerUid = await ensureLinkedAccountOwner();
    if (!ownerUid) {
      setMessage('Saved on this device.');
      return;
    }

    try {
      await syncLinkedAccountsCloud(ownerUid, nextAccounts);
      setMessage('Quick switch updated across your devices.');
    } catch (error) {
      console.error('Failed to sync quick switcher:', error);
      setMessage('Saved on this device, but cloud sync did not finish.');
    }
  };

  const switchToLinkedAccount = async (account: LinkedAccount) => {
    if (account.uid === userProfile?.uid) return;
    setSwitchingAccountId(account.uid);
    try {
      await logout();
    } catch {
      // Continue with the redirect even if local session cleanup fails.
    }
    window.location.assign(account.loginLink);
  };

  const removeQuickSwitchAccount = async (uid: string) => {
    const nextAccounts = removeLinkedAccount(linkedAccountScope, uid);
    setLinkedAccounts(nextAccounts);
    if (cloudLinkedAccountOwner) {
      try {
        await syncLinkedAccountsCloud(cloudLinkedAccountOwner, nextAccounts);
      } catch (error) {
        console.error('Failed to sync linked-account removal:', error);
      }
    }
    setMessage(uid === userProfile?.uid ? 'Quick switch updated successfully!' : 'Saved account removed successfully!');
  };

  const copyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(loginLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = loginLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const shareLoginLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${userProfile?.displayName} on SnapLink`,
          text: `Join me on SnapLink!`,
          url: loginLink,
        });
      } catch { /* cancelled */ }
    } else {
      copyLoginLink();
    }
  };

  const revokeSession = async (sid: string) => {
    setRevokingSession(sid);
    try {
      await deleteDoc(doc(db, 'sessions', sid));
      setSessions(prev => prev.filter(s => s.id !== sid));
    } catch { /* silent */ }
    setRevokingSession(null);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Simple QR Code generator using canvas (no external library)
  useEffect(() => {
    if (!showQR || !qrCanvasRef.current || !loginLink) return;
    
    const canvas = qrCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a QR code API to generate the image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = 256;
      canvas.height = 256;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(loginLink)}&bgcolor=ffffff&color=000000&format=png`;
  }, [showQR, loginLink]);

  const downloadQR = () => {
    if (!qrCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = `snaplink-${userProfile?.username || 'profile'}-qr.png`;
    link.href = qrCanvasRef.current.toDataURL('image/png');
    link.click();
  };

  const hasPasswordProvider = auth.currentUser?.providerData.some(p => p.providerId === 'password') || false;

  const reauthenticateWithCurrentPassword = async () => {
    if (!auth.currentUser?.email || !currentPassword) {
      setPasswordMsg('Please enter your current password.');
      setPasswordMsgType('error');
      return;
    }
    setChangingPassword(true);
    setPasswordMsg('');
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      setReauthed(true);
      setPasswordMsg('Identity verified! Now enter your new password.');
      setPasswordMsgType('success');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordMsg('Wrong current password. Please try again.');
      } else if (code === 'auth/too-many-requests') {
        setPasswordMsg('Too many attempts. Please wait and try again.');
      } else {
        setPasswordMsg(`Verification failed: ${code || err?.message || 'Unknown error'}`);
      }
      setPasswordMsgType('error');
    } finally {
      setChangingPassword(false);
    }
  };

  const reauthenticateWithGoogle = async () => {
    if (!auth.currentUser) return;
    setChangingPassword(true);
    setPasswordMsg('');
    try {
      await reauthenticateWithPopup(auth.currentUser, googleProvider);
      setReauthed(true);
      setPasswordMsg('Identity verified with Google! Now enter your new password.');
      setPasswordMsgType('success');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setPasswordMsg('Google sign-in was cancelled.');
      } else {
        setPasswordMsg(`Google verification failed: ${code || err?.message || 'Unknown error'}`);
      }
      setPasswordMsgType('error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser) return;
    if (newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      setPasswordMsgType('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match.');
      setPasswordMsgType('error');
      return;
    }
    setChangingPassword(true);
    setPasswordMsg('');
    try {
      await updatePassword(auth.currentUser, newPassword);
      setPasswordMsg('Password changed successfully!');
      setPasswordMsgType('success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setReauthed(false);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/requires-recent-login') {
        setPasswordMsg('Session expired. Please verify your identity again.');
        setReauthed(false);
      } else if (code === 'auth/weak-password') {
        setPasswordMsg('Password is too weak. Please use a stronger password.');
      } else {
        setPasswordMsg(`Failed to change password: ${code || err?.message || 'Unknown error'}`);
      }
      setPasswordMsgType('error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setIsUpdating(true);
    setMessage('');

    try {
      // Check if username changed and is taken
      if (newUsername !== userProfile.username) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', newUsername));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          setMessage('Username is already taken.');
          setIsUpdating(false);
          return;
        }
      }

      const userRef = doc(db, 'users', userProfile.uid);
      const updates: Record<string, any> = {};
      
      if (newUsername !== userProfile.username) updates.username = newUsername;
      if (newDisplayName !== userProfile.displayName) updates.displayName = newDisplayName.trim();
      if (newBio !== (userProfile.bio || '')) updates.bio = newBio.trim();

      if (Object.keys(updates).length === 0) {
        setMessage('No changes to save.');
        setIsUpdating(false);
        return;
      }

      await updateDoc(userRef, updates);
      setMessage('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Failed to update profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSystemNotificationsToggle = async () => {
    if (!userProfile) return;

    setNotificationBusy(true);
    setNotificationMessage('');

    try {
      if (userProfile.notificationsEnabled) {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          notificationsEnabled: false,
          notificationPermission: notificationSupport.supported ? Notification.permission : 'denied',
        });
        setNotificationMessage('System alerts turned off for this device.');
        return;
      }

      if (!notificationSupport.supported) {
        setNotificationMessage(notificationSupport.message);
        return;
      }

      const permission = await requestSystemNotificationPermission();
      if (permission === 'granted') {
        await ensureNotificationWorker();
      }
      await updateDoc(doc(db, 'users', userProfile.uid), {
        notificationsEnabled: permission === 'granted',
        notificationPermission: permission,
      });

      if (permission === 'granted') {
        setNotificationMessage('System alerts are now enabled.');
      } else {
        setNotificationMessage('Notifications were blocked by this browser.');
      }
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      setNotificationMessage('Could not update notification settings.');
    } finally {
      setNotificationBusy(false);
    }
  };

  return (
    <div className="pb-20 md:pb-0 min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center space-x-3">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="p-4 space-y-8">
        {/* Profile Section */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center"><User className="mr-2 h-5 w-5" /> Profile</h2>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
            {/* Current Profile Preview */}
            {userProfile && (
              <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <Avatar src={userProfile.photoURL} alt={userProfile.displayName} className="h-14 w-14" />
                <div>
                  <p className="font-bold text-lg">{userProfile.displayName}</p>
                  <p className="text-gray-500 dark:text-gray-400">@{userProfile.username}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {/* Display Name */}
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center">
                  <Type className="h-4 w-4 mr-2" /> Display Name
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  placeholder="Your display name"
                  maxLength={30}
                />
              </div>

              {/* Username */}
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center">
                  <User className="h-4 w-4 mr-2" /> Username
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 dark:text-gray-400 mr-2 text-lg">@</span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    placeholder="username"
                    maxLength={20}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only lowercase letters, numbers, and underscores.</p>
              </div>

              {/* Bio */}
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center">
                  <FileText className="h-4 w-4 mr-2" /> Bio
                </label>
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white resize-none"
                  placeholder="Tell people about yourself..."
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{newBio.length}/160 characters</p>
              </div>
              
              <Button type="submit" disabled={isUpdating} className="w-full h-12 rounded-xl">
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
              
              {message && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm text-center font-medium ${message.includes('success') ? 'text-green-500' : 'text-red-500'}`}
                >
                  {message}
                </motion.p>
              )}
            </form>
          </div>
        </section>

        {/* Activity Status Section */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center"><Circle className="mr-2 h-5 w-5" /> Activity Status</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Set your status so friends know when you're available.</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'online', label: 'Online', color: 'bg-green-500', desc: 'Visible to everyone' },
                { value: 'idle', label: 'Idle', color: 'bg-yellow-500', desc: 'Show as away' },
                { value: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500', desc: 'Mute notifications' },
                { value: 'offline', label: 'Invisible', color: 'bg-gray-400', desc: 'Appear offline' },
              ] as const).map(st => (
                <motion.button
                  key={st.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    if (!userProfile) return;
                    try {
                      const nowIso = new Date().toISOString();
                      await updateDoc(doc(db, 'users', userProfile.uid), {
                        activityStatus: st.value,
                        statusSetAt: nowIso,
                        lastSeen: nowIso,
                      });
                    } catch (e) { console.error(e); }
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    (userProfile?.activityStatus || 'online') === st.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <div className={`w-3 h-3 rounded-full ${st.color}`} />
                    <span className="font-bold text-sm">{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{st.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section>
          <h2 className="mb-4 flex items-center text-lg font-bold"><Shield className="mr-2 h-5 w-5" /> Privacy</h2>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-medium">Private profile</p>
                <p className="max-w-xl text-sm text-gray-500 dark:text-gray-400">
                  People can still discover your public posts in the home feed, but your profile posts, replies, likes, and live history stay hidden unless they follow you.
                </p>
                <p className="mt-2 text-xs font-semibold text-gray-400 dark:text-gray-500">
                  Current visibility: {userProfile?.isPrivate ? 'Private' : 'Public'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!userProfile) return;
                  try {
                    await updateDoc(doc(db, 'users', userProfile.uid), {
                      isPrivate: !userProfile.isPrivate,
                    });
                  } catch (error) {
                    console.error('Failed to update privacy:', error);
                  }
                }}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  userProfile?.isPrivate ? 'bg-slate-950 dark:bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ${
                    userProfile?.isPrivate ? 'translate-x-7' : 'translate-x-1'
                  }`}
                >
                  {userProfile?.isPrivate ? <EyeOff className="h-3.5 w-3.5 text-blue-500" /> : <Eye className="h-3.5 w-3.5 text-gray-400" />}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center"><Bell className="mr-2 h-5 w-5" /> Notifications</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-lg">System Alerts</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Get desktop and mobile-browser alerts for new activity on this device.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Status: {userProfile?.notificationsEnabled ? 'Enabled' : 'Disabled'} · Browser permission:{' '}
                  {notificationSupport.supported ? (userProfile?.notificationPermission || Notification.permission) : 'unsupported'}
                </p>
                {!notificationSupport.supported && (
                  <p className="mt-2 max-w-md text-xs text-orange-600 dark:text-orange-300">
                    {notificationSupport.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSystemNotificationsToggle}
                disabled={notificationBusy}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  userProfile?.notificationsEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                } ${notificationBusy ? 'opacity-70 cursor-wait' : ''}`}
              >
                <span
                  className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ${
                    userProfile?.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                >
                  <Bell className={`h-3.5 w-3.5 ${userProfile?.notificationsEnabled ? 'text-blue-500' : 'text-gray-400'}`} />
                </span>
              </button>
            </div>

            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-900/40 p-4 text-sm text-gray-500 dark:text-gray-400">
              {notificationSupport.supported
                ? 'Notifications will appear through your browser or installed app on this device. If the browser is fully closed, full push delivery still depends on a server push service.'
                : notificationSupport.message}
            </div>

            {notificationMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  notificationMessage.includes('enabled') || notificationMessage.includes('off')
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                    : 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
                }`}
              >
                {notificationMessage}
              </motion.div>
            )}
          </div>
        </section>

        {/* Share Account / Login Link Section */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center"><Lock className="mr-2 h-5 w-5" /> Change Password</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
            {!reauthed ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">First, verify your identity to change your password.</p>
                
                {hasPasswordProvider && (
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <Button
                      onClick={reauthenticateWithCurrentPassword}
                      disabled={changingPassword || !currentPassword}
                      className="w-full h-11 rounded-xl"
                    >
                      {changingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                      Verify with Password
                    </Button>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                <Button
                  onClick={reauthenticateWithGoogle}
                  disabled={changingPassword}
                  variant="outline"
                  className="w-full h-11 rounded-xl"
                >
                  {changingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  )}
                  Verify with Google
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <Check className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Identity verified. Enter your new password below.</p>
                </div>

                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 characters)"
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                />

                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match.</p>
                )}

                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
                >
                  {changingPassword ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Changing...</>
                  ) : (
                    <><Lock className="h-4 w-4 mr-2" /> Change Password</>
                  )}
                </Button>
              </>
            )}

            {passwordMsg && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-start space-x-2 p-3 rounded-xl border ${
                passwordMsgType === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                {passwordMsgType === 'success' ? (
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <p className={`text-sm ${passwordMsgType === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {passwordMsg}
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* Share Account / Login Link Section */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center"><Key className="mr-2 h-5 w-5" /> Share Account Access</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Generate a login link that lets anyone instantly log into your account. Share via link or QR code.</p>
            
            {linkError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{linkError}</p>
              </motion.div>
            )}

            {!loginLink ? (
              <Button 
                onClick={generateLoginLink} 
                disabled={generatingLink} 
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
              >
                {generatingLink ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Key className="h-4 w-4 mr-2" /> Generate Login Link</>
                )}
              </Button>
            ) : (
              <>
                {/* Login Link */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center"><Link2 className="h-4 w-4 mr-1" /> Login Link</label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={loginLink}
                      className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-600 dark:text-gray-400 focus:outline-none"
                    />
                    <Button onClick={copyLoginLink} variant="outline" className="rounded-xl px-4 h-12 min-w-[100px]">
                      {linkCopied ? <><Check className="h-4 w-4 mr-1 text-green-500" /> Copied!</> : <><Copy className="h-4 w-4 mr-1" /> Copy</>}
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  {navigator.share && (
                    <Button onClick={shareLoginLink} className="flex-1 h-12 rounded-xl bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <Share2 className="h-4 w-4 mr-2" /> Share
                    </Button>
                  )}
                  <Button onClick={() => setShowQR(!showQR)} variant="outline" className="flex-1 h-12 rounded-xl">
                    <QrCode className="h-4 w-4 mr-2" /> {showQR ? 'Hide QR Code' : 'Show QR Code'}
                  </Button>
                </div>

                {/* QR Code */}
                <AnimatePresence>
                  {showQR && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col items-center py-4 space-y-4">
                        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200">
                          <canvas ref={qrCanvasRef} width={256} height={256} className="rounded-lg" />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Scan to log into your account</p>
                        <Button onClick={downloadQR} variant="outline" size="sm" className="rounded-full px-4">
                          <Download className="h-4 w-4 mr-1" /> Download QR Code
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Regenerate */}
                <Button 
                  onClick={generateLoginLink} 
                  disabled={generatingLink} 
                  variant="outline" 
                  className="w-full h-10 rounded-xl text-sm"
                >
                  {generatingLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                  Generate New Link (revokes old one)
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Active Sessions / Devices Logged In */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center"><Monitor className="mr-2 h-5 w-5" /> Devices Logged In</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">All devices currently logged into your account. You can log out any device.</p>
            
            {loadingSessions ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No active sessions found.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => {
                  const isCurrent = s.id === sessionId;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isCurrent 
                          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`p-2 rounded-lg ${isCurrent ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-800'}`}>
                          {s.os === 'Android' || s.os === 'iOS' ? (
                            <Smartphone className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          ) : (
                            <Monitor className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {s.browser} on {s.os}
                            {isCurrent && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-bold">(This device)</span>}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Active {formatTimeAgo(s.lastActive)} · Logged in {formatTimeAgo(s.createdAt)}
                          </p>
                        </div>
                      </div>
                      {!isCurrent && (
                        <button
                          onClick={() => revokeSession(s.id)}
                          disabled={revokingSession === s.id}
                          className="flex-shrink-0 ml-3 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Log out this device"
                        >
                          {revokingSession === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Appearance Section */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center">
            <Palette className="mr-2 h-5 w-5" /> Appearance
          </h2>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-lg">Dark Mode</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  theme === 'dark' ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ${
                    theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                  }`}
                >
                  {theme === 'dark' ? (
                    <Moon className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 text-yellow-500" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Account Management */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center"><Shield className="mr-2 h-5 w-5" /> Account</h2>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {userProfile && (
              <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <Avatar src={userProfile.photoURL} alt={userProfile.displayName} />
                  <div>
                    <p className="font-bold">{userProfile.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{userProfile.username}</p>
                  </div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full font-bold">Active</span>
              </div>
            )}

            <div className="border-b border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Quick switcher</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Save up to 5 accounts into your SnapLink switcher hub and use them on any device after one linked sign-in.</p>
                </div>
                <span className="text-xs rounded-full bg-gray-200 dark:bg-gray-700 px-2.5 py-1 font-bold text-gray-600 dark:text-gray-300">
                  {linkedAccounts.length}/5
                </span>
              </div>

                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300">
                  {isSwitcherHubOwner
                    ? 'This account is the main switcher hub. Any saved account here can show up on your other devices too.'
                    : 'This account can save a local quick-switch entry here, but only your main account can sync the shared switcher across devices.'}
                </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveCurrentAccountForQuickSwitch}
                  disabled={generatingLink || linkedAccounts.length >= 5 && !linkedAccounts.some((account) => account.uid === userProfile?.uid)}
                  className="rounded-full"
                >
                  {generatingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Save this account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await logout();
                    window.location.assign('/login');
                  }}
                  className="rounded-full"
                >
                  <User className="mr-2 h-4 w-4" />
                  Use another account
                </Button>
              </div>

              {linkedAccounts.length > 0 ? (
                <div className="space-y-2">
                  {linkedAccounts.map((account) => {
                    const isCurrent = account.uid === userProfile?.uid;
                    return (
                      <div key={account.uid} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-900">
                        <Avatar src={account.photoURL} alt={account.displayName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{account.displayName}</div>
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400">@{account.username}</div>
                        </div>
                        {isCurrent ? (
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                            Active
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => switchToLinkedAccount(account)}
                            disabled={switchingAccountId === account.uid}
                            className="rounded-full"
                          >
                            {switchingAccountId === account.uid ? 'Switching...' : 'Switch'}
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeQuickSwitchAccount(account.uid)}
                          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          title="Remove saved account"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Save this account first, then add the others once so your switcher hub can follow you across devices.
                </div>
              )}
            </div>

            <button 
              onClick={logout}
              className="w-full p-4 flex items-center text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors border-t border-gray-200 dark:border-gray-700"
            >
              <LogOut className="h-5 w-5 mr-3" />
              <span className="font-medium">Log out @{userProfile?.username}</span>
            </button>
          </div>
        </section>

        <div className="text-center py-6">
          <p className="text-xs text-gray-400 dark:text-gray-600">Made by <span className="font-semibold">Ripo Team</span></p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">SnapLink 2.0</p>
        </div>
      </div>
    </div>
  );
}
