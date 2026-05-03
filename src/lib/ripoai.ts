import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import {
  WORLD_CUP_2026_END,
  WORLD_CUP_2026_FIXTURE_DAYS,
  WORLD_CUP_2026_GROUPS,
  WORLD_CUP_2026_HOST_CITIES,
  WORLD_CUP_2026_START,
} from './worldCup2026';

export type RipoAIMode = 'chat';

export type RipoAIAttachmentContext = {
  name: string;
  mimeType: string;
  size: number;
  excerpt?: string;
  kind?: 'image' | 'video' | 'file';
  dataUrl?: string;
};

export type RipoAIRequestOptions = {
  context?: string;
  mode?: RipoAIMode;
  attachments?: RipoAIAttachmentContext[];
};

export type RipoAIImageGenerationResult = {
  imageUrl: string;
  downloadUrl: string;
  prompt: string;
  seed: string;
  size: number;
  mimeType: string;
};

export type RipoAIVideoGenerationResult = {
  videoUrl: string;
  downloadUrl: string;
  prompt: string;
  seed: string;
  size: number;
  mimeType: string;
};

const BROWSER_GROQ_API_KEY = '';
const DEFAULT_MODEL = 'qwen/qwen3-32b';
const DEFAULT_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const DEFAULT_CODE_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_MAX_COMPLETION_TOKENS = 1024;
const DEFAULT_VISION_MAX_COMPLETION_TOKENS = 768;
const DEFAULT_CODE_MAX_COMPLETION_TOKENS = 3072;
const HEAVY_CODE_REQUEST_PATTERN =
  /\b(full|complete|entire|huge|large|massive|production-ready|from scratch|deep refactor|full stack)\b[\s\S]{0,80}\b(code|website|web app|app|platform|system|repo|repository|frontend|backend)\b/i;
const SNAPLINK_LIVE_CONTEXT_PATTERN =
  /\b(snaplink|post|posts|story|stories|group|groups|announcement|announcements|live|trend|trending|what'?s happening)\b/i;
const WEB_LOOKUP_PATTERN =
  /\b(search|look up|lookup|who is|what is|tell me about|find info on|latest on)\b/i;
const WORLD_CUP_CONTEXT_PATTERN =
  /\b(world cup|fifa|2026|matchday|fixtures?|groups?|host cities?|scoreboard|football|soccer)\b/i;

const SYSTEM_PROMPT = `You are RipoAI 1o, the SnapLink assistant.
Write like a sharp, helpful teammate.
Be natural, specific, and useful.
If the user gives you screenshots or files, use them directly.
If you provide code, use fenced code blocks with the language tag.
Do not talk about hidden providers, runtimes, models, or fallback systems.
Do not return robotic scaffolding like "your prompt" or "next step" unless the user explicitly asks for a plan.
Keep replies human and launch-ready.`;

const RIPOAI_ENDPOINTS =
  typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname)
    ? ['/api/ripoai', '/.netlify/functions/ripoai']
    : ['/.netlify/functions/ripoai', '/api/ripoai'];
const RIPOAI_IMAGE_ENDPOINT =
  typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname)
    ? '/api/ripoai-image'
    : '/.netlify/functions/ripoai-image';

type RipoAIResponse = {
  text: string;
};

function normalizeRequestOptions(options?: string | RipoAIRequestOptions): RipoAIRequestOptions {
  if (!options) return {};
  if (typeof options === 'string') return { context: options };
  return options;
}

function sanitizePrompt(message: string) {
  return message.trim().replace(/\s+/g, ' ');
}

