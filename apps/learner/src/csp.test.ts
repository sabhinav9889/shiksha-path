import { describe, expect, test } from 'vitest';
import { contentSecurityPolicy, cspPlugin } from './csp.js';

const directives = (policy: string): Record<string, string> =>
  Object.fromEntries(
    policy.split(';').map((part) => {
      const [name = '', ...values] = part.trim().split(/\s+/);
      return [name, values.join(' ')];
    }),
  );

describe('contentSecurityPolicy', () => {
  test('allows only our own scripts, and no inline script', () => {
    const policy = directives(contentSecurityPolicy('/content'));
    expect(policy['script-src']).toBe("'self'");
    expect(policy['default-src']).toBe("'self'");
    expect(policy['object-src']).toBe("'none'");
    expect(policy['base-uri']).toBe("'self'");
    expect(policy['form-action']).toBe("'none'");
    expect(policy['media-src']).toBe("'self' blob:");
    expect(policy['connect-src']).toBe("'self'");
  });

  test('lesson packs on another host may be fetched from that host only', () => {
    const policy = directives(contentSecurityPolicy('https://packs.example.org/v1'));
    expect(policy['connect-src']).toBe("'self' https://packs.example.org");
  });

  test.each(['javascript:alert(1)', '//evil.example', 'content', 'ftp://x.example'])(
    'refuses a content address like %s',
    (base) => {
      expect(() => contentSecurityPolicy(base)).toThrow();
    },
  );
});

describe('the sign-in and API host', () => {
  test('may be reached when it is configured', () => {
    const policy = directives(contentSecurityPolicy('/content', ['https://abc.supabase.co']));
    expect(policy['connect-src']).toBe("'self' https://abc.supabase.co");
  });
});

describe('playing a recording from storage', () => {
  test('the API host may serve audio, so a mentor can play a signed recording link', () => {
    const policy = directives(contentSecurityPolicy('/content', ['https://abc.supabase.co']));
    expect(policy['media-src']).toBe("'self' blob: https://abc.supabase.co");
  });

  test('a lesson-pack host is not given media access, and without an API host nothing extra is', () => {
    const packs = directives(contentSecurityPolicy('https://packs.example.org/v1'));
    expect(packs['media-src']).toBe("'self' blob:");
    const both = directives(
      contentSecurityPolicy('https://packs.example.org/v1', ['https://abc.supabase.co']),
    );
    expect(both['media-src']).toBe("'self' blob: https://abc.supabase.co");
  });

  test('nothing else is loosened: scripts, images, objects and forms stay as they were', () => {
    const policy = directives(contentSecurityPolicy('/content', ['https://abc.supabase.co']));
    expect(policy['script-src']).toBe("'self'");
    expect(policy['img-src']).toBe("'self' data: blob:");
    expect(policy['object-src']).toBe("'none'");
    expect(policy['default-src']).toBe("'self'");
  });
});

describe('cspPlugin', () => {
  test('puts the policy at the top of index.html, at build time only', () => {
    const plugin = cspPlugin('/content');
    expect(plugin.apply).toBe('build');
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform('<html><head><meta charset="utf-8" /></head><body></body></html>');
    expect(html).toContain('<meta http-equiv="Content-Security-Policy" content="default-src');
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('</head>'));
  });
});
