import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, orderBy, onSnapshot, setDoc, updateDoc, increment, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { updateChallengeProgress } from '../lib/challenges';
import { ArrowLeft, MessageCircle, Repeat2, Heart, Share, CheckCircle, MoreHorizontal, Flag, Trash2, Image as ImageIcon, X, Smile, Search, Reply, Bot, SmilePlus, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ReportModal } from '../components/ui/ReportModal';
import { ImageViewer } from '../components/ui/ImageViewer';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../lib/utils';
import { VerificationBadge, UserBadges } from '../components/ui/VerificationBadge';
import { FormattedText } from '../components/ui/FormattedText';
import { getRipoAIResponse, RIPOAI_PROFILE } from '../lib/ripoai';
import { createNotification } from '../lib/notifications';
import { getPostMedia } from '../lib/postMedia';
import { PostMediaGrid } from '../components/post/PostMediaGrid';
import { deletePostCascade } from '../lib/dataCleanup';
import { sanitizeStorageFileName, uploadOptimizedImage } from '../lib/storageUploads';
import { createMentionNotifications } from '../lib/mentionNotifications';
import { LevelBadge } from '../components/ui/LevelBadge';
import { adjustReactionCounts, canUsePostReactions, getTopReactionEntries, normalizePostReaction, POST_REACTIONS, type PostReaction } from '../lib/reactions';
import { extractFirstExternalUrl, useLinkPreview } from '../lib/linkPreview';
import { getReadOnlyReason, isReadOnlyUser } from '../lib/accessControl';
import { getMentionCandidates, type MentionCandidate } from '../lib/mentions';

const GIPHY_API_KEY = 'kcCL2LJMFVNJ0S13u0A2q4j1WwM7VXrc';

