async function getFreshGoogleCreds(creds) {
  const { getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

async function calFetch(creds, url, options = {}) {
  const fresh = await getFreshGoogleCreds(creds);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Calendar API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

function toRFC3339(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: "${dateStr}"`);
  return date.toISOString();
}

// ─── Existing API ────────────────────────────────────────────────────────────

export async function listCalendars(creds) {
  const data = await calFetch(creds, `${CALENDAR_BASE}/users/me/calendarList?maxResults=50`);
  return data.items ?? [];
}

export async function listEvents(
  creds,
  calendarId = 'primary',
  { maxResults = 20, timeMin, timeMax, singleEvents = true, orderBy = 'startTime', query } = {},
) {
  const params = new URLSearchParams({
    maxResults: String(Math.min(maxResults, 100)),
    singleEvents: String(singleEvents),
    orderBy,
  });

  if (timeMin) params.set('timeMin', toRFC3339(timeMin));
  if (timeMax) params.set('timeMax', toRFC3339(timeMax));
  if (query) params.set('q', query);
  if (!timeMin && !timeMax) params.set('timeMin', new Date().toISOString());

  const data = await calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  );
  return data.items ?? [];
}

export async function getEvent(creds, calendarId, eventId) {
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
  );
}

export async function createEvent(
  creds,
  calendarId = 'primary',
  {
    summary,
    description = '',
    location = '',
    startDateTime,
    endDateTime,
    attendees = [],
    allDay = false,
    timeZone,
    recurrence = [],
    colorId,
    reminders,
    visibility,
    status,
  } = {},
) {
  if (!summary) throw new Error('Event summary (title) is required');
  if (!startDateTime) throw new Error('Start date/time is required');

  let start;
  let end;

  if (allDay) {
    const startDate = startDateTime.split('T')[0];
    const endDate = endDateTime ? endDateTime.split('T')[0] : startDate;
    start = { date: startDate };
    end = { date: endDate };
  } else {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    start = { dateTime: toRFC3339(startDateTime), timeZone: tz };
    end = { dateTime: toRFC3339(endDateTime || startDateTime), timeZone: tz };
  }

  const body = {
    summary,
    description,
    location,
    start,
    end,
    ...(attendees.length ? { attendees: attendees.map((email) => ({ email: email.trim() })) } : {}),
    ...(recurrence.length ? { recurrence } : {}),
    ...(colorId ? { colorId: String(colorId) } : {}),
    ...(reminders ? { reminders } : {}),
    ...(visibility ? { visibility } : {}),
    ...(status ? { status } : {}),
  };

  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateEvent(creds, calendarId = 'primary', eventId, updates = {}) {
  const existing = await getEvent(creds, calendarId, eventId);
  const merged = { ...existing, ...updates };
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PUT',
      body: JSON.stringify(merged),
    },
  );
}

export async function deleteEvent(creds, calendarId = 'primary', eventId) {
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function getUpcomingEvents(creds, days = 7, maxResults = 20) {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();
  return listEvents(creds, 'primary', {
    timeMin,
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

export async function getTodayEvents(creds) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  ).toISOString();
  return listEvents(creds, 'primary', {
    timeMin: startOfDay,
    timeMax: endOfDay,
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

export async function searchEvents(creds, query, maxResults = 20) {
  const timeMin = new Date(Date.now() - 30 * 86_400_000).toISOString();
  return listEvents(creds, 'primary', {
    query,
    timeMin,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

// ─── New API helpers ──────────────────────────────────────────────────────────

/** Events for the current calendar week (Mon–Sun). */
export async function getThisWeekEvents(creds) {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59);
  return listEvents(creds, 'primary', {
    timeMin: monday.toISOString(),
    timeMax: sunday.toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

/** Events for next calendar week. */
export async function getNextWeekEvents(creds) {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? 1 : 8 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59);
  return listEvents(creds, 'primary', {
    timeMin: monday.toISOString(),
    timeMax: sunday.toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

/** Events for the current calendar month. */
export async function getThisMonthEvents(creds) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return listEvents(creds, 'primary', {
    timeMin: start,
    timeMax: end,
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

/** The single next upcoming event from now. */
export async function getNextEvent(creds) {
  const events = await listEvents(creds, 'primary', {
    timeMin: new Date().toISOString(),
    maxResults: 1,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return events[0] ?? null;
}

/**
 * Find free slots of at least `minMinutes` within working hours on a given date.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} workStart - hour (0-23), default 9
 * @param {number} workEnd   - hour (0-23), default 18
 * @param {number} minMinutes - minimum slot length in minutes, default 30
 */
export async function getFreeSlots(creds, dateStr, workStart = 9, workEnd = 18, minMinutes = 30) {
  const dayStart = new Date(`${dateStr}T${String(workStart).padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${dateStr}T${String(workEnd).padStart(2, '0')}:00:00`);
  const events = await listEvents(creds, 'primary', {
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const busy = events
    .filter((e) => e.start?.dateTime)
    .map((e) => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))
    .sort((a, b) => a.start - b.start);

  const slots = [];
  let cursor = dayStart;

  for (const { start, end } of busy) {
    if (cursor < start) {
      const gapMins = (start - cursor) / 60_000;
      if (gapMins >= minMinutes) slots.push({ start: new Date(cursor), end: new Date(start) });
    }
    if (end > cursor) cursor = end;
  }
  if (cursor < dayEnd) {
    const gapMins = (dayEnd - cursor) / 60_000;
    if (gapMins >= minMinutes) slots.push({ start: new Date(cursor), end: new Date(dayEnd) });
  }

  return slots;
}

/**
 * Count events in a time range.
 */
export async function countEvents(creds, calendarId = 'primary', timeMin, timeMax) {
  const events = await listEvents(creds, calendarId, {
    timeMin: toRFC3339(timeMin),
    timeMax: toRFC3339(timeMax),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return events.length;
}

/**
 * Find events that include a specific attendee email.
 */
export async function getEventsByAttendee(creds, attendeeEmail, maxResults = 20) {
  return searchEvents(creds, attendeeEmail, maxResults);
}

/**
 * Patch specific fields on an event without a full replace.
 */
export async function patchEvent(creds, calendarId = 'primary', eventId, patch = {}) {
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
}

/**
 * Move event to a different calendar.
 */
export async function moveEvent(
  creds,
  sourceCalendarId = 'primary',
  eventId,
  destinationCalendarId,
) {
  if (!destinationCalendarId) throw new Error('destinationCalendarId is required');
  const params = new URLSearchParams({ destination: destinationCalendarId });
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(sourceCalendarId)}/events/${eventId}/move?${params}`,
    {
      method: 'POST',
    },
  );
}

/**
 * Duplicate an existing event, optionally shifting its time.
 * @param {number} shiftDays - days to shift the duplicate (default 0 = same time)
 */
export async function duplicateEvent(creds, calendarId = 'primary', eventId, shiftDays = 0) {
  const event = await getEvent(creds, calendarId, eventId);
  const clone = { ...event };
  delete clone.id;
  delete clone.iCalUID;
  delete clone.etag;
  delete clone.htmlLink;
  delete clone.recurringEventId;

  if (shiftDays !== 0) {
    const shift = shiftDays * 86_400_000;
    if (clone.start?.dateTime) {
      clone.start = {
        ...clone.start,
        dateTime: new Date(new Date(clone.start.dateTime).getTime() + shift).toISOString(),
      };
      clone.end = {
        ...clone.end,
        dateTime: new Date(new Date(clone.end.dateTime).getTime() + shift).toISOString(),
      };
    } else if (clone.start?.date) {
      const shiftDate = (d) => {
        const shifted = new Date(new Date(`${d}T00:00:00`).getTime() + shift);
        return shifted.toISOString().split('T')[0];
      };
      clone.start = { date: shiftDate(clone.start.date) };
      clone.end = { date: shiftDate(clone.end.date) };
    }
  }

  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(clone),
  });
}

/**
 * Get events within a specific date range on any named calendar.
 */
export async function getEventsInRange(
  creds,
  calendarId = 'primary',
  startDate,
  endDate,
  maxResults = 50,
) {
  return listEvents(creds, calendarId, {
    timeMin: toRFC3339(startDate),
    timeMax: toRFC3339(endDate),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

/**
 * Delete all events on a given date (YYYY-MM-DD). Returns count of deleted events.
 */
export async function clearDay(creds, calendarId = 'primary', dateStr) {
  const start = new Date(`${dateStr}T00:00:00`).toISOString();
  const end = new Date(`${dateStr}T23:59:59`).toISOString();
  const events = await listEvents(creds, calendarId, {
    timeMin: start,
    timeMax: end,
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime',
  });
  await Promise.all(events.map((e) => deleteEvent(creds, calendarId, e.id)));
  return events.length;
}

/**
 * Get all events involving a specific location keyword.
 */
export async function getEventsByLocation(creds, locationQuery, maxResults = 20) {
  return searchEvents(creds, locationQuery, maxResults);
}

/**
 * Query the Freebusy API to get busy intervals for a list of calendars.
 * Returns { calendars: { [id]: { busy: [{start, end}] } } }
 */
export async function getFreeBusy(creds, calendarIds = ['primary'], timeMin, timeMax) {
  const body = {
    timeMin: toRFC3339(timeMin),
    timeMax: toRFC3339(timeMax),
    items: calendarIds.map((id) => ({ id })),
  };
  return calFetch(creds, `${CALENDAR_BASE}/freeBusy`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Convenience: list events for a specific named day (today/tomorrow/yesterday or YYYY-MM-DD).
 */
export async function getEventsOnDate(creds, dateStr) {
  const lower = (dateStr ?? '').toLowerCase().trim();
  const now = new Date();
  let target;
  if (lower === 'today') target = now;
  else if (lower === 'tomorrow') target = new Date(now.getTime() + 86_400_000);
  else if (lower === 'yesterday') target = new Date(now.getTime() - 86_400_000);
  else target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) throw new Error(`Invalid date: "${dateStr}"`);
  const y = target.getFullYear();
  const m = target.getMonth();
  const d = target.getDate();
  const start = new Date(y, m, d).toISOString();
  const end = new Date(y, m, d, 23, 59, 59).toISOString();
  return listEvents(creds, 'primary', {
    timeMin: start,
    timeMax: end,
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime',
  });
}
