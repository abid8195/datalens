export type FileType = 'csv' | 'json';
export type ColumnType = 'text' | 'number' | 'boolean' | 'date' | 'category';
export type ViewName = 'overview' | 'dataset' | 'columns' | 'health';
export type SortDirection = 'asc' | 'desc';
export type FilterOperator = 'contains' | 'equals' | 'startsWith' | 'greaterThan' | 'lessThan' | 'between' | 'before' | 'after' | 'in';

export interface DataRow {
  id: number;
  values: Record<string, string>;
}

export interface Dataset {
  fileName: string;
  fileType: FileType;
  fileSize: number;
  importedAt: string;
  columns: string[];
  rows: DataRow[];
  warnings: string[];
}

export interface NumberStatistics {
  minimum: number;
  maximum: number;
  mean: number;
  median: number;
  standardDeviation: number;
  firstQuartile: number;
  thirdQuartile: number;
}

export interface ValueFrequency {
  value: string;
  count: number;
}

export interface ColumnProfile {
  name: string;
  index: number;
  type: ColumnType;
  totalValues: number;
  missingCount: number;
  uniqueCount: number;
  numberStatistics?: NumberStatistics;
  dateRange?: { earliest: string; latest: string };
  booleanCounts?: { trueCount: number; falseCount: number };
  frequentValues: ValueFrequency[];
  invalidValueCount: number;
  empty: boolean;
}

export interface HealthIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  affectedColumn?: string;
}

export interface DataHealth {
  score: number;
  duplicateCount: number;
  duplicatePercentage: number;
  completeValuePercentage: number;
  issues: HealthIssue[];
}

export interface DatasetProfile {
  columns: ColumnProfile[];
  health: DataHealth;
}

export interface DatasetFilter {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
  secondaryValue?: string;
}

export interface SortState {
  column: string;
  direction: SortDirection;
}

export interface TablePreferences {
  pageSize: number;
  visibleColumns: string[];
}

export interface ImportResult {
  dataset?: Dataset;
  error?: string;
}
