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

// Database Types
export interface Project {
  id: string;
  name: string;
  code: string;
  client?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  currency?: string;
  created_at?: string;
}

export interface FileUpload {
  id: string;
  project_id: string;
  module: string;
  original_filename: string;
  storage_path: string;
  period_date?: string;
  row_count?: number;
  sheet_names?: string[];
  column_map?: Record<string, string>;
  parse_status?: string;
  parse_error?: string;
  uploaded_by?: string;
  upload_date?: string;
}

export interface ManpowerRecord {
  id: string;
  upload_id: string;
  project_id: string;
  period_date?: string;
  discipline?: string;
  company?: string;
  nationality?: string;
  planned_count?: number;
  actual_count?: number;
  variance?: number;
  raw_row?: Record<string, unknown>;
  created_at?: string;
}

export interface EquipmentRecord {
  id: string;
  upload_id: string;
  project_id: string;
  period_date?: string;
  equipment_type?: string;
  equipment_id?: string;
  discipline?: string;
  status?: string;
  planned_count?: number;
  actual_count?: number;
  idle_count?: number;
  breakdown_count?: number;
  utilisation_rate?: number;
  raw_row?: Record<string, unknown>;
  created_at?: string;
}

export interface ProgressRecord {
  id: string;
  upload_id: string;
  project_id: string;
  period_date?: string;
  activity_id?: string;
  activity_name?: string;
  discipline?: string;
  wbs_code?: string;
  planned_progress?: number;
  actual_progress?: number;
  variance?: number;
  weight?: number;
  start_date?: string;
  finish_date?: string;
  status?: string;
  raw_row?: Record<string, unknown>;
  created_at?: string;
}

export interface CostRecord {
  id: string;
  upload_id: string;
  project_id: string;
  period_date?: string;
  cost_code?: string;
  description?: string;
  discipline?: string;
  category?: string;
  budget_amount?: number;
  committed_amount?: number;
  actual_amount?: number;
  forecast_amount?: number;
  variance?: number;
  currency?: string;
  raw_row?: Record<string, unknown>;
  created_at?: string;
}

export interface KpiSnapshot {
  id: string;
  project_id: string;
  module: string;
  period_date?: string;
  kpi_key: string;
  kpi_value?: number;
  kpi_text?: string;
  kpi_unit?: string;
  upload_id?: string;
  computed_at?: string;
}

export interface AgentMessage {
  id: string;
  project_id: string;
  session_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  context_modules?: string[];
  created_at?: string;
}
