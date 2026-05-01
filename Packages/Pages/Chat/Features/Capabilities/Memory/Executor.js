import { createExecutor } from '../Shared/createExecutor.js';
import { clampInteger, normalizeFileList } from './Utils.js';

// ─── Date resolution ───────────────────────────────────────────────────────────

/**
 * Resolve a natural-language date string to a { start, end } pair of Date
 * objects representing the full calendar day (midnight → midnight).
 */
function resolveDate(dateStr = '') {
  const raw = String(dateStr ?? '')
    .trim()
    .toLowerCase();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "today"
  if (!raw || raw === 'today') {
    return { start: today, end: new Date(today.getTime() + 86400000) };
  }

  // "yesterday"
  if (raw === 'yesterday') {
    const d = new Date(today.getTime() - 86400000);
    return { start: d, end: today };
  }

  // "X days ago"
  const daysAgoMatch = raw.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1], 10);
    const d = new Date(today.getTime() - n * 86400000);
    return { start: d, end: new Date(d.getTime() + 86400000) };
  }

  // "last <weekday>" or just "<weekday>"
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekdayMatch = raw.match(
    /^(?:last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (weekdayMatch) {
    const targetDay = DAYS.indexOf(weekdayMatch[1]);
    const currentDay = today.getDay();
    let daysBack = currentDay - targetDay;
    if (daysBack <= 0) daysBack += 7; // always go back, never same day
    const d = new Date(today.getTime() - daysBack * 86400000);
    return { start: d, end: new Date(d.getTime() + 86400000) };
  }

  // ISO date "2024-01-15"
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    return { start: d, end: new Date(d.getTime() + 86400000) };
  }

  // "January 15" / "Jan 15" / "15 January"
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  const monthShort = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  for (let i = 0; i < monthNames.length; i++) {
    const full = monthNames[i],
      short = monthShort[i];
    const m = raw.match(
      new RegExp(`(?:${full}|${short})\\s+(\\d{1,2})|^(\\d{1,2})\\s+(?:${full}|${short})`),
    );
    if (m) {
      const dayNum = parseInt(m[1] || m[2], 10);
      const d = new Date(today.getFullYear(), i, dayNum);
      // If the date is in the future, assume last year
      if (d > today) d.setFullYear(d.getFullYear() - 1);
      return { start: d, end: new Date(d.getTime() + 86400000) };
    }
  }

  // Fallback: try native Date parse
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const d = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    return { start: d, end: new Date(d.getTime() + 86400000) };
  }

  return null; // unparseable
}

// ─── Time range resolution ─────────────────────────────────────────────────────

/**
 * Given a day's { start } and a time_range string, return a refined
 * { start, end } window within that day.
 */
