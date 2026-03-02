import type { Module } from '../types';

export interface UploadProfile extends Record<string, unknown> {
  rowCount: number;
  dateMin: string;
  dateMax: string;
  disciplineCount: number;
  disciplines: string[];
  numericTotals: Record<string, number>;
}

interface PreprocessResponse {
  ok: boolean;
  normalizedRows?: Record<string, unknown>[];
  profile?: UploadProfile;
  error?: string;
}

export async function preprocessUploadRows(args: {
  module: Module;
  rows: Record<string, unknown>[];
  fileName: string;
}): Promise<{ normalizedRows: Record<string, unknown>[]; profile?: UploadProfile }> {
  try {
    const response = await fetch('/api/preprocess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        module: args.module,
        fileName: args.fileName,
        rows: args.rows,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as PreprocessResponse;

    if (!response.ok || !payload.ok || !Array.isArray(payload.normalizedRows)) {
      throw new Error(payload.error || 'Python preprocess failed.');
    }

    return {
      normalizedRows: payload.normalizedRows,
      profile: payload.profile,
    };
  } catch (error) {
    console.warn('Falling back to client-side mapped rows.', error);
    return {
      normalizedRows: args.rows,
    };
  }
}
