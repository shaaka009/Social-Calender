const AVATAR_PALETTE = [
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#D1FAE5', fg: '#047857' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#FEE2E2', fg: '#B91C1C' },
  { bg: '#E0F2FE', fg: '#0369A1' },
  { bg: '#DCFCE7', fg: '#15803D' },
];

const hashString = (value) => {
  const input = String(value || '');
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getPersonInitials = (person = {}) => {
  const first = String(person.first_name || '').trim();
  const last = String(person.last_name || '').trim();
  const firstChar = first[0] || '';
  const lastChar = last[0] || '';
  const initials = `${firstChar}${lastChar}`.toUpperCase();
  if (initials) return initials;
  if (first[0]) return first[0].toUpperCase();
  if (last[0]) return last[0].toUpperCase();
  return '?';
};

export const getPersonAvatarColors = (person = {}) => {
  const seed = String(
    person.id
    || person.person_id
    || person.email
    || `${person.first_name || ''}-${person.last_name || ''}`
    || 'fallback'
  );
  const colorIndex = hashString(seed) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[colorIndex];
};
