/** Answer browsers only from the app's own origins (no wildcard: requests carry a token). */
export function corsHeaders(request: Request, allowedOrigins: readonly string[]): Headers {
  const headers = new Headers({ Vary: 'Origin' });
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
  }
  return headers;
}
