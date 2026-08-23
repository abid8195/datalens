import type { ColumnProfile, DataHealth, DataRow, Dataset, DatasetProfile, HealthIssue, ValueFrequency } from '../types';
import { inferColumnType, isMissing, toBoolean, toDateTimestamp, toNumber } from './inference';
import { calculateNumberStatistics } from './statistics';

const frequencies = (values: string[]): ValueFrequency[] => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
};

const stableRowKey = (row: DataRow, columns: string[]): string =>
  JSON.stringify(columns.map((column) => row.values[column] ?? ''));

export const countDuplicateRows = (rows: DataRow[], columns: string[]): number => {
  const seen = new Set<string>();
  let duplicates = 0;
  rows.forEach((row) => {
    const key = stableRowKey(row, columns);
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  });
  return duplicates;
};

export const profileColumn = (dataset: Dataset, name: string, index: number): ColumnProfile => {
  const values = dataset.rows.map((row) => row.values[name] ?? '');
  const present = values.filter((value) => !isMissing(value));
  const type = inferColumnType(values);
  const numberValues = present.map(toNumber).filter((value): value is number => value !== undefined);
  const dateValues = present.map(toDateTimestamp).filter((value): value is number => value !== undefined);
  const booleanValues = present.map(toBoolean).filter((value): value is boolean => value !== undefined);
  const invalidValueCount = type === 'number'
    ? present.length - numberValues.length
    : type === 'date'
      ? present.length - dateValues.length
      : type === 'boolean'
        ? present.length - booleanValues.length
        : 0;

  const profile: ColumnProfile = {
    name,
    index,
    type,
    totalValues: present.length,
    missingCount: values.length - present.length,
    uniqueCount: new Set(present).size,
    frequentValues: frequencies(present).slice(0, 6),
    invalidValueCount,
    empty: present.length === 0,
  };

  if (type === 'number') profile.numberStatistics = calculateNumberStatistics(numberValues);
  if (type === 'date' && dateValues.length > 0) {
    profile.dateRange = {
      earliest: new Date(Math.min(...dateValues)).toISOString().slice(0, 10),
      latest: new Date(Math.max(...dateValues)).toISOString().slice(0, 10),
    };
  }
  if (type === 'boolean') {
    profile.booleanCounts = {
      trueCount: booleanValues.filter(Boolean).length,
      falseCount: booleanValues.filter((value) => !value).length,
    };
  }
  return profile;
};

const findCategoryInconsistency = (dataset: Dataset, profile: ColumnProfile): boolean => {
  if (profile.type !== 'category' && profile.type !== 'text') return false;
  const variants = new Map<string, Set<string>>();
  dataset.rows.forEach((row) => {
    const raw = row.values[profile.name] ?? '';
    if (isMissing(raw)) return;
    const normalized = raw.trim().toLocaleLowerCase();
    const values = variants.get(normalized) ?? new Set<string>();
    values.add(raw);
    variants.set(normalized, values);
  });
  return [...variants.values()].some((values) => values.size > 1);
};

const buildHealth = (dataset: Dataset, columns: ColumnProfile[]): DataHealth => {
  const totalCells = dataset.rows.length * dataset.columns.length;
  const missing = columns.reduce((total, column) => total + column.missingCount, 0);
  const duplicateCount = countDuplicateRows(dataset.rows, dataset.columns);
  const issues: HealthIssue[] = [];

  columns.forEach((column) => {
    if (column.empty) {
      issues.push({ id: `empty-${column.name}`, severity: 'error', title: `${column.name} is empty`, description: 'This column contains no values.', affectedColumn: column.name });
    } else if (column.missingCount > 0) {
      const ratio = column.missingCount / dataset.rows.length;
      issues.push({
        id: `missing-${column.name}`,
        severity: ratio > 0.5 ? 'error' : 'warning',
        title: `${column.missingCount} missing ${column.name} values`,
        description: ratio > 0.5 ? 'More than half of this column is blank.' : 'Potential issue: missing values can affect analysis.',
        affectedColumn: column.name,
      });
    }
    if (column.invalidValueCount > 0) {
      issues.push({ id: `invalid-${column.name}`, severity: 'warning', title: `Mixed-looking ${column.name} values`, description: `${column.invalidValueCount} values do not match the inferred ${column.type} pattern.`, affectedColumn: column.name });
    }
    if (findCategoryInconsistency(dataset, column)) {
      issues.push({ id: `variants-${column.name}`, severity: 'warning', title: `${column.name} contains inconsistent labels`, description: 'Potential issue: values differ only by case or surrounding spaces.', affectedColumn: column.name });
    }
  });

  if (duplicateCount > 0) {
    issues.unshift({ id: 'duplicates', severity: 'warning', title: `${duplicateCount} duplicate row${duplicateCount === 1 ? '' : 's'}`, description: 'Duplicate rows are detected using all visible source values.' });
  }
  dataset.warnings.forEach((warning, index) => {
    issues.push({ id: `import-${index}`, severity: 'warning', title: 'Import warning', description: warning });
  });

  const missingPenalty = totalCells === 0 ? 0 : Math.min(35, (missing / totalCells) * 70);
  const duplicatePenalty = dataset.rows.length === 0 ? 0 : Math.min(25, (duplicateCount / dataset.rows.length) * 80);
  const structuralPenalty = columns.filter((column) => column.empty).length * 8;
  const invalidPenalty = columns.reduce((total, column) => total + column.invalidValueCount, 0) * 2;
  const score = Math.max(0, Math.round(100 - missingPenalty - duplicatePenalty - structuralPenalty - invalidPenalty - Math.min(15, dataset.warnings.length * 3)));

  return {
    score,
    duplicateCount,
    duplicatePercentage: dataset.rows.length === 0 ? 0 : (duplicateCount / dataset.rows.length) * 100,
    completeValuePercentage: totalCells === 0 ? 100 : ((totalCells - missing) / totalCells) * 100,
    issues,
  };
};

export const profileDataset = (dataset: Dataset): DatasetProfile => {
  const columns = dataset.columns.map((name, index) => profileColumn(dataset, name, index));
  return { columns, health: buildHealth(dataset, columns) };
};
