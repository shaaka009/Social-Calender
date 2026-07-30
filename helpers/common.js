import { Dimensions } from "react-native";

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

export const hp = percentage => {
  return (percentage * deviceHeight) / 100;
}

export const wp = percentage => {
  return (percentage * deviceWidth) / 100;
}

export const formatDateLocal = (date) => {
  if (!date) return '';
  if (date.noYear) {
    return `0000-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Parse a date string in YYYY-MM-DD format into a Date object in the local timezone.
// Unlike `new Date("YYYY-MM-DD")` (which treats the string as UTC), this avoids
// inadvertent day shifts in non-UTC time-zones.
// Year 0000 means "month/day known, year unknown" (birthdays); JS would otherwise
// map year 0 → 1900.
export const parseDateLocal = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  const noYear = year === 0;
  // Use a leap year base so Feb 29 stays valid when the year is unknown.
  const date = new Date(noYear ? 2000 : year, month - 1, day, 0, 0, 0, 0);
  if (noYear) date.noYear = true;
  return date;
};

export const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  const date = parseDateLocal(dateStr);
  if (!date) return '';
  if (date.noYear) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/** Safely parse a fetch Response body as JSON (handles empty/HTML error pages). */
export async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
