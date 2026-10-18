import { readdir, rename, rm } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { selectForBuild, writeBuild, type BuildResult } from './build.js';
import type { ContentIssue } from './issues.js';
import { loadContent } from './load.js';
import type { Content } from './schema/structure.js';
import { validateContent } from './validate.js';

export interface CliIo {
  log(message: string): void;
  error(message: string): void;
}

const HELP = `Usage: content-build [--content <dir>] [--out <dir>] [--preview] [--check]

  --content <dir>  content folder (default: content)
  --out <dir>      output folder, emptied first (default: dist/content)
  --preview        include review: pending content (mentor preview build)
  --check          validate only; write nothing
  --help           show this help`;

const OPTIONS = {
  content: { type: 'string', default: 'content' },
  out: { type: 'string', default: 'dist/content' },
  preview: { type: 'boolean', default: false },
  check: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} as const;

const format = (i: ContentIssue): string =>
  `${i.severity} ${i.file}${i.path === undefined ? '' : ` ${i.path}`}: ${i.message}`;

function report(io: CliIo, issues: ContentIssue[]): boolean {
  for (const i of issues) (i.severity === 'error' ? io.error : io.log)(format(i));
  return issues.some((i) => i.severity === 'error');
}

const counts = (c: Content): string =>
  `${c.modules.length} modules, ${c.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons`;

/** The out dir is replaced on each build: only ever replace a previous build (or nothing). */
async function outProblem(contentDir: string, outDir: string): Promise<string | null> {
  const rel = relative(outDir, contentDir);
  if (rel === '' || !rel.startsWith('..')) {
    return `refusing to empty ${outDir}: it contains the content folder`;
  }
  const names = await readdir(outDir).catch(() => [] as string[]);
  if (names.length > 0 && !names.includes('manifest.json')) {
    return `refusing to replace ${outDir}: it is not empty and has no manifest.json (not a previous build)`;
  }
  return null;
}

/** Build into a temporary sibling folder and swap it in only if the whole build succeeded. */
async function buildAtomically(
  selected: Content,
  outDir: string,
  preview: boolean,
): Promise<BuildResult> {
  const tmp = `${outDir}.tmp-${process.pid}`;
  await rm(tmp, { recursive: true, force: true });
  try {
    const result = await writeBuild(selected, tmp, { preview, now: new Date() });
    await rm(outDir, { recursive: true, force: true });
    await rename(tmp, outDir);
    return result;
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  }
}

type ParsedArgs = ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>>;

function parse(argv: string[], io: CliIo): ParsedArgs | null {
  try {
    return parseArgs({ args: argv, options: OPTIONS, strict: true });
  } catch (e) {
    io.error(`${e instanceof Error ? e.message : String(e)}\n\n${HELP}`);
    return null;
  }
}

/** Load, validate and (unless --check) build the content. Returns the process exit code. */
export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const args = parse(argv, io);
  if (!args) return 1;
  if (args.values.help) {
    io.log(HELP);
    return 0;
  }
  const { preview, check } = args.values;
  const contentDir = resolve(args.values.content);
  const outDir = resolve(args.values.out);
  const loaded = await loadContent(contentDir);
  const issues = [...loaded.issues, ...(await validateContent(loaded.content, { preview }))];
  if (report(io, issues)) return 1;
  const selected = selectForBuild(loaded.content, { preview });
  if (check) {
    io.log(`Content OK: ${counts(selected)}`);
    return 0;
  }
  const problem = await outProblem(contentDir, outDir);
  if (problem) {
    io.error(problem);
    return 1;
  }
  let built: BuildResult;
  try {
    built = await buildAtomically(selected, outDir, preview);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    io.error(`build failed: ${reason}\nthe previous build in ${outDir} is unchanged`);
    return 1;
  }
  report(io, built.issues);
  io.log(`Built ${counts(selected)} → ${outDir}`);
  return 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await runCli(process.argv.slice(2), console);
}
