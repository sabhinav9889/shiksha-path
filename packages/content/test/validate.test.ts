import { describe, expect, test } from 'vitest';
import type { ContentIssue } from '../src/issues.js';
import { loadContent } from '../src/load.js';
import { validateContent } from '../src/validate.js';
import { makeContentDir, type FileMap } from './helpers/content-dir.js';
import { APT, EF1, lessonMd, listenItem, validFixture, wordItem } from './helpers/fixture.js';

async function check(files: FileMap, preview = false): Promise<ContentIssue[]> {
  const { content, issues } = await loadContent(await makeContentDir(files));
  if (issues.length > 0) throw new Error(`fixture failed to load: ${JSON.stringify(issues)}`);
  return validateContent(content, { preview });
}

const errors = (issues: ContentIssue[]): string[] =>
  issues.filter((i) => i.severity === 'error').map((i) => `${i.file}: ${i.message}`);
const warnings = (issues: ContentIssue[]): string[] =>
  issues.filter((i) => i.severity === 'warning').map((i) => `${i.file}: ${i.message}`);

const aptLesson = (over: Partial<Parameters<typeof lessonMd>[0]>): string =>
  lessonMd({ id: 'apt-02', track: 'aptitude', module: 'aptitude-1', order: 2, ...over });

function withAudioRef(ref: string, extraFiles: FileMap = {}): FileMap {
  return {
    ...validFixture(),
    ...extraFiles,
    [`${APT}/lessons/02-x.md`]: aptLesson({ audio: ref }),
  };
}

describe('validateContent', () => {
  test.each([false, true])('valid fixture has no issues (preview=%s)', async (preview) => {
    expect(await check(validFixture(), preview)).toEqual([]);
  });

  test('duplicate lesson id across modules', async () => {
    const files = { ...validFixture(), [`${APT}/lessons/02-x.md`]: aptLesson({ id: 'ef1-01' }) };
    const found = errors(await check(files));
    expect(found.join('\n')).toContain('ef1-01');
    expect(found.some((e) => e.startsWith(`${APT}/lessons/02-x.md`))).toBe(true);
    expect(found.some((e) => e.startsWith(`${EF1}/lessons/01-greetings.md`))).toBe(true);
  });

  test('module track not in tracks.yaml', async () => {
    const files = validFixture();
    files[`${APT}/module.yaml`] = String(files[`${APT}/module.yaml`]).replace(
      'track: aptitude',
      'track: coding',
    );
    expect(errors(await check(files)).join('\n')).toContain('track "coding"');
  });

  test('lesson track differs from module track', async () => {
    const files = {
      ...validFixture(),
      [`${APT}/lessons/02-x.md`]: aptLesson({ track: 'english' }),
    };
    expect(errors(await check(files))).toEqual([expect.stringContaining(`${APT}/lessons/02-x.md`)]);
  });

  test('duplicate lesson order in module', async () => {
    const files = { ...validFixture(), [`${APT}/lessons/02-x.md`]: aptLesson({ order: 1 }) };
    expect(errors(await check(files)).join('\n')).toContain('order 1');
  });

  test('audio path with .. is rejected', async () => {
    expect(errors(await check(withAudioRef('../x.mp3'))).join()).toContain('..');
  });

  test('absolute audio path is rejected', async () => {
    expect(errors(await check(withAudioRef('/etc/x.mp3'))).join()).toContain('relative');
  });

  test('audio file missing', async () => {
    expect(errors(await check(withAudioRef('audio/missing.mp3'))).join()).toContain('not found');
  });

  test('audio case mismatch is rejected', async () => {
    const files = withAudioRef('audio/hello2.mp3', { [`${APT}/audio/Hello2.mp3`]: 'x' });
    expect(errors(await check(files)).join()).toContain('not found');
  });

  test('audio with .wav extension is rejected', async () => {
    const files = withAudioRef('audio/x.wav', { [`${APT}/audio/x.wav`]: 'x' });
    expect(errors(await check(files)).join()).toContain('.wav');
  });

  test('item audio in a test-out is checked against the module folder', async () => {
    const files = validFixture();
    files[`${APT}/test-out.yaml`] =
      `review: approved\nitems:\n${listenItem('t1', 'audio/no.mp3')}\n`;
    expect(errors(await check(files))).toEqual([expect.stringContaining('test-out.yaml')]);
  });

  test('placement audio resolves under placement/', async () => {
    const files = validFixture();
    const yaml = String(files['placement/placement.yaml']);
    const listen = listenItem('p3', 'audio/p.mp3').replace(/^/gm, '    ');
    files['placement/placement.yaml'] = yaml.replace(
      `    start_rules:`,
      `${listen}\n    start_rules:`,
    );
    files['placement/audio/p.mp3'] = 'x';
    expect(await check(files)).toEqual([]);
  });

  test('placement section track unknown', async () => {
    const files = validFixture();
    files['placement/placement.yaml'] = String(files['placement/placement.yaml']).replace(
      '- track: aptitude',
      '- track: coding',
    );
    expect(errors(await check(files)).join()).toContain('coding');
  });

  test('placement start_lesson unknown', async () => {
    const files = validFixture();
    files['placement/placement.yaml'] = String(files['placement/placement.yaml']).replace(
      'start_lesson: apt-01',
      'start_lesson: apt-99',
    );
    expect(errors(await check(files)).join()).toContain('apt-99');
  });

  test('placement start_lesson in another track is rejected', async () => {
    const files = validFixture();
    files['placement/placement.yaml'] = String(files['placement/placement.yaml']).replace(
      'start_lesson: apt-01',
      'start_lesson: ef1-01',
    );
    expect(errors(await check(files)).join()).toContain('ef1-01');
  });

  test('placement without a min_score 0 rule', async () => {
    const files = validFixture();
    files['placement/placement.yaml'] = String(files['placement/placement.yaml']).replace(
      '{ min_score: 0, start_lesson: apt-01 }',
      '{ min_score: 0.5, start_lesson: apt-01 }',
    );
    expect(errors(await check(files)).join()).toContain('min_score: 0');
  });

  test('placement start_lesson pending: error normally, no error with preview', async () => {
    const files = validFixture();
    files[`${EF1}/lessons/02-name.md`] = lessonMd({
      id: 'ef1-02',
      track: 'english',
      module: 'english-foundation-1',
      order: 2,
      review: 'pending',
    });
    expect(errors(await check(files))).toEqual([
      expect.stringContaining('placement starts at ef1-02, which is not approved'),
    ]);
    expect(errors(await check(files, true))).toEqual([]);
  });

  test('pending lesson warns when not preview', async () => {
    const files = {
      ...validFixture(),
      [`${APT}/lessons/02-x.md`]: aptLesson({ review: 'pending' }),
    };
    expect(warnings(await check(files))).toEqual([
      `${APT}/lessons/02-x.md: excluded from build (review: pending)`,
    ]);
    expect(warnings(await check(files, true))).toEqual([]);
  });

  test('lesson with 3 items warns', async () => {
    const items = ['q1', 'q2', 'q3'].map(wordItem);
    const files = { ...validFixture(), [`${APT}/lessons/02-x.md`]: aptLesson({ items }) };
    expect(warnings(await check(files)).join()).toContain('3 items');
    expect(errors(await check(files))).toEqual([]);
  });
});
