import { createExecutor } from '../Shared/createExecutor.js';
import { toolsList } from './ToolsList.js';
import {
  DAYS,
  MONTHS,
  SEASONS_NORTH,
  parseDate,
  formatDate,
  toISO,
  isLeapYear,
  getZodiac,
  getDayNumber,
  getWeekNumber,
  daysInMonth,
  localToUTC,
  formatInTimezone,
  countBusinessDays,
  addBusinessDaysToDate,
  getLunarPhase,
  detailedDiff,
  getNthWeekdayOfMonth,
} from './Utils.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'DateTimeExecutor',
  tools: toolsList,
  handlers: {
    calculate_date: async (params, onStage) => {
      const { operation: operation, date: date, date2: date2, amount: amount } = params;
      if (!operation) throw new Error('Missing required param: operation');
      const d1 = parseDate(date || void 0);
      switch (operation) {
        case 'day_of_week':
          return (
            onStage('📅 Checking day of week…'),
            [
              '📅 Day of Week',
              '',
              `Date: ${formatDate(d1)}`,
              `Day: **${DAYS[d1.getDay()]}**`,
              `Day number in year: ${getDayNumber(d1)}`,
              `Week number: ${getWeekNumber(d1)}`,
            ].join('\n')
          );
        case 'days_between': {
          if (!date2) throw new Error('days_between requires date2 param.');
          onStage('📅 Counting days between dates…');
          const d2 = parseDate(date2),
            diff = Math.abs(d2 - d1),
            days = Math.round(diff / 864e5),
            weeks = (days / 7).toFixed(1),
            months = (days / 30.44).toFixed(1),
            later = d1 < d2 ? d2 : d1;
          return [
            '📅 Days Between Dates',
            '',
            `From: ${formatDate(d1 < d2 ? d1 : d2)}`,
            `To:   ${formatDate(later)}`,
            '',
            `**${days} day${1 !== days ? 's' : ''}**`,
            `≈ ${weeks} weeks`,
            `≈ ${months} months`,
            `≈ ${(days / 365.25).toFixed(2)} years`,
          ].join('\n');
        }
        case 'add_days': {
          if (null == amount) throw new Error('add_days requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          return (
            result.setDate(result.getDate() + Math.round(Number(amount))),
            [
              `📅 Add ${amount} Days`,
              '',
              `Start:  ${formatDate(d1)}`,
              `Result: **${formatDate(result)}**`,
              `ISO:    ${toISO(result)}`,
            ].join('\n')
          );
        }
        case 'subtract_days': {
          if (null == amount) throw new Error('subtract_days requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          return (
            result.setDate(result.getDate() - Math.round(Number(amount))),
            [
              `📅 Subtract ${amount} Days`,
              '',
              `Start:  ${formatDate(d1)}`,
              `Result: **${formatDate(result)}**`,
              `ISO:    ${toISO(result)}`,
            ].join('\n')
          );
        }
        case 'add_months': {
          if (null == amount) throw new Error('add_months requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          return (
            result.setMonth(result.getMonth() + Math.round(Number(amount))),
            [
              `📅 Add ${amount} Month${1 !== Math.abs(amount) ? 's' : ''}`,
              '',
              `Start:  ${formatDate(d1)}`,
              `Result: **${formatDate(result)}**`,
              `ISO:    ${toISO(result)}`,
            ].join('\n')
          );
        }
        case 'add_years': {
          if (null == amount) throw new Error('add_years requires an amount param.');
          onStage('📅 Calculating date…');
          const result = new Date(d1);
          return (
            result.setFullYear(result.getFullYear() + Math.round(Number(amount))),
            [
              `📅 Add ${amount} Year${1 !== Math.abs(amount) ? 's' : ''}`,
              '',
              `Start:  ${formatDate(d1)}`,
              `Result: **${formatDate(result)}**`,
              `ISO:    ${toISO(result)}`,
            ].join('\n')
          );
        }
        case 'countdown': {
          onStage('📅 Calculating countdown…');
          const today = new Date();
          (today.setHours(0, 0, 0, 0), d1.setHours(0, 0, 0, 0));
          const diffMs = d1 - today,
            days = Math.round(diffMs / 864e5);
          if (days < 0)
            return [
              '📅 Countdown',
              '',
              `Target: ${formatDate(d1)}`,
              `**${Math.abs(days)} day${1 !== Math.abs(days) ? 's' : ''} ago**`,
              `Today is ${formatDate(today)}`,
            ].join('\n');
          if (0 === days) return `📅 **That's today!** (${formatDate(today)})`;
          {
            const weeks = Math.floor(days / 7),
              rem = days % 7;
            return [
              '📅 Countdown',
              '',
              `Target: ${formatDate(d1)}`,
              `**${days} day${1 !== days ? 's' : ''} from now**`,
              weeks > 0
                ? `(${weeks} week${1 !== weeks ? 's' : ''}${rem > 0 ? ` and ${rem} day${1 !== rem ? 's' : ''}` : ''})`
                : '',
              `Today is ${formatDate(today)}`,
            ]
              .filter(Boolean)
              .join('\n');
          }
        }
        case 'date_info': {
          onStage('📅 Getting date details…');
          const leap = isLeapYear(d1.getFullYear()),
            zodiac = getZodiac(d1.getMonth() + 1, d1.getDate()),
            dayNum = getDayNumber(d1),
            weekNum = getWeekNumber(d1),
            daysInYr = leap ? 366 : 365,
            daysLeft = daysInYr - dayNum;
          return [
            `📅 Date Info: ${formatDate(d1)}`,
            '',
            `Day of week:       ${DAYS[d1.getDay()]}`,
            `Day of year:       ${dayNum} of ${daysInYr}`,
            `Days left in year: ${daysLeft}`,
            `Week number:       ${weekNum}`,
            `Quarter:           Q${Math.ceil((d1.getMonth() + 1) / 3)}`,
            'Leap year:         ' + (leap ? 'Yes' : 'No'),
            `Zodiac sign:       ${zodiac}`,
            `Unix timestamp:    ${Math.floor(d1.getTime() / 1e3)}`,
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
      const {
        time: time,
        date: date,
        from_timezone: from_timezone,
        to_timezone: to_timezone,
      } = params;
      if (!from_timezone || !to_timezone)
        throw new Error(
          'Requires from_timezone and to_timezone (IANA names, e.g. "America/New_York").',
        );
      if (!time) throw new Error('Requires time in HH:MM format (e.g. "14:30").');
      onStage('🌍 Converting timezone…');
      const dateStr = date || toISO(new Date()),
        utcMoment = localToUTC(dateStr, time, from_timezone),
        fromFormatted = formatInTimezone(utcMoment, from_timezone),
        toFormatted = formatInTimezone(utcMoment, to_timezone),
        getOffsetStr = (tz) => {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            timeZoneName: 'shortOffset',
          }).formatToParts(utcMoment);
          return parts.find((p) => 'timeZoneName' === p.type)?.value ?? tz;
        };
      return [
        '🌍 Timezone Conversion',
        '',
        `From: **${from_timezone}** (${getOffsetStr(from_timezone)})`,
        `      ${fromFormatted}`,
        '',
        `To:   **${to_timezone}** (${getOffsetStr(to_timezone)})`,
        `      **${toFormatted}**`,
      ].join('\n');
    },
    is_weekend: async (params, onStage) => {
      const d = parseDate(params.date || void 0);
      onStage('📅 Checking day type…');
      const dow = d.getDay(),
        weekend = 0 === dow || 6 === dow;
      new Date(d).setDate(d.getDate() - ((dow + 1) % 7));
      const nextSat = new Date(d);
      nextSat.setDate(d.getDate() + ((6 - dow + 7) % 7 || 7));
      const nextSun = new Date(nextSat);
      nextSun.setDate(nextSat.getDate() + 1);
      const lines = [
        (weekend ? '🛋️' : '💼') + ' Weekend Check',
        '',
        `Date: ${formatDate(d)}`,
        `Type: **${weekend ? '🎉 Weekend' : '💼 Weekday'}**`,
      ];
      if (weekend) {
        if (
          (lines.push(''),
          lines.push(`This is a **${DAYS[dow]}** — enjoy your day off!`),
          6 === dow)
        ) {
          const sun = new Date(d);
          (sun.setDate(d.getDate() + 1), lines.push(`Tomorrow (Sunday): ${formatDate(sun)}`));
        }
      } else {
        const daysToWeekend = 6 - dow;
        (lines.push(''),
          lines.push(`Days until weekend: **${daysToWeekend}**`),
          lines.push(`Next Saturday: ${formatDate(nextSat)}`),
          lines.push(`Next Sunday:   ${formatDate(nextSun)}`));
      }
      return lines.join('\n');
    },
    business_days_between: async (params, onStage) => {
      const { date: date, date2: date2 } = params;
      if (!date || !date2) throw new Error('Requires both date and date2.');
      onStage('💼 Counting business days…');
      const d1 = parseDate(date),
        d2 = parseDate(date2),
        bizDays = countBusinessDays(d1, d2),
        totalDays = Math.round(Math.abs(d2 - d1) / 864e5),
        weekendDays = totalDays - bizDays + 1,
        later = d1 < d2 ? d2 : d1;
      return [
        '💼 Business Days Between Dates',
        '',
        `From: ${formatDate(d1 < d2 ? d1 : d2)}`,
        `To:   ${formatDate(later)}`,
        '',
        `**${bizDays} business day${1 !== bizDays ? 's' : ''}**`,
        `Weekend days: ${weekendDays}`,
        `Total calendar days: ${totalDays}`,
        `≈ ${(bizDays / 5).toFixed(1)} work weeks`,
      ].join('\n');
    },
    add_business_days: async (params, onStage) => {
      const { date: date, amount: amount } = params;
      if (null == amount) throw new Error('Requires amount param.');
      onStage('💼 Calculating business date…');
      const d = parseDate(date || void 0),
        result = addBusinessDaysToDate(d, amount);
      return [
        `💼 ${amount >= 0 ? `Add ${amount}` : `Subtract ${Math.abs(amount)}`} Business Day${1 !== Math.abs(amount) ? 's' : ''}`,
        '',
        `Start:  ${formatDate(d)}`,
        `Result: **${formatDate(result)}**`,
        `ISO:    ${toISO(result)}`,
        '',
        '(Skips weekends; does not account for public holidays)',
      ].join('\n');
    },
    next_weekday_occurrence: async (params, onStage) => {
      const { weekday: weekday, date: date, direction: direction } = params;
      if (!weekday) throw new Error('Requires weekday param (e.g. "Friday").');
      const capitalised = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase(),
        targetDow = DAYS.indexOf(capitalised);
      if (-1 === targetDow)
        throw new Error(`Unknown weekday "${weekday}". Use Monday, Tuesday, etc.`);
      onStage('📅 Finding next occurrence…');
      const d = parseDate(date || void 0),
        isPrev = 'previous' === direction || 'prev' === direction,
        sign = isPrev ? -1 : 1,
        result = new Date(d);
      for (result.setDate(result.getDate() + sign); result.getDay() !== targetDow; )
        result.setDate(result.getDate() + sign);
      const daysAway = Math.round(Math.abs(result - d) / 864e5);
      return [
        `📅 ${isPrev ? 'Previous' : 'Next'} ${capitalised}`,
        '',
        `Reference: ${formatDate(d)}`,
        `Result:    **${formatDate(result)}**`,
        `ISO:       ${toISO(result)}`,
        '',
        `${daysAway} day${1 !== daysAway ? 's' : ''} ${isPrev ? 'before' : 'from now'}`,
      ].join('\n');
    },
    age_calculator: async (params, onStage) => {
      const { date: date, date2: date2 } = params;
      if (!date) throw new Error('Requires date (birth date) param.');
      onStage('🎂 Calculating age…');
      const birth = parseDate(date),
        target = parseDate(date2 || void 0);
      if (birth > target) throw new Error('Birth date cannot be after target date.');
      const {
          years: years,
          months: months,
          days: days,
          totalDays: totalDays,
        } = detailedDiff(birth, target),
        nextBirthday = new Date(target.getFullYear(), birth.getMonth(), birth.getDate());
      nextBirthday <= target && nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
      const daysToNext = Math.round((nextBirthday - target) / 864e5);
      return [
        '🎂 Age Calculator',
        '',
        `Born:  ${formatDate(birth)}`,
        `As of: ${formatDate(target)}`,
        '',
        `Age: **${years} year${1 !== years ? 's' : ''}, ${months} month${1 !== months ? 's' : ''}, ${days} day${1 !== days ? 's' : ''}**`,
        '',
        `Total days alive: ${totalDays.toLocaleString()}`,
        `Total weeks:      ${(totalDays / 7).toFixed(1)}`,
        `Total months:     ${(totalDays / 30.44).toFixed(1)}`,
        '',
        `Next birthday in: ${daysToNext} day${1 !== daysToNext ? 's' : ''} (${formatDate(nextBirthday)})`,
      ].join('\n');
    },
    days_until_birthday: async (params, onStage) => {
      const { date: date } = params;
      if (!date) throw new Error('Requires date param (YYYY-MM-DD or MM-DD).');
      onStage('🎂 Calculating birthday countdown…');
      let month,
        day,
        birthYear,
        hasYear = !1;
      const shortMatch = date.match(/^(\d{2})-(\d{2})$/),
        fullMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (shortMatch) ((month = parseInt(shortMatch[1], 10)), (day = parseInt(shortMatch[2], 10)));
      else {
        if (!fullMatch) throw new Error('Date must be YYYY-MM-DD or MM-DD format.');
        ((birthYear = parseInt(fullMatch[1], 10)),
          (month = parseInt(fullMatch[2], 10)),
          (day = parseInt(fullMatch[3], 10)),
          (hasYear = !0));
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let nextBirthday = new Date(today.getFullYear(), month - 1, day);
      nextBirthday <= today && nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
      const daysUntil = Math.round((nextBirthday - today) / 864e5),
        turningAge = hasYear ? nextBirthday.getFullYear() - birthYear : null,
        lines = [
          '🎂 Birthday Countdown',
          '',
          `Birthday: ${MONTHS[month - 1]} ${day}${hasYear ? `, ${birthYear}` : ''}`,
          `Next:     **${formatDate(nextBirthday)}**`,
          '',
        ];
      return (
        0 === daysUntil
          ? lines.push("🎉 **Happy Birthday! It's today!**")
          : (lines.push(`**${daysUntil} day${1 !== daysUntil ? 's' : ''} away**`),
            lines.push(`≈ ${(daysUntil / 7).toFixed(1)} weeks`),
            null !== turningAge && lines.push(`Turning: **${turningAge} years old**`)),
        lines.join('\n')
      );
    },
    get_season: async (params, onStage) => {
      const d = parseDate(params.date || void 0),
        southern = (params.hemisphere || 'northern').toLowerCase().startsWith('s');
      onStage('🌍 Detecting season…');
      const month = d.getMonth() + 1,
        northSeason = SEASONS_NORTH.find((s) => s.months.includes(month)),
        oppositeSeason = SEASONS_NORTH.find(
          (s) =>
            s.name ===
            { Winter: 'Summer', Summer: 'Winter', Spring: 'Autumn', Autumn: 'Spring' }[
              northSeason.name
            ],
        ),
        season = southern ? oppositeSeason : northSeason,
        nextSeasonIdx = (SEASONS_NORTH.indexOf(northSeason) + 1) % 4,
        nextNorthStartMonth = SEASONS_NORTH[nextSeasonIdx].months[0],
        nextSeasonStart = new Date(
          month > nextNorthStartMonth ? d.getFullYear() + 1 : d.getFullYear(),
          nextNorthStartMonth - 1,
          1,
        ),
        daysToNext = Math.round((nextSeasonStart - d) / 864e5);
      return [
        `${season.emoji} Season Info`,
        '',
        `Date:       ${formatDate(d)}`,
        'Hemisphere: ' + (southern ? 'Southern' : 'Northern'),
        `Season:     **${season.name}**`,
        '',
        `Approx. next season in ~${daysToNext} days`,
        `(${formatDate(nextSeasonStart)})`,
      ].join('\n');
    },
    get_month_info: async (params, onStage) => {
      const d = parseDate(params.date || void 0);
      onStage('📅 Analysing month…');
      const year = d.getFullYear(),
        month = d.getMonth() + 1,
        dim = daysInMonth(year, month),
        firstDay = new Date(year, month - 1, 1),
        lastDay = new Date(year, month - 1, dim),
        leap = isLeapYear(year),
        counts = new Array(7).fill(0),
        cur = new Date(firstDay);
      for (; cur.getMonth() === month - 1; )
        (counts[cur.getDay()]++, cur.setDate(cur.getDate() + 1));
      const weekdayCounts = DAYS.map((name, i) => `  ${name.padEnd(10)} ${counts[i]}`).join('\n'),
        totalWeekends = counts[0] + counts[6],
        totalWeekdays = dim - totalWeekends,
        totalWeeks = Math.ceil((firstDay.getDay() + dim) / 7);
      return [
        `📅 Month Info: ${MONTHS[month - 1]} ${year}`,
        '',
        `First day: ${formatDate(firstDay)}`,
        `Last day:  ${formatDate(lastDay)}`,
        `Total days: **${dim}**`,
        'Leap year: ' + (leap ? 'Yes' : 'No'),
        `Calendar weeks: ${totalWeeks}`,
        '',
        `Weekdays:      ${totalWeekdays}`,
        `Weekend days:  ${totalWeekends}`,
        '',
        'Weekday breakdown:',
        weekdayCounts,
      ].join('\n');
    },
    get_quarter_info: async (params, onStage) => {
      const d = parseDate(params.date || void 0);
      onStage('📅 Getting quarter info…');
      const month = d.getMonth() + 1,
        quarter = Math.ceil(month / 3),
        year = d.getFullYear(),
        qStart = new Date(year, 3 * (quarter - 1), 1),
        qEnd = new Date(year, 3 * quarter, 0),
        totalDays = Math.round((qEnd - qStart) / 864e5) + 1,
        elapsed = Math.round((d - qStart) / 864e5) + 1,
        remaining = totalDays - elapsed,
        pct = ((elapsed / totalDays) * 100).toFixed(1);
      return [
        '📅 Quarter Info',
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
      ].join('\n');
    },
    lunar_phase: async (params, onStage) => {
      const d = parseDate(params.date || void 0);
      onStage('🌙 Calculating lunar phase…');
      const {
        phaseName: phaseName,
        emoji: emoji,
        phase: phase,
        illumination: illumination,
        daysUntilFull: daysUntilFull,
      } = getLunarPhase(d);
      return [
        '🌙 Lunar Phase',
        '',
        `Date:  ${formatDate(d)}`,
        `Phase: **${emoji} ${phaseName}**`,
        '',
        `Illumination:     ~${illumination}%`,
        `Days into cycle:  ${phase} / 29.53`,
        `Days until Full Moon: ~${daysUntilFull}`,
        '',
        'Phase cycle: 🌑 → 🌒 → 🌓 → 🌔 → 🌕 → 🌖 → 🌗 → 🌘 → 🌑',
        '(Approximate — based on mean synodic period)',
      ].join('\n');
    },
    week_bounds: async (params, onStage) => {
      const d = parseDate(params.date || void 0),
        startOnMonday = (params.week_start || 'sunday').toLowerCase().startsWith('m');
      onStage('📅 Finding week bounds…');
      const dow = d.getDay(),
        startOffset = startOnMonday ? (0 === dow ? -6 : 1 - dow) : -dow,
        weekStart = new Date(d);
      weekStart.setDate(d.getDate() + startOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const daysIn = [],
        cur = new Date(weekStart);
      for (; cur <= weekEnd; ) {
        const isTarget = toISO(cur) === toISO(d);
        (daysIn.push(`  ${isTarget ? '▶' : ' '} ${DAYS[cur.getDay()].padEnd(10)} ${toISO(cur)}`),
          cur.setDate(cur.getDate() + 1));
      }
      return [
        '📅 Week Bounds',
        '',
        `Reference date: ${formatDate(d)}`,
        'Week starts on: ' + (startOnMonday ? 'Monday' : 'Sunday'),
        '',
        `Start: **${formatDate(weekStart)}**`,
        `End:   **${formatDate(weekEnd)}**`,
        '',
        daysIn.join('\n'),
      ].join('\n');
    },
    month_bounds: async (params, onStage) => {
      const d = parseDate(params.date || void 0);
      onStage('📅 Finding month bounds…');
      const year = d.getFullYear(),
        month = d.getMonth() + 1,
        first = new Date(year, month - 1, 1),
        last = new Date(year, month, 0),
        dim = last.getDate(),
        daysElapsed = d.getDate(),
        daysRemaining = dim - daysElapsed,
        pct = ((daysElapsed / dim) * 100).toFixed(1);
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
      ].join('\n');
    },
    year_progress: async (params, onStage) => {
      const d = parseDate(params.date || void 0);
      onStage('📅 Calculating year progress…');
      const year = d.getFullYear(),
        leap = isLeapYear(year),
        daysInYr = leap ? 366 : 365,
        dayNum = getDayNumber(d),
        remaining = daysInYr - dayNum,
        pct = ((dayNum / daysInYr) * 100).toFixed(2),
        yearStart = new Date(year, 0, 1),
        yearEnd = new Date(year, 11, 31);
      return [
        `📅 Year Progress: ${year}`,
        '',
        `Date:         ${formatDate(d)}`,
        `Day:          **${dayNum}** of ${daysInYr}`,
        `Days elapsed: ${dayNum}`,
        `Days left:    ${remaining}`,
        'Leap year:    ' + (leap ? 'Yes ✓' : 'No'),
        '',
        `Progress: **${pct}%**`,
        '',
        `Year start: ${formatDate(yearStart)}`,
        `Year end:   ${formatDate(yearEnd)}`,
      ].join('\n');
    },
    detailed_difference: async (params, onStage) => {
      const { date: date, date2: date2 } = params;
      if (!date || !date2) throw new Error('Requires both date and date2.');
      onStage('📅 Calculating detailed difference…');
      const d1 = parseDate(date),
        d2 = parseDate(date2),
        earlier = d1 < d2 ? d1 : d2,
        later = d1 < d2 ? d2 : d1,
        {
          years: years,
          months: months,
          days: days,
          totalDays: totalDays,
          totalWeeks: totalWeeks,
          totalHours: totalHours,
          totalMinutes: totalMinutes,
        } = detailedDiff(d1, d2);
      return [
        '📅 Detailed Date Difference',
        '',
        `From: ${formatDate(earlier)}`,
        `To:   ${formatDate(later)}`,
        '',
        `**${years} year${1 !== years ? 's' : ''}, ${months} month${1 !== months ? 's' : ''}, ${days} day${1 !== days ? 's' : ''}**`,
        '',
        `Total days:    ${totalDays.toLocaleString()}`,
        `Total weeks:   ${totalWeeks}`,
        `Total hours:   ${totalHours.toLocaleString()}`,
        `Total minutes: ${totalMinutes.toLocaleString()}`,
      ].join('\n');
    },
    nth_weekday_of_month: async (params, onStage) => {
      const { date: date, nth: nth, weekday: weekday } = params;
      if (null == nth) throw new Error('Requires nth param (1–5 or -1 for last).');
      if (!weekday) throw new Error('Requires weekday param (e.g. "Monday").');
      onStage('📅 Finding weekday in month…');
      const ref = parseDate(date || void 0),
        year = ref.getFullYear(),
        mon = ref.getMonth() + 1,
        capitalised = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase(),
        n = Math.round(Number(nth)),
        result = getNthWeekdayOfMonth(year, mon, n, capitalised);
      return [
        `📅 ${-1 === n ? 'Last' : (['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`)} ${capitalised} of ${MONTHS[mon - 1]} ${year}`,
        '',
        `Result: **${formatDate(result)}**`,
        `ISO:    ${toISO(result)}`,
      ].join('\n');
    },
    timezone_overlap: async (params, onStage) => {
      const { timezone1: timezone1, timezone2: timezone2, date: date } = params;
      if (!timezone1 || !timezone2) throw new Error('Requires timezone1 and timezone2.');
      onStage('🌍 Finding business hour overlap…');
      const dateStr = date || toISO(new Date()),
        rows = [];
      let overlapStart = null,
        overlapEnd = null;
      for (let utcHour = 0; utcHour < 24; utcHour++) {
        const utcMoment = new Date(`${dateStr}T${String(utcHour).padStart(2, '0')}:00:00Z`),
          getLocalHour = (tz) => {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              hour: 'numeric',
              hour12: !1,
            }).formatToParts(utcMoment);
            return parseInt(parts.find((p) => 'hour' === p.type)?.value ?? '0', 10);
          },
          h1 = getLocalHour(timezone1),
          h2 = getLocalHour(timezone2),
          tz1Biz = h1 >= 9 && h1 < 17,
          tz2Biz = h2 >= 9 && h2 < 17,
          overlap = tz1Biz && tz2Biz;
        if (
          (overlap && (null === overlapStart && (overlapStart = utcHour), (overlapEnd = utcHour)),
          tz1Biz || tz2Biz)
        ) {
          const fmt = (h) => `${String(h).padStart(2, '0')}:00`,
            marker = overlap ? ' ◀ OVERLAP' : '';
          rows.push(
            `  ${fmt(h1)} (${timezone1.split('/')[1] ?? timezone1})  |  ${fmt(h2)} (${timezone2.split('/')[1] ?? timezone2})${marker}`,
          );
        }
      }
      const overlapHours = null !== overlapStart ? overlapEnd - overlapStart + 1 : 0,
        lines = [
          '🌍 Business Hours Overlap',
          `   (9:00–17:00 local time, ${dateStr})`,
          '',
          `Zone 1: ${timezone1}`,
          `Zone 2: ${timezone2}`,
          '',
        ];
      return (
        overlapHours > 0
          ? (lines.push(`✅ **${overlapHours} hour${1 !== overlapHours ? 's' : ''} of overlap**`),
            lines.push(''),
            lines.push('Timezone 1        |  Timezone 2'),
            lines.push('──────────────────────────────────'),
            lines.push(...rows))
          : (lines.push('❌ **No overlapping business hours** on this date.'),
            lines.push(''),
            lines.push('These timezones have no common 9am–5pm window.')),
        lines.join('\n')
      );
    },
    century_decade_info: async (params, onStage) => {
      const d = parseDate(params.date || void 0);
      onStage('📅 Calculating century and decade…');
      const year = d.getFullYear(),
        decade = 10 * Math.floor(year / 10),
        century = Math.ceil(year / 100),
        millennium = Math.ceil(year / 1e3),
        ordinal = (n) => {
          const s = ['th', 'st', 'nd', 'rd'],
            v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        },
        yearInDecade = year - decade + 1,
        yearInCentury = year - 100 * (century - 1),
        yearInMillennium = year - 1e3 * (millennium - 1);
      return [
        '📅 Century & Decade Info',
        '',
        `Date:  ${formatDate(d)}`,
        `Year:  **${year}**`,
        '',
        `Decade:     **${decade}s**  (year ${yearInDecade} of 10)`,
        `Century:    **${ordinal(century)} century**  (year ${yearInCentury} of 100)`,
        `Millennium: **${ordinal(millennium)} millennium**  (year ${yearInMillennium} of 1000)`,
        '',
        `Decade ends:     ${decade + 9}`,
        'Century ends:    ' + 100 * century,
        'Millennium ends: ' + 1e3 * millennium,
      ].join('\n');
    },
    unix_converter: async (params, onStage) => {
      const { operation: operation, date: date, unix_timestamp: unix_timestamp } = params;
      if (!operation) throw new Error('Requires operation: "to_unix" or "from_unix".');
      if ((onStage('🔢 Converting timestamp…'), 'to_unix' === operation)) {
        const d = parseDate(date || void 0),
          ts = Math.floor(d.getTime() / 1e3),
          tsMs = d.getTime();
        return [
          '🔢 Date → Unix Timestamp',
          '',
          `Date: ${formatDate(d)}`,
          '',
          `Unix (seconds):      **${ts}**`,
          `Unix (milliseconds): ${tsMs}`,
          `ISO 8601:            ${d.toISOString()}`,
        ].join('\n');
      }
      if ('from_unix' === operation) {
        if (null == unix_timestamp) throw new Error('from_unix requires a unix_timestamp param.');
        const ts = Number(unix_timestamp),
          d = ts > 1e10 ? new Date(ts) : new Date(1e3 * ts);
        if (isNaN(d.getTime())) throw new Error('Invalid Unix timestamp.');
        return [
          '🔢 Unix Timestamp → Date',
          '',
          `Timestamp: ${ts}`,
          '',
          `Date (UTC):   **${d.toUTCString()}**`,
          `Date (local): ${d.toString()}`,
          `ISO 8601:     ${d.toISOString()}`,
          `Simple:       ${toISO(d)}`,
        ].join('\n');
      }
      throw new Error(`Unknown operation "${operation}". Use "to_unix" or "from_unix".`);
    },
    time_until_datetime: async (params, onStage) => {
      const { date: date, time: time, timezone: timezone } = params;
      if (!date) throw new Error('Requires date param.');
      onStage('⏱️ Calculating countdown…');
      const timeStr = time || '00:00';
      let targetDate;
      if (timezone) targetDate = localToUTC(date, timeStr, timezone);
      else {
        const [y, mo, d] = date.split('-').map(Number),
          [hh, mm] = timeStr.split(':').map(Number);
        targetDate = new Date(y, mo - 1, d, hh, mm, 0);
      }
      const diffMs = targetDate - new Date(),
        isPast = diffMs < 0,
        absMs = Math.abs(diffMs),
        totalSeconds = Math.floor(absMs / 1e3),
        totalMinutes = Math.floor(totalSeconds / 60),
        totalHours = Math.floor(totalMinutes / 60),
        totalDays = Math.floor(totalHours / 24),
        remHours = totalHours % 24,
        remMinutes = totalMinutes % 60,
        remSeconds = totalSeconds % 60,
        weeks = Math.floor(totalDays / 7),
        remDays = totalDays % 7;
      return [
        `⏱️ ${isPast ? 'Time Since' : 'Time Until'} Event`,
        '',
        `Event: ${date} at ${timeStr}${timezone ? ` (${timezone})` : ''}`,
        `**${totalDays}d ${remHours}h ${remMinutes}m ${remSeconds}s**`,
        weeks > 0
          ? `(${weeks} week${1 !== weeks ? 's' : ''}, ${remDays} day${1 !== remDays ? 's' : ''}, ${remHours}h)`
          : '',
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
