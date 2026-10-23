import type { StaffMe } from '@shiksha/api-contract/staff';
import type { StaffAuth } from './staff-auth.js';

/** The signed-in staff member, shared by the staff screens. */
export const staffState = $state<{ me: StaffMe | null; auth: StaffAuth | null }>({
  me: null,
  auth: null,
});
