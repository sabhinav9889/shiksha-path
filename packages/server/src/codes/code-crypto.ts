/**
 * Keyed hashes of a code. The server stores only `lookup` and gives Supabase Auth only
 * `password`; with the pepper kept in the environment, neither turns back into the code.
 */
async function hmac(pepper: string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

const HEX = 16;
const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((b) => b.toString(HEX).padStart(2, '0')).join('');
const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export async function codeLookup(pepper: string, normalised: string): Promise<string> {
  return toHex(await hmac(pepper, `lookup:${normalised}`));
}

export async function codePassword(pepper: string, normalised: string): Promise<string> {
  return toBase64Url(await hmac(pepper, `password:${normalised}`));
}
