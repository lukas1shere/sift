import { parseStructure } from './extract/structure';
import { sha256 } from './extract/utils';
import type { Section } from './extract/types';

export interface SectionChange {
  heading: string;
  id: string;
}

export interface ChangedSection extends SectionChange {
  before: string;
  after: string;
}

export interface SemanticDiff {
  hasChanges: boolean;
  added: SectionChange[];
  removed: SectionChange[];
  changed: ChangedSection[];
  changeSummary: string;
}

// Flatten section tree into a list (breadth-first order)
function flattenSections(sections: Section[]): Section[] {
  const out: Section[] = [];
  function walk(list: Section[]) {
    for (const s of list) {
      out.push(s);
      if (s.children.length > 0) walk(s.children);
    }
  }
  walk(sections);
  return out;
}

// Build a unique key for a section: level + heading slug
// We use heading text (not slug) to detect renames vs content changes
function sectionKey(s: Section): string {
  return `h${s.level}::${s.heading.toLowerCase().trim()}`;
}

function buildSummary(diff: Omit<SemanticDiff, 'hasChanges' | 'changeSummary'>): string {
  const parts: string[] = [];

  if (diff.changed.length > 0) {
    const names = diff.changed.map((s) => `"${s.heading}"`).join(', ');
    parts.push(`Updated: ${names}`);
  }
  if (diff.added.length > 0) {
    const names = diff.added.map((s) => `"${s.heading}"`).join(', ');
    parts.push(`Added: ${names}`);
  }
  if (diff.removed.length > 0) {
    const names = diff.removed.map((s) => `"${s.heading}"`).join(', ');
    parts.push(`Removed: ${names}`);
  }

  return parts.length > 0 ? parts.join('. ') : 'Content updated';
}

export function diffMarkdown(oldMarkdown: string, newMarkdown: string): SemanticDiff {
  // Fast path: identical content
  if (sha256(oldMarkdown) === sha256(newMarkdown)) {
    return {
      hasChanges: false,
      added: [],
      removed: [],
      changed: [],
      changeSummary: '',
    };
  }

  const oldStruct = parseStructure(oldMarkdown, { title: '' });
  const newStruct = parseStructure(newMarkdown, { title: '' });

  const oldFlat = flattenSections(oldStruct.sections);
  const newFlat = flattenSections(newStruct.sections);

  const oldMap = new Map(oldFlat.map((s) => [sectionKey(s), s]));
  const newMap = new Map(newFlat.map((s) => [sectionKey(s), s]));

  const added: SectionChange[] = [];
  const removed: SectionChange[] = [];
  const changed: ChangedSection[] = [];

  // Detect added and changed
  for (const [key, newSec] of newMap) {
    const oldSec = oldMap.get(key);
    if (!oldSec) {
      added.push({ heading: newSec.heading, id: newSec.id });
    } else if (sha256(oldSec.content) !== sha256(newSec.content)) {
      changed.push({
        heading: newSec.heading,
        id: newSec.id,
        before: oldSec.content,
        after: newSec.content,
      });
    }
  }

  // Detect removed
  for (const [key, oldSec] of oldMap) {
    if (!newMap.has(key)) {
      removed.push({ heading: oldSec.heading, id: oldSec.id });
    }
  }

  // If section analysis found nothing but content hashes differ,
  // the document has structural changes outside headed sections
  const hasStructuralChanges = added.length > 0 || removed.length > 0 || changed.length > 0;

  const summary = hasStructuralChanges
    ? buildSummary({ added, removed, changed })
    : 'Content updated (no section headings changed)';

  return {
    hasChanges: true,
    added,
    removed,
    changed,
    changeSummary: summary,
  };
}
