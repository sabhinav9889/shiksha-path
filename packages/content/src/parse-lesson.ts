import { parse as parseYaml } from 'yaml';
import { error, fromZod, type ContentIssue, type ParseResult } from './issues.js';
import { lessonMeta, type Lesson } from './schema/lesson.js';
import { nfc, normalizeSource } from './text.js';

const FRONT_MATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const MARKER = /<!-- lang:(hi|en) -->/g;
const LANGS = ['hi', 'en'] as const;

/** Split `---\nyaml\n---\nbody`. Only plain YAML front-matter; never executable variants. */
export function splitFrontMatter(source: string): { yaml: string; body: string } | null {
  const match = FRONT_MATTER.exec(source);
  if (!match) return null;
  return { yaml: match[1] ?? '', body: source.slice(match[0].length) };
}

export function parseYamlSafe(file: string, text: string): ParseResult<unknown> {
  try {
    return { ok: true, value: parseYaml(text) as unknown };
  } catch (e) {
    const reason = e instanceof Error ? e.message.split('\n')[0] : String(e);
    return { ok: false, issues: [error(file, `invalid YAML front-matter: ${reason}`)] };
  }
}

/** Split the body on `<!-- lang:hi -->` / `<!-- lang:en -->` markers. */
export function splitBody(file: string, body: string): ParseResult<Lesson['body']> {
  const markers = [...body.matchAll(MARKER)];
  const issues: ContentIssue[] = [];
  if (body.slice(0, markers[0]?.index ?? body.length).trim() !== '') {
    issues.push(error(file, 'text before the first <!-- lang:… --> marker'));
  }
  const sections: Partial<Record<(typeof LANGS)[number], string>> = {};
  markers.forEach((m, i) => {
    const lang = m[1] as (typeof LANGS)[number];
    if (sections[lang] !== undefined) {
      issues.push(error(file, `<!-- lang:${lang} --> appears more than once`));
    }
    const end = markers[i + 1]?.index ?? body.length;
    sections[lang] = body.slice((m.index ?? 0) + m[0].length, end).trim();
  });
  for (const lang of LANGS) {
    if (sections[lang] === undefined)
      issues.push(error(file, `missing <!-- lang:${lang} --> section`));
    else if (sections[lang] === '')
      issues.push(error(file, `<!-- lang:${lang} --> section is empty`));
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { hi: sections.hi ?? '', en: sections.en ?? '' } };
}

/** Parse one lesson file (front-matter + bilingual Markdown body). Never throws. */
export function parseLessonFile(source: string, file: string): ParseResult<Lesson> {
  const split = splitFrontMatter(normalizeSource(source));
  if (!split)
    return { ok: false, issues: [error(file, 'missing --- front-matter block at the top')] };
  const data = parseYamlSafe(file, split.yaml);
  if (!data.ok) return data;
  const meta = lessonMeta.safeParse(nfc(data.value));
  const body = splitBody(file, nfc(split.body));
  const issues = [
    ...(meta.success ? [] : fromZod(file, meta.error.issues)),
    ...(body.ok ? [] : body.issues),
  ];
  if (!meta.success || !body.ok) return { ok: false, issues };
  return { ok: true, value: { file, meta: meta.data, body: body.value } };
}
