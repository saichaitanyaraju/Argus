import type { DashboardSpec, Module } from '../types';

export type AgentErrorCode =
  | 'CONFIG_MISSING'
  | 'AUTH_FAILED'
  | 'SERVICE_UNAVAILABLE'
  | 'UPSTREAM_ERROR';

export interface AgentContextPayload {
  activeModule?: Module | 'overview';
  filters?: {
    disciplines: string[];
    dateFrom: string;
    dateTo: string;
  };
  moduleSpecs?: Partial<Record<Module, DashboardSpec>>;
  recordsSampleByModule?: Partial<Record<Module, Record<string, unknown>[]>>;
}

export interface AskAgentArgs {
  projectId: string;
  projectName: string;
  periodDate: string | null;
  modules: Module[];
  userMessage: string;
  sessionId: string;
  context?: AgentContextPayload;
}

export interface AgentResponse {
  answer: string;
  raw?: unknown;
}

// Backward-compatible aliases (existing imports can continue to work).
export type AskLyzrAgentArgs = AskAgentArgs;
export type LyzrAgentResponse = AgentResponse;

interface AgentApiErrorPayload {
  error?: string;
  errorCode?: AgentErrorCode;
}

export class AgentProxyError extends Error {
  code: AgentErrorCode;
  status: number;

  constructor(message: string, code: AgentErrorCode, status: number) {
    super(message);
    this.name = 'AgentProxyError';
    this.code = code;
    this.status = status;
  }
}

export async function askAgent(args: AskAgentArgs): Promise<AgentResponse> {
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'ask',
        ...args,
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as AgentResponse & AgentApiErrorPayload;
    if (!res.ok || !payload.answer) {
      console.error('[ArgusAI] Error:', {
        status: res.status,
        errorCode: payload.errorCode || 'UPSTREAM_ERROR',
        error: payload.error || 'Failed to connect to AI service.',
        payload,
      });

      throw new AgentProxyError(
        payload.error || 'Failed to connect to AI service.',
        payload.errorCode || 'UPSTREAM_ERROR',
        res.status
      );
    }

    return {
      answer: payload.answer,
      raw: payload.raw,
    };
  } catch (error) {
    if (!(error instanceof AgentProxyError)) {
      console.error('[ArgusAI] Error:', {
        status: undefined,
        errorCode: 'SERVICE_UNAVAILABLE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    throw error;
  }
}

export const askLyzrAgent = askAgent;

export async function checkAgentHealth(): Promise<{
  ok: boolean;
  errorCode?: AgentErrorCode;
  error?: string;
}> {
  // Try lightweight health endpoint first (if deployed), then fall back to /api/agent mode=health.
  try {
    const healthRes = await fetch('/api/ai-health', {
      method: 'GET',
      cache: 'no-store',
    });

    const healthPayload = (await healthRes.json().catch(() => ({}))) as {
      status?: 'ok' | 'down';
      error?: string;
    };

    if (healthRes.ok && healthPayload.status === 'ok') {
      return { ok: true };
    }

    if (healthRes.ok && healthPayload.status === 'down') {
      return {
        ok: false,
        errorCode: 'SERVICE_UNAVAILABLE',
        error: healthPayload.error || 'AI service unavailable.',
      };
    }
  } catch (error) {
    console.warn('[ArgusAI] /api/ai-health check failed, falling back to /api/agent health.', error);
  }

  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'health' }),
    });

    const payload = (await res.json().catch(() => ({}))) as
      | { ok?: boolean }
      | (AgentApiErrorPayload & { ok?: boolean });

    if (!res.ok || !('ok' in payload) || !payload.ok) {
      return {
        ok: false,
        errorCode: (payload as AgentApiErrorPayload).errorCode || 'SERVICE_UNAVAILABLE',
        error: (payload as AgentApiErrorPayload).error || 'AI service unavailable.',
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'SERVICE_UNAVAILABLE',
      error: error instanceof Error ? error.message : 'AI service unavailable.',
    };
  }
}

export function getAgentFriendlyErrorMessage(errorCode?: AgentErrorCode): string {
  switch (errorCode) {
    case 'CONFIG_MISSING':
    case 'AUTH_FAILED':
      return 'AI service is temporarily unavailable - check your model API key configuration.';
    case 'SERVICE_UNAVAILABLE':
      return 'AI service is temporarily unavailable after retries. Please try again shortly.';
    case 'UPSTREAM_ERROR':
    default:
      return 'I apologize, but I am unable to connect to the AI agent right now. Please try again later.';
  }
}

