import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, setDoc, deleteDoc, updateDoc, increment, getDocs } from 'firebase/firestore';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PostItem } from '../components/post/PostItem';
import { ArrowLeft, Calendar, X, Camera, MoreHorizontal, Flag, Trash2, Star, Mail, Eye, EyeOff, Award, Palette, Radio, Clock, Video, Heart, Users, Globe, Instagram, Youtube, MessageCircleMore, BriefcaseBusiness, BadgeCheck, Send, ImagePlus, Megaphone, Building2, ExternalLink, CheckCheck, XCircle, Handshake } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ReportModal } from '../components/ui/ReportModal';
import { compressImage } from '../lib/utils';
import { VerificationBadge, UserBadges, PremiumBadge } from '../components/ui/VerificationBadge';
import { AvatarCustomizer } from '../components/ui/AvatarCustomizer';
import { updateChallengeProgress } from '../lib/challenges';
import { getAvatarDecorationClass, getProfileTheme } from '../lib/profileAppearance';
import { LevelBadge } from '../components/ui/LevelBadge';
import { MAX_LEVEL, normalizeUserProgress } from '../lib/levels';
import { sanitizeStorageFileName, tryDeleteStoragePath, uploadOptimizedImage } from '../lib/storageUploads';
import { SHOP_ITEMS } from '../lib/shopCatalog';
import { createNotification } from '../lib/notifications';
import { getProfileSocialLinks, normalizeSocialLinks, normalizeWebsiteUrl, type SocialLinkKey, type SocialLinks, validateSocialLinks } from '../lib/profileLinks';
import { getActualPresenceStatus, getStatusDotClass, getStatusLabel, getStatusTextClass, getStatusTimestamp, getVisibleStatus } from '../lib/statusPresence';
import { BUSINESS_AFFILIATION_LIMIT, getBusinessBadgeLabel, getPrimaryBusinessAffiliation, isBusinessUser, subscribeToAffiliatedProfiles, subscribeToBusinessAds, subscribeToIncomingBusinessInvites, type BusinessAffiliationInvite, type SponsoredAd } from '../lib/business';
import { searchUsersByQuery } from '../lib/userSearch';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getStoriesForAuthor, groupStoriesByAuthor, subscribeToActiveStories, type StoryRecord } from '../lib/stories';
import { StoryViewer } from '../components/stories/StoryViewer';

