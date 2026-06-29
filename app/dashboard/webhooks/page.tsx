import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { listWebhooks } from '@/lib/sources';
import { WebhooksClient } from './WebhooksClient';

export default async function WebhooksPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const webhooks = await listWebhooks(user.id).catch(() => []);
  return <WebhooksClient webhooks={webhooks} />;
}
