import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import { buildDOM, findMainContent, looksLikeShell, removeBoilerplate } from '@/lib/extract/clean';
import { applyDocsNiche } from '@/lib/extract/niche/docs';
import { htmlToMarkdown } from '@/lib/extract/markdown';
import { parseStructure } from '@/lib/extract/structure';
import { sha256, estimateTokens } from '@/lib/extract/utils';

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

// Full pipeline: HTML → markdown
function pipeline(html: string, url = 'https://docs.example.com/', docs = true): string {
  const dom = buildDOM(html, url);
  if (docs) applyDocsNiche(dom);
  removeBoilerplate(dom);
  const mainHtml = findMainContent(dom) ?? dom.window.document.body.innerHTML;
  return htmlToMarkdown(mainHtml);
}

// ─── Utility tests ───────────────────────────────────────────────────────────

describe('sha256', () => {
  it('returns a 64-char hex string', () => {
    expect(sha256('hello')).toHaveLength(64);
  });
  it('is deterministic', () => {
    expect(sha256('same input')).toBe(sha256('same input'));
  });
  it('differs for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('estimateTokens', () => {
  it('returns a positive number', () => {
    expect(estimateTokens('hello world')).toBeGreaterThan(0);
  });
  it('scales with text length', () => {
    expect(estimateTokens('a'.repeat(400))).toBeGreaterThan(estimateTokens('a'.repeat(40)));
  });
});

// ─── Shell detection ──────────────────────────────────────────────────────────

describe('looksLikeShell', () => {
  it('detects a JS-only SPA shell', () => {
    expect(looksLikeShell(fixture('js-shell.html'))).toBe(true);
  });
  it('does not flag a real HTML page as a shell', () => {
    expect(looksLikeShell(fixture('docusaurus.html'))).toBe(false);
  });
  it('does not flag the changelog as a shell', () => {
    expect(looksLikeShell(fixture('changelog.html'))).toBe(false);
  });
});

// ─── Boilerplate removal ──────────────────────────────────────────────────────

describe('removeBoilerplate', () => {
  it('strips nav elements', () => {
    const dom = buildDOM(fixture('docusaurus.html'), 'https://example.com/');
    removeBoilerplate(dom);
    expect(dom.window.document.querySelector('nav')).toBeNull();
  });

  it('strips footer', () => {
    const dom = buildDOM(fixture('article.html'), 'https://example.com/');
    removeBoilerplate(dom);
    expect(dom.window.document.querySelector('footer')).toBeNull();
  });

  it('strips cookie banner', () => {
    const dom = buildDOM(fixture('boilerplate-heavy.html'), 'https://example.com/');
    removeBoilerplate(dom);
    const body = dom.window.document.body.textContent ?? '';
    expect(body).not.toContain('We use cookies');
  });

  it('strips sidebar', () => {
    const dom = buildDOM(fixture('boilerplate-heavy.html'), 'https://example.com/');
    removeBoilerplate(dom);
    expect(dom.window.document.querySelector('.sidebar')).toBeNull();
  });
});

// ─── Docs niche ───────────────────────────────────────────────────────────────

describe('applyDocsNiche', () => {
  it('removes the on-this-page TOC', () => {
    const dom = buildDOM(fixture('boilerplate-heavy.html'), 'https://example.com/');
    applyDocsNiche(dom);
    const body = dom.window.document.body.textContent ?? '';
    expect(body).not.toContain('On this page');
  });

  it('removes feedback widgets', () => {
    const dom = buildDOM(fixture('boilerplate-heavy.html'), 'https://example.com/');
    applyDocsNiche(dom);
    const body = dom.window.document.body.textContent ?? '';
    expect(body).not.toContain('Was this page helpful');
  });
});

// ─── Markdown conversion ──────────────────────────────────────────────────────

describe('htmlToMarkdown - docusaurus fixture', () => {
  let md: string;
  beforeEach(() => { md = pipeline(fixture('docusaurus.html')); });

  it('preserves the main heading', () => {
    expect(md).toContain('# Installation');
  });

  it('preserves subheadings', () => {
    expect(md).toContain('## Prerequisites');
    expect(md).toContain('## Install the Package');
  });

  it('preserves code blocks with language tag', () => {
    expect(md).toContain('```bash');
    expect(md).toContain('```typescript');
  });

  it('preserves code content exactly', () => {
    expect(md).toContain('npm install @acme/sdk');
    expect(md).toContain("import { AcmeClient } from '@acme/sdk'");
  });

  it('renders the config table', () => {
    expect(md).toContain('| Option |');
    expect(md).toContain('| `apiKey`');
  });

  it('strips nav content', () => {
    expect(md).not.toMatch(/Acme Docs\s*\n.*Docs\s*\n.*API/);
    expect(md.toLowerCase()).not.toContain('edit this page');
  });

  it('strips cookie banner text', () => {
    expect(md).not.toContain('We use cookies');
  });

  it('is stable across repeated runs', () => {
    const md2 = pipeline(fixture('docusaurus.html'));
    expect(md).toBe(md2);
  });
});

describe('htmlToMarkdown - readme API fixture', () => {
  let md: string;
  beforeEach(() => { md = pipeline(fixture('readme-api.html')); });

  it('preserves the endpoint heading', () => {
    expect(md).toContain('# Create User');
  });

  it('preserves HTTP request code block', () => {
    expect(md).toContain('```http');
    expect(md).toContain('POST https://api.acme.dev/v1/users');
  });

  it('preserves the request body table', () => {
    expect(md).toContain('| Parameter |');
    expect(md).toContain('email');
  });

  it('preserves the error codes table', () => {
    expect(md).toContain('| Status |');
    expect(md).toContain('401');
  });

  it('is stable', () => {
    expect(md).toBe(pipeline(fixture('readme-api.html')));
  });
});

describe('htmlToMarkdown - changelog fixture', () => {
  let md: string;
  beforeEach(() => { md = pipeline(fixture('changelog.html')); });

  it('preserves version headings', () => {
    expect(md).toContain('v2.3.0');
    expect(md).toContain('v2.0.0');
  });

  it('preserves before/after code block', () => {
    expect(md).toContain('```typescript');
    expect(md).toContain('// Before (v1.x)');
  });

  it('is stable', () => {
    expect(md).toBe(pipeline(fixture('changelog.html')));
  });
});

describe('htmlToMarkdown - code heavy fixture', () => {
  let md: string;
  beforeEach(() => { md = pipeline(fixture('code-heavy.html')); });

  it('preserves all language tags', () => {
    expect(md).toContain('```javascript');
    expect(md).toContain('```python');
    expect(md).toContain('```bash');
    expect(md).toContain('```go');
  });

  it('preserves multi-line code blocks intact', () => {
    expect(md).toContain('package main');
    expect(md).toContain('import httpx');
  });

  it('is stable', () => {
    expect(md).toBe(pipeline(fixture('code-heavy.html')));
  });
});

describe('htmlToMarkdown - article fixture', () => {
  let md: string;
  beforeEach(() => { md = pipeline(fixture('article.html'), 'https://devinsights.example.com/'); });

  it('keeps article content', () => {
    expect(md).toContain('Vector databases');
    expect(md).toContain('HNSW');
  });

  it('strips sidebar / ads content', () => {
    expect(md).not.toContain('Popular Posts');
    expect(md).not.toContain('Advertisement');
  });

  it('strips social share buttons', () => {
    expect(md).not.toContain('Tweet');
  });

  it('strips comments section', () => {
    expect(md).not.toContain('Comments (12)');
  });

  it('is stable', () => {
    expect(md).toBe(pipeline(fixture('article.html'), 'https://devinsights.example.com/'));
  });
});

// ─── Structure / JSON parsing ─────────────────────────────────────────────────

describe('parseStructure', () => {
  it('extracts sections from headings', () => {
    const md = `# Top\n\nSome content here.\n\n## Sub\n\nMore content.`;
    const { sections } = parseStructure(md, { title: 'Top' });
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('Top');
    expect(sections[0].children).toHaveLength(1);
    expect(sections[0].children[0].heading).toBe('Sub');
  });

  it('extracts code blocks', () => {
    const md = `# Heading\n\n\`\`\`typescript\nconst x = 1;\n\`\`\``;
    const { codeBlocks } = parseStructure(md, { title: 'Test' });
    expect(codeBlocks).toHaveLength(1);
    expect(codeBlocks[0].language).toBe('typescript');
    expect(codeBlocks[0].code).toBe('const x = 1;');
  });

  it('extracts tables', () => {
    const md = `# Heading\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n`;
    const { tables } = parseStructure(md, { title: 'Test' });
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['A', 'B']);
    expect(tables[0].rows[0]).toEqual(['1', '2']);
  });

  it('handles empty markdown gracefully', () => {
    const result = parseStructure('', { title: 'Empty' });
    expect(result.sections).toEqual([]);
    expect(result.codeBlocks).toEqual([]);
    expect(result.tables).toEqual([]);
  });

  it('handles multiple code blocks with different languages', () => {
    const md = [
      '# Heading',
      '',
      '```python',
      'print("hello")',
      '```',
      '',
      '```javascript',
      'console.log("hello");',
      '```',
    ].join('\n');
    const { codeBlocks } = parseStructure(md, { title: 'Test' });
    expect(codeBlocks).toHaveLength(2);
    expect(codeBlocks[0].language).toBe('python');
    expect(codeBlocks[1].language).toBe('javascript');
  });
});
