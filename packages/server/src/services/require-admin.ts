import { ApiFailure } from './failure.js';
import type { StaffCaller } from './staff.js';

/** Admin-only actions (spec §8.1): a mentor is refused. */
export function requireAdmin(staff: StaffCaller): void {
  if (staff.role !== 'admin') throw new ApiFailure('FORBIDDEN');
}
