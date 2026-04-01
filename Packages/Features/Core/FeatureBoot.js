let bootPromise = null;

function emptyBoot() {
  return {
    features: [],
    connectors: { services: [], free: [] },
    chat: { tools: [] },
    automations: { actions: [], fieldMeta: {}, fieldLabels: {} },
    agents: { dataSources: [], outputTypes: [], instructionTemplates: {} },
  };
}

export async function getFeatureBoot() {
  if (!window.featureAPI?.getBoot) return emptyBoot();
  if (!bootPromise) {
    bootPromise = window.featureAPI.getBoot().catch(error => {
      console.warn('[FeatureBoot] Failed to load feature boot payload:', error);
      bootPromise = null;
      return emptyBoot();
    });
  }
  return bootPromise;
}

export function resetFeatureBoot() {
  bootPromise = null;
}
