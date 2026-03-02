import type { VercelRequest, VercelResponse } from '@vercel/node';

type AgentErrorCode =
  | 'CONFIG_MISSING'
  | 'AUTH_FAILED'
  | 'SERVICE_UNAVAILABLE'
  | 'UPSTREAM_ERROR';

interface AgentRequestBody {
  mode?: 'ask' | 'health';
  projectId?: string;
  projectName?: string;
  periodDate?: string | null;
  modules?: string[];
  userMessage?: string;
  sessionId?: string;
  context?: unknown;
}

interface LyzrCallResult {
  answer: string;
  raw: unknown;
}

const LYZR_API_KEY = process.env.LYZR_API_KEY || '';
const LYZR_AGENT_ID = process.env.LYZR_AGENT_ID || '';
const LYZR_USER_ID = process.env.LYZR_USER_ID || '';
const LYZR_API_ENDPOINT =
  process.env.LYZR_API_ENDPOINT || 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/';

const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 20000;

function hasRequiredConfig(): boolean {
  return Boolean(LYZR_API_KEY && LYZR_AGENT_ID && LYZR_USER_ID && LYZR_API_ENDPOINT);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LyzrError extends Error {
  code: AgentErrorCode;
  status: number;

  constructor(message: string, code: AgentErrorCode, status = 500) {
    super(message);
    this.name = 'LyzrError';
    this.code = code;
    this.status = status;
  }
}

function classifyStatusCode(status: number): AgentErrorCode {
  if (status === 401 || status === 403) return 'AUTH_FAILED';
  if (status >= 500 || status === 429) return 'SERVICE_UNAVAILABLE';
  return 'UPSTREAM_ERROR';
}

function mapErrorStatus(errorCode: AgentErrorCode): number {
  switch (errorCode) {
    case 'CONFIG_MISSING':
      return 500;
    case 'AUTH_FAILED':
      return 502;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    case 'UPSTREAM_ERROR':
    default:
      return 502;
  }
}

async function callLyzr(message: string, sessionId: string): Promise<LyzrCallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(LYZR_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify({
        user_id: LYZR_USER_ID,
        agent_id: LYZR_AGENT_ID,
        session_id: sessionId,
        message,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new LyzrError(
        `Lyzr API error: ${res.status} - ${errorText}`,
        classifyStatusCode(res.status),
        res.status
      );
    }

    const data = await res.json();
    return {
      answer: data.response || data.message || 'No response from agent',
      raw: data,
    };
  } catch (error) {
    if (error instanceof LyzrError) throw error;
    if ((error as { name?: string })?.name === 'AbortError') {
      throw new LyzrError('Lyzr request timed out.', 'SERVICE_UNAVAILABLE', 504);
    }
    throw new LyzrError(
      error instanceof Error ? error.message : 'Failed to connect to Lyzr.',
      'SERVICE_UNAVAILABLE',
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function callLyzrWithRetry(message: string, sessionId: string): Promise<LyzrCallResult> {
  let attempt = 0;
  let lastError: LyzrError | null = null;

  while (attempt <= RETRY_COUNT) {
    try {
      return await callLyzr(message, sessionId);
    } catch (error) {
      const lyzrError =
        error instanceof LyzrError
          ? error
          : new LyzrError(
              error instanceof Error ? error.message : 'Unknown Lyzr error.',
              'UPSTREAM_ERROR',
              500
            );
      lastError = lyzrError;

      if (lyzrError.code === 'AUTH_FAILED' || lyzrError.code === 'CONFIG_MISSING') {
        throw lyzrError;
      }

      if (attempt < RETRY_COUNT) {
        await sleep(RETRY_DELAY_MS);
      }
    }
    attempt += 1;
  }

  throw lastError || new LyzrError('Lyzr service unavailable.', 'SERVICE_UNAVAILABLE', 503);
}

function buildAskMessage(body: AgentRequestBody): string {
  const periodDate = body.periodDate || new Date().toISOString().split('T')[0];
  return `
[DATA CONTEXT]
Project: ${body.projectName || 'Demo Project'}
Project ID: ${body.projectId || 'N/A'}
Period: ${periodDate}
Module(s): ${(body.modules || []).join(', ') || 'none'}
Context JSON:
${JSON.stringify(body.context || {}, null, 2)}
[END CONTEXT]

[USER QUESTION]
${body.userMessage || ''}
`;
}

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body || {}) as AgentRequestBody;
  const mode = body.mode || 'ask';

  if (!hasRequiredConfig()) {
    return res.status(500).json({
      ok: false,
      errorCode: 'CONFIG_MISSING',
      error: 'Missing Lyzr server configuration.',
    });
  }

  if (mode === 'health') {
    try {
      await callLyzr('Return the single word: OK', `health-${Date.now()}`);
      return res.status(200).json({ ok: true });
    } catch (error) {
      const lyzrError =
        error instanceof LyzrError
          ? error
          : new LyzrError(
              error instanceof Error ? error.message : 'AI service unavailable.',
              'SERVICE_UNAVAILABLE',
              503
            );
      return res.status(mapErrorStatus(lyzrError.code)).json({
        ok: false,
        errorCode: lyzrError.code,
        error: lyzrError.message,
      });
    }
  }

  if (!body.projectId || !body.userMessage || !body.sessionId) {
    return res.status(400).json({
      errorCode: 'UPSTREAM_ERROR',
      error: 'Missing required fields: projectId, userMessage, sessionId.',
    });
  }

  try {
    const sessionId = `${body.projectId}-${body.sessionId}`;
    const message = buildAskMessage(body);
    const response = await callLyzrWithRetry(message, sessionId);
    return res.status(200).json({
      answer: response.answer,
      raw: response.raw,
    });
  } catch (error) {
    const lyzrError =
      error instanceof LyzrError
        ? error
        : new LyzrError(
            error instanceof Error ? error.message : 'AI service unavailable.',
            'UPSTREAM_ERROR',
            500
          );

    return res.status(mapErrorStatus(lyzrError.code)).json({
      errorCode: lyzrError.code,
      error: lyzrError.message,
    });
  }
}
