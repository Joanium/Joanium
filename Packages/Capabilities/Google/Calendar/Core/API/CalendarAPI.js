const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
async function calFetch(creds, url, options = {}) {
  const fresh = await (async function (creds) {
      const { getFreshCreds: getFreshCreds } = await import('../../../GoogleWorkspace.js');
      return getFreshCreds(creds);
    })(creds),
    res = await fetch(url, {
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
  return 204 === res.status ? null : res.json();
}
function toRFC3339(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: "${dateStr}"`);
  return date.toISOString();
}
export async function listCalendars(creds) {
  return (
    (await calFetch(creds, `${CALENDAR_BASE}/users/me/calendarList?maxResults=50`)).items ?? []
  );
}
export async function listEvents(
  creds,
  calendarId = 'primary',
  {
    maxResults: maxResults = 20,
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: singleEvents = !0,
    orderBy: orderBy = 'startTime',
    query: query,
  } = {},
) {
  const params = new URLSearchParams({
    maxResults: String(Math.min(maxResults, 100)),
    singleEvents: String(singleEvents),
    orderBy: orderBy,
  });
  return (
    timeMin && params.set('timeMin', toRFC3339(timeMin)),
    timeMax && params.set('timeMax', toRFC3339(timeMax)),
    query && params.set('q', query),
    timeMin || timeMax || params.set('timeMin', new Date().toISOString()),
    (
      await calFetch(
        creds,
        `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      )
    ).items ?? []
  );
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
    summary: summary,
    description: description = '',
    location: location = '',
    startDateTime: startDateTime,
    endDateTime: endDateTime,
    attendees: attendees = [],
    allDay: allDay = !1,
    timeZone: timeZone,
    recurrence: recurrence = [],
    colorId: colorId,
    reminders: reminders,
    visibility: visibility,
    status: status,
  } = {},
) {
  if (!summary) throw new Error('Event summary (title) is required');
  if (!startDateTime) throw new Error('Start date/time is required');
  let start, end;
  if (allDay) {
    const startDate = startDateTime.split('T')[0];
    ((start = { date: startDate }),
      (end = { date: endDateTime ? endDateTime.split('T')[0] : startDate }));
  } else {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    ((start = { dateTime: toRFC3339(startDateTime), timeZone: tz }),
      (end = { dateTime: toRFC3339(endDateTime || startDateTime), timeZone: tz }));
  }
  const body = {
    summary: summary,
    description: description,
    location: location,
    start: start,
    end: end,
    ...(attendees.length ? { attendees: attendees.map((email) => ({ email: email.trim() })) } : {}),
    ...(recurrence.length ? { recurrence: recurrence } : {}),
    ...(colorId ? { colorId: String(colorId) } : {}),
    ...(reminders ? { reminders: reminders } : {}),
    ...(visibility ? { visibility: visibility } : {}),
    ...(status ? { status: status } : {}),
  };
  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export async function updateEvent(creds, calendarId = 'primary', eventId, updates = {}) {
  const merged = { ...(await getEvent(creds, calendarId, eventId)), ...updates };
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'PUT', body: JSON.stringify(merged) },
  );
}
export async function deleteEvent(creds, calendarId = 'primary', eventId) {
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'DELETE' },
  );
}
export async function getUpcomingEvents(creds, days = 7, maxResults = 20) {
  return listEvents(creds, 'primary', {
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 864e5 * days).toISOString(),
    maxResults: maxResults,
    singleEvents: !0,
    orderBy: 'startTime',
  });
}
export async function getTodayEvents(creds) {
  const now = new Date();
  return listEvents(creds, 'primary', {
    timeMin: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    timeMax: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString(),
    maxResults: 50,
    singleEvents: !0,
    orderBy: 'startTime',
  });
}
export async function searchEvents(creds, query, maxResults = 20) {
  return listEvents(creds, 'primary', {
    query: query,
    timeMin: new Date(Date.now() - 2592e6).toISOString(),
    maxResults: maxResults,
    singleEvents: !0,
    orderBy: 'startTime',
  });
}
export async function getThisWeekEvents(creds) {
  const now = new Date(),
    day = now.getDay(),
    diffToMon = 0 === day ? -6 : 1 - day,
    monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon),
    sunday = new Date(monday);
  return (
    sunday.setDate(monday.getDate() + 6),
    sunday.setHours(23, 59, 59),
    listEvents(creds, 'primary', {
      timeMin: monday.toISOString(),
      timeMax: sunday.toISOString(),
      maxResults: 100,
      singleEvents: !0,
      orderBy: 'startTime',
    })
  );
}
export async function getNextWeekEvents(creds) {
  const now = new Date(),
    day = now.getDay(),
    diffToMon = 0 === day ? 1 : 8 - day,
    monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon),
    sunday = new Date(monday);
  return (
    sunday.setDate(monday.getDate() + 6),
    sunday.setHours(23, 59, 59),
    listEvents(creds, 'primary', {
      timeMin: monday.toISOString(),
      timeMax: sunday.toISOString(),
      maxResults: 100,
      singleEvents: !0,
      orderBy: 'startTime',
    })
  );
}
export async function getThisMonthEvents(creds) {
  const now = new Date();
  return listEvents(creds, 'primary', {
    timeMin: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    timeMax: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    maxResults: 100,
    singleEvents: !0,
    orderBy: 'startTime',
  });
}
export async function getNextEvent(creds) {
  return (
    (
      await listEvents(creds, 'primary', {
        timeMin: new Date().toISOString(),
        maxResults: 1,
        singleEvents: !0,
        orderBy: 'startTime',
      })
    )[0] ?? null
  );
}
export async function getFreeSlots(creds, dateStr, workStart = 9, workEnd = 18, minMinutes = 30) {
  const dayStart = new Date(`${dateStr}T${String(workStart).padStart(2, '0')}:00:00`),
    dayEnd = new Date(`${dateStr}T${String(workEnd).padStart(2, '0')}:00:00`),
    busy = (
      await listEvents(creds, 'primary', {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        maxResults: 50,
        singleEvents: !0,
        orderBy: 'startTime',
      })
    )
      .filter((e) => e.start?.dateTime)
      .map((e) => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))
      .sort((a, b) => a.start - b.start),
    slots = [];
  let cursor = dayStart;
  for (const { start: start, end: end } of busy)
    (cursor < start &&
      (start - cursor) / 6e4 >= minMinutes &&
      slots.push({ start: new Date(cursor), end: new Date(start) }),
      end > cursor && (cursor = end));
  return (
    cursor < dayEnd &&
      (dayEnd - cursor) / 6e4 >= minMinutes &&
      slots.push({ start: new Date(cursor), end: new Date(dayEnd) }),
    slots
  );
}
export async function countEvents(creds, calendarId = 'primary', timeMin, timeMax) {
  return (
    await listEvents(creds, calendarId, {
      timeMin: toRFC3339(timeMin),
      timeMax: toRFC3339(timeMax),
      maxResults: 100,
      singleEvents: !0,
      orderBy: 'startTime',
    })
  ).length;
}
export async function getEventsByAttendee(creds, attendeeEmail, maxResults = 20) {
  return searchEvents(creds, attendeeEmail, maxResults);
}
export async function patchEvent(creds, calendarId = 'primary', eventId, patch = {}) {
  return calFetch(
    creds,
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}
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
    { method: 'POST' },
  );
}
export async function duplicateEvent(creds, calendarId = 'primary', eventId, shiftDays = 0) {
  const clone = { ...(await getEvent(creds, calendarId, eventId)) };
  if (
    (delete clone.id,
    delete clone.iCalUID,
    delete clone.etag,
    delete clone.htmlLink,
    delete clone.recurringEventId,
    0 !== shiftDays)
  ) {
    const shift = 864e5 * shiftDays;
    if (clone.start?.dateTime)
      ((clone.start = {
        ...clone.start,
        dateTime: new Date(new Date(clone.start.dateTime).getTime() + shift).toISOString(),
      }),
        (clone.end = {
          ...clone.end,
          dateTime: new Date(new Date(clone.end.dateTime).getTime() + shift).toISOString(),
        }));
    else if (clone.start?.date) {
      const shiftDate = (d) =>
        new Date(new Date(`${d}T00:00:00`).getTime() + shift).toISOString().split('T')[0];
      ((clone.start = { date: shiftDate(clone.start.date) }),
        (clone.end = { date: shiftDate(clone.end.date) }));
    }
  }
  return calFetch(creds, `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(clone),
  });
}
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
    maxResults: maxResults,
    singleEvents: !0,
    orderBy: 'startTime',
  });
}
export async function clearDay(creds, calendarId = 'primary', dateStr) {
  const start = new Date(`${dateStr}T00:00:00`).toISOString(),
    end = new Date(`${dateStr}T23:59:59`).toISOString(),
    events = await listEvents(creds, calendarId, {
      timeMin: start,
      timeMax: end,
      maxResults: 50,
      singleEvents: !0,
      orderBy: 'startTime',
    });
  return (
    await Promise.all(events.map((e) => deleteEvent(creds, calendarId, e.id))),
    events.length
  );
}
export async function getEventsByLocation(creds, locationQuery, maxResults = 20) {
  return searchEvents(creds, locationQuery, maxResults);
}
export async function getFreeBusy(creds, calendarIds = ['primary'], timeMin, timeMax) {
  const body = {
    timeMin: toRFC3339(timeMin),
    timeMax: toRFC3339(timeMax),
    items: calendarIds.map((id) => ({ id: id })),
  };
  return calFetch(creds, `${CALENDAR_BASE}/freeBusy`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export async function getEventsOnDate(creds, dateStr) {
  const lower = (dateStr ?? '').toLowerCase().trim(),
    now = new Date();
  let target;
  if (
    ((target =
      'today' === lower
        ? now
        : 'tomorrow' === lower
          ? new Date(now.getTime() + 864e5)
          : 'yesterday' === lower
            ? new Date(now.getTime() - 864e5)
            : new Date(dateStr)),
    Number.isNaN(target.getTime()))
  )
    throw new Error(`Invalid date: "${dateStr}"`);
  const y = target.getFullYear(),
    m = target.getMonth(),
    d = target.getDate();
  return listEvents(creds, 'primary', {
    timeMin: new Date(y, m, d).toISOString(),
    timeMax: new Date(y, m, d, 23, 59, 59).toISOString(),
    maxResults: 50,
    singleEvents: !0,
    orderBy: 'startTime',
  });
}
export async function renameEvent(creds, calendarId = 'primary', eventId, newSummary) {
  if (!newSummary?.trim()) throw new Error('newSummary is required');
  return patchEvent(creds, calendarId, eventId, { summary: newSummary.trim() });
}
export async function setEventColor(creds, calendarId = 'primary', eventId, colorId) {
  return patchEvent(creds, calendarId, eventId, { colorId: String(colorId) });
}
export async function getThisWeekendEvents(creds) {
  const now = new Date(),
    day = now.getDay(),
    diffToSat = 0 === day ? -1 : 6 - day,
    sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToSat),
    sun = new Date(sat);
  return (
    sun.setDate(sat.getDate() + 1),
    sun.setHours(23, 59, 59),
    listEvents(creds, 'primary', {
      timeMin: sat.toISOString(),
      timeMax: sun.toISOString(),
      maxResults: 50,
      singleEvents: !0,
      orderBy: 'startTime',
    })
  );
}
export async function setEventReminders(creds, calendarId = 'primary', eventId, minutesList = []) {
  return patchEvent(creds, calendarId, eventId, {
    reminders: minutesList.length
      ? {
          useDefault: !1,
          overrides: minutesList.map((m) => ({ method: 'popup', minutes: Number(m) })),
        }
      : { useDefault: !0 },
  });
}
export async function bulkCreateEvents(creds, calendarId = 'primary', eventDataArray = []) {
  if (!eventDataArray.length) throw new Error('eventDataArray must not be empty');
  return Promise.all(eventDataArray.map((ed) => createEvent(creds, calendarId, ed)));
}
export async function getEventsWithVideoConference(creds, days = 30, maxResults = 20) {
  return (await getUpcomingEvents(creds, days, maxResults)).filter(
    (e) => e.conferenceData?.entryPoints?.length > 0,
  );
}
export async function rsvpEvent(creds, calendarId = 'primary', eventId, selfEmail, status) {
  const VALID = ['accepted', 'declined', 'tentative'];
  if (!VALID.includes(status)) throw new Error(`status must be one of: ${VALID.join(', ')}`);
  return patchEvent(creds, calendarId, eventId, {
    attendees: ((await getEvent(creds, calendarId, eventId)).attendees ?? []).map((a) =>
      a.email.toLowerCase() === selfEmail.toLowerCase() ? { ...a, responseStatus: status } : a,
    ),
  });
}
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
  return (
    (
      await calFetch(
        creds,
        `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      )
    ).items ?? []
  );
}
export async function getRecurringEventInstances(
  creds,
  calendarId = 'primary',
  recurringEventId,
  maxResults = 20,
) {
  if (!recurringEventId) throw new Error('recurringEventId is required');
  const params = new URLSearchParams({ maxResults: String(Math.min(maxResults, 100)) });
  return (
    (
      await calFetch(
        creds,
        `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${recurringEventId}/instances?${params}`,
      )
    ).items ?? []
  );
}
export async function getMeetingHours(creds, calendarId = 'primary', timeMin, timeMax) {
  const timedEvents = (
      await listEvents(creds, calendarId, {
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        maxResults: 100,
        singleEvents: !0,
        orderBy: 'startTime',
      })
    ).filter((e) => e.start?.dateTime && e.end?.dateTime),
    totalMs = timedEvents.reduce(
      (sum, e) => sum + (new Date(e.end.dateTime) - new Date(e.start.dateTime)),
      0,
    ),
    totalMinutes = Math.round(totalMs / 6e4);
  return {
    count: timedEvents.length,
    totalMinutes: totalMinutes,
    totalHours: +(totalMinutes / 60).toFixed(2),
  };
}
export async function getDeclinedEvents(creds, days = 30, maxResults = 20) {
  return (await getUpcomingEvents(creds, days, maxResults)).filter((e) =>
    e.attendees?.some((a) => a.self && 'declined' === a.responseStatus),
  );
}
export async function getUnansweredInvites(creds, days = 30, maxResults = 20) {
  return (await getUpcomingEvents(creds, days, maxResults)).filter((e) =>
    e.attendees?.some((a) => a.self && 'needsAction' === a.responseStatus),
  );
}
export async function getOrganisedEvents(creds, days = 30, maxResults = 20) {
  return (await getUpcomingEvents(creds, days, maxResults)).filter((e) => !0 === e.organizer?.self);
}
export async function getAllDayEvents(
  creds,
  calendarId = 'primary',
  timeMin,
  timeMax,
  maxResults = 50,
) {
  return (
    await listEvents(creds, calendarId, {
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      maxResults: maxResults,
      singleEvents: !0,
      orderBy: 'startTime',
    })
  ).filter((e) => !!e.start?.date);
}
export async function setEventDescription(
  creds,
  calendarId = 'primary',
  eventId,
  description,
  append = !1,
) {
  if (append) {
    const current = (await getEvent(creds, calendarId, eventId)).description ?? '';
    description = current ? `${current}\n\n${description}` : description;
  }
  return patchEvent(creds, calendarId, eventId, { description: description });
}
export async function setEventLocation(creds, calendarId = 'primary', eventId, location) {
  return patchEvent(creds, calendarId, eventId, { location: location });
}
export async function getConflictingEvents(creds, startISO, endISO, calendarId = 'primary') {
  const events = await listEvents(creds, calendarId, {
      timeMin: new Date(startISO).toISOString(),
      timeMax: new Date(endISO).toISOString(),
      maxResults: 50,
      singleEvents: !0,
      orderBy: 'startTime',
    }),
    start = new Date(startISO),
    end = new Date(endISO);
  return events.filter((e) => {
    if (!e.start?.dateTime) return !1;
    const eStart = new Date(e.start.dateTime),
      eEnd = new Date(e.end.dateTime);
    return eStart < end && eEnd > start;
  });
}
export async function snoozeEvent(creds, calendarId = 'primary', eventId, minutes = 30) {
  const event = await getEvent(creds, calendarId, eventId);
  if (!event.start?.dateTime) throw new Error('Cannot snooze an all-day event');
  const shift = 6e4 * minutes,
    newStart = new Date(new Date(event.start.dateTime).getTime() + shift).toISOString(),
    newEnd = new Date(new Date(event.end.dateTime).getTime() + shift).toISOString(),
    tz = event.start.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return patchEvent(creds, calendarId, eventId, {
    start: { dateTime: newStart, timeZone: tz },
    end: { dateTime: newEnd, timeZone: tz },
  });
}
export async function getEventsByCreator(creds, creatorEmail, days = 30, maxResults = 20) {
  return (await getUpcomingEvents(creds, days, maxResults)).filter(
    (e) => e.creator?.email?.toLowerCase() === creatorEmail.toLowerCase(),
  );
}
export async function extendEvent(creds, calendarId = 'primary', eventId, minutes = 30) {
  const event = await getEvent(creds, calendarId, eventId);
  if (!event.end?.dateTime) throw new Error('Cannot extend an all-day event');
  return patchEvent(creds, calendarId, eventId, {
    end: {
      dateTime: new Date(new Date(event.end.dateTime).getTime() + 6e4 * minutes).toISOString(),
      timeZone: event.end.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
}
export async function shortenEvent(creds, calendarId = 'primary', eventId, minutes = 15) {
  const event = await getEvent(creds, calendarId, eventId);
  if (!event.end?.dateTime) throw new Error('Cannot shorten an all-day event');
  const newEnd = new Date(new Date(event.end.dateTime).getTime() - 6e4 * minutes);
  if (newEnd <= new Date(event.start.dateTime))
    throw new Error('Shortening by that amount would make the event end before or at its start');
  const tz = event.end.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return patchEvent(creds, calendarId, eventId, {
    end: { dateTime: newEnd.toISOString(), timeZone: tz },
  });
}
export async function getDailyBreakdown(creds, calendarId = 'primary', timeMin, timeMax) {
  const events = await listEvents(creds, calendarId, {
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      maxResults: 100,
      singleEvents: !0,
      orderBy: 'startTime',
    }),
    days = {};
  for (const e of events) {
    const dateKey = (e.start?.dateTime ?? e.start?.date ?? '').slice(0, 10);
    dateKey &&
      (days[dateKey] || (days[dateKey] = { count: 0, totalMinutes: 0 }),
      (days[dateKey].count += 1),
      e.start?.dateTime &&
        e.end?.dateTime &&
        (days[dateKey].totalMinutes += Math.round(
          (new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 6e4,
        )));
  }
  return days;
}
export async function getLongestFreeBlock(creds, dateStr, workStart = 9, workEnd = 18) {
  const slots = await getFreeSlots(creds, dateStr, workStart, workEnd, 0);
  return slots.length
    ? slots.reduce((best, s) => (s.end - s.start > best.end - best.start ? s : best), slots[0])
    : null;
}
export async function copyDayEvents(creds, calendarId = 'primary', sourceDateStr, targetDateStr) {
  const sourceStart = new Date(`${sourceDateStr}T00:00:00`).toISOString(),
    sourceEnd = new Date(`${sourceDateStr}T23:59:59`).toISOString(),
    events = await listEvents(creds, calendarId, {
      timeMin: sourceStart,
      timeMax: sourceEnd,
      maxResults: 50,
      singleEvents: !0,
      orderBy: 'startTime',
    });
  if (!events.length) return [];
  const sourceDate = new Date(`${sourceDateStr}T00:00:00`),
    shiftMs = new Date(`${targetDateStr}T00:00:00`) - sourceDate;
  return Promise.all(
    events.map((e) => {
      const clone = { ...e };
      if (
        (delete clone.id,
        delete clone.iCalUID,
        delete clone.etag,
        delete clone.htmlLink,
        delete clone.recurringEventId,
        clone.start?.dateTime)
      )
        ((clone.start = {
          ...clone.start,
          dateTime: new Date(new Date(clone.start.dateTime).getTime() + shiftMs).toISOString(),
        }),
          (clone.end = {
            ...clone.end,
            dateTime: new Date(new Date(clone.end.dateTime).getTime() + shiftMs).toISOString(),
          }));
      else if (clone.start?.date) {
        const shift = (d) =>
          new Date(new Date(`${d}T00:00:00`).getTime() + shiftMs).toISOString().slice(0, 10);
        ((clone.start = { date: shift(clone.start.date) }),
          (clone.end = { date: shift(clone.end.date) }));
      }
      return calFetch(
        creds,
        `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
        { method: 'POST', body: JSON.stringify(clone) },
      );
    }),
  );
}
export async function setEventVisibility(creds, calendarId = 'primary', eventId, visibility) {
  const VALID = ['default', 'public', 'private', 'confidential'];
  if (!VALID.includes(visibility))
    throw new Error(`visibility must be one of: ${VALID.join(', ')}`);
  return patchEvent(creds, calendarId, eventId, { visibility: visibility });
}
export async function setEventStatus(creds, calendarId = 'primary', eventId, status) {
  const VALID = ['confirmed', 'tentative', 'cancelled'];
  if (!VALID.includes(status)) throw new Error(`status must be one of: ${VALID.join(', ')}`);
  return patchEvent(creds, calendarId, eventId, { status: status });
}
export async function getSoloEvents(creds, days = 14, maxResults = 20) {
  return (await getUpcomingEvents(creds, days, maxResults)).filter(
    (e) => !e.attendees || 0 === e.attendees.length,
  );
}
export async function getLargeMeetings(creds, minAttendees = 5, days = 14, maxResults = 20) {
  return (await getUpcomingEvents(creds, days, maxResults)).filter(
    (e) => (e.attendees?.length ?? 0) >= minAttendees,
  );
}
export async function rescheduleEvent(creds, calendarId = 'primary', eventId, newStartISO) {
  const event = await getEvent(creds, calendarId, eventId);
  if (!event.start?.dateTime) throw new Error('Cannot reschedule an all-day event with this tool');
  const durationMs = new Date(event.end.dateTime) - new Date(event.start.dateTime),
    newStart = new Date(newStartISO),
    newEnd = new Date(newStart.getTime() + durationMs),
    tz = event.start.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return patchEvent(creds, calendarId, eventId, {
    start: { dateTime: newStart.toISOString(), timeZone: tz },
    end: { dateTime: newEnd.toISOString(), timeZone: tz },
  });
}
export async function getAgendaSummary(creds, timeMin, timeMax, maxResults = 50) {
  const events = await listEvents(creds, 'primary', {
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    maxResults: maxResults,
    singleEvents: !0,
    orderBy: 'startTime',
  });
  return events.length
    ? events
        .map((e) => {
          const parts = [
            `• ${e.start?.dateTime ? new Date(e.start.dateTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : new Date(`${e.start.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' (all day)'} — ${e.summary || '(No title)'}`,
          ];
          return (
            e.location && parts.push(`  📍 ${e.location}`),
            e.attendees?.length &&
              parts.push(
                `  👥 ${e.attendees
                  .slice(0, 3)
                  .map((a) => a.displayName || a.email)
                  .join(', ')}${e.attendees.length > 3 ? ' +' + (e.attendees.length - 3) : ''}`,
              ),
            parts.join('\n')
          );
        })
        .join('\n')
    : 'No events scheduled in this period.';
}
