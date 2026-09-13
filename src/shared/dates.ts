// Даты храним строками YYYY-MM-DD в локальном времени — без часовых поясов.

const DAY = 86_400_000;

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const t = new Date(toUTC(iso) + Math.round(days) * DAY);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** b − a в днях */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY);
}

export function isISODate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s));
}

/** 2026-09-15 → 15.09 */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/** Возвращает понедельник недели для переданной даты */
export function getMonday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(iso, diff);
}

/** Возвращает массив из 7 дат (с понедельника по воскресенье) */
export function getWeekDays(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i));
}

/** 2026-09-14 → { short: 'Пн', num: '14' } */
export function getDayDisplay(iso: string): { short: string; num: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    short: WEEKDAY_SHORT[dt.getDay()],
    num: String(d),
  };
}

/** 14–20 сентября */
export function formatWeekRange(mondayIso: string): string {
  const sundayIso = addDays(mondayIso, 6);
  const [, m1, d1] = mondayIso.split('-').map(Number);
  const [, m2, d2] = sundayIso.split('-').map(Number);

  if (m1 === m2) {
    return `${d1}–${d2} ${MONTHS_GENITIVE[m1 - 1]}`;
  }
  return `${d1} ${MONTHS_GENITIVE[m1 - 1]} – ${d2} ${MONTHS_GENITIVE[m2 - 1]}`;
}
