export function shouldRunNow(automation, now = new Date()) {
  const { trigger: trigger, lastRun: lastRun } = automation;
  if (!trigger) return !1;
  const last = lastRun ? new Date(lastRun) : null;
  if ('on_startup' === trigger.type) return !1;
  if ('interval' === trigger.type) {
    const minutes = Math.max(1, parseInt(trigger.minutes, 10) || 30);
    return !last || now - last >= 6e4 * minutes;
  }
  if ('hourly' === trigger.type)
    return (
      0 === now.getMinutes() &&
      (!last ||
        last.getFullYear() !== now.getFullYear() ||
        last.getMonth() !== now.getMonth() ||
        last.getDate() !== now.getDate() ||
        last.getHours() !== now.getHours())
    );
  if ('daily' === trigger.type) {
    if (!trigger.time) return !1;
    const [h, m] = trigger.time.split(':').map(Number);
    return (
      now.getHours() === h &&
      now.getMinutes() === m &&
      (!last || last.toDateString() !== now.toDateString())
    );
  }
  if ('weekly' === trigger.type) {
    const DAY_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    if (!trigger.day || DAY_MAP.indexOf(trigger.day) !== now.getDay()) return !1;
    if (!trigger.time) return !1;
    const [h, m] = trigger.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return !1;
    if (last) {
      const weekStart = new Date(now);
      if (
        (weekStart.setDate(now.getDate() - now.getDay()),
        weekStart.setHours(0, 0, 0, 0),
        last >= weekStart)
      )
        return !1;
    }
    return !0;
  }
  return !1;
}
