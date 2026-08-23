import type { DataRow } from '../types';

export const escapeCsvValue = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const rowsToCsv = (columns: string[], rows: DataRow[]): string => {
  const header = columns.map(escapeCsvValue).join(',');
  const values = rows.map((row) => columns.map((column) => escapeCsvValue(row.values[column] ?? '')).join(','));
  return [header, ...values].join('\r\n');
};

export const downloadCsv = (columns: string[], rows: DataRow[], fileName: string): void => {
  const blob = new Blob([`\uFEFF${rowsToCsv(columns, rows)}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName.replace(/\.(csv|json)$/i, '') + '-filtered.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
