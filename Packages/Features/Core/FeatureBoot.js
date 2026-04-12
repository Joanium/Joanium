let bootPromise = null;
export async function getFeatureBoot() {
  return window.featureAPI?.getBoot
    ? (bootPromise ||
        (bootPromise = window.featureAPI.getBoot().catch(
          (error) => (
            console.warn('[FeatureBoot] Failed to load feature boot payload:', error),
            (bootPromise = null),
            {
              features: [],
              pages: [],
              connectors: { services: [], free: [] },
              chat: { tools: [] },
              automations: { dataSources: [], outputTypes: [], instructionTemplates: {} },
            }
          ),
        )),
      bootPromise)
    : {
        features: [],
        pages: [],
        connectors: { services: [], free: [] },
        chat: { tools: [] },
        automations: { dataSources: [], outputTypes: [], instructionTemplates: {} },
      };
}
export function resetFeatureBoot() {
  bootPromise = null;
}
