'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { createApiKey, revokeApiKey } from '@/lib/keys';

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createKeyAction(
  _prev: unknown,
  formData: FormData
): Promise<{ key: string; prefix: string; name: string } | { error: string }> {
  try {
    const user = await requireUser();
    const name = (formData.get('name') as string)?.slice(0, 64) || 'Default';
    const result = await createApiKey(user.id, name);
    revalidatePath('/dashboard/keys');
    return { key: result.key, prefix: result.keyPrefix, name: result.name };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create key' };
  }
}

export async function revokeKeyAction(keyId: string) {
  const user = await requireUser();
  await revokeApiKey(keyId, user.id);
  revalidatePath('/dashboard/keys');
}