function resolveTimeRange(dayStart, timeRangeStr = '') {
  const raw = String(timeRangeStr ?? '')
    .trim()
    .toLowerCase();

  const dayMs = dayStart.getTime();

  // Named slots
  if (raw.includes('morning'))
    return { start: new Date(dayMs + 6 * 3600000), end: new Date(dayMs + 12 * 3600000) };
  if (raw.includes('afternoon'))
    return { start: new Date(dayMs + 12 * 3600000), end: new Date(dayMs + 18 * 3600000) };
  if (raw.includes('evening'))
    return { start: new Date(dayMs + 18 * 3600000), end: new Date(dayMs + 22 * 3600000) };
  if (raw.includes('night') || raw.includes('midnight'))
    return { start: new Date(dayMs + 22 * 3600000), end: new Date(dayMs + 30 * 3600000) }; // 10pm–6am next day
  if (raw.includes('noon') && !raw.includes('before') && !raw.includes('after')) {
    return { start: new Date(dayMs + 11 * 3600000), end: new Date(dayMs + 13 * 3600000) };
  }
  if (raw.includes('before noon') || raw.includes('before 12')) {
    return { start: new Date(dayMs), end: new Date(dayMs + 12 * 3600000) };
  }
  if (raw.includes('after noon') || raw.includes('after 12')) {
    return { start: new Date(dayMs + 12 * 3600000), end: new Date(dayMs + 86400000) };
  }

  // "between Xpm and Ypm" / "between X and Y"
  const betweenMatch = raw.match(
    /between\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+and\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
  );
  if (betweenMatch) {
    const startH = resolveHour(parseInt(betweenMatch[1]), betweenMatch[3]);
    const endH = resolveHour(parseInt(betweenMatch[4]), betweenMatch[6]);
    return {
      start: new Date(dayMs + startH * 3600000),
      end: new Date(dayMs + endH * 3600000),
    };
  }

  // "around Xpm" / "at Xpm" → ±45 min window
  const aroundMatch = raw.match(/(?:around|at|~)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (aroundMatch) {
    const h = resolveHour(parseInt(aroundMatch[1]), aroundMatch[3]);
    return {
      start: new Date(dayMs + h * 3600000 - 45 * 60000),
      end: new Date(dayMs + h * 3600000 + 45 * 60000),
    };
  }

  // "before Xpm"
  const beforeMatch = raw.match(/before\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (beforeMatch) {
    const h = resolveHour(parseInt(beforeMatch[1]), beforeMatch[3]);
    return { start: new Date(dayMs), end: new Date(dayMs + h * 3600000) };
  }

  // "after Xpm"
  const afterMatch = raw.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (afterMatch) {
    const h = resolveHour(parseInt(afterMatch[1]), afterMatch[3]);
    return { start: new Date(dayMs + h * 3600000), end: new Date(dayMs + 86400000) };
  }

  // Plain hour like "3pm", "15:00"
  const plainHourMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (plainHourMatch) {
    const h = resolveHour(parseInt(plainHourMatch[1]), plainHourMatch[3]);
    return {
      start: new Date(dayMs + h * 3600000 - 45 * 60000),
      end: new Date(dayMs + h * 3600000 + 45 * 60000),
    };
  }

  // Unresolvable — return full day
  return { start: new Date(dayMs), end: new Date(dayMs + 86400000) };
}

function resolveHour(h, meridiem = '') {
  const m = String(meridiem ?? '').toLowerCase();
  if (m === 'pm' && h < 12) return h + 12;
  if (m === 'am' && h === 12) return 0;
  return h;
}

// ─── Chat smart-read ────────────────────────────────────────────────────────────

const SMALL_CHAT_THRESHOLD = 10; // return everything
const MEDIUM_CHAT_THRESHOLD = 30; // head + summary + tail with 5 messages each side
const HEAD_MESSAGES_LARGE = 4; // first N messages for large chats
const TAIL_MESSAGES_LARGE = 4; // last N messages for large chats
const HEAD_MESSAGES_MEDIUM = 5;
const TAIL_MESSAGES_MEDIUM = 5;

function formatMessage(msg, index) {
  const role = msg.role === 'assistant' ? 'Joanium' : 'User';
  const content = String(msg.content ?? '').trim();
  const short = content.length > 800 ? content.slice(0, 800) + '…' : content;
  const attachments =
    Array.isArray(msg.attachments) && msg.attachments.length
      ? ` [+${msg.attachments.length} attachment(s)]`
      : '';
  return `[${index + 1}] ${role}: ${short}${attachments}`;
}

function buildSmartChatContent(chat) {
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  const total = messages.length;
  const summary = String(chat.conversationSummary ?? '').trim();

  if (total === 0) return '(no messages)';

  // Small: return everything
  if (total <= SMALL_CHAT_THRESHOLD) {
    return messages.map((m, i) => formatMessage(m, i)).join('\n\n');
  }

  // Medium: head + summary + tail
  if (total <= MEDIUM_CHAT_THRESHOLD) {
    const head = messages.slice(0, HEAD_MESSAGES_MEDIUM).map((m, i) => formatMessage(m, i));
    const tail = messages
      .slice(-TAIL_MESSAGES_MEDIUM)
      .map((m, i) => formatMessage(m, total - TAIL_MESSAGES_MEDIUM + i));
    const middle = summary
      ? `\n--- Mid-conversation summary (${total - HEAD_MESSAGES_MEDIUM - TAIL_MESSAGES_MEDIUM} messages) ---\n${summary}\n---`
      : `\n… (${total - HEAD_MESSAGES_MEDIUM - TAIL_MESSAGES_MEDIUM} messages in between) …`;
    return [...head, middle, ...tail].join('\n\n');
  }

  // Large: tighter head + summary + tail
  const head = messages.slice(0, HEAD_MESSAGES_LARGE).map((m, i) => formatMessage(m, i));
  const tail = messages
    .slice(-TAIL_MESSAGES_LARGE)
    .map((m, i) => formatMessage(m, total - TAIL_MESSAGES_LARGE + i));
  const skipped = total - HEAD_MESSAGES_LARGE - TAIL_MESSAGES_LARGE;
  const middle = summary
    ? `\n--- Compacted summary of middle ${skipped} messages ---\n${summary}\n---`
    : `\n… (${skipped} messages in between — no summary available) …`;

  return [...head, middle, ...tail].join('\n\n');
}

// ─── Shared helpers ─────────────────────────────────────────────────────────────

function formatChatTime(updatedAt) {
  const d = new Date(updatedAt);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatChatOverview(chat) {
  const time = formatChatTime(chat.updatedAt);
  const msgCount = Array.isArray(chat.messages) ? chat.messages.length : 0;
  const summary = String(chat.conversationSummary ?? '').trim();
  const summaryLine = summary
    ? `\n   Summary: ${summary.slice(0, 200)}${summary.length > 200 ? '…' : ''}`
    : '';
  return `• [${time}] "${chat.title}" (${msgCount} messages) — ID: ${chat.id}${summaryLine}`;
}

function filterChatsByWindow(chats, start, end) {
  return chats.filter((chat) => {
    const t = new Date(chat.updatedAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

function noChatMessage(dateLabel, extraInfo = '') {
  return `No chats found${dateLabel ? ` for ${dateLabel}` : ''}${extraInfo ? ` (${extraInfo})` : ''}.`;
}

// ─── Executor ──────────────────────────────────────────────────────────────────

export const { handles, execute } = createExecutor({
  name: 'MemoryExecutor',
  tools: [
    'list_personal_memory_files',
    'search_personal_memory',
    'read_personal_memory_files',
    'get_chats_by_date',
    'get_chats_in_time_range',
    'read_chat_detail',
  ],
  handlers: {
    list_personal_memory_files: async (_params, onStage) => {
      onStage('Checking personal memory files');
      const files = (await window.electronAPI?.invoke?.('list-personal-memory-files')) ?? [];
      return files.length
        ? files
            .map((file) => {
              const factsLabel = file.bulletCount
                ? `${file.bulletCount} fact${file.bulletCount === 1 ? '' : 's'}`
                : file.empty
                  ? 'empty'
                  : `${file.lineCount} line${file.lineCount === 1 ? '' : 's'}`;
              return `- ${file.filename} [${factsLabel}]`;
            })
            .join('\n')
        : 'No personal memory files are available yet.';
    },

    search_personal_memory: async (params, onStage) => {
      const query = String(params.query ?? '').trim();
      if (!query) throw new Error('Missing required param: query');
      onStage(`Searching personal memory for "${query}"`);
      const limit = clampInteger(params.limit, 5, 1, 12);
      const results =
        (await window.electronAPI?.invoke?.('search-personal-memory', query, { limit })) ?? [];
      if (!results.length) return `No personal memory matches found for "${query}".`;
      const lines = [`Personal memory matches for "${query}":`, ''];
      for (const result of results) {
        lines.push(`- ${result.filename}`);
        if (Array.isArray(result.matches) && result.matches.length)
          lines.push(`  Matches: ${result.matches.join(' | ')}`);
      }
      return lines.join('\n');
    },

    read_personal_memory_files: async (params, onStage) => {
      const files = normalizeFileList(params.files);
      if (!files.length) throw new Error('Missing required param: files');
      onStage(`Reading ${files.length} personal memory file${files.length === 1 ? '' : 's'}`);
      const entries =
        (await window.electronAPI?.invoke?.('read-personal-memory-files', files)) ?? [];
      return entries.length
        ? entries
            .map((entry) =>
              [`${entry.filename}`, '```md', entry.content?.trim() || '# Empty', '```'].join('\n'),
            )
            .join('\n\n')
        : 'No personal memory files were returned.';
    },

    get_chats_by_date: async (params, onStage) => {
      const dateStr = String(params.date ?? '').trim();
      if (!dateStr) throw new Error('Missing required param: date');

      onStage(`Looking up chats from "${dateStr}"`);

      const window_ = resolveDate(dateStr);
      if (!window_)
        return `Could not understand the date "${dateStr}". Try "yesterday", "Monday", or "2024-01-15".`;

      const allChats = (await window.electronAPI?.invoke?.('get-chats')) ?? [];
      const matched = filterChatsByWindow(allChats, window_.start, window_.end);

      if (!matched.length) return noChatMessage(dateStr);

      const dateLabel = window_.start.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const lines = [
        `Found ${matched.length} chat${matched.length === 1 ? '' : 's'} on ${dateLabel}:`,
        '',
        ...matched.map(formatChatOverview),
        '',
        'Use read_chat_detail with a chat ID to read the full conversation.',
      ];

      return lines.join('\n');
    },

    get_chats_in_time_range: async (params, onStage) => {
      const dateStr = String(params.date ?? '').trim();
      const timeRangeStr = String(params.time_range ?? '').trim();
      if (!dateStr) throw new Error('Missing required param: date');
      if (!timeRangeStr) throw new Error('Missing required param: time_range');

      onStage(`Looking up chats from "${dateStr}" in the "${timeRangeStr}"`);

      const dayWindow = resolveDate(dateStr);
      if (!dayWindow) return `Could not understand the date "${dateStr}".`;

      const timeWindow = resolveTimeRange(dayWindow.start, timeRangeStr);

      const allChats = (await window.electronAPI?.invoke?.('get-chats')) ?? [];
      const matched = filterChatsByWindow(allChats, timeWindow.start, timeWindow.end);

      if (!matched.length) {
        const rangeLabel = `${timeWindow.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${timeWindow.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        return noChatMessage(`${dateStr} ${timeRangeStr}`, rangeLabel);
      }

      const dateLabel = dayWindow.start.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const rangeLabel = `${timeWindow.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${timeWindow.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

      const lines = [
        `Found ${matched.length} chat${matched.length === 1 ? '' : 's'} on ${dateLabel} between ${rangeLabel}:`,
        '',
        ...matched.map(formatChatOverview),
        '',
        'Use read_chat_detail with a chat ID to read the full conversation.',
      ];

      return lines.join('\n');
    },

    read_chat_detail: async (params, onStage) => {
      const chatId = String(params.chat_id ?? '').trim();
      if (!chatId) throw new Error('Missing required param: chat_id');

      onStage(`Reading chat "${chatId}"`);

      let chat;
      try {
        chat = await window.electronAPI?.invoke?.('load-chat', chatId);
      } catch {
        return `Chat "${chatId}" could not be found. Make sure the ID is correct.`;
      }

      if (!chat) return `Chat "${chatId}" not found.`;

      const messages = Array.isArray(chat.messages) ? chat.messages : [];
      const total = messages.length;

      const header = [
        `Chat: "${chat.title}"`,
        `Date: ${new Date(chat.updatedAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        `Messages: ${total}`,
        total > SMALL_CHAT_THRESHOLD
          ? `(Large chat — showing opening intent, mid-section summary, and final conclusion)`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const content = buildSmartChatContent(chat);

      return `${header}\n\n${content}`;
    },
  },
});
