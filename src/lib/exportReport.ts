import type { DashboardSpec, Module } from '../types';

interface ExportModuleCsvArgs {
  module: Module;
  spec: DashboardSpec;
  projectName?: string;
  disciplines: string[];
  dateFrom: string;
  dateTo: string;
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowToCsv(values: unknown[]): string {
  return values.map(escapeCsv).join(',');
}

export function exportModuleCsv({
  module,
  spec,
  projectName,
  disciplines,
  dateFrom,
  dateTo,
}: ExportModuleCsvArgs): string {
  const lines: string[] = [];
  const generatedAt = new Date().toISOString();

  lines.push(rowToCsv(['ARGUS MODULE REPORT']));
  lines.push(rowToCsv(['Module', module]));
  lines.push(rowToCsv(['Project', projectName || 'Demo Project']));
  lines.push(rowToCsv(['Generated At', generatedAt]));
  lines.push(rowToCsv(['Disciplines', disciplines.length > 0 ? disciplines.join(' | ') : 'All']));
  lines.push(rowToCsv(['Date From', dateFrom || 'N/A']));
  lines.push(rowToCsv(['Date To', dateTo || 'N/A']));
  lines.push('');

  lines.push(rowToCsv(['KPIs']));
  lines.push(rowToCsv(['Label', 'Value', 'Delta', 'Status', 'SubLabel']));
  spec.kpis.forEach((kpi) => {
    lines.push(rowToCsv([kpi.label, kpi.value, kpi.delta || '', kpi.status || '', kpi.subLabel || '']));
  });
  lines.push('');

  lines.push(rowToCsv(['Insights']));
  spec.insights.forEach((insight) => {
    lines.push(rowToCsv([insight]));
  });
  lines.push('');

  spec.visuals.forEach((visual) => {
    lines.push(rowToCsv([visual.title]));
    if (!visual.data || visual.data.length === 0) {
      lines.push(rowToCsv(['No data available']));
      lines.push('');
      return;
    }

    const headers =
      visual.columns?.map((column) => column.key) ||
      Object.keys(visual.data[0] || {});

    lines.push(rowToCsv(headers));
    visual.data.forEach((row) => {
      lines.push(rowToCsv(headers.map((key) => row[key])));
    });
    lines.push('');
  });

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const fileName = `argus-${module}-report-${generatedAt.replace(/[:.]/g, '-')}.csv`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return fileName;
}
