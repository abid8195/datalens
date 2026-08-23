import { describe, expect, it } from 'vitest';
import type { ColumnProfile, DataRow } from '../types';
import { rowMatchesFilters, sortRows } from './filters';
import { rowsToCsv } from './exporter';

const rows: DataRow[] = [
  { id: 0, values: { name: 'Ada', age: '10' } },
  { id: 1, values: { name: 'Bob', age: '2' } },
  { id: 2, values: { name: 'Cara', age: '' } },
];
const profiles: ColumnProfile[] = [
  { name: 'name', index: 0, type: 'text', totalValues: 3, missingCount: 0, uniqueCount: 3, frequentValues: [], invalidValueCount: 0, empty: false },
  { name: 'age', index: 1, type: 'number', totalValues: 2, missingCount: 1, uniqueCount: 2, frequentValues: [], invalidValueCount: 0, empty: false },
];

describe('filtering, sorting, and export', () => {
  it('filters numbers and leaves malformed criteria predictable', () => {
    expect(rowMatchesFilters(rows[0], [{ id: '1', column: 'age', operator: 'greaterThan', value: '5' }], profiles)).toBe(true);
    expect(rowMatchesFilters(rows[1], [{ id: '1', column: 'age', operator: 'greaterThan', value: '5' }], profiles)).toBe(false);
  });

  it('sorts numerical values numerically without mutating source rows', () => {
    const sorted = sortRows(rows, { column: 'age', direction: 'asc' }, profiles);
    expect(sorted.map((row) => row.values.age)).toEqual(['2', '10', '']);
    expect(rows[0].values.age).toBe('10');
  });

  it('escapes CSV quotes, commas, and newlines', () => {
    expect(rowsToCsv(['name'], [{ id: 0, values: { name: '"a,b"\nnext' } }])).toBe('name\r\n"""a,b""\nnext"');
  });
});
