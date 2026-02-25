import { DashboardSpec } from '../types'

export const DEMO_MANPOWER_SPEC: DashboardSpec = {
  kpis: [
    { id: 'total_planned', label: 'Total Planned Headcount', value: 248, status: 'neutral', subLabel: 'Across all disciplines' },
    { id: 'total_actual', label: 'Total Actual Headcount', value: 221, delta: '-11%', status: 'warning', subLabel: 'On site today' },
    { id: 'variance_pct', label: 'Variance', value: '-10.9%', delta: '27 workers short', status: 'danger', subLabel: 'vs. planned' },
    { id: 'discipline_count', label: 'Active Disciplines', value: 6, status: 'good', subLabel: 'All reporting' },
  ],
  visuals: [
    {
      id: 'manpower_timeline', type: 'line', title: 'Planned vs Actual Headcount Over Time', xKey: 'date',
      series: [
        { key: 'planned_headcount', name: 'Planned', color: '#4B9EFF' },
        { key: 'actual_headcount', name: 'Actual', color: '#FF6A00' },
      ],
      data: [
        { date: '2024-01-08', planned_headcount: 220, actual_headcount: 198 },
        { date: '2024-01-09', planned_headcount: 230, actual_headcount: 210 },
        { date: '2024-01-10', planned_headcount: 235, actual_headcount: 215 },
        { date: '2024-01-11', planned_headcount: 240, actual_headcount: 208 },
        { date: '2024-01-12', planned_headcount: 248, actual_headcount: 221 },
      ],
    },
    {
      id: 'discipline_breakdown', type: 'bar', title: 'Headcount by Discipline', xKey: 'discipline',
      series: [
        { key: 'planned_headcount', name: 'Planned', color: '#4B9EFF' },
        { key: 'actual_headcount', name: 'Actual', color: '#FF6A00' },
      ],
      data: [
        { discipline: 'Civil', planned_headcount: 45, actual_headcount: 38 },
        { discipline: 'Mechanical', planned_headcount: 62, actual_headcount: 58 },
        { discipline: 'Electrical', planned_headcount: 55, actual_headcount: 51 },
        { discipline: 'Structural', planned_headcount: 40, actual_headcount: 32 },
        { discipline: 'Piping', planned_headcount: 30, actual_headcount: 27 },
        { discipline: 'Instrumentation', planned_headcount: 16, actual_headcount: 15 },
      ],
    },
    {
      id: 'manpower_table', type: 'table', title: 'Detailed Headcount by Discipline',
      columns: [
        { key: 'discipline', label: 'Discipline' },
        { key: 'planned_headcount', label: 'Planned' },
        { key: 'actual_headcount', label: 'Actual' },
        { key: 'variance', label: 'Variance' },
        { key: 'variance_pct', label: 'Variance %' },
      ],
      data: [
        { discipline: 'Civil', planned_headcount: 45, actual_headcount: 38, variance: -7, variance_pct: '-15.6%' },
        { discipline: 'Mechanical', planned_headcount: 62, actual_headcount: 58, variance: -4, variance_pct: '-6.5%' },
        { discipline: 'Electrical', planned_headcount: 55, actual_headcount: 51, variance: -4, variance_pct: '-7.3%' },
        { discipline: 'Structural', planned_headcount: 40, actual_headcount: 32, variance: -8, variance_pct: '-20.0%' },
        { discipline: 'Piping', planned_headcount: 30, actual_headcount: 27, variance: -3, variance_pct: '-10.0%' },
        { discipline: 'Instrumentation', planned_headcount: 16, actual_headcount: 15, variance: -1, variance_pct: '-6.3%' },
      ],
    },
  ],
  insights: [
    'Structural discipline is critically understaffed at -20% vs planned. Immediate action required.',
    'Mechanical discipline is closest to target (-6.5%), suggesting good crew availability.',
    'Overall workforce is 10.9% below planned — consider escalating to subcontractor leads.',
    'Headcount has declined from peak of 215 on Jan 10 — investigate root cause.',
  ],
  meta: { disciplines: ['Civil', 'Mechanical', 'Electrical', 'Structural', 'Piping', 'Instrumentation'], dateMin: '2024-01-08', dateMax: '2024-01-12' },
  lastUpdated: new Date().toISOString(),
}

