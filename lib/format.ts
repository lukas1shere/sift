export function timeAgo(date: string | null | undefined): string {
  if (!date) return '—';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function timeUntil(date: string | null | undefined): string {
  if (!date) return '—';
  const s = Math.floor((new Date(date).getTime() - Date.now()) / 1000);
  if (s <= 0) return 'now';
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `in ${Math.floor(s / 3600)}h`;
  return `in ${Math.floor(s / 86400)}d`;
}

export function formatSchedule(seconds: number | null | undefined): string {
  if (!seconds) return 'One-time';
  if (seconds >= 86400) return seconds === 86400 ? 'Daily' : `Every ${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return seconds === 3600 ? 'Hourly' : `Every ${Math.round(seconds / 3600)}h`;
  return `Every ${Math.round(seconds / 60)}min`;
}

export function truncate(text: string, len: number): string {
  return text.length > len ? text.slice(0, len) + '…' : text;
}

export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}
