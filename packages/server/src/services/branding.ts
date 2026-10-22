import { brandingInput, type Branding } from '@shiksha/api-contract';
import type { BrandingRepo } from '../ports.js';
import { ApiFailure } from './failure.js';

/** The current branding, for every phone, signed in or not. */
export async function getBranding(deps: { branding: BrandingRepo }): Promise<Branding> {
  return deps.branding.get();
}

/**
 * Change the name and colours. A colour white text is hard to read on is refused (WCAG AA),
 * so the app stays readable on cheap screens in sunlight (spec §8.1).
 */
export async function setBranding(
  deps: { branding: BrandingRepo },
  input: unknown,
): Promise<{ version: number }> {
  const parsed = brandingInput.safeParse(input);
  if (!parsed.success) throw new ApiFailure('INVALID_REQUEST');
  return deps.branding.set(parsed.data);
}
