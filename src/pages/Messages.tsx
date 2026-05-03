import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, Send, Search, ArrowLeft, MoreHorizontal, Flag, Camera, Image as ImageIcon, X, Phone, Video, Users, Plus, Check, Smile, Pencil } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDocs, where, setDoc, getDoc, limit, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isYesterday } from 'date-fns';
import { ReportModal } from '../components/ui/ReportModal';
import { AvatarStickerPicker } from '../components/ui/AvatarStickerPicker';
import { useCall } from '../contexts/CallContext';
import { updateChallengeProgress } from '../lib/challenges';
import { awardUserProgress } from '../lib/levels';
import { sanitizeStorageFileName, uploadOptimizedImage } from '../lib/storageUploads';
import { createNotificationForUsers } from '../lib/notifications';
import { searchUsersByQuery } from '../lib/userSearch';
import { getReadOnlyReason, isReadOnlyUser } from '../lib/accessControl';

const GIPHY_API_KEY = 'kcCL2LJMFVNJ0S13u0A2q4j1WwM7VXrc';

function getMessageDate(value: any) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate() as Date;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatConversationTime(value: any) {
  const date = getMessageDate(value);
  if (!date) return '';
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

function formatBubbleTime(value: any) {
  const date = getMessageDate(value);
  if (!date) return '';
  return format(date, 'HH:mm');
}

export function Messages() {
  const { userProfile, loading } = useAuth();
  const readOnlyReason = getReadOnlyReason(userProfile);
  const isReadOnlyAccount = isReadOnlyUser(userProfile);
  const blockedUserIds = userProfile?.blockedUserIds || [];
  const location = useLocation();
  const navigate = useNavigate();
  const otherUser = location.state?.otherUser as UserProfile | undefined;
  const [conversations, setConversations] = useState<any[]>([]);
  const [otherUsersCache, setOtherUsersCache] = useState<Record<string, UserProfile>>({});
  const cacheRef = useRef<Record<string, UserProfile>>({});
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [isSavingMessageEdit, setIsSavingMessageEdit] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initiatedRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChatIdRef = useRef<string | null>(null);
  const isTypingRef = useRef(false);
  const [typingUsersMap, setTypingUsersMap] = useState<Record<string, { displayName?: string; isTyping?: boolean; updatedAt?: number }>>({});
  const [typingClock, setTypingClock] = useState(() => Date.now());

  // Global call system
  const { startCall: globalStartCall } = useCall();

  // Group chat state
  const [showCreateGroupChat, setShowCreateGroupChat] = useState(false);
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupChatName, setGroupChatName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [groupBanner, setGroupBanner] = useState<File | null>(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState<string | null>(null);
  const [groupBannerPreview, setGroupBannerPreview] = useState<string | null>(null);

  const cacheUserProfiles = useCallback(async (userIds: Array<string | undefined | null>) => {
    const idsToLoad = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
      .filter((uid) => uid !== userProfile?.uid && !cacheRef.current[uid]);

    if (idsToLoad.length === 0) return;

    const loadedProfiles = await Promise.all(
      idsToLoad.map(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (!userSnap.exists()) return null;
          return [uid, userSnap.data() as UserProfile] as const;
        } catch (error) {
          console.error('Error fetching cached user profile:', uid, error);
          return null;
        }
      })
    );

    const nextEntries = loadedProfiles.reduce<Record<string, UserProfile>>((acc, entry) => {
      if (entry) {
        acc[entry[0]] = entry[1];
      }
      return acc;
    }, {});

    if (Object.keys(nextEntries).length === 0) return;

    cacheRef.current = { ...cacheRef.current, ...nextEntries };
    setOtherUsersCache((prev) => ({ ...prev, ...nextEntries }));
  }, [userProfile?.uid]);

  const getCachedUserProfile = useCallback((uid?: string | null) => {
    if (!uid) return null;
    if (uid === userProfile?.uid && userProfile) return userProfile;
    return otherUsersCache[uid] || cacheRef.current[uid] || null;
  }, [otherUsersCache, userProfile]);

  useEffect(() => {
    if (!showGifPicker) return;

    const fetchGifs = async () => {
      setIsSearchingGifs(true);
      try {
        const endpoint = gifQuery.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(gifQuery)}&limit=18`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=18`;
        const response = await fetch(endpoint);
        const data = await response.json();
        setGifResults(data.data || []);
      } catch (error) {
        console.error('Error fetching GIFs:', error);
      } finally {
        setIsSearchingGifs(false);
      }
    };

    const timeoutId = setTimeout(fetchGifs, 350);
    return () => clearTimeout(timeoutId);
  }, [gifQuery, showGifPicker]);

  // Safety timeout for initial loading
  useEffect(() => {
    if (isInitialLoading) {
      const timer = setTimeout(() => {
        console.warn('Initial loading timeout reached, forcing loading to false');
        setIsInitialLoading(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoading]);

  // Handle missing user profile
  useEffect(() => {
    if (!loading && !userProfile) {
      navigate('/login');
    }
  }, [userProfile, loading, navigate]);

  useEffect(() => {
    if (otherUser && userProfile && initiatedRef.current !== otherUser.uid) {
      if (!activeChat || activeChat.otherUser?.uid !== otherUser.uid) {
        initiatedRef.current = otherUser.uid;
        startChat(otherUser);
        window.history.replaceState({}, document.title);
      }
    }
  }, [otherUser, userProfile, activeChat]);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', userProfile.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(chatDoc => {
        const data = chatDoc.data() as any;
        let updatedAtDate = new Date();
        if (data.updatedAt) {
          if (typeof data.updatedAt.toDate === 'function') {
            updatedAtDate = data.updatedAt.toDate();
          } else {
            updatedAtDate = new Date(data.updatedAt);
          }
        }
        return { id: chatDoc.id, ...data, updatedAt: updatedAtDate };
      });
      
      chatsData.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      setConversations(chatsData);
      setIsInitialLoading(false);
      setLoadError(null);
      
      const relatedUserIds = chatsData.flatMap((chat) => {
        if (chat.isGroupChat) {
          return (chat.participants || []).filter((participantId: string) => participantId !== userProfile.uid);
        }
        const otherUserId = chat.participants.find((id: string) => id !== userProfile.uid);
        return otherUserId ? [otherUserId] : [];
      });

      void cacheUserProfiles(relatedUserIds);
    }, (error) => {
      console.error("Error fetching chats:", error);
      setLoadError("Failed to load conversations. Please try again.");
      setIsInitialLoading(false);
      try { handleFirestoreError(error, OperationType.LIST, 'chats'); } catch(e) {}
    });

    return () => unsubscribe();
  }, [cacheUserProfiles, userProfile?.uid]);

  const enrichedConversations = conversations.map(chat => {
    if (chat.isGroupChat) return { ...chat, otherUser: null };
    const otherUserId = chat.participants.find((id: string) => id !== userProfile?.uid);
    return { ...chat, otherUser: otherUserId ? otherUsersCache[otherUserId] : null };
  });

  const allConversations = enrichedConversations.filter((chat) => {
    if (chat.isGroupChat) return true;
    const otherUserId = chat.otherUser?.uid || chat.participants?.find((id: string) => id !== userProfile?.uid);
    return !blockedUserIds.includes(otherUserId);
  });

  const enrichedActiveChat = activeChat ? {
    ...activeChat,
    otherUser: activeChat.otherUser || (activeChat.participants && !activeChat.isGroupChat ? otherUsersCache[activeChat.participants.find((id: string) => id !== userProfile?.uid) || ''] : null)
  } : null;
  const blockedActiveChatUserId = enrichedActiveChat && !enrichedActiveChat.isGroupChat
    ? enrichedActiveChat.otherUser?.uid || enrichedActiveChat.participants?.find((id: string) => id !== userProfile?.uid)
    : null;
  const isBlockedDirectChat = Boolean(blockedActiveChatUserId && blockedUserIds.includes(blockedActiveChatUserId));

  const clearTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const setOwnTypingState = useCallback(async (chatId: string, isTyping: boolean) => {
    if (!userProfile?.uid || !chatId) return;
    if (typingChatIdRef.current === chatId && isTypingRef.current === isTyping) return;

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`typingUsers.${userProfile.uid}.displayName`]: userProfile.displayName,
        [`typingUsers.${userProfile.uid}.isTyping`]: isTyping,
        [`typingUsers.${userProfile.uid}.updatedAt`]: Date.now(),
      });
      typingChatIdRef.current = isTyping ? chatId : null;
      isTypingRef.current = isTyping;
    } catch (error) {
      console.warn('Failed to update typing status:', error);
    }
  }, [userProfile]);

  const handleMessageChange = useCallback((value: string) => {
    setNewMessage(value);

    if (!activeChat || !userProfile) return;

    const nextIsTyping = value.trim().length > 0;
    clearTypingTimeout();

    if (!nextIsTyping) {
      void setOwnTypingState(activeChat.id, false);
      return;
    }

    if (!isTypingRef.current || typingChatIdRef.current !== activeChat.id) {
      void setOwnTypingState(activeChat.id, true);
    }

    typingTimeoutRef.current = setTimeout(() => {
      void setOwnTypingState(activeChat.id, false);
    }, 1800);
  }, [activeChat, clearTypingTimeout, setOwnTypingState, userProfile]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTypingClock(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const typingEntries = Object.entries(typingUsersMap) as Array<[string, { displayName?: string; isTyping?: boolean; updatedAt?: number }]>;

  const activeTypingUsers = typingEntries
    .filter(([uid, typingData]) => {
      if (uid === userProfile?.uid) return false;
      if (!typingData?.isTyping) return false;
      return typingClock - (typingData.updatedAt || 0) < 5000;
    })
    .map(([uid, typingData]) => ({
      uid,
      displayName: typingData.displayName || 'Someone',
    }));

  const typingLabel = activeTypingUsers.length === 0
    ? ''
    : activeTypingUsers.length === 1
      ? `${activeTypingUsers[0].displayName} is typing...`
      : activeTypingUsers.length === 2
        ? `${activeTypingUsers[0].displayName} and ${activeTypingUsers[1].displayName} are typing...`
        : `${activeTypingUsers[0].displayName} and ${activeTypingUsers.length - 1} others are typing...`;

  useEffect(() => {
    if (!activeChat) return;

    if (activeChat.isGroupChat) {
      void cacheUserProfiles(activeChat.participants || []);
    }

    const q = query(
      collection(db, `chats/${activeChat.id}/messages`),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() };
      });
      setMessages(msgs);
      if (activeChat.isGroupChat) {
        void cacheUserProfiles(msgs.map((message: any) => message.senderId));
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error("Error fetching messages:", error);
      if (error.code === 'failed-precondition') {
        const unorderedQ = query(collection(db, `chats/${activeChat.id}/messages`));
        onSnapshot(unorderedQ, (snapshot) => {
          const msgs = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() };
          });
          msgs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          setMessages(msgs);
          if (activeChat.isGroupChat) {
            void cacheUserProfiles(msgs.map((message: any) => message.senderId));
          }
        });
      } else {
        try { handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`); } catch(e) {}
      }
    });

    return () => unsubscribe();
  }, [activeChat, cacheUserProfiles]);

  useEffect(() => {
    if (!activeChat) {
      setTypingUsersMap({});
      setEditingMessageId(null);
      setEditingMessageText('');
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'chats', activeChat.id), (snapshot) => {
      const data = snapshot.data() as any;
      setTypingUsersMap(data?.typingUsers || {});
    });

    return () => unsubscribe();
  }, [activeChat]);

  useEffect(() => {
    return () => {
      clearTypingTimeout();
      if (typingChatIdRef.current && isTypingRef.current) {
        void setOwnTypingState(typingChatIdRef.current, false);
      }
    };
  }, [clearTypingTimeout, setOwnTypingState]);

  useEffect(() => {
    if (!activeChat?.id && typingChatIdRef.current && isTypingRef.current) {
      void setOwnTypingState(typingChatIdRef.current, false);
      clearTypingTimeout();
      return;
    }

    if (typingChatIdRef.current && activeChat?.id && typingChatIdRef.current !== activeChat.id && isTypingRef.current) {
      void setOwnTypingState(typingChatIdRef.current, false);
      clearTypingTimeout();
    }
  }, [activeChat?.id, clearTypingTimeout, setOwnTypingState]);

  const handleStartCall = (type: 'voice' | 'video') => {
    if (!enrichedActiveChat) return;
    if (isReadOnlyAccount) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }
    const targetUid = enrichedActiveChat.isGroupChat
      ? enrichedActiveChat.id
      : enrichedActiveChat.otherUser?.uid || enrichedActiveChat.participants?.find((id: string) => id !== userProfile?.uid) || '';
    globalStartCall({
      chatId: enrichedActiveChat.id,
      targetUserId: enrichedActiveChat.isGroupChat ? undefined : targetUid,
      displayName: getChatDisplayName(enrichedActiveChat),
      photoURL: getChatAvatar(enrichedActiveChat),
      type,
    });
  };

  // Fetch friends for group chat creation
  const fetchFriends = async () => {
    if (!userProfile) return;
    try {
      // Get users who follow the current user (mutual follow = friend)
      const followingQ = query(collection(db, 'follows'), where('followerId', '==', userProfile.uid));
      const followingSnap = await getDocs(followingQ);
      const followingIds = followingSnap.docs.map(d => d.data().followingId);

      const followers = query(collection(db, 'follows'), where('followingId', '==', userProfile.uid));
      const followersSnap = await getDocs(followers);
      const followerIds = followersSnap.docs.map(d => d.data().followerId);

      // Mutual follows = friends
      const friendIds = followingIds.filter(id => followerIds.includes(id));

      const friends: UserProfile[] = [];
      for (const id of friendIds) {
        const userSnap = await getDoc(doc(db, 'users', id));
        if (userSnap.exists()) friends.push(userSnap.data() as UserProfile);
      }
      setFriendsList(friends);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const handleCreateGroupChat = async () => {
    if (!userProfile || selectedFriends.length === 0 || !groupChatName.trim()) return;

    try {
      const participants = [userProfile.uid, ...selectedFriends];
      const newChatRef = doc(collection(db, 'chats'));

      let groupPhotoURL = '';
      let groupBannerURL = '';

      if (groupPhoto) {
        const uploadedPhoto = await uploadOptimizedImage(
          groupPhoto,
          `group-photos/${newChatRef.id}/photo/${Date.now()}-${sanitizeStorageFileName(groupPhoto.name || 'group-photo.jpg')}`,
          {
            maxWidth: 700,
            maxHeight: 700,
            quality: 0.86,
            allowDataUrlFallback: true,
            preferDataUrl: true,
          }
        );
        groupPhotoURL = uploadedPhoto.url;
      }

      if (groupBanner) {
        const uploadedBanner = await uploadOptimizedImage(
          groupBanner,
          `group-photos/${newChatRef.id}/banner/${Date.now()}-${sanitizeStorageFileName(groupBanner.name || 'group-banner.jpg')}`,
          {
            maxWidth: 1400,
            maxHeight: 700,
            quality: 0.84,
            allowDataUrlFallback: true,
            preferDataUrl: true,
          }
        );
        groupBannerURL = uploadedBanner.url;
      }

      await setDoc(newChatRef, {
        id: newChatRef.id,
        participants,
        isGroupChat: true,
        groupName: groupChatName.trim(),
        groupCreator: userProfile.uid,
        groupPhotoURL,
        groupBannerURL,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastMessage: ''
      });
      setShowCreateGroupChat(false);
      setSelectedFriends([]);
      setGroupChatName('');
      setGroupPhoto(null);
      setGroupBanner(null);
      setGroupPhotoPreview(null);
      setGroupBannerPreview(null);
      setActiveChat({ id: newChatRef.id, participants, isGroupChat: true, groupName: groupChatName.trim(), groupPhotoURL, groupBannerURL, updatedAt: new Date() });
    } catch (error) {
      console.error('Error creating group chat:', error);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const queryText = e.target.value;
    setSearchQuery(queryText);
    
    if (queryText.trim().length > 1) {
      setIsSearching(true);
      try {
        const results = await searchUsersByQuery(queryText, {
          excludeUserIds: userProfile ? [userProfile.uid] : [],
          limit: 16,
        });
        setSearchResults(results.filter((result) => !blockedUserIds.includes(result.uid)));
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const startChat = async (otherUser: UserProfile) => {
    if (!userProfile) return;
    if (blockedUserIds.includes(otherUser.uid)) {
      alert('Unblock this user from your profile before messaging them.');
      return;
    }
    
    if (!cacheRef.current[otherUser.uid]) {
      cacheRef.current[otherUser.uid] = otherUser;
      setOtherUsersCache(prev => ({ ...prev, [otherUser.uid]: otherUser }));
    }

    const existingChat = conversations.find(c => 
      !c.isGroupChat && c.participants.includes(otherUser.uid) && c.participants.includes(userProfile.uid)
    );

    if (existingChat) {
      setActiveChat(existingChat);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    try {
      const [iFollowThem, theyFollowMe] = await Promise.all([
        getDoc(doc(db, 'follows', `${userProfile.uid}_${otherUser.uid}`)),
        getDoc(doc(db, 'follows', `${otherUser.uid}_${userProfile.uid}`)),
      ]);

      if (!iFollowThem.exists() || !theyFollowMe.exists()) {
        alert('You can only start a direct message when both accounts follow each other.');
        return;
      }

      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', userProfile.uid));
      const snapshot = await getDocs(q);
      
      const dbExistingChatDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        return !data.isGroupChat && data.participants.includes(otherUser.uid);
      });

      if (dbExistingChatDoc) {
        const data = dbExistingChatDoc.data();
        let updatedAtDate = new Date();
        if (data.updatedAt) {
          updatedAtDate = typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(data.updatedAt);
        }
        setActiveChat({ id: dbExistingChatDoc.id, ...data, otherUser, updatedAt: updatedAtDate });
        setSearchQuery('');
        setSearchResults([]);
        return;
      }

      const newChatRef = doc(collection(db, 'chats'));
      const newChatData = {
        id: newChatRef.id,
        participants: [userProfile.uid, otherUser.uid],
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastMessage: ''
      };
      await setDoc(newChatRef, newChatData);
      setActiveChat({ ...newChatData, otherUser, updatedAt: new Date() });
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error starting chat:', error);
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGifUrl(null);
      setShowGifPicker(false);
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSelectGif = (selectedGifUrl: string) => {
    setGifUrl(selectedGifUrl);
    setImageFile(null);
    setImagePreview(selectedGifUrl);
    setShowGifPicker(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!newMessage.trim() && !imageFile && !gifUrl) || !activeChat || !userProfile || isSending) return;
    if (isBlockedDirectChat || isReadOnlyAccount) {
      if (isReadOnlyAccount) {
        alert(readOnlyReason || 'Your account is in read-only mode.');
      }
      return;
    }

    const messageText = newMessage.trim();
    const currentImageFile = imageFile;
    const currentGifUrl = gifUrl;

    clearTypingTimeout();
    void setOwnTypingState(activeChat.id, false);
    
    setNewMessage('');
    setImageFile(null);
    setImagePreview(null);
    setGifUrl(null);
    setIsSending(true);

    try {
      const messagesRef = collection(db, `chats/${activeChat.id}/messages`);
      const messageRef = doc(messagesRef);
      let imageURL = '';
      let imageStoragePath: string | null = null;
      if (currentImageFile) {
        const safeFileName = sanitizeStorageFileName(currentImageFile.name || `chat-${Date.now()}.jpg`);
        const uploadedImage = await uploadOptimizedImage(
          currentImageFile,
          `chats/${activeChat.id}/${messageRef.id}/${Date.now()}-${safeFileName}`,
          {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.7,
            timeoutMs: 12000,
            allowDataUrlFallback: true,
            preferDataUrl: currentImageFile.size <= 900000,
          }
        );
        imageURL = uploadedImage.url;
        imageStoragePath = uploadedImage.storagePath;
      } else if (currentGifUrl) {
        imageURL = currentGifUrl;
      }

      await setDoc(messageRef, {
        text: messageText,
        imageURL: imageURL || null,
        imageStoragePath,
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, 'chats', activeChat.id), {
        updatedAt: serverTimestamp(),
        lastMessage: imageURL ? '📷 Image' : messageText
      }, { merge: true });
      const recipientIds = (activeChat.participants || []).filter((participantId: string) => participantId !== userProfile.uid);
      if (recipientIds.length > 0) {
        await createNotificationForUsers(recipientIds, {
          type: 'message',
          title: activeChat.isGroupChat
            ? `${userProfile.displayName} sent a new message in ${activeChat.groupName || 'your group chat'}`
            : `${userProfile.displayName} sent you a message`,
          message: (messageText || (imageURL ? 'Sent a photo' : 'Sent a message')).slice(0, 140),
          sourceUserId: userProfile.uid,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null,
          },
          linkTo: '/messages',
          chatId: activeChat.id,
          dedupeKey: `chat-${activeChat.id}`,
        });
      }

      await awardUserProgress(userProfile.uid, { xp: 4 });
      await updateChallengeProgress(userProfile.uid, 'message_send');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const sendStickerMessage = async (stickerUrl: string) => {
      if (!activeChat || !userProfile) return;
      if (isReadOnlyAccount) {
        alert(readOnlyReason || 'Your account is in read-only mode.');
        return;
      }
      try {
      clearTypingTimeout();
      void setOwnTypingState(activeChat.id, false);
      const messagesRef = collection(db, `chats/${activeChat.id}/messages`);
      await addDoc(messagesRef, {
        text: '',
        imageURL: stickerUrl,
        isSticker: true,
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'chats', activeChat.id), {
        updatedAt: serverTimestamp(),
        lastMessage: '🎭 Sticker'
      }, { merge: true });
      const recipientIds = (activeChat.participants || []).filter((participantId: string) => participantId !== userProfile.uid);
      if (recipientIds.length > 0) {
        await createNotificationForUsers(recipientIds, {
          type: 'message',
          title: activeChat.isGroupChat
            ? `${userProfile.displayName} sent a new message in ${activeChat.groupName || 'your group chat'}`
            : `${userProfile.displayName} sent you a message`,
          message: 'ðŸŽ­ Sticker',
          sourceUserId: userProfile.uid,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null,
          },
          linkTo: '/messages',
          chatId: activeChat.id,
          dedupeKey: `chat-${activeChat.id}`,
        });
      }

      await awardUserProgress(userProfile.uid, { xp: 3 });
      await updateChallengeProgress(userProfile.uid, 'message_send');
    } catch (error) {
      console.error('Error sending sticker:', error);
    }
  };

  const startEditingMessage = (message: any) => {
    if (!userProfile || message.senderId !== userProfile.uid) return;
    if (message.messageType === 'call_event' || message.isSticker) return;
    setEditingMessageId(message.id);
    setEditingMessageText(message.text || '');
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const saveEditedMessage = async (message: any) => {
    if (!activeChat || !userProfile || editingMessageId !== message.id || isSavingMessageEdit) return;
    const trimmedText = editingMessageText.trim();
    if (!trimmedText) return;

    setIsSavingMessageEdit(true);
    try {
      await updateDoc(doc(db, `chats/${activeChat.id}/messages`, message.id), {
        text: trimmedText,
        editedAt: new Date().toISOString(),
      });

      if (messages[messages.length - 1]?.id === message.id) {
        await setDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: trimmedText,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      cancelEditingMessage();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${activeChat.id}/messages/${message.id}`);
    } finally {
      setIsSavingMessageEdit(false);
    }
  };

  const getChatDisplayName = (chat: any) => {
    if (chat.isGroupChat) return chat.groupName || 'Group Chat';
    return chat.otherUser?.displayName || 'Loading...';
  };

  const getChatUsername = (chat: any) => {
    if (chat.isGroupChat) return null;
    return chat.otherUser?.username || null;
  };

  const getChatAvatar = (chat: any) => {
    if (chat.isGroupChat) return chat.groupPhotoURL || undefined;
    return chat.otherUser?.photoURL;
  };

  const getSenderProfile = (msg: any) => getCachedUserProfile(msg.senderId);

  const getSenderDisplayName = (msg: any) => getSenderProfile(msg)?.displayName || msg.senderName || 'Unknown user';

  const getSenderUsername = (msg: any) => getSenderProfile(msg)?.username || null;

  const getSenderAvatar = (msg: any) => getSenderProfile(msg)?.photoURL || null;

  const openUserProfile = (uid?: string | null) => {
    if (!uid) return;
    navigate(`/profile/${uid}`);
  };

  const primaryTypingProfile = activeTypingUsers[0] ? getCachedUserProfile(activeTypingUsers[0].uid) : null;

  return (
    <div className="snaplink-messages-page relative flex min-h-[calc(100dvh-4.75rem)] text-[15px] md:h-screen md:text-base">


      {/* Conversations List */}
      <div className={`snaplink-thread-list flex w-full flex-col border-r border-gray-200 md:w-[22rem] ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="snaplink-message-header sticky top-0 z-10 border-b border-slate-200/80 bg-[rgba(248,250,252,0.9)] p-3.5 backdrop-blur-md dark:border-slate-800 dark:bg-[rgba(2,6,23,0.9)] sm:p-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-black text-slate-950 dark:text-white">Messages</h1>
            <button
              onClick={() => { setShowCreateGroupChat(true); fetchFriends(); }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
              title="Create Group Chat"
            >
              <Users className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search people..."
              className="w-full rounded-[20px] border border-slate-200/70 bg-white/88 py-3 pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-white dark:placeholder-slate-500"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-14 md:pb-0">
          {isInitialLoading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading conversations...</p>
            </div>
          ) : loadError ? (
            <div className="p-8 text-center">
              <p className="text-red-500 mb-4">{loadError}</p>
              <Button onClick={() => window.location.reload()} size="sm">Retry</Button>
            </div>
          ) : searchQuery ? (
            <div className="p-2">
              {isSearching ? (
                <div className="text-center text-gray-500 dark:text-gray-400 p-4">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(user => (
                  <div 
                    key={user.uid} 
                    className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-colors"
                    onClick={() => startChat(user)}
                  >
                    <Avatar src={user.photoURL} alt={user.displayName} />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{user.displayName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 p-4">No users found</div>
              )}
            </div>
          ) : allConversations.length > 0 ? (
            <AnimatePresence>
              {allConversations.map(chat => (
                <motion.div 
                  key={chat.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  layout
                  className={`mx-2 my-1.5 flex items-center space-x-3 rounded-[18px] border px-3.5 py-3.5 transition-all ${activeChat?.id === chat.id ? 'cursor-pointer border-blue-500 bg-blue-500 text-white shadow-md' : 'cursor-pointer border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-900'}`}
                  onClick={() => setActiveChat(chat)}
                >
                  {chat.isGroupChat ? (
                    chat.groupPhotoURL ? (
                      <Avatar src={chat.groupPhotoURL} alt={getChatDisplayName(chat)} />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                    )
                  ) : (
                    <Avatar src={getChatAvatar(chat)} alt={getChatDisplayName(chat)} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className={`font-bold truncate ${activeChat?.id === chat.id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{getChatDisplayName(chat)}</p>
                      <span className={`ml-3 shrink-0 text-[11px] font-medium ${activeChat?.id === chat.id ? 'text-blue-100/90' : 'text-gray-400 dark:text-gray-500'}`}>
                        {formatConversationTime(chat.updatedAt)}
                      </span>
                    </div>
                    {getChatUsername(chat) && (
                      <p className={`text-xs truncate ${activeChat?.id === chat.id ? 'text-blue-200/70' : 'text-gray-400 dark:text-gray-500'}`}>@{getChatUsername(chat)}</p>
                    )}
                    <p className={`text-sm truncate mt-0.5 ${activeChat?.id === chat.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>{chat.lastMessage || 'Start a conversation'}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
              <Mail className="h-12 w-12 mb-4 text-gray-300 dark:text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Welcome to your inbox!</h2>
              <p className="text-sm">Search for a user above to start a private conversation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Chat Area */}
      <div className={`snaplink-thread-stage z-[60] flex h-full flex-1 flex-col bg-transparent md:z-0 ${!enrichedActiveChat ? 'hidden md:flex' : 'fixed inset-0 flex md:relative'}`}>
        {enrichedActiveChat ? (
          <>
            {/* Chat Header */}
            <div className="snaplink-message-header safe-area-top sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-[rgba(248,250,252,0.9)] p-3.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-[rgba(2,6,23,0.9)] sm:p-4">
              <div className="flex min-w-0 items-center space-x-3 sm:space-x-4">
                <button className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setActiveChat(null)}>
                  <ArrowLeft className="h-5 w-5 dark:text-white" />
                </button>
                {enrichedActiveChat.isGroupChat ? (
                  enrichedActiveChat.groupPhotoURL ? (
                    <Avatar src={enrichedActiveChat.groupPhotoURL} alt={getChatDisplayName(enrichedActiveChat)} size="md" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                  )
                ) : (
                  <Avatar src={enrichedActiveChat.otherUser?.photoURL} alt={enrichedActiveChat.otherUser?.displayName} size="md" />
                )}
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                    {getChatDisplayName(enrichedActiveChat)}
                  </h2>
                  {typingLabel && (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                      <span>{typingLabel}</span>
                      <div className="flex items-end gap-0.5">
                        {[0, 0.2, 0.4].map((delay, index) => (
                          <motion.span
                            key={`header-typing-${index}`}
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay }}
                            className="block h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-300"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {!enrichedActiveChat.isGroupChat && <p className="text-sm text-gray-500 dark:text-gray-400">@{enrichedActiveChat.otherUser?.username}</p>}
                  {enrichedActiveChat.isGroupChat && <p className="text-sm text-gray-500 dark:text-gray-400">{enrichedActiveChat.participants?.length || 0} members</p>}
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {!enrichedActiveChat.isGroupChat && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleStartCall('voice')}
                      disabled={isBlockedDirectChat || isReadOnlyAccount}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Phone className="h-5 w-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleStartCall('video')}
                      disabled={isBlockedDirectChat || isReadOnlyAccount}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Video className="h-5 w-5" />
                    </motion.button>
                  </>
                )}
                <button onClick={() => setIsReportModalOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  <MoreHorizontal className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(241,245,249,0.85),rgba(248,250,252,0.96))] p-3 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(3,10,18,0.98))] sm:space-y-6 sm:p-4">
                {isBlockedDirectChat && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                    You blocked this account. Their messages stay hidden here until you unblock them from your profile.
                  </div>
                )}
                {isReadOnlyAccount && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100">
                    {readOnlyReason || 'This account is in read-only mode. Browsing still works, but messages and calls are disabled.'}
                  </div>
                )}
              <AnimatePresence initial={false}>
                {(() => {
                  const displayMessages = isBlockedDirectChat ? [] : messages;
                  return displayMessages.length > 0 ? (
                    displayMessages.map((msg, index) => {
                    const isMe = msg.senderId === userProfile?.uid;
                    const showAvatar = index === displayMessages.length - 1 || displayMessages[index + 1]?.senderId !== msg.senderId;
                    const senderProfile = getSenderProfile(msg);
                    const senderDisplayName = getSenderDisplayName(msg);
                    const senderUsername = getSenderUsername(msg);
                    const senderAvatar = getSenderAvatar(msg);

                    const isCallEvent = msg.messageType === 'call_event' && msg.callEvent;
                    const isEditingThisMessage = editingMessageId === msg.id;
                    const canEditMessage =
                      isMe &&
                      !isCallEvent &&
                      !msg.isSticker &&
                      typeof msg.text === 'string';

                    return (
                      <motion.div 
                        key={msg.id} 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        layout
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex max-w-[min(100%,88vw)] sm:max-w-[78%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isMe && showAvatar && (
                            <div className="mr-2 flex-shrink-0 self-end">
                              {enrichedActiveChat?.isGroupChat ? (
                                <button
                                  type="button"
                                  onClick={() => openUserProfile(senderProfile?.uid)}
                                  disabled={!senderProfile}
                                  className="rounded-full disabled:cursor-default"
                                >
                                  <Avatar src={senderAvatar} alt={senderDisplayName} size="sm" fallback={senderDisplayName.charAt(0).toUpperCase()} />
                                </button>
                              ) : (
                                <Avatar src={enrichedActiveChat?.otherUser?.photoURL} alt={enrichedActiveChat?.otherUser?.displayName} size="sm" />
                              )}
                            </div>
                          )}
                          {!isMe && !showAvatar && <div className="w-8 mr-2" />}
                          
                          <div>
                            {!isMe && showAvatar && (
                              <div className="mb-1 ml-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <button
                                  type="button"
                                  onClick={() => openUserProfile(senderProfile?.uid)}
                                  disabled={!senderProfile}
                                  className="text-left text-xs font-semibold text-gray-700 transition-colors hover:text-blue-500 disabled:cursor-default dark:text-gray-200"
                                >
                                  {senderDisplayName}
                                </button>
                                {senderUsername && (
                                  <span className="text-[11px] text-gray-400 dark:text-gray-500">@{senderUsername}</span>
                                )}
                              </div>
                            )}
                            {isCallEvent ? (
                              <div className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 shadow-sm sm:rounded-[24px] ${isMe ? 'border-blue-400/40 bg-blue-500/12 text-blue-900 dark:text-blue-100' : 'border-slate-200 bg-white/95 text-gray-900 dark:border-slate-700 dark:bg-slate-800/95 dark:text-white'}`}>
                                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${msg.callEvent.callType === 'video' ? 'bg-violet-500/15 text-violet-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                                  {msg.callEvent.callType === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold leading-tight">{msg.text || 'Call update'}</p>
                                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                    {msg.callEvent.status.replace('_', ' ')} · {msg.callEvent.callType}
                                  </p>
                                </div>
                                <p className={`ml-auto self-end text-[11px] font-medium ${isMe ? 'text-blue-700/80 dark:text-blue-100/70' : 'text-gray-400 dark:text-gray-500'}`}>
                                  {formatBubbleTime(msg.createdAt)}
                                </p>
                              </div>
                            ) : msg.isSticker && msg.imageURL ? (
                              <div className="p-1">
                                <img 
                                  src={msg.imageURL} 
                                  alt="Sticker" 
                                  className="w-32 h-32 object-contain cursor-pointer hover:scale-105 transition-transform"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : (
                            <div className={`rounded-[22px] px-4 py-3 shadow-sm sm:rounded-[24px] sm:px-5 sm:py-4 ${isMe ? 'rounded-br-sm bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'rounded-bl-sm border border-slate-200 bg-white text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'}`}>
                              {msg.imageURL && (
                                <img 
                                  src={msg.imageURL} 
                                  alt="Shared" 
                                  className="mb-3 max-w-full cursor-pointer rounded-xl transition-opacity hover:opacity-90 sm:rounded-2xl"
                                  onClick={() => window.open(msg.imageURL, '_blank')}
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              {isEditingThisMessage ? (
                                <div className="space-y-3">
                                  <textarea
                                    value={editingMessageText}
                                    onChange={(event) => setEditingMessageText(event.target.value)}
                                    rows={3}
                                    className={`w-full resize-none rounded-2xl border px-3 py-2 text-[15px] leading-6 outline-none focus:ring-2 focus:ring-blue-500/30 sm:text-base ${isMe ? 'border-white/15 bg-white/10 text-white placeholder:text-blue-100/60 dark:border-slate-300/30 dark:bg-slate-950/10 dark:text-slate-950 dark:placeholder:text-slate-700/70' : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
                                  />
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={cancelEditingMessage}
                                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isMe ? 'bg-white/12 text-white hover:bg-white/20 dark:bg-slate-950/10 dark:text-slate-950 dark:hover:bg-slate-950/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void saveEditedMessage(msg)}
                                      disabled={!editingMessageText.trim() || isSavingMessageEdit}
                                      className="rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isSavingMessageEdit ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {msg.text && <p className="whitespace-pre-wrap text-[15px] leading-6 sm:text-base sm:leading-7">{msg.text}</p>}
                                  <div className={`mt-2 flex items-center gap-2 ${isMe ? 'justify-end' : 'justify-between'}`}>
                                    <p className={`text-[11px] font-medium ${isMe ? 'text-blue-100/80 dark:text-slate-700/80' : 'text-gray-400 dark:text-gray-500'}`}>
                                      {formatBubbleTime(msg.createdAt)}
                                      {msg.editedAt ? ' · Edited' : ''}
                                    </p>
                                    {canEditMessage && (
                                      <button
                                        type="button"
                                        onClick={() => startEditingMessage(msg)}
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${isMe ? 'bg-white/10 text-white hover:bg-white/15 dark:bg-slate-950/10 dark:text-slate-950 dark:hover:bg-slate-950/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 italic">
                    No messages yet. Say hello!
                  </div>
                );
                })()}
                {activeTypingUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="flex max-w-[80%]">
                      <div className="flex-shrink-0 mr-2 self-end">
                        {enrichedActiveChat?.isGroupChat ? (
                          <Avatar
                            src={primaryTypingProfile?.photoURL}
                            alt={primaryTypingProfile?.displayName || activeTypingUsers[0]?.displayName || 'Typing user'}
                            size="sm"
                            fallback={(primaryTypingProfile?.displayName || activeTypingUsers[0]?.displayName || 'T').charAt(0).toUpperCase()}
                          />
                        ) : (
                          <Avatar src={enrichedActiveChat?.otherUser?.photoURL} alt={enrichedActiveChat?.otherUser?.displayName} size="sm" />
                        )}
                      </div>
                      <div className="rounded-[22px] rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:rounded-[24px] sm:px-5 sm:py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{typingLabel}</span>
                          <div className="flex space-x-1">
                            {[0, 0.2, 0.4].map((delay, index) => (
                              <motion.div
                                key={`chat-typing-${index}`}
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay }}
                                className="w-2 h-2 bg-blue-400 rounded-full"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="snaplink-thread-compose safe-area-bottom flex-shrink-0 border-t border-slate-200 bg-[rgba(248,250,252,0.96)] p-2.5 pb-4 dark:border-slate-800 dark:bg-[rgba(2,6,23,0.96)] sm:p-3">
              {imagePreview && (
                <div className="mb-2 relative inline-block">
                  <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                  <button 
                    onClick={() => { setImageFile(null); setImagePreview(null); setGifUrl(null); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <form onSubmit={sendMessage} className="mx-auto flex w-full max-w-4xl flex-wrap items-end gap-2 sm:flex-nowrap">
                <input
                  type="file"
                  accept="image/*,image/gif"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                   disabled={isBlockedDirectChat || isReadOnlyAccount}
                  className="shrink-0 rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <Camera className="h-6 w-6" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGifPicker(!showGifPicker);
                      setShowStickerPicker(false);
                    }}
                     disabled={isBlockedDirectChat || isReadOnlyAccount}
                    className={`shrink-0 rounded-full p-2 transition-colors ${showGifPicker ? 'bg-blue-100 text-blue-500 dark:bg-blue-900/30' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                  >
                    <ImageIcon className="h-6 w-6" />
                  </button>
                  <AnimatePresence>
                    {showGifPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute bottom-14 left-0 z-30 w-[min(22rem,82vw)] overflow-hidden rounded-[24px] border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
                      >
                        <input
                          type="text"
                          value={gifQuery}
                          onChange={(event) => setGifQuery(event.target.value)}
                          placeholder="Search GIFs"
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                        <div className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
                          {isSearchingGifs ? (
                            <div className="col-span-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading GIFs...</div>
                          ) : (
                            gifResults.map((gif) => (
                              <button
                                key={gif.id}
                                type="button"
                                onClick={() => handleSelectGif(gif.images.fixed_height.url)}
                                className="overflow-hidden rounded-2xl bg-gray-100 transition hover:scale-[1.02] dark:bg-gray-800"
                              >
                                <img src={gif.images.fixed_height_small.url} alt={gif.title || 'GIF'} className="h-24 w-full object-cover" />
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowStickerPicker(!showStickerPicker);
                      setShowGifPicker(false);
                    }}
                     disabled={isBlockedDirectChat || isReadOnlyAccount}
                    className={`shrink-0 rounded-full p-2 transition-colors ${showStickerPicker ? 'bg-purple-100 text-purple-500 dark:bg-purple-900/30' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                  >
                    <Smile className="h-6 w-6" />
                  </button>
                  <AvatarStickerPicker
                    isOpen={showStickerPicker}
                    onClose={() => setShowStickerPicker(false)}
                    onSelect={sendStickerMessage}
                    userSeed={userProfile?.displayName || 'user'}
                    userPhotoURL={userProfile?.photoURL}
                  />
                </div>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleMessageChange(e.target.value)}
                   placeholder={
                     isReadOnlyAccount
                       ? 'Read-only mode is active on this account'
                       : isBlockedDirectChat
                       ? 'Unblock this user from your profile to message again'
                       : 'Start a new message'
                   }
                   disabled={isBlockedDirectChat || isReadOnlyAccount}
                  className="min-w-0 flex-1 basis-[calc(100%-4rem)] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-gray-500 sm:basis-auto sm:rounded-3xl sm:px-6 sm:py-4 sm:text-lg"
                />
                <button 
                  type="submit" 
                   disabled={isBlockedDirectChat || isReadOnlyAccount || (!newMessage.trim() && !imageFile) || isSending}
                  className="shrink-0 rounded-full bg-blue-500 p-3 text-white shadow-md transition-all hover:bg-blue-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
                >
                  <Send className="h-6 w-6" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 hidden md:flex">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Select a message</h2>
            <p>Choose from your existing conversations, start a new one, or just keep swimming.</p>
          </div>
        )}
      </div>

      {/* Create Group Chat Modal */}
      <AnimatePresence>
        {showCreateGroupChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold dark:text-white flex items-center">
                  <Users className="mr-2 text-blue-500" /> New Group Chat
                </h2>
                <button onClick={() => setShowCreateGroupChat(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Group Banner Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group Banner</label>
                  <div
                    className="relative w-full h-24 rounded-xl overflow-hidden bg-gradient-to-r from-blue-400 to-purple-500 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => document.getElementById('group-banner-input')?.click()}
                  >
                    {groupBannerPreview && <img src={groupBannerPreview} alt="Banner" className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                    <input id="group-banner-input" type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setGroupBanner(file); setGroupBannerPreview(URL.createObjectURL(file)); }
                    }} />
                  </div>
                </div>

                {/* Group Photo Upload */}
                <div className="flex items-center space-x-4">
                  <div
                    className="relative h-16 w-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                    onClick={() => document.getElementById('group-photo-input')?.click()}
                  >
                    {groupPhotoPreview ? (
                      <img src={groupPhotoPreview} alt="Group" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full">
                        <Camera className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <input id="group-photo-input" type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setGroupPhoto(file); setGroupPhotoPreview(URL.createObjectURL(file)); }
                    }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group Name</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-900 dark:text-white"
                      value={groupChatName}
                      onChange={(e) => setGroupChatName(e.target.value)}
                      placeholder="e.g. Squad Chat"
                      maxLength={30}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Add Friends ({selectedFriends.length} selected)
                  </label>
                  {friendsList.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No mutual friends found. You can only add mutual friends to group chats.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {friendsList.map(friend => {
                        const isSelected = selectedFriends.includes(friend.uid);
                        return (
                          <div
                            key={friend.uid}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedFriends(prev => prev.filter(id => id !== friend.uid));
                              } else {
                                setSelectedFriends(prev => [...prev, friend.uid]);
                              }
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                              isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <Avatar src={friend.photoURL} alt={friend.displayName} size="sm" />
                              <div>
                                <p className="font-medium text-sm dark:text-white">{friend.displayName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">@{friend.username}</p>
                              </div>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleCreateGroupChat}
                  disabled={selectedFriends.length === 0 || !groupChatName.trim()}
                  className="w-full font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-xl h-12"
                >
                  Create Group Chat
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeChat && (
        <ReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          targetId={activeChat.id} 
          targetType="chat" 
        />
      )}
    </div>
  );
}
