import { DashboardSpec, Module } from '../types';
import { toIsoDate } from '../utils/dateParser';

type AnyRow = Record<string, unknown>;

function toNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const cleaned = String(value).replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function normalizeDate(value: unknown): string {
  return toIsoDate(value);
}

function normalizeDiscipline(value: unknown): string {
  const discipline = String(value || '').trim();
  return discipline || 'Unspecified';
}

function statusForVariance(variance: number): 'good' | 'warning' | 'danger' | 'neutral' {
  if (variance >= 0) return 'good';
  if (variance >= -5) return 'warning';
  return 'danger';
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildEmptySpec(module: Module): DashboardSpec {
  return {
    kpis: [],
    visuals: [],
    insights: [`No ${module} data available for the selected filters.`],
    meta: {
      disciplines: [],
      dateMin: '',
      dateMax: '',
    },
    lastUpdated: new Date().toISOString(),
  };
}

function getDateBounds(dates: string[]): { dateMin: string; dateMax: string } {
  const sortedDates = sortedUnique(dates);
  return {
    dateMin: sortedDates[0] || '',
    dateMax: sortedDates[sortedDates.length - 1] || '',
  };
}

function buildManpowerSpec(rows: AnyRow[]): DashboardSpec {
  if (!rows.length) return buildEmptySpec('manpower');

  const normalized = rows.map((row) => {
    const date = normalizeDate(row.date || row.period_date || row.timestamp);
    const discipline = normalizeDiscipline(row.discipline);
    const planned = toNumber(row.planned_count, row.planned_headcount, row.planned, row.target);
    const actual = toNumber(row.actual_count, row.actual_headcount, row.actual, row.present, row.on_site);
    return { date, discipline, planned, actual };
  });

  const totalPlanned = normalized.reduce((sum, row) => sum + row.planned, 0);
  const totalActual = normalized.reduce((sum, row) => sum + row.actual, 0);
  const variance = totalActual - totalPlanned;
  const variancePct = totalPlanned > 0 ? (variance / totalPlanned) * 100 : 0;
  const status = statusForVariance(variancePct);

  const disciplines = sortedUnique(normalized.map((row) => row.discipline));
  const dates = sortedUnique(normalized.map((row) => row.date));
  const dateBounds = getDateBounds(dates);

  const timeline = dates.map((date) => {
    const sameDate = normalized.filter((row) => row.date === date);
    return {
      date,
      planned_headcount: sameDate.reduce((sum, row) => sum + row.planned, 0),
      actual_headcount: sameDate.reduce((sum, row) => sum + row.actual, 0),
    };
  });

  const disciplineBreakdown = disciplines.map((discipline) => {
    const sameDiscipline = normalized.filter((row) => row.discipline === discipline);
    const planned = sameDiscipline.reduce((sum, row) => sum + row.planned, 0);
    const actual = sameDiscipline.reduce((sum, row) => sum + row.actual, 0);
    const diff = actual - planned;
    const diffPct = planned > 0 ? (diff / planned) * 100 : 0;
    return {
      discipline,
      planned_headcount: planned,
      actual_headcount: actual,
      variance: diff,
      variance_pct: formatPercent(diffPct),
    };
  });

  const worst = [...disciplineBreakdown].sort(
    (a, b) => parseFloat(a.variance_pct) - parseFloat(b.variance_pct)
  )[0];

  return {
    kpis: [
      {
        id: 'total_planned',
        label: 'Total Planned Headcount',
        value: totalPlanned.toFixed(0),
        status: 'neutral',
        subLabel: 'Across all disciplines',
      },
      {
        id: 'total_actual',
        label: 'Total Actual Headcount',
        value: totalActual.toFixed(0),
        delta: formatPercent(variancePct),
        status,
        subLabel: 'Current on-site count',
      },
      {
        id: 'variance_pct',
        label: 'Variance',
        value: formatPercent(variancePct),
        delta: `${variance.toFixed(0)} workers`,
        status,
        subLabel: 'Actual vs planned',
      },
      {
        id: 'discipline_count',
        label: 'Disciplines',
        value: disciplines.length,
        status: 'neutral',
        subLabel: 'Reporting data',
      },
    ],
    visuals: [
      {
        id: 'manpower_timeline',
        type: 'line',
        title: 'Planned vs Actual Headcount Over Time',
        xKey: 'date',
        series: [
          { key: 'planned_headcount', name: 'Planned', color: '#4B9EFF' },
          { key: 'actual_headcount', name: 'Actual', color: '#FF6A00' },
        ],
        data: timeline,
      },
      {
        id: 'manpower_by_discipline',
        type: 'bar',
        title: 'Headcount by Discipline',
        xKey: 'discipline',
        series: [
          { key: 'planned_headcount', name: 'Planned', color: '#4B9EFF' },
          { key: 'actual_headcount', name: 'Actual', color: '#FF6A00' },
        ],
        data: disciplineBreakdown,
      },
      {
        id: 'manpower_table',
        type: 'table',
        title: 'Discipline Breakdown',
        columns: [
          { key: 'discipline', label: 'Discipline' },
          { key: 'planned_headcount', label: 'Planned' },
          { key: 'actual_headcount', label: 'Actual' },
          { key: 'variance', label: 'Variance' },
          { key: 'variance_pct', label: 'Variance %' },
        ],
        data: disciplineBreakdown,
      },
    ],
    insights: [
      `Overall manpower is ${variancePct >= 0 ? 'above' : 'below'} plan by ${Math.abs(variancePct).toFixed(1)}%.`,
      worst
        ? `${worst.discipline} has the largest staffing variance at ${worst.variance_pct}.`
        : 'Discipline variance is balanced.',
      `Data spans ${dates.length} day(s) from ${dateBounds.dateMin || 'N/A'} to ${dateBounds.dateMax || 'N/A'}.`,
    ],
    meta: {
      disciplines,
      ...dateBounds,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function buildEquipmentSpec(rows: AnyRow[]): DashboardSpec {
  if (!rows.length) return buildEmptySpec('equipment');

  const normalized = rows.map((row) => {
    const date = normalizeDate(row.date || row.timestamp || row.period_date);
    const discipline = normalizeDiscipline(row.discipline);
    const equipmentId = String(row.equipment_id || row.id || '').trim() || 'N/A';
    const statusRaw = String(row.status || '').trim().toLowerCase();
    const status = statusRaw || 'unknown';
    const idleHours = toNumber(row.hours_idle, row.idle_hours, row.idle_count);
    const utilization = toNumber(
      row.utilisation_rate,
      row.utilization_rate,
      row.utilization,
      row.usage,
      row.efficiency
    );
    return { date, discipline, equipmentId, status, idleHours, utilization };
  });

  const activeCount = normalized.filter((row) => row.status === 'active').length;
  const idleCount = normalized.filter((row) => row.status === 'idle').length;
  const breakdownCount = normalized.filter((row) => row.status === 'breakdown').length;
  const knownFleet = activeCount + idleCount + breakdownCount;
  const utilizationPct = knownFleet > 0 ? (activeCount / knownFleet) * 100 : 0;

  const disciplines = sortedUnique(normalized.map((row) => row.discipline));
  const dates = sortedUnique(normalized.map((row) => row.date));
  const dateBounds = getDateBounds(dates);

  const statusByDiscipline = disciplines.map((discipline) => {
    const sameDiscipline = normalized.filter((row) => row.discipline === discipline);
    return {
      discipline,
      Active: sameDiscipline.filter((row) => row.status === 'active').length,
      Idle: sameDiscipline.filter((row) => row.status === 'idle').length,
      Breakdown: sameDiscipline.filter((row) => row.status === 'breakdown').length,
    };
  });

  const utilizationTimeline = dates.map((date) => {
    const sameDate = normalized.filter((row) => row.date === date);
    const active = sameDate.filter((row) => row.status === 'active').length;
    const idle = sameDate.filter((row) => row.status === 'idle').length;
    const breakdown = sameDate.filter((row) => row.status === 'breakdown').length;
    const total = active + idle + breakdown;
    const avgUtilization =
      sameDate.length > 0
        ? sameDate.reduce((sum, row) => sum + row.utilization, 0) / sameDate.length
        : 0;
    const computedUtilization = total > 0 ? (active / total) * 100 : 0;
    return {
      date,
      utilization_rate: Number(Math.max(avgUtilization, computedUtilization).toFixed(1)),
    };
  });

  const equipmentTable = normalized.slice(0, 80).map((row) => ({
    equipment_id: row.equipmentId,
    discipline: row.discipline,
    status: row.status ? `${row.status.charAt(0).toUpperCase()}${row.status.slice(1)}` : 'Unknown',
    hours_idle: row.idleHours.toFixed(1),
  }));

  const worstDiscipline = [...statusByDiscipline].sort((a, b) => b.Breakdown - a.Breakdown)[0];

  return {
    kpis: [
      {
        id: 'active_count',
        label: 'Active Equipment',
        value: activeCount,
        status: 'good',
        subLabel: 'Currently operating',
      },
      {
        id: 'idle_count',
        label: 'Idle Equipment',
        value: idleCount,
        status: idleCount > knownFleet * 0.3 ? 'warning' : 'neutral',
        subLabel: 'Standing by',
      },
      {
        id: 'breakdown_count',
        label: 'Breakdown',
        value: breakdownCount,
        status: breakdownCount > 0 ? 'danger' : 'good',
        subLabel: 'Out of service',
      },
      {
        id: 'utilization_pct',
        label: 'Utilization Rate',
        value: formatPercent(utilizationPct),
        status: utilizationPct >= 70 ? 'good' : utilizationPct >= 55 ? 'warning' : 'danger',
        subLabel: 'From status distribution',
      },
    ],
    visuals: [
      {
        id: 'equipment_status_by_discipline',
        type: 'stackedBar',
        title: 'Equipment Status by Discipline',
        xKey: 'discipline',
        series: [
          { key: 'Active', name: 'Active', color: '#22c55e' },
          { key: 'Idle', name: 'Idle', color: '#eab308' },
          { key: 'Breakdown', name: 'Breakdown', color: '#ef4444' },
        ],
        data: statusByDiscipline,
      },
      {
        id: 'equipment_utilization_timeline',
        type: 'line',
        title: 'Equipment Utilization Rate Over Time',
        xKey: 'date',
        series: [{ key: 'utilization_rate', name: 'Utilization %', color: '#FF6A00' }],
        data: utilizationTimeline,
      },
      {
        id: 'equipment_table',
        type: 'table',
        title: 'Equipment Detail',
        columns: [
          { key: 'equipment_id', label: 'Equipment ID' },
          { key: 'discipline', label: 'Discipline' },
          { key: 'status', label: 'Status' },
          { key: 'hours_idle', label: 'Idle Hours' },
        ],
        data: equipmentTable,
      },
    ],
    insights: [
      `Fleet utilization is ${utilizationPct.toFixed(1)}% (${activeCount} active, ${idleCount} idle, ${breakdownCount} breakdown).`,
      worstDiscipline
        ? `${worstDiscipline.discipline} has the highest breakdown count (${worstDiscipline.Breakdown}).`
        : 'Breakdown risk is low across all disciplines.',
      `Data spans ${dates.length} day(s) from ${dateBounds.dateMin || 'N/A'} to ${dateBounds.dateMax || 'N/A'}.`,
    ],
    meta: {
      disciplines,
      ...dateBounds,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function buildProgressSpec(rows: AnyRow[]): DashboardSpec {
  if (!rows.length) return buildEmptySpec('progress');

  const normalized = rows.map((row) => {
    const date = normalizeDate(row.date || row.period_date || row.timestamp);
    const discipline = normalizeDiscipline(row.discipline);
    const planned = toNumber(row.planned_progress, row.planned_progress_pct, row.planned);
    const actual = toNumber(row.actual_progress, row.actual_progress_pct, row.actual);
    return { date, discipline, planned, actual };
  });

  const plannedAvg =
    normalized.length > 0
      ? normalized.reduce((sum, row) => sum + row.planned, 0) / normalized.length
      : 0;
  const actualAvg =
    normalized.length > 0
      ? normalized.reduce((sum, row) => sum + row.actual, 0) / normalized.length
      : 0;
  const slippage = actualAvg - plannedAvg;

  const disciplines = sortedUnique(normalized.map((row) => row.discipline));
  const dates = sortedUnique(normalized.map((row) => row.date));
  const dateBounds = getDateBounds(dates);

  const timeline = dates.map((date) => {
    const sameDate = normalized.filter((row) => row.date === date);
    return {
      date,
      planned_progress_pct:
        sameDate.length > 0
          ? Number(
              (sameDate.reduce((sum, row) => sum + row.planned, 0) / sameDate.length).toFixed(1)
            )
          : 0,
      actual_progress_pct:
        sameDate.length > 0
          ? Number(
              (sameDate.reduce((sum, row) => sum + row.actual, 0) / sameDate.length).toFixed(1)
            )
          : 0,
    };
  });

  const byDiscipline = disciplines.map((discipline) => {
    const sameDiscipline = normalized.filter((row) => row.discipline === discipline);
    const planned =
      sameDiscipline.length > 0
        ? sameDiscipline.reduce((sum, row) => sum + row.planned, 0) / sameDiscipline.length
        : 0;
    const actual =
      sameDiscipline.length > 0
        ? sameDiscipline.reduce((sum, row) => sum + row.actual, 0) / sameDiscipline.length
        : 0;
    const diff = actual - planned;
    return {
      discipline,
      planned_progress_pct: Number(planned.toFixed(1)),
      actual_progress_pct: Number(actual.toFixed(1)),
      slippage: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
      status: diff >= 0 ? 'On Track' : diff > -5 ? 'Minor Delay' : 'Behind',
    };
  });

  const onTrack = byDiscipline.filter((row) => row.status === 'On Track').length;
  const worst = [...byDiscipline].sort(
    (a, b) => parseFloat(a.slippage) - parseFloat(b.slippage)
  )[0];

  return {
    kpis: [
      {
        id: 'planned_avg',
        label: 'Planned Progress',
        value: formatPercent(plannedAvg),
        status: 'neutral',
        subLabel: 'Schedule target',
      },
      {
        id: 'actual_avg',
        label: 'Actual Progress',
        value: formatPercent(actualAvg),
        delta: `${slippage >= 0 ? '+' : ''}${slippage.toFixed(1)}% vs plan`,
        status: slippage >= 0 ? 'good' : slippage >= -5 ? 'warning' : 'danger',
        subLabel: 'Current completion',
      },
      {
        id: 'slippage_pct',
        label: 'Schedule Slippage',
        value: `${slippage >= 0 ? '+' : ''}${slippage.toFixed(1)}%`,
        status: slippage >= 0 ? 'good' : slippage >= -5 ? 'warning' : 'danger',
        subLabel: 'Actual minus planned',
      },
      {
        id: 'disciplines_on_track',
        label: 'Disciplines On Track',
        value: `${onTrack} / ${disciplines.length}`,
        status: onTrack === disciplines.length ? 'good' : onTrack >= 1 ? 'warning' : 'danger',
        subLabel: 'Meeting planned pace',
      },
    ],
    visuals: [
      {
        id: 'progress_timeline',
        type: 'line',
        title: 'Planned vs Actual Progress Over Time',
        xKey: 'date',
        series: [
          { key: 'planned_progress_pct', name: 'Planned %', color: '#4B9EFF' },
          { key: 'actual_progress_pct', name: 'Actual %', color: '#FF6A00' },
        ],
        data: timeline,
      },
      {
        id: 'progress_by_discipline',
        type: 'bar',
        title: 'Progress by Discipline',
        xKey: 'discipline',
        series: [
          { key: 'planned_progress_pct', name: 'Planned %', color: '#4B9EFF' },
          { key: 'actual_progress_pct', name: 'Actual %', color: '#FF6A00' },
        ],
        data: byDiscipline,
      },
      {
        id: 'progress_table',
        type: 'table',
        title: 'Progress Detail by Discipline',
        columns: [
          { key: 'discipline', label: 'Discipline' },
          { key: 'planned_progress_pct', label: 'Planned %' },
          { key: 'actual_progress_pct', label: 'Actual %' },
          { key: 'slippage', label: 'Slippage' },
          { key: 'status', label: 'Status' },
        ],
        data: byDiscipline,
      },
    ],
    insights: [
      `Overall progress is ${Math.abs(slippage).toFixed(1)}% ${slippage < 0 ? 'behind' : 'ahead of'} schedule.`,
      worst
        ? `${worst.discipline} has the largest delay at ${worst.slippage}.`
        : 'No critical discipline delays detected.',
      `Data spans ${dates.length} day(s) from ${dateBounds.dateMin || 'N/A'} to ${dateBounds.dateMax || 'N/A'}.`,
    ],
    meta: {
      disciplines,
      ...dateBounds,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function buildCostSpec(rows: AnyRow[]): DashboardSpec {
  if (!rows.length) return buildEmptySpec('cost');

  const normalized = rows.map((row) => {
    const date = normalizeDate(row.date || row.period_date || row.timestamp);
    const discipline = normalizeDiscipline(row.discipline);
    const budget = toNumber(
      row.budget_amount,
      row.budget,
      row.planned,
      row.approved,
      row.baseline
    );
    const actual = toNumber(
      row.actual_amount,
      row.actual_spend,
      row.actual,
      row.spent,
      row.incurred
    );
    const committed = toNumber(row.committed_amount, row.committed, row.commitment);
    const forecast = toNumber(row.forecast_amount, row.forecast, row.estimate, row.eac);
    const code = String(row.cost_code || row.code || '').trim();
    return { date, discipline, budget, actual, committed, forecast, code };
  });

  const totalBudget = normalized.reduce((sum, row) => sum + row.budget, 0);
  const totalSpent = normalized.reduce((sum, row) => sum + row.actual, 0);
  const variance = totalBudget - totalSpent;
  const variancePct = totalBudget > 0 ? (variance / totalBudget) * 100 : 0;

  const disciplines = sortedUnique(normalized.map((row) => row.discipline));
  const dates = sortedUnique(normalized.map((row) => row.date));
  const dateBounds = getDateBounds(dates);

  const timeline = dates.map((date) => {
    const sameDate = normalized.filter((row) => row.date === date);
    const budget = sameDate.reduce((sum, row) => sum + row.budget, 0);
    const actual = sameDate.reduce((sum, row) => sum + row.actual, 0);
    return {
      date,
      budget_amount: Number(budget.toFixed(2)),
      actual_spend: Number(actual.toFixed(2)),
      variance: Number((budget - actual).toFixed(2)),
    };
  });

  const byDiscipline = disciplines.map((discipline) => {
    const sameDiscipline = normalized.filter((row) => row.discipline === discipline);
    const budget = sameDiscipline.reduce((sum, row) => sum + row.budget, 0);
    const actual = sameDiscipline.reduce((sum, row) => sum + row.actual, 0);
    const committed = sameDiscipline.reduce((sum, row) => sum + row.committed, 0);
    const forecast = sameDiscipline.reduce((sum, row) => sum + row.forecast, 0);
    const diff = budget - actual;
    const diffPct = budget > 0 ? (diff / budget) * 100 : 0;
    return {
      discipline,
      budget_amount: Number(budget.toFixed(2)),
      actual_spend: Number(actual.toFixed(2)),
      committed_amount: Number(committed.toFixed(2)),
      forecast_amount: Number(forecast.toFixed(2)),
      variance: Number(diff.toFixed(2)),
      variance_pct: formatPercent(diffPct),
    };
  });

  const worst = [...byDiscipline].sort((a, b) => a.variance - b.variance)[0];
  const costStatus: 'good' | 'warning' | 'danger' =
    variance >= 0 ? 'good' : variancePct >= -5 ? 'warning' : 'danger';

  return {
    kpis: [
      {
        id: 'total_budget',
        label: 'Total Budget',
        value: totalBudget.toFixed(2),
        status: 'neutral',
        subLabel: 'From uploaded cost records',
      },
      {
        id: 'total_spent',
        label: 'Total Spent',
        value: totalSpent.toFixed(2),
        status: totalSpent > totalBudget ? 'warning' : 'neutral',
        subLabel: 'Actual spend to date',
      },
      {
        id: 'cost_variance',
        label: 'Cost Variance',
        value: variance.toFixed(2),
        delta: formatPercent(variancePct),
        status: costStatus,
        subLabel: 'Budget minus spend',
      },
      {
        id: 'discipline_count',
        label: 'Disciplines',
        value: disciplines.length,
        status: 'neutral',
        subLabel: 'Reporting data',
      },
    ],
    visuals: [
      {
        id: 'cost_timeline',
        type: 'line',
        title: 'Budget vs Spend Over Time',
        xKey: 'date',
        series: [
          { key: 'budget_amount', name: 'Budget', color: '#4B9EFF' },
          { key: 'actual_spend', name: 'Spend', color: '#FF6A00' },
        ],
        data: timeline,
      },
      {
        id: 'cost_by_discipline',
        type: 'bar',
        title: 'Budget vs Spend by Discipline',
        xKey: 'discipline',
        series: [
          { key: 'budget_amount', name: 'Budget', color: '#4B9EFF' },
          { key: 'actual_spend', name: 'Spend', color: '#FF6A00' },
        ],
        data: byDiscipline,
      },
      {
        id: 'cost_table',
        type: 'table',
        title: 'Cost Breakdown by Discipline',
        columns: [
          { key: 'discipline', label: 'Discipline' },
          { key: 'budget_amount', label: 'Budget' },
          { key: 'actual_spend', label: 'Spend' },
          { key: 'committed_amount', label: 'Committed' },
          { key: 'forecast_amount', label: 'Forecast' },
          { key: 'variance', label: 'Variance' },
          { key: 'variance_pct', label: 'Variance %' },
        ],
        data: byDiscipline,
      },
    ],
    insights: [
      `Total spend is ${variance >= 0 ? 'within' : 'over'} budget by ${Math.abs(variance).toFixed(2)} (${Math.abs(variancePct).toFixed(1)}%).`,
      worst ? `${worst.discipline} has the largest variance at ${worst.variance_pct}.` : 'No discipline variance detected.',
      `Data spans ${dates.length} day(s) from ${dateBounds.dateMin || 'N/A'} to ${dateBounds.dateMax || 'N/A'}.`,
    ],
    meta: {
      disciplines,
      ...dateBounds,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function buildDashboardSpec(module: Module, rows: AnyRow[]): DashboardSpec {
  switch (module) {
    case 'manpower':
      return buildManpowerSpec(rows);
    case 'equipment':
      return buildEquipmentSpec(rows);
    case 'progress':
      return buildProgressSpec(rows);
    case 'cost':
      return buildCostSpec(rows);
    default:
      return buildEmptySpec(module);
  }
}