function getCreatedAtTime(value: any) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const { userProfile } = useAuth();
  const readOnlyReason = getReadOnlyReason(userProfile);
  const [post, setPost] = useState<any | null>(null);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionCandidate[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(0);
  const [localReactionCounts, setLocalReactionCounts] = useState<Record<string, number>>({});
  const [isReposted, setIsReposted] = useState(false);
  const [localRepostsCount, setLocalRepostsCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState<'likes' | 'reposts' | null>(null);
  const [interactionUsers, setInteractionUsers] = useState<UserProfile[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<PostReaction | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [postViewerImage, setPostViewerImage] = useState<string | null>(null);
  const [displayContent, setDisplayContent] = useState('');
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [isSavingPostEdit, setIsSavingPostEdit] = useState(false);
  const postMedia = getPostMedia(post);
  const linkPreviewUrl = extractFirstExternalUrl(displayContent);
  const { preview: linkPreview } = useLinkPreview(linkPreviewUrl);
  const canChooseReaction = canUsePostReactions(userProfile);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mentionQuery === null) return;
    const timeoutId = setTimeout(async () => {
      try {
        setMentionUsers(await getMentionCandidates(userProfile || null, mentionQuery));
      } catch {
        setMentionUsers([]);
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [mentionQuery, userProfile]);

  useEffect(() => {
    if (!postId || !userProfile) return;
    const likeId = `${userProfile.uid}_${postId}`;
    const likeRef = doc(db, 'likes', likeId);
    getDoc(likeRef).then(snap => {
      setIsLiked(snap.exists());
      setSelectedReaction(normalizePostReaction((snap.data() as any)?.reaction));
    });

    const repostId = `${userProfile.uid}_${postId}`;
    const repostRef = doc(db, 'reposts', repostId);
    getDoc(repostRef).then(snap => {
      setIsReposted(snap.exists());
    });
  }, [postId, userProfile]);

  useEffect(() => {
    if (!postId) return;

    const fetchPostAndAuthor = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const data = postSnap.data() as any;
          const postData = { id: postSnap.id, ...data };
          setPost(postData);
          setDisplayContent(postData.content || '');
          if (!isEditingPost) {
            setEditingContent(postData.content || '');
          }
          setLocalLikesCount(data.likesCount || 0);
          setLocalReactionCounts(data.reactionCounts || {});
          setLocalRepostsCount(data.repostsCount || 0);

          const authorRef = doc(db, 'users', postData.authorId);
          const authorSnap = await getDoc(authorRef);
          if (authorSnap.exists()) {
            setAuthor(authorSnap.data() as UserProfile);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `posts/${postId}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchComments = () => {
      const commentsRef = collection(db, 'comments');
      const q = query(commentsRef, where('postId', '==', postId));
      return onSnapshot(q, (snapshot) => {
        const allComments = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt));
        // Only show top-level comments (no parentCommentId); nested replies are fetched by CommentItem
        setComments(allComments.filter((c: any) => !c.parentCommentId));
      }, (error) => {
        try { handleFirestoreError(error, OperationType.LIST, 'comments'); } catch(e) {}
      });
    };

    fetchPostAndAuthor();
    const unsubComments = fetchComments();

    return () => unsubComments();
  }, [isEditingPost, postId]);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleCommentChange = (value: string, selectionStart?: number | null) => {
    setNewComment(value);
    const cursor = selectionStart ?? value.length;
    const textBeforeCursor = value.substring(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (username: string) => {
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    const position = textarea.selectionStart || 0;
    const before = newComment.substring(0, position);
    const after = newComment.substring(position);
    const match = before.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) return;
    const replacementStart = position - match[0].length + (match[0].startsWith(' ') ? 1 : 0);
    const nextValue = `${newComment.substring(0, replacementStart)}@${username} ${after}`;
    setNewComment(nextValue);
    setMentionQuery(null);
    setMentionUsers([]);
    setTimeout(() => {
      textarea.focus();
      const nextCursor = replacementStart + username.length + 2;
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || (!newComment.trim() && !mediaFile && !selectedGifUrl) || !postId || isSubmitting) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    setIsSubmitting(true);
    try {
      const commentsRef = collection(db, 'comments');
      const newCommentRef = doc(commentsRef);
      let mediaURL = null;
      let mediaStoragePath = null;
      if (selectedGifUrl) {
        mediaURL = selectedGifUrl;
      } else if (mediaFile) {
        const safeFileName = sanitizeStorageFileName(mediaFile.name || `comment-${Date.now()}.jpg`);
        const uploadedImage = await uploadOptimizedImage(
          mediaFile,
          `comments/${userProfile.uid}/${newCommentRef.id}/${Date.now()}-${safeFileName}`,
          {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.8,
            timeoutMs: 12000,
            allowDataUrlFallback: true,
            preferDataUrl: mediaFile.size <= 900000,
          }
        );
        mediaURL = uploadedImage.url;
        mediaStoragePath = uploadedImage.storagePath;
      }

      await setDoc(newCommentRef, {
        id: newCommentRef.id,
        postId,
        authorId: userProfile.uid,
        content: newComment.trim(),
        mediaURL,
        mediaStoragePath,
        createdAt: new Date().toISOString(),
      });
      
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, { commentsCount: increment(1) });
      
      // Extract and update hashtags
      const hashtags = newComment.match(/#[a-zA-Z0-9_]+/g) || [];
      const uniqueHashtags = [...new Set(hashtags.map(tag => tag.toLowerCase()))];
      
      for (const tag of uniqueHashtags) {
        const tagString = tag as string;
        const tagRef = doc(db, 'hashtags', tagString.substring(1));
        await setDoc(tagRef, {
          tag: tagString,
          name: tagString,
          count: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // Update daily challenge progress
      await updateChallengeProgress(userProfile.uid, 'comment_create');
      if (post.authorId !== userProfile.uid) {
        await createNotification({
          type: 'comment',
          sourceUserId: userProfile.uid,
          targetUserId: post.authorId,
          postId: post.id,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null
          }
        });
      }

      await createMentionNotifications({
        text: newComment.trim(),
        sourceUserId: userProfile.uid,
        sourceUser: {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || null,
        },
        postId: post.id,
        linkTo: `/post/${post.id}`,
        excludeUserIds: post.authorId !== userProfile.uid ? [post.authorId] : [],
        message: newComment.trim().slice(0, 160),
      });
      
      setNewComment('');
      removeMedia();
      setSelectedGifUrl(null);
      setShowGifSearch(false);

      // Auto-respond if @ripoai is mentioned
      const commentText = newComment.trim();
      if (commentText.toLowerCase().includes('@ripoai')) {
        const userQuestion = commentText.replace(/@ripoai/gi, '').trim();
        try {
          const aiResponse = await getRipoAIResponse(userQuestion || 'Someone mentioned me!', `This is a reply to a post: "${post.content?.substring(0, 100)}"`);
          const aiCommentRef = doc(collection(db, 'comments'));
            await setDoc(aiCommentRef, {
              id: aiCommentRef.id,
              postId,
              authorId: RIPOAI_PROFILE.uid,
            isAIGenerated: true,
            aiInvokedBy: userProfile.uid,
            aiDisplayName: RIPOAI_PROFILE.displayName,
              aiPhotoURL: RIPOAI_PROFILE.photoURL,
              content: aiResponse,
              mediaURL: null,
              createdAt: new Date().toISOString(),
            });
            await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
        } catch (aiError) {
          console.error('RipoAI auto-reply error:', aiError);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile || !post) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    const repostId = `${userProfile.uid}_${post.id}`;
    const repostRef = doc(db, 'reposts', repostId);
    const postRef = doc(db, 'posts', post.id);

    try {
      if (isReposted) {
        setIsReposted(false);
        setLocalRepostsCount(prev => prev - 1);
        await deleteDoc(repostRef);
        await updateDoc(postRef, { repostsCount: increment(-1) });
      } else {
        setIsReposted(true);
        setLocalRepostsCount(prev => prev + 1);
        await setDoc(repostRef, {
          id: repostId,
          userId: userProfile.uid,
          postId: post.id,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(postRef, { repostsCount: increment(1) });
        
        const newPostRef = doc(collection(db, 'posts'));
        await setDoc(newPostRef, {
          id: newPostRef.id,
          authorId: userProfile.uid,
          content: '',
          repostOf: post.id,
          createdAt: new Date().toISOString(),
          likesCount: 0,
          reactionCounts: {},
          commentsCount: 0,
          repostsCount: 0,
        });
        alert('Reposted successfully!');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
      setIsReposted(!isReposted);
      setLocalRepostsCount(prev => isReposted ? prev + 1 : prev - 1);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!post) return;
    
    const url = `${window.location.origin}/post/${post.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${author?.displayName || 'user'}`,
          text: displayContent,
          url: url,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const handleStartEdit = () => {
    if (!userProfile || userProfile.uid !== post?.authorId) return;
    setEditingContent(displayContent || '');
    setIsEditingPost(true);
    setShowMenu(false);
  };

  const handleCancelEdit = () => {
    setEditingContent(displayContent || '');
    setIsEditingPost(false);
  };

  const handleSaveEdit = async () => {
    if (!post || !userProfile || userProfile.uid !== post.authorId || isSavingPostEdit) return;
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
      await updateDoc(doc(db, 'posts', post.id), {
        content: nextContent,
        editedAt: new Date().toISOString(),
      });
      setDisplayContent(nextContent);
      setPost((prev: any) => (prev ? { ...prev, content: nextContent, editedAt: new Date().toISOString() } : prev));
      setIsEditingPost(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${post.id}`);
    } finally {
      setIsSavingPostEdit(false);
    }
  };

  const persistLike = async (reaction: PostReaction | null) => {
    if (!userProfile || !post) return;

    const likeId = `${userProfile.uid}_${post.id}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', post.id);
    const previousReaction = selectedReaction;

    if (isLiked) {
      const nextCounts = adjustReactionCounts(localReactionCounts, previousReaction, null);
      setIsLiked(false);
      setSelectedReaction(null);
      setLocalLikesCount(prev => prev - 1);
      setLocalReactionCounts(nextCounts);
      await deleteDoc(likeRef);
      await updateDoc(postRef, {
        likesCount: increment(-1),
        reactionCounts: nextCounts,
      });
      return;
    }

    const nextCounts = adjustReactionCounts(localReactionCounts, previousReaction, reaction);
    setIsLiked(true);
    setSelectedReaction(reaction);
    setLocalLikesCount(prev => prev + 1);
    setLocalReactionCounts(nextCounts);
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 1000);
    await setDoc(likeRef, {
      id: likeId,
      userId: userProfile.uid,
      postId: post.id,
      reaction: reaction || null,
      createdAt: new Date().toISOString(),
    });
    await updateDoc(postRef, {
      likesCount: increment(1),
      reactionCounts: nextCounts,
    });

    if (post.authorId !== userProfile.uid) {
      await createNotification({
        type: 'like',
        sourceUserId: userProfile.uid,
        targetUserId: post.authorId,
        postId: post.id,
        sourceUser: {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || null
        }
      });
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile || !post) return;

    try {
      setShowReactionPicker(false);
      await persistLike(isLiked ? selectedReaction : POST_REACTIONS[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'likes/posts');
      setIsLiked(!isLiked);
      setSelectedReaction(isLiked ? selectedReaction : null);
      setLocalLikesCount(prev => isLiked ? prev + 1 : prev - 1);
      setLocalReactionCounts(post?.reactionCounts || {});
    }
  };

  const handleReactionPick = async (reaction: PostReaction) => {
    setShowReactionPicker(false);
    try {
      await persistLike(reaction);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'likes/posts');
      setIsLiked(false);
      setSelectedReaction(null);
      setLocalLikesCount((prev) => Math.max(prev - 1, 0));
      setLocalReactionCounts(post?.reactionCounts || {});
    }
  };

  const handleViewInteractions = async (type: 'likes' | 'reposts') => {
    setShowInteractionModal(type);
    setLoadingInteractions(true);
    setInteractionUsers([]);
    try {
      const collectionName = type === 'likes' ? 'likes' : 'reposts';
      const q = query(collection(db, collectionName), where('postId', '==', post.id));
      const snapshot = await getDocs(q);
      const userIds = snapshot.docs.map(doc => doc.data().userId);
      
      if (userIds.length > 0) {
        const users: UserProfile[] = [];
        for (const id of userIds) {
          const userDoc = await getDoc(doc(db, 'users', id));
          if (userDoc.exists()) {
            users.push(userDoc.data() as UserProfile);
          }
        }
        setInteractionUsers(users);
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
    } finally {
      setLoadingInteractions(false);
    }
  };

  if (loading) return (
    <div className="p-8 text-center dark:bg-gray-900 min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
    </div>
  );
  if (!post || !author) return <div className="p-8 text-center dark:text-gray-400 dark:bg-gray-900 min-h-screen">Post not found</div>;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-10 flex items-center space-x-6 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 px-4 py-3 backdrop-blur-md">
        <Link to="/" className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="h-5 w-5 dark:text-white" />
        </Link>
        <h1 className="text-xl font-bold dark:text-white">Post</h1>
      </div>

      <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to={`/profile/${author.uid}`}>
              <Avatar src={author.photoURL} alt={author.displayName} />
            </Link>
            <div className="flex flex-col">
              <Link to={`/profile/${author.uid}`} className="font-bold hover:underline flex items-center dark:text-white">
                {author.displayName}
                {author.isVerified && <VerificationBadge className="ml-1 w-4 h-4" title="Verified" />}
                <UserBadges badges={author.badges} hiddenBadges={author.hiddenBadges} badgeSize="w-4 h-4" />
              </Link>
              <span className="text-gray-500 dark:text-gray-400">@{author.username}</span>
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-20"
                >
                  {userProfile?.uid === author.uid && (
                    <button
                      onClick={handleStartEdit}
                      className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Post
                    </button>
                  )}
                  {userProfile?.uid === author.uid || userProfile?.role === 'admin' ? (
                    <button 
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete this post?')) {
                          try {
                            await deletePostCascade(post);
                            window.history.back();
                          } catch (error) {
                            console.error("Error deleting post:", error);
                          }
                        }
                      }}
                      className="w-full text-left px-4 py-3 text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Post
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setIsReportModalOpen(true); setShowMenu(false); }}
                      className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report Post
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {isEditingPost ? (
          <div className="mt-4 space-y-3 rounded-[24px] border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60">
            <textarea
              value={editingContent}
              onChange={(event) => setEditingContent(event.target.value)}
              rows={6}
              maxLength={5000}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[15px] leading-7 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-400">{editingContent.length}/5000</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
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
            <FormattedText text={displayContent} className="mt-4 whitespace-pre-wrap text-[1.02rem] leading-7 dark:text-white sm:text-xl" />
            {(post.editedAt || post.updatedAt) && (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Edited</p>
            )}
          </>
        )}
        {!isEditingPost && linkPreview && (
          <a
            href={linkPreview.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/70 dark:hover:bg-gray-800"
          >
            {linkPreview.image ? (
              <img src={linkPreview.image} alt={linkPreview.title} className="h-44 w-full object-cover" />
            ) : null}
            <div className="px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">{linkPreview.siteName}</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{linkPreview.title}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{linkPreview.description}</p>
            </div>
          </a>
        )}
        
        <PostMediaGrid items={postMedia} onImageClick={(url) => setPostViewerImage(url)} />

        <div className="mt-4 flex items-center space-x-1 text-gray-500 dark:text-gray-400">
          <span>{format(new Date(post.createdAt), "h:mm a '·' MMM d, yyyy")}</span>
        </div>
        
        <div className="mt-4 flex space-x-4 border-y border-gray-200 dark:border-gray-800 py-3 text-sm">
          <div className="flex space-x-1 cursor-pointer hover:underline" onClick={() => handleViewInteractions('reposts')}>
            <span className="font-bold dark:text-white">{localRepostsCount}</span>
            <span className="text-gray-500 dark:text-gray-400">Reposts</span>
          </div>
          <div className="flex space-x-1 cursor-pointer hover:underline" onClick={() => handleViewInteractions('likes')}>
            <span className="font-bold dark:text-white">{localLikesCount}</span>
            <span className="text-gray-500 dark:text-gray-400">Likes</span>
          </div>
        </div>

        {getTopReactionEntries(localReactionCounts).length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {getTopReactionEntries(localReactionCounts).map((entry) => (
              <div key={entry.emoji} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${entry.meta.chipClass}`}>
                <span>{entry.emoji}</span>
                <span>{entry.count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="relative grid grid-cols-5 justify-items-center border-b border-gray-200 py-3 text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:flex sm:justify-around">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="flex items-center space-x-2 hover:text-blue-500 group" onClick={(e) => { e.preventDefault(); e.stopPropagation(); document.querySelector('textarea')?.focus(); }}>
            <div className="rounded-full p-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
              <MessageCircle className="h-5 w-5" />
            </div>
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className={`flex items-center space-x-2 group ${isReposted ? 'text-green-500' : 'hover:text-green-500'}`} onClick={handleRepost}>
            <div className="rounded-full p-2 group-hover:bg-green-50 dark:group-hover:bg-green-900/30 transition-colors">
              <Repeat2 className={`h-5 w-5 ${isReposted ? 'stroke-[3px]' : ''}`} />
            </div>
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className={`flex items-center space-x-2 hover:text-pink-500 group ${isLiked ? 'text-pink-500' : ''} relative`} onClick={handleLike}>
            <div className="rounded-full p-2 group-hover:bg-pink-50 dark:group-hover:bg-pink-900/30 transition-colors relative">
              <div className="flex h-5 w-5 items-center justify-center">
                {isLiked && selectedReaction ? (
                  <span className="text-base leading-none">{selectedReaction}</span>
                ) : (
                  <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                )}
              </div>
              <AnimatePresence>
                {showHeartAnimation && (
                  <motion.div
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 3, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <Heart className="h-5 w-5 fill-pink-500 text-pink-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.button>
          {canChooseReaction && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className={`flex items-center justify-center hover:text-fuchsia-500 group ${showReactionPicker ? 'text-fuchsia-500' : ''}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReactionPicker((prev) => !prev); }}>
              <div className="rounded-full p-2 group-hover:bg-fuchsia-50 dark:group-hover:bg-fuchsia-900/20 transition-colors">
                <SmilePlus className="h-5 w-5" />
              </div>
            </motion.button>
          )}
          {canChooseReaction && showReactionPicker && (
            <div className="absolute bottom-full left-1/2 z-10 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-pink-200 bg-white px-2 py-1 shadow-lg dark:border-pink-400/20 dark:bg-gray-900">
              {POST_REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleReactionPick(reaction);
                  }}
                  className="rounded-full p-1.5 text-lg transition-transform hover:scale-110"
                >
                  {reaction}
                </button>
              ))}
            </div>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="flex items-center space-x-2 hover:text-blue-500 group" onClick={handleShare}>
            <div className="rounded-full p-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
              <Share className="h-5 w-5" />
            </div>
          </motion.button>
        </div>

        <div className="mt-4 flex gap-3 sm:gap-4">
          <Avatar src={userProfile?.photoURL} alt={userProfile?.displayName} />
          <form className="flex-1" onSubmit={handleReply}>
            <div className="relative">
              <textarea
                ref={commentTextareaRef}
                className="w-full resize-none border-none bg-transparent text-base placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-0 dark:text-white sm:text-lg"
                placeholder="Post your reply"
                rows={2}
                value={newComment}
                onChange={(e) => handleCommentChange(e.target.value, e.target.selectionStart)}
                onSelect={(e) => handleCommentChange((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
                maxLength={280}
              />
              {mentionQuery !== null && mentionUsers.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {mentionUsers.map((candidate) => (
                    <button
                      key={candidate.uid}
                      type="button"
                      onClick={() => insertMention(candidate.username)}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 last:border-b-0"
                    >
                      <Avatar src={candidate.photoURL} alt={candidate.displayName} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {candidate.displayName}
                        </div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">@{candidate.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {mediaPreview && (
              <div className="relative mt-2 mb-4 inline-block">
                <img src={mediaPreview} alt="Upload preview" className="max-h-64 rounded-2xl object-cover border border-gray-200 dark:border-gray-700" />
                <button
                  type="button"
                  onClick={removeMedia}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* GIF preview */}
            {selectedGifUrl && (
              <div className="relative mt-2 mb-4 inline-block">
                <img src={selectedGifUrl} alt="Selected GIF" className="max-h-48 rounded-2xl object-cover border border-gray-200 dark:border-gray-700" />
                <button
                  type="button"
                  onClick={() => setSelectedGifUrl(null)}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* GIF Search Panel */}
            {showGifSearch && !mediaPreview && !selectedGifUrl && (
              <div className="mt-2 mb-2 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex items-center">
                  <Search className="h-4 w-4 text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search GIFs..."
                    className="w-full text-sm outline-none dark:bg-transparent dark:text-white"
                    value={gifQuery}
                    onChange={(e) => {
                      setGifQuery(e.target.value);
                      // Fetch GIFs
                      const q = e.target.value;
                      setTimeout(async () => {
                        setIsSearchingGifs(true);
                        try {
                          const endpoint = q.trim()
                            ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=16`
                            : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=16`;
                          const response = await fetch(endpoint);
                          const data = await response.json();
                          setGifs(data.data || []);
                        } catch (err) {
                          console.error('Error fetching GIFs:', err);
                        } finally {
                          setIsSearchingGifs(false);
                        }
                      }, 300);
                    }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowGifSearch(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                <div className="h-48 overflow-y-auto p-2 grid grid-cols-2 gap-2">
                  {isSearchingGifs ? (
                    <div className="col-span-2 text-center py-8 text-gray-500 text-sm">Searching...</div>
                  ) : gifs.length > 0 ? (
                    gifs.map((gif: any) => (
                      <img
                        key={gif.id}
                        src={gif.images.fixed_height.url}
                        alt={gif.title}
                        className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setSelectedGifUrl(gif.images.original.url);
                          setShowGifSearch(false);
                          setMediaFile(null);
                          setMediaPreview(null);
                        }}
                      />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 text-gray-500 text-sm">Type to search GIFs</div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-2 dark:border-gray-800">
              <div className="flex space-x-2 text-blue-500">
                <button 
                  type="button" 
                  className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  onClick={() => { fileInputRef.current?.click(); setShowGifSearch(false); setSelectedGifUrl(null); }}
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
                <button 
                  type="button" 
                  className={`p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${showGifSearch ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                  onClick={() => {
                    setShowGifSearch(!showGifSearch);
                    if (!showGifSearch) {
                      // Load trending on open
                      (async () => {
                        setIsSearchingGifs(true);
                        try {
                          const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=16`);
                          const data = await response.json();
                          setGifs(data.data || []);
                        } catch (err) { console.error(err); }
                        finally { setIsSearchingGifs(false); }
                      })();
                    }
                  }}
                  disabled={!!mediaPreview || !!selectedGifUrl}
                >
                  <Smile className="h-5 w-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,image/gif"
                  onChange={handleMediaChange}
                />
              </div>
              <Button type="submit" disabled={(!newComment.trim() && !mediaFile && !selectedGifUrl) || isSubmitting} className="bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                {isSubmitting ? 'Replying...' : 'Reply'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div>
        <AnimatePresence mode="popLayout">
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </AnimatePresence>
      </div>
      <ImageViewer src={postViewerImage || ''} isOpen={!!postViewerImage} onClose={() => setPostViewerImage(null)} />
      <InteractionModal 
        isOpen={!!showInteractionModal}
        onClose={() => setShowInteractionModal(null)}
        title={showInteractionModal || ''}
        users={interactionUsers}
        loading={loadingInteractions}
      />
    </div>
  );
}

function CommentItem({ comment, depth = 0 }: { key?: React.Key, comment: any, depth?: number }) {
  const { userProfile } = useAuth();
  const readOnlyReason = getReadOnlyReason(userProfile);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replies, setReplies] = useState<any[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [replyMentionQuery, setReplyMentionQuery] = useState<string | null>(null);
  const [replyMentionUsers, setReplyMentionUsers] = useState<MentionCandidate[]>([]);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchAuthor = async () => {
      if (comment.isAIGenerated) {
        setAuthor({
          ...RIPOAI_PROFILE,
          displayName: comment.aiDisplayName || RIPOAI_PROFILE.displayName,
          photoURL: comment.aiPhotoURL || RIPOAI_PROFILE.photoURL,
        } as any);
        return;
      }
      try {
        const docRef = doc(db, 'users', comment.authorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAuthor(docSnap.data() as UserProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${comment.authorId}`);
      }
    };
    fetchAuthor();
  }, [comment.authorId]);

  useEffect(() => {
    // Fetch nested replies
    const q = query(
      collection(db, 'comments'),
      where('parentCommentId', '==', comment.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const nextReplies = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((left: any, right: any) => getCreatedAtTime(left.createdAt) - getCreatedAtTime(right.createdAt));
      setReplies(nextReplies);
    }, () => {
      // Index might not exist yet
    });
    return () => unsub();
  }, [comment.id]);

  useEffect(() => {
    if (replyMentionQuery === null) return;
    const timeoutId = setTimeout(async () => {
      try {
        setReplyMentionUsers(await getMentionCandidates(userProfile || null, replyMentionQuery));
      } catch {
        setReplyMentionUsers([]);
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [replyMentionQuery, userProfile]);

  useEffect(() => {
    if (replies.some((reply) => reply.isAIGenerated)) {
      setShowReplies(true);
    }
  }, [replies]);

  const handleReplyContentChange = (value: string, selectionStart?: number | null) => {
    setReplyContent(value);
    const cursor = selectionStart ?? value.length;
    const textBeforeCursor = value.substring(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    setReplyMentionQuery(match ? match[1] : null);
  };

  const insertReplyMention = (username: string) => {
    const textarea = replyTextareaRef.current;
    if (!textarea) return;
    const position = textarea.selectionStart || 0;
    const before = replyContent.substring(0, position);
    const after = replyContent.substring(position);
    const match = before.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) return;
    const replacementStart = position - match[0].length + (match[0].startsWith(' ') ? 1 : 0);
    const nextValue = `${replyContent.substring(0, replacementStart)}@${username} ${after}`;
    setReplyContent(nextValue);
    setReplyMentionQuery(null);
    setReplyMentionUsers([]);
    setTimeout(() => {
      textarea.focus();
      const nextCursor = replacementStart + username.length + 2;
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !replyContent.trim() || isReplying) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }
    setIsReplying(true);
    try {
      const replyRef = doc(collection(db, 'comments'));
      await setDoc(replyRef, {
        id: replyRef.id,
        postId: comment.postId,
        authorId: userProfile.uid,
        content: replyContent.trim(),
        mediaURL: null,
        createdAt: new Date().toISOString(),
        parentCommentId: comment.id,
      });
      await updateDoc(doc(db, 'posts', comment.postId), { commentsCount: increment(1) });
      await updateChallengeProgress(userProfile.uid, 'comment_create');
      
      // Auto-respond if @ripoai is mentioned
      if (replyContent.toLowerCase().includes('@ripoai')) {
        const userQuestion = replyContent.replace(/@ripoai/gi, '').trim();
        try {
          const aiResponse = await getRipoAIResponse(userQuestion || 'Someone mentioned me!');
          const aiReplyRef = doc(collection(db, 'comments'));
          await setDoc(aiReplyRef, {
            id: aiReplyRef.id,
            postId: comment.postId,
            authorId: RIPOAI_PROFILE.uid,
            isAIGenerated: true,
            aiInvokedBy: userProfile.uid,
            aiDisplayName: RIPOAI_PROFILE.displayName,
            aiPhotoURL: RIPOAI_PROFILE.photoURL,
            content: aiResponse,
            mediaURL: null,
            createdAt: new Date().toISOString(),
            parentCommentId: comment.id,
          });
          await updateDoc(doc(db, 'posts', comment.postId), { commentsCount: increment(1) });
        } catch (aiErr) {
          console.error('RipoAI reply error:', aiErr);
        }
      }

      setReplyContent('');
      setShowReplyForm(false);
      setShowReplies(true);
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setIsReplying(false);
    }
  };

  const handleDeleteComment = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile || (userProfile.uid !== comment.authorId && userProfile.role !== 'admin')) return;
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await deleteDoc(doc(db, 'comments', comment.id));
        const postRef = doc(db, 'posts', comment.postId);
        await updateDoc(postRef, { commentsCount: increment(-1) });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'comments');
      }
    }
    setShowMenu(false);
  };

  if (!author) return null;
  const isBot = comment.isAIGenerated === true;

  return (
    <div style={{ marginLeft: depth > 0 ? Math.min(depth * 24, 72) : 0 }}>
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`flex space-x-3 border-b border-gray-200 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${depth > 0 ? 'border-l-2 border-l-blue-200 dark:border-l-blue-800' : ''} ${isBot ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}
      >
        <Link to={isBot ? '/ripoai' : `/profile/${author.uid}`}>
          <Avatar src={author.photoURL} alt={author.displayName} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Link to={isBot ? '/ripoai' : `/profile/${author.uid}`} className="font-bold hover:underline flex items-center dark:text-white">
                {author.displayName}
                {isBot && <Bot className="ml-1 w-4 h-4 text-purple-500" />}
                {author.isVerified && <VerificationBadge className="ml-1 w-4 h-4" title="Verified" />}
                <UserBadges badges={author.badges} hiddenBadges={author.hiddenBadges} badgeSize="w-4 h-4" />
                <LevelBadge level={author.level || 1} compact className="ml-1" />
              </Link>
              <span className="text-gray-500 dark:text-gray-400">@{author.username}</span>
              <span className="text-gray-500 dark:text-gray-400">·</span>
              <span className="text-gray-500 dark:text-gray-400 hover:underline">
                {format(new Date(comment.createdAt), 'MMM d')}
              </span>
            </div>

            <div className="relative">
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-20"
                  >
                    {(userProfile?.uid === comment.authorId || userProfile?.role === 'admin') ? (
                      <button 
                        onClick={handleDeleteComment}
                        className="w-full text-left px-4 py-3 text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Comment
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsReportModalOpen(true); setShowMenu(false); }}
                        className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors"
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        Report Comment
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {comment.content && <FormattedText text={comment.content} className="mt-1 text-[15px] leading-normal dark:text-gray-200" />}
          {comment.mediaURL && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 inline-block cursor-pointer" onClick={() => setViewerImage(comment.mediaURL)}>
              <img src={comment.mediaURL} alt="Comment media" className="max-h-64 w-auto object-cover" />
            </div>
          )}

          {/* Reply button */}
          <div className="flex items-center space-x-4 mt-2">
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>
            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center space-x-1 text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{showReplies ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
              </button>
            )}
          </div>

          {/* Reply Form */}
          <AnimatePresence>
            {showReplyForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleReply}
                className="mt-3 flex items-start space-x-2"
              >
                <Avatar src={userProfile?.photoURL} alt={userProfile?.displayName} size="sm" />
                <div className="relative flex-1">
                  <textarea
                    ref={replyTextareaRef}
                    className="w-full resize-none border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                    placeholder={`Reply to @${author.username}... (use @ripoai to get AI help)`}
                    rows={2}
                    value={replyContent}
                    onChange={(e) => handleReplyContentChange(e.target.value, e.target.selectionStart)}
                    onSelect={(e) => handleReplyContentChange((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
                    maxLength={280}
                  />
                  {replyMentionQuery !== null && replyMentionUsers.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      {replyMentionUsers.map((candidate) => (
                        <button
                          key={candidate.uid}
                          type="button"
                          onClick={() => insertReplyMention(candidate.username)}
                          className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 last:border-b-0"
                        >
                          <Avatar src={candidate.photoURL} alt={candidate.displayName} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{candidate.displayName}</div>
                            <div className="truncate text-xs text-slate-500 dark:text-slate-400">@{candidate.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end mt-1">
                    <Button type="submit" disabled={!replyContent.trim() || isReplying} className="text-xs rounded-full px-4 py-1 h-7 bg-blue-500 text-white">
                      {isReplying ? '...' : 'Reply'}
                    </Button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <ReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          targetId={comment.id} 
          targetType="comment" 
        />
        <ImageViewer src={viewerImage || ''} isOpen={!!viewerImage} onClose={() => setViewerImage(null)} />
      </motion.div>

      {/* Nested Replies */}
      <AnimatePresence>
        {showReplies && replies.map(reply => (
          <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function InteractionModal({ 
  isOpen, 
  onClose, 
  title, 
  users, 
  loading 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  users: UserProfile[]; 
  loading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold capitalize dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5 dark:text-white" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : users.length > 0 ? (
            <div className="space-y-4">
              {users.map(user => (
                <Link key={user.uid} to={`/profile/${user.uid}`} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors">
                  <Avatar src={user.photoURL} alt={user.displayName} />
                  <div>
                    <div className="font-bold flex items-center dark:text-white">
                      {user.displayName}
                      {user.isVerified && <VerificationBadge className="ml-1 w-3 h-3" title="Verified" />}
                      <UserBadges badges={user.badges} hiddenBadges={user.hiddenBadges} badgeSize="w-3 h-3" />
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No {title} yet.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
