import {
  buildFallback,
  buildGroqRequest,
  callGroq,
  DEFAULT_CODE_MODEL,
  DEFAULT_MODEL,
  DEFAULT_VISION_MODEL,
} from '../../shared/ripoaiRuntime.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const message = String(body.message || '').trim();
    const context = body.context ? String(body.context) : '';
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const systemPrompt = String(body.systemPrompt || '').trim();

    if (!message && attachments.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' }),
      };
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
        console.error('RipoAI Groq runtime error:', error);
        text = buildFallback(message, attachments);
      }
    } else {
      text = buildFallback(message, attachments);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text || "I'm here, but I couldn't form a reply that time.",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected server error',
      }),
    };
  }
}
