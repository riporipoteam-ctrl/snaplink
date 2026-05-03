export type PostMediaType = 'image' | 'video';

export interface PostMediaItem {
  url: string;
  type: PostMediaType;
  storagePath?: string | null;
}

type PostMediaSource = {
  media?: Array<Partial<PostMediaItem> & { url?: string }>;
  mediaURLs?: string[];
  mediaTypes?: PostMediaType[];
};

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv'];

export function getMediaTypeFromFile(file: File): PostMediaType {
  return file.type.startsWith('video/') ? 'video' : 'image';
}

export function getMediaTypeFromUrl(url: string): PostMediaType {
  if (!url) return 'image';

  if (url.startsWith('data:video/')) return 'video';
  if (url.startsWith('data:image/')) return 'image';

  const cleanUrl = url.split('?')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((extension) => cleanUrl.endsWith(extension)) ? 'video' : 'image';
}

export function getPostMedia(source: PostMediaSource | null | undefined): PostMediaItem[] {
  if (!source) return [];

  if (Array.isArray(source.media) && source.media.length > 0) {
    return source.media
      .filter((item): item is PostMediaItem => Boolean(item?.url))
      .map((item) => ({
        url: item.url!,
        type: item.type || getMediaTypeFromUrl(item.url || ''),
        storagePath: item.storagePath || null,
      }));
  }

  if (Array.isArray(source.mediaURLs)) {
    return source.mediaURLs
      .filter(Boolean)
      .map((url, index) => ({
        url,
        type: source.mediaTypes?.[index] || getMediaTypeFromUrl(url),
      }));
  }

  return [];
}
