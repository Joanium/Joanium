import { getFreshCreds } from '../../../GoogleWorkspace.js';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

async function calFetch(creds, url, options = {}) {
  const fresh = await getFreshCreds(creds);
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
    throw new Error(`Calendar API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
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

export async function listCalendars(creds) {
  const data = await calFetch(creds, `${CALENDAR_BASE}/users/me/calendarList?maxResults=50`);
  return data.items ?? [];
}

export async function listEvents(creds, calendarId = 'primary', {
  maxResults = 20,
  timeMin,
  timeMax,
  singleEvents = true,
  orderBy = 'startTime',
  query,
} = {}) {
  const params = new URLSearchParams({
    maxResults: String(Math.min(maxResults, 100)),
    singleEvents: String(singleEvents),
    orderBy,
  });

  if (timeMin) params.set('timeMin', toRFC3339(timeMin));
  if (timeMax) params.set('timeMax', toRFC3339(timeMax));
  if (query) params.set('q', query);
  if (!timeMin && !timeMax) params.set('timeMin', new Date().toISOString());

  const data = await calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return data.items ?? [];
}

export async function getEvent(creds, calendarId, eventId) {
  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
}

export async function createEvent(creds, calendarId = 'primary', {
  summary,
  description = '',
  location = '',
  startDateTime,
  endDateTime,
  attendees = [],
  allDay = false,
  timeZone,
} = {}) {
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
    ...(attendees.length ? { attendees: attendees.map(email => ({ email: email.trim() })) } : {}),
  };

  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateEvent(creds, calendarId = 'primary', eventId, updates = {}) {
  const existing = await getEvent(creds, calendarId, eventId);
  const merged = { ...existing, ...updates };
  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(merged),
  });
}

export async function deleteEvent(creds, calendarId = 'primary', eventId) {
  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getUpcomingEvents(creds, days = 7, maxResults = 20) {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();
  return listEvents(creds, 'primary', { timeMin, timeMax, maxResults, singleEvents: true, orderBy: 'startTime' });
}

export async function getTodayEvents(creds) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  return listEvents(creds, 'primary', { timeMin: startOfDay, timeMax: endOfDay, maxResults: 50, singleEvents: true, orderBy: 'startTime' });
}

export async function searchEvents(creds, query, maxResults = 20) {
  const timeMin = new Date(Date.now() - 30 * 86_400_000).toISOString();
  return listEvents(creds, 'primary', { query, timeMin, maxResults, singleEvents: true, orderBy: 'startTime' });
}
