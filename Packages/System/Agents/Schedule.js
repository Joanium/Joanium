const WEEKDAY_LABELS = Object.freeze([
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

function normalizeWeekday(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return 7 === parsed ? 0 : parsed;
}

function parseCronNumber(token, min, max, isDow = false) {
  const normalized = isDow ? normalizeWeekday(token) : Number(token);
  return Number.isInteger(normalized) && normalized >= min && normalized <= max ? normalized : null;
}

function expandCronPart(part, min, max, isDow = false) {
  const values = new Set();
  for (const rawPiece of String(part ?? '').split(',')) {
    const piece = rawPiece.trim();
    if (!piece) return null;
    if ('*' === piece) {
      for (let value = min; value <= max; value += 1) values.add(value);
      continue;
    }
    const [rangePart, stepPart] = piece.split('/');
    const step = null == stepPart ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) return null;
    if ('*' === rangePart) {
      for (let value = min; value <= max; value += step) values.add(value);
      continue;
    }
    if (rangePart.includes('-')) {
      const [startRaw, endRaw] = rangePart.split('-', 2),
        start = parseCronNumber(startRaw, min, max, isDow),
        end = parseCronNumber(endRaw, min, max, isDow);
      if (null == start || null == end || end < start) return null;
      for (let value = start; value <= end; value += step) values.add(value);
      continue;
    }
    const single = parseCronNumber(rangePart, min, max, isDow);
    if (null == single) return null;
    values.add(single);
  }
  return values;
}

function parseCronExpression(expression = '') {
  const parts = String(expression ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (5 !== parts.length) return null;
  const fields = [
    expandCronPart(parts[0], 0, 59),
    expandCronPart(parts[1], 0, 23),
    expandCronPart(parts[2], 1, 31),
    expandCronPart(parts[3], 1, 12),
    expandCronPart(parts[4], 0, 6, true),
  ];
  return fields.every(Boolean)
    ? {
        minutes: fields[0],
        hours: fields[1],
        daysOfMonth: fields[2],
        months: fields[3],
        daysOfWeek: fields[4],
      }
    : null;
}

function formatTime(hour = 0, minute = 0) {
  const hours = Math.max(0, Math.min(23, Number(hour) || 0)),
    minutes = Math.max(0, Math.min(59, Number(minute) || 0)),
    suffix = hours >= 12 ? 'PM' : 'AM',
    normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function buildCronExpressionFromEditor(editor = {}) {
  const mode = String(editor?.mode ?? 'startup')
      .trim()
      .toLowerCase(),
    minute = Math.max(0, Math.min(59, Number(editor?.minute) || 0)),
    hour = Math.max(0, Math.min(23, Number(editor?.hour) || 0)),
    intervalMinutes = Math.max(1, Math.min(59, Number(editor?.intervalMinutes) || 15)),
    weekday = Math.max(0, Math.min(6, normalizeWeekday(editor?.weekday) ?? 1));
  switch (mode) {
    case 'interval':
      return `*/${intervalMinutes} * * * *`;
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${weekday}`;
    case 'custom':
      return String(editor?.expression ?? '').trim();
    default:
      return '';
  }
}

export function describeSchedule(schedule = {}) {
  const type = String(schedule?.type ?? '')
    .trim()
    .toLowerCase();
  if ('on_startup' === type) return 'On app startup';
  const editor = schedule?.editor ?? {};
  switch (
    String(editor?.mode ?? '')
      .trim()
      .toLowerCase()
  ) {
    case 'interval':
      return `Every ${Math.max(1, Number(editor?.intervalMinutes) || 15)} minutes`;
    case 'hourly':
      return `Hourly at :${String(Math.max(0, Math.min(59, Number(editor?.minute) || 0))).padStart(2, '0')}`;
    case 'daily':
      return `Daily at ${formatTime(editor?.hour, editor?.minute)}`;
    case 'weekly': {
      const weekday = Math.max(0, Math.min(6, normalizeWeekday(editor?.weekday) ?? 1));
      return `${WEEKDAY_LABELS[weekday]} at ${formatTime(editor?.hour, editor?.minute)}`;
    }
    case 'custom':
      return `Cron: ${String(schedule?.expression ?? '').trim() || 'invalid'}`;
    default:
      return (
        String(schedule?.label ?? '').trim() || `Cron: ${String(schedule?.expression ?? '').trim()}`
      );
  }
}

export function isValidCronExpression(expression = '') {
  return Boolean(parseCronExpression(expression));
}

export function cronMatchesDate(expression = '', date = new Date()) {
  const cron = parseCronExpression(expression);
  return (
    !!cron &&
    cron.minutes.has(date.getMinutes()) &&
    cron.hours.has(date.getHours()) &&
    cron.daysOfMonth.has(date.getDate()) &&
    cron.months.has(date.getMonth() + 1) &&
    cron.daysOfWeek.has(date.getDay())
  );
}

export function scheduleMatchesDate(schedule = {}, date = new Date()) {
  const type = String(schedule?.type ?? '')
    .trim()
    .toLowerCase();
  return 'cron' === type ? cronMatchesDate(schedule.expression, date) : false;
}

export function getNextRunAt(schedule = {}, fromDate = new Date()) {
  if (
    'cron' !==
    String(schedule?.type ?? '')
      .trim()
      .toLowerCase()
  )
    return null;
  const base = new Date(fromDate);
  if (Number.isNaN(base.getTime())) return null;
  const cursor = new Date(base);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  for (let step = 0; step < 60 * 24 * 366; step += 1) {
    if (cronMatchesDate(schedule.expression, cursor)) return cursor.toISOString();
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

export function buildMinuteKey(date = new Date()) {
  const value = new Date(date);
  value.setSeconds(0, 0);
  return value.toISOString();
}
