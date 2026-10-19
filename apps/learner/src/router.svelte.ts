export type Route =
  | { name: 'profiles' }
  | { name: 'home' }
  | { name: 'lessons' }
  | { name: 'learn'; lessonId: string }
  | { name: 'practice' }
  | { name: 'finish' }
  | { name: 'placement' }
  | { name: 'placement-result' };

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
] as const;

/** Unknown, empty or malformed hashes go home; a lesson id must be a plain slug. */
export function parseRoute(hash: string): Route {
  const [head, ...rest] = hash.replace(/^#\/?/, '').split('/');
  if (head === 'learn') {
    const [lessonId] = rest;
    return rest.length === 1 && lessonId !== undefined && LESSON_ID.test(lessonId)
      ? { name: 'learn', lessonId }
      : HOME;
  }
  const simple = SIMPLE_ROUTES.find((name) => name === head);
  return rest.length === 0 && simple ? { name: simple } : HOME;
}

export function routeHref(route: Route): string {
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
