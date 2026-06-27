import TurndownService from 'turndown';

function extractCodeLang(el: Element | null): string {
  if (!el) return '';

  // Standard: class="language-javascript" or class="lang-js"
  const cls = el.getAttribute('class') ?? '';
  const match = cls.match(/(?:language|lang)-(\w[\w-]*)/);
  if (match) return match[1];

  // data attributes
  const dataLang = el.getAttribute('data-language') ?? el.getAttribute('data-lang');
  if (dataLang) return dataLang;

  // Sphinx / ReadTheDocs: ancestor div has class="highlight-python"
  const highlightParent = el.closest?.('[class*="highlight-"]');
  if (highlightParent) {
    const m = (highlightParent.getAttribute('class') ?? '').match(/highlight-(\w+)/);
    if (m && m[1] !== 'default') return m[1];
  }

  return '';
}

function cellText(cell: Element): string {
  // Preserve inline code as backtick notation before stripping tags
  const html = cell.innerHTML.replace(
    /<code[^>]*>([\s\S]*?)<\/code>/g,
    (_m, inner: string) => '`' + inner.replace(/<[^>]+>/g, '') + '`'
  );
  const text = html.replace(/<[^>]+>/g, '').trim();
  return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

function buildTd(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
  });

  // Override code block rule to preserve language tags and exact content.
  // Match ALL <pre> elements — docs sites use many structures:
  //   <pre><code class="language-X">   (standard)
  //   <pre><span></span><code>         (Sphinx/RTD)
  //   <pre class="language-X">         (bare pre)
  td.addRule('fencedCodeBlock', {
    filter: ['pre'],
    replacement: (_content, node): string => {
      const pre = node as Element;
      const codeEl = pre.querySelector('code') ?? pre.querySelector('samp');
      // Try lang on codeEl first, then on pre itself (for bare <pre class="language-X">)
      const lang = extractCodeLang(codeEl) || extractCodeLang(pre);
      const raw = (codeEl ?? pre).textContent ?? '';
      const normalized = raw.replace(/\r\n/g, '\n').replace(/\n$/, '');
      return `\n\`\`\`${lang}\n${normalized}\n\`\`\`\n`;
    },
  });

  // GFM table rule
  td.addRule('table', {
    filter: ['table'],
    replacement: (_content, node): string => {
      const table = node as Element;
      const allRows = Array.from(table.querySelectorAll('tr'));
      if (allRows.length === 0) return '';

      const grid: string[][] = allRows.map((row) =>
        Array.from(row.querySelectorAll('th, td')).map(cellText)
      );

      const colCount = Math.max(...grid.map((r) => r.length));
      const pad = (r: string[]): string[] => {
        const out = [...r];
        while (out.length < colCount) out.push('');
        return out;
      };

      const header = pad(grid[0]);
      const separator = Array(colCount).fill('---');
      const dataRows = grid.slice(1);

      const lines = [
        '| ' + header.join(' | ') + ' |',
        '| ' + separator.join(' | ') + ' |',
        ...dataRows.map((r) => '| ' + pad(r).join(' | ') + ' |'),
      ];

      return '\n\n' + lines.join('\n') + '\n\n';
    },
  });

  // Skip table sub-elements (handled by the table rule above)
  td.addRule('tableCell', {
    filter: ['th', 'td', 'thead', 'tbody', 'tfoot', 'tr'],
    replacement: () => '',
  });

  // Inline code
  td.addRule('inlineCode', {
    filter: (node): boolean =>
      node.nodeName === 'CODE' && node.parentNode?.nodeName !== 'PRE',
    replacement: (_content, node): string => {
      const text = node.textContent ?? '';
      const tick = text.includes('`') ? '``' : '`';
      return `${tick}${text}${tick}`;
    },
  });

  return td;
}

// Normalize markdown for stable, diff-friendly output
function normalize(md: string): string {
  return (
    md
      // Consistent line endings
      .replace(/\r\n/g, '\n')
      // Collapse 3+ blank lines into 2
      .replace(/\n{3,}/g, '\n\n')
      // Trim trailing whitespace per line
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')
      // Single trailing newline
      .trimEnd() + '\n'
  );
}

export function htmlToMarkdown(html: string): string {
  const td = buildTd();
  const raw = td.turndown(html);
  return normalize(raw);
}
