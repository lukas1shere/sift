import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { getSource } from '@/lib/sources';
import { inngest } from '@/inngest/client';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req).catch(() => null);
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or missing API key', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  const { id } = await params;
  const source = await getSource(id, auth.userId).catch(() => null);
  if (!source) {
    return NextResponse.json({ error: 'Source not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    await inngest.send({ name: 'sift/source.crawl', data: { sourceId: id } });
    return NextResponse.json({ queued: true, sourceId: id });
  } catch (err) {
    // If Inngest is not configured, fall back to a direct (synchronous) crawl for dev convenience
    const { extract } = await import('@/lib/extract');
    const { diffMarkdown } = await import('@/lib/diff');
    const { storeSnapshot, getLatestSnapshot, storeDiff, markSourceCrawled } = await import('@/lib/sources');

    const result = await extract(source.url, {
      niche: source.niche as 'docs' | 'auto',
      renderMode: source.renderMode as 'fetch' | 'playwright' | 'auto',
    });

    const newSnapshot = await storeSnapshot(id, result);
    const prevSnapshot = await getLatestSnapshot(id, newSnapshot.id);

    let diff = null;
    if (prevSnapshot) {
      const d = diffMarkdown(prevSnapshot.contentMarkdown, result.markdown);
      if (d.hasChanges) {
        diff = await storeDiff(id, prevSnapshot.id, newSnapshot.id, d);
      }
    }

    await markSourceCrawled(id, source.scheduleInterval);

    return NextResponse.json({
      queued: false,
      synchronous: true,
      snapshotId: newSnapshot.id,
      contentHash: result.contentHash,
      tokenCount: result.tokenCount,
      hasChanges: !!diff,
      changeSummary: diff?.changeSummary ?? null,
    });
  }
}
