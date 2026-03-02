import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENAI_COMPAT_API_KEY = process.env.OPENAI_COMPAT_API_KEY || process.env.GROQ_API_KEY || '';
const OPENAI_COMPAT_BASE_URL = (
  process.env.OPENAI_COMPAT_BASE_URL ||
  process.env.GROQ_API_BASE_URL ||
  'https://api.groq.com/openai/v1'
).replace(/\/+$/, '');
const OPENAI_COMPAT_MODEL =
  process.env.OPENAI_COMPAT_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OPENAI_COMPAT_ENDPOINT = `${OPENAI_COMPAT_BASE_URL}/chat/completions`;

const TIMEOUT_MS = 8000;

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function hasConfig(): boolean {
  return Boolean(OPENAI_COMPAT_API_KEY && OPENAI_COMPAT_ENDPOINT && OPENAI_COMPAT_MODEL);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'down', error: 'Method not allowed' });
  }

  if (!hasConfig()) {
    return res.status(200).json({ status: 'down', error: 'Missing AI server configuration' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(OPENAI_COMPAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_COMPAT_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_COMPAT_MODEL,
        temperature: 0,
        max_tokens: 8,
        messages: [
          { role: 'system', content: 'Respond in one token.' },
          { role: 'user', content: 'Reply with OK' },
        ],
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return res.status(200).json({ status: 'down', error: `Upstream ${upstream.status}` });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    return res.status(200).json({
      status: 'down',
      error: error instanceof Error ? error.message : 'AI health check failed',
    });
  } finally {
    clearTimeout(timeout);
  }
}

