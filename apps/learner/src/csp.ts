import type { Plugin } from 'vite';

/** Where lesson packs come from must be our own path or a plain web address. */
function contentOrigin(contentBaseUrl: string): string | null {
  if (contentBaseUrl.startsWith('/') && !contentBaseUrl.startsWith('//')) return null;
  const url = new URL(contentBaseUrl); // throws for anything that is not an absolute address
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`lesson packs must come over http(s), not ${url.protocol}`);
  }
  return url.origin;
}

/**
 * A second guard behind build-time escaping of lesson HTML: only our own scripts run, nothing
 * inline, and the only other place the app may talk to is the lesson-pack host.
 */
export function contentSecurityPolicy(contentBaseUrl: string): string {
  const packs = contentOrigin(contentBaseUrl);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // Svelte sets style attributes
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${packs ? ` ${packs}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

/** Adds the policy to index.html when building (the dev server needs inline scripts). */
export function cspPlugin(contentBaseUrl: string): Plugin & { apply: 'build' } {
  const policy = contentSecurityPolicy(contentBaseUrl);
  return {
    name: 'shiksha-csp',
    apply: 'build',
    transformIndexHtml: (html: string) =>
      html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      ),
  };
}
