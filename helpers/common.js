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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Parse a date string in YYYY-MM-DD format into a Date object in the local timezone.
// Unlike `new Date("YYYY-MM-DD")` (which treats the string as UTC), this avoids
// inadvertent day shifts in non-UTC time-zones.
export const parseDateLocal = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};