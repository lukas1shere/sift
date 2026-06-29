import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { listSources } from '@/lib/sources';
import { SourcesClient } from './SourcesClient';

export default async function SourcesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const sources = await listSources(user.id).catch(() => []);
  return <SourcesClient sources={sources} />;
}
