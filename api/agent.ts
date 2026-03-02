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

interface AgentCallResult {
  answer: string;
  raw: unknown;
}

interface OpenAICompatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompatChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface OpenAICompatResponse {
  choices?: OpenAICompatChoice[];
}

const OPENAI_COMPAT_API_KEY = process.env.OPENAI_COMPAT_API_KEY || process.env.GROQ_API_KEY || '';
const OPENAI_COMPAT_BASE_URL = (
  process.env.OPENAI_COMPAT_BASE_URL ||
  process.env.GROQ_API_BASE_URL ||
  'https://api.groq.com/openai/v1'
).replace(/\/+$/, '');
const OPENAI_COMPAT_MODEL =
  process.env.OPENAI_COMPAT_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OPENAI_COMPAT_ENDPOINT = `${OPENAI_COMPAT_BASE_URL}/chat/completions`;

const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_MAX_TOKENS = 900;

const ARGUS_SYSTEM_PROMPT = [
  'You are Argus, a construction project analytics copilot.',
  'Use only the provided project context and data in your answer.',
  'If required data is missing, say what is missing instead of guessing.',
  'Keep the response concise and numeric where possible.',
  'When comparing values, include short calculations.',
].join(' ');

function hasRequiredConfig(): boolean {
  return Boolean(OPENAI_COMPAT_API_KEY && OPENAI_COMPAT_ENDPOINT && OPENAI_COMPAT_MODEL);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class AgentProviderError extends Error {
  code: AgentErrorCode;
  status: number;

  constructor(message: string, code: AgentErrorCode, status = 500) {
    super(message);
    this.name = 'AgentProviderError';
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

function extractAnswer(payload: OpenAICompatResponse): string {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
    if (text) return text;
  }
  throw new AgentProviderError('Model returned an empty response.', 'UPSTREAM_ERROR', 502);
}

async function callOpenSourceModel(
  messages: OpenAICompatMessage[],
  maxTokens = DEFAULT_MAX_TOKENS
): Promise<AgentCallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_COMPAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_COMPAT_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_COMPAT_MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new AgentProviderError(
        `Model API error: ${res.status} - ${errorText}`,
        classifyStatusCode(res.status),
        res.status
      );
    }

    const data = (await res.json()) as OpenAICompatResponse;
    return {
      answer: extractAnswer(data),
      raw: data,
    };
  } catch (error) {
    if (error instanceof AgentProviderError) throw error;
    if ((error as { name?: string })?.name === 'AbortError') {
      throw new AgentProviderError('Model request timed out.', 'SERVICE_UNAVAILABLE', 504);
    }
    throw new AgentProviderError(
      error instanceof Error ? error.message : 'Failed to connect to model provider.',
      'SERVICE_UNAVAILABLE',
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function callWithRetry(messages: OpenAICompatMessage[]): Promise<AgentCallResult> {
  let attempt = 0;
  let lastError: AgentProviderError | null = null;

  while (attempt <= RETRY_COUNT) {
    try {
      return await callOpenSourceModel(messages);
    } catch (error) {
      const providerError =
        error instanceof AgentProviderError
          ? error
          : new AgentProviderError(
              error instanceof Error ? error.message : 'Unknown provider error.',
              'UPSTREAM_ERROR',
              500
            );
      lastError = providerError;

      if (providerError.code === 'AUTH_FAILED' || providerError.code === 'CONFIG_MISSING') {
        throw providerError;
      }

      if (attempt < RETRY_COUNT) {
        await sleep(RETRY_DELAY_MS);
      }
    }
    attempt += 1;
  }

  throw lastError || new AgentProviderError('Model service unavailable.', 'SERVICE_UNAVAILABLE', 503);
}

function buildUserMessage(body: AgentRequestBody): string {
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

function buildAskMessages(body: AgentRequestBody): OpenAICompatMessage[] {
  return [
    { role: 'system', content: ARGUS_SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(body) },
  ];
}

function buildHealthMessages(): OpenAICompatMessage[] {
  return [
    { role: 'system', content: 'Respond in one token.' },
    { role: 'user', content: 'Reply with OK' },
  ];
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
      error:
        'Missing model server configuration. Set OPENAI_COMPAT_API_KEY (or GROQ_API_KEY), OPENAI_COMPAT_BASE_URL, and OPENAI_COMPAT_MODEL.',
    });
  }

  if (mode === 'health') {
    try {
      await callOpenSourceModel(buildHealthMessages(), 8);
      return res.status(200).json({ ok: true });
    } catch (error) {
      const providerError =
        error instanceof AgentProviderError
          ? error
          : new AgentProviderError(
              error instanceof Error ? error.message : 'AI service unavailable.',
              'SERVICE_UNAVAILABLE',
              503
            );
      return res.status(mapErrorStatus(providerError.code)).json({
        ok: false,
        errorCode: providerError.code,
        error: providerError.message,
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
    const response = await callWithRetry(buildAskMessages(body));
    return res.status(200).json({
      answer: response.answer,
      raw: response.raw,
    });
  } catch (error) {
    const providerError =
      error instanceof AgentProviderError
        ? error
        : new AgentProviderError(
            error instanceof Error ? error.message : 'AI service unavailable.',
            'UPSTREAM_ERROR',
            500
          );

    return res.status(mapErrorStatus(providerError.code)).json({
      errorCode: providerError.code,
      error: providerError.message,
    });
  }
}

