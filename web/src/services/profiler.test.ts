import { describe, expect, it } from 'vitest';
import type { Dataset } from '../types';
import { profileDataset } from './profiler';

const sample: Dataset = {
  fileName: 'sample.csv', fileType: 'csv', fileSize: 1, importedAt: '2026-01-01T00:00:00.000Z', columns: ['age', 'country'], warnings: [],
  rows: [
    { id: 0, values: { age: '20', country: 'Australia' } },
    { id: 1, values: { age: '40', country: 'Australia' } },
    { id: 2, values: { age: '', country: 'New Zealand' } },
    { id: 3, values: { age: '20', country: 'Australia' } },
  ],
};

describe('dataset profiling', () => {
  it('infers types, statistics, missingness, and duplicate rows', () => {
    const profile = profileDataset(sample);
    const age = profile.columns[0];
    expect(age.type).toBe('number');
    expect(age.missingCount).toBe(1);
    expect(age.numberStatistics?.mean).toBeCloseTo(80 / 3);
    expect(profile.health.duplicateCount).toBe(1);
  });
});
