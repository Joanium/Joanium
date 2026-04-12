export function wrapHandler(fn) {
  return async (_event, ...args) => {
    try {
      const result = await fn(...args);
      return null == result
        ? { ok: !0 }
        : 'object' == typeof result && 'ok' in result
          ? result
          : { ok: !0, ...result };
    } catch (err) {
      return { ok: !1, error: err.message };
    }
  };
}
export function wrapRead(fn) {
  return async (_event, ...args) => {
    try {
      return await fn(...args);
    } catch {
      return null;
    }
  };
}
