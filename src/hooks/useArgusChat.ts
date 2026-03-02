import { useCallback } from 'react';
import {
  askAgent,
  AgentProxyError,
  type AgentErrorCode,
  type AskAgentArgs,
  type AgentContextPayload,
} from '../lib/lyzrAgent';
import type { KPI, Module } from '../types';

const MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(value: unknown): number {
  return toNumber(value);
}

function findKpi(kpis: KPI[] | undefined, id: string): KPI | undefined {
  return (kpis || []).find((kpi) => kpi.id === id);
}

function parseOnTrack(value: unknown): { onTrack: number; total: number } {
  const raw = String(value || '').trim();
  const match = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return { onTrack: 0, total: 0 };
  return { onTrack: Number(match[1]), total: Number(match[2]) };
}

function fallbackFromSpecs(query: string, context?: AgentContextPayload): string {
  const q = query.toLowerCase();
  const specs = context?.moduleSpecs;
  const manpower = specs?.manpower;
  const equipment = specs?.equipment;
  const progress = specs?.progress;
  const cost = specs?.cost;

  const mpPlanned = toNumber(findKpi(manpower?.kpis, 'total_planned')?.value);
  const mpActual = toNumber(findKpi(manpower?.kpis, 'total_actual')?.value);
  const mpVariancePct = toPercent(findKpi(manpower?.kpis, 'variance_pct')?.value);
  const mpVariance = mpActual - mpPlanned;

  const eqActive = toNumber(findKpi(equipment?.kpis, 'active_count')?.value);
  const eqIdle = toNumber(findKpi(equipment?.kpis, 'idle_count')?.value);
  const eqBreakdown = toNumber(findKpi(equipment?.kpis, 'breakdown_count')?.value);
  const eqUtil = toPercent(findKpi(equipment?.kpis, 'utilization_pct')?.value);

  const prPlanned = toPercent(findKpi(progress?.kpis, 'planned_avg')?.value);
  const prActual = toPercent(findKpi(progress?.kpis, 'actual_avg')?.value);
  const prSlippage = toPercent(findKpi(progress?.kpis, 'slippage_pct')?.value);
  const prTrack = parseOnTrack(findKpi(progress?.kpis, 'disciplines_on_track')?.value);

  const coBudget = toNumber(findKpi(cost?.kpis, 'total_budget')?.value);
  const coSpent = toNumber(findKpi(cost?.kpis, 'total_spent')?.value);
  const coVariance = toNumber(findKpi(cost?.kpis, 'cost_variance')?.value);
  const coVariancePct = coBudget > 0 ? (coVariance / coBudget) * 100 : 0;

  if (q.includes('manpower') || q.includes('headcount') || q.includes('worker')) {
    return `Manpower: ${mpActual.toLocaleString()} on site vs ${mpPlanned.toLocaleString()} planned. Variance: ${mpVariancePct.toFixed(1)}% (${Math.abs(mpVariance).toLocaleString()} workers ${mpVariance < 0 ? 'short' : 'over'}).`;
  }

  if (q.includes('equipment') || q.includes('breakdown') || q.includes('idle')) {
    return `Equipment: ${eqActive.toLocaleString()} active, ${eqIdle.toLocaleString()} idle, ${eqBreakdown.toLocaleString()} in breakdown. Utilisation: ${eqUtil.toFixed(1)}%.`;
  }

  if (
    q.includes('progress') ||
    q.includes('schedule') ||
    q.includes('slippage') ||
    q.includes('spi')
  ) {
    return `Progress: Planned ${prPlanned.toFixed(1)}%, Actual ${prActual.toFixed(1)}%. Schedule slippage: ${prSlippage.toFixed(1)}%. ${prTrack.onTrack} of ${prTrack.total} disciplines on track.`;
  }

  if (q.includes('cost') || q.includes('budget') || q.includes('spend') || q.includes('cpi')) {
    return `Cost: Budget ${coBudget.toLocaleString()}, Spent ${coSpent.toLocaleString()}, Variance ${coVariance.toLocaleString()} (${coVariancePct.toFixed(1)}%).`;
  }

  if (q.includes('summary') || q.includes('overview') || q.includes('status')) {
    return `Project summary - Manpower: ${mpVariancePct.toFixed(1)}% variance. Equipment utilisation: ${eqUtil.toFixed(1)}%. Schedule slippage: ${prSlippage.toFixed(1)}%. Cost variance: ${coVariancePct.toFixed(1)}%.`;
  }

  const moduleHints: Record<Module, string> = {
    manpower: 'manpower headcount',
    equipment: 'equipment breakdown',
    progress: 'progress slippage',
    cost: 'cost variance',
  };

  const hint =
    context?.activeModule && context.activeModule !== 'overview'
      ? moduleHints[context.activeModule]
      : 'overall project summary';

  return `I can answer questions about manpower, equipment, progress, and cost. Try asking about ${hint}.`;
}

export type ArgusChatResult =
  | {
      ok: true;
      answer: string;
      offlineMode?: boolean;
    }
  | {
      ok: false;
      errorCode: AgentErrorCode;
      message: string;
    };

export function useArgusChat() {
  const sendMessage = useCallback(async (args: AskAgentArgs): Promise<ArgusChatResult> => {
    let retry = 0;

    while (retry <= MAX_RETRIES) {
      try {
        const response = await askAgent(args);
        return { ok: true, answer: response.answer, offlineMode: false };
      } catch (error) {
        const code =
          error instanceof AgentProxyError ? error.code : ('SERVICE_UNAVAILABLE' as AgentErrorCode);

        console.error('[ArgusAI] Error:', {
          attempt: retry + 1,
          status: error instanceof AgentProxyError ? error.status : undefined,
          errorCode: code,
          message: error instanceof Error ? error.message : 'Unknown AI error',
        });

        if (retry >= MAX_RETRIES) {
          return {
            ok: true,
            answer: `${fallbackFromSpecs(args.userMessage, args.context)}\n\n(Offline mode)`,
            offlineMode: true,
          };
        }

        const delay = 1000 * 2 ** retry;
        await sleep(delay);
      }

      retry += 1;
    }

    return {
      ok: true,
      answer: `${fallbackFromSpecs(args.userMessage, args.context)}\n\n(Offline mode)`,
      offlineMode: true,
    };
  }, []);

  return { sendMessage };
}
