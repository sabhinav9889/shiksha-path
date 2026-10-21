import { describe, expect, test } from 'vitest';
import { deleteUser, localStack, makeUser } from '../../../supabase/tests/stack.js';
import { createSupabaseAuth } from '../src/adapters/supabase-auth.js';

describe('the Supabase Auth adapter', () => {
  const auth = () => createSupabaseAuth(localStack().apiUrl, localStack().serviceKey);

  test("verifies each user's own token", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    expect(await auth().verify(a.accessToken)).toEqual({ authUserId: a.id });
    expect(await auth().verify(b.accessToken)).toEqual({ authUserId: b.id });
    await deleteUser(a.id);
    await deleteUser(b.id);
  });

  test('refuses a garbage token and the token of a deleted user', async () => {
    expect(await auth().verify('garbage')).toBeNull();
    const user = await makeUser();
    await deleteUser(user.id);
    expect(await auth().verify(user.accessToken)).toBeNull();
  });
});
