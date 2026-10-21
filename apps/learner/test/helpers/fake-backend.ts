import { getMe, linkLearner, pullEvents, pushEvents, ApiFailure } from '@shiksha/server';
import { makeMemoryRepos } from '@shiksha/server/testing';
import type { ApiClient, ApiResult } from '../../src/api/api-client.js';
import type { GoogleAuth } from '../../src/api/auth.js';
import type { AccountDeps } from '../../src/account/account.js';

/**
 * The real /v1 services over in-memory repositories, plus a fake Google: a test chooses which
 * Google account the next sign-in returns. Tokens are simply the Google account's id.
 */
export interface FakeBackend {
  account: AccountDeps;
  repos: ReturnType<typeof makeMemoryRepos>;
  google: GoogleAuth;
  sessions: Map<string, string>;
  useGoogleAccount(id: string): void;
  setOnline(value: boolean): void;
  serverFor(googleAccount: string): ApiClient;
}

export function makeFakeBackend(): FakeBackend {
  const repos = makeMemoryRepos();
  const sessions = new Map<string, string>(); // profileId -> Google account
  let nextGoogleAccount = 'google-1';
  let remembered: string | null = null;
  let online = true;

  const run = async <T>(work: () => Promise<T>): Promise<ApiResult<T>> => {
    if (!online) return { ok: false, error: 'OFFLINE' };
    try {
      return { ok: true, value: await work() };
    } catch (error) {
      return { ok: false, error: error instanceof ApiFailure ? error.code : 'INTERNAL' };
    }
  };

  const makeApi = (token: () => Promise<string | null>): ApiClient => {
    const as = async <T>(work: (auth: string) => Promise<T>): Promise<ApiResult<T>> => {
      const auth = await token();
      if (!auth) return { ok: false, error: 'UNAUTHENTICATED' };
      return run(() => work(auth));
    };
    return {
      link: (body) =>
        as((auth) => linkLearner(repos, { authUserId: auth, provider: 'google' }, body)),
      push: (body) => as((auth) => pushEvents(repos, auth, body)),
      pull: ({ after }) => as((auth) => pullEvents(repos, auth, { after, limit: 500 })),
      me: () => as((auth) => getMe(repos, auth)),
    };
  };

  const google: GoogleAuth = {
    startGoogleSignIn: (profileId) => {
      remembered = profileId;
      return Promise.resolve();
    },
    finishGoogleSignIn: () => {
      const profileId = remembered;
      remembered = null;
      if (!profileId) return Promise.resolve(null);
      sessions.set(profileId, nextGoogleAccount);
      return Promise.resolve({ profileId });
    },
    accessToken: (profileId) => Promise.resolve(sessions.get(profileId) ?? null),
    signOutGoogle: (profileId) => {
      sessions.delete(profileId);
      return Promise.resolve();
    },
    moveSession: (from, to) => {
      const account = sessions.get(from);
      sessions.delete(from);
      if (account) sessions.set(to, account);
      return Promise.resolve();
    },
  };

  const account: AccountDeps = { loadAuth: () => Promise.resolve(google), makeApi };
  return {
    account,
    repos,
    google,
    sessions,
    /** The Google account the next sign-in will return. */
    useGoogleAccount(id: string) {
      nextGoogleAccount = id;
    },
    setOnline(value: boolean) {
      online = value;
    },
    /** A server-side API client for one Google account, to set up "another phone". */
    serverFor: (googleAccount: string) => makeApi(() => Promise.resolve(googleAccount)),
  };
}
