import type { ApiError } from '@shiksha/api-contract';

/** A refusal the API reports to the caller as its error code. */
export class ApiFailure extends Error {
  constructor(readonly code: ApiError) {
    super(code);
    this.name = 'ApiFailure';
  }
}
