export function sanitizeImagePrompt(prompt) {
  return String(prompt || '').trim().replace(/\s+/g, ' ').slice(0, 500);
}

export function buildPollinationsImageUrl(prompt, seed, model = 'flux') {
  const cleanedPrompt = sanitizeImagePrompt(prompt);
  const imageSeed = String(seed || Date.now());
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanedPrompt)}?width=1280&height=1280&model=${encodeURIComponent(model)}&nologo=true&seed=${encodeURIComponent(imageSeed)}`;
}

export async function fetchGeneratedImageResponse({ prompt, seed }) {
  const cleanedPrompt = sanitizeImagePrompt(prompt);
  const baseSeed = Number.parseInt(String(seed || Date.now()), 10) || Date.now();
  const attempts = [
    { model: 'flux', seed: String(baseSeed) },
    { model: 'flux', seed: String(baseSeed + 1) },
    { model: 'turbo', seed: String(baseSeed + 2) },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const response = await fetch(buildPollinationsImageUrl(cleanedPrompt, attempt.seed, attempt.model), {
        headers: {
          'User-Agent': 'SnapLink-RipoAI/1.0',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Image generation failed with ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      if (!contentType.startsWith('image/') || bytes.length < 1024) {
        throw new Error('Image generation returned an invalid image payload');
      }

      return {
        prompt: cleanedPrompt,
        contentType,
        bytes,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Image generation failed');
}
