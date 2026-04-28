/**
 * Tiny relative-time helper — no external dependency.
 * "2m ago" | "Yesterday at 3:14pm" | "Mar 15"
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) return `${diffHr}h ago`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate();
  if (isYesterday) {
    const t = then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    return `Yesterday at ${t}`;
  }

  if (now.getFullYear() === then.getFullYear()) {
    return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return then.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}
