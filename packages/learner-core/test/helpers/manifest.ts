import type { Manifest } from '@shiksha/content/schema';

const L = (hi: string, en: string): { hi: string; en: string } => ({ hi, en });
const HASH = 'a'.repeat(64);

const lessons = (ids: string[]): Manifest['modules'][number]['lessons'] =>
  ids.map((id, i) => ({ id, order: i + 1, title: L('पाठ', 'Lesson') }));

const moduleEntry = (
  id: string,
  track: string,
  order: number,
  ids: string[],
): Manifest['modules'][number] => ({
  id,
  track,
  title: L('मॉड्यूल', 'Module'),
  order,
  version: 'a1b2c3d4e5f6',
  file: `modules/${id}.a1b2c3d4e5f6.json`,
  sha256: HASH,
  bytes: 1000,
  audio_bytes: 0,
  lessons: lessons(ids),
});

/** English (ef1-01..03) then aptitude (apt-01..02), the same shape the fixture content builds. */
export function makeManifest(): Manifest {
  return {
    schema_version: 1,
    built_at: '2026-10-18T10:00:00.000Z',
    preview: false,
    tracks: [
      { id: 'aptitude', title: L('सोच', 'Aptitude'), order: 2 },
      { id: 'english', title: L('अंग्रेज़ी', 'English'), order: 1 },
    ],
    modules: [
      moduleEntry('aptitude-1', 'aptitude', 1, ['apt-01', 'apt-02']),
      moduleEntry('english-foundation-1', 'english', 1, ['ef1-01', 'ef1-02', 'ef1-03']),
    ],
    placement: null,
  };
}
