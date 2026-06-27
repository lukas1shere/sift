import { JSDOM, VirtualConsole } from 'jsdom';

// Removed unconditionally before extraction
const JUNK_SELECTORS = [
  'script', 'style', 'noscript', 'link[rel="stylesheet"]',
  // Site chrome
  'nav', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  'footer', 'header:not(article header):not(section header)',
  // Sidebars
  'aside', '[role="complementary"]',
  '[class*="sidebar"]', '[id*="sidebar"]',
  '[class*="toc-"]', '[class*="-toc"]', '[id*="toc"]',
  '[class*="table-of-contents"]',
  // Cookie / consent
  '[class*="cookie"]', '[id*="cookie"]',
  '[class*="consent"]', '[id*="consent"]',
  '[class*="gdpr"]', '[class*="privacy-banner"]',
  // Ads / promos
  '[class*="banner"]', '[class*="promo"]', '[class*="announcement"]',
  // Social / share
  '[class*="share"]', '[class*="social-links"]',
  '[class*="follow"]',
  // Edit / feedback links (common in doc sites)
  '[class*="edit-page"]', '[class*="edit-on-github"]',
  'a[href*="edit"]',
  // Pagination chrome (keep content, remove nav)
  '[class*="pagination"]', '[class*="prev-next"]',
  // Search
  '[class*="search-box"]', '[class*="search-bar"]', '[type="search"]',
  // Skip-to links
  '[class*="skip-to"]', '.sr-only',
];

export function buildDOM(html: string, url: string): JSDOM {
  const vc = new VirtualConsole(); // suppress jsdom noise
  return new JSDOM(html, { url, virtualConsole: vc });
}

export function removeBoilerplate(dom: JSDOM): void {
  const { document } = dom.window;
  for (const sel of JUNK_SELECTORS) {
    try {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    } catch {
      // Some selectors are complex and jsdom may reject them; skip quietly
    }
  }
}

// Returns the outer HTML of the best content element found, or null to fall back to Readability
export function findMainContent(dom: JSDOM): string | null {
  const { document } = dom.window;

  // Ordered from most to least specific
  const CONTENT_SELECTORS = [
    // Docusaurus
    '.theme-doc-markdown',
    '.docItemContainer article',
    '.docMainContainer',
    // Mintlify
    '[class*="content-container"] .prose',
    '.prose',
    // ReadMe
    '.hub-content',
    '.markdown-body',
    // GitBook
    '[data-testid="page.contentEditor"]',
    '.gitbook-markdown-body',
    // Sphinx / ReadTheDocs
    '.rst-content .section',
    '.rst-content',
    '.body-text',
    // MkDocs Material
    '.md-content article',
    '.md-content',
    // Generic
    'article[role="main"]',
    '[role="main"]',
    'main article',
    'main',
    '#content',
    '.content',
    '#main-content',
    '.main-content',
  ];

  for (const sel of CONTENT_SELECTORS) {
    try {
      const el = document.querySelector(sel);
      if (el && (el.textContent?.trim().length ?? 0) > 200) {
        return el.outerHTML;
      }
    } catch {
      // skip bad selectors
    }
  }

  return null;
}

// Detect whether the fetched HTML looks like a JS-only shell (needs Playwright)
export function looksLikeShell(html: string): boolean {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return true;

  const bodyContent = bodyMatch[1];

  // Strip all tags to get raw text
  const text = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Under 150 chars of text → almost certainly a shell
  if (text.length < 150) return true;

  // SPA root divs with no children
  if (/<div\s+id=["'](?:root|app)["']\s*>\s*<\/div>/i.test(bodyContent)) return true;

  return false;
}
