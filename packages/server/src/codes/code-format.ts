/** No 0/O, 1/I/L: easy to read aloud and to copy from paper (spec §5.3, Plan 3b). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const GROUP = 4;
const BYTE_VALUES = 256;
/** Bytes at or above this would favour the first letters; they are drawn again. */
const FAIR_LIMIT = BYTE_VALUES - (BYTE_VALUES % CODE_ALPHABET.length);

/** A new code like `ABCD-EFGH`. `random(n)` gives n random bytes (crypto.getRandomValues). */
export function newCode(random: (n: number) => Uint8Array): string {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random(CODE_LENGTH - code.length)) {
      if (byte < FAIR_LIMIT && code.length < CODE_LENGTH) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      }
    }
  }
  return `${code.slice(0, GROUP)}-${code.slice(GROUP)}`;
}

/** What the learner typed, as the 8 code letters; null when it cannot be a code. */
export function normaliseCode(input: string): string | null {
  const letters = input.toUpperCase().replace(/[\s-]/g, '');
  if (letters.length !== CODE_LENGTH) return null;
  return [...letters].every((c) => CODE_ALPHABET.includes(c)) ? letters : null;
}

export const cryptoRandom = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
