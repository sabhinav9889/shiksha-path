import { error, warning, type ContentIssue } from './issues.js';
import type { Lesson } from './schema/lesson.js';
import type { Content, LoadedModule, PlacementSection } from './schema/structure.js';
import { checkAudioRef, collectAudioRefs } from './validate-audio.js';

const MIN_ITEMS = 5;
const MAX_ITEMS = 10;
const PLACEMENT_FILE = 'placement/placement.yaml';

const allLessons = (content: Content): Lesson[] => content.modules.flatMap((m) => m.lessons);
const moduleFile = (m: LoadedModule): string => `modules/${m.meta.id}/module.yaml`;

/** Rule 1: lesson ids are unique across all modules (both files are reported). */
function uniqueLessonIds(content: Content): ContentIssue[] {
  const byId = new Map<string, string[]>();
  for (const l of allLessons(content))
    byId.set(l.meta.id, [...(byId.get(l.meta.id) ?? []), l.file]);
  return [...byId].flatMap(([id, files]) =>
    files.length < 2
      ? []
      : files.map((f) =>
          error(
            f,
            `lesson id ${id} is also used in ${files.filter((o) => o !== f).join(', ')}`,
            'id',
          ),
        ),
  );
}

/** Rule 2: module ids unique, module tracks exist, lesson track equals module track. */
function tracksAndModules(content: Content): ContentIssue[] {
  const tracks = new Set(content.tracks.map((t) => t.id));
  const seen = new Set<string>();
  return content.modules.flatMap((m) => {
    const issues: ContentIssue[] = [];
    if (seen.has(m.meta.id))
      issues.push(error(moduleFile(m), `module id ${m.meta.id} is duplicated`, 'id'));
    seen.add(m.meta.id);
    if (!tracks.has(m.meta.track)) {
      issues.push(error(moduleFile(m), `track "${m.meta.track}" is not in tracks.yaml`, 'track'));
    }
    for (const l of m.lessons.filter((x) => x.meta.track !== m.meta.track)) {
      issues.push(
        error(
          l.file,
          `lesson track "${l.meta.track}" must equal module track "${m.meta.track}"`,
          'track',
        ),
      );
    }
    return issues;
  });
}

/** Rule 3: lesson order values are unique within a module. */
function uniqueOrders(content: Content): ContentIssue[] {
  return content.modules.flatMap((m) =>
    m.lessons
      .filter((l, i) => m.lessons.findIndex((o) => o.meta.order === l.meta.order) !== i)
      .map((l) =>
        error(l.file, `order ${l.meta.order} is used by another lesson in ${m.meta.id}`, 'order'),
      ),
  );
}

function placementSection(content: Content, s: PlacementSection, preview: boolean): ContentIssue[] {
  if (!content.tracks.some((t) => t.id === s.track)) {
    return [error(PLACEMENT_FILE, `placement section track "${s.track}" is not in tracks.yaml`)];
  }
  const issues: ContentIssue[] = [];
  if (!s.start_rules.some((r) => r.min_score === 0)) {
    issues.push(error(PLACEMENT_FILE, `section ${s.track} needs a start rule with min_score: 0`));
  }
  const lessons = new Map(allLessons(content).map((l) => [l.meta.id, l]));
  for (const { start_lesson: id } of s.start_rules) {
    const lesson = lessons.get(id);
    if (!lesson) issues.push(error(PLACEMENT_FILE, `placement starts at unknown lesson ${id}`));
    else if (lesson.meta.track !== s.track) {
      issues.push(
        error(
          PLACEMENT_FILE,
          `placement section ${s.track} starts at ${id} from track ${lesson.meta.track}`,
        ),
      );
    } else if (!preview && lesson.meta.review !== 'approved') {
      issues.push(error(PLACEMENT_FILE, `placement starts at ${id}, which is not approved`));
    }
  }
  return issues;
}

/** Rules 6–7: pending lessons are excluded (warning); 5–10 items per lesson (warning). */
function lessonWarnings(content: Content, preview: boolean): ContentIssue[] {
  return allLessons(content).flatMap((l) => {
    const issues: ContentIssue[] = [];
    if (!preview && l.meta.review === 'pending')
      issues.push(warning(l.file, 'excluded from build (review: pending)'));
    const n = l.meta.items.length;
    if (n < MIN_ITEMS || n > MAX_ITEMS) {
      issues.push(
        warning(l.file, `${n} items; lessons should have ${MIN_ITEMS}–${MAX_ITEMS} (spec §6.1)`),
      );
    }
    return issues;
  });
}

/** Cross-file checks on a loaded content tree. */
export async function validateContent(
  content: Content,
  opts: { preview: boolean },
): Promise<ContentIssue[]> {
  const audio = await Promise.all(collectAudioRefs(content).map(checkAudioRef));
  const sections = content.placement?.sections ?? [];
  return [
    ...uniqueLessonIds(content),
    ...tracksAndModules(content),
    ...uniqueOrders(content),
    ...audio.flat(),
    ...sections.flatMap((s) => placementSection(content, s, opts.preview)),
    ...lessonWarnings(content, opts.preview),
  ];
}
