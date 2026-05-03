import {
  buildFallback,
  buildGroqRequest,
  callGroq,
  DEFAULT_CODE_MODEL,
  DEFAULT_MODEL,
  DEFAULT_VISION_MODEL,
} from '../shared/ripoaiRuntime.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const message = String(body.message || '').trim();
    const context = body.context ? String(body.context) : '';
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const systemPrompt = String(body.systemPrompt || '').trim();

    if (!message && attachments.length === 0) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const { payload } = buildGroqRequest({
      message,
      context,
      attachments,
      systemPrompt,
      modelOverrides: {
        defaultModel: process.env.GROQ_MODEL || DEFAULT_MODEL,
        visionModel: process.env.GROQ_VISION_MODEL || DEFAULT_VISION_MODEL,
        codeModel: process.env.GROQ_CODE_MODEL || DEFAULT_CODE_MODEL,
      },
    });

    let text = '';
    if (GROQ_API_KEY) {
      try {
        text = await callGroq({
          apiKey: GROQ_API_KEY,
          payload,
        });
      } catch (error) {
        console.error('RipoAI runtime error:', error);
        text = buildFallback(message, attachments);
      }
    } else {
      text = buildFallback(message, attachments);
    }

    res.status(200).json({
      text: text || "I'm here, but I couldn't form a reply that time.",
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error',
    });
  }
}
