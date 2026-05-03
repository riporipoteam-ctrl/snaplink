import { fetchGeneratedImageResponse } from '../shared/ripoaiImageRuntime.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const prompt = String(req.query?.prompt || '').trim();
    const seed = String(req.query?.seed || '').trim();
    const shouldDownload = String(req.query?.download || '') === '1';

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const imageResponse = await fetchGeneratedImageResponse({ prompt, seed });
    res.setHeader('Content-Type', imageResponse.contentType);
    res.setHeader('Cache-Control', 'no-store');
    if (shouldDownload) {
      res.setHeader('Content-Disposition', 'attachment; filename=\"ripoai-generated-image.jpg\"');
    }
    res.status(200).send(imageResponse.bytes);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'RipoAI image generation failed',
    });
  }
}
