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

export interface AskLyzrAgentArgs {
  projectId: string;
  projectName: string;
  periodDate: string | null;
  modules: Module[];
  userMessage: string;
  sessionId: string;
  context?: AgentContextPayload;
}

export interface LyzrAgentResponse {
  answer: string;
  raw?: unknown;
}

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

export async function askLyzrAgent(args: AskLyzrAgentArgs): Promise<LyzrAgentResponse> {
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

  const payload = (await res.json().catch(() => ({}))) as LyzrAgentResponse & AgentApiErrorPayload;
  if (!res.ok || !payload.answer) {
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
}

export async function checkAgentHealth(): Promise<{
  ok: boolean;
  errorCode?: AgentErrorCode;
  error?: string;
}> {
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
      return 'AI service is temporarily unavailable - check your API key configuration.';
    case 'SERVICE_UNAVAILABLE':
      return 'AI service is temporarily unavailable after retries. Please try again shortly.';
    case 'UPSTREAM_ERROR':
    default:
      return 'I apologize, but I am unable to connect to the AI agent right now. Please try again later.';
  }
}
