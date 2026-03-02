import type { VercelRequest, VercelResponse } from '@vercel/node';

const LYZR_API_KEY = process.env.LYZR_API_KEY || '';
const LYZR_AGENT_ID = process.env.LYZR_AGENT_ID || '';
const LYZR_USER_ID = process.env.LYZR_USER_ID || 'argus-system';
const LYZR_API_ENDPOINT =
  process.env.LYZR_API_ENDPOINT || 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/';

const TIMEOUT_MS = 8000;

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function hasConfig(): boolean {
  return Boolean(LYZR_API_KEY && LYZR_AGENT_ID && LYZR_API_ENDPOINT);
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
    const upstream = await fetch(LYZR_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify({
        user_id: LYZR_USER_ID,
        agent_id: LYZR_AGENT_ID,
        session_id: `health-${Date.now()}`,
        message: 'Return exactly: OK',
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
