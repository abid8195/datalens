import type { ColumnProfile, DataRow, DatasetFilter, SortState } from '../types';
import { toDateTimestamp, toNumber } from './inference';

const textMatch = (value: string, filter: DatasetFilter): boolean => {
  const source = value.toLocaleLowerCase();
  const target = filter.value.toLocaleLowerCase();
  if (filter.operator === 'contains') return source.includes(target);
  if (filter.operator === 'startsWith') return source.startsWith(target);
  if (filter.operator === 'equals') return source === target;
  if (filter.operator === 'in') return filter.value.split(',').map((item) => item.trim().toLocaleLowerCase()).includes(source);
  return true;
};

const compareNumeric = (value: number | undefined, filter: DatasetFilter): boolean => {
  if (value === undefined) return false;
  const first = toNumber(filter.value);
  const second = toNumber(filter.secondaryValue ?? '');
  if (first === undefined) return true;
  if (filter.operator === 'equals') return value === first;
  if (filter.operator === 'greaterThan') return value > first;
  if (filter.operator === 'lessThan') return value < first;
  if (filter.operator === 'between') return second === undefined ? true : value >= Math.min(first, second) && value <= Math.max(first, second);
  return true;
};

const compareDate = (value: number | undefined, filter: DatasetFilter): boolean => {
  if (value === undefined) return false;
  const first = toDateTimestamp(filter.value);
  const second = toDateTimestamp(filter.secondaryValue ?? '');
  if (first === undefined) return true;
  if (filter.operator === 'before') return value < first;
  if (filter.operator === 'after') return value > first;
  if (filter.operator === 'between') return second === undefined ? true : value >= Math.min(first, second) && value <= Math.max(first, second);
  if (filter.operator === 'equals') return value === first;
  return true;
};

export const rowMatchesFilters = (row: DataRow, filters: DatasetFilter[], profiles: ColumnProfile[]): boolean =>
  filters.every((filter) => {
    const value = row.values[filter.column] ?? '';
    const type = profiles.find((profile) => profile.name === filter.column)?.type;
    if (type === 'number') return compareNumeric(toNumber(value), filter);
    if (type === 'date') return compareDate(toDateTimestamp(value), filter);
    return textMatch(value, filter);
  });

export const searchRows = (rows: DataRow[], search: string): DataRow[] => {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return rows;
  return rows.filter((row) => Object.values(row.values).some((value) => value.toLocaleLowerCase().includes(query)));
};

const comparableValue = (value: string, type: ColumnProfile['type']): string | number => {
  if (type === 'number') return toNumber(value) ?? Number.NEGATIVE_INFINITY;
  if (type === 'date') return toDateTimestamp(value) ?? Number.NEGATIVE_INFINITY;
  if (type === 'boolean') return value.toLocaleLowerCase();
  return value.toLocaleLowerCase();
};

export const sortRows = (rows: DataRow[], sort: SortState | undefined, profiles: ColumnProfile[]): DataRow[] => {
  if (!sort) return rows;
  const type = profiles.find((profile) => profile.name === sort.column)?.type ?? 'text';
  const direction = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftRaw = left.row.values[sort.column] ?? '';
      const rightRaw = right.row.values[sort.column] ?? '';
      const leftMissing = leftRaw.trim() === '';
      const rightMissing = rightRaw.trim() === '';
      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
      const first = comparableValue(leftRaw, type);
      const second = comparableValue(rightRaw, type);
      const comparison = typeof first === 'number' && typeof second === 'number'
        ? first - second
        : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' });
      return comparison === 0 ? left.index - right.index : comparison * direction;
    })
    .map(({ row }) => row);
};