export const DEMO_EQUIPMENT_SPEC: DashboardSpec = {
  kpis: [
    { id: 'active_count', label: 'Active Equipment', value: 34, status: 'good', subLabel: 'Currently operating' },
    { id: 'idle_count', label: 'Idle Equipment', value: 12, delta: '+3 vs yesterday', status: 'warning', subLabel: 'Standing by' },
    { id: 'breakdown_count', label: 'Breakdown', value: 5, delta: 'Needs attention', status: 'danger', subLabel: 'Out of service' },
    { id: 'utilization_pct', label: 'Utilization Rate', value: '66.2%', delta: '-5.1% vs target', status: 'warning', subLabel: 'Of total fleet' },
  ],
  visuals: [
    {
      id: 'status_breakdown', type: 'stackedBar', title: 'Equipment Status by Discipline', xKey: 'discipline',
      series: [
        { key: 'Active', name: 'Active', color: '#22c55e' },
        { key: 'Idle', name: 'Idle', color: '#eab308' },
        { key: 'Breakdown', name: 'Breakdown', color: '#ef4444' },
      ],
      data: [
        { discipline: 'Civil', Active: 8, Idle: 3, Breakdown: 1 },
        { discipline: 'Mechanical', Active: 10, Idle: 2, Breakdown: 2 },
        { discipline: 'Electrical', Active: 6, Idle: 4, Breakdown: 1 },
        { discipline: 'Structural', Active: 7, Idle: 2, Breakdown: 1 },
        { discipline: 'Piping', Active: 3, Idle: 1, Breakdown: 0 },
      ],
    },
    {
      id: 'equipment_table', type: 'table', title: 'Equipment Status Detail',
      columns: [
        { key: 'equipment_id', label: 'Equipment ID' },
        { key: 'discipline', label: 'Discipline' },
        { key: 'status', label: 'Status' },
        { key: 'hours_idle', label: 'Idle Hours' },
      ],
      data: [
        { equipment_id: 'EQ-001', discipline: 'Civil', status: 'Active', hours_idle: 0 },
        { equipment_id: 'EQ-005', discipline: 'Civil', status: 'Idle', hours_idle: 2.5 },
        { equipment_id: 'EQ-009', discipline: 'Mechanical', status: 'Breakdown', hours_idle: 14 },
        { equipment_id: 'EQ-012', discipline: 'Mechanical', status: 'Active', hours_idle: 0 },
        { equipment_id: 'EQ-019', discipline: 'Electrical', status: 'Idle', hours_idle: 4 },
        { equipment_id: 'EQ-023', discipline: 'Structural', status: 'Active', hours_idle: 0 },
        { equipment_id: 'EQ-031', discipline: 'Piping', status: 'Active', hours_idle: 0 },
      ],
    },
  ],
  insights: [
    '5 equipment units in Breakdown status — EQ-009 (Mechanical) has been idle 14 hours.',
    'Utilization rate of 66.2% is below the 71.3% target. Review idle equipment deployment.',
    'Electrical discipline has highest idle ratio (4 idle out of 11 total).',
    'Civil and Structural are performing closest to optimal utilization.',
  ],
  meta: { disciplines: ['Civil', 'Mechanical', 'Electrical', 'Structural', 'Piping'], dateMin: '2024-01-12', dateMax: '2024-01-12' },
  lastUpdated: new Date().toISOString(),
}

