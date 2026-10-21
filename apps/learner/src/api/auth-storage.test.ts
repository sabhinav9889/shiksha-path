import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { ShikshaDb } from '../storage/db.js';
import { IdbAuthStorage } from './auth-storage.js';

let counter = 0;
const freshDb = (): ShikshaDb => new ShikshaDb(`auth-test-${counter++}`);

describe('IdbAuthStorage', () => {
  test('keeps a sign-in session per profile', async () => {
    const db = freshDb();
    const a = new IdbAuthStorage(db, 'profile-a');
    const b = new IdbAuthStorage(db, 'profile-b');
    expect(await a.getItem('sb-auth-token')).toBeNull();
    await a.setItem('sb-auth-token', 'session-a');
    await b.setItem('sb-auth-token', 'session-b');
    expect(await a.getItem('sb-auth-token')).toBe('session-a');
    expect(await b.getItem('sb-auth-token')).toBe('session-b');
    await a.removeItem('sb-auth-token');
    expect(await a.getItem('sb-auth-token')).toBeNull();
    expect(await b.getItem('sb-auth-token')).toBe('session-b');
  });

  test('survives closing and reopening the database (version 3 keeps older data)', async () => {
    const name = `auth-test-${counter++}`;
    const first = new ShikshaDb(name);
    await new IdbAuthStorage(first, 'p').setItem('k', 'v');
    await first.meta.put({ key: 'm', value: '1' });
    first.close();
    const again = new ShikshaDb(name);
    expect(await new IdbAuthStorage(again, 'p').getItem('k')).toBe('v');
    expect((await again.meta.get('m'))?.value).toBe('1');
  });
});
