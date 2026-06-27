import type { FetchResult } from './types';

const USER_AGENT =
  'Mozilla/5.0 (compatible; Sift/0.1; +https://sift.dev/bot)';

export async function renderPage(url: string): Promise<FetchResult> {
  // Dynamic import so Playwright is never bundled into the client
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      javaScriptEnabled: true,
    });
    const page = await context.newPage();

    // Block images / fonts / media to speed things up
    await page.route('**/*', (route) => {
      const rt = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(rt)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const resp = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    const status = resp?.status() ?? 200;

    // Wait a tick for any deferred rendering
    await page.waitForTimeout(500);

    const html = await page.content();
    const finalUrl = page.url();

    await context.close();

    return { html, finalUrl, status };
  } finally {
    await browser.close();
  }
}
