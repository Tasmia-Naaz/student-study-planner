export const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayStr = () => fmtDate(new Date());
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};
export const addMonths = (s, n) => {
  const d = parseDate(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return fmtDate(d);
};
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export const dayOfWeek = (s) => parseDate(s).getDay();
export const startOfWeek = (s) => {
  const d = parseDate(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return fmtDate(d);
};
export const monthStart = (s) => s.slice(0, 8) + '01';
export const rangeDays = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i));

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const niceDate = (s) =>
  parseDate(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const shortDate = (s) => parseDate(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const toHHMM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const durMin = (s) => toMin(s.end) - toMin(s.start);
export const fmtHours = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};
export const hoursNum = (mins) => Math.round((mins / 60) * 10) / 10;

/**
 * Format a 24-hour time string ("HH:MM") into 12-hour AM/PM format by default
 * or preserve 24-hour format if requested.
 */
export const fmtTime = (t, format = '12h') => {
  if (!t) return '';
  const parts = String(t).split(':');
  if (parts.length < 2) return t;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return t;

  if (format === '24h') {
    return `${pad(h)}:${pad(m)}`;
  }

  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // 0 -> 12
  return `${h}:${pad(m)} ${ampm}`;
};

export const fmtTimeRange = (start, end, format = '12h') => {
  if (!start) return '';
  if (!end) return fmtTime(start, format);
  return `${fmtTime(start, format)} – ${fmtTime(end, format)}`;
};

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
