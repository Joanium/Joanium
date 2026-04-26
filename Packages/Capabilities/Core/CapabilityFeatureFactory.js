import defineFeature from './DefineFeature.js';

function resolveMaybeFactory(value, credentials) {
  return 'function' === typeof value ? value(credentials) : value;
}

function normalizeSections(sections) {
  if (Array.isArray(sections)) return sections.filter(Boolean);
  return sections ? [sections] : [];
}

export function createConnectedServicePrompt({
  getCredentials,
  getServiceLabel,
  sections = [],
} = {}) {
  return {
    async getContext(ctx) {
      const credentials = getCredentials?.(ctx);
      if (!credentials) return null;
      return {
        connectedServices: [resolveMaybeFactory(getServiceLabel, credentials)],
        sections: normalizeSections(resolveMaybeFactory(sections, credentials)),
      };
    },
  };
}

export default function createCapabilityFeature({
  methods = {},
  chatTools,
  executeChatTool,
  main = {},
  renderer = {},
  ...feature
} = {}) {
  const resolvedMethods = { ...(main.methods ?? {}), ...methods };

  if (executeChatTool) {
    resolvedMethods.executeChatTool = async (ctx, { toolName, params }) =>
      executeChatTool(ctx, toolName, params);
  }

  return defineFeature({
    ...feature,
    main: {
      ...main,
      methods: resolvedMethods,
    },
    renderer: {
      ...renderer,
      ...(void 0 === chatTools ? {} : { chatTools }),
    },
  });
}
