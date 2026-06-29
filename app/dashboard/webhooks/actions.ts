'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { createWebhook, deleteWebhook } from '@/lib/sources';

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createWebhookAction(
  _prev: unknown,
  formData: FormData
): Promise<{ id: string; secret: string } | { error: string }> {
  try {
    const user = await requireUser();
    const url = formData.get('url') as string;
    const events = ['source.changed']; // always include; more options in future
    const result = await createWebhook(user.id, url, events);
    revalidatePath('/dashboard/webhooks');
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create webhook' };
  }
}

export async function deleteWebhookAction(webhookId: string) {
  const user = await requireUser();
  await deleteWebhook(webhookId, user.id);
  revalidatePath('/dashboard/webhooks');
}
