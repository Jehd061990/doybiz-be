/**
 * Parses a time string into minutes from midnight (0 - 1439).
 * Supports 24h ('14:00', '09:30') and 12h ('2:00 PM', '2:00pm', '09:30 AM').
 */
export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error('Invalid time format');
  }

  const clean = timeStr.trim();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!ampmMatch) {
    throw new Error('Time must be in HH:mm format (e.g. 14:00 or 02:00 PM)');
  }

  let hours = parseInt(ampmMatch[1], 10);
  const minutes = parseInt(ampmMatch[2], 10);
  const period = ampmMatch[3]?.toLowerCase();

  if (minutes < 0 || minutes > 59) {
    throw new Error('Invalid minutes in time');
  }

  if (period) {
    if (hours < 1 || hours > 12) {
      throw new Error('Invalid hours for 12-hour format');
    }
    if (period === 'pm' && hours < 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
  } else {
    if (hours < 0 || hours > 23) {
      throw new Error('Invalid hours in time (00-23)');
    }
  }

  return hours * 60 + minutes;
};

/**
 * Formats minutes from midnight into 24h 'HH:mm' string.
 */
export const formatMinutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Standardizes time input to 24h 'HH:mm' string.
 */
export const normalizeTime = (timeStr: string): string => {
  const mins = parseTimeToMinutes(timeStr);
  return formatMinutesToTime(mins);
};

/**
 * Checks if two time intervals overlap on the same date.
 * [start1, start1 + duration1) and [start2, start2 + duration2)
 */
export const isTimeOverlapping = (
  startMinutes1: number,
  durationMinutes1: number,
  startMinutes2: number,
  durationMinutes2: number
): boolean => {
  const end1 = startMinutes1 + durationMinutes1;
  const end2 = startMinutes2 + durationMinutes2;
  return startMinutes1 < end2 && end1 > startMinutes2;
};

/**
 * Validates YYYY-MM-DD date format.
 */
export const isValidDateString = (dateStr: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
};
