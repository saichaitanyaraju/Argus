import { useCallback, useEffect, useState } from 'react';

export type AIHealthStatus = 'checking' | 'ok' | 'down';

interface AIHealthResponse {
  status: 'ok' | 'down';
}

export function useAIHealth(pollMs = 45000) {
  const [status, setStatus] = useState<AIHealthStatus>('checking');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-health', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as Partial<AIHealthResponse>;

      if (res.ok && payload.status === 'ok') {
        setStatus('ok');
        return;
      }
    } catch {
      // Fall through to /api/agent health check.
    }

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'health' }),
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean };
      setStatus(res.ok && payload.ok ? 'ok' : 'down');
    } catch {
      setStatus('down');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => window.clearInterval(interval);
  }, [pollMs, refresh]);

  return {
    status,
    isOnline: status === 'ok',
    refresh,
  };
}

