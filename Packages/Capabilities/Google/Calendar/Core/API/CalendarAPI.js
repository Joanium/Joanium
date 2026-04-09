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

// 21 – rename only the title
export async function renameEvent(creds, calendarId = 'primary', eventId, newSummary) {
  if (!newSummary?.trim()) throw new Error('newSummary is required');
  return patchEvent(creds, calendarId, eventId, { summary: newSummary.trim() });
}

// 22 – set event color (colorId 1–11)
export async function setEventColor(creds, calendarId = 'primary', eventId, colorId) {
  return patchEvent(creds, calendarId, eventId, { colorId: String(colorId) });
}

// 23 – this weekend (Sat + Sun)
export async function getThisWeekendEvents(creds) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,6=Sat
  const diffToSat = day === 0 ? -1 : 6 - day;
  const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  sun.setHours(23, 59, 59);
  return listEvents(creds, 'primary', {
    timeMin: sat.toISOString(),
    timeMax: sun.toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime',
  });
}

// 24 – replace all reminders on an event
export async function setEventReminders(creds, calendarId = 'primary', eventId, minutesList = []) {
  const reminders = minutesList.length
    ? {
        useDefault: false,
        overrides: minutesList.map((m) => ({ method: 'popup', minutes: Number(m) })),
      }
    : { useDefault: true };
  return patchEvent(creds, calendarId, eventId, { reminders });
}

// 25 – bulk create events from an array
export async function bulkCreateEvents(creds, calendarId = 'primary', eventDataArray = []) {
  if (!eventDataArray.length) throw new Error('eventDataArray must not be empty');
  return Promise.all(eventDataArray.map((ed) => createEvent(creds, calendarId, ed)));
}

// 26 – get all events that have a Google Meet / video conference link
export async function getEventsWithVideoConference(creds, days = 30, maxResults = 20) {
  const events = await getUpcomingEvents(creds, days, maxResults);
  return events.filter((e) => e.conferenceData?.entryPoints?.length > 0);
}

// 27 – accept / decline / tentative RSVP on an event
export async function rsvpEvent(creds, calendarId = 'primary', eventId, selfEmail, status) {
  const VALID = ['accepted', 'declined', 'tentative'];
  if (!VALID.includes(status)) throw new Error(`status must be one of: ${VALID.join(', ')}`);
  const event = await getEvent(creds, calendarId, eventId);
  const attendees = (event.attendees ?? []).map((a) =>
    a.email.toLowerCase() === selfEmail.toLowerCase() ? { ...a, responseStatus: status } : a,
  );
  return patchEvent(creds, calendarId, eventId, { attendees });
}

// 28 – get events added / updated since a given timestamp (changelog)
export async function getRecentlyModifiedEvents(
  creds,
  calendarId = 'primary',
  updatedMinISO,
  maxResults = 20,
) {
  if (!updatedMinISO) throw new Error('updatedMinISO is required');
  const params = new URLSearchParams({
    updatedMin: new Date(updatedMinISO).toISOString(),
    maxResults: String(Math.min(maxResults, 100)),
    singleEvents: 'true',
    orderBy: 'updated',
    showDeleted: 'false',
  });
  const data = await calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  );
  return data.items ?? [];
}

