import { createExecutor } from '../Shared/createExecutor.js';
import { toolsList } from './ToolsList.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
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

// Astronomical season start months for Northern hemisphere (approx.)
const SEASONS_NORTH = [
  { name: 'Winter', emoji: '❄️', months: [12, 1, 2] },
  { name: 'Spring', emoji: '🌸', months: [3, 4, 5] },
  { name: 'Summer', emoji: '☀️', months: [6, 7, 8] },
  { name: 'Autumn', emoji: '🍂', months: [9, 10, 11] },
];

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return new Date();
  const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) throw new Error(`Invalid date format "${str}". Use YYYY-MM-DD (e.g. "2025-06-15").`);
  const d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${str}`);
  return d;
}

function formatDate(d) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getZodiac(month, day) {
  for (const [sign, [sm, sd], [em, ed]] of ZODIAC) {
    if ((month === sm && day >= sd) || (month === em && day <= ed)) return sign;
  }
  return 'Capricorn';
}

function getDayNumber(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86_400_000);
}

function getWeekNumber(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((getDayNumber(d) + jan1.getDay()) / 7);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-based here
}

/** Get the UTC equivalent of a local time expressed in a given IANA timezone. */
function localToUTC(dateStr, timeStr, timezone) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const approxUtc = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
  // Get what local time the timezone shows at this approximate UTC
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(approxUtc);
  const get = (t) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
  const localMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  const offset = localMs - approxUtc.getTime();
  return new Date(approxUtc.getTime() - offset);
}

/** Format a UTC instant as local time in the given IANA timezone. */
function formatInTimezone(utcDate, timezone, opts = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...opts,
  }).format(utcDate);
}

/** Count business days (Mon–Fri) between two Date objects, inclusive. */
function countBusinessDays(d1, d2) {
  const start = new Date(Math.min(d1, d2));
  const end = new Date(Math.max(d1, d2));
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Add (or subtract) N business days to a Date. */
function addBusinessDaysToDate(d, amount) {
  const result = new Date(d);
  const sign = amount >= 0 ? 1 : -1;
  let remaining = Math.abs(Math.round(amount));
  while (remaining > 0) {
    result.setDate(result.getDate() + sign);
    if (result.getDay() !== 0 && result.getDay() !== 6) remaining--;
  }
  return result;
}

/** Approximate lunar phase for a date. */
function getLunarPhase(date) {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');
  const synodicPeriod = 29.53059;
  const elapsed = (date.getTime() - knownNewMoon.getTime()) / 86_400_000;
  const phase = ((elapsed % synodicPeriod) + synodicPeriod) % synodicPeriod;

  let phaseName, emoji;
  if (phase < 1.85) {
    phaseName = 'New Moon';
    emoji = '🌑';
  } else if (phase < 7.38) {
    phaseName = 'Waxing Crescent';
    emoji = '🌒';
  } else if (phase < 9.22) {
    phaseName = 'First Quarter';
    emoji = '🌓';
  } else if (phase < 14.77) {
    phaseName = 'Waxing Gibbous';
    emoji = '🌔';
  } else if (phase < 16.61) {
    phaseName = 'Full Moon';
    emoji = '🌕';
  } else if (phase < 22.15) {
    phaseName = 'Waning Gibbous';
    emoji = '🌖';
  } else if (phase < 23.99) {
    phaseName = 'Last Quarter';
    emoji = '🌗';
  } else {
    phaseName = 'Waning Crescent';
    emoji = '🌘';
  }

  const illumination = Math.round(50 * (1 - Math.cos((phase / synodicPeriod) * 2 * Math.PI)));
  const daysUntilFull =
    phase < 14.77 ? (14.77 - phase).toFixed(1) : (synodicPeriod - phase + 14.77).toFixed(1);

  return { phaseName, emoji, phase: phase.toFixed(2), illumination, daysUntilFull };
}

/** Detailed calendar diff: years, months, days between two dates. */
function detailedDiff(d1, d2) {
  const start = new Date(Math.min(d1, d2));
  const end = new Date(Math.max(d1, d2));

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const totalDays = Math.round(Math.abs(end - start) / 86_400_000);
  const totalWeeks = (totalDays / 7).toFixed(1);
  const totalHours = totalDays * 24;
  const totalMinutes = totalHours * 60;

  return { years, months, days, totalDays, totalWeeks, totalHours, totalMinutes };
}

/** Find the Nth weekday of a month. nth=-1 means last. */
function getNthWeekdayOfMonth(year, month, nth, weekdayName) {
  const targetDay = DAYS.indexOf(weekdayName);
  if (targetDay === -1)
    throw new Error(`Unknown weekday "${weekdayName}". Use Monday, Tuesday, etc.`);

  if (nth === -1) {
    const lastDay = new Date(year, month, 0);
    while (lastDay.getDay() !== targetDay) lastDay.setDate(lastDay.getDate() - 1);
    return lastDay;
  }

  const firstOfMonth = new Date(year, month - 1, 1);
  const offset = (targetDay - firstOfMonth.getDay() + 7) % 7;
  const result = new Date(year, month - 1, 1 + offset + (nth - 1) * 7);
  if (result.getMonth() !== month - 1)
    throw new Error(`There is no ${nth}th ${weekdayName} in that month.`);
  return result;
}

/** Build a simple ASCII-style progress bar. */
function progressBar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

// ─── EXECUTOR ────────────────────────────────────────────────────────────────

export const { handles, execute } = createExecutor({
  name: 'DateTimeExecutor',
  tools: toolsList,
  handlers: {
    calculate_date: async (params, onStage) => {
      const { operation, date, date2, amount } = params;
      if (!operation) throw new Error('Missing required param: operation');

      const d1 = parseDate(date || undefined);

      switch (operation) {
        case 'day_of_week': {
          onStage('📅 Checking day of week…');
          return [
            `📅 Day of Week`,
            '',
            `Date: ${formatDate(d1)}`,
            `Day: **${DAYS[d1.getDay()]}**`,
            `Day number in year: ${getDayNumber(d1)}`,
            `Week number: ${getWeekNumber(d1)}`,
          ].join('\n');
        }

        case 'days_between': {
          if (!date2) throw new Error('days_between requires date2 param.');
          onStage('📅 Counting days between dates…');
          const d2 = parseDate(date2);
          const diff = Math.abs(d2 - d1);
          const days = Math.round(diff / 86_400_000);
          const weeks = (days / 7).toFixed(1);
          const months = (days / 30.44).toFixed(1);
          const earlier = d1 < d2 ? d1 : d2;
          const later = d1 < d2 ? d2 : d1;
          return [
            `📅 Days Between Dates`,
            '',
            `From: ${formatDate(earlier)}`,
            `To:   ${formatDate(later)}`,
            '',
            `**${days} day${days !== 1 ? 's' : ''}**`,
            `≈ ${weeks} weeks`,
            `≈ ${months} months`,
            `≈ ${(days / 365.25).toFixed(2)} years`,
          ].join('\n');
        }

        case 'add_days': {
          if (amount == null) throw new Error('add_days requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          result.setDate(result.getDate() + Math.round(Number(amount)));
          return [
            `📅 Add ${amount} Days`,
            '',
            `Start:  ${formatDate(d1)}`,
            `Result: **${formatDate(result)}**`,
            `ISO:    ${toISO(result)}`,
          ].join('\n');
        }

        case 'subtract_days': {
          if (amount == null) throw new Error('subtract_days requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          result.setDate(result.getDate() - Math.round(Number(amount)));
          return [
            `📅 Subtract ${amount} Days`,
            '',
            `Start:  ${formatDate(d1)}`,
            `Result: **${formatDate(result)}**`,
            `ISO:    ${toISO(result)}`,
          ].join('\n');
        }

        case 'add_months': {
          if (amount == null) throw new Error('add_months requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          result.setMonth(result.getMonth() + Math.round(Number(amount)));
          return [
            `📅 Add ${amount} Month${Math.abs(amount) !== 1 ? 's' : ''}`,
            '',
            `Start:  ${formatDate(d1)}`,
            `Result: **${formatDate(result)}**`,
            `ISO:    ${toISO(result)}`,
          ].join('\n');
        }

        case 'add_years': {
          if (amount == null) throw new Error('add_years requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          result.setFullYear(result.getFullYear() + Math.round(Number(amount)));
          return [
            `📅 Add ${amount} Year${Math.abs(amount) !== 1 ? 's' : ''}`,
            '',
            `Start:  ${formatDate(d1)}`,
            `Result: **${formatDate(result)}**`,
            `ISO:    ${toISO(result)}`,
          ].join('\n');
        }

        case 'countdown': {
          onStage('📅 Calculating countdown…');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          d1.setHours(0, 0, 0, 0);
          const diffMs = d1 - today;
          const days = Math.round(diffMs / 86_400_000);

          if (days < 0) {
            return [
              `📅 Countdown`,
              '',
              `Target: ${formatDate(d1)}`,
              `**${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago**`,
              `Today is ${formatDate(today)}`,
            ].join('\n');
          } else if (days === 0) {
            return `📅 **That's today!** (${formatDate(today)})`;
          } else {
            const weeks = Math.floor(days / 7);
            const rem = days % 7;
            return [
              `📅 Countdown`,
              '',
              `Target: ${formatDate(d1)}`,
              `**${days} day${days !== 1 ? 's' : ''} from now**`,
              weeks > 0
                ? `(${weeks} week${weeks !== 1 ? 's' : ''}${rem > 0 ? ` and ${rem} day${rem !== 1 ? 's' : ''}` : ''})`
                : '',
              `Today is ${formatDate(today)}`,
            ]
              .filter(Boolean)
              .join('\n');
          }
        }

        case 'date_info': {
          onStage('📅 Getting date details…');
          const leap = isLeapYear(d1.getFullYear());
          const zodiac = getZodiac(d1.getMonth() + 1, d1.getDate());
          const dayNum = getDayNumber(d1);
          const weekNum = getWeekNumber(d1);
          const daysInYr = leap ? 366 : 365;
          const daysLeft = daysInYr - dayNum;
          return [
            `📅 Date Info: ${formatDate(d1)}`,
            '',
            `Day of week:       ${DAYS[d1.getDay()]}`,
            `Day of year:       ${dayNum} of ${daysInYr}`,
            `Days left in year: ${daysLeft}`,
            `Week number:       ${weekNum}`,
            `Quarter:           Q${Math.ceil((d1.getMonth() + 1) / 3)}`,
            `Leap year:         ${leap ? 'Yes' : 'No'}`,
            `Zodiac sign:       ${zodiac}`,
            `Unix timestamp:    ${Math.floor(d1.getTime() / 1000)}`,
            `ISO 8601:          ${toISO(d1)}`,
          ].join('\n');
        }

        default:
          return [
            `Unknown operation "${operation}".`,
            '',
            'Available operations:',
            '  - day_of_week',
            '  - days_between  (requires date2)',
            '  - add_days      (requires amount)',
            '  - subtract_days (requires amount)',
            '  - add_months    (requires amount)',
            '  - add_years     (requires amount)',
            '  - countdown',
            '  - date_info',
          ].join('\n');
      }
    },

    convert_timezone: async (params, onStage) => {
      const { time, date, from_timezone, to_timezone } = params;
      if (!from_timezone || !to_timezone)
        throw new Error(
          'Requires from_timezone and to_timezone (IANA names, e.g. "America/New_York").',
        );
      if (!time) throw new Error('Requires time in HH:MM format (e.g. "14:30").');

      onStage('🌍 Converting timezone…');

      const dateStr = date || toISO(new Date());
      const utcMoment = localToUTC(dateStr, time, from_timezone);

      const fromFormatted = formatInTimezone(utcMoment, from_timezone);
      const toFormatted = formatInTimezone(utcMoment, to_timezone);

      // Compute offset string for both zones
      const getOffsetStr = (tz) => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'shortOffset',
        }).formatToParts(utcMoment);
        return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
      };

      return [
        `🌍 Timezone Conversion`,
        '',
        `From: **${from_timezone}** (${getOffsetStr(from_timezone)})`,
        `      ${fromFormatted}`,
        '',
        `To:   **${to_timezone}** (${getOffsetStr(to_timezone)})`,
        `      **${toFormatted}**`,
      ].join('\n');
    },

    is_weekend: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      onStage('📅 Checking day type…');

      const dow = d.getDay();
      const weekend = dow === 0 || dow === 6;

      // Find the surrounding weekend
      const prevSat = new Date(d);
      prevSat.setDate(d.getDate() - ((dow + 1) % 7));

      const nextSat = new Date(d);
      nextSat.setDate(d.getDate() + ((6 - dow + 7) % 7 || 7));

      const nextSun = new Date(nextSat);
      nextSun.setDate(nextSat.getDate() + 1);

      const lines = [
        `${weekend ? '🛋️' : '💼'} Weekend Check`,
        '',
        `Date: ${formatDate(d)}`,
        `Type: **${weekend ? '🎉 Weekend' : '💼 Weekday'}**`,
      ];

      if (!weekend) {
        const daysToWeekend = 6 - dow;
        lines.push('');
        lines.push(`Days until weekend: **${daysToWeekend}**`);
        lines.push(`Next Saturday: ${formatDate(nextSat)}`);
        lines.push(`Next Sunday:   ${formatDate(nextSun)}`);
      } else {
        lines.push('');
        lines.push(`This is a **${DAYS[dow]}** — enjoy your day off!`);
        if (dow === 6) {
          const sun = new Date(d);
          sun.setDate(d.getDate() + 1);
          lines.push(`Tomorrow (Sunday): ${formatDate(sun)}`);
        }
      }

      return lines.join('\n');
    },

    business_days_between: async (params, onStage) => {
      const { date, date2 } = params;
      if (!date || !date2) throw new Error('Requires both date and date2.');
      onStage('💼 Counting business days…');

      const d1 = parseDate(date);
      const d2 = parseDate(date2);
      const bizDays = countBusinessDays(d1, d2);
      const totalDays = Math.round(Math.abs(d2 - d1) / 86_400_000);
      const weekendDays = totalDays - bizDays + 1; // inclusive

      const earlier = d1 < d2 ? d1 : d2;
      const later = d1 < d2 ? d2 : d1;

      return [
        `💼 Business Days Between Dates`,
        '',
        `From: ${formatDate(earlier)}`,
        `To:   ${formatDate(later)}`,
        '',
        `**${bizDays} business day${bizDays !== 1 ? 's' : ''}**`,
        `Weekend days: ${weekendDays}`,
        `Total calendar days: ${totalDays}`,
        `≈ ${(bizDays / 5).toFixed(1)} work weeks`,
      ].join('\n');
    },

    add_business_days: async (params, onStage) => {
      const { date, amount } = params;
      if (amount == null) throw new Error('Requires amount param.');
      onStage('💼 Calculating business date…');

      const d = parseDate(date || undefined);
      const result = addBusinessDaysToDate(d, amount);
      const label = amount >= 0 ? `Add ${amount}` : `Subtract ${Math.abs(amount)}`;

      return [
        `💼 ${label} Business Day${Math.abs(amount) !== 1 ? 's' : ''}`,
        '',
        `Start:  ${formatDate(d)}`,
        `Result: **${formatDate(result)}**`,
        `ISO:    ${toISO(result)}`,
        '',
        `(Skips weekends; does not account for public holidays)`,
      ].join('\n');
    },

    next_weekday_occurrence: async (params, onStage) => {
      const { weekday, date, direction } = params;
      if (!weekday) throw new Error('Requires weekday param (e.g. "Friday").');

      const capitalised = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
      const targetDow = DAYS.indexOf(capitalised);
      if (targetDow === -1)
        throw new Error(`Unknown weekday "${weekday}". Use Monday, Tuesday, etc.`);

      onStage('📅 Finding next occurrence…');
      const d = parseDate(date || undefined);
      const isPrev = direction === 'previous' || direction === 'prev';
      const sign = isPrev ? -1 : 1;

      const result = new Date(d);
      result.setDate(result.getDate() + sign); // start from tomorrow/yesterday
      while (result.getDay() !== targetDow) result.setDate(result.getDate() + sign);

      const daysAway = Math.round(Math.abs(result - d) / 86_400_000);

      return [
        `📅 ${isPrev ? 'Previous' : 'Next'} ${capitalised}`,
        '',
        `Reference: ${formatDate(d)}`,
        `Result:    **${formatDate(result)}**`,
        `ISO:       ${toISO(result)}`,
        '',
        `${daysAway} day${daysAway !== 1 ? 's' : ''} ${isPrev ? 'before' : 'from now'}`,
      ].join('\n');
    },

    age_calculator: async (params, onStage) => {
      const { date, date2 } = params;
      if (!date) throw new Error('Requires date (birth date) param.');
      onStage('🎂 Calculating age…');

      const birth = parseDate(date);
      const target = parseDate(date2 || undefined);

      if (birth > target) throw new Error('Birth date cannot be after target date.');

      const { years, months, days, totalDays } = detailedDiff(birth, target);
      const nextBirthday = new Date(target.getFullYear(), birth.getMonth(), birth.getDate());
      if (nextBirthday <= target) nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
      const daysToNext = Math.round((nextBirthday - target) / 86_400_000);

      return [
        `🎂 Age Calculator`,
        '',
        `Born:  ${formatDate(birth)}`,
        `As of: ${formatDate(target)}`,
        '',
        `Age: **${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}**`,
        '',
        `Total days alive: ${totalDays.toLocaleString()}`,
        `Total weeks:      ${(totalDays / 7).toFixed(1)}`,
        `Total months:     ${(totalDays / 30.44).toFixed(1)}`,
        '',
        `Next birthday in: ${daysToNext} day${daysToNext !== 1 ? 's' : ''} (${formatDate(nextBirthday)})`,
      ].join('\n');
    },

    days_until_birthday: async (params, onStage) => {
      const { date } = params;
      if (!date) throw new Error('Requires date param (YYYY-MM-DD or MM-DD).');
      onStage('🎂 Calculating birthday countdown…');

      // Accept MM-DD or YYYY-MM-DD
      let month,
        day,
        hasYear = false,
        birthYear;
      const shortMatch = date.match(/^(\d{2})-(\d{2})$/);
      const fullMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (shortMatch) {
        month = parseInt(shortMatch[1], 10);
        day = parseInt(shortMatch[2], 10);
      } else if (fullMatch) {
        birthYear = parseInt(fullMatch[1], 10);
        month = parseInt(fullMatch[2], 10);
        day = parseInt(fullMatch[3], 10);
        hasYear = true;
      } else {
        throw new Error('Date must be YYYY-MM-DD or MM-DD format.');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let nextBirthday = new Date(today.getFullYear(), month - 1, day);
      if (nextBirthday <= today) nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);

      const daysUntil = Math.round((nextBirthday - today) / 86_400_000);
      const turningAge = hasYear ? nextBirthday.getFullYear() - birthYear : null;

      const lines = [
        `🎂 Birthday Countdown`,
        '',
        `Birthday: ${MONTHS[month - 1]} ${day}${hasYear ? `, ${birthYear}` : ''}`,
        `Next:     **${formatDate(nextBirthday)}**`,
        '',
      ];

      if (daysUntil === 0) {
        lines.push(`🎉 **Happy Birthday! It's today!**`);
      } else {
        lines.push(`**${daysUntil} day${daysUntil !== 1 ? 's' : ''} away**`);
        lines.push(`≈ ${(daysUntil / 7).toFixed(1)} weeks`);
        if (turningAge !== null) lines.push(`Turning: **${turningAge} years old**`);
      }

      return lines.join('\n');
    },

    get_season: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      const southern = (params.hemisphere || 'northern').toLowerCase().startsWith('s');
      onStage('🌍 Detecting season…');

      const month = d.getMonth() + 1;

      const northSeason = SEASONS_NORTH.find((s) => s.months.includes(month));
      const oppositeSeason = SEASONS_NORTH.find(
        (s) =>
          s.name ===
          { Winter: 'Summer', Summer: 'Winter', Spring: 'Autumn', Autumn: 'Spring' }[
            northSeason.name
          ],
      );

      const season = southern ? oppositeSeason : northSeason;

      // Approx next season start
      const nextSeasonIdx = (SEASONS_NORTH.indexOf(northSeason) + 1) % 4;
      const nextNorthStartMonth = SEASONS_NORTH[nextSeasonIdx].months[0];
      const nextSeasonStart = new Date(
        month > nextNorthStartMonth ? d.getFullYear() + 1 : d.getFullYear(),
        nextNorthStartMonth - 1,
        1,
      );
      const daysToNext = Math.round((nextSeasonStart - d) / 86_400_000);

      return [
        `${season.emoji} Season Info`,
        '',
        `Date:       ${formatDate(d)}`,
        `Hemisphere: ${southern ? 'Southern' : 'Northern'}`,
        `Season:     **${season.name}**`,
        '',
        `Approx. next season in ~${daysToNext} days`,
        `(${formatDate(nextSeasonStart)})`,
      ].join('\n');
    },

    get_month_info: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      onStage('📅 Analysing month…');

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const dim = daysInMonth(year, month);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month - 1, dim);
      const leap = isLeapYear(year);

      // Count each weekday in the month
      const counts = new Array(7).fill(0);
      const cur = new Date(firstDay);
      while (cur.getMonth() === month - 1) {
        counts[cur.getDay()]++;
        cur.setDate(cur.getDate() + 1);
      }

      const weekdayCounts = DAYS.map((name, i) => `  ${name.padEnd(10)} ${counts[i]}`).join('\n');
      const totalWeekends = counts[0] + counts[6];
      const totalWeekdays = dim - totalWeekends;
      const totalWeeks = Math.ceil((firstDay.getDay() + dim) / 7);

      return [
        `📅 Month Info: ${MONTHS[month - 1]} ${year}`,
        '',
        `First day: ${formatDate(firstDay)}`,
        `Last day:  ${formatDate(lastDay)}`,
        `Total days: **${dim}**`,
        `Leap year: ${leap ? 'Yes' : 'No'}`,
        `Calendar weeks: ${totalWeeks}`,
        '',
        `Weekdays:      ${totalWeekdays}`,
        `Weekend days:  ${totalWeekends}`,
        '',
        `Weekday breakdown:`,
        weekdayCounts,
      ].join('\n');
    },

    get_quarter_info: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      onStage('📅 Getting quarter info…');

      const month = d.getMonth() + 1;
      const quarter = Math.ceil(month / 3);
      const year = d.getFullYear();

      const qStart = new Date(year, (quarter - 1) * 3, 1);
      const qEnd = new Date(year, quarter * 3, 0);
      const totalDays = Math.round((qEnd - qStart) / 86_400_000) + 1;
      const elapsed = Math.round((d - qStart) / 86_400_000) + 1;
      const remaining = totalDays - elapsed;
      const pct = ((elapsed / totalDays) * 100).toFixed(1);

      return [
        `📅 Quarter Info`,
        '',
        `Date:    ${formatDate(d)}`,
        `Quarter: **Q${quarter} ${year}**`,
        '',
        `Start: ${formatDate(qStart)}`,
        `End:   ${formatDate(qEnd)}`,
        '',
        `Total days:    ${totalDays}`,
        `Days elapsed:  ${elapsed}`,
        `Days remaining: ${remaining}`,
        '',
        `Progress: ${pct}%`,
        progressBar(parseFloat(pct)),
      ].join('\n');
    },

    lunar_phase: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      onStage('🌙 Calculating lunar phase…');

      const { phaseName, emoji, phase, illumination, daysUntilFull } = getLunarPhase(d);

      return [
        `🌙 Lunar Phase`,
        '',
        `Date:  ${formatDate(d)}`,
        `Phase: **${emoji} ${phaseName}**`,
        '',
        `Illumination:     ~${illumination}%`,
        `Days into cycle:  ${phase} / 29.53`,
        `Days until Full Moon: ~${daysUntilFull}`,
        '',
        `Phase cycle: 🌑 → 🌒 → 🌓 → 🌔 → 🌕 → 🌖 → 🌗 → 🌘 → 🌑`,
        `(Approximate — based on mean synodic period)`,
      ].join('\n');
    },

    week_bounds: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      const startOnMonday = (params.week_start || 'sunday').toLowerCase().startsWith('m');
      onStage('📅 Finding week bounds…');

      const dow = d.getDay(); // 0=Sun
      const startOffset = startOnMonday ? (dow === 0 ? -6 : 1 - dow) : -dow;

      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() + startOffset);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const daysIn = [];
      const cur = new Date(weekStart);
      while (cur <= weekEnd) {
        const isTarget = toISO(cur) === toISO(d);
        daysIn.push(`  ${isTarget ? '▶' : ' '} ${DAYS[cur.getDay()].padEnd(10)} ${toISO(cur)}`);
        cur.setDate(cur.getDate() + 1);
      }

      return [
        `📅 Week Bounds`,
        '',
        `Reference date: ${formatDate(d)}`,
        `Week starts on: ${startOnMonday ? 'Monday' : 'Sunday'}`,
        '',
        `Start: **${formatDate(weekStart)}**`,
        `End:   **${formatDate(weekEnd)}**`,
        '',
        daysIn.join('\n'),
      ].join('\n');
    },

    month_bounds: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      onStage('📅 Finding month bounds…');

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const first = new Date(year, month - 1, 1);
      const last = new Date(year, month, 0);
      const dim = last.getDate();

      const daysElapsed = d.getDate();
      const daysRemaining = dim - daysElapsed;
      const pct = ((daysElapsed / dim) * 100).toFixed(1);

      return [
        `📅 Month Bounds: ${MONTHS[month - 1]} ${year}`,
        '',
        `First day: **${formatDate(first)}**`,
        `Last day:  **${formatDate(last)}**`,
        `Total days: ${dim}`,
        '',
        `Today is day **${daysElapsed}** of ${dim}`,
        `Days remaining: ${daysRemaining}`,
        '',
        `Month progress: ${pct}%`,
        progressBar(parseFloat(pct)),
      ].join('\n');
    },

    year_progress: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      onStage('📅 Calculating year progress…');

      const year = d.getFullYear();
      const leap = isLeapYear(year);
      const daysInYr = leap ? 366 : 365;
      const dayNum = getDayNumber(d);
      const remaining = daysInYr - dayNum;
      const pct = ((dayNum / daysInYr) * 100).toFixed(2);

      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);

      return [
        `📅 Year Progress: ${year}`,
        '',
        `Date:         ${formatDate(d)}`,
        `Day:          **${dayNum}** of ${daysInYr}`,
        `Days elapsed: ${dayNum}`,
        `Days left:    ${remaining}`,
        `Leap year:    ${leap ? 'Yes ✓' : 'No'}`,
        '',
        `Progress: **${pct}%**`,
        progressBar(parseFloat(pct), 25),
        '',
        `Year start: ${formatDate(yearStart)}`,
        `Year end:   ${formatDate(yearEnd)}`,
      ].join('\n');
    },

    detailed_difference: async (params, onStage) => {
      const { date, date2 } = params;
      if (!date || !date2) throw new Error('Requires both date and date2.');
      onStage('📅 Calculating detailed difference…');

      const d1 = parseDate(date);
      const d2 = parseDate(date2);
      const earlier = d1 < d2 ? d1 : d2;
      const later = d1 < d2 ? d2 : d1;

      const { years, months, days, totalDays, totalWeeks, totalHours, totalMinutes } = detailedDiff(
        d1,
        d2,
      );

      return [
        `📅 Detailed Date Difference`,
        '',
        `From: ${formatDate(earlier)}`,
        `To:   ${formatDate(later)}`,
        '',
        `**${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}**`,
        '',
        `Total days:    ${totalDays.toLocaleString()}`,
        `Total weeks:   ${totalWeeks}`,
        `Total hours:   ${totalHours.toLocaleString()}`,
        `Total minutes: ${totalMinutes.toLocaleString()}`,
      ].join('\n');
    },

    nth_weekday_of_month: async (params, onStage) => {
      const { date, nth, weekday } = params;
      if (nth == null) throw new Error('Requires nth param (1–5 or -1 for last).');
      if (!weekday) throw new Error('Requires weekday param (e.g. "Monday").');
      onStage('📅 Finding weekday in month…');

      const ref = parseDate(date || undefined);
      const year = ref.getFullYear();
      const mon = ref.getMonth() + 1;

      const capitalised = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
      const n = Math.round(Number(nth));
      const result = getNthWeekdayOfMonth(year, mon, n, capitalised);

      const label = n === -1 ? 'Last' : (['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`);

      return [
        `📅 ${label} ${capitalised} of ${MONTHS[mon - 1]} ${year}`,
        '',
        `Result: **${formatDate(result)}**`,
        `ISO:    ${toISO(result)}`,
      ].join('\n');
    },

    timezone_overlap: async (params, onStage) => {
      const { timezone1, timezone2, date } = params;
      if (!timezone1 || !timezone2) throw new Error('Requires timezone1 and timezone2.');
      onStage('🌍 Finding business hour overlap…');

      const dateStr = date || toISO(new Date());
      const BIZ_START = 9; // 9 AM
      const BIZ_END = 17; // 5 PM

      // For each UTC hour, get local hour in each timezone
      const rows = [];
      let overlapStart = null;
      let overlapEnd = null;

      for (let utcHour = 0; utcHour < 24; utcHour++) {
        const utcMoment = new Date(`${dateStr}T${String(utcHour).padStart(2, '0')}:00:00Z`);

        const getLocalHour = (tz) => {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            hour12: false,
          }).formatToParts(utcMoment);
          return parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
        };

        const h1 = getLocalHour(timezone1);
        const h2 = getLocalHour(timezone2);
        const tz1Biz = h1 >= BIZ_START && h1 < BIZ_END;
        const tz2Biz = h2 >= BIZ_START && h2 < BIZ_END;
        const overlap = tz1Biz && tz2Biz;

        if (overlap) {
          if (overlapStart === null) overlapStart = utcHour;
          overlapEnd = utcHour;
        }

        if (tz1Biz || tz2Biz) {
          const fmt = (h) => `${String(h).padStart(2, '0')}:00`;
          const marker = overlap ? ' ◀ OVERLAP' : '';
          rows.push(
            `  ${fmt(h1)} (${timezone1.split('/')[1] ?? timezone1})  |  ${fmt(h2)} (${timezone2.split('/')[1] ?? timezone2})${marker}`,
          );
        }
      }

      const overlapHours = overlapStart !== null ? overlapEnd - overlapStart + 1 : 0;

      const lines = [
        `🌍 Business Hours Overlap`,
        `   (9:00–17:00 local time, ${dateStr})`,
        '',
        `Zone 1: ${timezone1}`,
        `Zone 2: ${timezone2}`,
        '',
      ];

      if (overlapHours > 0) {
        lines.push(`✅ **${overlapHours} hour${overlapHours !== 1 ? 's' : ''} of overlap**`);
        lines.push('');
        lines.push('Timezone 1        |  Timezone 2');
        lines.push('──────────────────────────────────');
        lines.push(...rows);
      } else {
        lines.push('❌ **No overlapping business hours** on this date.');
        lines.push('');
        lines.push('These timezones have no common 9am–5pm window.');
      }

      return lines.join('\n');
    },

    century_decade_info: async (params, onStage) => {
      const d = parseDate(params.date || undefined);
      onStage('📅 Calculating century and decade…');

      const year = d.getFullYear();
      const decade = Math.floor(year / 10) * 10;
      const century = Math.ceil(year / 100);
      const millennium = Math.ceil(year / 1000);

      const ordinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      const yearInDecade = year - decade + 1;
      const yearInCentury = year - (century - 1) * 100;
      const yearInMillennium = year - (millennium - 1) * 1000;

      return [
        `📅 Century & Decade Info`,
        '',
        `Date:  ${formatDate(d)}`,
        `Year:  **${year}**`,
        '',
        `Decade:     **${decade}s**  (year ${yearInDecade} of 10)`,
        `Century:    **${ordinal(century)} century**  (year ${yearInCentury} of 100)`,
        `Millennium: **${ordinal(millennium)} millennium**  (year ${yearInMillennium} of 1000)`,
        '',
        `Decade ends:     ${decade + 9}`,
        `Century ends:    ${century * 100}`,
        `Millennium ends: ${millennium * 1000}`,
      ].join('\n');
    },

    unix_converter: async (params, onStage) => {
      const { operation, date, unix_timestamp } = params;
      if (!operation) throw new Error('Requires operation: "to_unix" or "from_unix".');
      onStage('🔢 Converting timestamp…');

      if (operation === 'to_unix') {
        const d = parseDate(date || undefined);
        const ts = Math.floor(d.getTime() / 1000);
        const tsMs = d.getTime();
        return [
          `🔢 Date → Unix Timestamp`,
          '',
          `Date: ${formatDate(d)}`,
          '',
          `Unix (seconds):      **${ts}**`,
          `Unix (milliseconds): ${tsMs}`,
          `ISO 8601:            ${d.toISOString()}`,
        ].join('\n');
      } else if (operation === 'from_unix') {
        if (unix_timestamp == null) throw new Error('from_unix requires a unix_timestamp param.');
        // Auto-detect ms vs seconds
        const ts = Number(unix_timestamp);
        const d = ts > 1e10 ? new Date(ts) : new Date(ts * 1000);
        if (isNaN(d.getTime())) throw new Error('Invalid Unix timestamp.');

        return [
          `🔢 Unix Timestamp → Date`,
          '',
          `Timestamp: ${ts}`,
          '',
          `Date (UTC):   **${d.toUTCString()}**`,
          `Date (local): ${d.toString()}`,
          `ISO 8601:     ${d.toISOString()}`,
          `Simple:       ${toISO(d)}`,
        ].join('\n');
      } else {
        throw new Error(`Unknown operation "${operation}". Use "to_unix" or "from_unix".`);
      }
    },

    time_until_datetime: async (params, onStage) => {
      const { date, time, timezone } = params;
      if (!date) throw new Error('Requires date param.');
      onStage('⏱️ Calculating countdown…');

      const timeStr = time || '00:00';
      let targetDate;

      if (timezone) {
        targetDate = localToUTC(date, timeStr, timezone);
      } else {
        const [y, mo, d] = date.split('-').map(Number);
        const [hh, mm] = timeStr.split(':').map(Number);
        targetDate = new Date(y, mo - 1, d, hh, mm, 0);
      }

      const now = new Date();
      const diffMs = targetDate - now;
      const isPast = diffMs < 0;
      const absMs = Math.abs(diffMs);

      const totalSeconds = Math.floor(absMs / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      const totalDays = Math.floor(totalHours / 24);

      const remHours = totalHours % 24;
      const remMinutes = totalMinutes % 60;
      const remSeconds = totalSeconds % 60;

      const weeks = Math.floor(totalDays / 7);
      const remDays = totalDays % 7;

      const tzLabel = timezone ? ` (${timezone})` : '';
      const label = `${date} at ${timeStr}${tzLabel}`;

      const mainLine = `**${totalDays}d ${remHours}h ${remMinutes}m ${remSeconds}s**`;
      const subLine =
        weeks > 0
          ? `(${weeks} week${weeks !== 1 ? 's' : ''}, ${remDays} day${remDays !== 1 ? 's' : ''}, ${remHours}h)`
          : '';

      return [
        `⏱️ ${isPast ? 'Time Since' : 'Time Until'} Event`,
        '',
        `Event: ${label}`,
        mainLine,
        subLine,
        '',
        `Total hours:   ${totalHours.toLocaleString()}`,
        `Total minutes: ${totalMinutes.toLocaleString()}`,
        `Total seconds: ${totalSeconds.toLocaleString()}`,
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
});
