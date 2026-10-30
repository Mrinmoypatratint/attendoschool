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

/**
 * Capitalizes the first letter of each word in a string (e.g. "aarav" -> "Aarav")
 */
export function capitalizeWord(word: string): string {
  if (!word) return '';
  const trimmed = word.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Formats first, middle, and last names into a capitalized Full Name
 * where the first letter of each name part is capitalized (e.g. "aarav", "kumar", "sharma" -> "Aarav Kumar Sharma")
 */
export function formatCapitalizedName(first?: string, middle?: string, last?: string): string {
  const parts = [first, middle, last].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  return parts
    .map(p => p.split(/\s+/).map(capitalizeWord).join(' '))
    .join(' ');
}


/**
 * Formats first, middle, and last names into all uppercase Full Name for students
 */
export function formatStudentFullName(first?: string, middle?: string, last?: string): string {
  const parts = [first, middle, last].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').toUpperCase();
}