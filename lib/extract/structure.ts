import type { CodeBlock, ExtractedStructure, ExtractedTable, Section } from './types';
import { slugify } from './utils';

function parseMarkdownTable(lines: string[]): ExtractedTable | null {
  // Must have at least header + separator
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] =>
    line
      .split('|')
      .slice(1, -1) // remove leading/trailing empty strings from pipes
      .map((c) => c.trim());

  const isSeparator = (line: string): boolean => /^\|[\s|:-]+\|$/.test(line);

  const headerLine = lines[0];
  const sepLine = lines[1];
  if (!isSeparator(sepLine)) return null;

  const headers = parseRow(headerLine);
  const rows = lines
    .slice(2)
    .filter((l) => l.trim().startsWith('|'))
    .map(parseRow);

  return { headers, rows };
}

function buildSectionTree(flatSections: Omit<Section, 'children'>[]): Section[] {
  const root: Section[] = [];
  const stack: Section[] = [];

  for (const flat of flatSections) {
    const sec: Section = { ...flat, children: [] };

    // Pop stack until we find a parent with lower level number
    while (stack.length > 0 && stack[stack.length - 1].level >= sec.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(sec);
    } else {
      stack[stack.length - 1].children.push(sec);
    }

    stack.push(sec);
  }

  return root;
}

export function parseStructure(
  markdown: string,
  opts: { title: string; description?: string }
): ExtractedStructure {
  const lines = markdown.split('\n');
  const codeBlocks: CodeBlock[] = [];
  const tables: ExtractedTable[] = [];
  const flatSections: Omit<Section, 'children'>[] = [];

  let i = 0;
  let inCodeBlock = false;
  let codeLang: string | null = null;
  const codeLines: string[] = [];
  let currentSectionIdx = -1;
  const sectionContents: string[][] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Toggle code block
    const fenceMatch = line.match(/^```(\w*)(.*)$/);
    if (fenceMatch && !inCodeBlock) {
      inCodeBlock = true;
      codeLang = fenceMatch[1] || null;
      codeLines.length = 0;
      i++;
      continue;
    }
    if (inCodeBlock && line.match(/^```\s*$/)) {
      inCodeBlock = false;
      codeBlocks.push({ language: codeLang, code: codeLines.join('\n') });
      codeLang = null;
      i++;
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Table detection: collect contiguous pipe-delimited lines
    if (line.trimStart().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const t = parseMarkdownTable(tableLines);
      if (t) tables.push(t);
      continue;
    }

    // Heading detection
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();
      const id = slugify(heading);

      currentSectionIdx = flatSections.length;
      flatSections.push({ id, level, heading, content: '' });
      sectionContents.push([]);
      i++;
      continue;
    }

    // Regular content — attach to current section
    if (currentSectionIdx >= 0 && line.trim() !== '') {
      sectionContents[currentSectionIdx].push(line);
    }

    i++;
  }

  // Attach accumulated content back to flat sections
  flatSections.forEach((sec, idx) => {
    (sec as Section).content = sectionContents[idx]?.join('\n').trim() ?? '';
  });

  return {
    title: opts.title,
    description: opts.description,
    sections: buildSectionTree(flatSections as Section[]),
    codeBlocks,
    tables,
  };
}
