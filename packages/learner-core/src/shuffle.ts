const HASH_PRIME = 16_777_619;
const HASH_START = 2_166_136_261;
const MULBERRY_STEP = 0x6d2b79f5;
const UINT32 = 4_294_967_296;

/** FNV-1a: a 32-bit state from a string. */
function hashSeed(seed: string): number {
  let hash = HASH_START;
  for (const char of seed) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), HASH_PRIME) >>> 0;
  }
  return hash;
}

/* eslint-disable no-magic-numbers -- mulberry32's published mixing constants */
/** mulberry32: a small seeded generator returning numbers in [0, 1). */
function generator(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + MULBERRY_STEP) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

/* eslint-enable no-magic-numbers -- end of the mulberry32 constants */

/**
 * A repeatable shuffle (same seed, same order) that never hands back the original order when at
 * least two words differ, so a word-order exercise is never already solved.
 */
export function shuffleWords(words: readonly string[], seed: string): string[] {
  const next = generator(seed);
  const out = [...words];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  const same = out.every((w, i) => w === words[i]);
  if (same && new Set(words).size > 1) out.push(out.shift() as string);
  return out;
}
