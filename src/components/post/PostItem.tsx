import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormattedText } from '../ui/FormattedText';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Repeat2, Share, MoreHorizontal, Flag, Trash2, Sparkles, SmilePlus, BadgeCheck, BriefcaseBusiness, Pencil, Check, X } from 'lucide-react';
import { doc, getDoc, setDoc, deleteDoc, increment, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { ReportModal } from '../ui/ReportModal';
import { RepostModal } from '../ui/RepostModal';
import { ImageViewer } from '../ui/ImageViewer';
import { updateChallengeProgress } from '../../lib/challenges';
import { VerificationBadge, UserBadges } from '../ui/VerificationBadge';
import { createNotification } from '../../lib/notifications';
import { getPostMedia } from '../../lib/postMedia';
import { PostMediaGrid } from './PostMediaGrid';
import { awardUserProgress } from '../../lib/levels';
import { LevelBadge } from '../ui/LevelBadge';
import { deletePostCascade } from '../../lib/dataCleanup';
import { getAvatarDecorationClass } from '../../lib/profileAppearance';
import { resolveOwnedShopUrl } from '../../lib/shopCatalog';
import { createMentionNotifications } from '../../lib/mentionNotifications';
import { adjustReactionCounts, canUsePostReactions, getReactionMeta, getTopReactionEntries, normalizePostReaction, POST_REACTIONS, SNAPLINK_REACTION_SET, type PostReaction } from '../../lib/reactions';
import { extractFirstExternalUrl, useLinkPreview } from '../../lib/linkPreview';
import { ReactionPicker, ReactionChip, ReactionGlyph } from '../ui/ReactionIcon';
import { getReadOnlyReason, isReadOnlyUser } from '../../lib/accessControl';
import { getRipoAIResponse, RIPOAI_PROFILE } from '../../lib/ripoai';

interface PostItemProps {
  key?: React.Key;
  post: {
    id: string;
    authorId: string;
    authorName?: string;
    authorUsername?: string;
    authorPhotoURL?: string | null;
    authorIsVerified?: boolean;
    authorBadges?: UserProfile['badges'];
    authorHiddenBadges?: string[];
    authorLevel?: number;
    authorProfileDecoration?: string | null;
    authorUnlockedDecorations?: string[];
    authorIsBusinessAccount?: boolean;
    authorBusinessAffiliations?: UserProfile['businessAffiliations'];
    content: string;
    mediaURLs?: string[];
    mediaTypes?: Array<'image' | 'video'>;
    media?: Array<{ url: string; type?: 'image' | 'video'; storagePath?: string | null }>;
    createdAt: string;
    editedAt?: string;
    updatedAt?: string;
    likesCount: number;
    reactionCounts?: Record<string, number>;
    commentsCount: number;
    repostsCount: number;
    repostOf?: string;
    poll?: {
      options: { id: string; text: string; votes: number }[];
      totalVotes: number;
      votedUsers: string[];
    };
  };
}

function getCreatedAtTime(value: any) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildFallbackAuthor(post: PostItemProps['post']): UserProfile {
  return {
    uid: post.authorId,
    username: post.authorUsername || 'member',
    displayName: post.authorName || 'SnapLink member',
    photoURL: post.authorPhotoURL || null,
    createdAt: '',
    followersCount: 0,
    followingCount: 0,
    role: 'member',
    isBanned: false,
    isVerified: Boolean(post.authorIsVerified),
    snapCoins: 0,
    badges: post.authorBadges || [],
    hiddenBadges: post.authorHiddenBadges || [],
    level: post.authorLevel || 1,
    profileDecoration: post.authorProfileDecoration || null,
    unlockedDecorations: post.authorUnlockedDecorations || [],
    isBusinessAccount: Boolean(post.authorIsBusinessAccount),
    businessAffiliations: post.authorBusinessAffiliations || [],
  };
}

const FEED_COLLAPSE_CHAR_COUNT = 360;

export function PostItem({ post }: PostItemProps) {
  const { userProfile } = useAuth();
  const readOnlyReason = getReadOnlyReason(userProfile);
  const navigate = useNavigate();
  const viewerUserId = userProfile?.uid || null;
  const fallbackAuthor = buildFallbackAuthor(post);
  const [author, setAuthor] = useState<UserProfile | null>(fallbackAuthor);
  const [isLiked, setIsLiked] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount);
  const [localReactionCounts, setLocalReactionCounts] = useState<Record<string, number>>(post.reactionCounts || {});
  const [pollData, setPollData] = useState(post.poll);
  const [hasVoted, setHasVoted] = useState(post.poll?.votedUsers?.includes(userProfile?.uid || '') || false);
  const [originalPost, setOriginalPost] = useState<any | null>(null);
  const [originalAuthor, setOriginalAuthor] = useState<UserProfile | null>(null);
  const [isReposted, setIsReposted] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<PostReaction | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [localRepostsCount, setLocalRepostsCount] = useState(post.repostsCount);
  const [showMenu, setShowMenu] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [topComments, setTopComments] = useState<any[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, UserProfile>>({});
  const [quickComment, setQuickComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [displayContent, setDisplayContent] = useState(post.content);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingContent, setEditingContent] = useState(post.content);
  const [isSavingPostEdit, setIsSavingPostEdit] = useState(false);
  const mediaItems = getPostMedia(post);
  const originalMediaItems = getPostMedia(originalPost);
  const linkPreviewUrl = extractFirstExternalUrl(displayContent);
  const { preview: linkPreview } = useLinkPreview(linkPreviewUrl);
  const activeReactionMeta = getReactionMeta(selectedReaction || POST_REACTIONS[0]);
  const canChooseReaction = canUsePostReactions(userProfile);
  const authorProfile = author || fallbackAuthor;
  const visibleAuthorDecoration = resolveOwnedShopUrl(authorProfile.profileDecoration || null, 'avatar', authorProfile.unlockedDecorations);
  const visibleOriginalAuthorDecoration = resolveOwnedShopUrl(originalAuthor?.profileDecoration || null, 'avatar', originalAuthor?.unlockedDecorations);
  const shouldClampContent = (displayContent?.length || 0) > FEED_COLLAPSE_CHAR_COUNT;
  const primaryBusinessAffiliation = authorProfile.businessAffiliations?.[0];
  const isOwnPost = userProfile?.uid === post.authorId;

  const shouldIgnorePostOpen = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('a, button, textarea, input, video, form, [data-post-interactive="true"]');
  };

  useEffect(() => {
    setLocalLikesCount(post.likesCount || 0);
  }, [post.id, post.likesCount]);

  useEffect(() => {
    setLocalReactionCounts(post.reactionCounts || {});
  }, [post.id, post.reactionCounts]);

  useEffect(() => {
    setLocalRepostsCount(post.repostsCount || 0);
  }, [post.id, post.repostsCount]);

  useEffect(() => {
    setPollData(post.poll);
    setHasVoted(post.poll?.votedUsers?.includes(viewerUserId || '') || false);
  }, [post.id, post.poll, viewerUserId]);

  useEffect(() => {
    setDisplayContent(post.content || '');
    if (!isEditingPost) {
      setEditingContent(post.content || '');
    }
  }, [isEditingPost, post.content]);

  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        const docRef = doc(db, 'users', post.authorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAuthor({
            ...fallbackAuthor,
            ...(docSnap.data() as UserProfile),
          });
        }
      } catch (error) {
        setAuthor((current) => current || fallbackAuthor);
        handleFirestoreError(error, OperationType.GET, `users/${post.authorId}`);
      }
    };

    const checkLikeAndRepost = async () => {
      if (!viewerUserId) {
        setIsLiked(false);
        setIsReposted(false);
        return;
      }
      try {
        const likeId = `${viewerUserId}_${post.id}`;
        const likeRef = doc(db, 'likes', likeId);
        const likeSnap = await getDoc(likeRef);
        setIsLiked(likeSnap.exists());
        setSelectedReaction(normalizePostReaction((likeSnap.data() as any)?.reaction));

        const repostId = `${viewerUserId}_${post.id}`;
        const repostRef = doc(db, 'reposts', repostId);
        const repostSnap = await getDoc(repostRef);
        setIsReposted(repostSnap.exists());
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `likes/reposts`);
      }
    };

    const fetchOriginalPost = async () => {
      if (post.repostOf) {
        try {
          const origPostRef = doc(db, 'posts', post.repostOf);
          const origPostSnap = await getDoc(origPostRef);
          if (origPostSnap.exists()) {
            const origPostData = origPostSnap.data();
            setOriginalPost({ id: origPostSnap.id, ...origPostData });
            
            const origAuthorRef = doc(db, 'users', origPostData.authorId);
            const origAuthorSnap = await getDoc(origAuthorRef);
            if (origAuthorSnap.exists()) {
              setOriginalAuthor(origAuthorSnap.data() as UserProfile);
            }
          }
        } catch (error) {
          console.error("Error fetching original post:", error);
        }
      }
    };

    fetchAuthor();
    checkLikeAndRepost();
    fetchOriginalPost();
  }, [fallbackAuthor, post.authorId, post.id, viewerUserId, post.repostOf]);

  useEffect(() => {
    const commentsQuery = query(collection(db, 'comments'), where('postId', '==', post.id));

    const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
      const previewComments = snapshot.docs
        .map((commentDoc) => ({ id: commentDoc.id, ...commentDoc.data() }))
        .filter((comment: any) => !comment.parentCommentId)
        .sort((a: any, b: any) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt))
        .slice(0, 5);

      setTopComments(previewComments);

      const missingAuthorIds = [...new Set(previewComments.map((comment: any) => comment.authorId))].filter(Boolean);

      if (missingAuthorIds.length === 0) return;

      const authorEntries = await Promise.all(
        missingAuthorIds.map(async (authorId) => {
          try {
            const authorSnap = await getDoc(doc(db, 'users', authorId));
            return authorSnap.exists() ? [authorId, authorSnap.data() as UserProfile] : null;
          } catch {
            return null;
          }
        })
      );

      setCommentAuthors((prev) => {
        const next = { ...prev };
        authorEntries.forEach((entry) => {
          if (entry) {
            next[entry[0]] = entry[1];
          }
        });
        return next;
      });
    });

    return () => unsubscribe();
  }, [post.id]);

  const persistLike = async (reaction: PostReaction | null) => {
    if (!userProfile) return;

    const likeId = `${userProfile.uid}_${post.id}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', post.id);
    const previousReaction = selectedReaction;

    if (isLiked) {
      const nextCounts = adjustReactionCounts(localReactionCounts, previousReaction, null);
      setIsLiked(false);
      setSelectedReaction(null);
      setLocalLikesCount((prev) => prev - 1);
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
    setLocalLikesCount((prev) => prev + 1);
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

    await awardUserProgress(userProfile.uid, { xp: 4 });
    await updateChallengeProgress(userProfile.uid, 'post_like');
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
    if (!userProfile) return;

    try {
      setShowReactionPicker(false);
      await persistLike(isLiked ? selectedReaction : POST_REACTIONS[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'likes/posts');
      // Revert optimistic update
      setIsLiked(!isLiked);
      setSelectedReaction(isLiked ? selectedReaction : null);
      setLocalLikesCount(isLiked ? localLikesCount + 1 : localLikesCount - 1);
      setLocalReactionCounts(post.reactionCounts || {});
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
      setLocalReactionCounts(post.reactionCounts || {});
    }
  };

  const handleQuickComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile || !quickComment.trim() || isCommenting) return;
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is in read-only mode.');
      return;
    }

    setIsCommenting(true);

    try {
      const commentText = quickComment.trim();
      const newCommentRef = doc(collection(db, 'comments'));
      await setDoc(newCommentRef, {
        id: newCommentRef.id,
        postId: post.id,
        authorId: userProfile.uid,
        content: commentText,
        mediaURL: null,
        createdAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });
      await awardUserProgress(userProfile.uid, { xp: 12 });
      await updateChallengeProgress(userProfile.uid, 'comment_create');

      if (post.authorId !== userProfile.uid) {
        await createNotification({
          type: 'comment',
          sourceUserId: userProfile.uid,
          targetUserId: post.authorId,
          postId: post.id,
          sourceUser: {
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL || null,
          },
        });
      }

      await createMentionNotifications({
        text: commentText,
        sourceUserId: userProfile.uid,
        sourceUser: {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || null,
        },
        postId: post.id,
        linkTo: `/post/${post.id}`,
        excludeUserIds: post.authorId !== userProfile.uid ? [post.authorId] : [],
        message: commentText.slice(0, 160),
      });

      if (commentText.toLowerCase().includes('@ripoai')) {
        try {
          const aiResponse = await getRipoAIResponse(
            commentText.replace(/@ripoai/gi, '').trim() || 'Someone mentioned me on SnapLink.',
            `This is a quick-reply comment on a post: "${post.content?.substring(0, 160)}"`
          );
          const aiCommentRef = doc(collection(db, 'comments'));
          await setDoc(aiCommentRef, {
            id: aiCommentRef.id,
            postId: post.id,
            authorId: RIPOAI_PROFILE.uid,
            isAIGenerated: true,
            aiInvokedBy: userProfile.uid,
            aiDisplayName: RIPOAI_PROFILE.displayName,
            aiPhotoURL: RIPOAI_PROFILE.photoURL,
            content: aiResponse,
            mediaURL: null,
            createdAt: new Date().toISOString(),
          });
          await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });
        } catch (aiError) {
          console.error('RipoAI quick comment reply failed:', aiError);
        }
      }

      setQuickComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    } finally {
      setIsCommenting(false);
    }
  };

  const handleVote = async (e: React.MouseEvent, optionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile || !pollData || hasVoted) return;

    const postRef = doc(db, 'posts', post.id);
    const previousPollData = pollData;
    const optionIndex = previousPollData.options.findIndex((option) => option.id === optionId);
    if (optionIndex === -1) return;

    const nextPollData = {
      ...previousPollData,
      totalVotes: (previousPollData.totalVotes || 0) + 1,
      votedUsers: [...(previousPollData.votedUsers || []), userProfile.uid],
      options: previousPollData.options.map((option, index) => (
        index === optionIndex ? { ...option, votes: (option.votes || 0) + 1 } : option
      )),
    };

    setPollData(nextPollData);
    setHasVoted(true);

    try {
      await updateDoc(postRef, {
        poll: nextPollData,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
      setPollData(previousPollData);
      setHasVoted(false);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile) return;

    if (isReposted) {
      // Undo repost
      const repostId = `${userProfile.uid}_${post.id}`;
      const repostRef = doc(db, 'reposts', repostId);
      const postRef = doc(db, 'posts', post.id);
      try {
        setIsReposted(false);
        setLocalRepostsCount((prev) => prev - 1);
        await deleteDoc(repostRef);
        await updateDoc(postRef, { repostsCount: increment(-1) });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'reposts/posts');
        setIsReposted(true);
        setLocalRepostsCount((prev) => prev + 1);
      }
    } else {
      // Show repost modal
      setShowRepostModal(true);
    }
  };

  const handleRepostConfirm = async (repostContent: string) => {
    if (!userProfile) return;

    const repostId = `${userProfile.uid}_${post.id}`;
    const repostRef = doc(db, 'reposts', repostId);
    const postRef = doc(db, 'posts', post.id);

    try {
      setIsReposted(true);
      setLocalRepostsCount((prev) => prev + 1);
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
        authorName: userProfile.displayName,
        authorUsername: userProfile.username,
        authorPhotoURL: userProfile.photoURL || null,
        authorIsVerified: userProfile.isVerified || false,
        authorBadges: userProfile.badges || [],
        authorHiddenBadges: userProfile.hiddenBadges || [],
        authorLevel: userProfile.level || 1,
        authorProfileDecoration: userProfile.profileDecoration || null,
        authorUnlockedDecorations: userProfile.unlockedDecorations || [],
        content: repostContent,
        repostOf: post.id,
        createdAt: new Date().toISOString(),
        likesCount: 0,
        reactionCounts: {},
        commentsCount: 0,
        repostsCount: 0,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reposts/posts');
      setIsReposted(false);
      setLocalRepostsCount((prev) => prev - 1);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
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
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const handleDeletePost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userProfile || (userProfile.uid !== post.authorId && userProfile.role !== 'admin')) return;
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deletePostCascade(post);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'posts');
      }
    }
    setShowMenu(false);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwnPost) return;
    setEditingContent(displayContent || '');
    setIsEditingPost(true);
    setShowMenu(false);
  };

  const handleCancelEdit = () => {
    setEditingContent(displayContent || '');
    setIsEditingPost(false);
  };

  const handleSaveEdit = async () => {
    if (!isOwnPost || isSavingPostEdit) return;
    const nextContent = editingContent.trim();
    if (!nextContent) return;
    if (nextContent === (displayContent || '').trim()) {
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
      setIsEditingPost(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${post.id}`);
    } finally {
      setIsSavingPostEdit(false);
    }
  };

  const handleOpenPost = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldIgnorePostOpen(e.target)) return;
    navigate(`/post/${post.id}`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="snaplink-post-shell relative overflow-hidden border-b border-slate-200 bg-white/98 dark:border-slate-800 dark:bg-slate-950/96 md:border-x md:border-b"
    >
      <div 
        onClick={handleOpenPost}
        className="block cursor-pointer px-4 py-4 transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-900/60 sm:px-5 sm:py-4"
      >
        {post.repostOf && (
          <div className="mb-3 ml-12 flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">
            <Repeat2 className="h-4 w-4 mr-2" />
            <span>{authorProfile.displayName} reposted</span>
          </div>
        )}
        <div className="flex gap-3">
        <Link to={`/profile/${authorProfile.uid}`} onClick={(e) => e.stopPropagation()}>
          <Avatar src={authorProfile.photoURL} alt={authorProfile.displayName} className={getAvatarDecorationClass(visibleAuthorDecoration, '')} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
              <Link to={`/profile/${authorProfile.uid}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center font-bold hover:underline dark:text-white">
                {authorProfile.displayName}
                {authorProfile.isVerified && <VerificationBadge className="ml-1 w-4 h-4" title="Verified" />}
                <UserBadges badges={authorProfile.badges} hiddenBadges={authorProfile.hiddenBadges} badgeSize="w-4 h-4" />
              </Link>
              {authorProfile.isBusinessAccount && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <BriefcaseBusiness className="h-3 w-3" />
                  Business
                </span>
              )}
              {primaryBusinessAffiliation && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <BadgeCheck className="h-3 w-3" />
                  {primaryBusinessAffiliation.badgeLabel}
                </span>
              )}
              <LevelBadge level={authorProfile.level || 1} compact className="ml-1" />
              <span className="truncate text-gray-500 dark:text-gray-400">@{authorProfile.username}</span>
              <span className="text-gray-500 dark:text-gray-400">·</span>
              <span className="text-gray-500 dark:text-gray-400 hover:underline">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </span>
            </div>
            </div>
            
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
                className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                  >
                    {isOwnPost && (
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="flex w-full items-center px-4 py-3 text-left text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Post
                      </button>
                    )}
                    {userProfile?.uid === post.authorId || userProfile?.role === 'admin' ? (
                      <button
                        type="button"
                        onClick={handleDeletePost}
                        className="w-full text-left px-4 py-3 text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Post
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsReportModalOpen(true); setShowMenu(false); }}
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
          
          {displayContent && (
          <div className="mt-2.5">
            {isEditingPost ? (
              <div className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50/90 p-3.5 dark:border-slate-700 dark:bg-slate-900/70">
                <textarea
                  value={editingContent}
                  onChange={(event) => setEditingContent(event.target.value)}
                  rows={5}
                  maxLength={5000}
                  data-post-interactive="true"
                  className="w-full resize-none rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-[15px] leading-6 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-400">{editingContent.length}/5000</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      disabled={!editingContent.trim() || isSavingPostEdit}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isSavingPostEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={shouldClampContent ? 'line-clamp-6' : ''}>
                    <FormattedText text={displayContent} className="text-[15px] leading-7 text-slate-900 dark:text-slate-100 sm:text-[1.02rem] sm:leading-7" />
                </div>
                {(post.editedAt || post.updatedAt) && (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Edited</p>
                )}
              </>
            )}
              {!isEditingPost && shouldClampContent && (
                <button
                  type="button"
                  data-post-interactive="true"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    navigate(`/post/${post.id}`);
                  }}
                  className="mt-2 text-sm font-semibold text-blue-500 transition-colors hover:text-blue-600"
                >
                  Open post to read more
                </button>
              )}
            </div>
          )}
          {!isEditingPost && linkPreview && (
            <a
              href={linkPreview.url}
              target="_blank"
              rel="noreferrer"
              data-post-interactive="true"
              onClick={(event) => event.stopPropagation()}
              className="mt-4 block overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/90 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-900"
            >
              {linkPreview.image ? (
                <img src={linkPreview.image} alt={linkPreview.title} className="h-40 w-full object-cover" />
              ) : null}
              <div className="px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">{linkPreview.siteName}</p>
                <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{linkPreview.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{linkPreview.description}</p>
              </div>
            </a>
          )}
          
          {post.repostOf && originalPost && originalAuthor && (
            <div className="mt-4 cursor-pointer rounded-[22px] border border-slate-200 p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900/50" onClick={(e) => { e.stopPropagation(); navigate(`/post/${originalPost.id}`); }}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Avatar src={originalAuthor.photoURL} alt={originalAuthor.displayName} size="sm" className={getAvatarDecorationClass(visibleOriginalAuthorDecoration, '')} />
                <span className="font-bold hover:underline dark:text-white">{originalAuthor.displayName}</span>
                {originalAuthor.isVerified && <VerificationBadge className="ml-1 w-4 h-4" title="Verified" />}
                <UserBadges badges={originalAuthor.badges} hiddenBadges={originalAuthor.hiddenBadges} badgeSize="w-4 h-4" />
                <LevelBadge level={originalAuthor.level || 1} compact />
                <span className="text-gray-500 dark:text-gray-400 text-sm">@{originalAuthor.username}</span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">·</span>
                <span className="text-gray-500 dark:text-gray-400 text-sm hover:underline">
                  {formatDistanceToNow(new Date(originalPost.createdAt), { addSuffix: true })}
                </span>
              </div>
              <FormattedText text={originalPost.content} className="text-[15px] leading-normal dark:text-gray-200" />
              
              <div data-post-interactive="true" onClick={(e) => e.stopPropagation()}>
                <PostMediaGrid
                  items={originalMediaItems}
                  onImageClick={(url) => setViewerImage(url)}
                />
              </div>
            </div>
          )}

          {!post.repostOf && (
            <div data-post-interactive="true" onClick={(e) => e.stopPropagation()}>
              <PostMediaGrid
                items={mediaItems}
                onImageClick={(url) => setViewerImage(url)}
              />
            </div>
          )}

          {pollData && (
            <div className="mt-4 space-y-2">
              {pollData.options.map((option) => {
                const percentage = pollData.totalVotes > 0 
                  ? Math.round((option.votes / pollData.totalVotes) * 100) 
                  : 0;
                
                return (
                  <div 
                    key={option.id} 
                    className={`relative cursor-pointer overflow-hidden rounded-xl border transition-colors ${hasVoted ? 'border-blue-200 dark:border-blue-800/60' : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-700'}`}
                    onClick={(e) => handleVote(e, option.id)}
                  >
                    {hasVoted && (
                      <div 
                        className="absolute top-0 left-0 bottom-0 bg-blue-100 dark:bg-blue-900/30 transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    )}
                    <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="font-medium dark:text-white">{option.text}</span>
                      {hasVoted && <span className="text-gray-600 dark:text-gray-400">{percentage}%</span>}
                    </div>
                  </div>
                );
              })}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {pollData.totalVotes} votes
              </div>
            </div>
          )}

          <div data-post-interactive="true" className="mt-4 rounded-[20px] border border-slate-200/80 bg-slate-50/90 p-3.5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Conversation
              </div>
              <button
                type="button"
                onClick={() => navigate(`/post/${post.id}`)}
                className="text-xs font-semibold text-blue-500 transition-colors hover:text-blue-600"
              >
                Open full thread
              </button>
            </div>

            {topComments.length > 0 ? (
              <div className="space-y-3">
                {topComments.map((comment) => {
                  const commentAuthor = commentAuthors[comment.authorId];
                  return (
                    <div key={comment.id} className="rounded-[20px] bg-white/90 p-3 shadow-sm dark:bg-slate-800/80">
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={commentAuthor?.photoURL}
                          alt={commentAuthor?.displayName || 'Comment author'}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
                              <span>{commentAuthor?.displayName || 'Someone'}</span>
                              {commentAuthor?.isVerified && <VerificationBadge className="w-3.5 h-3.5" title="Verified" />}
                              <UserBadges badges={commentAuthor?.badges} hiddenBadges={commentAuthor?.hiddenBadges} badgeSize="w-3.5 h-3.5" />
                              <LevelBadge level={commentAuthor?.level || 1} compact className="scale-[0.82] origin-left" />
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-3 text-[15px] text-gray-600 dark:text-gray-300 sm:text-sm">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No comments yet. Start the conversation here.
              </div>
            )}

            <form onSubmit={handleQuickComment} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Avatar src={userProfile?.photoURL} alt={userProfile?.displayName} size="sm" />
              <div className="flex-1 rounded-[20px] border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <textarea
                   value={quickComment}
                   onChange={(e) => setQuickComment(e.target.value)}
                    placeholder={isReadOnlyUser(userProfile) ? 'Read-only mode is active on this account' : `Reply to ${authorProfile.displayName} right here...`}
                    rows={2}
                    maxLength={280}
                    disabled={isReadOnlyUser(userProfile)}
                    className="w-full resize-none border-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-white"
                  />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-400">{quickComment.length}/280</span>
                  <button
                    type="submit"
                    disabled={isReadOnlyUser(userProfile) || !quickComment.trim() || isCommenting}
                    className="rounded-full bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
                  >
                    {isCommenting ? 'Posting...' : 'Comment'}
                  </button>
                </div>
              </div>
            </form>
          </div>

            {getTopReactionEntries(localReactionCounts).length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {getTopReactionEntries(localReactionCounts).map((entry) => (
                  <React.Fragment key={entry.emoji}>
                    <ReactionChip
                      reaction={entry.meta}
                      count={entry.count}
                      isActive={selectedReaction === entry.emoji}
                    />
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="snaplink-post-actions relative mt-4 flex w-full items-center justify-between gap-1 text-slate-500 dark:text-slate-400 sm:max-w-xl sm:justify-start sm:gap-3">
            <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="flex min-w-0 items-center justify-center gap-1 rounded-2xl py-1.5 hover:text-blue-500 group sm:justify-start" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/post/${post.id}`); }}>
              <div className="rounded-full p-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                <MessageCircle className="h-4 w-4" />
              </div>
              <span className="text-xs">{post.commentsCount > 0 ? post.commentsCount : ''}</span>
            </motion.button>
            <motion.button 
              type="button"
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className={`flex min-w-0 items-center justify-center gap-1 rounded-2xl py-1.5 group sm:justify-start ${isReposted ? 'text-green-500' : 'hover:text-green-500'}`} 
              onClick={handleRepost}
            >
              <div className="rounded-full p-2 group-hover:bg-green-50 dark:group-hover:bg-green-900/30 transition-colors">
                <motion.div animate={isReposted ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.4, ease: 'easeInOut' }}>
                  <Repeat2 className={`h-4 w-4 ${isReposted ? 'stroke-[3px]' : ''}`} />
                </motion.div>
              </div>
              <span className="text-xs">{localRepostsCount > 0 ? localRepostsCount : ''}</span>
            </motion.button>
              <motion.button 
                type="button"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className={`relative flex min-w-0 items-center justify-center gap-1 rounded-2xl py-1.5 group sm:justify-start ${isLiked ? '' : 'hover:text-blue-500'}`}
                style={isLiked ? { color: activeReactionMeta.color } : undefined}
                onClick={handleLike}
              >
                <div
                  className="rounded-full p-2 transition-colors relative group-hover:bg-blue-50 dark:group-hover:bg-blue-900/25"
                  style={isLiked ? { backgroundColor: activeReactionMeta.bgColor } : undefined}
                >
                  <motion.div animate={isLiked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }} className="flex h-4 w-4 items-center justify-center">
                    {isLiked && selectedReaction ? (
                      <ReactionGlyph reaction={activeReactionMeta} size={18} />
                    ) : (
                      <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                    )}
                  </motion.div>
                <AnimatePresence>
                  {showHeartAnimation && (
                    <>
                      {/* Main burst */}
                      <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <ReactionGlyph reaction={activeReactionMeta} size={18} />
                      </motion.div>
                      {/* Particle burst */}
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
                          animate={{ 
                            scale: [0.5, 0.3, 0], 
                            opacity: [1, 0.8, 0],
                            x: Math.cos((i / 6) * Math.PI * 2) * 25,
                            y: Math.sin((i / 6) * Math.PI * 2) * 25 - 10,
                          }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.03 }}
                          className="absolute pointer-events-none"
                          style={{ left: '50%', top: '50%' }}
                        >
                          <span
                            className="block h-2 w-2 rounded-full"
                            style={{ backgroundColor: activeReactionMeta.particleColors[i % activeReactionMeta.particleColors.length] }}
                          />
                        </motion.div>
                      ))}
                    </>
                  )}
                </AnimatePresence>
              </div>
              <motion.span 
                className="text-xs"
                animate={showHeartAnimation ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {localLikesCount > 0 ? localLikesCount : ''}
              </motion.span>
              </motion.button>
              {canChooseReaction && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={`flex min-w-0 items-center justify-center gap-1 rounded-2xl py-1.5 group sm:justify-start ${showReactionPicker ? 'text-fuchsia-500' : 'hover:text-fuchsia-500'}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowReactionPicker((prev) => !prev);
                }}
              >
                <div className="rounded-full p-2 group-hover:bg-fuchsia-50 dark:group-hover:bg-fuchsia-900/20 transition-colors">
                  <SmilePlus className="h-4 w-4" />
                </div>
              </motion.button>
              )}
              {canChooseReaction && (
                <div data-post-interactive="true" onClick={(e) => e.stopPropagation()}>
                  <ReactionPicker
                    reactions={SNAPLINK_REACTION_SET}
                    selectedEmoji={selectedReaction}
                    isOpen={showReactionPicker}
                    onPick={(reaction) => {
                      void handleReactionPick(reaction.emoji as PostReaction);
                    }}
                  />
                </div>
              )}
            <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="flex min-w-0 items-center justify-center gap-1 rounded-2xl py-1.5 hover:text-blue-500 group sm:justify-start" onClick={handleShare}>
              <div className="rounded-full p-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                <Share className="h-4 w-4" />
              </div>
            </motion.button>
          </div>
        </div>
      </div>
      </div>
      <ReportModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        targetId={post.id} 
        targetType="post" 
      />
      <RepostModal
        isOpen={showRepostModal}
        onClose={() => setShowRepostModal(false)}
        onRepost={handleRepostConfirm}
        originalContent={displayContent}
        originalAuthor={author?.username || ''}
      />
      <ImageViewer
        src={viewerImage || ''}
        isOpen={!!viewerImage}
        onClose={() => setViewerImage(null)}
      />
    </motion.div>
  );
}