function buildUnavailableResponse(message: string, attachments: RipoAIAttachmentContext[]) {
  const cleaned = sanitizePrompt(message);

  if (!cleaned && attachments.length > 0) {
    return 'Tell me what you want done with the upload and I will handle it.';
  }

  if (!cleaned) {
    return 'Send the exact task, screenshot, file, or question and I will take it from there.';
  }

  if (/^(hi|hello|hey|yo|sup|how are you|what'?s up)$/i.test(cleaned)) {
    return 'Hey! I am here and ready to help. Ask me anything, drop a screenshot, or send a file and I will jump in.';
  }

  if (/^(ok|okay|k)$/i.test(cleaned)) {
    return 'All good. Send me the exact thing you want help with and I will take it from there.';
  }

  return 'I hit a temporary reply cap just then. Send the task again in a few seconds and I will retry it.';
}

function trimSnippet(value: string, maxLength = 120) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1)}…`;
}

async function buildSnapLinkLiveContext(userMessage: string) {
  if (!SNAPLINK_LIVE_CONTEXT_PATTERN.test(userMessage)) return '';

  try {
    const [postsSnap, groupsSnap, storiesSnap, announcementsSnap] = await Promise.all([
      getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(5))),
      getDocs(query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(4))),
      getDocs(query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(6))),
      getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3))),
    ]);

    const now = Date.now();
    const recentPosts = postsSnap.docs
      .map((entry) => entry.data() as any)
      .filter((post) => !post.isSponsored)
      .slice(0, 4)
      .map((post) => `- @${post.authorUsername || 'member'}: ${trimSnippet(post.content || '')}`);

    const recentGroups = groupsSnap.docs
      .map((entry) => entry.data() as any)
      .slice(0, 4)
      .map((group) => `- ${group.name}: ${trimSnippet(group.description || 'Community group')}`);

    const liveStories = storiesSnap.docs
      .map((entry) => entry.data() as any)
      .filter((story) => !story.deletedAt && new Date(story.expiresAt || 0).getTime() > now)
      .slice(0, 4)
      .map((story) => `- @${story.authorUsername}: ${trimSnippet(story.caption || 'New story live')}`);

    const announcements = announcementsSnap.docs
      .map((entry) => entry.data() as any)
      .slice(0, 3)
      .map((announcement) => `- ${trimSnippet(announcement.title || announcement.content || 'Announcement')}`);

    const blocks = [
      recentPosts.length ? `Recent posts:\n${recentPosts.join('\n')}` : '',
      liveStories.length ? `Live stories:\n${liveStories.join('\n')}` : '',
      recentGroups.length ? `Groups:\n${recentGroups.join('\n')}` : '',
      announcements.length ? `Announcements:\n${announcements.join('\n')}` : '',
    ].filter(Boolean);

    return blocks.length ? `Live SnapLink context:\n${blocks.join('\n\n')}` : '';
  } catch (error) {
    console.warn('Could not build live SnapLink context:', error);
    return '';
  }
}

async function buildWebLookupContext(userMessage: string) {
  if (!WEB_LOOKUP_PATTERN.test(userMessage)) return '';

  const strippedQuery = userMessage
    .replace(/\b(search|look up|lookup|who is|what is|tell me about|find info on|latest on)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!strippedQuery) return '';

  try {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(strippedQuery)}&limit=3&namespace=0&format=json&origin=*`
    );
    if (!response.ok) return '';

    const data = (await response.json()) as [string, string[], string[], string[]];
    const titles = Array.isArray(data?.[1]) ? data[1] : [];
    const descriptions = Array.isArray(data?.[2]) ? data[2] : [];
    const links = Array.isArray(data?.[3]) ? data[3] : [];

    const entries = titles
      .map((title, index) => {
        const description = descriptions[index] || 'Reference result';
        const link = links[index] || '';
        return `- ${title}: ${description}${link ? ` (${link})` : ''}`;
      })
      .filter(Boolean);

    return entries.length ? `Lookup references:\n${entries.join('\n')}` : '';
  } catch (error) {
    console.warn('Could not build web lookup context:', error);
    return '';
  }
}

