export function shouldRunNow(automation, now = new Date()) {
  const { trigger, lastRun } = automation;
  if (!trigger) return false;

  const last = lastRun ? new Date(lastRun) : null;

  if (trigger.type === 'on_startup') return false;

  // Every N minutes
  if (trigger.type === 'interval') {
    const minutes = Math.max(1, parseInt(trigger.minutes, 10) || 30);
    if (!last) return true;
    return (now - last) >= minutes * 60_000;
  }

  if (trigger.type === 'hourly') {
    if (now.getMinutes() !== 0) return false;
    if (last &&
      last.getFullYear() === now.getFullYear() &&
      last.getMonth()    === now.getMonth()    &&
      last.getDate()     === now.getDate()     &&
      last.getHours()    === now.getHours()) return false;
    return true;
  }

  if (trigger.type === 'daily') {
    if (!trigger.time) return false;
    const [h, m] = trigger.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return false;
    if (last && last.toDateString() === now.toDateString()) return false;
    return true;
  }

  if (trigger.type === 'weekly') {
    const DAY_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    if (!trigger.day || DAY_MAP.indexOf(trigger.day) !== now.getDay()) return false;
    if (!trigger.time) return false;
    const [h, m] = trigger.time.split(':').map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return false;
    if (last) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      if (last >= weekStart) return false;
    }
    return true;
  }

  return false;
}
