import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function usePublicMode(): boolean {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const byRouter = searchParams.get('public') === '1';
    if (byRouter) return true;
    return new URLSearchParams(window.location.search).get('public') === '1';
  }, [searchParams]);
}

