/**
 * Formats a Date object into a readable time string with dynamic relative offset (e.g. "01:27:06 pm (11s ago)")
 */
export function formatLastFetched(date: Date | null): string {
  if (!date) return 'Not yet fetched';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (diffSec < 8) return `${timeStr} (Just now)`;
  if (diffSec < 60) return `${timeStr} (${diffSec}s ago)`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${timeStr} (${diffMin}m ago)`;
  return `${timeStr} (${date.toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
}
