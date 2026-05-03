const META_PATTERNS = {
  title: [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<title>([^<]+)<\/title>/i,
  ],
  description: [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
  ],
  siteName: [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
  ],
  image: [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ],
};

function extractMeta(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return '';
}

export default async function handler(req, res) {
  const rawUrl = req.query?.url;
  if (!rawUrl) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    const url = new URL(String(rawUrl));
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported URL protocol.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SnapLink-LinkPreview/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const html = await response.text();

    res.status(200).json({
      title: extractMeta(html, META_PATTERNS.title),
      description: extractMeta(html, META_PATTERNS.description),
      siteName: extractMeta(html, META_PATTERNS.siteName) || url.hostname.replace(/^www\./i, ''),
      image: extractMeta(html, META_PATTERNS.image) || null,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not load preview',
    });
  }
}
