export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ZODIAC = [
  ['Capricorn', [12, 22], [1, 19]],
  ['Aquarius', [1, 20], [2, 18]],
  ['Pisces', [2, 19], [3, 20]],
  ['Aries', [3, 21], [4, 19]],
  ['Taurus', [4, 20], [5, 20]],
  ['Gemini', [5, 21], [6, 20]],
  ['Cancer', [6, 21], [7, 22]],
  ['Leo', [7, 23], [8, 22]],
  ['Virgo', [8, 23], [9, 22]],
  ['Libra', [9, 23], [10, 22]],
  ['Scorpio', [10, 23], [11, 21]],
  ['Sagittarius', [11, 22], [12, 21]],
];
export const SEASONS_NORTH = [
  { name: 'Winter', emoji: '❄️', months: [12, 1, 2] },
  { name: 'Spring', emoji: '🌸', months: [3, 4, 5] },
  { name: 'Summer', emoji: '☀️', months: [6, 7, 8] },
  { name: 'Autumn', emoji: '🍂', months: [9, 10, 11] },
];
export function parseDate(str) {
  if (!str) return new Date();
  const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) throw new Error(`Invalid date format "${str}". Use YYYY-MM-DD (e.g. "2025-06-15").`);
  const d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${str}`);
  return d;
}
export function formatDate(d) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isLeapYear(year) {
  return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}
export function getZodiac(month, day) {
  for (const [sign, [sm, sd], [em, ed]] of ZODIAC)
    if ((month === sm && day >= sd) || (month === em && day <= ed)) return sign;
  return 'Capricorn';
}
export function getDayNumber(d) {
  const start = new Date(d.getFullYear(), 0, 0),
    diff = d - start;
  return Math.floor(diff / 864e5);
}
export function getWeekNumber(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((getDayNumber(d) + jan1.getDay()) / 7);
}
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
export function localToUTC(dateStr, timeStr, timezone) {
  const [y, mo, d] = dateStr.split('-').map(Number),
    [hh, mm] = (timeStr || '00:00').split(':').map(Number),
    approxUtc = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0)),
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !1,
    }).formatToParts(approxUtc),
    get = (t) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10),
    offset =
      Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second'),
      ) - approxUtc.getTime();
  return new Date(approxUtc.getTime() - offset);
}
export function formatInTimezone(utcDate, timezone, opts = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: !0,
    ...opts,
  }).format(utcDate);
}
export function countBusinessDays(d1, d2) {
  const start = new Date(Math.min(d1, d2)),
    end = new Date(Math.max(d1, d2));
  (start.setHours(0, 0, 0, 0), end.setHours(0, 0, 0, 0));
  let count = 0;
  const cur = new Date(start);
  for (; cur <= end; ) {
    const dow = cur.getDay();
    (0 !== dow && 6 !== dow && count++, cur.setDate(cur.getDate() + 1));
  }
  return count;
}
export function addBusinessDaysToDate(d, amount) {
  const result = new Date(d),
    sign = amount >= 0 ? 1 : -1;
  let remaining = Math.abs(Math.round(amount));
  for (; remaining > 0; )
    (result.setDate(result.getDate() + sign),
      0 !== result.getDay() && 6 !== result.getDay() && remaining--);
  return result;
}
export function getLunarPhase(date) {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z'),
    phase =
      ((((date.getTime() - knownNewMoon.getTime()) / 864e5) % 29.53059) + 29.53059) % 29.53059;
  let phaseName, emoji;
  phase < 1.85
    ? ((phaseName = 'New Moon'), (emoji = '🌑'))
    : phase < 7.38
      ? ((phaseName = 'Waxing Crescent'), (emoji = '🌒'))
      : phase < 9.22
        ? ((phaseName = 'First Quarter'), (emoji = '🌓'))
        : phase < 14.77
          ? ((phaseName = 'Waxing Gibbous'), (emoji = '🌔'))
          : phase < 16.61
            ? ((phaseName = 'Full Moon'), (emoji = '🌕'))
            : phase < 22.15
              ? ((phaseName = 'Waning Gibbous'), (emoji = '🌖'))
              : phase < 23.99
                ? ((phaseName = 'Last Quarter'), (emoji = '🌗'))
                : ((phaseName = 'Waning Crescent'), (emoji = '🌘'));
  const illumination = Math.round(50 * (1 - Math.cos((phase / 29.53059) * 2 * Math.PI))),
    daysUntilFull =
      phase < 14.77 ? (14.77 - phase).toFixed(1) : (29.53059 - phase + 14.77).toFixed(1);
  return {
    phaseName: phaseName,
    emoji: emoji,
    phase: phase.toFixed(2),
    illumination: illumination,
    daysUntilFull: daysUntilFull,
  };
}
export function detailedDiff(d1, d2) {
  const start = new Date(Math.min(d1, d2)),
    end = new Date(Math.max(d1, d2));
  let years = end.getFullYear() - start.getFullYear(),
    months = end.getMonth() - start.getMonth(),
    days = end.getDate() - start.getDate();
  (days < 0 && (months--, (days += new Date(end.getFullYear(), end.getMonth(), 0).getDate())),
    months < 0 && (years--, (months += 12)));
  const totalDays = Math.round(Math.abs(end - start) / 864e5),
    totalHours = 24 * totalDays;
  return {
    years: years,
    months: months,
    days: days,
    totalDays: totalDays,
    totalWeeks: (totalDays / 7).toFixed(1),
    totalHours: totalHours,
    totalMinutes: 60 * totalHours,
  };
}
export function getNthWeekdayOfMonth(year, month, nth, weekdayName) {
  const targetDay = DAYS.indexOf(weekdayName);
  if (-1 === targetDay)
    throw new Error(`Unknown weekday "${weekdayName}". Use Monday, Tuesday, etc.`);
  if (-1 === nth) {
    const lastDay = new Date(year, month, 0);
    for (; lastDay.getDay() !== targetDay; ) lastDay.setDate(lastDay.getDate() - 1);
    return lastDay;
  }
  const offset = (targetDay - new Date(year, month - 1, 1).getDay() + 7) % 7,
    result = new Date(year, month - 1, 1 + offset + 7 * (nth - 1));
  if (result.getMonth() !== month - 1)
    throw new Error(`There is no ${nth}th ${weekdayName} in that month.`);
  return result;
}
