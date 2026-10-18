/** Every user-visible failure has one of these codes; the app maps a code to Hindi or English. */
export const ERROR_CODES = [
  'LOW_STORAGE',
  'DOWNLOAD_FAILED',
  'BUNDLE_CORRUPT',
  'BUNDLE_TOO_LARGE',
  'MANIFEST_UNAVAILABLE',
  'MODULE_NOT_READY',
  'PIN_INVALID',
  'PIN_WRONG',
  'PIN_LOCKED',
  'NAME_INVALID',
  'PROFILE_NOT_FOUND',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class CoreError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CoreError';
  }
}
