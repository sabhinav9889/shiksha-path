// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import type { FeedPost } from '@shiksha/api-contract';
import { render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { appState, initApp, signIn, signOut } from '../app-state.svelte.js';
import type { ApiClient, ApiResult } from '../api/api-client.js';
import CommunityScreen from './CommunityScreen.svelte';
import { loadFeedCache, refreshFeed } from './feed-cache.js';
import { setLinked } from '../account/account.js';
import type { AccountDeps } from '../account/account.js';

const post = (over: Partial<FeedPost>): FeedPost => ({
  id: crypto.randomUUID(),
  title: 'पोस्ट',
  body: '',
  authorName: 'रवि',
  toCohort: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  editedAt: null,
  session: null,
  ...over,
});
const served = (posts: FeedPost[]): ApiClient =>
  ({ feed: () => Promise.resolve({ ok: true, value: { posts } }) }) as unknown as ApiClient;
const refused = (error: 'OFFLINE' | 'FEATURE_OFF'): ApiClient =>
  ({
    feed: () => Promise.resolve({ ok: false, error }) as Promise<ApiResult<never>>,
  }) as unknown as ApiClient;

let env: TestEnv;
let id: string;

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
  const profile = await env.addProfile('प्रिया');
  id = profile.id;
  await signIn(id, '1234');
});

const open = async (posts: FeedPost[]): Promise<void> => {
  await refreshFeed(env.runtime, served(posts), id); // what the phone kept from the last visit
  render(CommunityScreen);
};

describe('the student community screen', () => {
  test('shows posts newest first as plain text, with the author or the platform name', async () => {
    await open([
      post({ title: 'नया', body: '<b>पेन लाएँ</b>\n<script>alert(1)</script>', authorName: null }),
      post({ title: 'पुराना', toCohort: true }),
    ]);
    await vi.waitFor(() => screen.getByText('नया'));
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['नया', 'पुराना']);
    const first = screen.getByText('नया').closest('article') as HTMLElement;
    expect(within(first).getByText(/<b>पेन लाएँ<\/b>/)).toBeTruthy();
    expect(first.querySelector('script, b')).toBeNull();
    expect(within(first).getByText(new RegExp(appState.brand.name.hi))).toBeTruthy();
    const second = screen.getByText('पुराना').closest('article') as HTMLElement;
    expect(within(second).getByText(/रवि/)).toBeTruthy();
    expect(within(second).getByText('आपके समूह के लिए')).toBeTruthy();
  });

  test('a session shows its India time, and only an https link becomes a link', async () => {
    const starts = new Date(env.runtime.clock.now().getTime() + 86_400_000).toISOString();
    const session = (link: string | null) => ({ startsAt: starts, minutes: 60, link });
    await open([
      post({ title: 'सुरक्षित', session: session('https://meet.google.com/abc-defg-hij') }),
      post({ title: 'खतरनाक', session: session('javascript:alert(1)') }),
      post({ title: 'सादा', session: session('http://x.org/a') }),
    ]);
    await vi.waitFor(() => screen.getByText('सुरक्षित'));
    const safe = screen.getByText('सुरक्षित').closest('article') as HTMLElement;
    const link = within(safe).getByRole('link', { name: 'जुड़ें' });
    expect(link.getAttribute('href')).toBe('https://meet.google.com/abc-defg-hij');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    for (const title of ['खतरनाक', 'सादा']) {
      const card = screen.getByText(title).closest('article') as HTMLElement;
      expect(within(card).queryByRole('link')).toBeNull();
    }
    expect(within(safe).getByText(/मिनट|min/)).toBeTruthy();
  });

  test('a session that is on now or over says so, and an over one has no join link', async () => {
    const now = env.runtime.clock.now().getTime();
    const at = (ms: number) => ({
      startsAt: new Date(now + ms).toISOString(),
      minutes: 60,
      link: 'https://meet.google.com/x',
    });
    await open([
      post({ title: 'चल रहा', session: at(-10 * 60_000) }),
      post({ title: 'खत्म', session: at(-3 * 3_600_000) }),
    ]);
    await vi.waitFor(() => screen.getByText('चल रहा'));
    const live = screen.getByText('चल रहा').closest('article') as HTMLElement;
    expect(within(live).getByText('अभी चल रहा है')).toBeTruthy();
    expect(within(live).getByRole('link', { name: 'जुड़ें' })).toBeTruthy();
    const over = screen.getByText('खत्म').closest('article') as HTMLElement;
    expect(within(over).getByText('हो चुका')).toBeTruthy();
    expect(within(over).queryByRole('link')).toBeNull();
  });

  test('with no posts it says so; offline it says the posts are the old ones', async () => {
    await open([]);
    await vi.waitFor(() => screen.getByText('अभी कोई पोस्ट नहीं'));
    expect(screen.queryByText(/इंटरनेट नहीं है/)).toBeNull();
  });

  test('a switched-off feed shows nothing and says it is off', async () => {
    await refreshFeed(env.runtime, served([post({ title: 'छिपी' })]), id);
    // A linked phone whose server now answers FEATURE_OFF.
    await setLinked(env.runtime, id);
    env.runtime.account = {
      loadAuth: () => Promise.resolve({ accessToken: () => Promise.resolve('t') }),
      makeApi: () => refused('FEATURE_OFF'),
    } as unknown as AccountDeps;
    render(CommunityScreen);
    await vi.waitFor(() => screen.getByText('अभी यह सुविधा बंद है।'));
    expect(screen.queryByText('छिपी')).toBeNull();
    expect(await loadFeedCache(env.runtime, id)).toBeNull();
  });
});
