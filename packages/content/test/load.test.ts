import { describe, expect, test } from 'vitest';
import { loadContent } from '../src/load.js';
import { makeContentDir, type FileMap } from './helpers/content-dir.js';
import { APT, EF1, lessonMd, validFixture } from './helpers/fixture.js';

async function load(files: FileMap): ReturnType<typeof loadContent> {
  return loadContent(await makeContentDir(files));
}

const without = (files: FileMap, path: string): FileMap =>
  Object.fromEntries(Object.entries(files).filter(([p]) => p !== path));

describe('loadContent', () => {
  test('loads the valid fixture with no issues', async () => {
    const { content, issues } = await load(validFixture());
    expect(issues).toEqual([]);
    expect(content.tracks.map((t) => t.id)).toEqual(['english', 'aptitude']);
    expect(content.modules.map((m) => m.meta.id)).toEqual(['aptitude-1', 'english-foundation-1']);
    const ef1 = content.modules.find((m) => m.meta.id === 'english-foundation-1');
    expect(ef1?.lessons.map((l) => l.meta.id)).toEqual(['ef1-01', 'ef1-02']);
    expect(ef1?.testOut?.items).toHaveLength(1);
    expect(content.placement?.sections).toHaveLength(2);
  });

  test('module.yaml id must match folder name', async () => {
    const files = validFixture();
    files[`${APT}/module.yaml`] = String(files[`${APT}/module.yaml`]).replace(
      'id: aptitude-1',
      'id: aptitude-2',
    );
    const { issues } = await load(files);
    expect(issues).toContainEqual(
      expect.objectContaining({ file: `${APT}/module.yaml`, severity: 'error' }),
    );
  });

  test('lesson module field must match its folder', async () => {
    const files = validFixture();
    files[`${APT}/lessons/02-x.md`] = lessonMd({
      id: 'apt-02',
      track: 'aptitude',
      module: 'english-foundation-1',
      order: 2,
    });
    const { issues } = await load(files);
    expect(issues.map((i) => i.file)).toContain(`${APT}/lessons/02-x.md`);
  });

  test('missing test-out.yaml is an error', async () => {
    const { content, issues } = await load(without(validFixture(), `${APT}/test-out.yaml`));
    expect(issues.map((i) => i.message).join()).toContain('test-out.yaml');
    expect(content.modules.find((m) => m.meta.id === 'aptitude-1')?.testOut).toBeNull();
  });

  test('missing placement.yaml is an error', async () => {
    const { content, issues } = await load(without(validFixture(), 'placement/placement.yaml'));
    expect(issues.map((i) => i.message).join()).toContain('placement.yaml');
    expect(content.placement).toBeNull();
  });

  test('missing tracks.yaml is an error', async () => {
    const { issues } = await load(without(validFixture(), 'tracks.yaml'));
    expect(issues.map((i) => i.message).join()).toContain('tracks.yaml');
  });

  test('invalid module.yaml is reported with its path', async () => {
    const files = validFixture();
    files[`${APT}/module.yaml`] = 'id: aptitude-1\ntrack: aptitude\norder: 2\nhi_ratio: 2\n';
    const { issues } = await load(files);
    const paths = issues.filter((i) => i.file === `${APT}/module.yaml`).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'hi_ratio']));
  });

  test('a broken lesson does not stop other lessons loading', async () => {
    const files = validFixture();
    files[`${EF1}/lessons/02-name.md`] = 'not a lesson';
    const { content, issues } = await load(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.file).toBe(`${EF1}/lessons/02-name.md`);
    const ef1 = content.modules.find((m) => m.meta.id === 'english-foundation-1');
    expect(ef1?.lessons.map((l) => l.meta.id)).toEqual(['ef1-01']);
  });

  test('test-out pass_mark defaults to 0.8', async () => {
    const { content } = await load(validFixture());
    expect(content.modules[0]?.testOut?.pass_mark).toBe(0.8);
  });
});
