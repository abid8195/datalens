import { describe, expect, it } from 'vitest';
import { parseCsv, parseJson } from './parser';

describe('file parsers', () => {
  it('parses quoted CSV fields, commas, and missing values', () => {
    const result = parseCsv('name,note,age\nAda,"hello, world",31\nBob,,', 'people.csv', 30);
    expect(result.error).toBeUndefined();
    expect(result.dataset?.rows).toHaveLength(2);
    expect(result.dataset?.rows[0].values.note).toBe('hello, world');
    expect(result.dataset?.rows[1].values.age).toBe('');
  });

  it('reports malformed JSON without throwing', () => {
    expect(parseJson('{oops', 'broken.json', 5).error).toMatch(/could not be read/i);
  });

  it('accepts an object containing a tabular array', () => {
    const result = parseJson('{"records":[{"name":"Ada","age":31}]}', 'people.json', 20);
    expect(result.dataset?.columns).toEqual(['name', 'age']);
  });
});