export function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const profileUserId = userId || userProfile?.uid;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | 'remove' | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editBanner, setEditBanner] = useState<File | 'remove' | null>(null);
  const [editBannerPreview, setEditBannerPreview] = useState<string | null>(null);
  const [editProfileDecoration, setEditProfileDecoration] = useState<string | null>(null);
  const [editHiddenBadges, setEditHiddenBadges] = useState<string[]>([]);
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('');
  const [editSocialLinks, setEditSocialLinks] = useState<SocialLinks>({});
  const [editLinkErrors, setEditLinkErrors] = useState<Partial<Record<'websiteUrl' | SocialLinkKey, string>>>({});
  const [editIsBusinessAccount, setEditIsBusinessAccount] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editBusinessCategory, setEditBusinessCategory] = useState('');
  const [editBusinessBadgeLabel, setEditBusinessBadgeLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);
  const [showLevelPanel, setShowLevelPanel] = useState(false);
  const [blockedProfiles, setBlockedProfiles] = useState<UserProfile[]>([]);
  const [isBlockActionLoading, setIsBlockActionLoading] = useState(false);

  // Follow Modal State
  const [showFollowModal, setShowFollowModal] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<UserProfile[]>([]);
  const [loadingFollows, setLoadingFollows] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'likes' | 'live'>('posts');
  const [replies, setReplies] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [userStreams, setUserStreams] = useState<any[]>([]);
  const [incomingBusinessInvites, setIncomingBusinessInvites] = useState<BusinessAffiliationInvite[]>([]);
  const [affiliatedProfiles, setAffiliatedProfiles] = useState<UserProfile[]>([]);
  const [businessSearchQuery, setBusinessSearchQuery] = useState('');
  const [businessSearchResults, setBusinessSearchResults] = useState<UserProfile[]>([]);
  const [inviteBusyUserId, setInviteBusyUserId] = useState<string | null>(null);
  const [businessAds, setBusinessAds] = useState<SponsoredAd[]>([]);
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [adMediaFile, setAdMediaFile] = useState<File | null>(null);
  const [adMediaPreview, setAdMediaPreview] = useState<string | null>(null);
  const [isSavingAd, setIsSavingAd] = useState(false);
  const adFileInputRef = useRef<HTMLInputElement>(null);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const isOwnProfile = userProfile?.uid === profile?.uid;

  useEffect(() => {
    const blockedUserIds = userProfile?.blockedUserIds || [];
    if (blockedUserIds.length === 0) {
      setBlockedProfiles([]);
      return;
    }

    void (async () => {
      const profiles = await Promise.all(
        blockedUserIds.map(async (blockedUid) => {
          try {
            const blockedSnap = await getDoc(doc(db, 'users', blockedUid));
            return blockedSnap.exists() ? (blockedSnap.data() as UserProfile) : null;
          } catch {
            return null;
          }
        })
      );
      setBlockedProfiles(profiles.filter(Boolean) as UserProfile[]);
    })();
  }, [userProfile?.blockedUserIds]);

  useEffect(() => {
    if (!isOwnProfile || !userProfile?.uid) {
      setIncomingBusinessInvites([]);
      setAffiliatedProfiles([]);
      return;
    }

    const unsubIncoming = subscribeToIncomingBusinessInvites(userProfile.uid, setIncomingBusinessInvites);
    const unsubAffiliated = subscribeToAffiliatedProfiles(userProfile.uid, setAffiliatedProfiles);

    return () => {
      unsubIncoming();
      unsubAffiliated();
    };
  }, [isOwnProfile, userProfile?.uid]);

  useEffect(() => {
    if (!isOwnProfile || !userProfile?.uid || !isBusinessUser(profile)) {
      setBusinessAds([]);
      return;
    }

    const unsubscribe = subscribeToBusinessAds(userProfile.uid, setBusinessAds);
    return () => unsubscribe();
  }, [isOwnProfile, profile, userProfile?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeToActiveStories(setStories);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOwnProfile || !userProfile?.uid || !businessSearchQuery.trim()) {
      setBusinessSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const sentTargetIds = new Set(
        affiliatedProfiles.map((entry) => entry.uid)
      );

      const results = await searchUsersByQuery(businessSearchQuery, {
        excludeUserIds: [userProfile.uid, ...sentTargetIds],
        limit: 6,
      });
      setBusinessSearchResults(results);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [affiliatedProfiles, businessSearchQuery, isOwnProfile, userProfile?.uid]);

  useEffect(() => {
    if (!profileUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Real-time profile listener for live presence updates
    const docRef = doc(db, 'users', profileUserId);
    let followCountsFetched = false;
    const unsubProfile = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        
        // Only fetch follow counts once (not on every presence update)
        if (!followCountsFetched) {
          followCountsFetched = true;
          try {
            const followersQ = query(collection(db, 'follows'), where('followingId', '==', profileUserId));
            const followersSnap = await getDocs(followersQ);
            data.followersCount = followersSnap.size;
            
            const followingQ = query(collection(db, 'follows'), where('followerId', '==', profileUserId));
            const followingSnap = await getDocs(followingQ);
            data.followingCount = followingSnap.size;
            
            updateDoc(docRef, { followersCount: data.followersCount, followingCount: data.followingCount }).catch(console.error);
          } catch (e) {
            console.error('Error fetching follow counts:', e);
          }
        }
        
        setProfile(prev => prev ? { ...data, followersCount: prev.followersCount ?? data.followersCount, followingCount: prev.followingCount ?? data.followingCount } : data);
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, OperationType.GET, `users/${profileUserId}`); } catch(e) {}
    });

    const checkFollow = async () => {
      if (!userProfile || userProfile.uid === profileUserId) return;
      try {
        const followId = `${userProfile.uid}_${profileUserId}`;
        const followRef = doc(db, 'follows', followId);
        const followSnap = await getDoc(followRef);
        setIsFollowing(followSnap.exists());

        const followedById = `${profileUserId}_${userProfile.uid}`;
        const followedByRef = doc(db, 'follows', followedById);
        const followedBySnap = await getDoc(followedByRef);
        setIsFollowedBy(followedBySnap.exists());
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `follows`);
      }
    };

    const fetchPosts = () => {
      const postsRef = collection(db, 'posts');
      const q = query(postsRef, where('authorId', '==', profileUserId), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snapshot) => {
        setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        try { handleFirestoreError(error, OperationType.LIST, 'posts'); } catch(e) {}
      });
    };

    const fetchReplies = () => {
      const commentsRef = collection(db, 'comments');
      const q = query(commentsRef, where('authorId', '==', profileUserId), orderBy('createdAt', 'desc'));
      return onSnapshot(q, async (snapshot) => {
        const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Fetch the parent posts for these comments
        const postsData = [];
        for (const comment of commentsData) {
          try {
            const postDoc = await getDoc(doc(db, 'posts', (comment as any).postId));
            if (postDoc.exists()) {
              postsData.push({ id: postDoc.id, ...postDoc.data() });
            }
          } catch (e) {
            console.error("Error fetching parent post:", e);
          }
        }
        // Remove duplicates
        const uniquePosts = Array.from(new Map(postsData.map(item => [item.id, item])).values());
        setReplies(uniquePosts);
      });
    };

    const fetchLikedPosts = () => {
      const likesRef = collection(db, 'likes');
      const q = query(likesRef, where('userId', '==', profileUserId), orderBy('createdAt', 'desc'));
      return onSnapshot(q, async (snapshot) => {
        const likesData = snapshot.docs.map(doc => doc.data());
        const postsData = [];
        for (const like of likesData) {
          try {
            const postDoc = await getDoc(doc(db, 'posts', like.postId));
            if (postDoc.exists()) {
              postsData.push({ id: postDoc.id, ...postDoc.data() });
            }
          } catch (e) {
            console.error("Error fetching liked post:", e);
          }
        }
        setLikedPosts(postsData);
      });
    };

    checkFollow();
    const unsubPosts = fetchPosts();
    const unsubReplies = fetchReplies();
    const unsubLikes = fetchLikedPosts();

    return () => {
      unsubProfile();
      unsubPosts();
      unsubReplies();
      unsubLikes();
    };
  }, [profileUserId, userProfile?.uid]);

  const fetchUserStreams = async () => {
    const targetId = profileUserId;
    if (!targetId) return;
    try {
      const q = query(collection(db, 'livestreams'), where('hostId', '==', targetId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setUserStreams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'livestreams');
    }
  };

  const fetchFollowList = async (type: 'followers' | 'following') => {
    if (!profile) return;
    setLoadingFollows(true);
    setFollowList([]);
    try {
      const followsRef = collection(db, 'follows');
      const q = type === 'followers' 
        ? query(followsRef, where('followingId', '==', profile.uid))
        : query(followsRef, where('followerId', '==', profile.uid));
        
      const snapshot = await getDocs(q);
      
      const userIds = snapshot.docs.map(doc => 
        type === 'followers' ? doc.data().followerId : doc.data().followingId
      );
      
      if (userIds.length > 0) {
        const users = [];
        for (const id of userIds) {
           const userDoc = await getDoc(doc(db, 'users', id));
           if (userDoc.exists()) {
             users.push(userDoc.data() as UserProfile);
           }
        }
        setFollowList(users);
      }
    } catch (error) {
      console.error("Error fetching follow list:", error);
    } finally {
      setLoadingFollows(false);
    }
  };

  const handleOpenFollowModal = (type: 'followers' | 'following') => {
    setShowFollowModal(type);
    fetchFollowList(type);
  };

  const handleChat = async () => {
    if (!userProfile || !profile) return;
    if (!isOwnProfile && !canMessageProfile) return;
    navigate('/messages', { state: { otherUser: profile } });
  };

  const handleToggleBlock = async () => {
    if (!userProfile || !profile || userProfile.uid === profile.uid || isBlockActionLoading) return;

    setIsBlockActionLoading(true);
    try {
      const blockedUserIds = userProfile.blockedUserIds || [];
      const isBlocked = blockedUserIds.includes(profile.uid);
      const nextBlockedUserIds = isBlocked
        ? blockedUserIds.filter((uid) => uid !== profile.uid)
        : [...new Set([...blockedUserIds, profile.uid])];

      await updateDoc(doc(db, 'users', userProfile.uid), {
        blockedUserIds: nextBlockedUserIds,
      });
      setShowMenu(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setIsBlockActionLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!userProfile || !profile) return;

    const followId = `${userProfile.uid}_${profile.uid}`;
    const followRef = doc(db, 'follows', followId);
    const currentUserRef = doc(db, 'users', userProfile.uid);
    const targetUserRef = doc(db, 'users', profile.uid);

    try {
      if (isFollowing) {
        setIsFollowing(false);
        setProfile({ ...profile, followersCount: profile.followersCount - 1 });
        await deleteDoc(followRef);
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
      } else {
        setIsFollowing(true);
        setProfile({ ...profile, followersCount: profile.followersCount + 1 });
        await setDoc(followRef, {
          id: followId,
          followerId: userProfile.uid,
          followingId: profile.uid,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(currentUserRef, { followingCount: increment(1) });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        await updateChallengeProgress(userProfile.uid, 'follow_user');

        await createNotification({
          type: 'follow',
          sourceUserId: userProfile.uid,
          targetUserId: profile.uid,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null
          },
          dedupeKey: `follow-${userProfile.uid}`,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'follows/users');
      // Revert optimistic update
      setIsFollowing(!isFollowing);
      setProfile({ ...profile, followersCount: isFollowing ? profile.followersCount + 1 : profile.followersCount - 1 });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">User not found</h2>
        <p className="text-gray-500 mb-4">The user you are looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  const blockedUserIds = userProfile?.blockedUserIds || [];
  const isBlockedProfile = !isOwnProfile && blockedUserIds.includes(profile.uid);
  const canMessageProfile = !isOwnProfile && isFollowing && isFollowedBy && !isBlockedProfile;
  const canViewPrivateProfile = isOwnProfile || !profile.isPrivate || isFollowing || userProfile?.role === 'admin';
  const profileStories = getStoriesForAuthor(stories, profile.uid);
  const profileStoryGroups = groupStoriesByAuthor(profileStories, userProfile || null);
  const profileStoryGroup = profileStoryGroups[0] || null;
  const hasProfileStory = profileStories.length > 0;

  const handleEditProfile = () => {
    const profileSocialLinks = getProfileSocialLinks(profile);
    setEditDisplayName(profile.displayName);
    setEditBio(profile.bio || '');
    setEditPhotoPreview(profile.photoURL || null);
    setEditBannerPreview(resolvedBannerUrl);
    setEditProfileDecoration(resolvedProfileDecoration);
    setEditHiddenBadges(profile.hiddenBadges || []);
    setEditWebsiteUrl(profile.websiteUrl || '');
    setEditSocialLinks({
      x: profileSocialLinks.x || '',
      instagram: profileSocialLinks.instagram || '',
      tiktok: profileSocialLinks.tiktok || '',
      youtube: profileSocialLinks.youtube || '',
      discord: profileSocialLinks.discord || '',
    });
    setEditIsBusinessAccount(Boolean(profile.isBusinessAccount));
    setEditBusinessName(profile.businessName || profile.displayName || '');
    setEditBusinessCategory(profile.businessCategory || '');
    setEditBusinessBadgeLabel(profile.businessBadgeLabel || getBusinessBadgeLabel(profile));
    setEditLinkErrors({});
    setEditPhoto(null);
    setEditBanner(null);
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    const linkErrors = validateSocialLinks(editWebsiteUrl, editSocialLinks);
    if (Object.keys(linkErrors).length > 0) {
      setEditLinkErrors(linkErrors);
      return;
    }

    setIsSaving(true);
    try {
      let newPhotoURL = profile.photoURL;
      let newBannerURL = resolvedBannerUrl || '';
      let newPhotoStoragePath = profile.photoStoragePath || null;
      let newBannerStoragePath = profile.bannerStoragePath || null;
      const nextProfileDecoration = editProfileDecoration && ownedDecorationUrls.has(editProfileDecoration)
        ? editProfileDecoration
        : null;
      const normalizedWebsite = editWebsiteUrl.trim() ? normalizeWebsiteUrl(editWebsiteUrl) : '';
      const normalizedSocialLinks = normalizeSocialLinks(editSocialLinks);

      if (editPhoto) {
        if (editPhoto === 'remove') {
          newPhotoURL = '';
          newPhotoStoragePath = null;
        } else {
          const safeFileName = sanitizeStorageFileName((editPhoto as File).name || `avatar-${Date.now()}.jpg`);
          const uploadedPhoto = await uploadOptimizedImage(
            editPhoto as File,
            `profiles/${userProfile.uid}/avatar/${Date.now()}-${safeFileName}`,
            {
              maxWidth: 400,
              maxHeight: 400,
              quality: 0.8,
              allowDataUrlFallback: true,
              preferDataUrl: true,
            }
          );
          newPhotoURL = uploadedPhoto.url;
          newPhotoStoragePath = uploadedPhoto.storagePath;
        }
      } else if (editPhotoPreview && editPhotoPreview !== profile.photoURL) {
        // User selected a preset avatar (DiceBear URL)
        newPhotoURL = editPhotoPreview;
        newPhotoStoragePath = null;
      }

      if (editBanner) {
        if (editBanner === 'remove') {
          newBannerURL = '';
          newBannerStoragePath = null;
        } else {
          const safeFileName = sanitizeStorageFileName((editBanner as File).name || `banner-${Date.now()}.jpg`);
          const uploadedBanner = await uploadOptimizedImage(
            editBanner as File,
            `profiles/${userProfile.uid}/banner/${Date.now()}-${safeFileName}`,
            {
              maxWidth: 1200,
              maxHeight: 400,
              quality: 0.8,
              allowDataUrlFallback: true,
              preferDataUrl: true,
            }
          );
          newBannerURL = uploadedBanner.url;
          newBannerStoragePath = uploadedBanner.storagePath;
        }
      } else if (editBannerPreview && editBannerPreview !== resolvedBannerUrl) {
        // User selected a preset wallpaper URL
        if (!shopWallpaperUrls.has(editBannerPreview) || ownedWallpaperUrls.has(editBannerPreview)) {
          newBannerURL = editBannerPreview;
          newBannerStoragePath = null;
        }
      }

      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        displayName: editDisplayName,
        bio: editBio,
        photoURL: newPhotoURL,
        bannerURL: newBannerURL,
        photoStoragePath: newPhotoStoragePath,
        bannerStoragePath: newBannerStoragePath,
        profileDecoration: nextProfileDecoration,
        hiddenBadges: editHiddenBadges,
        websiteUrl: normalizedWebsite || '',
        socialLinks: normalizedSocialLinks,
        isBusinessAccount: editIsBusinessAccount,
        businessName: editIsBusinessAccount ? (editBusinessName.trim() || editDisplayName.trim()) : '',
        businessCategory: editIsBusinessAccount ? editBusinessCategory.trim() : '',
        businessBadgeLabel: editIsBusinessAccount ? (editBusinessBadgeLabel.trim() || 'Affiliated') : '',
      });

      if (profile.photoStoragePath && profile.photoStoragePath !== newPhotoStoragePath) {
        void tryDeleteStoragePath(profile.photoStoragePath);
      }
      if (profile.bannerStoragePath && profile.bannerStoragePath !== newBannerStoragePath) {
        void tryDeleteStoragePath(profile.bannerStoragePath);
      }

      setProfile({
        ...profile,
        displayName: editDisplayName,
        bio: editBio,
        photoURL: newPhotoURL,
        bannerURL: newBannerURL,
        photoStoragePath: newPhotoStoragePath,
        bannerStoragePath: newBannerStoragePath,
        profileDecoration: nextProfileDecoration,
        hiddenBadges: editHiddenBadges,
        websiteUrl: normalizedWebsite || '',
        socialLinks: normalizedSocialLinks,
        isBusinessAccount: editIsBusinessAccount,
        businessName: editIsBusinessAccount ? (editBusinessName.trim() || editDisplayName.trim()) : '',
        businessCategory: editIsBusinessAccount ? editBusinessCategory.trim() : '',
        businessBadgeLabel: editIsBusinessAccount ? (editBusinessBadgeLabel.trim() || 'Affiliated') : '',
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendBusinessInvite = async (target: UserProfile) => {
    if (!userProfile || !profile || !isOwnProfile || !isBusinessUser(profile) || inviteBusyUserId) return;
    if (affiliatedProfiles.length >= BUSINESS_AFFILIATION_LIMIT) {
      alert(`Business accounts can only keep ${BUSINESS_AFFILIATION_LIMIT} active affiliations at one time.`);
      return;
    }

    setInviteBusyUserId(target.uid);
    try {
      const inviteRef = doc(collection(db, 'notifications'));
      await setDoc(inviteRef, {
        id: inviteRef.id,
        type: 'business_affiliation',
        sourceUserId: userProfile.uid,
        targetUserId: target.uid,
        sourceUser: {
          displayName: profile.businessName || profile.displayName,
          photoURL: profile.photoURL || null,
        },
        businessUid: userProfile.uid,
        businessName: profile.businessName || profile.displayName,
        businessUsername: profile.username,
        badgeLabel: profile.businessBadgeLabel || getBusinessBadgeLabel(profile),
        targetDisplayName: target.displayName,
        targetUsername: target.username,
        inviteStatus: 'pending',
        title: 'Business affiliation invite',
        message: `${profile.businessName || profile.displayName} invited you to join their affiliated accounts.`,
        read: false,
        linkTo: '/profile',
        createdAt: new Date().toISOString(),
        respondedAt: null,
      });

      setBusinessSearchQuery('');
      setBusinessSearchResults([]);
    } catch (error) {
      console.error('Error sending business affiliation invite:', error);
      alert('Failed to send the business affiliation invite.');
    } finally {
      setInviteBusyUserId(null);
    }
  };

  const handleRespondToBusinessInvite = async (invite: BusinessAffiliationInvite, nextStatus: 'accepted' | 'declined') => {
    if (!userProfile || !isOwnProfile) return;

    try {
      const inviteRef = doc(db, 'notifications', invite.id);
      await updateDoc(inviteRef, {
        inviteStatus: nextStatus,
        respondedAt: new Date().toISOString(),
        read: true,
      });

      if (nextStatus === 'accepted') {
        const userRef = doc(db, 'users', userProfile.uid);
        const userSnap = await getDoc(userRef);
        const currentData = userSnap.data() as UserProfile | undefined;
        const currentAffiliations = currentData?.businessAffiliations || [];
        const nextAffiliations = currentAffiliations.some((entry) => entry.businessUid === invite.businessUid)
          ? currentAffiliations
          : [
              ...currentAffiliations,
              {
                businessUid: invite.businessUid,
                businessName: invite.businessName,
                businessUsername: invite.businessUsername,
                badgeLabel: invite.badgeLabel,
                acceptedAt: new Date().toISOString(),
              },
            ].slice(0, BUSINESS_AFFILIATION_LIMIT);

        await updateDoc(userRef, {
          businessAffiliations: nextAffiliations,
        });

        await createNotification({
          type: 'business_affiliation',
          sourceUserId: userProfile.uid,
          targetUserId: invite.businessUid,
          title: 'Affiliation accepted',
          message: `${userProfile.displayName} accepted the ${invite.badgeLabel} affiliation.`,
          linkTo: `/profile/${userProfile.uid}`,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null,
          },
        });
      }
    } catch (error) {
      console.error('Error responding to business invite:', error);
      alert('Failed to update the invite.');
    }
  };

  const handleCreateAd = async () => {
    if (!userProfile || !profile || !isOwnProfile || !isBusinessUser(profile) || isSavingAd) return;
    if (!adTitle.trim() || !adDescription.trim() || !adLinkUrl.trim()) {
      alert('Ads need a title, description, and link.');
      return;
    }

    setIsSavingAd(true);
    try {
      let mediaUrl = '';
      let mediaType: 'image' | 'video' | null = null;
      let mediaStoragePath: string | null = null;

      if (adMediaFile) {
        const safeFileName = sanitizeStorageFileName(adMediaFile.name || `ad-${Date.now()}`);
        if (adMediaFile.type.startsWith('video/')) {
          const storagePath = `ads/${userProfile.uid}/${Date.now()}-${safeFileName}`;
          const mediaRef = ref(storage, storagePath);
          await uploadBytes(mediaRef, adMediaFile);
          mediaUrl = await getDownloadURL(mediaRef);
          mediaType = 'video';
          mediaStoragePath = storagePath;
        } else {
          const uploadedImage = await uploadOptimizedImage(adMediaFile, `ads/${userProfile.uid}/${Date.now()}-${safeFileName}`, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.82,
            timeoutMs: 12000,
            allowDataUrlFallback: true,
            preferDataUrl: adMediaFile.size <= 900000,
          });
          mediaUrl = uploadedImage.url;
          mediaType = 'image';
          mediaStoragePath = uploadedImage.storagePath;
        }
      }

      const adRef = doc(collection(db, 'posts'));
      await setDoc(adRef, {
        id: adRef.id,
        authorId: userProfile.uid,
        authorName: profile.businessName || profile.displayName,
        authorUsername: profile.username,
        authorPhotoURL: profile.photoURL || null,
        authorIsVerified: profile.isVerified || false,
        authorBadges: profile.badges || [],
        authorHiddenBadges: profile.hiddenBadges || [],
        authorLevel: profile.level || 1,
        authorProfileDecoration: profile.profileDecoration || null,
        authorUnlockedDecorations: profile.unlockedDecorations || [],
        authorIsBusinessAccount: true,
        authorBusinessAffiliations: profile.businessAffiliations || [],
        content: adDescription.trim(),
        media: mediaUrl ? [{ url: mediaUrl, type: mediaType || 'image', storagePath: mediaStoragePath || null }] : [],
        mediaURLs: mediaUrl ? [mediaUrl] : [],
        mediaTypes: mediaType ? [mediaType] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likesCount: 0,
        reactionCounts: {},
        commentsCount: 0,
        repostsCount: 0,
        isSponsored: true,
        sponsoredTitle: adTitle.trim(),
        linkUrl: normalizeWebsiteUrl(adLinkUrl),
        sponsoredActive: true,
      });

      setAdTitle('');
      setAdDescription('');
      setAdLinkUrl('');
      setAdMediaFile(null);
      setAdMediaPreview(null);
    } catch (error) {
      console.error('Error creating sponsored ad:', error);
      alert('Failed to create the ad.');
    } finally {
      setIsSavingAd(false);
    }
  };

  const handleToggleAdState = async (ad: SponsoredAd) => {
    try {
      await updateDoc(doc(db, 'posts', ad.id), {
        sponsoredActive: !ad.isActive,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating ad state:', error);
      alert('Failed to update the ad.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold dark:text-white mb-2">User not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">This user doesn't exist or has been removed.</p>
          <Link to="/" className="text-blue-500 hover:text-blue-600 font-bold">Go Home</Link>
        </div>
      </div>
    );
  }

  const unlockedItemIds = profile.unlockedDecorations || [];
  const ownedShopItems = SHOP_ITEMS.filter((item) => unlockedItemIds.includes(item.id));
  const ownedAvatarDecorations = ownedShopItems.filter((item) => item.type === 'avatar');
  const ownedWallpaperItems = ownedShopItems.filter((item) => item.type === 'wallpaper');
  const ownedDecorationUrls = new Set(ownedAvatarDecorations.map((item) => item.url));
  const ownedWallpaperUrls = new Set(ownedWallpaperItems.map((item) => item.url));
  const ownedThemeUrls = new Set(ownedShopItems.filter((item) => item.type === 'theme').map((item) => item.url));
  const shopWallpaperUrls = new Set(SHOP_ITEMS.filter((item) => item.type === 'wallpaper').map((item) => item.url));
  const shopThemeUrls = new Set(SHOP_ITEMS.filter((item) => item.type === 'theme').map((item) => item.url));
  const resolvedProfileDecoration = profile.profileDecoration && ownedDecorationUrls.has(profile.profileDecoration)
    ? profile.profileDecoration
    : null;
  const resolvedBannerUrl = profile.bannerURL && shopWallpaperUrls.has(profile.bannerURL) && !ownedWallpaperUrls.has(profile.bannerURL)
    ? null
    : profile.bannerURL || null;
  const resolvedProfileTheme = profile.profileTheme && shopThemeUrls.has(profile.profileTheme) && !ownedThemeUrls.has(profile.profileTheme)
    ? null
    : profile.profileTheme || null;
  const activeTheme = getProfileTheme(resolvedProfileTheme);
  const isLightTheme = resolvedProfileTheme === 'theme-sakura' || resolvedProfileTheme === 'theme-mint';
  const primaryTextClass = activeTheme
    ? isLightTheme
      ? 'text-slate-900'
      : 'text-white'
    : 'text-gray-900 dark:text-white';
  const secondaryTextClass = activeTheme ? activeTheme.mutedText : 'text-gray-500 dark:text-gray-400';
  const bodyTextClass = activeTheme
    ? isLightTheme
      ? 'text-slate-800'
      : 'text-white/92'
    : 'text-gray-900 dark:text-white';
  const subtleTextClass = activeTheme
    ? isLightTheme
      ? 'text-slate-700/80'
      : 'text-white/80'
    : 'text-gray-500 dark:text-gray-400';
  const pillClass = activeTheme
    ? isLightTheme
      ? 'bg-black/5 text-slate-700 border border-black/10'
      : 'bg-white/15 text-white/85 border border-white/10'
    : 'bg-gray-100 text-gray-600';
  const themedCardClass = activeTheme
    ? `${activeTheme.surfaceSoft} border border-white/10 backdrop-blur-xl`
    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700';
  const themedEmptyStateClass = activeTheme
    ? `${secondaryTextClass} rounded-2xl border border-white/10 bg-white/5`
    : 'text-gray-500 dark:text-gray-400';
  const levelState = normalizeUserProgress(profile);
  const profileSocialLinks = getProfileSocialLinks(profile);
  const featuredWebsiteUrl = profile.websiteUrl ? normalizeWebsiteUrl(profile.websiteUrl) : '';
  const visibleStatus = getVisibleStatus(profile);
  const actualPresenceStatus = getActualPresenceStatus(profile);
  const statusTimestamp = getStatusTimestamp(profile);
  const canSeeActualPresence = Boolean(userProfile?.role === 'admin' && !isOwnProfile);
  const isBusinessProfile = isBusinessUser(profile);
  const primaryBusinessAffiliation = getPrimaryBusinessAffiliation(profile);
  const socialIconMap: Record<SocialLinkKey, React.ReactNode> = {
    x: <span className="text-xs font-black">X</span>,
    instagram: <Instagram className="h-4 w-4" />,
    tiktok: <span className="text-[10px] font-black uppercase tracking-[0.16em]">TT</span>,
    youtube: <Youtube className="h-4 w-4" />,
    discord: <MessageCircleMore className="h-4 w-4" />,
  };
  const socialLabelMap: Record<SocialLinkKey, string> = {
    x: 'X',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    discord: 'Discord',
  };
  const profileTabs: Array<{ key: 'posts' | 'replies' | 'likes' | 'live'; label: string; icon?: typeof Radio }> = [
    { key: 'posts', label: 'Posts' },
    { key: 'replies', label: 'Replies' },
    { key: 'likes', label: 'Likes' },
    { key: 'live', label: 'Live', icon: Radio },
  ];

  return (
    <div className={`snaplink-profile-page min-h-screen ${activeTheme ? `profile-themed bg-gradient-to-b ${activeTheme.bg} ${isLightTheme ? 'text-slate-900' : 'text-white'}` : 'bg-transparent'}`}>
      <div className={`snaplink-profile-topbar sticky top-0 z-10 border-b ${activeTheme ? `border-white/10 ${activeTheme.surface}` : 'border-slate-200/80 bg-[rgba(248,250,252,0.82)] dark:border-slate-800/80 dark:bg-[rgba(2,6,23,0.84)]'} px-4 py-2 backdrop-blur-md`}>
        <div className="snaplink-profile-shell flex items-center space-x-6">
        <Link to="/" className={`rounded-full p-2 ${activeTheme ? 'hover:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} transition-colors`}>
          <ArrowLeft className={`h-5 w-5 ${primaryTextClass}`} />
        </Link>
        <div>
          <h1 className={`text-xl font-bold leading-tight ${primaryTextClass}`}>{profile.displayName}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <p className={`text-xs ${secondaryTextClass}`}>{posts.length} posts</p>
            <LevelBadge level={levelState.level} compact />
          </div>
        </div>
        </div>
      </div>

      <div className="snaplink-profile-shell">
        <div 
          className="h-36 w-full rounded-b-[28px] bg-gray-200 relative sm:h-56"
          style={resolvedBannerUrl ? { backgroundImage: `url(${resolvedBannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        />
        <div className="snaplink-profile-section -mt-5 px-4 pb-4 pt-2">
          <div className="flex justify-between items-start">
            <div className="-mt-16 sm:-mt-24 relative inline-block">
              {profile.isPremium ? (
                <div className="relative">
                  {/* Animated Glow Wrapper */}
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-yellow-400/40 blur-2xl z-0"
                  />
                  
                  {/* Rotating Shine */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-8px] rounded-full border-2 border-dashed border-yellow-400/30 z-5"
                  />

                    <motion.button
                      type="button"
                      onClick={() => hasProfileStory && setIsStoryViewerOpen(true)}
                      animate={{ 
                        boxShadow: [
                          "0 0 0px rgba(234, 179, 8, 0)",
                        "0 0 36px rgba(234, 179, 8, 0.55)",
                        "0 0 0px rgba(234, 179, 8, 0)"
                      ]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className={`rounded-full relative z-10 ${hasProfileStory ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <Avatar
                        src={profile.photoURL}
                        alt={profile.displayName}
                        className={`h-32 w-32 border-4 relative z-10 ${getAvatarDecorationClass(resolvedProfileDecoration, activeTheme ? 'border-white/80' : 'border-white')}`}
                        storyActive={hasProfileStory}
                        storyUnseen={Boolean(profileStoryGroup?.hasUnseen)}
                      />
                      <div className="absolute -top-2 -right-2 bg-slate-950/85 text-white p-1.5 rounded-full z-30 shadow-lg border border-amber-300/60 backdrop-blur-sm">
                        <PremiumBadge className="h-6 w-6" />
                      </div>
                    </motion.button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => hasProfileStory && setIsStoryViewerOpen(true)}
                    className={hasProfileStory ? 'rounded-full cursor-pointer' : 'rounded-full cursor-default'}
                  >
                    <Avatar
                      src={profile.photoURL}
                      alt={profile.displayName}
                      className={`h-32 w-32 border-4 relative z-10 ${getAvatarDecorationClass(resolvedProfileDecoration, activeTheme ? 'border-white/80' : 'border-white')}`}
                      storyActive={hasProfileStory}
                      storyUnseen={Boolean(profileStoryGroup?.hasUnseen)}
                    />
                  </button>
                )}
              {/* Activity Status Dot */}
              <span className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-white z-30 ${getStatusDotClass(visibleStatus)}`} />
            </div>
            <div className="snaplink-mobile-profile-actions relative mt-4 flex w-full flex-wrap items-center gap-2">
              {showMenu && (
                <div className={`absolute right-0 top-12 rounded-xl shadow-lg overflow-hidden z-20 w-48 ${activeTheme ? `${activeTheme.surfaceSoft} border border-white/10 backdrop-blur-xl` : 'bg-white border border-gray-100'}`}>
                  <button 
                    onClick={() => { setIsReportModalOpen(true); setShowMenu(false); }}
                    className={`w-full text-left px-4 py-3 flex items-center transition-colors ${activeTheme ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report Profile
                  </button>
                  <button
                    onClick={handleToggleBlock}
                    disabled={isBlockActionLoading}
                    className={`w-full text-left px-4 py-3 flex items-center transition-colors disabled:opacity-60 ${activeTheme ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    {isBlockedProfile ? 'Unblock User' : 'Block User'}
                  </button>
                </div>
              )}
              
              {!isOwnProfile && (
                <div className="snaplink-profile-menu-row">
                  <button 
                    onClick={() => setShowMenu(!showMenu)}
                    className={`p-2 border rounded-full transition-colors ${activeTheme ? 'border-white/15 hover:bg-white/10 text-white' : 'border-gray-300 hover:bg-gray-50'}`}
                  >
                    <MoreHorizontal className={`h-5 w-5 ${activeTheme ? 'text-white' : 'text-gray-700'}`} />
                  </button>
                </div>
              )}
              
              {isOwnProfile ? (
                <div className="snaplink-profile-button-row flex w-full flex-wrap gap-2 sm:w-auto">
                    <Button variant="outline" className={`min-h-[44px] flex-1 font-bold sm:flex-none ${activeTheme ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : ''}`} onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      navigator.share({ title: `${profile.displayName}'s Profile`, url }).catch(() => {
                        navigator.clipboard.writeText(url);
                        alert('Profile link copied!');
                      });
                    } else {
                      navigator.clipboard.writeText(url);
                      alert('Profile link copied!');
                    }
                  }}>Share</Button>
                    <Button variant="outline" className={`min-h-[44px] flex-1 font-bold sm:flex-none ${activeTheme ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : ''}`} onClick={handleEditProfile}>Edit profile</Button>
                </div>
              ) : (
                <div className="snaplink-profile-button-row flex w-full flex-wrap gap-2 sm:w-auto">
                    <Button variant="outline" className={`min-h-[44px] flex-1 font-bold sm:flex-none ${activeTheme ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : ''}`} onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      navigator.share({ title: `${profile.displayName}'s Profile`, url }).catch(() => {
                        navigator.clipboard.writeText(url);
                        alert('Profile link copied!');
                      });
                    } else {
                      navigator.clipboard.writeText(url);
                      alert('Profile link copied!');
                    }
                  }}>Share</Button>
                    {isBlockedProfile ? (
                      <Button
                        variant="outline"
                        className={`min-h-[44px] flex-1 font-bold sm:min-w-[120px] sm:flex-none ${activeTheme ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : ''}`}
                        onClick={handleToggleBlock}
                        disabled={isBlockActionLoading}
                      >
                        Unblock
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant={isFollowing ? 'outline' : 'default'} 
                          className={`min-h-[44px] flex-1 font-bold sm:min-w-[100px] sm:flex-none ${activeTheme && isFollowing ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : ''}`}
                          onClick={handleFollow}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </Button>
                        {canMessageProfile && (
                          <Button
                            variant="outline"
                            className={`min-h-[44px] flex-1 gap-2 rounded-full px-4 py-2 font-bold sm:flex-none ${activeTheme ? 'border-white/15 bg-white/10 text-white hover:bg-white/15' : ''}`}
                            onClick={handleChat}
                          >
                            <Mail className="h-5 w-5" />
                            <span>Message</span>
                          </Button>
                        )}
                      </>
                    )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <h2 className={`text-xl font-extrabold flex items-center ${primaryTextClass}`}>
              {profile.displayName}
              {profile.isVerified && <VerificationBadge className="ml-1 w-5 h-5" />}
              {profile.isPremium && <PremiumBadge className="h-5 w-5 ml-1" />}
              <UserBadges badges={profile.badges} hiddenBadges={profile.hiddenBadges} badgeSize="w-5 h-5" />
            </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => isOwnProfile && setShowLevelPanel(true)}
                className={`${isOwnProfile ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'} transition-transform`}
              >
                <LevelBadge level={levelState.level} />
              </button>
              <p className={secondaryTextClass}>@{profile.username}</p>
              {isBusinessProfile && (
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${activeTheme ? 'border border-white/15 bg-white/10 text-white' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'}`}>
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  Business
                </span>
              )}
              {primaryBusinessAffiliation && (
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${activeTheme ? 'border border-white/15 bg-white/10 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {primaryBusinessAffiliation.badgeLabel}
                </span>
              )}
                {isFollowedBy && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pillClass}`}>Follows you</span>}
                {hasProfileStory && (
                  <button
                    type="button"
                    onClick={() => setIsStoryViewerOpen(true)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                      activeTheme ? 'border border-white/15 bg-white/10 text-white' : 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300'
                    }`}
                  >
                    Story live
                  </button>
                )}
              </div>
            {isOwnProfile && (
              <div className={`mt-3 rounded-2xl border px-4 py-3 ${activeTheme ? 'border-white/10 bg-white/8' : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/70'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${secondaryTextClass}`}>Level Progress</p>
                    <p className={`text-sm font-semibold ${primaryTextClass}`}>Level {levelState.level} of {MAX_LEVEL}</p>
                  </div>
                  <p className={`text-sm font-bold ${primaryTextClass}`}>{levelState.xp} / {levelState.xpForNextLevel || 0} XP</p>
                </div>
                <div className={`mt-3 h-2.5 rounded-full ${activeTheme ? 'bg-white/12' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(levelState.progressRatio, 0.04) * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
                  />
                </div>
              </div>
            )}
            {!isOwnProfile && (
              <div className="mt-0.5 space-y-1">
                <p className={`text-xs ${getStatusTextClass(visibleStatus)}`}>
                  {`● ${getStatusLabel(visibleStatus)}`}
                  {visibleStatus !== 'online' && statusTimestamp
                    ? ` · set ${formatDistanceToNow(new Date(statusTimestamp), { addSuffix: true })}`
                    : ''}
                </p>
                {canSeeActualPresence && (
                  <p className={`text-[11px] ${getStatusTextClass(actualPresenceStatus)}`}>
                    Admin view: {getStatusLabel(actualPresenceStatus)}
                    {profile.lastSeen ? ` · active ${formatDistanceToNow(new Date(profile.lastSeen), { addSuffix: true })}` : ''}
                  </p>
                )}
              </div>
            )}
            {false && !isOwnProfile && profile.activityStatus && profile.activityStatus !== 'invisible' && (() => {
              // If idle but lastSeen > 5 min ago, show as offline
              const lastSeenDate = profile.lastSeen ? new Date(profile.lastSeen) : null;
              const minutesAgo = lastSeenDate ? (Date.now() - lastSeenDate.getTime()) / 60000 : Infinity;
              const effectiveStatus = (profile.activityStatus === 'idle' && minutesAgo > 5) ? 'offline' : profile.activityStatus;
              
              return (
              <p className={`text-xs mt-0.5 ${
                effectiveStatus === 'online' ? 'text-green-500' :
                effectiveStatus === 'idle' ? 'text-yellow-600' :
                effectiveStatus === 'dnd' ? 'text-red-500' : 'text-gray-400'
              }`}>
                {effectiveStatus === 'online' ? '● Online' :
                 effectiveStatus === 'idle' ? '● Idle' :
                 effectiveStatus === 'dnd' ? '● Do Not Disturb' : '● Offline'}
                {effectiveStatus !== 'online' && profile.lastSeen && 
                  ` · Last seen ${formatDistanceToNow(new Date(profile.lastSeen), { addSuffix: true })}`
                }
              </p>
              );
            })()}
            {profile.bio && <p className={`mt-3 whitespace-pre-wrap ${bodyTextClass}`}>{profile.bio}</p>}
            {(featuredWebsiteUrl || Object.keys(profileSocialLinks).length > 0) && (
              <div className="mt-4 space-y-3">
                {featuredWebsiteUrl && (
                  <a
                    href={featuredWebsiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-transform hover:-translate-y-0.5 ${activeTheme ? 'border-white/10 bg-white/6 hover:bg-white/10' : 'border-gray-200 bg-white/80 hover:bg-white dark:border-gray-800 dark:bg-gray-800/80 dark:hover:bg-gray-800'}`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${secondaryTextClass}`}>Website</p>
                      <p className={`truncate text-sm font-semibold ${primaryTextClass}`}>{new URL(featuredWebsiteUrl).hostname.replace(/^www\./, '')}</p>
                    </div>
                  </a>
                )}
                {Object.keys(profileSocialLinks).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(profileSocialLinks) as Array<[SocialLinkKey, string]>).map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${activeTheme ? 'border-white/10 bg-white/6 text-white hover:bg-white/10' : 'border-gray-200 bg-white/90 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                      >
                        {socialIconMap[key]}
                        <span>{socialLabelMap[key]}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            {profile.businessAffiliations && profile.businessAffiliations.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${secondaryTextClass}`}>Affiliations</p>
                <div className="flex flex-wrap gap-2">
                  {profile.businessAffiliations.map((affiliation) => (
                    <span
                      key={`${affiliation.businessUid}-${affiliation.badgeLabel}`}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${activeTheme ? 'border-white/10 bg-white/8 text-white' : 'border-gray-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}
                    >
                      <Handshake className="h-3.5 w-3.5 text-emerald-500" />
                      {affiliation.badgeLabel} · {affiliation.businessName}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {isBlockedProfile && (
              <div className={`mt-4 rounded-2xl border px-4 py-4 ${activeTheme ? 'border-white/10 bg-white/10 text-white' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100'}`}>
                You blocked this account. Their posts, live content, and messages stay covered until you unblock them.
              </div>
            )}
          </div>
          <div className={`mt-3 flex items-center space-x-1 ${secondaryTextClass}`}>
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Joined {format(new Date(profile.createdAt), 'MMMM yyyy')}</span>
          </div>
          <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm ${subtleTextClass}`}>
            <div className="flex space-x-1 hover:underline cursor-pointer" onClick={() => handleOpenFollowModal('following')}>
              <span className="font-bold">{profile.followingCount}</span>
              <span className={activeTheme ? '' : 'text-gray-500 dark:text-gray-400'}>Following</span>
            </div>
            <div className="flex space-x-1 hover:underline cursor-pointer" onClick={() => handleOpenFollowModal('followers')}>
              <span className="font-bold">{profile.followersCount}</span>
              <span className={activeTheme ? '' : 'text-gray-500 dark:text-gray-400'}>Followers</span>
            </div>
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <div className="snaplink-profile-shell mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          {isBusinessProfile && (
            <section className="snaplink-profile-section p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">Business studio</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                    {profile.businessName || profile.displayName}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                    Send up to {BUSINESS_AFFILIATION_LIMIT} affiliation invites and publish sponsored posts that appear lightly in the home feed for non-Plus members.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-right dark:border-blue-400/20 dark:bg-blue-500/10">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Active slots</div>
                  <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                    {affiliatedProfiles.length} / {BUSINESS_AFFILIATION_LIMIT}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-blue-500" />
                    <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Affiliation badges</h4>
                  </div>
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={businessSearchQuery}
                      onChange={(event) => setBusinessSearchQuery(event.target.value)}
                      placeholder="Search a profile to affiliate..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    {businessSearchResults.length > 0 && (
                      <div className="space-y-2">
                        {businessSearchResults.map((candidate) => (
                          <div key={candidate.uid} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                            <div className="flex items-center gap-3">
                              <Avatar src={candidate.photoURL} alt={candidate.displayName} size="sm" />
                              <div>
                                <p className="text-sm font-bold text-slate-950 dark:text-white">{candidate.displayName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">@{candidate.username}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="rounded-full"
                              disabled={inviteBusyUserId === candidate.uid}
                              onClick={() => handleSendBusinessInvite(candidate)}
                            >
                              <Send className="mr-1 h-3.5 w-3.5" />
                              {inviteBusyUserId === candidate.uid ? 'Sending...' : 'Send'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Badge label in use: <span className="font-black text-slate-900 dark:text-white">{profile.businessBadgeLabel || getBusinessBadgeLabel(profile)}</span>
                    </div>
                  </div>

                  {affiliatedProfiles.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Affiliated accounts</p>
                      {affiliatedProfiles.slice(0, 5).map((entry) => (
                        <div key={entry.uid} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 dark:bg-slate-950">
                          <div>
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">{entry.displayName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">@{entry.username}</p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            Live
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-blue-500" />
                      <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Sponsored posts</h4>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                      Hidden for Plus
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={adTitle}
                      onChange={(event) => setAdTitle(event.target.value)}
                      placeholder="Ad title"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <textarea
                      value={adDescription}
                      onChange={(event) => setAdDescription(event.target.value)}
                      placeholder="Describe the promotion"
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <input
                      type="url"
                      value={adLinkUrl}
                      onChange={(event) => setAdLinkUrl(event.target.value)}
                      placeholder="https://your-link.com"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => adFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        <ImagePlus className="h-4 w-4" />
                        Add image or video
                      </button>
                      {adMediaPreview ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAdMediaFile(null);
                            setAdMediaPreview(null);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300"
                        >
                          <X className="h-4 w-4" />
                          Remove media
                        </button>
                      ) : null}
                    </div>
                    <input
                      ref={adFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setAdMediaFile(file);
                        setAdMediaPreview(URL.createObjectURL(file));
                      }}
                    />
                    {adMediaPreview ? (
                      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                        {adMediaFile?.type.startsWith('video/') ? (
                          <video className="h-52 w-full object-cover" controls>
                            <source src={adMediaPreview} />
                          </video>
                        ) : (
                          <img src={adMediaPreview} alt="Ad preview" className="h-52 w-full object-cover" />
                        )}
                      </div>
                    ) : null}
                    <Button className="w-full rounded-full" disabled={isSavingAd} onClick={handleCreateAd}>
                      {isSavingAd ? 'Publishing ad...' : 'Create sponsored post'}
                    </Button>
                  </div>

                  {businessAds.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Live campaigns</p>
                      {businessAds.slice(0, 4).map((ad) => (
                        <div key={ad.id} className="rounded-2xl bg-white px-3 py-3 dark:bg-slate-950">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-950 dark:text-white">{ad.title}</p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{ad.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleAdState(ad)}
                              className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${
                                ad.isActive
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {ad.isActive ? 'Live' : 'Paused'}
                            </button>
                          </div>
                          <a
                            href={ad.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-500 hover:text-blue-600"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open destination
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {isOwnProfile && incomingBusinessInvites.length > 0 && (
            <section className="snaplink-profile-section p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">Invites</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Pending business requests</h3>
              <div className="mt-4 space-y-3">
                {incomingBusinessInvites
                  .filter((invite) => invite.status === 'pending')
                  .slice(0, 5)
                  .map((invite) => (
                    <div key={invite.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-black text-slate-950 dark:text-white">{invite.businessName}</p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Invited you to display the <span className="font-bold text-slate-900 dark:text-white">{invite.badgeLabel}</span> badge on your profile.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="rounded-full" onClick={() => handleRespondToBusinessInvite(invite, 'accepted')}>
                            <CheckCheck className="mr-1 h-3.5 w-3.5" />
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleRespondToBusinessInvite(invite, 'declined')}>
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {!isBlockedProfile && canViewPrivateProfile && (
      <div className={`snaplink-profile-shell mt-4 flex border-b relative z-10 overflow-hidden rounded-[26px] ${activeTheme ? 'border-white/10 bg-white/5 backdrop-blur-md' : 'border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/88'}`}>
        {profileTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              type="button"
              className={`flex-1 cursor-pointer py-4 text-center transition-colors ${
                activeTheme
                  ? isActive
                    ? 'bg-white/10'
                    : 'hover:bg-white/6'
                  : isActive
                    ? 'bg-gray-50 dark:bg-gray-800/70'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800/40'
              }`}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'live') fetchUserStreams();
              }}
            >
              <span
                className={`inline-flex items-center justify-center gap-1.5 border-b-4 pb-4 font-bold transition-colors ${
                  isActive ? primaryTextClass : secondaryTextClass
                }`}
                style={{ borderColor: isActive ? (activeTheme?.accent ?? '#3b82f6') : 'transparent' }}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      )}

      <div className={`snaplink-profile-shell ${activeTheme ? 'sl-themed-post-area' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={activeTheme ? `rounded-t-3xl ${activeTheme.surface} backdrop-blur-xl` : ''}
          >
            {isBlockedProfile ? (
              <div className={`m-4 rounded-2xl p-8 text-center ${themedEmptyStateClass}`}>Unblock this user to view their posts and live history.</div>
            ) : !canViewPrivateProfile ? (
              <div className={`m-4 rounded-2xl p-8 text-center ${themedEmptyStateClass}`}>
                <EyeOff className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <h3 className="text-lg font-black">This profile is private</h3>
                <p className="mx-auto mt-2 max-w-md text-sm opacity-75">
                  Follow @{profile.username} to see their profile posts, replies, likes, and live history here.
                </p>
              </div>
            ) : activeTab === 'posts' && (
              posts.length > 0 ? (
                posts.map(post => <PostItem key={post.id} post={post} />)
              ) : (
                <div className={`m-4 p-8 text-center ${themedEmptyStateClass}`}>No posts yet.</div>
              )
            )}
            {canViewPrivateProfile && activeTab === 'replies' && (
              replies.length > 0 ? (
                replies.map(post => <PostItem key={post.id} post={post} />)
              ) : (
                <div className={`m-4 p-8 text-center ${themedEmptyStateClass}`}>No replies yet.</div>
              )
            )}
            {canViewPrivateProfile && activeTab === 'likes' && (
              likedPosts.length > 0 ? (
                likedPosts.map(post => <PostItem key={post.id} post={post} />)
              ) : (
                <div className={`m-4 p-8 text-center ${themedEmptyStateClass}`}>No liked posts yet.</div>
              )
            )}
            {canViewPrivateProfile && activeTab === 'live' && (
              userStreams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  {userStreams.map((stream) => (
                    <div key={stream.id} className={`${themedCardClass} rounded-2xl shadow-sm overflow-hidden`}>
                      <div className="aspect-video bg-gray-900 relative flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                        <Video className="h-10 w-10 text-gray-700 relative z-10" />
                        {stream.isLive ? (
                          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-white mr-1 animate-pulse" />
                            LIVE
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center z-10">
                            <Clock className="h-3 w-3 mr-1" />
                            {stream.duration ? `${Math.floor(stream.duration / 60)}:${(stream.duration % 60).toString().padStart(2, '0')}` : 'Ended'}
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center z-10">
                          <Users className="h-3 w-3 mr-1" />
                          {stream.viewers || 0}
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center z-10">
                          <Heart className="h-3 w-3 mr-1" />
                          {stream.likes || 0}
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className={`font-bold text-sm line-clamp-1 ${primaryTextClass}`}>{stream.title}</h3>
                        <p className={`text-xs mt-0.5 ${secondaryTextClass}`}>
                          {stream.createdAt?.toDate ? format(stream.createdAt.toDate(), 'MMM d, yyyy') : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`m-4 p-8 text-center ${themedEmptyStateClass}`}>
                  <Radio className={`h-10 w-10 mx-auto mb-2 ${activeTheme ? secondaryTextClass : 'text-gray-300 dark:text-gray-600'}`} />
                  <p>No live streams yet.</p>
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {isOwnProfile && blockedProfiles.length > 0 && (
        <div className="snaplink-profile-shell mt-4">
        <div className="snaplink-profile-section p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">Privacy</p>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Blocked Users</h3>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {blockedProfiles.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {blockedProfiles.map((blockedProfile) => (
              <div key={blockedProfile.uid} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 px-3 py-3 dark:border-gray-800">
                <button type="button" onClick={() => navigate(`/profile/${blockedProfile.uid}`)} className="flex min-w-0 items-center gap-3 text-left">
                  <Avatar src={blockedProfile.photoURL} alt={blockedProfile.displayName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{blockedProfile.displayName}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">@{blockedProfile.username}</p>
                  </div>
                </button>
                <Button variant="outline" className="rounded-full px-4" onClick={async () => {
                  await updateDoc(doc(db, 'users', userProfile!.uid), {
                    blockedUserIds: (userProfile?.blockedUserIds || []).filter((uid) => uid !== blockedProfile.uid),
                  });
                }}>
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white dark:bg-gray-900"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/92">
                <div className="flex items-center space-x-4">
                  <button onClick={() => setIsEditing(false)} className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="h-5 w-5 dark:text-white" />
                  </button>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit profile</h2>
                </div>
                <Button onClick={handleSaveProfile} disabled={isSaving} className="font-bold rounded-full px-6">
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              
              <div className="overflow-y-auto pb-8">
                {/* Banner Edit */}
                <div 
                  className="relative flex h-32 w-full items-center justify-center bg-gray-200 dark:bg-gray-800 sm:h-48"
                  style={editBannerPreview ? { backgroundImage: `url(${editBannerPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                >
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="relative z-10 flex space-x-4">
                    <button 
                      onClick={() => bannerInputRef.current?.click()}
                      className="p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                      <Camera className="h-6 w-6" />
                    </button>
                    {editBannerPreview && (
                      <button 
                        onClick={() => { setEditBanner('remove' as any); setEditBannerPreview(null); }}
                        className="p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={bannerInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditBanner(e.target.files[0]);
                        setEditBannerPreview(URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                  />
                </div>

                {/* Avatar Edit */}
                <div className="px-4 relative">
                  <div className="-mt-16 sm:-mt-24 relative inline-block">
                    <Avatar
                      src={editPhotoPreview || undefined}
                      alt="Edit Avatar"
                      className={`h-32 w-32 border-4 ${getAvatarDecorationClass(editProfileDecoration, 'border-white')}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full border-4 border-white space-x-2">
                      <button 
                        onClick={() => photoInputRef.current?.click()}
                        className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                      >
                        <Camera className="h-5 w-5" />
                      </button>
                      {editPhotoPreview && (
                        <button 
                          onClick={() => { setEditPhoto('remove' as any); setEditPhotoPreview(null); }}
                          className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={photoInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setEditPhoto(e.target.files[0]);
                          setEditPhotoPreview(URL.createObjectURL(e.target.files[0]));
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Avatar Customizer + Quick Selection */}
                <div className="px-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avatar</h4>
                    <button
                      onClick={() => setShowAvatarCustomizer(true)}
                      className="flex items-center space-x-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full transition-colors"
                    >
                      <Palette className="h-3.5 w-3.5" />
                      <span>Customize Avatar</span>
                    </button>
                  </div>
                  <div className="flex overflow-x-auto space-x-2 pb-2 no-scrollbar">
                    {['avataaars', 'fun-emoji', 'bottts', 'pixel-art', 'lorelei', 'adventurer'].flatMap((style, si) =>
                      Array.from({ length: 4 }, (_, i) => {
                        const seed = `${style}_edit_${si}_${i}`;
                        const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
                        return (
                          <img
                            key={seed}
                            src={url}
                            alt={`Avatar ${si * 4 + i}`}
                            className={`h-12 w-12 rounded-full cursor-pointer border-2 shrink-0 transition-all hover:scale-110 ${
                              (editPhotoPreview || profile?.photoURL) === url 
                                ? 'border-blue-500 ring-2 ring-blue-500/20' 
                                : 'border-transparent hover:border-gray-300'
                            }`}
                            onClick={() => {
                              setEditPhotoPreview(url);
                              setEditPhoto(null);
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="px-4 mt-4 space-y-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                    <textarea
                      className="w-full resize-none rounded-md border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      rows={4}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      maxLength={160}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Website</label>
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="url"
                        className={`w-full rounded-md border bg-white p-3 pl-10 text-gray-900 outline-none transition focus:ring-2 focus:ring-blue-500 dark:bg-gray-950 dark:text-white ${editLinkErrors.websiteUrl ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-blue-500 dark:border-gray-700'}`}
                        value={editWebsiteUrl}
                        onChange={(e) => {
                          setEditWebsiteUrl(e.target.value);
                          setEditLinkErrors((prev) => ({ ...prev, websiteUrl: undefined }));
                        }}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                    {editLinkErrors.websiteUrl && <p className="mt-1 text-xs font-medium text-red-500">{editLinkErrors.websiteUrl}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      ['x', 'X / Twitter', 'https://x.com/yourname'],
                      ['instagram', 'Instagram', 'https://instagram.com/yourname'],
                      ['tiktok', 'TikTok', 'https://tiktok.com/@yourname'],
                      ['youtube', 'YouTube', 'https://youtube.com/@yourname'],
                      ['discord', 'Discord', 'https://discord.gg/yourinvite'],
                    ] as Array<[SocialLinkKey, string, string]>).map(([key, label, placeholder]) => (
                      <div key={key}>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                        <input
                          type="url"
                          className={`w-full rounded-md border bg-white p-3 text-gray-900 outline-none transition focus:ring-2 focus:ring-blue-500 dark:bg-gray-950 dark:text-white ${editLinkErrors[key] ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-blue-500 dark:border-gray-700'}`}
                          value={editSocialLinks[key] || ''}
                          onChange={(e) => {
                            setEditSocialLinks((prev) => ({ ...prev, [key]: e.target.value }));
                            setEditLinkErrors((prev) => ({ ...prev, [key]: undefined }));
                          }}
                          placeholder={placeholder}
                        />
                        {editLinkErrors[key] && <p className="mt-1 text-xs font-medium text-red-500">{editLinkErrors[key]}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-400/20 dark:bg-blue-500/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <BriefcaseBusiness className="h-4 w-4 text-blue-500" />
                          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Business account</h3>
                        </div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          Turn this profile into a business page so you can send affiliation badges and publish promoted posts.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditIsBusinessAccount((prev) => !prev)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                          editIsBusinessAccount ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 rounded-full bg-white transition ${editIsBusinessAccount ? 'translate-x-7' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>

                    {editIsBusinessAccount && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Business name</label>
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            value={editBusinessName}
                            onChange={(e) => setEditBusinessName(e.target.value)}
                            placeholder="SnapLink Studio"
                            maxLength={80}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            value={editBusinessCategory}
                            onChange={(e) => setEditBusinessCategory(e.target.value)}
                            placeholder="Creator, brand, studio..."
                            maxLength={60}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Affiliation badge label</label>
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-300 bg-white p-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            value={editBusinessBadgeLabel}
                            onChange={(e) => setEditBusinessBadgeLabel(e.target.value)}
                            placeholder="Official partner"
                            maxLength={40}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                   {/* Badge Visibility Section */}
                   {profile.badges && profile.badges.length > 0 && (
                   <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
                     <h3 className="mb-1 flex items-center text-lg font-bold text-gray-900 dark:text-white">
                         <Award className="h-5 w-5 mr-2 text-purple-500" /> My Badges
                       </h3>
                       <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Choose which badges are visible on your profile.</p>
                       <div className="space-y-2">
                         {profile.badges.map(badge => {
                           const isHidden = editHiddenBadges.includes(badge.id);
                           return (
                             <div
                               key={badge.id}
                               onClick={() => {
                                 setEditHiddenBadges(prev =>
                                   isHidden ? prev.filter(id => id !== badge.id) : [...prev, badge.id]
                                 );
                               }}
                               className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                 isHidden 
                                   ? 'border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/70' 
                                   : 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20'
                               }`}
                             >
                               <div className="flex items-center space-x-3">
                                 <img src={badge.imageURL} alt={badge.name} className="h-8 w-8 rounded-full object-cover" />
                                   <span className={`text-sm font-semibold ${isHidden ? 'text-gray-400' : 'text-gray-800 dark:text-white'}`}>{badge.name}</span>
                               </div>
                               {isHidden ? (
                                 <div className="flex items-center space-x-1.5 text-gray-400">
                                   <EyeOff className="h-4 w-4" />
                                   <span className="text-xs font-medium">Hidden</span>
                                 </div>
                               ) : (
                                 <div className="flex items-center space-x-1.5 text-purple-600">
                                   <Eye className="h-4 w-4" />
                                   <span className="text-xs font-medium">Visible</span>
                                 </div>
                               )}
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   )}

                   {/* Decorations Section */}
                   <div className="border-t border-gray-200 pt-6 dark:border-gray-800">
                     <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Decorations & Wallpapers</h3>
                    
                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Avatar Decorations</h4>
                      <div className="flex space-x-4 overflow-x-auto pb-2">
                        <div 
                          className={`flex-shrink-0 w-16 h-16 rounded-full border-4 cursor-pointer flex items-center justify-center bg-gray-100 ${editProfileDecoration === null ? 'border-blue-500' : 'border-transparent'}`}
                          onClick={() => setEditProfileDecoration(null)}
                        >
                          <X className="h-6 w-6 text-gray-400" />
                        </div>
                        {ownedAvatarDecorations.map(item => (
                          <div 
                            key={item.id}
                            className={`flex-shrink-0 w-16 h-16 rounded-full border-4 cursor-pointer ${getAvatarDecorationClass(item.url, 'border-white')} ${editProfileDecoration === item.url ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                            onClick={() => setEditProfileDecoration(item.url)}
                          />
                        ))}
                      </div>
                      {ownedAvatarDecorations.length === 0 && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">You only see avatar decorations you actually own.</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Wallpapers</h4>
                      <div className="flex space-x-4 overflow-x-auto pb-2">
                        <div 
                          className={`flex-shrink-0 w-24 h-16 rounded-lg border-2 cursor-pointer flex items-center justify-center bg-gray-100 ${editBannerPreview === null ? 'border-blue-500' : 'border-transparent'}`}
                          onClick={() => { setEditBanner('remove' as any); setEditBannerPreview(null); }}
                        >
                          <X className="h-6 w-6 text-gray-400" />
                        </div>
                        {ownedWallpaperItems.map(item => (
                          <img 
                            key={item.id}
                            src={item.url}
                            alt={item.name}
                            className={`flex-shrink-0 w-24 h-16 rounded-lg object-cover cursor-pointer border-2 ${editBannerPreview === item.url ? 'border-blue-500' : 'border-transparent'}`}
                            onClick={() => { setEditBanner(null); setEditBannerPreview(item.url); }}
                          />
                        ))}
                      </div>
                      {ownedWallpaperItems.length === 0 && (
                        <p className="mt-2 text-xs text-gray-500">Only wallpapers you bought or unlocked appear here.</p>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mb-4">Get more decorations and wallpapers in the Shop.</p>
                    <Button variant="outline" className="w-full" onClick={() => { setIsEditing(false); navigate('/shop'); }}>
                      Go to Shop
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Follow Modal */}
      <AnimatePresence>
        {showFollowModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold capitalize">{showFollowModal}</h2>
                <button onClick={() => setShowFollowModal(null)} className="p-2 rounded-full hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-4">
                {loadingFollows ? (
                  <div className="flex justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : followList.length > 0 ? (
                  <div className="space-y-4">
                    {followList.map(user => (
                      <div key={user.uid} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors" onClick={() => { setShowFollowModal(null); navigate(`/profile/${user.uid}`); }}>
                        <Avatar src={user.photoURL} alt={user.displayName} />
                        <div>
                          <div className="font-bold flex items-center">
                            {user.displayName}
                            {user.isVerified && <VerificationBadge className="ml-1 w-4 h-4" />}
                            <UserBadges badges={user.badges} hiddenBadges={user.hiddenBadges} badgeSize="w-4 h-4" />
                            <LevelBadge level={user.level || 1} compact className="ml-2" />
                          </div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No {showFollowModal} yet.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLevelPanel && isOwnProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              className="w-full max-w-md overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-500">Your Progress</p>
                  <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Level {levelState.level}</h3>
                </div>
                <button onClick={() => setShowLevelPanel(false)} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-[24px] border border-blue-100 bg-blue-50 p-4 dark:border-blue-400/20 dark:bg-blue-500/10">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-200">You are currently on level {levelState.level} and the max level is {MAX_LEVEL}.</p>
                  <p className="mt-2 text-sm text-blue-600/90 dark:text-blue-100/75">Rewards stay hidden until you open the gift box, so it still feels like a surprise.</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>XP to next level</span>
                    <span>{levelState.xpRemaining} XP left</span>
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-gray-200 dark:bg-gray-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(levelState.progressRatio, 0.04) * 100}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{levelState.xp} / {levelState.xpForNextLevel || 0} XP in the current level.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {profile && (
        <ReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          targetId={profile.uid} 
          targetType="user" 
        />
      )}

      <AvatarCustomizer
        isOpen={showAvatarCustomizer}
        onClose={() => setShowAvatarCustomizer(false)}
        onSelect={(url) => {
          setEditPhotoPreview(url);
          setEditPhoto(null);
          setShowAvatarCustomizer(false);
        }}
        currentAvatar={editPhotoPreview || profile?.photoURL}
      />

      <StoryViewer
        isOpen={isStoryViewerOpen}
        onClose={() => setIsStoryViewerOpen(false)}
        groups={profileStoryGroups}
        initialAuthorId={profile.uid}
        viewer={userProfile}
      />
    </div>
  );
}
