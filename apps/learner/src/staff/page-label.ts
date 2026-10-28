import type { AdminSection, Route } from '../router.svelte.js';
import type { StaffKey } from './i18n.js';

const ADMIN_LABELS: Record<AdminSection, StaffKey> = {
  setup: 'adminSetup',
  students: 'adminStudents',
  switches: 'adminSwitches',
  branding: 'adminBranding',
  audit: 'adminAudit',
};

/**
 * The staff bar link a page belongs to, which is also the page's title. A student's page sits
 * under the cohorts. A mentor who opens an admin address is shown the cohorts, as the screen does.
 */
export function pageLabel(route: Route, role: 'mentor' | 'admin' | undefined): StaffKey | null {
  if (route.name !== 'staff') return null;
  if (route.view === 'admin') return role === 'admin' ? ADMIN_LABELS[route.section] : 'cohorts';
  return route.view === 'recordings' ? 'recordings' : 'cohorts'; // also one cohort or a student
}
