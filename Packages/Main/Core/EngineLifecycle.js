function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}
function getEngineEntries(payload = {}) {
  const source =
    payload.engines ??
    Object.fromEntries(Object.entries(payload).filter(([key]) => key.endsWith('Engine')));
  return Object.entries(source).filter(([, engine]) => null != engine);
}
export function startEngines(payload = {}) {
  const started = [];
  for (const [key, engine] of getEngineEntries(payload))
    try {
      (engine?.start?.(), started.push([key, engine]));
    } catch (error) {
      for (const [startedKey, startedEngine] of [...started].reverse())
        try {
          startedEngine?.stop?.();
        } catch (stopError) {
          console.warn(
            `[EngineLifecycle] Failed to stop engine "${startedKey}" after startup error:`,
            getErrorMessage(stopError),
          );
        }
      throw new Error(
        `[EngineLifecycle] Failed to start engine "${key}": ${getErrorMessage(error)}`,
      );
    }
}
export function stopEngines(payload = {}) {
  const failures = [];
  for (const [key, engine] of [...getEngineEntries(payload)].reverse())
    try {
      engine?.stop?.();
    } catch (error) {
      failures.push(`${key}: ${getErrorMessage(error)}`);
    }
  if (failures.length)
    throw new Error(`[EngineLifecycle] Failed to stop engines cleanly: ${failures.join('; ')}`);
}
export default { startEngines: startEngines, stopEngines: stopEngines };
