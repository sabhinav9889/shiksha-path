import {
  checkDeleted,
  completeRecording,
  getBranding,
  getFeed,
  getProfile,
  getMe,
  linkLearner,
  pullEvents,
  pushEvents,
  issueCode,
  signInWithCode,
  startRecording,
  ApiFailure,
  type CodeAuth,
  handle,
  memoryLogger,
  type Auth,
  type CodeDeps,
  type HandlerDeps,
} from '@shiksha/server';
import { createStaffApi } from '../../src/staff/staff-api.js';
import type { StaffAuth } from '../../src/staff/staff-auth.js';
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
  /** The NGO deletes a student on request (the server side only). */
  deleteLearner(learnerId: string): Promise<void>;
  /** How many times phones asked which profiles were deleted. */
  deletedChecks(): number;
  /** The Google account (email) the next staff sign-in returns. */
  useStaffAccount(email: string): void;
  staffAuth: StaffAuth;
  /** A mentor issues a backup code: for a new student by name. */
  issueCode(name: string): Promise<{ learnerId: string; code: string }>;
  /** Make every upload to a signed URL fail (the network drops mid-upload). */
  failUploads(value: boolean): void;
  serverFor(googleAccount: string): ApiClient;
}

export function makeFakeBackend(): FakeBackend {
  const repos = makeMemoryRepos();
  const codes = repos.codes; // one code store, shared with the staff API handler
  // Code users sign in with a token equal to their auth user id, like the fake Google tokens.
  const codeUsers = new Map<string, { email: string; password: string }>();
  const codeAuth: CodeAuth = {
    createCodeUser: (password) => {
      const authUserId = crypto.randomUUID();
      const email = `code-${authUserId}@codes.invalid`;
      codeUsers.set(authUserId, { email, password });
      return Promise.resolve({ authUserId, email });
    },
    deleteUser: (id) => Promise.resolve(void codeUsers.delete(id)),
    emailOf: (id) => Promise.resolve(codeUsers.get(id)?.email ?? null),
    signInWithPassword: (email, password) => {
      const found = [...codeUsers].find(([, u]) => u.email === email && u.password === password);
      const session = found
        ? { accessToken: found[0], refreshToken: `r-${found[0]}`, expiresAt: 4_102_444_800 }
        : null;
      return Promise.resolve(session);
    },
  };
  // Reads the repos live (not a copy), so a test that swaps `repos.limiter` affects codes too.
  const codeDeps: CodeDeps = Object.assign(Object.create(repos) as typeof repos, {
    codes,
    auth: { verify: () => Promise.resolve(null), ...codeAuth },
    pepper: 'fake-backend-pepper-0123456789abcdef',
  });
  const sessions = new Map<string, string>(); // profileId -> Google account
  let nextGoogleAccount = 'google-1';
  let remembered: string | null = null;
  let online = true;
  let uploadsFail = false;
  let checks = 0;

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
        as((auth) =>
          linkLearner(repos, { authUserId: auth, provider: 'google', email: null }, body),
        ),
      push: (body) => as((auth) => pushEvents(repos, auth, body)),
      pull: ({ after }) => as((auth) => pullEvents(repos, auth, { after, limit: 500 })),
      me: () => as((auth) => getMe(repos, auth)),
      feed: () => as((auth) => getFeed(repos, auth)),
      profile: () =>
        as((auth) => getProfile(repos, { authUserId: auth, provider: 'google', email: auth })),
      startRecording: (body) => as((auth) => startRecording(repos, auth, body)),
      completeRecording: (body) => as((auth) => completeRecording(repos, auth, body)),
      codeSignIn: (body) => run(() => signInWithCode(codeDeps, body.code, 'phone-network')),
      branding: () => run(() => getBranding(repos)),
      deletedCheck: (body) => {
        checks += 1;
        return run(() => checkDeleted(repos, body.learnerIds, 'phone-network'));
      },
      uploadTo: (url, bytes) => {
        if (!online || uploadsFail) return Promise.resolve(false);
        const path = new URL(url).pathname.slice(1); // memory://upload/<learner>/<id>
        repos.storage.put(decodeURIComponent(path), bytes.length);
        return Promise.resolve(true);
      },
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
    adoptSession: (profileId, session) => {
      sessions.set(profileId, session.accessToken);
      return Promise.resolve();
    },
    moveSession: (from, to) => {
      const account = sessions.get(from);
      sessions.delete(from);
      if (account) sessions.set(to, account);
      return Promise.resolve();
    },
  };

  // Staff: the real /v1 handler over the same repositories, reached through a fake fetch.
  let pendingStaff: string | null = null;
  let staffToken: string | null = null;
  const verify: Auth['verify'] = (token) =>
    Promise.resolve(
      token.startsWith('staff:')
        ? { authUserId: `staff-${token.slice(6)}`, provider: 'google', email: token.slice(6) }
        : { authUserId: token, provider: 'google', email: null },
    );
  const handlerDeps = Object.assign(Object.create(repos) as typeof repos, {
    auth: { ...repos.auth, ...codeAuth, verify },
    allowedOrigins: [],
    logger: memoryLogger(),
  }) as unknown as HandlerDeps;
  const fetchFn = ((input: RequestInfo | URL, init?: RequestInit) =>
    online
      ? handle(new Request(input, init), handlerDeps)
      : Promise.reject(new TypeError('offline'))) as typeof fetch;
  const staffAuth: StaffAuth = {
    startSignIn: () => {
      staffToken = pendingStaff ? `staff:${pendingStaff}` : null;
      return Promise.resolve();
    },
    finish: () => Promise.resolve(staffToken !== null),
    token: () => Promise.resolve(staffToken),
    signOut: () => {
      staffToken = null;
      return Promise.resolve();
    },
    api: createStaffApi({
      baseUrl: 'https://fake',
      token: () => Promise.resolve(staffToken),
      fetchFn,
    }),
  };

  const account: AccountDeps = {
    loadAuth: () => Promise.resolve(google),
    makeApi,
    loadStaffAuth: () => Promise.resolve(staffAuth),
  };
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
    useStaffAccount(email: string) {
      pendingStaff = email;
    },
    staffAuth,
    issueCode: (name: string) => issueCode(codeDeps, { name }),
    deleteLearner: async (learnerId: string) => {
      await repos.data.deleteWithTombstone(learnerId);
    },
    deletedChecks: () => checks,
    failUploads(value: boolean) {
      uploadsFail = value;
    },
    /** A server-side API client for one Google account, to set up "another phone". */
    serverFor: (googleAccount: string) => makeApi(() => Promise.resolve(googleAccount)),
  };
}
