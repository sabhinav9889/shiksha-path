/** Answer browsers only from the app's own origins (no wildcard: requests carry a token). */
export function corsHeaders(request: Request, allowedOrigins: readonly string[]): Headers {
  const headers = new Headers({ Vary: 'Origin' });
  const origin = request.headers.get('origin');
  // The value sent back is our own allow-list entry, never the request's header.
  const allowed = allowedOrigins.find((entry) => entry === origin);
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', allowed);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
  }
  return headers;
}
