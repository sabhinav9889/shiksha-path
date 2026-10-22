const KEY_HEX_CHARS = 16;
const HEX = 16;

/**
 * A short keyed hash of the caller's network address, for rate-limit buckets only. The address
 * itself is never stored or logged (privacy rule); the pepper keeps the hash from being reversed.
 * The rightmost `x-forwarded-for` entry is the one the platform's proxy added; anything to its
 * left came from the client and could be forged to dodge the limit.
 */
export async function clientKey(request: Request, pepper: string): Promise<string> {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',').at(-1)?.trim() || 'unknown';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`ip:${ip}`)));
  return [...mac]
    .map((byte) => byte.toString(HEX).padStart(2, '0'))
    .join('')
    .slice(0, KEY_HEX_CHARS);
}
