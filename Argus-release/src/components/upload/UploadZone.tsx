import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { Module, UploadState, DashboardSpec } from '../../types';
import { supabase } from '../../lib/supabase';
import { useProject } from '../../context/ProjectContext';

interface Props {
  module: Module;
  onSpecLoaded: (spec: DashboardSpec) => void;
}

const moduleLabels: Record<Module, string> = {
  manpower: 'Manpower',
  equipment: 'Equipment',
  progress: 'Work Progress',
  cost: 'Cost',
};

// Fuzzy column mapping for different naming conventions
const columnSynonyms: Record<string, string[]> = {
  // Manpower
  planned_count: ['planned', 'plan', 'target', 'budget', 'required', 'planned_headcount', 'planned headcount'],
  actual_count: ['actual', 'act', 'current', 'present', 'on_site', 'onsite', 'actual_headcount', 'actual headcount'],
  discipline: ['discipline', 'trade', 'category', 'dept', 'department', 'crew', 'team'],
  company: ['company', 'contractor', 'vendor', 'subcontractor', 'firm', 'org'],
  nationality: ['nationality', 'national', 'country', 'origin'],
  
  // Equipment
  equipment_type: ['type', 'equipment_type', 'equipment type', 'category', 'model'],
  equipment_id: ['id', 'equipment_id', 'equipment id', 'tag', 'tag_no', 'tag number', 'asset_id'],
  status: ['status', 'state', 'condition', 'availability'],
  idle_count: ['idle', 'standby', 'waiting', 'available'],
  breakdown_count: ['breakdown', 'broken', 'repair', 'maintenance', 'down'],
  utilisation_rate: ['utilisation', 'utilization', 'usage', 'efficiency', 'productivity'],
  
  // Progress
  activity_id: ['activity_id', 'activity id', 'task_id', 'task id', 'id', 'code'],
  activity_name: ['activity', 'activity_name', 'activity name', 'task', 'task_name', 'description', 'name'],
  wbs_code: ['wbs', 'wbs_code', 'wbs code', 'work_breakdown', 'breakdown'],
  planned_progress: ['planned_progress', 'planned progress', 'planned_pct', 'target_progress', 'baseline'],
  actual_progress: ['actual_progress', 'actual progress', 'actual_pct', 'current_progress', 'achieved'],
  weight: ['weight', 'weighted', 'priority', 'importance'],
  
  // Cost
  cost_code: ['cost_code', 'cost code', 'code', 'account', 'gl_code', 'wbs'],
  description: ['description', 'desc', 'item', 'name', 'narrative'],
  category: ['category', 'type', 'class', 'group', 'classification'],
  budget_amount: ['budget', 'planned', 'approved', 'authorized', 'baseline'],
  committed_amount: ['committed', 'commitment', 'po', 'order', 'contracted'],
  actual_amount: ['actual', 'spent', 'paid', 'invoiced', 'incurred'],
  forecast_amount: ['forecast', 'projected', 'estimate', 'prediction', 'eac'],
  currency: ['currency', 'curr', 'ccy'],
};

/**
 * Fuzzy column matching - finds the canonical column name for a given header
 */
function matchColumn(header: string): string | null {
  const normalizedHeader = header.toLowerCase().trim().replace(/[_\s-]+/g, '_');
  
  for (const [canonical, synonyms] of Object.entries(columnSynonyms)) {
    // Direct match
    if (normalizedHeader === canonical) return canonical;
    // Synonym match
    if (synonyms.some(s => normalizedHeader === s || normalizedHeader.includes(s))) {
      return canonical;
    }
  }
  
  return null;
}

/**
 * Build a column map from sheet headers
 */
function buildColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  
  headers.forEach(header => {
    const matched = matchColumn(header);
    if (matched) {
      map[header] = matched;
    }
  });
  
  return map;
}

