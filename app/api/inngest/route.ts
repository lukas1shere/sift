import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { crawlSource, dispatchDueSources, deliverWebhooks } from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [crawlSource, dispatchDueSources, deliverWebhooks],
});
