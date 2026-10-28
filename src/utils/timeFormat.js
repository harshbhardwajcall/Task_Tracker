/**
 * Time and Duration Formatting Utilities for Tasks
 */

/**
 * Formats a completed timestamp or date string into human readable format:
 * e.g., "Oct 28, 2026, 4:15 PM" or "Oct 28, 2026"
 */
export function formatCompletionTime(dateStr) {
  if (!dateStr) return '';
  try {
    const str = String(dateStr).trim();
    // Normalize SQL datetime string (replace space with T for Safari/cross-browser compatibility)
    const normalized = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      return str;
    }

    // Check if the input contains a time component
    const hasTime = str.includes(':');

    if (!hasTime) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Calculates and formats the total time taken to complete a task.
 * Returns human-friendly string like "25 mins", "1h 45m", "2d 5h", etc.
 */
export function formatTotalDuration(task) {
  if (!task) return null;

  // 1. If explicit completion_duration_hours is stored and > 0
  if (
    task.completion_duration_hours !== undefined &&
    task.completion_duration_hours !== null &&
    Number(task.completion_duration_hours) > 0
  ) {
    const totalMinutes = Math.round(Number(task.completion_duration_hours) * 60);
    return formatMinutesToReadable(totalMinutes);
  }

  // 2. Compute from start and end points
  const endPoint = task.completed_at || task.completed_date;
  if (!endPoint) return null;

  const startPoint = task.started_at || task.created_at || task.start_date || task.assigned_date;
  if (!startPoint) return null;

  try {
    const startStr = String(startPoint).trim();
    const endStr = String(endPoint).trim();

    const startNorm = startStr.includes(' ') && !startStr.includes('T') ? startStr.replace(' ', 'T') : startStr;
    const endNorm = endStr.includes(' ') && !endStr.includes('T') ? endStr.replace(' ', 'T') : endStr;

    const start = new Date(startNorm);
    const end = new Date(endNorm);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '< 1 min';

    const totalMinutes = Math.round(diffMs / (1000 * 60));
    return formatMinutesToReadable(totalMinutes);
  } catch (e) {
    return null;
  }
}

function formatMinutesToReadable(totalMinutes) {
  if (totalMinutes <= 0) return '< 1 min';
  if (totalMinutes < 60) {
    return `${totalMinutes} min${totalMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
