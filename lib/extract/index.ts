import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { ExtractOptions, ExtractResult, FetchResult } from './types';
import { buildDOM, findMainContent, looksLikeShell, removeBoilerplate } from './clean';
import { fetchPage, FetchError } from './fetch';
import { htmlToMarkdown } from './markdown';
import { applyDocsNiche } from './niche/docs';
import { parseStructure } from './structure';
import { estimateTokens, sha256 } from './utils';

export { FetchError } from './fetch';
export type { ExtractOptions, ExtractResult } from './types';

function extractMeta(document: Document): Record<string, string> {
  const meta: Record<string, string> = {};
  const get = (sel: string, attr = 'content'): string | undefined =>
    (document.querySelector(sel) as HTMLMetaElement | null)?.getAttribute(attr) ?? undefined;

  const candidates: Array<[string, string, string?]> = [
    ['description', 'meta[name="description"]'],
    ['description', 'meta[property="og:description"]'],
    ['author', 'meta[name="author"]'],
    ['publishedAt', 'meta[property="article:published_time"]'],
    ['modifiedAt', 'meta[property="article:modified_time"]'],
    ['language', 'html', 'lang'],
    ['siteName', 'meta[property="og:site_name"]'],
    ['canonical', 'link[rel="canonical"]', 'href'],
  ];

  for (const [key, sel, attr] of candidates) {
    if (meta[key]) continue; // first wins
    const val = get(sel, attr ?? 'content');
    if (val) meta[key] = val;
  }

  return meta;
}

function runReadability(dom: JSDOM): { title: string; content: string } | null {
  try {
    const reader = new Readability(dom.window.document.cloneNode(true) as Document);
    const article = reader.parse();
    if (!article || (article.textContent?.trim().length ?? 0) < 100) return null;
    return { title: article.title ?? '', content: article.content ?? '' };
  } catch {
    return null;
  }
}

async function getHTML(url: string, mode: 'fetch' | 'playwright' | 'auto'): Promise<{
  result: FetchResult;
  usedMode: 'fetch' | 'playwright';
}> {
  if (mode === 'playwright') {
    const { renderPage } = await import('./playwright');
    return { result: await renderPage(url), usedMode: 'playwright' };
  }

  if (mode === 'fetch') {
    return { result: await fetchPage(url), usedMode: 'fetch' };
  }

  // auto: try fetch first, fall back to playwright if it looks like a shell
  const fetched = await fetchPage(url);
  if (looksLikeShell(fetched.html)) {
    const { renderPage } = await import('./playwright');
    return { result: await renderPage(url), usedMode: 'playwright' };
  }
  return { result: fetched, usedMode: 'fetch' };
}

export async function extract(
  url: string,
  options: ExtractOptions = {}
): Promise<ExtractResult> {
  const { niche = 'auto', renderMode = 'auto' } = options;

  const { result, usedMode } = await getHTML(url, renderMode);
  const { html, finalUrl } = result;

  const dom = buildDOM(html, finalUrl);
  const meta = extractMeta(dom.window.document);

  // Niche-specific DOM tweaks before boilerplate removal
  if (niche === 'docs') {
    applyDocsNiche(dom);
  }

  // Try to find the main content container directly
  const mainHtml = findMainContent(dom);

  let articleHtml: string;
  let title: string;

  if (mainHtml) {
    // Wrap in a minimal document for Readability to work with
    const articleDom = new JSDOM(
      `<html><body><article>${mainHtml}</article></body></html>`,
      { url: finalUrl }
    );
    removeBoilerplate(articleDom);

    // Apply niche cleanup inside the extracted content too
    if (niche === 'docs') applyDocsNiche(articleDom);

    const parsed = runReadability(articleDom);
    articleHtml = parsed?.content ?? articleDom.window.document.body.innerHTML;
    title = parsed?.title || dom.window.document.title || new URL(finalUrl).hostname;
  } else {
    // Full-page readability pass
    removeBoilerplate(dom);
    if (niche === 'docs') applyDocsNiche(dom);

    const parsed = runReadability(dom);
    if (!parsed) {
      // Last resort: just convert body
      articleHtml = dom.window.document.body?.innerHTML ?? html;
      title = dom.window.document.title || new URL(finalUrl).hostname;
    } else {
      articleHtml = parsed.content;
      title = parsed.title;
    }
  }

  const markdown = htmlToMarkdown(articleHtml);
  const contentHash = sha256(markdown);
  const tokenCount = estimateTokens(markdown);
  const json = parseStructure(markdown, {
    title,
    description: meta.description,
  });

  return {
    url: finalUrl,
    title,
    description: meta.description,
    markdown,
    json,
    contentHash,
    tokenCount,
    renderMode: usedMode,
    meta,
  };
}