export default function UploadZone({ module, onSpecLoaded }: Props) {
  const { projectId } = useProject();
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!projectId) {
      setState({ status: 'error', error: 'No project selected. Please select a project first.' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setState({ status: 'error', error: 'File exceeds 10MB limit.' });
      return;
    }

    const periodDate = new Date().toISOString().split('T')[0];
    setState({ status: 'uploading', fileName: file.name });

    try {
      // Upload to Supabase Storage
      const timestamp = Date.now();
      const filePath = `${projectId}/${module}/${periodDate}/${timestamp}_${file.name}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('project-files')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      // Create file_uploads record
      const { data: fileRecord, error: dbError } = await supabase
        .from('file_uploads')
        .insert({
          project_id: projectId,
          module,
          original_filename: file.name,
          storage_path: filePath,
          period_date: periodDate,
          parse_status: 'processing',
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      setState({ status: 'processing', fileName: file.name });

      // Parse and process the file
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetNames = workbook.SheetNames;
      const firstSheet = workbook.Sheets[sheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (rawData.length < 2) {
        throw new Error('File appears to be empty or missing headers');
      }

      const headers = rawData[0].map(h => String(h).trim());
      const columnMap = buildColumnMap(headers);
      const rows = rawData.slice(1);

      // Update file record with column map and sheet names
      await supabase
        .from('file_uploads')
        .update({
          column_map: columnMap,
          sheet_names: sheetNames,
          row_count: rows.length,
        })
        .eq('id', fileRecord.id);

      // Process rows based on module
      const processedCount = await processModuleRows(
        module,
        projectId,
        fileRecord.id,
        periodDate,
        headers,
        rows,
        columnMap
      );

      // Update file record status
      await supabase
        .from('file_uploads')
        .update({
          parse_status: 'completed',
        })
        .eq('id', fileRecord.id);

      // Compute KPIs
      await computeKpis(module, projectId, fileRecord.id, periodDate);

      // Generate dashboard spec
      const spec = await generateDashboardSpec(module, projectId, periodDate);

      setState({ status: 'done', fileName: file.name });
      onSpecLoaded(spec);
    } catch (err) {
      console.error('Upload error:', err);
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed. Please try again.',
      });
    }
  }, [module, onSpecLoaded, projectId]);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => setState({ status: 'idle' });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FF6A00]/10 border border-[#FF6A00]/20 mb-4">
          <FileText size={24} className="text-[#FF6A00]" />
        </div>
        <h2 className="text-xl font-display font-semibold text-white mb-2">
          No {moduleLabels[module]} Data
        </h2>
        <p className="text-sm text-white/40 max-w-sm mx-auto">
          Upload a CSV or XLSX file to generate your dashboard. We automatically detect column names.
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
          <Upload
            size={28}
            className={`mx-auto mb-3 ${isDragging ? 'text-[#FF6A00]' : 'text-white/30'}`}
          />
          <p className="text-sm font-medium text-white/60 mb-1">
            Drop your file here or <span className="text-[#FF6A00]">browse</span>
          </p>
          <p className="text-xs text-white/25">CSV or XLSX · Max 10MB</p>
          
          {state.status === 'error' && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-red-400 text-xs w-max max-w-xs">
              <AlertCircle size={14} />
              <span>{state.error}</span>
              <button onClick={(e) => { e.stopPropagation(); reset(); }}>
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      ) : state.status === 'uploading' || state.status === 'processing' ? (
        <div className="border border-white/8 rounded-2xl p-8 text-center bg-[#171a21]">
          <Loader2
            size={48}
            className="text-[#FF6A00] animate-spin mx-auto mb-4"
            strokeWidth={1}
          />
          <p className="text-sm font-medium text-white/70 mb-1">
            {state.status === 'uploading' ? 'Uploading file…' : 'Processing data…'}
          </p>
          <p className="text-xs text-white/30 font-mono truncate max-w-xs mx-auto">
            {state.fileName}
          </p>
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

/**
 * Process rows and insert into the appropriate module table
 */
async function processModuleRows(
  module: Module,
  projectId: string,
  uploadId: string,
  periodDate: string,
  headers: string[],
  rows: any[][],
  columnMap: Record<string, string>
): Promise<number> {
  const tableMap: Record<Module, string> = {
    manpower: 'manpower_records',
    equipment: 'equipment_records',
    progress: 'progress_records',
    cost: 'cost_records',
  };

  const tableName = tableMap[module];
  const records: any[] = [];

  for (const row of rows) {
    const record: any = {
      upload_id: uploadId,
      project_id: projectId,
      period_date: periodDate,
      raw_row: {},
    };

    // Map each column
    headers.forEach((header, idx) => {
      const value = row[idx];
      const mappedColumn = columnMap[header];
      
      if (mappedColumn) {
        record[mappedColumn] = value;
      }
      
      // Store raw row data
      record.raw_row[header] = value;
    });

    records.push(record);
  }

  // Batch insert records
  const { error } = await supabase.from(tableName).insert(records);
  
  if (error) {
    console.error('Error inserting records:', error);
    throw new Error(`Failed to insert records: ${error.message}`);
  }

  return records.length;
}

/**
 * Compute and store KPIs for the module
 */
async function computeKpis(
  module: Module,
  projectId: string,
  uploadId: string,
  periodDate: string
): Promise<void> {
  // TODO: Implement module-specific KPI computation
  // This is a scaffold - implement based on your specific KPI requirements

  const kpis: any[] = [];

  switch (module) {
    case 'manpower':
      // Compute manpower KPIs
      kpis.push(
        { kpi_key: 'total_planned', kpi_value: 0, kpi_unit: 'workers' },
        { kpi_key: 'total_actual', kpi_value: 0, kpi_unit: 'workers' },
        { kpi_key: 'variance_pct', kpi_value: 0, kpi_unit: '%' }
      );
      break;
    case 'equipment':
      kpis.push(
        { kpi_key: 'active_count', kpi_value: 0, kpi_unit: 'units' },
        { kpi_key: 'idle_count', kpi_value: 0, kpi_unit: 'units' },
        { kpi_key: 'breakdown_count', kpi_value: 0, kpi_unit: 'units' }
      );
      break;
    case 'progress':
      kpis.push(
        { kpi_key: 'planned_progress', kpi_value: 0, kpi_unit: '%' },
        { kpi_key: 'actual_progress', kpi_value: 0, kpi_unit: '%' },
        { kpi_key: 'slippage', kpi_value: 0, kpi_unit: '%' }
      );
      break;
    case 'cost':
      kpis.push(
        { kpi_key: 'budget', kpi_value: 0, kpi_unit: 'AED' },
        { kpi_key: 'spent', kpi_value: 0, kpi_unit: 'AED' },
        { kpi_key: 'variance', kpi_value: 0, kpi_unit: 'AED' }
      );
      break;
  }

  // Insert KPIs
  for (const kpi of kpis) {
    await supabase.from('kpi_snapshots').insert({
      project_id: projectId,
      module,
      period_date: periodDate,
      upload_id: uploadId,
      ...kpi,
    });
  }
}

/**
 * Generate dashboard spec from processed data
 */
async function generateDashboardSpec(
  module: Module,
  projectId: string,
  periodDate: string
): Promise<DashboardSpec> {
  // TODO: Implement spec generation based on actual data
  // For now, return demo spec as fallback
  const { getDemoSpec } = await import('../../lib/demoData');
  const demoSpec = getDemoSpec(module);
  
  if (demoSpec) {
    return {
      ...demoSpec,
      lastUpdated: new Date().toISOString(),
    };
  }

  return {
    kpis: [],
    visuals: [],
    insights: [],
    meta: {
      disciplines: [],
      dateMin: periodDate,
      dateMax: periodDate,
    },
    lastUpdated: new Date().toISOString(),
  };
}
