import { JSDOM } from 'jsdom';

// Extra cleanup specific to documentation sites
export function applyDocsNiche(dom: JSDOM): void {
  const { document } = dom.window;

  // Remove "On this page" / in-page TOC nav blocks
  const tocCandidates = [
    '[class*="on-this-page"]',
    '[class*="onThisPage"]',
    '[class*="table-of-contents"]',
    '[class*="tableOfContents"]',
    '.in-page-toc',
    '#table-of-contents',
  ];
  for (const sel of tocCandidates) {
    try {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    } catch {}
  }

  // Remove "Was this page helpful?" / feedback widgets
  const feedbackCandidates = [
    '[class*="feedback"]',
    '[class*="was-this-helpful"]',
    '[class*="page-feedback"]',
    '[class*="doc-feedback"]',
    '[class*="rating"]',
  ];
  for (const sel of feedbackCandidates) {
    try {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    } catch {}
  }

  // Remove version/tag badges that pollute headings
  document.querySelectorAll('[class*="badge"]').forEach((el) => {
    // Keep badges inside tables (they're meaningful param types)
    if (!el.closest('table')) el.remove();
  });

  // Unwrap details/summary elements so their content is visible
  document.querySelectorAll('details').forEach((details) => {
    const summary = details.querySelector('summary');
    if (summary) summary.remove(); // heading handled by the heading above
    // Move children out
    while (details.firstChild) {
      details.parentNode?.insertBefore(details.firstChild, details);
    }
    details.remove();
  });

  // Normalize inline code inside headings (strip any <code> wrapper keeping text)
  document.querySelectorAll('h1 code, h2 code, h3 code, h4 code, h5 code, h6 code').forEach((code) => {
    const text = document.createTextNode(`\`${code.textContent}\``);
    code.parentNode?.replaceChild(text, code);
  });
}