export const DEMO_PROGRESS_SPEC: DashboardSpec = {
  kpis: [
    { id: 'planned_avg', label: 'Planned Progress', value: '67.4%', status: 'neutral', subLabel: 'Schedule target' },
    { id: 'actual_avg', label: 'Actual Progress', value: '61.8%', delta: '-5.6% behind', status: 'warning', subLabel: 'Current completion' },
    { id: 'slippage_pct', label: 'Schedule Slippage', value: '-5.6%', delta: 'Trending negative', status: 'danger', subLabel: 'Behind schedule' },
    { id: 'disciplines_on_track', label: 'Disciplines On Track', value: '2 / 6', status: 'warning', subLabel: 'Meeting schedule' },
  ],
  visuals: [
    {
      id: 'progress_timeline', type: 'line', title: 'Planned vs Actual Progress Over Time', xKey: 'date',
      series: [
        { key: 'planned_progress_pct', name: 'Planned %', color: '#4B9EFF' },
        { key: 'actual_progress_pct', name: 'Actual %', color: '#FF6A00' },
      ],
      data: [
        { date: '2024-01-08', planned_progress_pct: 60, actual_progress_pct: 58 },
        { date: '2024-01-09', planned_progress_pct: 62, actual_progress_pct: 59.5 },
        { date: '2024-01-10', planned_progress_pct: 64, actual_progress_pct: 60.2 },
        { date: '2024-01-11', planned_progress_pct: 65.8, actual_progress_pct: 61.1 },
        { date: '2024-01-12', planned_progress_pct: 67.4, actual_progress_pct: 61.8 },
      ],
    },
    {
      id: 'progress_by_discipline', type: 'bar', title: 'Progress by Discipline', xKey: 'discipline',
      series: [
        { key: 'planned_progress_pct', name: 'Planned %', color: '#4B9EFF' },
        { key: 'actual_progress_pct', name: 'Actual %', color: '#FF6A00' },
      ],
      data: [
        { discipline: 'Civil', planned_progress_pct: 75, actual_progress_pct: 72 },
        { discipline: 'Mechanical', planned_progress_pct: 65, actual_progress_pct: 58 },
        { discipline: 'Electrical', planned_progress_pct: 70, actual_progress_pct: 62 },
        { discipline: 'Structural', planned_progress_pct: 80, actual_progress_pct: 79 },
        { discipline: 'Piping', planned_progress_pct: 55, actual_progress_pct: 48 },
        { discipline: 'Instrumentation', planned_progress_pct: 40, actual_progress_pct: 42 },
      ],
    },
    {
      id: 'progress_table', type: 'table', title: 'Progress Breakdown by Discipline',
      columns: [
        { key: 'discipline', label: 'Discipline' },
        { key: 'planned_progress_pct', label: 'Planned %' },
        { key: 'actual_progress_pct', label: 'Actual %' },
        { key: 'slippage', label: 'Slippage' },
        { key: 'status', label: 'Status' },
      ],
      data: [
        { discipline: 'Civil', planned_progress_pct: '75.0%', actual_progress_pct: '72.0%', slippage: '-3.0%', status: 'Minor Delay' },
        { discipline: 'Mechanical', planned_progress_pct: '65.0%', actual_progress_pct: '58.0%', slippage: '-7.0%', status: 'Behind' },
        { discipline: 'Electrical', planned_progress_pct: '70.0%', actual_progress_pct: '62.0%', slippage: '-8.0%', status: 'Behind' },
        { discipline: 'Structural', planned_progress_pct: '80.0%', actual_progress_pct: '79.0%', slippage: '-1.0%', status: 'On Track' },
        { discipline: 'Piping', planned_progress_pct: '55.0%', actual_progress_pct: '48.0%', slippage: '-7.0%', status: 'Behind' },
        { discipline: 'Instrumentation', planned_progress_pct: '40.0%', actual_progress_pct: '42.0%', slippage: '+2.0%', status: 'Ahead' },
      ],
    },
  ],
  insights: [
    'Piping (-7%) and Electrical (-8%) are the most behind schedule — prioritize resource allocation.',
    'Instrumentation is ahead of schedule (+2%) — a rare bright spot this period.',
    'Structural is nearly on track (-1%) and may be able to release resources to critical path items.',
    'Overall slippage has grown from -2% to -5.6% in 5 days — trajectory must be reversed.',
  ],
  meta: { disciplines: ['Civil', 'Mechanical', 'Electrical', 'Structural', 'Piping', 'Instrumentation'], dateMin: '2024-01-08', dateMax: '2024-01-12' },
  lastUpdated: new Date().toISOString(),
}

