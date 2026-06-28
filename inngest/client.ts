import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'sift' });

// Event type map for type safety
export type Events = {
  'sift/source.crawl': { data: { sourceId: string } };
  'sift/source.changed': {
    data: {
      sourceId: string;
      userId: string;
      sourceUrl: string;
      changeSummary: string;
      diff: { added: string[]; removed: string[]; changed: string[] };
    };
  };
};