// 29 – list all instances of a recurring event
export async function getRecurringEventInstances(
  creds,
  calendarId = 'primary',
  recurringEventId,
  maxResults = 20,
) {
  if (!recurringEventId) throw new Error('recurringEventId is required');
  const params = new URLSearchParams({ maxResults: String(Math.min(maxResults, 100)) });
  const data = await calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${recurringEventId}/instances?${params}`,
  );
  return data.items ?? [];
}

// 30 – summarise how many hours of meetings are scheduled in a range
export async function getMeetingHours(creds, calendarId = 'primary', timeMin, timeMax) {
  const events = await listEvents(creds, calendarId, {
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const timedEvents = events.filter((e) => e.start?.dateTime && e.end?.dateTime);
  const totalMs = timedEvents.reduce(
    (sum, e) => sum + (new Date(e.end.dateTime) - new Date(e.start.dateTime)),
    0,
  );
  const totalMinutes = Math.round(totalMs / 60_000);
  return { count: timedEvents.length, totalMinutes, totalHours: +(totalMinutes / 60).toFixed(2) };
}

// 31 – get all declined events
export async function getDeclinedEvents(creds, days = 30, maxResults = 20) {
  const events = await getUpcomingEvents(creds, days, maxResults);
  return events.filter((e) => e.attendees?.some((a) => a.self && a.responseStatus === 'declined'));
}

// 32 – get events where response is still needs-action (no RSVP yet)
export async function getUnansweredInvites(creds, days = 30, maxResults = 20) {
  const events = await getUpcomingEvents(creds, days, maxResults);
  return events.filter((e) =>
    e.attendees?.some((a) => a.self && a.responseStatus === 'needsAction'),
  );
}

// 33 – get events the user organised (they are the organiser)
export async function getOrganisedEvents(creds, days = 30, maxResults = 20) {
  const events = await getUpcomingEvents(creds, days, maxResults);
  return events.filter((e) => e.organizer?.self === true);
}

// 34 – get only all-day events in a range
export async function getAllDayEvents(
  creds,
  calendarId = 'primary',
  timeMin,
  timeMax,
  maxResults = 50,
) {
  const events = await listEvents(creds, calendarId, {
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return events.filter((e) => !!e.start?.date);
}

// 35 – add a description / notes to an event (append or replace)
export async function setEventDescription(
  creds,
  calendarId = 'primary',
  eventId,
  description,
  append = false,
) {
  if (append) {
    const existing = await getEvent(creds, calendarId, eventId);
    const current = existing.description ?? '';
    description = current ? `${current}\n\n${description}` : description;
  }
  return patchEvent(creds, calendarId, eventId, { description });
}

// 36 – update event location only
export async function setEventLocation(creds, calendarId = 'primary', eventId, location) {
  return patchEvent(creds, calendarId, eventId, { location });
}

// 37 – get events that overlap with a specific time window (conflict detection)
export async function getConflictingEvents(creds, startISO, endISO, calendarId = 'primary') {
  const events = await listEvents(creds, calendarId, {
    timeMin: new Date(startISO).toISOString(),
    timeMax: new Date(endISO).toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const start = new Date(startISO);
  const end = new Date(endISO);
  return events.filter((e) => {
    if (!e.start?.dateTime) return false;
    const eStart = new Date(e.start.dateTime);
    const eEnd = new Date(e.end.dateTime);
    return eStart < end && eEnd > start;
  });
}

// 38 – snooze an event forward by N minutes
export async function snoozeEvent(creds, calendarId = 'primary', eventId, minutes = 30) {
  const event = await getEvent(creds, calendarId, eventId);
  if (!event.start?.dateTime) throw new Error('Cannot snooze an all-day event');
  const shift = minutes * 60_000;
  const newStart = new Date(new Date(event.start.dateTime).getTime() + shift).toISOString();
  const newEnd = new Date(new Date(event.end.dateTime).getTime() + shift).toISOString();
  const tz = event.start.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return patchEvent(creds, calendarId, eventId, {
    start: { dateTime: newStart, timeZone: tz },
    end: { dateTime: newEnd, timeZone: tz },
  });
}

// 39 – get events created by a specific person (by creator email)
export async function getEventsByCreator(creds, creatorEmail, days = 30, maxResults = 20) {
  const events = await getUpcomingEvents(creds, days, maxResults);
  return events.filter((e) => e.creator?.email?.toLowerCase() === creatorEmail.toLowerCase());
}

// 40 – extend an event's end time by N minutes
export async function extendEvent(creds, calendarId = 'primary', eventId, minutes = 30) {
  const event = await getEvent(creds, calendarId, eventId);
  if (!event.end?.dateTime) throw new Error('Cannot extend an all-day event');
  const newEnd = new Date(new Date(event.end.dateTime).getTime() + minutes * 60_000).toISOString();
  const tz = event.end.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return patchEvent(creds, calendarId, eventId, { end: { dateTime: newEnd, timeZone: tz } });
}
