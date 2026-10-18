// Compiled only by this package's `npm run typecheck`. If DOM types ever come back, the
// directive below becomes unused and the typecheck fails.
// @ts-expect-error DOM types must stay absent
export const probe = (): unknown => document;
