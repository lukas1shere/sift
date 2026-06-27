import { createHash } from 'crypto';

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// cl100k_base approximation: ~4 chars per token (good enough for metering)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
