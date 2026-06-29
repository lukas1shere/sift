'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import {
  createSource,
  updateSource,
  deleteSource,
  storeSnapshot,
  getLatestSnapshot,
  storeDiff,
  markSourceCrawled,
  getSource,
} from '@/lib/sources';
import { extract } from '@/lib/extract';
import { diffMarkdown } from '@/lib/diff';

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createSourceAction(formData: FormData) {
  const user = await requireUser();
  const url = formData.get('url') as string;
  const niche = (formData.get('niche') as string) || 'auto';
  const raw = formData.get('schedule_interval');
  const scheduleInterval = raw ? Number(raw) : null;

  await createSource(user.id, { url, niche, scheduleInterval });
  revalidatePath('/dashboard/sources');
}

export async function toggleSourceAction(sourceId: string, active: boolean) {
  const user = await requireUser();
  await updateSource(sourceId, user.id, { active });
  revalidatePath('/dashboard/sources');
}

export async function deleteSourceAction(sourceId: string) {
  const user = await requireUser();
  await deleteSource(sourceId, user.id);
  revalidatePath('/dashboard/sources');
}

export async function crawlNowAction(sourceId: string): Promise<{
  hasChanges: boolean;
  changeSummary: string | null;
  snapshotId: string;
  tokenCount: number;
}> {
  const user = await requireUser();
  const source = await getSource(sourceId, user.id);
  if (!source) throw new Error('Source not found');

  // Try Inngest; fall back to synchronous crawl for dev environments
  try {
    const { inngest } = await import('@/inngest/client');
    await inngest.send({ name: 'sift/source.crawl', data: { sourceId } });
    revalidatePath(`/dashboard/sources/${sourceId}`);
    return { hasChanges: false, changeSummary: null, snapshotId: '', tokenCount: 0 };
  } catch {
    // Synchronous fallback
    const result = await extract(source.url, {
      niche: source.niche as 'docs' | 'auto',
      renderMode: source.renderMode as 'fetch' | 'playwright' | 'auto',
    });

    const newSnapshot = await storeSnapshot(sourceId, result);
    const prevSnapshot = await getLatestSnapshot(sourceId, newSnapshot.id);

    let hasChanges = false;
    let changeSummary: string | null = null;

    if (prevSnapshot) {
      const diff = diffMarkdown(prevSnapshot.contentMarkdown, result.markdown);
      if (diff.hasChanges) {
        hasChanges = true;
        changeSummary = diff.changeSummary;
        await storeDiff(sourceId, prevSnapshot.id, newSnapshot.id, diff);
      }
    }

    await markSourceCrawled(sourceId, source.scheduleInterval);
    revalidatePath(`/dashboard/sources/${sourceId}`);
    revalidatePath('/dashboard/sources');

    return { hasChanges, changeSummary, snapshotId: newSnapshot.id, tokenCount: result.tokenCount };
  }
}