export const DEMO_COST_SPEC: DashboardSpec = {
  kpis: [
    { id: 'total_budget', label: 'Total Budget', value: '$4.2M', status: 'neutral', subLabel: 'Approved project budget' },
    { id: 'spent_to_date', label: 'Spent to Date', value: '$2.91M', delta: '+$210K this week', status: 'warning', subLabel: '69.3% of budget' },
    { id: 'cost_variance', label: 'Cost Variance', value: '-$340K', delta: '-8.1% over budget', status: 'danger', subLabel: 'vs. planned spend' },
    { id: 'forecast_at_completion', label: 'Forecast at Completion', value: '$4.54M', delta: '+$340K over budget', status: 'danger', subLabel: 'Projected final cost' },
  ],
  visuals: [
    {
      id: 'cost_timeline', type: 'line', title: 'Budget vs Actual Spend Over Time ($K)', xKey: 'date',
      series: [
        { key: 'planned_spend', name: 'Planned Spend ($K)', color: '#4B9EFF' },
        { key: 'actual_spend', name: 'Actual Spend ($K)', color: '#FF6A00' },
      ],
      data: [
        { date: '2024-01-08', planned_spend: 2420, actual_spend: 2580 },
        { date: '2024-01-09', planned_spend: 2520, actual_spend: 2680 },
        { date: '2024-01-10', planned_spend: 2610, actual_spend: 2760 },
        { date: '2024-01-11', planned_spend: 2700, actual_spend: 2840 },
        { date: '2024-01-12', planned_spend: 2570, actual_spend: 2910 },
      ],
    },
    {
      id: 'cost_by_discipline', type: 'bar', title: 'Budget vs Spent by Discipline ($K)', xKey: 'discipline',
      series: [
        { key: 'budget', name: 'Budget ($K)', color: '#4B9EFF' },
        { key: 'spent', name: 'Spent ($K)', color: '#FF6A00' },
      ],
      data: [
        { discipline: 'Civil', budget: 820, spent: 890 },
        { discipline: 'Mechanical', budget: 1050, spent: 1140 },
        { discipline: 'Electrical', budget: 760, spent: 820 },
        { discipline: 'Structural', budget: 680, spent: 660 },
        { discipline: 'Piping', budget: 540, spent: 580 },
        { discipline: 'Instrumentation', budget: 350, spent: 320 },
      ],
    },
    {
      id: 'cost_table', type: 'table', title: 'Cost Breakdown by Discipline',
      columns: [
        { key: 'discipline', label: 'Discipline' },
        { key: 'budget', label: 'Budget ($K)' },
        { key: 'spent', label: 'Spent ($K)' },
        { key: 'variance', label: 'Variance ($K)' },
        { key: 'variance_pct', label: 'Variance %' },
        { key: 'status', label: 'Status' },
      ],
      data: [
        { discipline: 'Civil', budget: '820', spent: '890', variance: '+70', variance_pct: '+8.5%', status: 'Over Budget' },
        { discipline: 'Mechanical', budget: '1,050', spent: '1,140', variance: '+90', variance_pct: '+8.6%', status: 'Over Budget' },
        { discipline: 'Electrical', budget: '760', spent: '820', variance: '+60', variance_pct: '+7.9%', status: 'Over Budget' },
        { discipline: 'Structural', budget: '680', spent: '660', variance: '-20', variance_pct: '-2.9%', status: 'Under Budget' },
        { discipline: 'Piping', budget: '540', spent: '580', variance: '+40', variance_pct: '+7.4%', status: 'Over Budget' },
        { discipline: 'Instrumentation', budget: '350', spent: '320', variance: '-30', variance_pct: '-8.6%', status: 'Under Budget' },
      ],
    },
  ],
  insights: [
    'Overall project is $340K (8.1%) over the planned spend-to-date — forecast at completion exceeds budget.',
    'Mechanical is the largest cost overrun at +$90K (+8.6%) — review subcontractor billing and scope creep.',
    'Structural and Instrumentation are under budget — may offset risk if trends continue.',
    'At the current burn rate of $210K/week, remaining budget will be exhausted in ~6.2 weeks.',
  ],
  meta: { disciplines: ['Civil', 'Mechanical', 'Electrical', 'Structural', 'Piping', 'Instrumentation'], dateMin: '2024-01-08', dateMax: '2024-01-12' },
  lastUpdated: new Date().toISOString(),
}

export function getDemoSpec(module: string): DashboardSpec | null {
  if (module === 'manpower') return DEMO_MANPOWER_SPEC
  if (module === 'equipment') return DEMO_EQUIPMENT_SPEC
  if (module === 'progress') return DEMO_PROGRESS_SPEC
  if (module === 'cost') return DEMO_COST_SPEC
  return null
}
