import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { listApiKeys } from '@/lib/keys';
import { KeysClient } from './KeysClient';

export default async function KeysPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const keys = await listApiKeys(user.id).catch(() => []);
  return <KeysClient keys={keys} />;
}
