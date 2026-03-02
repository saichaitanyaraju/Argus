import type { DashboardSpec, Module } from '../types';

const MODULES: Module[] = ['manpower', 'equipment', 'progress', 'cost'];

function extractPercent(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function varianceForModule(module: Module, spec?: DashboardSpec): number {
  if (!spec) return 100;

  if (module === 'manpower') {
    const kpi = spec.kpis.find((item) => item.id === 'variance_pct');
    return extractPercent(kpi?.value ?? kpi?.delta ?? 0);
  }

  if (module === 'equipment') {
    const kpi = spec.kpis.find((item) => item.id === 'utilization_pct');
    return extractPercent(kpi?.delta ?? 0);
  }

  if (module === 'progress') {
    const kpi = spec.kpis.find((item) => item.id === 'slippage_pct');
    return extractPercent(kpi?.value ?? kpi?.delta ?? 0);
  }

  const kpi = spec.kpis.find((item) => item.id === 'cost_variance');
  return extractPercent(kpi?.delta ?? 0);
}

export interface HealthScoreResult {
  score: number;
  status: 'good' | 'warning' | 'danger';
  moduleScores: Record<Module, number>;
}

export function computeHealthScore(specs: Partial<Record<Module, DashboardSpec>>): HealthScoreResult {
  const moduleScores = {} as Record<Module, number>;

  MODULES.forEach((module) => {
    const variancePct = varianceForModule(module, specs[module]);
    moduleScores[module] = Math.max(0, 100 - Math.abs(variancePct));
  });

  const average =
    MODULES.reduce((sum, module) => sum + moduleScores[module], 0) / MODULES.length;
  const score = Math.round(average);
  const status: 'good' | 'warning' | 'danger' =
    score >= 80 ? 'good' : score >= 50 ? 'warning' : 'danger';

  return { score, status, moduleScores };
}
