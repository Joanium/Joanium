import defineFeature from './DefineFeature.js';

function resolveMaybeFactory(value, credentials) {
  return 'function' === typeof value ? value(credentials) : value;
}

function normalizeSections(sections) {
  if (Array.isArray(sections)) return sections.filter(Boolean);
  return sections ? [sections] : [];
}

function normalizeRequiredCredentialKeys(requiredCredentialKeys) {
  if (Array.isArray(requiredCredentialKeys)) return requiredCredentialKeys.filter(Boolean);
  return requiredCredentialKeys ? [requiredCredentialKeys] : ['token'];
}

function hasCredentialValue(credentials, key) {
  const value = credentials?.[key];
  return 'string' === typeof value ? !!value.trim() : null != value;
}

export function createConnectorIcon({ iconFile, alt }) {
  return `<img src="../../../Assets/Icons/${iconFile}" alt="${alt}" class="connector-icon-img" />`;
}

export function createConnectorService({
  id,
  name = id,
  icon,
  iconFile,
  iconAlt = name,
  description = '',
  helpUrl = '',
  helpText = '',
  oauthType = null,
  subServices = [],
  setupSteps = [],
  capabilities = [],
  fields = [],
  automations = [],
  defaultState,
  validate,
  ...service
} = {}) {
  return {
    id,
    name,
    ...(icon || iconFile ? { icon: icon ?? createConnectorIcon({ iconFile, alt: iconAlt }) } : {}),
    description,
    helpUrl,
    helpText,
    oauthType,
    subServices,
    setupSteps,
    capabilities,
    fields,
    automations,
    defaultState: defaultState ?? { enabled: false, credentials: {} },
    ...(validate ? { validate } : {}),
    ...service,
  };
}

export function createConnectorValidator({
  connectorId,
  requiredCredentialKeys = ['token'],
  missingError = 'No credentials stored',
  validate = async () => ({}),
} = {}) {
  const requiredKeys = normalizeRequiredCredentialKeys(requiredCredentialKeys);
  return async function validateConnector(ctx) {
    const credentials = ctx.connectorEngine?.getCredentials(connectorId);
    if (!requiredKeys.every((key) => hasCredentialValue(credentials, key))) {
      return { ok: false, error: missingError };
    }
    try {
      const { updatedCredentials, response = {} } = (await validate(credentials, ctx)) ?? {};
      if (updatedCredentials) {
        ctx.connectorEngine?.updateCredentials(connectorId, updatedCredentials);
      }
      return { ...response, ok: true };
    } catch (err) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  };
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
