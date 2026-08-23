const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const MAX_COMMENT_LENGTH = 0xffff;
const STORED = 0;
const DEFLATED = 8;

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const findEndOfCentralDirectory = (view: DataView): number | undefined => {
  const earliest = Math.max(0, view.byteLength - MAX_COMMENT_LENGTH - 22);
  for (let offset = view.byteLength - 22; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  return undefined;
};

/**
 * Reads the zip central directory. Returns undefined when the buffer is not a
 * zip archive, so callers can report a friendly error instead of throwing.
 */
export const readZipEntries = (buffer: ArrayBuffer): Map<string, ZipEntry> | undefined => {
  if (buffer.byteLength < 22) return undefined;
  const view = new DataView(buffer);
  const directoryEnd = findEndOfCentralDirectory(view);
  if (directoryEnd === undefined) return undefined;

  const entryCount = view.getUint16(directoryEnd + 10, true);
  let offset = view.getUint32(directoryEnd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > view.byteLength) return undefined;
    if (view.getUint32(offset, true) !== CENTRAL_FILE_HEADER) return undefined;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const inflateRaw = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const inflated = await new Response(stream).arrayBuffer();
  return new Uint8Array(inflated);
};

/**
 * Extracts one entry as UTF-8 text. Only the two methods Excel actually emits
 * are supported: stored and deflate. Returns undefined on anything else.
 */
export const readZipText = async (buffer: ArrayBuffer, entry: ZipEntry): Promise<string | undefined> => {
  const view = new DataView(buffer);
  if (entry.localHeaderOffset + 30 > view.byteLength) return undefined;
  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const start = entry.localHeaderOffset + 30 + nameLength + extraLength;
  if (start > view.byteLength) return undefined;

  const available = view.byteLength - start;
  const length = entry.compressedSize > 0 ? Math.min(entry.compressedSize, available) : available;
  const raw = new Uint8Array(buffer, start, length);

  if (entry.method === STORED) return new TextDecoder().decode(raw);
  if (entry.method !== DEFLATED) return undefined;
  try {
    return new TextDecoder().decode(await inflateRaw(raw));
  } catch {
    return undefined;
  }
};
