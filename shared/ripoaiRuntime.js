export const DEFAULT_MODEL = 'qwen/qwen3-32b';
export const DEFAULT_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
export const DEFAULT_CODE_MODEL = 'openai/gpt-oss-120b';

const DEFAULT_MAX_COMPLETION_TOKENS = 1024;
const DEFAULT_VISION_MAX_COMPLETION_TOKENS = 768;
const DEFAULT_CODE_MAX_COMPLETION_TOKENS = 3072;

const HEAVY_CODE_REQUEST_PATTERN =
  /\b(full|complete|entire|huge|large|massive|production-ready|from scratch|deep refactor|full stack)\b[\s\S]{0,80}\b(code|website|web app|app|platform|system|repo|repository|frontend|backend)\b/i;

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|json|html|css|scss|md|py|java|cs|cpp|c|go|rs|php|rb|sql|xml|yaml|yml)$/i;

export function sanitizePrompt(message) {
  return String(message || '').trim().replace(/\s+/g, ' ');
}

export function summarizeAttachments(attachments) {
  if (!attachments.length) return '';

  return attachments
    .slice(0, 8)
    .map((attachment, index) => {
      const name = String(attachment?.name || `Attachment ${index + 1}`);
      const mimeType = String(attachment?.mimeType || 'unknown');
      const excerpt = typeof attachment?.excerpt === 'string' ? attachment.excerpt.slice(0, 1800) : '';
      return `- ${name} (${mimeType})${excerpt ? `\nExcerpt: ${excerpt}` : ''}`;
    })
    .join('\n');
}

export function buildFallback(message, attachments) {
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

export function shouldUseVisionModel(attachments) {
  return attachments.some(
    (attachment) =>
      String(attachment?.mimeType || '').startsWith('image/') &&
      typeof attachment?.dataUrl === 'string' &&
      attachment.dataUrl.startsWith('data:image/')
  );
}

export function shouldUseCodeModel({ message, context, attachments }) {
  const haystack = [message, context, ...attachments.map((attachment) => attachment?.excerpt || '')].join('\n');
  if (HEAVY_CODE_REQUEST_PATTERN.test(haystack)) return true;

  return attachments.filter((attachment) => {
    const name = String(attachment?.name || '');
    return CODE_FILE_PATTERN.test(name);
  }).length >= 3;
}

function getTokenBudget(selectedModel, modelOverrides) {
  if (selectedModel === (modelOverrides.codeModel || DEFAULT_CODE_MODEL)) {
    return DEFAULT_CODE_MAX_COMPLETION_TOKENS;
  }

  if (selectedModel === (modelOverrides.visionModel || DEFAULT_VISION_MODEL)) {
    return DEFAULT_VISION_MAX_COMPLETION_TOKENS;
  }

  return DEFAULT_MAX_COMPLETION_TOKENS;
}

export function buildGroqRequest({ message, context, attachments, systemPrompt, modelOverrides = {} }) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const imageAttachments = safeAttachments.filter(
    (attachment) =>
      String(attachment?.mimeType || '').startsWith('image/') &&
      typeof attachment?.dataUrl === 'string' &&
      attachment.dataUrl.startsWith('data:image/')
  );
  const fileAttachments = safeAttachments.filter((attachment) => !imageAttachments.includes(attachment));

  const selectedModel = imageAttachments.length > 0
    ? (modelOverrides.visionModel || DEFAULT_VISION_MODEL)
    : shouldUseCodeModel({ message, context, attachments: safeAttachments })
      ? (modelOverrides.codeModel || DEFAULT_CODE_MODEL)
      : (modelOverrides.defaultModel || DEFAULT_MODEL);

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: String(systemPrompt) });
  }

  const uploadSummary = summarizeAttachments(fileAttachments);
  const mainText = [
    context ? `Context: ${String(context)}` : '',
    uploadSummary ? `Uploads:\n${uploadSummary}` : '',
    String(message || '').trim() || 'Review the uploaded context and help with it.',
  ]
    .filter(Boolean)
    .join('\n\n');

  if (imageAttachments.length > 0) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: mainText },
        ...imageAttachments.slice(0, 3).map((attachment) => ({
          type: 'image_url',
          image_url: { url: attachment.dataUrl },
        })),
      ],
    });
  } else {
    messages.push({ role: 'user', content: mainText });
  }

  const payload = {
    model: selectedModel,
    messages,
    temperature: selectedModel === (modelOverrides.codeModel || DEFAULT_CODE_MODEL) ? 1 : selectedModel === (modelOverrides.visionModel || DEFAULT_VISION_MODEL) ? 1 : 0.6,
    max_completion_tokens: getTokenBudget(selectedModel, modelOverrides),
    top_p: selectedModel === (modelOverrides.codeModel || DEFAULT_CODE_MODEL) ? 1 : selectedModel === (modelOverrides.visionModel || DEFAULT_VISION_MODEL) ? 1 : 0.95,
    stream: false,
    ...(selectedModel === (modelOverrides.codeModel || DEFAULT_CODE_MODEL) ? { reasoning_effort: 'medium' } : {}),
  };

  return { payload, selectedModel };
}

function shouldRetryWithLowerBudget(errorText = '') {
  return /rate_limit|tokens per minute|TPM|rate limit/i.test(errorText);
}

export async function callGroq({ apiKey, payload }) {
  const execute = async (nextPayload) => {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nextPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Groq failed with ${response.status}`);
    }

    const data = await response.json();
    return String(data.choices?.[0]?.message?.content || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
  };

  try {
    return await execute(payload);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error || '');
    if (!shouldRetryWithLowerBudget(errorText)) {
      throw error;
    }

    const retryPayload = {
      ...payload,
      max_completion_tokens: Math.min(Number(payload?.max_completion_tokens || DEFAULT_MAX_COMPLETION_TOKENS), 384),
    };

    return execute(retryPayload);
  }
}
