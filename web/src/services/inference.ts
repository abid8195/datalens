import type { ColumnType } from '../types';

const NUMBER_PATTERN = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?$/i;
const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 'y', 'n', '0', '1']);
const DATE_PATTERN = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s].*)?$/;

export const isMissing = (value: string): boolean => value.trim() === '';

export const toNumber = (value: string): number | undefined => {
  const normalized = value.trim().replace(/,/g, '');
  if (!NUMBER_PATTERN.test(normalized)) return undefined;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : undefined;
};

export const toBoolean = (value: string): boolean | undefined => {
  const normalized = value.trim().toLowerCase();
  if (!BOOLEAN_VALUES.has(normalized)) return undefined;
  return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1';
};

export const toDateTimestamp = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!DATE_PATTERN.test(normalized)) return undefined;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? undefined : timestamp;
};

export const inferColumnType = (values: string[]): ColumnType => {
  const present = values.filter((value) => !isMissing(value));
  if (present.length === 0) return 'text';
  const numberCount = present.filter((value) => toNumber(value) !== undefined).length;
  const booleanCount = present.filter((value) => toBoolean(value) !== undefined).length;
  const dateCount = present.filter((value) => toDateTimestamp(value) !== undefined).length;
  const threshold = Math.max(1, Math.ceil(present.length * 0.9));

  if (booleanCount >= threshold && booleanCount === present.length) return 'boolean';
  if (numberCount >= threshold) return 'number';
  if (dateCount >= threshold) return 'date';

  const uniqueCount = new Set(present.map((value) => value.trim().toLocaleLowerCase())).size;
  if (uniqueCount <= Math.min(50, Math.max(12, Math.ceil(present.length * 0.25)))) return 'category';
  return 'text';
};

export const displayType = (type: ColumnType): string => type.charAt(0).toUpperCase() + type.slice(1);
