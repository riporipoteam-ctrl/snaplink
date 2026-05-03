import React, { useState, useRef, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, increment, getDoc, getDocs, query, where, limit, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { AvatarStickerPicker } from '../ui/AvatarStickerPicker';
import { Image as ImageIcon, X, Search, Smile, BarChart2, Bold, Italic, Sticker } from 'lucide-react';
import { compressImage } from '../../lib/utils';
import { updateChallengeProgress } from '../../lib/challenges';
import { getRipoAIResponse, RIPOAI_PROFILE } from '../../lib/ripoai';
import { getMediaTypeFromFile } from '../../lib/postMedia';
import { awardUserProgress } from '../../lib/levels';
import { Link } from 'react-router-dom';
import { sanitizeStorageFileName, uploadOptimizedImage } from '../../lib/storageUploads';
import { createMentionNotifications } from '../../lib/mentionNotifications';
import { getReadOnlyReason, isReadOnlyUser } from '../../lib/accessControl';
import { getMentionCandidates, type MentionCandidate } from '../../lib/mentions';

const GIPHY_API_KEY = 'kcCL2LJMFVNJ0S13u0A2q4j1WwM7VXrc';
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

interface CreatePostProps {
  onSuccess?: () => void;
}

export function CreatePost({ onSuccess }: CreatePostProps) {
  const { userProfile } = useAuth();
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [hashtagQuery, setHashtagQuery] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionCandidate[]>([]);
  const [hashtagsList, setHashtagsList] = useState<string[]>([]);

  useEffect(() => {
    if (!showGifSearch) return;
    
    const fetchGifs = async () => {
      setIsSearchingGifs(true);
      try {
        const endpoint = gifQuery.trim() 
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(gifQuery)}&limit=20`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20`;
        
        const response = await fetch(endpoint);
        const data = await response.json();
        setGifs(data.data || []);
      } catch (error) {
        console.error('Error fetching GIFs:', error);
      } finally {
        setIsSearchingGifs(false);
      }
    };

    const timeoutId = setTimeout(fetchGifs, 500);
    return () => clearTimeout(timeoutId);
  }, [gifQuery, showGifSearch]);

  useEffect(() => {
    if (mentionQuery === null) return;
    const fetchUsers = async () => {
      try {
        const results = await getMentionCandidates(userProfile || null, mentionQuery);
        setMentionUsers(results);
      } catch (err) {}
    };
    const timeoutId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [mentionQuery]);

  useEffect(() => {
    if (hashtagQuery === null) return;
    const fetchHashtags = async () => {
      try {
        const hQuery = query(collection(db, 'hashtags'), orderBy('count', 'desc'), limit(40));
        const snap = await getDocs(hQuery);
        const normalizedQuery = hashtagQuery.toLowerCase();
        const nextTags = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() as any;
            return (data.tag || data.name || `#${docSnap.id}`) as string;
          })
          .filter((tag) => {
            if (!normalizedQuery) return true;
            return tag.toLowerCase().startsWith(`#${normalizedQuery}`) || tag.toLowerCase().startsWith(normalizedQuery);
          })
          .slice(0, 5);
        setHashtagsList(nextTags);
      } catch (err) {}
    };
    const timeoutId = setTimeout(fetchHashtags, 300);
    return () => clearTimeout(timeoutId);
  }, [hashtagQuery]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    
    const position = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, position);
    const match = textBeforeCursor.match(/(?:^|\s)([@#])([a-zA-Z0-9_]*)$/);
    
    if (match) {
      if (match[1] === '@') {
        setMentionQuery(match[2]);
        setHashtagQuery(null);
      } else {
        setHashtagQuery(match[2]);
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
      setHashtagQuery(null);
    }
  };

  const insertCompletion = (type: '@' | '#', value: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const position = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, position);
    const textAfterCursor = content.substring(position);
    
    const match = textBeforeCursor.match(/(?:^|\s)([@#])([a-zA-Z0-9_]*)$/);
    if (match) {
      const startToReplace = position - match[0].length;
      const isLeadingSpace = match[0].startsWith(' ') || match[0].startsWith('\n');
      const replaceStart = isLeadingSpace ? startToReplace + 1 : startToReplace;
      
      const newContent = content.substring(0, replaceStart) + `${type}${value} ` + textAfterCursor;
      setContent(newContent);
      setMentionQuery(null);
      setHashtagQuery(null);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(replaceStart + value.length + 2, replaceStart + value.length + 2);
      }, 0);
    }
  };

  const applyFormatting = (format: 'bold' | 'italic') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let newContent = content;
    if (format === 'bold') {
      newContent = content.substring(0, start) + `**${selectedText}**` + content.substring(end);
    } else if (format === 'italic') {
      newContent = content.substring(0, start) + `*${selectedText}*` + content.substring(end);
    }
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      const cursor = start + (format === 'bold' ? 2 : 1) + selectedText.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files as FileList).filter((file: File) => {
        if (getMediaTypeFromFile(file) === 'video' && file.size > MAX_VIDEO_SIZE_BYTES) {
          alert(`${file.name} is too large. Videos can be up to 50 MB.`);
          return false;
        }
        return true;
      });

      const shouldReplaceExternalMedia =
        mediaFiles.length === 0 &&
        mediaPreviews.some((preview) => preview.startsWith('http://') || preview.startsWith('https://'));

      const nextFilesBase = shouldReplaceExternalMedia ? [] : mediaFiles;
      const nextPreviewsBase = shouldReplaceExternalMedia ? [] : mediaPreviews;
      const newFiles = [...nextFilesBase, ...selectedFiles].slice(0, 4);
      setMediaFiles(newFiles);
      
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setMediaPreviews([...nextPreviewsBase, ...newPreviews].slice(0, 4));
      
      setShowGifSearch(false);
      setShowStickerPicker(false);
      setShowPoll(false);
    }
  };

  const handleSelectGif = (gifUrl: string) => {
    setMediaFiles([]);
    setMediaPreviews([gifUrl]);
    setShowGifSearch(false);
    setShowPoll(false);
  };

  const removeMedia = (index: number) => {
    const newFiles = [...mediaFiles];
    newFiles.splice(index, 1);
    setMediaFiles(newFiles);

    const newPreviews = [...mediaPreviews];
    const removedPreview = newPreviews[index];
    if (removedPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(removedPreview);
    }
    newPreviews.splice(index, 1);
    setMediaPreviews(newPreviews);
    
    if (newFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearAllMedia = () => {
    mediaPreviews.forEach((preview) => {
      if (preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    });
    setMediaFiles([]);
    setMediaPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      const newOptions = [...pollOptions];
      newOptions.splice(index, 1);
      setPollOptions(newOptions);
    }
  };

  const handlePollOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validPollOptions = pollOptions.filter(opt => opt.trim() !== '');
    const hasValidPoll = showPoll && validPollOptions.length >= 2;
    
    if (!userProfile || (!content.trim() && mediaFiles.length === 0 && mediaPreviews.length === 0 && !hasValidPoll)) return;

    const readOnlyReason = getReadOnlyReason(userProfile);
    if (isReadOnlyUser(userProfile)) {
      alert(readOnlyReason || 'Your account is currently in read-only mode.');
      return;
    }

    if (userProfile.timeoutUntil && new Date(userProfile.timeoutUntil) > new Date()) {
      alert(`You are timed out until ${new Date(userProfile.timeoutUntil).toLocaleString()}`);
      return;
    }

    setLoading(true);
    try {
      const postsRef = collection(db, 'posts');
      const newPostRef = doc(postsRef);
      const mediaItems: Array<{ url: string; type: 'image' | 'video'; storagePath?: string | null }> = mediaFiles.length > 0
        ? await Promise.all(
            mediaFiles.map(async (file) => {
              if (getMediaTypeFromFile(file) === 'video') {
                const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
                const storagePath = `posts/${userProfile.uid}/${newPostRef.id}/${Date.now()}-${safeFileName}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, file);
                const downloadUrl = await getDownloadURL(storageRef);
                return {
                  url: downloadUrl,
                  type: 'video' as const,
                  storagePath,
                };
              }

              const safeFileName = sanitizeStorageFileName(file.name || `image-${Date.now()}.jpg`);
              const storagePath = `posts/${userProfile.uid}/${newPostRef.id}/${Date.now()}-${safeFileName}`;
              const uploadedImage = await uploadOptimizedImage(file, storagePath, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.7,
                timeoutMs: 12000,
                allowDataUrlFallback: true,
                preferDataUrl: file.size <= 900000,
              });
              return {
                url: uploadedImage.url,
                type: 'image' as const,
                storagePath: uploadedImage.storagePath,
              };
            })
          )
        : [];

      if (mediaFiles.length === 0 && mediaPreviews.length > 0) {
        for (const preview of mediaPreviews) {
          if (preview.startsWith('http://') || preview.startsWith('https://')) {
            mediaItems.push({
              url: preview,
              type: 'image',
            });
          }
        }
      }
      
      const postData: any = {
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
        authorIsBusinessAccount: userProfile.isBusinessAccount || false,
        authorBusinessAffiliations: userProfile.businessAffiliations || [],
        content: content.trim(),
        media: mediaItems,
        mediaURLs: mediaItems.map((item) => item.url),
        mediaTypes: mediaItems.map((item) => item.type),
        createdAt: new Date().toISOString(),
        likesCount: 0,
        reactionCounts: {},
        commentsCount: 0,
        repostsCount: 0,
      };

      if (hasValidPoll) {
        postData.poll = {
          options: validPollOptions.map((opt, idx) => ({ id: idx.toString(), text: opt, votes: 0 })),
          totalVotes: 0,
          votedUsers: []
        };
      }

      await setDoc(newPostRef, postData);

      await createMentionNotifications({
        text: content.trim(),
        sourceUserId: userProfile.uid,
        sourceUser: {
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || null,
        },
        postId: newPostRef.id,
        linkTo: `/post/${newPostRef.id}`,
        message: content.trim().slice(0, 160),
      });
      
      // Extract and update hashtags
      const hashtags = content.match(/#[a-zA-Z0-9_]+/g) || [];
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

      // Post created! Reset the form immediately
      const postContent = content.trim();
      const postId = newPostRef.id;
      setContent('');
      clearAllMedia();
      setShowPoll(false);
      setPollOptions(['', '']);
      setLoading(false);

      // Do reward/challenge updates in background (don't block UI)
      try {
        await awardUserProgress(userProfile.uid, {
          snapCoins: 10,
          xp: 24,
        });
        await updateChallengeProgress(userProfile.uid, 'post_create');
      } catch (rewardError) {
        console.warn('Could not update rewards/challenges:', rewardError);
      }

      onSuccess?.();

      // Auto-respond if @ripoai is mentioned in the post
      if (postContent.toLowerCase().includes('@ripoai')) {
        try {
          const userQuestion = postContent.replace(/@ripoai/gi, '').trim();
          const aiResponse = await getRipoAIResponse(userQuestion || 'Someone tagged me in a post!');
          const commentsRef = collection(db, 'comments');
          const aiCommentRef = doc(commentsRef);
          await setDoc(aiCommentRef, {
            id: aiCommentRef.id,
            postId,
            authorId: userProfile.uid,
            isAIGenerated: true,
            aiDisplayName: RIPOAI_PROFILE.displayName,
            aiPhotoURL: RIPOAI_PROFILE.photoURL,
            content: aiResponse,
            mediaURL: null,
            createdAt: new Date().toISOString(),
          });
          await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
        } catch (aiErr) {
          console.warn('RipoAI auto-reply on post failed:', aiErr);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Upload timed out")) {
        alert(error.message);
      } else {
        handleFirestoreError(error, OperationType.CREATE, 'posts');
      }
      setLoading(false);
    }
  };

  return (
      <div className="snaplink-composer-surface px-3 py-3 sm:px-5 sm:py-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link to="/profile" aria-label="Open your profile">
          <Avatar src={userProfile?.photoURL} alt={userProfile?.displayName} />
        </Link>
        <div className="flex-1">
          <form onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className="relative z-10 min-h-[3.2rem] w-full resize-none border-none bg-transparent text-[1.02rem] font-medium leading-7 placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder-slate-500 sm:min-h-[3.6rem] sm:text-[1.08rem]"
              placeholder="What is happening?!"
              rows={2}
              value={content}
              onChange={handleTextareaChange}
              onSelect={handleTextareaChange as any}
              maxLength={5000}
            />
            <div className="relative w-full">
              {mentionQuery !== null && mentionUsers.length > 0 && (
                <div className="absolute top-0 left-0 right-0 z-20 mt-1 w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {mentionUsers.map(u => (
                    <div key={u.uid} onClick={() => insertCompletion('@', u.username)} className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <Avatar src={u.photoURL} alt={u.displayName} size="sm" />
                      <div>
                        <div className="font-bold text-sm dark:text-white flex items-center gap-2">
                          <span>{u.displayName}</span>
                          {u.isVirtual ? (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-purple-600 dark:bg-purple-500/20 dark:text-purple-300">
                              AI
                            </span>
                          ) : null}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">@{u.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {hashtagQuery !== null && hashtagsList.length > 0 && (
                <div className="absolute top-0 left-0 right-0 z-20 mt-1 w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {hashtagsList.map(tag => (
                    <div key={tag} onClick={() => insertCompletion('#', tag)} className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="bg-blue-100 text-blue-500 w-8 h-8 rounded-full flex items-center justify-center font-bold">#</div>
                      <div className="font-bold text-sm dark:text-white">{tag}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {mediaPreviews.length > 0 && (
              <div className={`mt-3 mb-4 grid gap-2 ${mediaPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {mediaPreviews.map((preview, index) => (
                  <div key={index} className={`group relative overflow-hidden rounded-[22px] border border-slate-200 dark:border-slate-700 ${preview.includes('api.dicebear.com') ? 'bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),rgba(255,255,255,0.95)_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),rgba(15,23,42,0.92)_65%)]' : ''}`}>
                    {mediaFiles[index] && getMediaTypeFromFile(mediaFiles[index]) === 'video' ? (
                      <video src={preview} className="h-48 w-full object-cover" controls muted playsInline preload="metadata" />
                    ) : (
                      <img src={preview} alt="Upload preview" className={`w-full h-48 ${preview.includes('api.dicebear.com') ? 'object-contain p-4' : 'object-cover'}`} />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showGifSearch && mediaPreviews.length === 0 && (
              <div className="mt-3 mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center border-b border-gray-100 p-3 dark:border-gray-700">
                  <Search className="h-4 w-4 text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search for GIFs..."
                    className="w-full text-sm outline-none dark:bg-transparent dark:text-white"
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowGifSearch(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                <div className="h-64 overflow-y-auto p-2 grid grid-cols-2 gap-2">
                  {isSearchingGifs ? (
                    <div className="col-span-2 text-center py-8 text-gray-500 text-sm">Searching...</div>
                  ) : gifs.length > 0 ? (
                    gifs.map((gif) => (
                      <img
                        key={gif.id}
                        src={gif.images.fixed_height.url}
                        alt={gif.title}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleSelectGif(gif.images.original.url)}
                      />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 text-gray-500 text-sm">No GIFs found</div>
                  )}
                </div>
              </div>
            )}

            {showPoll && mediaPreviews.length === 0 && (
              <div className="mt-3 mb-4 rounded-xl border border-gray-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300">Poll</span>
                  <button type="button" onClick={() => setShowPoll(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Choice ${index + 1}`}
                        className="flex-1 rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        value={option}
                        onChange={(e) => handlePollOptionChange(index, e.target.value)}
                        maxLength={25}
                      />
                      {pollOptions.length > 2 && (
                        <button type="button" onClick={() => handleRemovePollOption(index)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="mt-2 text-blue-500 text-sm font-bold hover:underline"
                  >
                    + Add choice
                  </button>
                )}
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-0.5 text-blue-500 sm:gap-1">
                <button 
                  type="button" 
                  className="rounded-full p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors sm:p-2.5"
                  onClick={() => {
                    setShowGifSearch(false);
                    setShowPoll(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
                <button 
                  type="button" 
                    className={`rounded-full p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors sm:p-2.5 ${showGifSearch ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onClick={() => {
                    setShowGifSearch(!showGifSearch);
                    setShowPoll(false);
                    setShowStickerPicker(false);
                  }}
                  disabled={mediaPreviews.length > 0 || showPoll}
                >
                  <Smile className="h-5 w-5" />
                </button>
                <div className="relative">
                  <button 
                    type="button" 
                    className={`rounded-full p-2 hover:bg-blue-50 dark:hover:bg-purple-900/20 transition-colors sm:p-2.5 ${showStickerPicker ? 'bg-blue-50 dark:bg-purple-900/20 text-purple-500' : ''}`}
                    onClick={() => {
                      setShowStickerPicker(!showStickerPicker);
                      setShowGifSearch(false);
                      setShowPoll(false);
                    }}
                    disabled={mediaPreviews.length > 0}
                  >
                    <Sticker className="h-5 w-5" />
                  </button>
                  <AvatarStickerPicker
                    isOpen={showStickerPicker}
                    onClose={() => setShowStickerPicker(false)}
                    onSelect={(stickerUrl) => {
                      setMediaPreviews([stickerUrl]);
                      setShowStickerPicker(false);
                    }}
                    userSeed={userProfile?.displayName || 'user'}
                    userPhotoURL={userProfile?.photoURL}
                  />
                </div>
                <button 
                  type="button" 
                  className={`rounded-full p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors sm:p-2.5 ${showPoll ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onClick={() => {
                    setShowPoll(!showPoll);
                    setShowGifSearch(false);
                    setShowStickerPicker(false);
                    clearAllMedia();
                  }}
                  disabled={mediaPreviews.length > 0 || showGifSearch}
                >
                  <BarChart2 className="h-5 w-5" />
                </button>
                <button 
                  type="button" 
                  className="rounded-full p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors sm:p-2.5"
                  onClick={() => applyFormatting('bold')}
                  title="Bold"
                >
                  <Bold className="h-5 w-5" />
                </button>
                <button 
                  type="button" 
                  className="rounded-full p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors sm:p-2.5"
                  onClick={() => applyFormatting('italic')}
                  title="Italic"
                >
                  <Italic className="h-5 w-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleMediaChange} 
                  accept="image/*,video/*" 
                  multiple
                  className="hidden" 
                />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 sm:block">
                  {content.length}/5000
                </div>
                <Button
                  type="submit"
                  disabled={(!content.trim() && mediaPreviews.length === 0 && (!showPoll || pollOptions.filter(o => o.trim()).length < 2)) || loading}
                  className="h-10 rounded-full bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:h-11 sm:px-6"
                >
                  {loading ? 'Posting...' : 'Post'}
                </Button>
              </div>
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 sm:hidden">
                {content.length}/5000
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
