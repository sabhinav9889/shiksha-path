import { z } from 'zod';

/** WCAG AA for normal text: the app puts white text on both colours (spec §8.1). */
export const MIN_CONTRAST = 4.5;
const MAX_NAME = 40;
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

const CHANNEL_MAX = 255;
const LINEAR_KNEE = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA = 2.4;
/* eslint-disable-next-line no-magic-numbers -- the WCAG 2.x luminance weights for R, G and B */
const WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
/** Where the red, green and blue pairs start in `#rrggbb`. */
/* eslint-disable-next-line no-magic-numbers -- the offsets of rr, gg and bb after the # */
const CHANNEL_STARTS = [1, 3, 5] as const;
const FLARE = 0.05;
const HEX_BASE = 16;

/** Relative luminance of a `#rrggbb` colour (WCAG 2.x). */
function luminance(hex: string): number {
  const channels = CHANNEL_STARTS.map(
    (at) => parseInt(hex.slice(at, at + 2), HEX_BASE) / CHANNEL_MAX,
  );
  const linear = channels.map((c) =>
    c <= LINEAR_KNEE ? c / LINEAR_DIVISOR : ((c + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA,
  );
  return linear.reduce((sum, c, i) => sum + c * (WEIGHTS[i] ?? 0), 0);
}

/** WCAG contrast ratio between two `#rrggbb` colours: 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + FLARE) / (lo + FLARE);
}

/** The app's page colour (`--color-bg`): brand colours are also used as text on it. */
export const PAGE_BACKGROUND = '#f4f5fa';

/** Readable as a background for white text and as text on the page (Plan 3b review M4). */
export function isReadable(colour: string): boolean {
  return (
    contrastRatio('#ffffff', colour) >= MIN_CONTRAST &&
    contrastRatio(PAGE_BACKGROUND, colour) >= MIN_CONTRAST
  );
}

const readableColour = z
  .string()
  .regex(HEX_COLOUR)
  .refine(isReadable, 'the colour would be hard to read on white or on the page');

const DARK_SHARE = 0.7;
const SOFT_SHARE = 0.1;

function mapChannels(hex: string, f: (c: number) => number): string {
  return `#${CHANNEL_STARTS.map((at) =>
    Math.round(f(parseInt(hex.slice(at, at + 2), HEX_BASE)))
      .toString(HEX_BASE)
      .padStart(2, '0'),
  ).join('')}`;
}

/** The pressed (`-dark`) and tinted (`-soft`) shades the app derives from the primary. */
export function primaryShades(primary: string): { dark: string; soft: string } {
  return {
    dark: mapChannels(primary, (c) => c * DARK_SHARE),
    soft: mapChannels(primary, (c) => CHANNEL_MAX - (CHANNEL_MAX - c) * SOFT_SHARE),
  };
}

const name = z.strictObject({
  hi: z.string().trim().min(1).max(MAX_NAME),
  en: z.string().trim().min(1).max(MAX_NAME),
});

/** What an admin may set (the panel, or the owner's tool until Plan 4). */
export const brandingInput = z.strictObject({
  name,
  primary: readableColour,
  accent: readableColour,
});
export type BrandingInput = z.infer<typeof brandingInput>;

/** What phones receive: the input plus a version that grows with every change. */
export const branding = z.object({
  name: z.object({ hi: z.string().min(1), en: z.string().min(1) }),
  primary: z.string().regex(HEX_COLOUR),
  accent: z.string().regex(HEX_COLOUR),
  version: z.number().int().min(0),
});
export type Branding = z.infer<typeof branding>;

export const DEFAULT_BRANDING: Branding = {
  name: { hi: 'शिक्षा पथ', en: 'Shiksha Path' },
  primary: '#2f3ab2',
  accent: '#b45309',
  version: 0,
};
