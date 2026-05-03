import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {
  buildGroqRequest,
  callGroq,
  DEFAULT_CODE_MODEL,
  DEFAULT_MODEL,
  DEFAULT_VISION_MODEL,
} from './shared/ripoaiRuntime.js';
import { fetchGeneratedImageResponse } from './shared/ripoaiImageRuntime.js';

function jsonResponse(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readRequestBody(req: any) {
  return new Promise<string>((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer | string) => {
      raw += chunk.toString();
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function extractMeta(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function localApiPlugin(env: Record<string, string>) {
  return {
    name: 'snaplink-local-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: () => void) => {
        if (req.method === 'POST' && req.url === '/api/ripoai') {
          try {
            const rawBody = await readRequestBody(req);
            const body = rawBody ? JSON.parse(rawBody) : {};
            const message = String(body.message || '').trim();

            if (!message) {
              jsonResponse(res, 400, { error: 'Message is required' });
              return;
            }

            const groqApiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY || '';
            if (!groqApiKey) {
              jsonResponse(res, 200, { text: 'I could not reach the live reply path just now. Send it again in a moment.' });
              return;
            }

            const { payload } = buildGroqRequest({
              message,
              context: body.context ? String(body.context) : '',
              attachments: Array.isArray(body.attachments) ? body.attachments : [],
              systemPrompt: String(body.systemPrompt || 'You are RipoAI 1o, the SnapLink assistant.'),
              modelOverrides: {
                defaultModel: env.GROQ_MODEL || process.env.GROQ_MODEL || DEFAULT_MODEL,
                visionModel: env.GROQ_VISION_MODEL || process.env.GROQ_VISION_MODEL || DEFAULT_VISION_MODEL,
                codeModel: env.GROQ_CODE_MODEL || process.env.GROQ_CODE_MODEL || DEFAULT_CODE_MODEL,
              },
            });

            const text = await callGroq({
              apiKey: groqApiKey,
              payload,
            });

            jsonResponse(res, 200, { text: text || "I'm here, but I couldn't form a reply that time." });
          } catch (error) {
            jsonResponse(res, 500, {
              error: error instanceof Error ? error.message : 'RipoAI request failed',
            });
          }
          return;
        }

        if (req.method === 'GET' && typeof req.url === 'string' && req.url.startsWith('/api/link-preview')) {
          try {
            const requestUrl = new URL(req.url, 'http://localhost:3000');
            const targetUrl = requestUrl.searchParams.get('url');
            if (!targetUrl) {
              jsonResponse(res, 400, { error: 'URL is required' });
              return;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(targetUrl, {
              headers: { 'User-Agent': 'SnapLink-LinkPreview/1.0' },
              signal: controller.signal,
            });
            clearTimeout(timeout);
            const html = await response.text();

            jsonResponse(res, 200, {
              title: extractMeta(html, [
                /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
                /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
                /<title>([^<]+)<\/title>/i,
              ]),
              description: extractMeta(html, [
                /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
                /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
                /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
              ]),
              siteName: extractMeta(html, [
                /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
              ]) || new URL(targetUrl).hostname.replace(/^www\./i, ''),
              image: extractMeta(html, [
                /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
                /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
              ]) || null,
            });
          } catch (error) {
            jsonResponse(res, 500, {
              error: error instanceof Error ? error.message : 'Link preview failed',
            });
          }
          return;
        }

        if (req.method === 'GET' && typeof req.url === 'string' && req.url.startsWith('/api/ripoai-image')) {
          try {
            const requestUrl = new URL(req.url, 'http://localhost:3000');
            const prompt = requestUrl.searchParams.get('prompt') || '';
            const seed = requestUrl.searchParams.get('seed') || '';
            const shouldDownload = requestUrl.searchParams.get('download') === '1';

            if (!prompt.trim()) {
              jsonResponse(res, 400, { error: 'Prompt is required' });
              return;
            }

            const imageResponse = await fetchGeneratedImageResponse({ prompt, seed });
            res.statusCode = 200;
            res.setHeader('Content-Type', imageResponse.contentType);
            res.setHeader('Cache-Control', 'no-store');
            if (shouldDownload) {
              res.setHeader('Content-Disposition', 'attachment; filename=\"ripoai-generated-image.jpg\"');
            }
            res.end(imageResponse.bytes);
          } catch (error) {
            jsonResponse(res, 500, {
              error: error instanceof Error ? error.message : 'RipoAI image generation failed',
            });
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), localApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
