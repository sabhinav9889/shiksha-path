import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

async function ruleIds(code: string, filePath: string): Promise<Set<string>> {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: true });
  return new Set((result?.messages ?? []).map((m) => m.ruleId ?? 'fatal'));
}

const fn = (bodyLines: number): string =>
  `export function f(): number {\n${'  const a = 1;\n'.repeat(bodyLines)}  return 1;\n}\n`;

const lines = (count: number): string =>
  Array.from({ length: count }, (_, i) => `export const v${i} = ${i};`).join('\n') + '\n';

describe('size limits', () => {
  test('flags a 101-character line', async () => {
    const code = `export const s = 1; // ${'x'.repeat(78)}\n`;
    expect(code.split('\n')[0]?.length).toBe(101);
    expect(await ruleIds(code, 'src/a.ts')).toContain('max-len');
  });

  test('allows a long URL in a comment', async () => {
    const code = `// https://example.com/${'a'.repeat(120)}\nexport const s = 1;\n`;
    expect(await ruleIds(code, 'src/a.ts')).not.toContain('max-len');
  });

  test('flags a 301-line source file', async () => {
    expect(await ruleIds(lines(301), 'src/a.ts')).toContain('max-lines');
  });

  test('allows a 400-line test file', async () => {
    expect(await ruleIds(lines(400), 'src/a.test.ts')).not.toContain('max-lines');
  });

  test('flags a 51-line function', async () => {
    expect(await ruleIds(fn(50), 'src/a.ts')).toContain('max-lines-per-function');
  });

  test('flags complexity 11', async () => {
    const ifs = Array.from({ length: 10 }, (_, i) => `  if (x === ${i}) return ${i};`).join('\n');
    const code = `export function f(x: number): number {\n${ifs}\n  return -1;\n}\n`;
    expect(await ruleIds(code, 'src/a.ts')).toContain('complexity');
  });

  test('flags nesting depth 4', async () => {
    const code = [
      'export function f(x: number): number {',
      '  if (x) { if (x) { if (x) { if (x) { return 1; } } } }',
      '  return 0;',
      '}',
      '',
    ].join('\n');
    expect(await ruleIds(code, 'src/a.ts')).toContain('max-depth');
  });

  test('flags 5 parameters', async () => {
    const code =
      'export function f(a: number, b: number, c: number, d: number, e: number): number {\n' +
      '  return a + b + c + d + e;\n}\n';
    expect(await ruleIds(code, 'src/a.ts')).toContain('max-params');
  });
});

describe('code rules', () => {
  test('flags any', async () => {
    const code = 'export function f(x: any): number {\n  return Number(x);\n}\n';
    expect(await ruleIds(code, 'src/a.ts')).toContain('@typescript-eslint/no-explicit-any');
  });

  test('flags console.log', async () => {
    expect(await ruleIds('console.log(1);\n', 'src/a.ts')).toContain('no-console');
  });

  test('flags a bare eslint-disable', async () => {
    const code = '// eslint-disable-next-line no-console\nconsole.log(1);\n';
    expect(await ruleIds(code, 'src/a.ts')).toContain(
      '@eslint-community/eslint-comments/require-description',
    );
  });

  test('ignores Markdown under content/', async () => {
    expect(await eslint.isPathIgnored('content/x.md')).toBe(true);
    expect(await eslint.isPathIgnored('content/lessons/x.ts')).toBe(true);
    expect(await eslint.isPathIgnored('packages/content/src/x.ts')).toBe(false);
  });
});

describe('relaxations for tests and test helpers', () => {
  const configFor = async (path: string): Promise<Record<string, unknown[] | string>> => {
    const config = await eslint.calculateConfigForFile(path);
    return config.rules as Record<string, unknown[] | string>;
  };
  const severity = (rule: unknown[] | string | undefined): unknown =>
    Array.isArray(rule) ? rule[0] : rule;

  test.each(['packages/learner-core/src/testing/a.ts', 'packages/learner-core/test/helpers/a.ts'])(
    '%s: no function limit, no magic numbers, 500-line files',
    async (path) => {
      const rules = await configFor(path);
      expect(severity(rules['max-lines-per-function'])).toBe(0);
      expect(severity(rules['no-magic-numbers'])).toBe(0);
      expect((rules['max-lines'] as [number, { max: number }])[1].max).toBe(500);
    },
  );

  test('production source keeps all three', async () => {
    const rules = await configFor('packages/learner-core/src/a.ts');
    expect(severity(rules['max-lines-per-function'])).toBe(2);
    expect(severity(rules['no-magic-numbers'])).toBe(1);
    expect((rules['max-lines'] as [number, { max: number }])[1].max).toBe(300);
  });
});

describe('Svelte files', () => {
  test('are limited to 200 lines while TypeScript beside them keeps 300', async () => {
    const maxLines = async (path: string): Promise<number> => {
      const config = await eslint.calculateConfigForFile(path);
      return (config.rules?.['max-lines'] as [number, { max: number }])[1].max;
    };
    expect(await maxLines('apps/learner/src/A.svelte')).toBe(200);
    expect(await maxLines('apps/learner/src/a.ts')).toBe(300);
  });
});
