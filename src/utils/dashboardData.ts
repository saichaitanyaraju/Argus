import type { DashboardSpec } from '../types';

export function hasDashboardData(
  spec?: DashboardSpec,
  recordsSample?: Record<string, unknown>[]
): boolean {
  if (!spec) return false;
  if ((recordsSample?.length || 0) > 0) return true;

  const visuals = Array.isArray(spec.visuals) ? spec.visuals : [];
  return visuals.some(
    (visual) => Array.isArray(visual.data) && visual.data.length > 0
  );
}
