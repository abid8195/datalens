import { describe, expect, it } from 'vitest';
import { parseXlsx } from './parser';
import { columnIndexFromRef, excelSerialToIso, isDateFormatCode, parseSharedStrings } from './xlsx';

const encoder = new TextEncoder();

/**
 * Builds a real zip archive using stored (uncompressed) entries, so the tests
 * exercise the actual central-directory reader rather than a stub. The reader
 * does not verify CRCs, so they are left zero.
 */
const buildZip = (files: Record<string, string>): ArrayBuffer => {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);

    const header = new Uint8Array(30 + nameBytes.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, 0x04034b50, true);
    headerView.setUint16(4, 20, true);
    headerView.setUint16(8, 0, true);
    headerView.setUint32(18, data.length, true);
    headerView.setUint32(22, data.length, true);
    headerView.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    local.push(header, data);

    const directory = new Uint8Array(46 + nameBytes.length);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint16(4, 20, true);
    directoryView.setUint16(6, 20, true);
    directoryView.setUint16(10, 0, true);
    directoryView.setUint32(20, data.length, true);
    directoryView.setUint32(24, data.length, true);
    directoryView.setUint16(28, nameBytes.length, true);
    directoryView.setUint32(42, offset, true);
    directory.set(nameBytes, 46);
    central.push(directory);

    offset += header.length + data.length;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, central.length, true);
  endView.setUint16(10, central.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const all = [...local, ...central, end];
  const output = new Uint8Array(all.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of all) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output.buffer;
};

const workbook = (sheets: string) => `<?xml version="1.0"?><workbook><sheets>${sheets}</sheets></workbook>`;
const SINGLE_SHEET = workbook('<sheet name="Staff" sheetId="1" r:id="rId1"/>');
const RELATIONSHIPS = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
// Style index 1 uses numFmtId 14, a built-in date format.
const STYLES = '<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
const SHARED = '<sst><si><t>name</t></si><si><t>joined</t></si><si><t>score</t></si><si><t>active</t></si><si><t>Ada</t></si><si><t>Bob &amp; Co</t></si></sst>';
const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" s="1"><v>45000</v></c><c r="C2"><v>91.5</v></c><c r="D2" t="b"><v>1</v></c></row>
<row r="3"><c r="A3" t="s"><v>5</v></c><c r="C3"><v>78</v></c><c r="D3" t="b"><v>0</v></c></row>
</sheetData></worksheet>`;

const sampleWorkbook = (workbookXml = SINGLE_SHEET): ArrayBuffer =>
  buildZip({
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': RELATIONSHIPS,
    'xl/styles.xml': STYLES,
    'xl/sharedStrings.xml': SHARED,
    'xl/worksheets/sheet1.xml': SHEET,
  });

describe('xlsx helpers', () => {
  it('converts column references to indexes', () => {
    expect(columnIndexFromRef('A1')).toBe(0);
    expect(columnIndexFromRef('Z9')).toBe(25);
    expect(columnIndexFromRef('AB12')).toBe(27);
  });

  it('converts Excel day serials to ISO dates', () => {
    expect(excelSerialToIso(25569)).toBe('1970-01-01');
    expect(excelSerialToIso(45000)).toBe('2023-03-15');
  });

  it('recognises date format codes but not currency or time-only ones', () => {
    expect(isDateFormatCode('yyyy-mm-dd')).toBe(true);
    expect(isDateFormatCode('[$-409]d/m/yyyy')).toBe(true);
    expect(isDateFormatCode('#,##0.00 "USD"')).toBe(false);
    expect(isDateFormatCode('General')).toBe(false);
  });

  it('concatenates rich-text runs and decodes entities in shared strings', () => {
    const parsed = parseSharedStrings('<sst><si><r><t>Hello </t></r><r><t>world</t></r></si><si><t>a &amp; b</t></si></sst>');
    expect(parsed).toEqual(['Hello world', 'a & b']);
  });
});

describe('parseXlsx', () => {
  it('reads headers, typed values, dates, and sparse cells', async () => {
    const result = await parseXlsx(sampleWorkbook(), 'staff.xlsx', 2048);
    expect(result.error).toBeUndefined();
    expect(result.dataset?.columns).toEqual(['name', 'joined', 'score', 'active']);
    expect(result.dataset?.rows).toHaveLength(2);

    const [first, second] = result.dataset?.rows ?? [];
    expect(first.values.name).toBe('Ada');
    expect(first.values.joined).toBe('2023-03-15');
    expect(first.values.score).toBe('91.5');
    expect(first.values.active).toBe('true');

    // Row 3 omits cell B3 entirely — the gap must land in the right column.
    expect(second.values.name).toBe('Bob & Co');
    expect(second.values.joined).toBe('');
    expect(second.values.score).toBe('78');
    expect(second.values.active).toBe('false');
  });

  it('treats omitted trailing cells as blanks, not ragged rows', async () => {
    // Excel drops trailing empty cells entirely; row 2 here stops after column B.
    const sparse = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" s="1"><v>45000</v></c></row>
</sheetData></worksheet>`;
    const result = await parseXlsx(
      buildZip({
        'xl/workbook.xml': SINGLE_SHEET,
        'xl/_rels/workbook.xml.rels': RELATIONSHIPS,
        'xl/styles.xml': STYLES,
        'xl/sharedStrings.xml': SHARED,
        'xl/worksheets/sheet1.xml': sparse,
      }),
      'sparse.xlsx',
      1024,
    );
    expect(result.dataset?.warnings).toEqual([]);
    expect(result.dataset?.rows[0].values.score).toBe('');
    expect(result.dataset?.rows[0].values.active).toBe('');
  });

  it('warns when a workbook has more than one sheet', async () => {
    const many = workbook('<sheet name="Staff" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/>');
    const result = await parseXlsx(sampleWorkbook(many), 'staff.xlsx', 2048);
    expect(result.dataset?.warnings[0]).toMatch(/2 sheets/i);
  });

  it('rejects a file that is not a zip archive without throwing', async () => {
    const notAZip = encoder.encode('this is plain text, not a workbook').buffer;
    const result = await parseXlsx(notAZip, 'fake.xlsx', 34);
    expect(result.dataset).toBeUndefined();
    expect(result.error).toMatch(/could not be opened/i);
  });
});
