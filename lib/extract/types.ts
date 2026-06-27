export type Niche = 'docs' | 'auto';
export type RenderMode = 'fetch' | 'playwright' | 'auto';

export interface ExtractOptions {
  niche?: Niche;
  renderMode?: RenderMode;
}

export interface ExtractResult {
  url: string;
  title: string;
  description?: string;
  markdown: string;
  json: ExtractedStructure;
  contentHash: string;
  tokenCount: number;
  renderMode: 'fetch' | 'playwright';
  meta: Record<string, string>;
}

export interface ExtractedStructure {
  title: string;
  description?: string;
  sections: Section[];
  codeBlocks: CodeBlock[];
  tables: ExtractedTable[];
}

export interface Section {
  id: string;
  level: number;
  heading: string;
  content: string;
  children: Section[];
}

export interface CodeBlock {
  language: string | null;
  code: string;
}

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
}

export interface FetchResult {
  html: string;
  finalUrl: string;
  status: number;
}
