const BOM_CODE_POINT = 0xfeff;
const BOM = String.fromCodePoint(BOM_CODE_POINT);

/** Strip a UTF-8 BOM and convert CRLF/CR line endings to LF. */
export function normalizeSource(source: string): string {
  const text = source.startsWith(BOM) ? source.slice(BOM.length) : source;
  return text.replace(/\r\n?/g, '\n');
}

/** Deep Unicode NFC normalisation of every string (Devanagari typed or pasted in NFD form). */
export function nfc<T>(value: T): T {
  if (typeof value === 'string') return value.normalize('NFC') as T;
  if (Array.isArray(value)) return value.map((v: unknown) => nfc(v)) as T;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => [k.normalize('NFC'), nfc(v)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}
