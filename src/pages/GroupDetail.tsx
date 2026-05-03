import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, where, setDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Users, Send, Settings, Crown, Shield, UserMinus, Trash2, X, MessageCircle, Info, Megaphone, FileText, Heart, Repeat2, Share, Flag, Check, UserPlus, Globe, Lock, Sparkles, Palette, Camera, SmilePlus, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VerificationBadge, UserBadges } from '../components/ui/VerificationBadge';
import { formatDistanceToNow } from 'date-fns';
import { updateChallengeProgress } from '../lib/challenges';
import { ReportModal } from '../components/ui/ReportModal';
import { createNotification } from '../lib/notifications';
import { LevelBadge } from '../components/ui/LevelBadge';
import { DEFAULT_GROUP_BADGE, GROUP_THEME_OPTIONS, getGroupTheme } from '../lib/groupThemes';
import { sanitizeStorageFileName, tryDeleteStoragePath, uploadOptimizedImage } from '../lib/storageUploads';
import { FormattedText } from '../components/ui/FormattedText';
import { createMentionNotifications } from '../lib/mentionNotifications';
import { adjustReactionCounts, getTopReactionEntries, normalizePostReaction, POST_REACTIONS, type PostReaction } from '../lib/reactions';
import { getReadOnlyReason, isReadOnlyUser } from '../lib/accessControl';

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { userProfile } = useAuth();
  const readOnlyReason = getReadOnlyReason(userProfile);
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoOpenedManageRef = useRef(false);
  const [group, setGroup] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'members' | 'about'>('posts');
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [currentJoinRequest, setCurrentJoinRequest] = useState<any | null>(null);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsCategory, setSettingsCategory] = useState('General');
  const [settingsPrivacy, setSettingsPrivacy] = useState<'public' | 'private'>('public');
  const [settingsModsCanAnnounce, setSettingsModsCanAnnounce] = useState(true);
  const [settingsModsCanManageRequests, setSettingsModsCanManageRequests] = useState(false);
  const [settingsAllowMemberPosts, setSettingsAllowMemberPosts] = useState(true);
  const [settingsAllowMemberChat, setSettingsAllowMemberChat] = useState(true);
  const [settingsBadgeEmoji, setSettingsBadgeEmoji] = useState(DEFAULT_GROUP_BADGE);
  const [settingsThemeId, setSettingsThemeId] = useState(GROUP_THEME_OPTIONS[0].id);
  const [settingsWelcomeMessage, setSettingsWelcomeMessage] = useState('');
  const [settingsRulesText, setSettingsRulesText] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState('');
  const [settingsPhoto, setSettingsPhoto] = useState<File | 'remove' | null>(null);
  const [settingsPhotoPreview, setSettingsPhotoPreview] = useState<string | null>(null);
  const [settingsBanner, setSettingsBanner] = useState<File | 'remove' | null>(null);
  const [settingsBannerPreview, setSettingsBannerPreview] = useState<string | null>(null);
  const settingsPhotoInputRef = useRef<HTMLInputElement>(null);
  const settingsBannerInputRef = useRef<HTMLInputElement>(null);

  // Posts & Announcements
  const [groupPosts, setGroupPosts] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isAnnouncementPost, setIsAnnouncementPost] = useState(false);
  const [isPostingContent, setIsPostingContent] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (snap.exists()) {
        setGroup({ id: snap.id, ...snap.data() });
      } else {
        navigate('/groups');
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, OperationType.GET, `groups/${groupId}`); } catch(e) {}
    });

    const q = query(collection(db, `groups/${groupId}/messages`), orderBy('createdAt', 'asc'));
    const unsubMessages = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      try { handleFirestoreError(error, OperationType.LIST, `groups/${groupId}/messages`); } catch(e) {}
    });

    // Fetch group posts
    const postsQ = query(collection(db, `groups/${groupId}/posts`), orderBy('createdAt', 'desc'));
    const unsubPosts = onSnapshot(postsQ, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroupPosts(allPosts.filter((p: any) => !p.isAnnouncement));
      setAnnouncements(allPosts.filter((p: any) => p.isAnnouncement));
    }, (error) => {
      console.error('Error fetching group posts:', error);
    });

    const joinRequestsRef = collection(db, `groups/${groupId}/joinRequests`);
    const unsubJoinRequests = onSnapshot(joinRequestsRef, (snapshot) => {
      const allRequests = snapshot.docs.map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() }));
      setJoinRequests(allRequests.sort((left: any, right: any) => (left.createdAt || '').localeCompare(right.createdAt || '')));
      setCurrentJoinRequest(allRequests.find((request: any) => request.uid === userProfile?.uid) || null);
    });

    return () => { unsubGroup(); unsubMessages(); unsubPosts(); unsubJoinRequests(); };
  }, [groupId, navigate, userProfile?.uid]);

  useEffect(() => {
    if (!group?.members || group.members.length === 0) return;

    const fetchMembers = async () => {
      const profiles: UserProfile[] = [];
      for (const uid of group.members.slice(0, 50)) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) profiles.push(snap.data() as UserProfile);
        } catch (e) {}
      }
      setMemberProfiles(profiles);
    };
    fetchMembers();
  }, [group?.members?.join(',')]);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (!group) return;
    setSettingsName(group.name || '');
    setSettingsDescription(group.description || '');
    setSettingsCategory(group.category || 'General');
    setSettingsPrivacy(group.privacy || 'public');
    setSettingsModsCanAnnounce(group.modsCanAnnounce !== false);
    setSettingsModsCanManageRequests(group.modsCanManageRequests === true);
    setSettingsAllowMemberPosts(group.allowMemberPosts !== false);
    setSettingsAllowMemberChat(group.allowMemberChat !== false);
    setSettingsBadgeEmoji(group.badgeEmoji || DEFAULT_GROUP_BADGE);
    setSettingsThemeId(group.themeId || GROUP_THEME_OPTIONS[0].id);
    setSettingsWelcomeMessage(group.welcomeMessage || '');
    setSettingsRulesText((group.rules || []).join('\n'));
    setSettingsSaveError('');
    setSettingsPhoto(null);
    setSettingsBanner(null);
    setSettingsPhotoPreview(group.photoURL || null);
    setSettingsBannerPreview(group.bannerURL || null);
  }, [group]);

  const handleSettingsPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSettingsSaveError('');
    setSettingsPhoto(file);
    setSettingsPhotoPreview(URL.createObjectURL(file));
  };

  const handleSettingsBannerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSettingsSaveError('');
    setSettingsBanner(file);
    setSettingsBannerPreview(URL.createObjectURL(file));
  };

  const handleJoinLeave = async () => {
    if (!userProfile || !group || isJoining) return;
    
    const isMember = group.members?.includes(userProfile.uid);
    const groupRef = doc(db, 'groups', group.id);
    
    setIsJoining(true);
    try {
      if (isMember) {
        await updateDoc(groupRef, {
          members: arrayRemove(userProfile.uid),
          moderators: arrayRemove(userProfile.uid),
          admins: arrayRemove(userProfile.uid),
          membersCount: increment(-1)
        });
      } else if (group.privacy === 'private') {
        const joinRequestRef = doc(db, `groups/${group.id}/joinRequests`, userProfile.uid);
        if (currentJoinRequest) {
          await deleteDoc(joinRequestRef);
        } else {
          await setDoc(joinRequestRef, {
            id: userProfile.uid,
            uid: userProfile.uid,
            displayName: userProfile.displayName,
            username: userProfile.username,
            photoURL: userProfile.photoURL || null,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        await updateDoc(groupRef, {
          members: arrayUnion(userProfile.uid),
          membersCount: increment(1)
        });
        await updateChallengeProgress(userProfile.uid, 'group_join');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!group || !settingsName.trim() || isSavingSettings) return;

    setIsSavingSettings(true);
    setSettingsSaveError('');
    try {
      let nextPhotoURL = group.photoURL || null;
      let nextPhotoStoragePath = group.photoStoragePath || null;
      let nextBannerURL = group.bannerURL || null;
      let nextBannerStoragePath = group.bannerStoragePath || null;

      if (settingsPhoto === 'remove') {
        await tryDeleteStoragePath(group.photoStoragePath);
        nextPhotoURL = null;
        nextPhotoStoragePath = null;
      } else if (settingsPhoto instanceof File) {
        const uploadedPhoto = await uploadOptimizedImage(
          settingsPhoto,
          `groups/${group.id}/photo/${Date.now()}-${sanitizeStorageFileName(settingsPhoto.name || 'group-photo.jpg')}`,
          {
            maxWidth: 700,
            maxHeight: 700,
            quality: 0.86,
            allowDataUrlFallback: true,
            preferDataUrl: true,
          }
        );
        if (group.photoStoragePath && group.photoStoragePath !== uploadedPhoto.storagePath) {
          await tryDeleteStoragePath(group.photoStoragePath);
        }
        nextPhotoURL = uploadedPhoto.url;
        nextPhotoStoragePath = uploadedPhoto.storagePath;
      }

      if (settingsBanner === 'remove') {
        await tryDeleteStoragePath(group.bannerStoragePath);
        nextBannerURL = null;
        nextBannerStoragePath = null;
      } else if (settingsBanner instanceof File) {
        const uploadedBanner = await uploadOptimizedImage(
          settingsBanner,
          `groups/${group.id}/banner/${Date.now()}-${sanitizeStorageFileName(settingsBanner.name || 'group-banner.jpg')}`,
          {
            maxWidth: 1800,
            maxHeight: 900,
            quality: 0.88,
            allowDataUrlFallback: true,
            preferDataUrl: true,
          }
        );
        if (group.bannerStoragePath && group.bannerStoragePath !== uploadedBanner.storagePath) {
          await tryDeleteStoragePath(group.bannerStoragePath);
        }
        nextBannerURL = uploadedBanner.url;
        nextBannerStoragePath = uploadedBanner.storagePath;
      }

      const rules = settingsRulesText
        .split('\n')
        .map((rule) => rule.trim())
        .filter(Boolean)
        .slice(0, 8);

      await updateDoc(doc(db, 'groups', group.id), {
        name: settingsName.trim(),
        description: settingsDescription.trim(),
        category: settingsCategory.trim() || 'General',
        privacy: settingsPrivacy,
        modsCanAnnounce: settingsModsCanAnnounce,
        modsCanManageRequests: settingsModsCanManageRequests,
        allowMemberPosts: settingsAllowMemberPosts,
        allowMemberChat: settingsAllowMemberChat,
        badgeEmoji: Array.from(settingsBadgeEmoji.trim()).slice(0, 2).join('') || DEFAULT_GROUP_BADGE,
        themeId: settingsThemeId,
        welcomeMessage: settingsWelcomeMessage.trim(),
        rules,
        photoURL: nextPhotoURL,
        photoStoragePath: nextPhotoStoragePath,
        bannerURL: nextBannerURL,
        bannerStoragePath: nextBannerStoragePath,
      });
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save group settings:', error);
      setSettingsSaveError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not save the group settings. Please try again.'
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile || !group || !canSendMessages) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    try {
      await addDoc(collection(db, `groups/${group.id}/messages`), {
        text: newMessage,
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        senderPhotoURL: userProfile.photoURL || null,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${group.id}/messages`);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !userProfile || !group || isPostingContent || !canCreatePosts) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    // Only owner/admins can post announcements
    const canAnnounce = group.creatorId === userProfile.uid || group.admins?.includes(userProfile.uid);
    if (isAnnouncementPost && !canAnnounce) return;

    setIsPostingContent(true);
    try {
      const postRef = doc(collection(db, `groups/${group.id}/posts`));
      await setDoc(postRef, {
        id: postRef.id,
        content: newPostContent.trim(),
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorUsername: userProfile.username,
        authorPhotoURL: userProfile.photoURL || null,
        authorIsVerified: userProfile.isVerified || false,
        authorBadges: userProfile.badges || [],
        authorHiddenBadges: userProfile.hiddenBadges || [],
        authorLevel: userProfile.level || 1,
        isAnnouncement: isAnnouncementPost && canAnnounce,
        likesCount: 0,
        reactionCounts: {},
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      await createMentionNotifications({
        text: newPostContent.trim(),
        sourceUserId: userProfile.uid,
        sourceUser: {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || null,
        },
        linkTo: `/groups/${group.id}`,
        message: newPostContent.trim().slice(0, 160),
      });
      setNewPostContent('');
      setIsAnnouncementPost(false);
    } catch (error) {
      console.error('Error creating group post:', error);
    } finally {
      setIsPostingContent(false);
    }
  };

  const handlePromoteToAdmin = async (uid: string) => {
    if (!group) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        admins: arrayUnion(uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const handleDemoteAdmin = async (uid: string) => {
    if (!group || uid === group.creatorId) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        admins: arrayRemove(uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const handlePromoteToModerator = async (uid: string) => {
    if (!group) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        moderators: arrayUnion(uid),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const handleDemoteModerator = async (uid: string) => {
    if (!group || uid === group.creatorId) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        moderators: arrayRemove(uid),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const handleKickMember = async (uid: string) => {
    if (!group || uid === group.creatorId) return;
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: arrayRemove(uid),
        moderators: arrayRemove(uid),
        admins: arrayRemove(uid),
        membersCount: increment(-1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    if (!window.confirm('Are you sure you want to delete this group? This cannot be undone.')) return;
    try {
      const joinRequestsSnapshot = await getDocs(collection(db, `groups/${group.id}/joinRequests`));
      for (const joinRequestDoc of joinRequestsSnapshot.docs) {
        await deleteDoc(joinRequestDoc.ref);
      }
      await deleteDoc(doc(db, 'groups', group.id));
      navigate('/groups');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${group.id}`);
    }
  };

  const canManageJoinRequests = !!group && (
    group.creatorId === userProfile?.uid ||
    group.admins?.includes(userProfile?.uid) ||
    (group.moderators?.includes(userProfile?.uid) && group.modsCanManageRequests === true)
  );

  useEffect(() => {
    const wantsManageView = new URLSearchParams(location.search).get('manage') === '1';
    if (!wantsManageView || !canManageJoinRequests || autoOpenedManageRef.current) return;
    autoOpenedManageRef.current = true;
    setShowSettings(true);
  }, [location.search, canManageJoinRequests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen dark:bg-gray-900">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-4" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }
  if (!group) return null;

  const isMember = group.members?.includes(userProfile?.uid);
  const isAdmin = group.admins?.includes(userProfile?.uid) || group.creatorId === userProfile?.uid;
  const isModerator = group.moderators?.includes(userProfile?.uid);
  const isCreator = group.creatorId === userProfile?.uid;
  const theme = getGroupTheme(group.themeId, group.id);
  const canAnnounce = isCreator || isAdmin || (isModerator && group.modsCanAnnounce !== false);
  const canCreatePosts = isCreator || isAdmin || isModerator || group.allowMemberPosts !== false;
  const canSendMessages = isCreator || isAdmin || isModerator || group.allowMemberChat !== false;
  const pendingRequestCount = joinRequests.length;
  const previewGroupPhoto = settingsPhoto === 'remove' ? null : settingsPhotoPreview || group.photoURL || null;
  const previewGroupBanner = settingsBanner === 'remove' ? null : settingsBannerPreview || group.bannerURL || null;

  const handleApproveJoinRequest = async (request: any) => {
    if (!group || !canManageJoinRequests) return;

    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: arrayUnion(request.uid),
        membersCount: increment(1),
      });
      await deleteDoc(doc(db, `groups/${group.id}/joinRequests`, request.uid));
      await updateChallengeProgress(request.uid, 'group_join');
      await createNotification({
        type: 'group_request_approved',
        sourceUserId: userProfile?.uid || group.creatorId,
        targetUserId: request.uid,
        message: `${group.name} approved your join request.`,
        linkTo: `/group/${group.id}`,
        sourceUser: {
          displayName: userProfile?.displayName || group.name,
          photoURL: userProfile?.photoURL || null,
        },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const handleDeclineJoinRequest = async (request: any) => {
    if (!group || !canManageJoinRequests) return;

    try {
      await deleteDoc(doc(db, `groups/${group.id}/joinRequests`, request.uid));
      await createNotification({
        type: 'group_request_declined',
        sourceUserId: userProfile?.uid || group.creatorId,
        targetUserId: request.uid,
        message: `${group.name} could not accept your join request this time.`,
        linkTo: `/group/${group.id}`,
        sourceUser: {
          displayName: userProfile?.displayName || group.name,
          photoURL: userProfile?.photoURL || null,
        },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${group.id}/joinRequests/${request.uid}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 pb-14 md:pb-0">
      {/* Banner Header */}
      <div className="relative shrink-0">
        <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${theme.classes}`}>
          {group.bannerURL && (
            <img
              src={group.bannerURL}
              alt={`${group.name} banner`}
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/groups')} className="p-2 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-2">
            {!isCreator && (
              <button onClick={() => setIsReportModalOpen(true)} className="p-2 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white backdrop-blur-sm">
                <Flag className="h-5 w-5" />
              </button>
            )}
            {canManageJoinRequests && (
              <button onClick={() => setShowSettings(true)} className="p-2 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white backdrop-blur-sm">
                <Settings className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end justify-between">
          <div className="flex items-end gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-white/35 bg-white/18 text-xl text-white shadow-xl backdrop-blur-sm">
              {group.photoURL ? (
                <img
                  src={group.photoURL}
                  alt={group.name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{group.badgeEmoji || DEFAULT_GROUP_BADGE}</span>
              )}
            </div>
            <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white drop-shadow-md">
              <span>{group.name}</span>
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-white/80 text-xs flex items-center bg-black/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                <Users className="h-3 w-3 mr-1" />
                {group.membersCount || 0} members
              </span>
              {isAdmin && (
                <span className="bg-amber-400/30 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase backdrop-blur-sm border border-amber-400/30">Admin</span>
              )}
              {showSettings && pendingRequestCount > 0 && (
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase backdrop-blur-sm border border-white/20">
                  {pendingRequestCount} requests
                </span>
              )}
            </div>
            </div>
          </div>
          <Button 
            variant={isMember ? "outline" : "default"} 
            size="sm" 
            onClick={handleJoinLeave}
            disabled={isJoining}
            className={`rounded-full shadow-md ${isMember ? 'bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur-sm' : 'bg-white text-gray-900 hover:bg-gray-100'}`}
          >
            {isJoining ? 'Working...' : isMember ? 'Leave' : group.privacy === 'private' ? currentJoinRequest ? 'Cancel Request' : 'Request to Join' : 'Join'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
        {(['posts', 'chat', 'members', 'about'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
              activeTab === tab
                ? 'text-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-1.5">
              {tab === 'posts' && <FileText className="h-4 w-4" />}
              {tab === 'chat' && <MessageCircle className="h-4 w-4" />}
              {tab === 'members' && <Users className="h-4 w-4" />}
              {tab === 'about' && <Info className="h-4 w-4" />}
              <span className="capitalize">{tab}</span>
            </div>
            {activeTab === tab && (
              <motion.div
                layoutId="groupTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {!isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className={`relative h-20 w-20 overflow-hidden rounded-2xl bg-gradient-to-br ${theme.classes} flex items-center justify-center mb-4 text-3xl shadow-lg`}>
            {group.photoURL ? (
              <img src={group.photoURL} alt={group.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span>{group.badgeEmoji || DEFAULT_GROUP_BADGE}</span>
            )}
          </div>
          <h2 className="text-xl font-bold dark:text-white mb-2">Join {group.name}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-3 max-w-sm">{group.description || 'Join this group to access posts, chat, and connect with other members.'}</p>
          {group.welcomeMessage && (
            <p className="mb-6 max-w-sm rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
              {group.welcomeMessage}
            </p>
          )}
          <Button onClick={handleJoinLeave} disabled={isJoining} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 disabled:opacity-60">
            {isJoining ? 'Working...' : group.privacy === 'private' ? currentJoinRequest ? 'Cancel Request' : 'Request to Join' : 'Join Group'}
          </Button>
          {group.privacy === 'private' && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Private groups now use request approval instead of silent dead ends.</p>
          )}
        </div>
      ) : (
        <>
          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="flex-1 overflow-y-auto">
              {/* Announcements */}
              {announcements.length > 0 && (
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center uppercase tracking-wider">
                    <Megaphone className="h-4 w-4 mr-2" /> Announcements
                  </h3>
                  {announcements.map((ann: any) => (
                    <motion.div
                      key={ann.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <Avatar src={ann.authorPhotoURL} alt={ann.authorName} size="sm" className="h-7 w-7" />
                        <span className="font-bold text-sm dark:text-white">{ann.authorName}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {ann.createdAt?.toDate ? formatDistanceToNow(ann.createdAt.toDate(), { addSuffix: true }) : ''}
                        </span>
                        <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          📢 Announcement
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white text-sm leading-relaxed">{ann.content}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Create Post Box */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex space-x-3">
                  <Avatar src={userProfile?.photoURL} alt={userProfile?.displayName} size="sm" />
                  <div className="flex-1 space-y-2">
                    {!canCreatePosts && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                        Only moderators, admins, and the owner can post right now.
                      </div>
                    )}
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder={canCreatePosts ? 'Write something to the group...' : 'Posting is locked for regular members right now.'}
                      rows={2}
                      disabled={!canCreatePosts}
                      className="w-full resize-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:text-white dark:placeholder-gray-500"
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        {canAnnounce && (
                          <button
                            onClick={() => setIsAnnouncementPost(!isAnnouncementPost)}
                            className={`flex items-center text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                              isAnnouncementPost 
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700' 
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            <Megaphone className="h-3 w-3 mr-1" />
                            Announcement
                          </button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={handleCreatePost}
                        disabled={!newPostContent.trim() || isPostingContent || !canCreatePosts}
                        className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4"
                      >
                        {isPostingContent ? 'Posting...' : 'Post'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group Posts Feed */}
              {groupPosts.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No posts yet. Be the first to post!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {groupPosts.map((post: any) => (
                    <GroupPostItem
                      key={post.id}
                      post={post}
                      group={group}
                      groupId={groupId!}
                      canManagePosts={Boolean(isCreator || isAdmin || isModerator)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!canSendMessages && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                    Group chat is read-only for regular members right now.
                  </div>
                )}
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 dark:text-gray-600 py-12">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMine = msg.senderId === userProfile?.uid;
                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex max-w-[80%] ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
                        {!isMine && (
                          <Link to={`/profile/${msg.senderId}`} className="shrink-0">
                            <Avatar src={msg.senderPhotoURL} alt={msg.senderName} size="sm" className="h-7 w-7" />
                          </Link>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 ${
                          isMine 
                            ? 'bg-blue-500 text-white rounded-br-md' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
                        }`}>
                          {!isMine && <p className="text-xs font-semibold mb-1 opacity-70">{msg.senderName}</p>}
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={canSendMessages ? 'Type a message...' : 'Chat is locked for regular members right now.'}
                    disabled={!canSendMessages}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border-none rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:text-white dark:placeholder-gray-500"
                  />
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit" 
                    disabled={!newMessage.trim() || !canSendMessages}
                    className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </motion.button>
                </form>
              </div>
            </>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {memberProfiles.map(member => {
                  const memberIsCreator = member.uid === group.creatorId;
                  const memberIsAdmin = group.admins?.includes(member.uid);
                  const memberIsModerator = group.moderators?.includes(member.uid);
                  return (
                    <div key={member.uid} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <Link to={`/profile/${member.uid}`} className="flex items-center space-x-3 flex-1 min-w-0">
                        <Avatar src={member.photoURL} alt={member.displayName} />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-sm truncate dark:text-white">{member.displayName}</span>
                            {member.isVerified && <VerificationBadge className="w-4 h-4" title="Verified" />}
                            <UserBadges badges={member.badges} hiddenBadges={member.hiddenBadges} badgeSize="w-4 h-4" />
                            <LevelBadge level={member.level || 1} compact />
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">@{member.username}</span>
                            {memberIsCreator && (
                              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center">
                                <Crown className="h-2.5 w-2.5 mr-0.5" /> Owner
                              </span>
                            )}
                            {memberIsAdmin && !memberIsCreator && (
                              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center">
                                <Shield className="h-2.5 w-2.5 mr-0.5" /> Admin
                              </span>
                            )}
                            {memberIsModerator && !memberIsAdmin && !memberIsCreator && (
                              <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Mod
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                      
                      {isAdmin && member.uid !== userProfile?.uid && !memberIsCreator && (
                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          {isCreator && !memberIsAdmin && (
                            <button
                              onClick={() => handlePromoteToAdmin(member.uid)}
                              title="Promote to Admin"
                              className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <Shield className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && !memberIsCreator && !memberIsAdmin && !memberIsModerator && (
                            <button
                              onClick={() => handlePromoteToModerator(member.uid)}
                              title="Promote to Moderator"
                              className="p-1.5 rounded-full hover:bg-violet-50 dark:hover:bg-violet-900/20 text-gray-400 hover:text-violet-500 transition-colors"
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && memberIsModerator && !memberIsAdmin && (
                            <button
                              onClick={() => handleDemoteModerator(member.uid)}
                              title="Remove Moderator"
                              className="p-1.5 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-400 hover:text-orange-500 transition-colors"
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                          )}
                          {isCreator && memberIsAdmin && (
                            <button
                              onClick={() => handleDemoteAdmin(member.uid)}
                              title="Remove Admin"
                              className="p-1.5 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-400 hover:text-orange-500 transition-colors"
                            >
                              <Shield className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleKickMember(member.uid)}
                            title="Remove Member"
                            className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-gray-900 dark:text-white text-sm leading-relaxed">{group.description || 'No description provided.'}</p>
              </div>

              {group.welcomeMessage && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/40 dark:bg-blue-900/20">
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Welcome Message</h3>
                  <p className="text-sm leading-relaxed text-blue-700 dark:text-blue-100">{group.welcomeMessage}</p>
                </div>
              )}
              
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 space-y-3">
                <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Details</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Members</span>
                  <span className="font-medium dark:text-white">{group.membersCount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Created</span>
                  <span className="font-medium dark:text-white">{group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Privacy</span>
                  <span className="font-medium capitalize dark:text-white flex items-center gap-2">
                    {group.privacy === 'private' ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                    {group.privacy || 'Public'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Theme</span>
                  <span className="font-medium dark:text-white flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5" />
                    {theme.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Member posts</span>
                  <span className="font-medium dark:text-white">{group.allowMemberPosts !== false ? 'Enabled' : 'Staff only'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Member chat</span>
                  <span className="font-medium dark:text-white">{group.allowMemberChat !== false ? 'Enabled' : 'Staff only'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Join approvals</span>
                  <span className="font-medium dark:text-white">{group.modsCanManageRequests === true ? 'Owner, admins, and selected mods' : 'Owner and admins only'}</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Group Rules</h3>
                {(group.rules || []).length > 0 ? (
                  <div className="space-y-2">
                    {(group.rules || []).map((rule: string, index: number) => (
                      <div key={`${rule}-${index}`} className="flex items-start gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm text-gray-700 shadow-sm dark:bg-gray-900/60 dark:text-gray-200">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] font-black text-white">{index + 1}</span>
                        <span>{rule}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No custom rules have been added yet.</p>
                )}
              </div>

              {isCreator && (
                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-5 border border-red-200 dark:border-red-800/30">
                  <h3 className="font-bold text-sm text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Danger Zone</h3>
                  <p className="text-red-600/70 dark:text-red-400/70 text-xs mb-3">This action cannot be undone. All messages and data will be lost.</p>
                  <Button
                    onClick={handleDeleteGroup}
                    className="bg-red-500 hover:bg-red-600 text-white w-full rounded-xl"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Group
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showSettings && canManageJoinRequests && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">{isAdmin ? 'Owner Tools' : 'Moderator Tools'}</p>
                  <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">{isAdmin ? 'Group settings' : 'Join requests'}</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-y-auto p-5 space-y-5">
                  {isAdmin ? (
                    <>
                      <div className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br ${getGroupTheme(settingsThemeId, group.id).classes} p-5 text-white shadow-lg`}>
                        {previewGroupBanner && (
                          <img
                            src={previewGroupBanner}
                            alt={`${settingsName || group.name} banner preview`}
                            className="absolute inset-0 h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent" />
                        <div className="relative flex items-end gap-4">
                          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] border border-white/35 bg-white/20 text-3xl backdrop-blur-sm">
                            {previewGroupPhoto ? (
                              <img
                                src={previewGroupPhoto}
                                alt={`${settingsName || group.name} photo preview`}
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              Array.from(settingsBadgeEmoji.trim()).slice(0, 2).join('') || DEFAULT_GROUP_BADGE
                            )}
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-white/75">Preview</p>
                            <h3 className="text-2xl font-black">{settingsName || group.name}</h3>
                            <p className="mt-1 max-w-sm text-sm text-white/80">{settingsDescription || 'Give your group a clean identity, clear rules, and member permissions.'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Group banner</label>
                              {previewGroupBanner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsBanner('remove');
                                    setSettingsBannerPreview(null);
                                    if (settingsBannerInputRef.current) settingsBannerInputRef.current.value = '';
                                  }}
                                  className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => settingsBannerInputRef.current?.click()}
                              className={`relative h-28 w-full overflow-hidden rounded-[24px] border border-gray-200 bg-gradient-to-br ${getGroupTheme(settingsThemeId, group.id).classes} text-left shadow-sm transition hover:scale-[1.01] dark:border-gray-700`}
                            >
                              {previewGroupBanner && (
                                <img
                                  src={previewGroupBanner}
                                  alt="Group banner"
                                  className="absolute inset-0 h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/30" />
                              <div className="relative flex h-full items-center justify-center gap-2 text-sm font-bold text-white">
                                <Camera className="h-4 w-4" />
                                {previewGroupBanner ? 'Change banner' : 'Upload banner'}
                              </div>
                            </button>
                            <input
                              ref={settingsBannerInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleSettingsBannerChange}
                            />
                          </div>

                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Group picture</label>
                              {previewGroupPhoto && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsPhoto('remove');
                                    setSettingsPhotoPreview(null);
                                    if (settingsPhotoInputRef.current) settingsPhotoInputRef.current.value = '';
                                  }}
                                  className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-4 rounded-[24px] border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                              <button
                                type="button"
                                onClick={() => settingsPhotoInputRef.current?.click()}
                                className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-white/70 bg-gradient-to-br ${getGroupTheme(settingsThemeId, group.id).classes} text-xl text-white shadow-sm transition hover:scale-[1.02]`}
                              >
                                {previewGroupPhoto ? (
                                  <img
                                    src={previewGroupPhoto}
                                    alt="Group picture"
                                    className="h-full w-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <span>{Array.from(settingsBadgeEmoji.trim()).slice(0, 2).join('') || DEFAULT_GROUP_BADGE}</span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/35 py-1 text-white">
                                  <Camera className="h-3.5 w-3.5" />
                                </div>
                              </button>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Show a real group identity</p>
                                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                  Upload a square group picture so your community looks right in the group card, header, and join views.
                                </p>
                              </div>
                            </div>
                            <input
                              ref={settingsPhotoInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleSettingsPhotoChange}
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Group name</label>
                          <input
                            type="text"
                            value={settingsName}
                            onChange={(event) => setSettingsName(event.target.value)}
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            maxLength={40}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Badge</label>
                          <input
                            type="text"
                            value={settingsBadgeEmoji}
                            onChange={(event) => setSettingsBadgeEmoji(Array.from(event.target.value).slice(0, 2).join(''))}
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-center text-2xl outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            maxLength={4}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Category</label>
                          <input
                            type="text"
                            value={settingsCategory}
                            onChange={(event) => setSettingsCategory(event.target.value)}
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            maxLength={40}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
                          <textarea
                            value={settingsDescription}
                            onChange={(event) => setSettingsDescription(event.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            maxLength={220}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Welcome message</label>
                          <textarea
                            value={settingsWelcomeMessage}
                            onChange={(event) => setSettingsWelcomeMessage(event.target.value)}
                            rows={3}
                            placeholder="Welcome new members with a short note."
                            className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            maxLength={260}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Theme</label>
                          <div className="grid grid-cols-3 gap-3">
                            {GROUP_THEME_OPTIONS.map((themeOption) => (
                              <button
                                key={themeOption.id}
                                type="button"
                                onClick={() => setSettingsThemeId(themeOption.id)}
                                className={`h-16 rounded-[22px] border-2 bg-gradient-to-br ${themeOption.classes} transition ${
                                  settingsThemeId === themeOption.id ? 'border-white ring-2 ring-blue-500' : 'border-transparent hover:scale-[1.02]'
                                }`}
                                title={themeOption.label}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Privacy</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setSettingsPrivacy('public')}
                              className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${settingsPrivacy === 'public' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
                            >
                              Public
                            </button>
                            <button
                              type="button"
                              onClick={() => setSettingsPrivacy('private')}
                              className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${settingsPrivacy === 'private' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
                            >
                              Private
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">Moderator announcements</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Let moderators publish announcement posts without needing full admin access.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettingsModsCanAnnounce((value) => !value)}
                              className={`relative h-8 w-14 rounded-full transition ${settingsModsCanAnnounce ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${settingsModsCanAnnounce ? 'left-7' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">Moderator join approvals</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Selected moderators can review and approve private-group join requests.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettingsModsCanManageRequests((value) => !value)}
                              className={`relative h-8 w-14 rounded-full transition ${settingsModsCanManageRequests ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${settingsModsCanManageRequests ? 'left-7' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">Member posts</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Turn this off if only staff should publish posts in the group feed.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettingsAllowMemberPosts((value) => !value)}
                              className={`relative h-8 w-14 rounded-full transition ${settingsAllowMemberPosts ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${settingsAllowMemberPosts ? 'left-7' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">Member chat</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Turn this off to keep chat read-only unless someone is a moderator or admin.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettingsAllowMemberChat((value) => !value)}
                              className={`relative h-8 w-14 rounded-full transition ${settingsAllowMemberChat ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                            >
                              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${settingsAllowMemberChat ? 'left-7' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">Rules</label>
                        <textarea
                          value={settingsRulesText}
                          onChange={(event) => setSettingsRulesText(event.target.value)}
                          rows={6}
                          placeholder="One rule per line"
                          className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                      </div>

                      <div className="flex justify-end">
                        <div className="flex w-full flex-col items-end gap-3">
                          {settingsSaveError && (
                            <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                              {settingsSaveError}
                            </div>
                          )}
                          <Button
                            onClick={handleSaveSettings}
                            disabled={!settingsName.trim() || isSavingSettings}
                            className="rounded-full bg-blue-500 px-6 text-white hover:bg-blue-600"
                          >
                            {isSavingSettings ? 'Saving...' : 'Save Group Settings'}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className={`rounded-[28px] bg-gradient-to-br ${theme.classes} p-5 text-white shadow-lg`}>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/75">Moderator Access</p>
                        <h3 className="mt-2 text-2xl font-black">{group.name}</h3>
                        <p className="mt-2 max-w-sm text-sm text-white/80">You can review join requests for this group, but only the owner and admins can change the full group settings.</p>
                      </div>

                      <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950/60">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">What you can do</h3>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Approve or decline pending member requests, then jump back into the group once the queue is clear.</p>
                        <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                          <div className="rounded-2xl bg-white px-4 py-3 dark:bg-gray-900">Current privacy: <span className="font-bold capitalize">{group.privacy || 'public'}</span></div>
                          <div className="rounded-2xl bg-white px-4 py-3 dark:bg-gray-900">Pending requests: <span className="font-bold">{pendingRequestCount}</span></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="overflow-y-auto border-t border-gray-200 bg-gray-50/60 p-5 dark:border-gray-800 dark:bg-gray-950/55 lg:border-l lg:border-t-0">
                  <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Join Requests</p>
                        <h3 className="mt-1 text-lg font-black text-gray-900 dark:text-white">{pendingRequestCount} pending</h3>
                      </div>
                      <UserPlus className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Private groups can approve or decline new member requests from here. Mods only see this panel when the owner enables it.</p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {pendingRequestCount === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        Nobody is waiting to join right now.
                      </div>
                    ) : (
                      joinRequests.map((request) => (
                        <div key={request.uid} className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                          <div className="flex items-center gap-3">
                            <Avatar src={request.photoURL} alt={request.displayName} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-gray-900 dark:text-white">{request.displayName}</p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">@{request.username}</p>
                              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{request.createdAt ? formatDistanceToNow(new Date(request.createdAt), { addSuffix: true }) : ''}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveJoinRequest(request)}
                              className="flex-1 rounded-full bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600"
                            >
                              <Check className="mr-1 inline h-4 w-4" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineJoinRequest(request)}
                              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        targetId={group.id}
        targetType="group"
      />
    </div>
  );
}

// Group Post Item Component
function GroupPostItem({
  post,
  group,
  groupId,
  canManagePosts,
}: {
  key?: React.Key;
  post: any;
  group: any;
  groupId: string;
  canManagePosts: boolean;
}) {
  const { userProfile } = useAuth();
  const readOnlyReason = getReadOnlyReason(userProfile);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<PostReaction | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount || 0);
  const [localReactionCounts, setLocalReactionCounts] = useState<Record<string, number>>(post.reactionCounts || {});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [displayContent, setDisplayContent] = useState(post.content || '');
  const [editingContent, setEditingContent] = useState(post.content || '');
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [isSavingPostEdit, setIsSavingPostEdit] = useState(false);

  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', post.authorId));
        if (snap.exists()) setAuthor(snap.data() as UserProfile);
      } catch (e) {}
    };
    fetchAuthor();
  }, [post.authorId]);

  useEffect(() => {
    if (!userProfile?.uid) {
      setIsLiked(false);
      setSelectedReaction(null);
      return;
    }

    return onSnapshot(
      doc(db, `groups/${groupId}/posts/${post.id}/likes`, userProfile.uid),
      (snapshot) => {
        setIsLiked(snapshot.exists());
        setSelectedReaction(normalizePostReaction((snapshot.data() as any)?.reaction));
      }
    );
  }, [groupId, post.id, userProfile?.uid]);

  useEffect(() => {
    setLocalLikesCount(post.likesCount || 0);
    setLocalReactionCounts(post.reactionCounts || {});
  }, [post.id, post.likesCount, post.reactionCounts]);

  useEffect(() => {
    setDisplayContent(post.content || '');
    if (!isEditingPost) {
      setEditingContent(post.content || '');
    }
  }, [isEditingPost, post.content]);

  useEffect(() => {
    if (!showComments) return;

    const commentsQuery = query(
      collection(db, `groups/${groupId}/posts/${post.id}/comments`),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map((commentDoc) => ({ id: commentDoc.id, ...commentDoc.data() })));
    });
  }, [groupId, post.id, showComments]);

  const canInteractWithPost = Boolean(userProfile && group?.members?.includes(userProfile.uid));
  const canDeletePost = Boolean(
    userProfile && (canManagePosts || userProfile.uid === post.authorId)
  );
  const canEditPost = Boolean(userProfile && userProfile.uid === post.authorId);

  const handleToggleLike = async (reaction: PostReaction | null = POST_REACTIONS[0]) => {
    if (!userProfile || !canInteractWithPost) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    const likeRef = doc(db, `groups/${groupId}/posts/${post.id}/likes`, userProfile.uid);
    const postRef = doc(db, `groups/${groupId}/posts`, post.id);
    const previousReaction = selectedReaction;

    try {
      if (isLiked) {
        const nextCounts = adjustReactionCounts(localReactionCounts, previousReaction, null);
        await deleteDoc(likeRef);
        await updateDoc(postRef, {
          likesCount: increment(-1),
          reactionCounts: nextCounts,
        });
        setIsLiked(false);
        setSelectedReaction(null);
        setLocalLikesCount((prev: number) => Math.max(prev - 1, 0));
        setLocalReactionCounts(nextCounts);
      } else {
        const nextCounts = adjustReactionCounts(localReactionCounts, previousReaction, reaction);
        await setDoc(likeRef, {
          userId: userProfile.uid,
          reaction: reaction || null,
          createdAt: serverTimestamp(),
        });
        await updateDoc(postRef, {
          likesCount: increment(1),
          reactionCounts: nextCounts,
        });
        setIsLiked(true);
        setSelectedReaction(reaction);
        setLocalLikesCount((prev: number) => prev + 1);
        setLocalReactionCounts(nextCounts);

        if (post.authorId !== userProfile.uid) {
          await createNotification({
            type: 'like',
            sourceUserId: userProfile.uid,
            targetUserId: post.authorId,
            postId: post.id,
            linkTo: `/groups/${groupId}`,
            sourceUser: {
              displayName: userProfile.displayName,
              photoURL: userProfile.photoURL || null,
            },
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/posts/${post.id}/likes/${userProfile.uid}`);
    }
  };

  const handleSubmitComment = async () => {
    if (!userProfile || !canInteractWithPost || !newComment.trim() || isSubmittingComment) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    setIsSubmittingComment(true);
    const postRef = doc(db, `groups/${groupId}/posts`, post.id);

    try {
      await addDoc(collection(db, `groups/${groupId}/posts/${post.id}/comments`), {
        text: newComment.trim(),
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorUsername: userProfile.username,
        authorPhotoURL: userProfile.photoURL || null,
        createdAt: serverTimestamp(),
      });
      await updateDoc(postRef, { commentsCount: increment(1) });
      await updateChallengeProgress(userProfile.uid, 'comment_create');

      if (post.authorId !== userProfile.uid) {
        await createNotification({
          type: 'comment',
          sourceUserId: userProfile.uid,
          targetUserId: post.authorId,
          postId: post.id,
          linkTo: `/groups/${groupId}`,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null,
          },
          message: newComment.trim().slice(0, 140),
        });
      }

      await createMentionNotifications({
        text: newComment.trim(),
        sourceUserId: userProfile.uid,
        sourceUser: {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || null,
        },
        linkTo: `/groups/${groupId}`,
        message: newComment.trim().slice(0, 160),
      });

      setNewComment('');
      setShowComments(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}/posts/${post.id}/comments`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeletePost = async () => {
    if (!canDeletePost || isDeletingPost) return;
    if (!window.confirm('Remove this group post?')) return;

    setIsDeletingPost(true);
    try {
      const [likesSnapshot, commentsSnapshot] = await Promise.all([
        getDocs(collection(db, `groups/${groupId}/posts/${post.id}/likes`)),
        getDocs(collection(db, `groups/${groupId}/posts/${post.id}/comments`)),
      ]);

      await Promise.all([
        ...likesSnapshot.docs.map((likeDoc) => deleteDoc(likeDoc.ref)),
        ...commentsSnapshot.docs.map((commentDoc) => deleteDoc(commentDoc.ref)),
      ]);

      await deleteDoc(doc(db, `groups/${groupId}/posts`, post.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/posts/${post.id}`);
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleSavePostEdit = async () => {
    if (!canEditPost || isSavingPostEdit) return;
    const nextContent = editingContent.trim();
    if (!nextContent) return;
    if (nextContent === displayContent.trim()) {
      setIsEditingPost(false);
      return;
    }
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    setIsSavingPostEdit(true);
    try {
      await updateDoc(doc(db, `groups/${groupId}/posts`, post.id), {
        content: nextContent,
        editedAt: new Date().toISOString(),
      });
      setDisplayContent(nextContent);
      setIsEditingPost(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/posts/${post.id}`);
    } finally {
      setIsSavingPostEdit(false);
    }
  };

  if (!author) return null;

  return (
    <div className="border-b border-gray-200/80 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
      <div className="flex space-x-3">
        <Link to={`/profile/${author.uid}`}>
          <Avatar src={author.photoURL} alt={author.displayName} />
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <Link to={`/profile/${author.uid}`} className="font-bold hover:underline dark:text-white text-sm">
                  {author.displayName}
                </Link>
                {author.isVerified && <VerificationBadge className="w-3.5 h-3.5" title="Verified" />}
                <UserBadges badges={author.badges} hiddenBadges={author.hiddenBadges} badgeSize="w-3.5 h-3.5" />
                <LevelBadge level={author.level || 1} compact />
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : ''}
                </span>
              </div>
              {author.username && (
                <p className="text-xs text-gray-500 dark:text-gray-400">@{author.username}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {canEditPost && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContent(displayContent || '');
                    setIsEditingPost(true);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20"
                  title="Edit post"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {canDeletePost && (
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={isDeletingPost}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/20"
                  title="Remove post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 text-sm dark:text-gray-200 leading-relaxed">
            {isEditingPost ? (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/90 p-3 dark:border-gray-800 dark:bg-gray-900/80">
                <textarea
                  value={editingContent}
                  onChange={(event) => setEditingContent(event.target.value)}
                  rows={4}
                  maxLength={5000}
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-400">{editingContent.length}/5000</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContent(displayContent || '');
                        setIsEditingPost(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSavePostEdit()}
                      disabled={!editingContent.trim() || isSavingPostEdit}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isSavingPostEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <FormattedText text={displayContent} />
                {(post.editedAt || post.updatedAt) && (
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Edited</p>
                )}
              </>
            )}
          </div>
          {getTopReactionEntries(localReactionCounts).length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {getTopReactionEntries(localReactionCounts).map((entry) => (
                <div key={entry.emoji} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.meta.chipClass}`}>
                  <span>{entry.emoji}</span>
                  <span>{entry.count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="relative mt-3 flex flex-wrap items-center gap-5 text-gray-500 dark:text-gray-400">
            <button
              type="button"
              onClick={() => void handleToggleLike(isLiked ? selectedReaction : POST_REACTIONS[0])}
              disabled={!canInteractWithPost}
              className={`flex items-center space-x-1 transition-colors text-xs ${isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
            >
              {isLiked && selectedReaction ? <span className="text-sm leading-none">{selectedReaction}</span> : <Heart className="h-3.5 w-3.5" />}
              <span>{localLikesCount || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReactionPicker((value) => !value)}
              disabled={!canInteractWithPost}
              className={`flex items-center space-x-1 transition-colors text-xs ${showReactionPicker ? 'text-fuchsia-500' : 'hover:text-fuchsia-500'}`}
            >
              <SmilePlus className="h-3.5 w-3.5" />
              <span>React</span>
            </button>
            <button
              type="button"
              onClick={() => setShowComments((value) => !value)}
              className={`flex items-center space-x-1 transition-colors text-xs ${showComments ? 'text-blue-500' : 'hover:text-blue-500'}`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{post.commentsCount || 0}</span>
            </button>
            {showReactionPicker && (
              <div className="absolute bottom-full left-0 z-10 mb-2 flex items-center gap-1 rounded-full border border-pink-200 bg-white px-2 py-1 shadow-lg dark:border-pink-400/20 dark:bg-gray-900">
                {POST_REACTIONS.map((reaction) => (
                  <button
                    key={reaction}
                    type="button"
                    onClick={() => {
                      setShowReactionPicker(false);
                      void handleToggleLike(reaction);
                    }}
                    className="rounded-full p-1.5 text-lg transition-transform hover:scale-110"
                  >
                    {reaction}
                  </button>
                ))}
              </div>
            )}
          </div>

          {showComments && (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/70">
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">No comments yet. Start the thread.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <Link to={`/profile/${comment.authorId}`} className="shrink-0">
                        <Avatar src={comment.authorPhotoURL} alt={comment.authorName} size="sm" className="h-7 w-7" />
                      </Link>
                      <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-gray-950">
                        <div className="flex flex-wrap items-center gap-1">
                          <Link to={`/profile/${comment.authorId}`} className="font-semibold text-gray-900 hover:underline dark:text-white">
                            {comment.authorName || 'Member'}
                          </Link>
                          {comment.authorUsername && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">@{comment.authorUsername}</span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-200">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Reply to this post..."
                  className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={!canInteractWithPost || !newComment.trim() || isSubmittingComment}
                  className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Comment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
