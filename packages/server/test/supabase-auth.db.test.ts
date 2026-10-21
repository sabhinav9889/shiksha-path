import { describe, expect, test } from 'vitest';
import { deleteUser, localStack, makeUser } from '../../../supabase/tests/stack.js';
import { createSupabaseAuth } from '../src/adapters/supabase-auth.js';

describe('the Supabase Auth adapter', () => {
  const auth = () => createSupabaseAuth(localStack().apiUrl, localStack().serviceKey);

  test("verifies each user's own token", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    expect(await auth().verify(a.accessToken)).toEqual({ authUserId: a.id, provider: 'google' });
    expect(await auth().verify(b.accessToken)).toEqual({ authUserId: b.id, provider: 'google' });
    await deleteUser(a.id);
    await deleteUser(b.id);
  });

  test('reports a plain email user as an email sign-in', async () => {
    const user = await makeUser('email');
    expect(await auth().verify(user.accessToken)).toEqual({
      authUserId: user.id,
      provider: 'email',
    });
    await deleteUser(user.id);
  });

  test('refuses a garbage token and the token of a deleted user', async () => {
    expect(await auth().verify('garbage')).toBeNull();
    const user = await makeUser();
    await deleteUser(user.id);
    expect(await auth().verify(user.accessToken)).toBeNull();
  });
});
