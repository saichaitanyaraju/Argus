import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Lock } from 'lucide-react';
import { Module, UploadState, DashboardSpec } from '../../types';
import { buildDashboardSpec } from '../../lib/specBuilders';
import { preprocessUploadRows, type UploadProfile } from '../../lib/uploadPreprocess';
import { toIsoDate } from '../../utils/dateParser';

interface Props {
  module: Module;
  onSpecLoaded: (payload: {
    spec: DashboardSpec;
    recordsSample: Record<string, unknown>[];
    analysisProfile?: UploadProfile;
  }) => void;
  readOnly?: boolean;
}

const moduleLabels: Record<Module, string> = {
  manpower: 'Manpower',
  equipment: 'Equipment',
  progress: 'Work Progress',
  cost: 'Cost',
};

const SHEET_SCAN_ROWS = 80;
const MAX_DATA_ROWS = 10000;

const moduleSheetHints: Record<Module, string[]> = {
  manpower: ['manpower', 'mp', 'summary', 'present', 'designation', 'department'],
  equipment: ['equipment', 'vehicle', 'breakdown', 'idle', 'demob', 'list'],
  progress: ['progress', 'daily', 'qty', 'commodity', 'discipline', 'package'],
  cost: ['cost', 'summary', 'lpo', 'expense', 'report', 'payment'],
};

const columnSynonyms: Record<string, string[]> = {
  planned_count: ['planned', 'plan', 'target', 'budget', 'required', 'planned_headcount', 'planned headcount'],
  actual_count: ['actual', 'act', 'current', 'present', 'on_site', 'onsite', 'actual_headcount', 'actual headcount'],
  discipline: ['discipline', 'trade', 'dept', 'department', 'crew', 'team', 'trade for dpr'],
  company: ['company', 'contractor', 'vendor', 'subcontractor', 'firm', 'org', 'supplier company', 'supplier name'],
  nationality: ['nationality', 'national', 'country', 'origin'],

  equipment_type: ['type', 'equipment_type', 'equipment type', 'category', 'model', 'type of vehicle'],
  equipment_id: ['id', 'equipment_id', 'equipment id', 'tag', 'tag_no', 'tag number', 'asset_id', 'plate no', 'reg no'],
  status: ['status', 'state', 'condition', 'availability', 'equipment working status'],
  idle_count: ['idle', 'standby', 'waiting', 'available'],
  breakdown_count: ['breakdown', 'broken', 'repair', 'maintenance', 'down'],
  utilisation_rate: ['utilisation', 'utilization', 'usage', 'efficiency', 'productivity'],
  hours_idle: ['hours_idle', 'idle_hours', 'idle hrs', 'total monthly hours'],
  location: ['location', 'package', 'project/package', 'project package'],

  activity_id: ['activity_id', 'activity id', 'task_id', 'task id', 'id', 'code'],
  activity_name: ['activity', 'activity_name', 'activity name', 'task', 'task_name', 'description', 'name'],
  wbs_code: ['wbs', 'wbs_code', 'wbs code', 'work_breakdown', 'breakdown'],
  planned_progress: ['planned_progress', 'planned progress', 'planned_pct', 'target_progress', 'baseline', 'planned qty', 'scope', 'target'],
  actual_progress: ['actual_progress', 'actual progress', 'actual_pct', 'current_progress', 'achieved', 'executed qty', 'total achieved', 'monthly achieved', 'today achieved'],
  weight: ['weight', 'weighted', 'priority', 'importance'],

  cost_code: ['cost_code', 'cost code', 'code', 'account', 'gl_code', 'wbs'],
  description: ['description', 'desc', 'item', 'name', 'narrative'],
  category: ['category', 'type', 'class', 'group', 'classification', 'particulars'],
  budget_amount: ['budget', 'planned', 'approved', 'authorized', 'baseline', 'lpo amount', 'amount', 'total'],
  committed_amount: ['committed', 'commitment', 'po', 'order', 'contracted'],
  actual_amount: ['actual', 'spent', 'paid', 'invoiced', 'incurred', 'actual_spend', 'lpo amount', 'amount', 'total'],
  forecast_amount: ['forecast', 'projected', 'estimate', 'prediction', 'eac'],
  currency: ['currency', 'curr', 'ccy'],
  date: ['date', 'day', 'period_date', 'period date', 'mob date', 'delivery-production confirmed date', 'delivery confirmed date', 'cheque-payment date'],
  timestamp: ['timestamp', 'time', 'datetime', 'date_time'],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\s-]+/g, '_');
}