function buildWorldCupContext(userMessage: string) {
  if (!WORLD_CUP_CONTEXT_PATTERN.test(userMessage)) return '';

  const opener = `World Cup 2026 in SnapLink runs from ${WORLD_CUP_2026_START} to ${WORLD_CUP_2026_END} Europe/Sarajevo time.`;
  const cities = `Host cities: ${WORLD_CUP_2026_HOST_CITIES.join(', ')}.`;
  const featuredDays = WORLD_CUP_2026_FIXTURE_DAYS.slice(0, 6)
    .map((day) => `- ${day.label} (${day.date}): ${day.matches.map((match) => `${match.fixture} at ${match.venue}`).join('; ')}`)
    .join('\n');
  const groups = WORLD_CUP_2026_GROUPS.slice(0, 12)
    .map((group) => `- ${group.id}: ${group.teams.map((team) => `${team.name} (${team.code})`).join(', ')}`)
    .join('\n');

  return `World Cup 2026 SnapLink context:\n${opener}\n${cities}\nFeatured matchdays:\n${featuredDays}\nGroups board:\n${groups}`;
}

async function enrichRipoAIOptions(userMessage: string, options: RipoAIRequestOptions) {
  const liveContext = await buildSnapLinkLiveContext(userMessage);
  const webLookupContext = await buildWebLookupContext(userMessage);
  const worldCupContext = buildWorldCupContext(userMessage);

  return {
    ...options,
    context: [options.context, liveContext, webLookupContext, worldCupContext].filter(Boolean).join('\n\n'),
  };
}

export function shouldGenerateImagePrompt(message: string) {
  return /\b(generate|create|make|design)\b[\s\S]{0,80}\b(image|art|poster|cover|wallpaper|illustration|logo)\b/i.test(message);
}

export function shouldGenerateVideoPrompt(message: string) {
  return /\b(generate|create|make|design|animate)\b[\s\S]{0,90}\b(video|clip|animation|movie|cinematic|trailer)\b/i.test(message);
}

function createSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function fetchGeneratedAsset(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Generated asset failed with ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('Generated asset came back empty');
  }

  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
    mimeType: blob.type || 'application/octet-stream',
    size: blob.size,
  };
}

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load generated image'));
    image.src = url;
  });
}

async function buildMotionVideoFromImage(imageUrl: string) {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('This browser does not support generated video clips');
  }

  const image = await loadImageFromUrl(imageUrl);
  const canvas = document.createElement('canvas');
  const longestEdge = Math.max(image.naturalWidth || image.width || 1024, image.naturalHeight || image.height || 1024);
  const size = Math.min(Math.max(longestEdge, 720), 1280);
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create a video canvas');
  }

  const captureStream = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
  if (!captureStream) {
    throw new Error('This browser cannot capture generated video');
  }

  const mimeTypeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = mimeTypeCandidates.find((candidate) => {
    try {
      return typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(candidate);
    } catch {
      return false;
    }
  }) || 'video/webm';

  const recorder = new MediaRecorder(captureStream.call(canvas, 30), {
    mimeType,
    videoBitsPerSecond: 2_400_000,
  });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const durationMs = 4200;

  const drawFrame = (progress: number) => {
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#020617';
    context.fillRect(0, 0, width, height);

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const coverScale = Math.max(width / sourceWidth, height / sourceHeight);
    const zoom = 1.03 + progress * 0.09;
    const drawWidth = sourceWidth * coverScale * zoom;
    const drawHeight = sourceHeight * coverScale * zoom;
    const panX = Math.sin(progress * Math.PI) * width * 0.045;
    const panY = Math.cos(progress * Math.PI * 1.6) * height * 0.02;
    const x = (width - drawWidth) / 2 + panX;
    const y = (height - drawHeight) / 2 + panY;

    context.drawImage(image, x, y, drawWidth, drawHeight);

    const gradient = context.createLinearGradient(0, height * 0.72, 0, height);
    gradient.addColorStop(0, 'rgba(2, 6, 23, 0)');
    gradient.addColorStop(1, 'rgba(2, 6, 23, 0.72)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  };

  const videoBlob = await new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Could not render the generated video'));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (!blob.size) {
        reject(new Error('Generated video came back empty'));
        return;
      }
      resolve(blob);
    };

    drawFrame(0);
    recorder.start(250);
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      drawFrame(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => recorder.stop(), 120);
      }
    };

    requestAnimationFrame(tick);
  });

  return {
    blob: videoBlob,
    mimeType,
    size: videoBlob.size,
    objectUrl: URL.createObjectURL(videoBlob),
  };
}

