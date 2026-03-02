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
      setStatus(res.ok && payload.status === 'ok' ? 'ok' : 'down');
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

