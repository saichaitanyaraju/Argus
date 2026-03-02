export function toIsoDate(rawValue: unknown): string {
  if (!rawValue) return '';

  const raw = String(rawValue).trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dayFirstMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    const [, d, m, y] = dayFirstMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

export function sortByIsoDate(
  rows: Record<string, unknown>[],
  field = 'date'
): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const left = toIsoDate(a[field]);
    const right = toIsoDate(b[field]);
    const leftTime = left ? new Date(left).getTime() : 0;
    const rightTime = right ? new Date(right).getTime() : 0;
    return leftTime - rightTime;
  });
}
