import type { z } from 'zod';

export interface ContentIssue {
  file: string;
  path?: string;
  message: string;
  severity: 'error' | 'warning';
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: ContentIssue[] };

export const error = (file: string, message: string, path?: string): ContentIssue =>
  path === undefined
    ? { file, message, severity: 'error' }
    : { file, path, message, severity: 'error' };

export const warning = (file: string, message: string): ContentIssue => ({
  file,
  message,
  severity: 'warning',
});

/** Map Zod issues to content issues with a dotted path (`title.en`, `items.0.options`). */
export function fromZod(file: string, issues: readonly z.core.$ZodIssue[]): ContentIssue[] {
  return issues.map((i) => error(file, i.message, i.path.map(String).join('.') || undefined));
}
