import defineFeature from '../../Core/DefineFeature.js';

const GOOGLE_ICON_STYLE = 'width: 26px; height: 26px; object-fit: contain;';

function createGoogleIconMarkup(iconFile, alt) {
  return `<img src="../../../Assets/Icons/${iconFile}" alt="${alt}" style="${GOOGLE_ICON_STYLE}" />`;
}

function createGoogleServiceExtension({
  serviceKey,
  name,
  iconFile,
  iconAlt = name,
  apiUrl,
  capabilities = [],
  automations,
}) {
  const serviceExtension = {
    target: 'google',
    subServices: [
      {
        key: serviceKey,
        icon: createGoogleIconMarkup(iconFile, iconAlt),
        name,
        apiUrl,
      },
    ],
    capabilities,
  };

  if (Array.isArray(automations) && automations.length) {
    serviceExtension.automations = automations;
  }

  return serviceExtension;
}

export default function createGoogleFeature({
  id,
  name,
  iconFile,
  iconAlt = name,
  apiUrl,
  capabilities = [],
  automations,
  methods = {},
  chatTools = [],
  executeChatTool,
  ...rest
} = {}) {
  const resolvedMethods = { ...methods };

  if (executeChatTool) {
    resolvedMethods.executeChatTool = async (ctx, { toolName, params }) =>
      executeChatTool(ctx, toolName, params);
  }

  return defineFeature({
    ...rest,
    id,
    name,
    dependsOn: ['google-workspace'],
    connectors: {
      serviceExtensions: [
        createGoogleServiceExtension({
          serviceKey: id,
          name,
          iconFile,
          iconAlt,
          apiUrl,
          capabilities,
          automations,
        }),
      ],
    },
    main: {
      methods: resolvedMethods,
    },
    renderer: {
      chatTools,
    },
  });
}
