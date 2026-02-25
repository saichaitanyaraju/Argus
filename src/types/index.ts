export type Module = 'manpower' | 'equipment' | 'progress' | 'cost';

export interface KPI {
  id: string;
  label: string;
  value: string | number;
  delta?: string;
  status?: 'good' | 'warning' | 'danger' | 'neutral';
  unit?: string;
  subLabel?: string;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
}

export interface Visual {
  id: string;
  type: 'line' | 'bar' | 'stackedBar' | 'statusGrid' | 'table' | 'donut';
  title: string;
  xKey?: string;
  yKey?: string;
  series?: ChartSeries[];
  data?: Record<string, unknown>[];
  columns?: { key: string; label: string }[];
  dataKey?: string;
}

export interface DashboardSpec {
  kpis: KPI[];
  visuals: Visual[];
  insights: string[];
  meta: {
    disciplines: string[];
    dateMin: string;
    dateMax: string;
  };
  lastUpdated: string;
}

export interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  progress?: number;
  error?: string;
  fileName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  renderInstructions?: {
    highlightKpiId?: string;
    navigateModule?: Module;
    showMiniTable?: boolean;
    tableData?: Record<string, unknown>[];
  };
}

export interface AgentInput {
  module?: Module;
  disciplines?: string[];
  dateRange?: { from: string; to: string };
  question: string;
  dashboardSpec?: DashboardSpec;
}

export interface AgentOutput {
  message: string;
  render_instructions?: {
    highlightKpiId?: string;
    navigateModule?: Module;
    showMiniTable?: boolean;
    tableData?: Record<string, unknown>[];
  };
}
