/**
 * Time utilities for friendly date formatting
 */

/**
 * Convert timestamp to "time ago" format
 * @example
 * formatTimeAgo(Date.now() - 5000) // "5 seconds ago"
 * formatTimeAgo(Date.now() - 120000) // "2 minutes ago"
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
  if (months > 0) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  if (weeks > 0) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  if (seconds > 5) {
    return `${seconds} seconds ago`;
  }

  return 'just now';
}
