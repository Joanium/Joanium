function getProvidedKey(engine = {}) {
  return engine.meta?.provides ?? engine.provides ?? null;
}
function getEngineLabel(engine = {}) {
  return engine.name ?? engine.id ?? getProvidedKey(engine) ?? 'unknown engine';
}
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}
function unmetEngineNeeds(meta = {}, context = {}) {
  return (meta.needs ?? []).filter((key) => null == context[key]);
}
export async function instantiateDiscoveredEngines(discovered = [], baseContext = {}) {
  const engines =
      baseContext.engines &&
      'object' == typeof baseContext.engines &&
      !Array.isArray(baseContext.engines)
        ? baseContext.engines
        : {},
    context = { ...baseContext, engines: engines },
    providers = new Map();
  for (const engine of discovered) {
    const key = getProvidedKey(engine);
    if (!key)
      throw new Error(`[EngineAssembly] "${getEngineLabel(engine)}" is missing a provides key.`);
    if (providers.has(key))
      throw new Error(
        `[EngineAssembly] Duplicate engine provider "${key}" from ${providers.get(key)} and ${engine.filePath ?? getEngineLabel(engine)}`,
      );
    providers.set(key, engine.filePath ?? getEngineLabel(engine));
  }
  const pending = [...discovered];
  for (; pending.length; ) {
    let progressed = !1;
    for (let index = 0; index < pending.length; index += 1) {
      const engine = pending[index],
        { meta: meta = {} } = engine;
      if ('function' != typeof meta.create) {
        (pending.splice(index, 1), (index -= 1));
        continue;
      }
      if (unmetEngineNeeds(meta, context).length) continue;
      const provideKey = getProvidedKey(engine);
      try {
        const instance = await meta.create(context);
        ((context[provideKey] = instance), (engines[provideKey] = instance));
      } catch (error) {
        throw new Error(
          `[EngineAssembly] Failed to create "${getEngineLabel(engine)}" (${provideKey}): ${getErrorMessage(error)}`,
        );
      }
      (pending.splice(index, 1), (index -= 1), (progressed = !0));
    }
    if (progressed) continue;
    const details = pending
      .map((engine) => {
        const missing = unmetEngineNeeds(engine.meta, context);
        return `${getEngineLabel(engine)} [missing: ${missing.join(', ') || 'unknown'}]`;
      })
      .join('; ');
    throw new Error(`[EngineAssembly] Unable to instantiate engines: ${details}`);
  }
  return { context: context, engines: engines };
}
export default instantiateDiscoveredEngines;
