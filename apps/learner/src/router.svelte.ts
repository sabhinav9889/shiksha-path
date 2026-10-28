export type Route =
  | { name: 'profiles' }
  | { name: 'home' }
  | { name: 'lessons' }
  | { name: 'learn'; lessonId: string }
  | { name: 'practice' }
  | { name: 'finish' }
  | { name: 'placement' }
  | { name: 'placement-result' }
  | { name: 'me' }
  | { name: 'auth-callback' }
  | { name: 'staff'; view: 'cohorts' | 'recordings' }
  | { name: 'staff'; view: 'student'; id: string }
  | { name: 'staff'; view: 'cohort'; id: string }
  | { name: 'staff'; view: 'admin'; section: AdminSection };

export const ADMIN_SECTIONS = ['setup', 'students', 'switches', 'branding', 'audit'] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

const STAFF_HOME: Route = { name: 'staff', view: 'cohorts' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The staff section (Plan 4a): anything it does not know goes to the cohorts list. */
function parseStaff(rest: string[]): Route {
  const [view, arg, ...extra] = rest;
  if (extra.length > 0) return STAFF_HOME;
  if (view === 'recordings') {
    return arg === undefined ? { name: 'staff', view: 'recordings' } : STAFF_HOME;
  }
  if (view === 'student' || view === 'cohort') {
    return arg !== undefined && UUID.test(arg) ? { name: 'staff', view, id: arg } : STAFF_HOME;
  }
  const section = ADMIN_SECTIONS.find((s) => s === arg);
  return view === 'admin' && section ? { name: 'staff', view: 'admin', section } : STAFF_HOME;
}

const HOME: Route = { name: 'home' };
const LESSON_ID = /^[a-z0-9-]+$/;
const SIMPLE_ROUTES = [
  'profiles',
  'home',
  'lessons',
  'practice',
  'finish',
  'placement',
  'placement-result',
  'me',
  'auth-callback',
] as const;

/** Unknown, empty or malformed hashes go home; a lesson id must be a plain slug. */
export function parseRoute(hash: string): Route {
  // Google sign-in may come back with `?code=…` after the route: only the path picks the route.
  const [head, ...rest] = (hash.replace(/^#\/?/, '').split('?')[0] ?? '').split('/');
  if (head === 'staff') return parseStaff(rest);
  if (head === 'learn') {
    const [lessonId] = rest;
    return rest.length === 1 && lessonId !== undefined && LESSON_ID.test(lessonId)
      ? { name: 'learn', lessonId }
      : HOME;
  }
  const simple = SIMPLE_ROUTES.find((name) => name === head);
  return rest.length === 0 && simple ? { name: simple } : HOME;
}

function staffHref(route: Extract<Route, { name: 'staff' }>): string {
  if (route.view === 'student') return `#/staff/student/${route.id}`;
  if (route.view === 'cohort') return `#/staff/cohort/${route.id}`;
  if (route.view === 'admin') return `#/staff/admin/${route.section}`;
  return route.view === 'recordings' ? '#/staff/recordings' : '#/staff';
}

export function routeHref(route: Route): string {
  if (route.name === 'staff') return staffHref(route);
  return route.name === 'learn' ? `#/learn/${route.lessonId}` : `#/${route.name}`;
}

export const router = $state<{ current: Route }>({
  current: parseRoute(typeof location === 'undefined' ? '' : location.hash),
});

export function navigate(route: Route): void {
  router.current = route;
  window.location.hash = routeHref(route);
}

/** Follow the address bar (Back, links, reload). Returns the function that stops following. */
export function startRouter(): () => void {
  const follow = (): void => {
    router.current = parseRoute(window.location.hash);
  };
  window.addEventListener('hashchange', follow);
  follow();
  return () => window.removeEventListener('hashchange', follow);
}
