import type { DataRow, FileType, ImportResult } from '../types';
import { readXlsxRecords } from './xlsx';

const EMPTY_VALUE = '';

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return JSON.stringify(value);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const uniqueColumnNames = (names: string[]): string[] => {
  const used = new Map<string, number>();
  return names.map((rawName, index) => {
    const base = rawName.trim() || `Column ${index + 1}`;
    const occurrence = used.get(base) ?? 0;
    used.set(base, occurrence + 1);
    return occurrence === 0 ? base : `${base} (${occurrence + 1})`;
  });
};

interface RecordDatasetOptions {
  fileName: string;
  fileType: FileType;
  fileSize: number;
  emptyMessage: string;
  noColumnsMessage: string;
  warnings?: string[];
}

/**
 * Turns a header-plus-rows grid into a Dataset. Shared by the CSV and Excel
 * paths so both handle ragged rows, duplicate headers, and blanks identically.
 */
const datasetFromRecords = (records: string[][], options: RecordDatasetOptions): ImportResult => {
  if (records.length < 2) return { error: options.emptyMessage };

  const columns = uniqueColumnNames(records[0]);
  if (columns.length === 0) return { error: options.noColumnsMessage };

  const warnings: string[] = [...(options.warnings ?? [])];
  const rows: DataRow[] = records.slice(1).map((record, rowIndex) => {
    if (record.length !== columns.length) {
      warnings.push(`Row ${rowIndex + 2} has ${record.length} values; the header has ${columns.length}. Missing values were left blank and extra values ignored.`);
    }
    const values: Record<string, string> = {};
    columns.forEach((column, columnIndex) => {
      values[column] = record[columnIndex] ?? EMPTY_VALUE;
    });
    return { id: rowIndex, values };
  });

  return {
    dataset: {
      fileName: options.fileName,
      fileType: options.fileType,
      fileSize: options.fileSize,
      importedAt: new Date().toISOString(),
      columns,
      rows,
      warnings: [...new Set(warnings)].slice(0, 5),
    },
  };
};

export interface CsvParseResult {
  records: string[][];
  unterminatedQuote: boolean;
}

export const parseCsvRecords = (input: string): CsvParseResult => {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) records.push(row);
  return { records, unterminatedQuote: quoted };
};

export const parseCsv = (input: string, fileName: string, fileSize: number): ImportResult => {
  const parsed = parseCsvRecords(input.replace(/^\ufeff/, ''));
  const warnings = parsed.unterminatedQuote
    ? ['A quoted field appears to be unterminated. Data was read as safely as possible.']
    : [];

  return datasetFromRecords(parsed.records, {
    fileName,
    fileType: 'csv',
    fileSize,
    emptyMessage: 'This CSV needs a header row and at least one data row.',
    noColumnsMessage: 'This CSV does not contain usable columns.',
    warnings,
  });
};

/**
 * Normalises a sheet grid: drops fully blank rows, trims trailing blank header
 * cells, and pads short rows out to the header width. Excel omits trailing
 * empty cells entirely, which is ordinary blankness rather than a ragged row,
 * so padding here keeps those cells from being reported as import warnings.
 */
const trimSheetGrid = (records: string[][]): string[][] => {
  const populated = records.filter((record) => record.some((value) => value.trim() !== ''));
  if (populated.length === 0) return populated;

  const header = [...populated[0]];
  while (header.length > 0 && header[header.length - 1].trim() === '') header.pop();

  const body = populated.slice(1).map((record) => {
    if (record.length >= header.length) return record;
    return [...record, ...Array<string>(header.length - record.length).fill(EMPTY_VALUE)];
  });
  return [header, ...body];
};

export const parseXlsx = async (buffer: ArrayBuffer, fileName: string, fileSize: number): Promise<ImportResult> => {
  const sheet = await readXlsxRecords(buffer);
  if (!sheet.records) return { error: sheet.error ?? 'This Excel file could not be read.' };

  const warnings = sheet.sheetCount !== undefined && sheet.sheetCount > 1
    ? [`This workbook has ${sheet.sheetCount} sheets. Only the first${sheet.sheetName ? ` ("${sheet.sheetName}")` : ''} was imported.`]
    : [];

  return datasetFromRecords(trimSheetGrid(sheet.records), {
    fileName,
    fileType: 'xlsx',
    fileSize,
    emptyMessage: 'This sheet needs a header row and at least one data row.',
    noColumnsMessage: 'This worksheet does not contain usable columns.',
    warnings,
  });
};

const findTabularRecords = (value: unknown): Record<string, unknown>[] | undefined => {
  if (Array.isArray(value) && value.every(isPlainRecord)) return value;
  if (!isPlainRecord(value)) return undefined;
  for (const candidate of Object.values(value)) {
    if (Array.isArray(candidate) && candidate.every(isPlainRecord)) return candidate;
  }
  return undefined;
};

export const parseJson = (input: string, fileName: string, fileSize: number): ImportResult => {
  let decoded: unknown;
  try {
    decoded = JSON.parse(input) as unknown;
  } catch {
    return { error: 'This JSON file could not be read. Check that it is valid JSON and try again.' };
  }

  const records = findTabularRecords(decoded);
  if (!records || records.length === 0) {
    return { error: 'DataLens expects JSON to be an array of objects, or an object containing an array of objects.' };
  }

  const columns = uniqueColumnNames([...new Set(records.flatMap((record) => Object.keys(record)))]);
  if (columns.length === 0) return { error: 'This JSON dataset has no usable columns.' };

  const rows: DataRow[] = records.map((record, rowIndex) => {
    const values: Record<string, string> = {};
    columns.forEach((column) => {
      values[column] = asText(record[column]);
    });
    return { id: rowIndex, values };
  });

  return {
    dataset: {
      fileName,
      fileType: 'json',
      fileSize,
      importedAt: new Date().toISOString(),
      columns,
      rows,
      warnings: [],
    },
  };
};

export const parseImportedFile = async (file: File): Promise<ImportResult> => {
  const suffix = file.name.split('.').pop()?.toLowerCase();
  if (suffix === 'xls') {
    return { error: 'DataLens reads .xlsx workbooks. Open this older .xls file in Excel and re-save it as .xlsx.' };
  }

  const fileType: FileType | undefined =
    suffix === 'csv' || suffix === 'json' || suffix === 'xlsx' ? suffix : undefined;
  if (!fileType) return { error: 'DataLens supports CSV, JSON, and Excel (.xlsx) files only.' };
  if (file.size === 0) return { error: 'This file is empty. Choose a CSV, JSON, or Excel file with data.' };

  if (fileType === 'xlsx') {
    try {
      return await parseXlsx(await file.arrayBuffer(), file.name, file.size);
    } catch {
      return { error: 'This file could not be read from your device.' };
    }
  }

  let content: string;
  try {
    content = await file.text();
  } catch {
    return { error: 'This file could not be read from your device.' };
  }
  return fileType === 'csv'
    ? parseCsv(content, file.name, file.size)
    : parseJson(content, file.name, file.size);
};
