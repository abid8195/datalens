import type { TablePreferences } from '../types';

const STORAGE_KEY = 'datalens.table-preferences.v1';
const defaultPreferences: TablePreferences = { pageSize: 25, visibleColumns: [] };

export const readTablePreferences = (): TablePreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return defaultPreferences;
    const candidate = parsed as Record<string, unknown>;
    const pageSize = typeof candidate.pageSize === 'number' && [10, 25, 50].includes(candidate.pageSize) ? candidate.pageSize : defaultPreferences.pageSize;
    const visibleColumns = Array.isArray(candidate.visibleColumns) && candidate.visibleColumns.every((value) => typeof value === 'string')
      ? candidate.visibleColumns as string[]
      : defaultPreferences.visibleColumns;
    return { pageSize, visibleColumns };
  } catch {
    return defaultPreferences;
  }
};

export const saveTablePreferences = (preferences: TablePreferences): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage may be unavailable in private browsing. The app remains fully usable.
  }
};
