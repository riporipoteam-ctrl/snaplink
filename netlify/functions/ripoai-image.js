import { fetchGeneratedImageResponse } from '../../shared/ripoaiImageRuntime.js';

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { Allow: 'GET' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const prompt = String(event.queryStringParameters?.prompt || '').trim();
    const seed = String(event.queryStringParameters?.seed || '').trim();
    const shouldDownload = String(event.queryStringParameters?.download || '') === '1';

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Prompt is required' }),
      };
    }

    const imageResponse = await fetchGeneratedImageResponse({ prompt, seed });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': imageResponse.contentType,
        'Cache-Control': 'no-store',
        ...(shouldDownload ? { 'Content-Disposition': 'attachment; filename=\"ripoai-generated-image.jpg\"' } : {}),
      },
      isBase64Encoded: true,
      body: imageResponse.bytes.toString('base64'),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'RipoAI image generation failed',
      }),
    };
  }
}