export async function generateRipoAIImage(prompt: string): Promise<RipoAIImageGenerationResult> {
  const cleanedPrompt = sanitizePrompt(prompt);
  const seed = createSeed();
  const imageUrl = `${RIPOAI_IMAGE_ENDPOINT}?prompt=${encodeURIComponent(cleanedPrompt)}&seed=${encodeURIComponent(seed)}`;
  const generated = await fetchGeneratedAsset(imageUrl);
  return {
    imageUrl: generated.objectUrl,
    downloadUrl: generated.objectUrl,
    prompt: cleanedPrompt,
    seed,
    size: generated.size,
    mimeType: generated.mimeType,
  };
}

export async function generateRipoAIVideo(prompt: string): Promise<RipoAIVideoGenerationResult> {
  const generatedImage = await generateRipoAIImage(prompt);
  const generatedVideo = await buildMotionVideoFromImage(generatedImage.imageUrl);

  return {
    videoUrl: generatedVideo.objectUrl,
    downloadUrl: generatedVideo.objectUrl,
    prompt: generatedImage.prompt,
    seed: generatedImage.seed,
    size: generatedVideo.size,
    mimeType: generatedVideo.mimeType,
  };
}

function shouldUseCodeModel(userMessage: string, options: RipoAIRequestOptions) {
  const haystack = [userMessage, options.context || '', ...(options.attachments || []).map((attachment) => attachment.excerpt || '')].join('\n');
  if (HEAVY_CODE_REQUEST_PATTERN.test(haystack)) return true;
  return (options.attachments || []).filter((attachment) => /\.(ts|tsx|js|jsx|json|html|css|scss|md|py|java|cs|cpp|c|go|rs|php|rb|sql|xml|yaml|yml)$/i.test(attachment.name || '')).length >= 3;
}

function buildBrowserGroqPayload(userMessage: string, options: RipoAIRequestOptions) {
  const hasVisionAttachment = (options.attachments || []).some(
    (attachment) => String(attachment.mimeType || '').startsWith('image/') && typeof attachment.dataUrl === 'string'
  );
  const selectedModel = hasVisionAttachment
    ? DEFAULT_VISION_MODEL
    : shouldUseCodeModel(userMessage, options)
      ? DEFAULT_CODE_MODEL
      : DEFAULT_MODEL;

  const uploadsSummary = (options.attachments || [])
    .filter((attachment) => attachment.kind !== 'image' || !attachment.dataUrl)
    .slice(0, 6)
    .map((attachment, index) => {
      const name = attachment.name || `Attachment ${index + 1}`;
      const excerpt = attachment.excerpt ? `\nExcerpt: ${attachment.excerpt.slice(0, 1400)}` : '';
      return `- ${name} (${attachment.mimeType || 'unknown'})${excerpt}`;
    })
    .join('\n');

  const baseText = [
    options.context ? `Context: ${options.context}` : '',
    uploadsSummary ? `Uploads:\n${uploadsSummary}` : '',
    userMessage || 'Review the uploaded context and help with it.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: Array<{ role: 'system' | 'user'; content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (hasVisionAttachment) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: baseText },
        ...(options.attachments || [])
          .filter((attachment) => String(attachment.mimeType || '').startsWith('image/') && attachment.dataUrl)
          .slice(0, 3)
          .map((attachment) => ({
            type: 'image_url' as const,
            image_url: { url: attachment.dataUrl! },
          })),
      ],
    });
  } else {
    messages.push({ role: 'user', content: baseText });
  }

  return {
    model: selectedModel,
    messages,
    temperature: selectedModel === DEFAULT_CODE_MODEL ? 1 : selectedModel === DEFAULT_VISION_MODEL ? 1 : 0.6,
    max_completion_tokens:
      selectedModel === DEFAULT_CODE_MODEL
        ? DEFAULT_CODE_MAX_COMPLETION_TOKENS
        : selectedModel === DEFAULT_VISION_MODEL
          ? DEFAULT_VISION_MAX_COMPLETION_TOKENS
          : DEFAULT_MAX_COMPLETION_TOKENS,
    top_p: selectedModel === DEFAULT_CODE_MODEL ? 1 : selectedModel === DEFAULT_VISION_MODEL ? 1 : 0.95,
    ...(selectedModel === DEFAULT_CODE_MODEL ? { reasoning_effort: 'medium' } : {}),
    stream: false,
  };
}

