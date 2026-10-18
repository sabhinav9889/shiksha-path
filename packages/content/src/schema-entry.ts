/**
 * Browser-safe entry point: the `@shiksha/content/schema` package export.
 *
 * Only zod schemas and their types. No `node:` modules and nothing that renders or builds
 * content, so the learner app (and later server code) can use the same contract the content
 * builder writes. A test walks this file's imports to keep it that way.
 */
export * from './schema/bundle.js';
export { ITEM_TYPES, practiceItem } from './schema/items.js';
export type { ChoiceOption, PracticeItem } from './schema/items.js';
export { contentId, localized } from './schema/localized.js';
export type { Localized } from './schema/localized.js';
export { placementSection, track } from './schema/structure.js';
export type { PlacementSection, Track } from './schema/structure.js';
