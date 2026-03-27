const HANDLED = new Set(['calculate_date']);

const DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const ZODIAC = [
  ['Capricorn', [12, 22], [1, 19]],  ['Aquarius', [1, 20], [2, 18]],
  ['Pisces', [2, 19], [3, 20]],      ['Aries', [3, 21], [4, 19]],
  ['Taurus', [4, 20], [5, 20]],      ['Gemini', [5, 21], [6, 20]],
  ['Cancer', [6, 21], [7, 22]],      ['Leo', [7, 23], [8, 22]],
  ['Virgo', [8, 23], [9, 22]],       ['Libra', [9, 23], [10, 22]],
  ['Scorpio', [10, 23], [11, 21]],   ['Sagittarius', [11, 22], [12, 21]],
];

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

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => {}) {
  if (toolName !== 'calculate_date') throw new Error(`DateTimeExecutor: unknown tool "${toolName}"`);

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
      const later   = d1 < d2 ? d2 : d1;
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
        `Start: ${formatDate(d1)}`,
        `Result: **${formatDate(result)}**`,
        `ISO: ${toISO(result)}`,
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
        `Start: ${formatDate(d1)}`,
        `Result: **${formatDate(result)}**`,
        `ISO: ${toISO(result)}`,
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
        `Start: ${formatDate(d1)}`,
        `Result: **${formatDate(result)}**`,
        `ISO: ${toISO(result)}`,
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
        `Start: ${formatDate(d1)}`,
        `Result: **${formatDate(result)}**`,
        `ISO: ${toISO(result)}`,
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
        const rem   = days % 7;
        return [
          `📅 Countdown`,
          '',
          `Target: ${formatDate(d1)}`,
          `**${days} day${days !== 1 ? 's' : ''} from now**`,
          weeks > 0 ? `(${weeks} week${weeks !== 1 ? 's' : ''}${rem > 0 ? ` and ${rem} day${rem !== 1 ? 's' : ''}` : ''})` : '',
          `Today is ${formatDate(today)}`,
        ].filter(Boolean).join('\n');
      }
    }

    case 'date_info': {
      onStage('📅 Getting date details…');
      const leap = isLeapYear(d1.getFullYear());
      const zodiac = getZodiac(d1.getMonth() + 1, d1.getDate());
      const dayNum = getDayNumber(d1);
      const weekNum = getWeekNumber(d1);
      const daysInYear = leap ? 366 : 365;
      const daysLeft = daysInYear - dayNum;

      return [
        `📅 Date Info: ${formatDate(d1)}`,
        '',
        `Day of week:       ${DAYS[d1.getDay()]}`,
        `Day of year:       ${dayNum} of ${daysInYear}`,
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
}