function cleanCell(value: unknown): string {
  return String(value ?? '').replace(/\r|\n/g, ' ').trim();
}

function extractIsoDateFromText(value: unknown): string {
  const text = cleanCell(value);
  if (!text) return '';

  const direct = toIsoDate(text);
  if (direct) return direct;

  const dayMonthYear = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dayMonthYear) {
    const [, d, m, yRaw] = dayMonthYear;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return '';
}

function matchColumn(header: string): string | null {
  const normalizedHeader = normalizeHeader(header);

  for (const [canonical, synonyms] of Object.entries(columnSynonyms)) {
    if (normalizedHeader === canonical) return canonical;
    if (synonyms.some((synonym) => normalizedHeader === normalizeHeader(synonym))) {
      return canonical;
    }
    if (synonyms.some((synonym) => normalizedHeader.includes(normalizeHeader(synonym)))) {
      return canonical;
    }
  }

  return null;
}

function buildColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  headers.forEach((header) => {
    const matched = matchColumn(header);
    if (matched) map[header] = matched;
  });
  return map;
}

function headerMatchScore(headers: string[]): number {
  return headers.reduce((score, header) => {
    return score + (matchColumn(header) ? 1 : 0);
  }, 0);
}

function sheetHintScore(module: Module, sheetName: string): number {
  const normalized = normalizeHeader(sheetName);
  return moduleSheetHints[module].reduce((score, hint) => {
    return score + (normalized.includes(normalizeHeader(hint)) ? 1 : 0);
  }, 0);
}

function detectHeaderRow(rows: unknown[][]): { index: number; score: number } | null {
  let best: { index: number; score: number } | null = null;
  const scanLimit = Math.min(rows.length, SHEET_SCAN_ROWS);

  for (let idx = 0; idx < scanLimit; idx += 1) {
    const candidate = rows[idx].map((cell) => cleanCell(cell)).filter(Boolean);
    if (candidate.length < 3) continue;

    const score = headerMatchScore(candidate);
    if (!best || score > best.score) {
      best = { index: idx, score };
    }
  }

  if (!best || best.score < 2) return null;
  return best;
}

function coerceValue(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'string') return value.trim();
  return value;
}

function firstNonEmpty(...values: unknown[]): unknown {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    return value;
  }
  return '';
}

