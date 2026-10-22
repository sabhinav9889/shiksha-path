import { DEFAULT_BRANDING, type Branding } from '@shiksha/api-contract';
import type { BrandingRepo } from '../ports.js';

export function memoryBranding(): BrandingRepo {
  let current: Branding = structuredClone(DEFAULT_BRANDING);
  return {
    get: () => Promise.resolve(structuredClone(current)),
    set(input) {
      current = { ...structuredClone(input), version: current.version + 1 };
      return Promise.resolve({ version: current.version });
    },
  };
}
