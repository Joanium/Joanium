export function formatEventTime(eventTime) {
  return eventTime
    ? eventTime.dateTime
      ? new Date(eventTime.dateTime).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : eventTime.date
        ? new Date(`${eventTime.date}T00:00:00`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }) + ' (all day)'
        : 'N/A'
    : 'N/A';
}
export function formatEvent(event, index) {
  const start = formatEventTime(event.start),
    end = formatEventTime(event.end),
    lines = [
      `${index}. **${event.summary || '(No title)'}**`,
      `   Time: ${start}${end && end !== start ? ` -> ${end}` : ''}`,
    ];
  (event.location && lines.push(`   Location: ${event.location}`),
    event.description &&
      lines.push(
        `   Notes: ${event.description.slice(0, 100)}${event.description.length > 100 ? '...' : ''}`,
      ));
  const attendeeCount = event.attendees?.length ?? 0;
  if (attendeeCount > 0) {
    const names = event.attendees
      .slice(0, 3)
      .map((a) => a.displayName || a.email)
      .join(', ');
    lines.push(`   Attendees: ${names}${attendeeCount > 3 ? ` +${attendeeCount - 3} more` : ''}`);
  }
  return (
    event.recurrence?.length && lines.push(`   Recurring: ${event.recurrence[0]}`),
    event.colorId && lines.push(`   Color ID: ${event.colorId}`),
    event.id && lines.push(`   ID: \`${event.id}\``),
    lines.join('\n')
  );
}
export function formatSlot(slot, index) {
  const fmt = (d) => d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }),
    mins = Math.round((slot.end - slot.start) / 6e4);
  return `${index}. ${fmt(slot.start)} – ${fmt(slot.end)} (${mins} min)`;
}
