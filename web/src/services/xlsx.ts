import { readZipEntries, readZipText } from './zip';

/**
 * A minimal .xlsx reader. An xlsx file is a zip of XML parts, so the whole
 * format is readable with the platform's own DecompressionStream — no
 * spreadsheet dependency is needed.
 *
 * Deliberate limitations, all of which degrade to plain text rather than
 * wrong data:
 *   - Only the first worksheet is read.
 *   - Formulas contribute their last cached value, not a recomputed one.
 *   - Time-only cells stay numeric; only formats containing a day or year
 *     token are converted to dates.
 */

const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22,
  27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  50, 51, 52, 53, 54, 55, 56, 57, 58,
]);

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export const decodeXmlEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const point = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    if (code.startsWith('#')) {
      const point = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });

const collectText = (fragment: string): string => {
  let text = '';
  const textRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;
  while ((match = textRe.exec(fragment)) !== null) text += match[1];
  return decodeXmlEntities(text);
};

export const parseSharedStrings = (xml: string): string[] => {
  const strings: string[] = [];
  const itemRe = /<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) strings.push(collectText(match[1] ?? ''));
  return strings;
};

export const isDateFormatCode = (code: string): boolean => {
  const cleaned = code
    .replace(/\[[^\]]*\]/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '');
  return /[dy]/i.test(cleaned);
};

/** Maps cell-style indexes to "this style renders as a date". */
export const parseDateStyles = (xml: string): Set<number> => {
  const dateFormatIds = new Set(BUILTIN_DATE_FORMATS);
  const formatRe = /<numFmt\b[^>]*?numFmtId="(\d+)"[^>]*?formatCode="([^"]*)"[^>]*?\/>/g;
  let format: RegExpExecArray | null;
  while ((format = formatRe.exec(xml)) !== null) {
    if (isDateFormatCode(decodeXmlEntities(format[2]))) dateFormatIds.add(Number(format[1]));
  }

  const styles = new Set<number>();
  const cellFormats = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!cellFormats) return styles;

  const entryRe = /<xf\b[^>]*?(?:\/>|>)/g;
  let index = 0;
  let entry: RegExpExecArray | null;
  while ((entry = entryRe.exec(cellFormats[1])) !== null) {
    const id = /numFmtId="(\d+)"/.exec(entry[0]);
    if (id && dateFormatIds.has(Number(id[1]))) styles.add(index);
    index += 1;
  }
  return styles;
};

/** "A1" -> 0, "AB12" -> 27. Returns -1 when the reference has no column letters. */
export const columnIndexFromRef = (reference: string): number => {
  let index = 0;
  for (const character of reference) {
    const code = character.toUpperCase().charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
};

/** Excel day serial to ISO date. Serial 25569 is 1970-01-01. */
export const excelSerialToIso = (serial: number): string => {
  const date = new Date(Math.round((serial - 25569) * 86400000));
  return Number.isNaN(date.getTime()) ? String(serial) : date.toISOString().slice(0, 10);
};

const readCellValue = (attributes: string, body: string, sharedStrings: string[], dateStyles: Set<number>): string => {
  const type = /t="([^"]*)"/.exec(attributes)?.[1] ?? 'n';
  if (type === 'inlineStr') return collectText(body);

  const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
  if (rawValue === undefined) return '';
  const value = decodeXmlEntities(rawValue);

  if (type === 's') return sharedStrings[Number(value)] ?? '';
  if (type === 'b') return value === '1' ? 'true' : 'false';
  if (type === 'e') return '';
  if (type === 'str') return value;

  const styleIndex = Number(/s="(\d+)"/.exec(attributes)?.[1]);
  const numeric = Number(value);
  if (Number.isFinite(numeric) && Number.isInteger(styleIndex) && dateStyles.has(styleIndex)) {
    return excelSerialToIso(numeric);
  }
  return value;
};

export const parseSheetRecords = (xml: string, sharedStrings: string[], dateStyles: Set<number>): string[][] => {
  const records: string[][] = [];
  const rowRe = /<row\b[^>]*\/>|<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let row: RegExpExecArray | null;

  while ((row = rowRe.exec(xml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(row[1] ?? '')) !== null) {
      const reference = /r="([A-Z]+)\d+"/i.exec(cell[1]);
      const target = reference ? columnIndexFromRef(reference[1]) : cells.length;
      const value = readCellValue(cell[1], cell[2] ?? '', sharedStrings, dateStyles);
      if (target < 0) continue;
      while (cells.length < target) cells.push('');
      cells[target] = value;
    }
    records.push(cells);
  }
  return records;
};

const resolveFirstSheetPath = (workbook: string, relationships: string, names: string[]): string | undefined => {
  const sheet = /<sheet\b[^>]*\/>/.exec(workbook)?.[0];
  const relationshipId = sheet ? /r:id="([^"]+)"/.exec(sheet)?.[1] : undefined;
  if (relationshipId) {
    const escaped = relationshipId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const relationship = new RegExp(`<Relationship\\b[^>]*Id="${escaped}"[^>]*>`).exec(relationships)?.[0];
    const target = relationship ? /Target="([^"]+)"/.exec(relationship)?.[1] : undefined;
    if (target) {
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      if (names.includes(path)) return path;
    }
  }
  return names.filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name)).sort()[0];
};

export interface XlsxReadResult {
  records?: string[][];
  sheetName?: string;
  sheetCount?: number;
  error?: string;
}

export const readXlsxRecords = async (buffer: ArrayBuffer): Promise<XlsxReadResult> => {
  const entries = readZipEntries(buffer);
  if (!entries) return { error: 'This Excel file could not be opened. It may be corrupt or password protected.' };

  const workbookEntry = entries.get('xl/workbook.xml');
  if (!workbookEntry) return { error: 'This file is a zip archive but not an Excel workbook.' };

  const workbook = await readZipText(buffer, workbookEntry);
  if (workbook === undefined) return { error: 'This Excel file uses an unsupported compression method.' };

  const relationshipsEntry = entries.get('xl/_rels/workbook.xml.rels');
  const relationships = relationshipsEntry ? (await readZipText(buffer, relationshipsEntry)) ?? '' : '';
  const sheetPath = resolveFirstSheetPath(workbook, relationships, [...entries.keys()]);
  const sheetEntry = sheetPath ? entries.get(sheetPath) : undefined;
  if (!sheetEntry) return { error: 'This workbook has no readable worksheet.' };

  const sheetXml = await readZipText(buffer, sheetEntry);
  if (sheetXml === undefined) return { error: 'The first worksheet in this file could not be read.' };

  const sharedEntry = entries.get('xl/sharedStrings.xml');
  const sharedStrings = sharedEntry ? parseSharedStrings((await readZipText(buffer, sharedEntry)) ?? '') : [];
  const stylesEntry = entries.get('xl/styles.xml');
  const dateStyles = stylesEntry ? parseDateStyles((await readZipText(buffer, stylesEntry)) ?? '') : new Set<number>();

  const sheetName = /<sheet\b[^>]*name="([^"]*)"/.exec(workbook)?.[1];
  return {
    records: parseSheetRecords(sheetXml, sharedStrings, dateStyles),
    sheetName: sheetName ? decodeXmlEntities(sheetName) : undefined,
    sheetCount: (workbook.match(/<sheet\b[^>]*\/>/g) ?? []).length,
  };
};
