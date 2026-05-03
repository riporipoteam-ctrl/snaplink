import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { ImagePlus, Music4, Pause, Play, Type, Video, X } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import type { UserProfile } from '../../contexts/AuthContext';
import { sanitizeStorageFileName, uploadOptimizedImage } from '../../lib/storageUploads';
import { STORY_MUSIC_LIBRARY, type StoryFontStyle } from '../../lib/stories';

interface StoryComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
}

type StoryPreview = {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
};

const MAX_INLINE_STORY_VIDEO_BYTES = 700 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not prepare the file.'));
    reader.readAsDataURL(file);
  });
}

export function StoryComposerModal({ isOpen, onClose, userProfile }: StoryComposerModalProps) {
  const [previews, setPreviews] = useState<StoryPreview[]>([]);
  const [caption, setCaption] = useState('');
  const [captionStyle, setCaptionStyle] = useState<StoryFontStyle>('headline');
  const [musicId, setMusicId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewingTrack, setIsPreviewingTrack] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const selectedTrack = useMemo(
    () => STORY_MUSIC_LIBRARY.find((track) => track.id === musicId) || null,
    [musicId]
  );

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [isOpen, previews]);

  useEffect(() => {
    if (!isOpen) {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
      setPreviews([]);
      setCaption('');
      setCaptionStyle('headline');
      setMusicId('');
      setError('');
      setIsSubmitting(false);
      setIsPreviewingTrack(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedTrack || !audioPreviewRef.current) {
      setIsPreviewingTrack(false);
      return;
    }

    audioPreviewRef.current.pause();
    audioPreviewRef.current.currentTime = 0;
    setIsPreviewingTrack(false);
  }, [selectedTrack?.id]);

  const uploadStoryVideo = async (file: File, storagePath: string) => {
    const uploadRef = ref(storage, storagePath);

    try {
      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(uploadRef, file, {
          contentType: file.type || 'video/mp4',
        });

        const timeoutId = window.setTimeout(() => {
          task.cancel();
          reject(new Error('Story video upload timed out.'));
        }, 45000);

        task.on(
          'state_changed',
          undefined,
          (uploadError) => {
            window.clearTimeout(timeoutId);
            reject(uploadError);
          },
          () => {
            window.clearTimeout(timeoutId);
            resolve();
          }
        );
      });

      return {
        url: await getDownloadURL(uploadRef),
        storagePath,
      };
    } catch (error) {
      if (file.size <= MAX_INLINE_STORY_VIDEO_BYTES) {
        return {
          url: await readFileAsDataUrl(file),
          storagePath: null,
        };
      }

      throw new Error(
        'Story video upload needs working storage right now. Use an image story or a clip under 700 KB on the current plan.'
      );
    }
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = (event.target.files ? Array.from(event.target.files as FileList) : []).slice(0, 6) as File[];
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    const nextPreviews = files.map((file, index) => ({
      id: `${file.name}-${file.size}-${index}`,
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    })) as StoryPreview[];
    setPreviews(nextPreviews);
    setError('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!userProfile?.uid) return;
    if (previews.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    const now = Date.now();
    const storyGroupId = `${userProfile.uid}_${now}`;
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    try {
      let publishedCount = 0;
      const failures: string[] = [];

      for (const [index, preview] of previews.entries()) {
        try {
          const storyRef = doc(collection(db, 'stories'));
          const safeFileName = sanitizeStorageFileName(preview.file.name || `story-${Date.now()}`);
          let mediaUrl = preview.url;
          let mediaStoragePath: string | null = null;

          if (preview.type === 'image') {
            const uploadedImage = await uploadOptimizedImage(
              preview.file,
              `stories/${userProfile.uid}/${storyGroupId}/${Date.now()}-${safeFileName}`,
              {
                maxWidth: 1080,
                maxHeight: 1920,
                quality: 0.72,
                timeoutMs: 16000,
                retryCount: 1,
                allowDataUrlFallback: true,
                preferDataUrl: true,
              }
            );
            mediaUrl = uploadedImage.url;
            mediaStoragePath = uploadedImage.storagePath;
          } else {
            if (preview.file.size > 25 * 1024 * 1024) {
              throw new Error('Story videos must stay under 25 MB for now.');
            }
            const uploadedVideo = await uploadStoryVideo(
              preview.file,
              `stories/${userProfile.uid}/${storyGroupId}/${Date.now()}-${safeFileName}`
            );
            mediaUrl = uploadedVideo.url;
            mediaStoragePath = uploadedVideo.storagePath;
          }

          await setDoc(storyRef, {
            id: storyRef.id,
            authorId: userProfile.uid,
            authorName: userProfile.displayName,
            authorUsername: userProfile.username,
            authorPhotoURL: userProfile.photoURL || null,
            createdAt,
            expiresAt,
            mediaUrl,
            mediaType: preview.type,
            mediaStoragePath,
            storyGroupId,
            storyIndex: index,
            caption: caption.trim(),
            captionStyle,
            musicId: selectedTrack?.id || null,
            musicTitle: selectedTrack?.title || null,
            musicArtist: selectedTrack?.artist || null,
            musicUrl: selectedTrack?.url || null,
            viewsCount: 0,
            reactionsCount: 0,
          });

          publishedCount += 1;
        } catch (publishError) {
          console.error('Story item publish failed:', publishError);
          failures.push(
            publishError instanceof Error
              ? publishError.message
              : 'One story slide failed to publish.'
          );
        }
      }

      if (publishedCount === 0) {
        throw new Error(failures[0] || 'Story upload did not finish. Try again in a moment.');
      }

      onClose();
      if (failures.length > 0) {
        window.setTimeout(() => {
          alert(`Published ${publishedCount} story slide${publishedCount === 1 ? '' : 's'}, but ${failures.length} failed. ${failures[0]}`);
        }, 120);
      }
    } catch (submitError) {
      console.error('Failed to create story:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Story upload did not finish. Try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTrackPreview = async () => {
    if (!selectedTrack || !audioPreviewRef.current) return;

    if (isPreviewingTrack) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
      setIsPreviewingTrack(false);
      return;
    }

    try {
      audioPreviewRef.current.currentTime = 0;
      await audioPreviewRef.current.play();
      setIsPreviewingTrack(true);
    } catch (previewError) {
      console.error('Song preview failed:', previewError);
      setIsPreviewingTrack(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-500">Stories studio</p>
            <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Create a new story</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-0 overflow-y-auto md:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800 md:border-b-0 md:border-r">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-blue-300 bg-blue-50/70 px-4 py-4 text-sm font-bold text-blue-600 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
            >
              <ImagePlus className="h-5 w-5" />
              Add images or videos
            </button>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {previews.length > 0 ? (
                previews.map((preview) => (
                  <div key={preview.id} className="relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                    {preview.type === 'video' ? (
                      <video src={preview.url} className="h-44 w-full object-cover" muted playsInline />
                    ) : (
                      <img src={preview.url} alt="Story preview" className="h-44 w-full object-cover" />
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                      {preview.type === 'video' ? 'Video' : 'Image'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 flex h-56 flex-col items-center justify-center rounded-[1.5rem] border border-slate-200 bg-slate-50 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <Video className="mb-3 h-8 w-8" />
                  <p className="text-sm font-semibold">Story previews will show here.</p>
                  <p className="mt-1 text-xs">Upload one or more images/videos to build a full story set.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Type className="h-4 w-4 text-blue-500" />
                Overlay text
              </label>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value.slice(0, 220))}
                rows={4}
                placeholder="Say something on your story..."
                className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-400">{caption.length}/220</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Font style</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['headline', 'Headline'],
                  ['classic', 'Classic'],
                  ['mono', 'Mono'],
                ] as Array<[StoryFontStyle, string]>).map(([style, label]) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setCaptionStyle(style)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                      captionStyle === style
                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Music4 className="h-4 w-4 text-blue-500" />
                Story soundtrack
              </label>
              <div className="flex gap-2">
                <select
                  value={musicId}
                  onChange={(event) => setMusicId(event.target.value)}
                  className="min-w-0 flex-1 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="">No song</option>
                  {STORY_MUSIC_LIBRARY.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title} · {track.artist}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedTrack}
                  onClick={toggleTrackPreview}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {isPreviewingTrack ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  Preview
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Stories stay live for 24 hours. You can upload multiple slides in one go, layer in text, and add one of the built-in SnapLink songs.
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={previews.length === 0 || isSubmitting}
              className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {isSubmitting ? 'Publishing story...' : `Publish ${previews.length > 1 ? `${previews.length} stories` : 'story'}`}
            </button>
          </div>
        </div>
      </div>
      {selectedTrack ? (
        <audio
          ref={audioPreviewRef}
          src={selectedTrack.url}
          hidden
          onEnded={() => setIsPreviewingTrack(false)}
        />
      ) : null}
    </div>
  );
}
