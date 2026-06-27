import type { FetchResult } from './types';

const USER_AGENT =
  'Mozilla/5.0 (compatible; Sift/0.1; +https://sift.dev/bot)';

const TIMEOUT_MS = 15_000;

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new FetchError(`Network error fetching ${url}: ${msg}`, undefined, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new FetchError(
      `HTTP ${response.status} fetching ${url}`,
      response.status,
      'HTTP_ERROR'
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new FetchError(
      `Unexpected content-type: ${contentType}`,
      response.status,
      'CONTENT_TYPE_ERROR'
    );
  }

  const html = await response.text();
  return { html, finalUrl: response.url, status: response.status };
}