async function requestRipoAIDirectly(userMessage: string, options: RipoAIRequestOptions) {
  if (!BROWSER_GROQ_API_KEY) {
    throw new Error('Direct browser RipoAI requests are disabled; use the server RipoAI endpoint.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BROWSER_GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildBrowserGroqPayload(userMessage, options)),
  });

  if (!response.ok) {
    throw new Error(`Direct RipoAI request failed with ${response.status}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return String(data.choices?.[0]?.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

async function requestRipoAI(userMessage: string, options?: string | RipoAIRequestOptions) {
  const normalizedOptions = normalizeRequestOptions(options);
  const payload = {
    message: userMessage,
    context: normalizedOptions.context,
    mode: 'chat',
    attachments: normalizedOptions.attachments || [],
    systemPrompt: SYSTEM_PROMPT,
  };

  let lastError: unknown = null;

  for (const endpoint of RIPOAI_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        lastError = new Error(`RipoAI endpoint failed with ${response.status}`);
        continue;
      }

      const data = (await response.json()) as RipoAIResponse;
      if (data.text?.trim()) {
        return data.text.trim();
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('RipoAI is unavailable');
}

export async function getRipoAIResponse(userMessage: string, options?: string | RipoAIRequestOptions): Promise<string> {
  const normalizedOptions = await enrichRipoAIOptions(userMessage, normalizeRequestOptions(options));

  try {
    return await requestRipoAI(userMessage, normalizedOptions);
  } catch (error) {
    console.error('RipoAI error:', error);
    try {
      const directText = await requestRipoAIDirectly(userMessage, normalizedOptions);
      if (directText) return directText;
    } catch (directError) {
      console.error('Direct RipoAI error:', directError);
    }
    return buildUnavailableResponse(userMessage, normalizedOptions.attachments || []);
  }
}

export async function getRipoAIStreamResponse(
  userMessage: string,
  onChunk: (text: string) => void,
  options?: string | RipoAIRequestOptions
): Promise<void> {
  const fullText = await getRipoAIResponse(userMessage, options);
  const segments = fullText.match(/.{1,30}(\s|$)/g) || [fullText];

  for (const segment of segments) {
    onChunk(segment);
    await new Promise((resolve) => window.setTimeout(resolve, 18));
  }
}

export const RIPOAI_PROFILE = {
  uid: 'ripoai_bot',
  username: 'ripoai',
  displayName: 'RipoAI 1o',
  bio: 'SnapLink assistant for writing, planning, research, and file help.',
  photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=ripoai_official&backgroundColor=2563eb',
  isVerified: true,
  role: 'admin' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  followersCount: 0,
  followingCount: 0,
  isBanned: false,
  snapCoins: 0,
  badges: [
    {
      id: 'ai_badge',
      name: 'AI Assistant',
      imageURL: 'https://api.dicebear.com/7.x/shapes/svg?seed=ai_badge&backgroundColor=2563eb',
      assignedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
};
