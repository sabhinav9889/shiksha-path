import { randomUUID } from 'node:crypto';
import type { Auth, CodeAuth, CodeRepo, CodeRow } from '../ports.js';
import type { CodeFixture } from './code-contract.js';
import { makeMemoryRepos, type MemoryRepos } from './memory-repos.js';

const HOUR_S = 3600;
const MS = 1000;

/** Auth users and sessions in memory; a deleted user's tokens stop verifying at once. */
export function memoryAuth(): Auth & CodeAuth {
  const users = new Map<string, { email: string; password: string }>();
  const sessions = new Map<string, string>(); // token -> auth user
  return {
    verify: (token) => {
      const id = sessions.get(token);
      return Promise.resolve(id && users.has(id) ? { authUserId: id, provider: 'email' } : null);
    },
    createCodeUser(password) {
      const authUserId = randomUUID();
      const email = `code-${randomUUID()}@codes.invalid`;
      users.set(authUserId, { email, password });
      return Promise.resolve({ authUserId, email });
    },
    deleteUser(authUserId) {
      users.delete(authUserId);
      return Promise.resolve();
    },
    signInWithPassword(email, password) {
      const found = [...users].find(([, u]) => u.email === email && u.password === password);
      if (!found) return Promise.resolve(null);
      const accessToken = randomUUID();
      sessions.set(accessToken, found[0]);
      const expiresAt = Math.floor(Date.now() / MS) + HOUR_S;
      return Promise.resolve({ accessToken, refreshToken: randomUUID(), expiresAt });
    },
  };
}

export function memoryCodeRepo(repos: MemoryRepos): CodeRepo & { rows: Map<string, CodeRow> } {
  const rows = new Map<string, CodeRow>(); // learner -> code
  const identityOf = (learnerId: string): string | null =>
    [...repos.identities].find(([, l]) => l === learnerId)?.[0] ?? null;
  return {
    rows,
    findByLookup: (lookup) =>
      Promise.resolve([...rows.values()].find((r) => r.lookup === lookup) ?? null),
    forLearner: (learnerId) => Promise.resolve(rows.get(learnerId) ?? null),
    identityOf: (learnerId) => Promise.resolve(identityOf(learnerId)),
    async createLearnerWithCode(row) {
      await repos.learners.createLinked({
        id: row.learnerId,
        name: row.name,
        authUserId: row.authUserId,
      });
      rows.set(row.learnerId, { ...row });
    },
    addCode(row) {
      repos.identities.set(row.authUserId, row.learnerId);
      rows.set(row.learnerId, { ...row });
      return Promise.resolve();
    },
    replace(row) {
      const old = rows.get(row.learnerId);
      if (old) repos.identities.delete(old.authUserId);
      repos.identities.set(row.authUserId, row.learnerId);
      rows.set(row.learnerId, { ...row });
      return Promise.resolve();
    },
  };
}

const PEPPER = 'memory-test-pepper-0123456789abcdef';

export function makeMemoryCodeFixture(): CodeFixture {
  const repos = makeMemoryRepos();
  const codes = memoryCodeRepo(repos);
  return {
    deps: { ...repos, codes, auth: memoryAuth(), pepper: PEPPER },
    storedRow: (learnerId) =>
      Promise.resolve((codes.rows.get(learnerId) as Record<string, unknown> | undefined) ?? null),
    cleanup: () => Promise.resolve(),
  };
}
