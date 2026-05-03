import { useEffect, useState } from 'react';

export type LinkPreviewData = {
  url: string;
  title: string;
  description: string;
  siteName: string;
  image?: string | null;
};

const previewCache = new Map<string, LinkPreviewData | null>();

export function extractFirstExternalUrl(text?: string | null) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match?.[0] || null;
}

function buildFallbackPreview(url: string): LinkPreviewData {
  try {
    const parsed = new URL(url);
    const hostLabel = parsed.hostname.replace(/^www\./i, '');
    const title = hostLabel
      .split('.')
      .slice(0, -1)
      .join(' ')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()) || hostLabel;

    return {
      url,
      title,
      description: parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : hostLabel,
      siteName: hostLabel,
      image: null,
    };
  } catch {
    return {
      url,
      title: url,
      description: 'Open this link in a new tab.',
      siteName: 'External link',
      image: null,
    };
  }
}

export function useLinkPreview(url?: string | null) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(() => {
    if (!url) return null;
    return previewCache.get(url) ?? null;
  });
  const [loading, setLoading] = useState(Boolean(url && !previewCache.has(url)));

  useEffect(() => {
    if (!url) {
      setPreview(null);
      setLoading(false);
      return;
    }

    const cached = previewCache.get(url);
    if (cached !== undefined) {
      setPreview(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Preview failed: ${response.status}`)))
      .then((data) => {
        const normalized: LinkPreviewData = {
          url,
          title: data?.title || buildFallbackPreview(url).title,
          description: data?.description || buildFallbackPreview(url).description,
          siteName: data?.siteName || buildFallbackPreview(url).siteName,
          image: data?.image || null,
        };
        previewCache.set(url, normalized);
        if (!cancelled) {
          setPreview(normalized);
        }
      })
      .catch(() => {
        const fallback = buildFallbackPreview(url);
        previewCache.set(url, fallback);
        if (!cancelled) {
          setPreview(fallback);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { preview, loading };
}
