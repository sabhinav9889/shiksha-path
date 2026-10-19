/** Avatar colours (background, ink) taken in turn for each profile on the picker. */
export const COLOURS: readonly (readonly [string, string])[] = [
  ['#d9dcff', '#1f2780'],
  ['#fdf0dd', '#8a4b06'],
];

/** A long Devanagari name has no spaces to wrap at, so the picker cuts it with an ellipsis. */
export const TRUNCATE =
  'min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