function mapRows(
  module: Module,
  headers: string[],
  rows: unknown[][],
  columnMap: Record<string, string>,
  contextDate: string
): Record<string, unknown>[] {
  return rows
    .map((row) => {
      const mapped: Record<string, unknown> = {};

      headers.forEach((header, idx) => {
        const rawValue = coerceValue(row[idx]);
        const canonical = columnMap[header];
        if (canonical) mapped[canonical] = rawValue;

        const fallbackKey = normalizeHeader(header);
        if (!mapped[fallbackKey]) mapped[fallbackKey] = rawValue;
      });

      if (!mapped.date && mapped.timestamp) mapped.date = mapped.timestamp;
      if (!mapped.timestamp && mapped.date) mapped.timestamp = mapped.date;
      if (!mapped.planned_progress && mapped.planned_progress_pct) mapped.planned_progress = mapped.planned_progress_pct;
      if (!mapped.actual_progress && mapped.actual_progress_pct) mapped.actual_progress = mapped.actual_progress_pct;
      if (!mapped.actual_amount && mapped.actual_spend) mapped.actual_amount = mapped.actual_spend;
      if (!mapped.actual_count && mapped.actual_headcount) mapped.actual_count = mapped.actual_headcount;
      if (!mapped.planned_count && mapped.planned_headcount) mapped.planned_count = mapped.planned_headcount;

      if (module === 'manpower') {
        mapped.discipline = firstNonEmpty(
          mapped.discipline,
          mapped.trade_for_dpr,
          mapped.standard_trade,
          mapped.actual_trade,
          mapped.present_designation,
          mapped.department,
          mapped.category,
          'General'
        );

        if (!mapped.actual_count && mapped.physical_presence) {
          const presence = String(mapped.physical_presence).toLowerCase();
          mapped.actual_count = presence.includes('present') ? 1 : 0;
        }
        if (!mapped.planned_count && mapped.actual_count) mapped.planned_count = mapped.actual_count;
      }

      if (module === 'equipment') {
        mapped.equipment_id = firstNonEmpty(mapped.equipment_id, mapped.plate_no, mapped.reg_no, mapped.asset_code, mapped.id);
        mapped.discipline = firstNonEmpty(mapped.discipline, mapped.location, mapped.department, 'General');
        mapped.status = firstNonEmpty(mapped.status, mapped.equipment_working_status, 'active');
        mapped.hours_idle = firstNonEmpty(mapped.hours_idle, mapped.total_monthly_hours, mapped.idle_hours, 0);
      }

      if (module === 'progress') {
        mapped.discipline = firstNonEmpty(mapped.discipline, mapped.trade, mapped.activity, mapped.package, 'General');
        mapped.planned_progress = firstNonEmpty(mapped.planned_progress, mapped.planned_qty, mapped.scope, mapped.target, 0);
        mapped.actual_progress = firstNonEmpty(mapped.actual_progress, mapped.executed_qty, mapped.total_achieved, mapped.monthly_achieved, 0);
      }

      if (module === 'cost') {
        mapped.discipline = firstNonEmpty(mapped.discipline, mapped.department, mapped.category, mapped.particulars, mapped.project_package, 'General');
        mapped.actual_amount = firstNonEmpty(
          mapped.actual_amount,
          mapped.lpo_amount,
          mapped.amount,
          mapped.total,
          mapped.s2a,
          mapped.s4a,
          mapped.s4b,
          0
        );
        mapped.budget_amount = firstNonEmpty(mapped.budget_amount, mapped.actual_amount, 0);
      }

      if (!mapped.date && !mapped.timestamp && contextDate) {
        mapped.date = contextDate;
        mapped.timestamp = contextDate;
      }

      const hasAnyValue = Object.values(mapped).some((value) => value !== '');
      if (!hasAnyValue) return null;

      const requiredByModule: Record<Module, string[]> = {
        manpower: ['date', 'discipline'],
        equipment: ['discipline', 'equipment_id'],
        progress: ['date', 'discipline'],
        cost: ['date', 'actual_amount'],
      };

      if (requiredByModule[module].every((key) => !mapped[key])) {
        return null;
      }

      return mapped;
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function detectContextDate(fileName: string, previewRows: unknown[][]): string {
  const fromFileName = extractIsoDateFromText(fileName);
  if (fromFileName) return fromFileName;

  const flatCells = previewRows.flat().slice(0, 300);
  for (const cell of flatCells) {
    const date = extractIsoDateFromText(cell);
    if (date) return date;
  }

  return new Date().toISOString().split('T')[0];
}

export default function UploadZone({ module, onSpecLoaded, readOnly = false }: Props) {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        setState({ status: 'error', error: 'File exceeds 10MB limit.' });
        return;
      }

      setState({ status: 'uploading', fileName: file.name });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const candidates: Array<{
          sheetName: string;
          mappedRows: Record<string, unknown>[];
          quality: number;
        }> = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet || !sheet['!ref']) continue;

          const decodedRange = XLSX.utils.decode_range(sheet['!ref']);
          const maxCol = decodedRange.e.c;
          const previewEndRow = Math.min(decodedRange.e.r, SHEET_SCAN_ROWS);
          const previewRange = { s: { r: 0, c: 0 }, e: { r: previewEndRow, c: maxCol } };

          const previewRows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            blankrows: false,
            range: previewRange,
          }) as unknown[][];

          if (!previewRows.length) continue;

          const header = detectHeaderRow(previewRows);
          if (!header) continue;

          const dataStartRow = header.index;
          const dataEndRow = Math.min(decodedRange.e.r, dataStartRow + MAX_DATA_ROWS);
          const dataRange = { s: { r: dataStartRow, c: 0 }, e: { r: dataEndRow, c: maxCol } };

          const rawData = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            blankrows: false,
            range: dataRange,
          }) as unknown[][];

          if (!rawData.length || rawData.length < 2) continue;

          const headers = rawData[0].map((cell) => cleanCell(cell));
          const rows = rawData.slice(1);
          const columnMap = buildColumnMap(headers);
          const contextDate = detectContextDate(file.name, previewRows);
          const mappedRows = mapRows(module, headers, rows, columnMap, contextDate);

          if (mappedRows.length === 0) continue;

          const quality =
            mappedRows.length + header.score * 10 + sheetHintScore(module, sheetName) * 20;

          candidates.push({ sheetName, mappedRows, quality });
        }

        if (candidates.length === 0) {
          throw new Error('No usable rows found. Check sheet layout, headers, and row values.');
        }

        const best = [...candidates].sort((a, b) => b.quality - a.quality)[0];

        setState({ status: 'processing', fileName: `${file.name} - ${best.sheetName}` });

        const preprocess = await preprocessUploadRows({
          module,
          rows: best.mappedRows,
          fileName: file.name,
        });

        const normalizedRows =
          preprocess.normalizedRows.length > 0 ? preprocess.normalizedRows : best.mappedRows;

        const spec = buildDashboardSpec(module, normalizedRows);
        onSpecLoaded({
          spec,
          recordsSample: normalizedRows.slice(0, 20),
          analysisProfile: preprocess.profile,
        });

        setState({ status: 'done', fileName: `${file.name} - ${best.sheetName}` });
      } catch (error) {
        console.error('Upload parse error:', error);
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
        });
      }
    },
    [module, onSpecLoaded]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const reset = () => setState({ status: 'idle' });

  if (readOnly) {
    return (
      <div className="w-full max-w-2xl mx-auto border border-white/10 rounded-2xl p-8 bg-[#171a21] text-center">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={20} className="text-white/40" />
        </div>
        <h2 className="text-lg font-display font-semibold text-white mb-2">Public Mode is Read-Only</h2>
        <p className="text-sm text-white/40">Uploading or changing module data is disabled in public mode.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FF6A00]/10 border border-[#FF6A00]/20 mb-4">
          <FileText size={24} className="text-[#FF6A00]" />
        </div>
        <h2 className="text-xl font-display font-semibold text-white mb-2">No {moduleLabels[module]} Data</h2>
        <p className="text-sm text-white/40 max-w-sm mx-auto">
          Upload a CSV or XLSX file to generate your dashboard. Column names are auto-detected.
        </p>
      </div>

      {state.status === 'idle' || state.status === 'error' ? (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-[#FF6A00] bg-[#FF6A00]/8'
              : 'border-white/12 hover:border-[#FF6A00]/40 hover:bg-white/2'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <Upload size={28} className={`mx-auto mb-3 ${isDragging ? 'text-[#FF6A00]' : 'text-white/30'}`} />
          <p className="text-sm font-medium text-white/60 mb-1">
            Drop your file here or <span className="text-[#FF6A00]">browse</span>
          </p>
          <p className="text-xs text-white/25">CSV or XLSX - Max 10MB</p>

          {state.status === 'error' && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-red-400 text-xs w-max max-w-xs">
              <AlertCircle size={14} />
              <span>{state.error}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      ) : state.status === 'uploading' || state.status === 'processing' ? (
        <div className="border border-white/8 rounded-2xl p-8 text-center bg-[#171a21]">
          <Loader2 size={48} className="text-[#FF6A00] animate-spin mx-auto mb-4" strokeWidth={1} />
          <p className="text-sm font-medium text-white/70 mb-1">
            {state.status === 'uploading' ? 'Uploading file...' : 'Processing data...'}
          </p>
          <p className="text-xs text-white/30 font-mono truncate max-w-xs mx-auto">{state.fileName}</p>
        </div>
      ) : (
        <div className="border border-green-500/20 rounded-2xl p-8 text-center bg-green-500/5">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-green-400 mb-1">Dashboard ready</p>
          <p className="text-xs text-white/30 font-mono">{state.fileName}</p>
        </div>
      )}
    </div>
  );
}

