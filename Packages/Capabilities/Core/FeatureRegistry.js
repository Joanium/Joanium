import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

function uniqueBy(items = [], keyFn = (item) => item) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function deepClone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeFeatureStorage(feature = {}) {
  const raw = feature.storage;
  if (!raw) return [];

  const items = Array.isArray(raw) ? raw : Array.isArray(raw.descriptors) ? raw.descriptors : [raw];

  return items
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => deepClone(item));
}

function getDefaultFeatureStorageKey(feature = {}) {
  return normalizeFeatureStorage(feature)[0]?.key ?? feature.id;
}

function topologicallySortFeatures(features = []) {
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const visiting = new Set();
  const visited = new Set();
  const result = [];

  function visit(feature) {
    if (visited.has(feature.id)) return;
    if (visiting.has(feature.id)) {
      throw new Error(`[FeatureRegistry] Circular dependency involving "${feature.id}".`);
    }

    visiting.add(feature.id);

    for (const dependencyId of feature.dependsOn ?? []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new Error(
          `[FeatureRegistry] Feature "${feature.id}" depends on missing feature "${dependencyId}".`,
        );
      }
      visit(dependency);
    }

    visiting.delete(feature.id);
    visited.add(feature.id);
    result.push(feature);
  }

  for (const feature of features) visit(feature);
  return result;
}

function sortByOrder(items = []) {
  return [...items].sort((left, right) => {
    const leftOrder = left.order ?? 999;
    const rightOrder = right.order ?? 999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.name ?? left.id ?? '').localeCompare(String(right.name ?? right.id ?? ''));
  });
}

function serializeServiceConnector(featureId, connector) {
  return {
    featureId,
    id: connector.id,
    name: connector.name,
    icon: connector.icon,
    description: connector.description,
    helpUrl: connector.helpUrl,
    helpText: connector.helpText,
    oauthType: connector.oauthType ?? null,
    connectMethod: connector.connectMethod ?? null,
    connectLabel: connector.connectLabel ?? null,
    connectingLabel: connector.connectingLabel ?? null,
    serviceRefreshMethod: connector.serviceRefreshMethod ?? null,
    subServices: deepClone(connector.subServices ?? []),
    setupSteps: deepClone(connector.setupSteps ?? []),
    capabilities: deepClone(connector.capabilities ?? []),
    fields: deepClone(connector.fields ?? []),
    automations: deepClone(connector.automations ?? []),
    order: connector.order ?? 999,
  };
}

function serializeFreeConnector(featureId, connector) {
  return {
    featureId,
    id: connector.id,
    name: connector.name,
    icon: connector.icon,
    description: connector.description,
    noKey: connector.noKey ?? false,
    optionalKey: connector.optionalKey ?? false,
    keyLabel: connector.keyLabel ?? '',
    keyPlaceholder: connector.keyPlaceholder ?? '',
    keyHint: connector.keyHint ?? '',
    docsUrl: connector.docsUrl ?? '',
    toolHint: connector.toolHint ?? '',
    order: connector.order ?? 999,
  };
}

export class FeatureRegistry {
  static _findFeatureFiles(rootDir) {
    const featureFiles = [];

    function visit(directory) {
      const entries = fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath);
          continue;
        }

        if (entry.isFile() && entry.name === 'Feature.js') {
          featureFiles.push(fullPath);
        }
      }
    }

    visit(rootDir);
    return featureFiles;
  }

  static async load(featuresRoots = []) {
    const roots = Array.isArray(featuresRoots)
      ? featuresRoots
      : featuresRoots
        ? [featuresRoots]
        : [];
    const existingRoots = roots
      .filter((root) => typeof root === 'string' && root.trim())
      .map((root) => path.resolve(root))
      .filter((root, index, values) => values.indexOf(root) === index)
      .filter((root) => fs.existsSync(root));

    if (!existingRoots.length) {
      return new FeatureRegistry([], existingRoots);
    }

    const featureFiles = uniqueBy(
      existingRoots.flatMap((root) => FeatureRegistry._findFeatureFiles(root)),
      (filePath) => path.resolve(filePath),
    );
    const loadedFeatures = [];
    const featureSources = new Map();

    for (const featureFile of featureFiles) {
      const imported = await import(pathToFileURL(featureFile).href);
      const feature = imported.default ?? imported.feature ?? imported;
      if (!feature?.id) {
        throw new Error(`[FeatureRegistry] Missing feature id in ${featureFile}.`);
      }
      const previousSource = featureSources.get(feature.id);
      if (previousSource) {
        throw new Error(
          `[FeatureRegistry] Duplicate feature id "${feature.id}" in ${previousSource} and ${featureFile}.`,
        );
      }
      featureSources.set(feature.id, featureFile);
      loadedFeatures.push(feature);
    }

    return new FeatureRegistry(loadedFeatures, existingRoots);
  }

  constructor(features = [], featuresDir = []) {
    this.featuresDir = Array.isArray(featuresDir) ? [...featuresDir] : featuresDir;
    this.features = topologicallySortFeatures(features);
    this.featureMap = new Map(this.features.map((feature) => [feature.id, feature]));
    this.baseContext = {};
    this.windows = new Set();

    this.chatToolMap = new Map();
    this.automationDataSourceMap = new Map();
    this.automationOutputMap = new Map();
    this.connectorValidatorMap = new Map();

    this._indexFeatures();
  }

  _indexFeatures() {
    for (const feature of this.features) {
      for (const tool of feature.renderer?.chatTools ?? []) {
        if (!tool?.name) continue;
        this.chatToolMap.set(tool.name, feature.id);
      }

      for (const dataSource of feature.automation?.dataSources ?? []) {
        if (!dataSource?.value) continue;
        this.automationDataSourceMap.set(dataSource.value, feature.id);
      }

      for (const outputType of feature.automation?.outputTypes ?? []) {
        if (!outputType?.value) continue;
        this.automationOutputMap.set(outputType.value, feature.id);
      }

      for (const connector of feature.connectors?.services ?? []) {
        if (!connector?.id || typeof connector.validate !== 'function') continue;
        this.connectorValidatorMap.set(connector.id, feature.id);
      }
    }
  }
  setBaseContext(baseContext = {}) {
    this.baseContext = baseContext;
  }

  attachWindow(windowRef) {
    if (!windowRef) return;
    this.windows.add(windowRef);
    windowRef.on?.('closed', () => this.windows.delete(windowRef));
  }

  emit(featureId, event, payload) {
    for (const windowRef of this.windows) {
      if (!windowRef || windowRef.isDestroyed?.()) continue;
      windowRef.webContents?.send?.('feature:event', { featureId, event, payload });
    }
  }

  _createContext(feature, extraContext = {}) {
    const paths = this.baseContext.paths ?? {};
    const defaultStorageKey = getDefaultFeatureStorageKey(feature);
    return {
      ...this.baseContext,
      ...extraContext,
      feature,
      featureRegistry: this,
      getStorage: (key = defaultStorageKey) => this.baseContext.featureStorage?.get?.(key) ?? null,
      getFeatureDataPath: (...segments) =>
        path.join(paths.FEATURES_DATA_DIR ?? '', feature.id, ...segments),
      emit: (event, payload) => this.emit(feature.id, event, payload),
    };
  }

  getFeature(featureId) {
    return this.featureMap.get(featureId) ?? null;
  }

  getConnectorDefaults() {
    const defaults = [];

    for (const feature of this.features) {
      for (const connector of feature.connectors?.services ?? []) {
        defaults.push({
          id: connector.id,
          defaultState: {
            enabled: connector.defaultState?.enabled ?? false,
            isFree: false,
            noKey: false,
            credentials: deepClone(connector.defaultState?.credentials ?? {}),
            connectedAt: null,
          },
        });
      }

      for (const connector of feature.connectors?.free ?? []) {
        defaults.push({
          id: connector.id,
          defaultState: {
            enabled: connector.defaultState?.enabled ?? true,
            isFree: true,
            noKey: connector.noKey ?? false,
            credentials: deepClone(connector.defaultState?.credentials ?? {}),
            connectedAt: null,
          },
        });
      }
    }

    return defaults;
  }

  getStorageDescriptors() {
    const descriptors = [];

    for (const feature of this.features) {
      descriptors.push(...normalizeFeatureStorage(feature));
    }

    return descriptors;
  }

  _buildServiceConnectors() {
    const serviceMap = new Map();

    for (const feature of this.features) {
      for (const connector of feature.connectors?.services ?? []) {
        serviceMap.set(connector.id, serializeServiceConnector(feature.id, connector));
      }
    }

    for (const feature of this.features) {
      for (const extension of feature.connectors?.serviceExtensions ?? []) {
        if (!extension?.target) continue;
        const current = serviceMap.get(extension.target);
        if (!current) continue;

        current.subServices = uniqueBy(
          [...current.subServices, ...deepClone(extension.subServices ?? [])],
          (item) => item.key,
        );
        current.capabilities = uniqueBy(
          [...current.capabilities, ...deepClone(extension.capabilities ?? [])],
          (item) => item,
        );
        current.automations = uniqueBy(
          [...current.automations, ...deepClone(extension.automations ?? [])],
          (item) => `${item.name}:${item.description}`,
        );
      }
    }

    return sortByOrder([...serviceMap.values()]);
  }

  _buildFreeConnectors() {
    const freeConnectors = [];

    for (const feature of this.features) {
      for (const connector of feature.connectors?.free ?? []) {
        freeConnectors.push(serializeFreeConnector(feature.id, connector));
      }
    }

    return sortByOrder(freeConnectors);
  }

  getBootPayload() {
    const chatTools = [];
    const automationDataSources = [];
    const automationOutputTypes = [];
    const instructionTemplates = {};
    const featurePages = [];

    for (const feature of this.features) {
      for (const page of feature.pages ?? []) {
        if (!page?.id) continue;
        featurePages.push({ featureId: feature.id, ...deepClone(page) });
      }

      for (const tool of feature.renderer?.chatTools ?? []) {
        chatTools.push({ featureId: feature.id, ...deepClone(tool) });
      }

      for (const dataSource of feature.automation?.dataSources ?? []) {
        automationDataSources.push({ featureId: feature.id, ...deepClone(dataSource) });
      }

      for (const outputType of feature.automation?.outputTypes ?? []) {
        automationOutputTypes.push({ featureId: feature.id, ...deepClone(outputType) });
      }

      Object.assign(
        instructionTemplates,
        deepClone(feature.automation?.instructionTemplates ?? {}),
      );
    }

    return {
      features: this.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        dependsOn: [...(feature.dependsOn ?? [])],
      })),
      pages: featurePages,
      connectors: {
        services: this._buildServiceConnectors(),
        free: this._buildFreeConnectors(),
      },
      chat: {
        tools: chatTools,
      },
      automations: {
        dataSources: automationDataSources,
        outputTypes: automationOutputTypes,
        instructionTemplates,
      },
    };
  }

  async invoke(featureId, method, payload = {}, extraContext = {}) {
    const feature = this.getFeature(featureId);
    if (!feature) {
      throw new Error(`[FeatureRegistry] Unknown feature "${featureId}".`);
    }

    const handler = feature.main?.methods?.[method];
    if (typeof handler !== 'function') {
      throw new Error(`[FeatureRegistry] Feature "${featureId}" has no main method "${method}".`);
    }

    return handler(this._createContext(feature, extraContext), payload);
  }

  async validateConnector(connectorId, extraContext = {}) {
    const featureId = this.connectorValidatorMap.get(connectorId);
    if (!featureId) return null;

    const feature = this.getFeature(featureId);
    const connector = (feature.connectors?.services ?? []).find((item) => item.id === connectorId);
    if (!connector || typeof connector.validate !== 'function') return null;

    return connector.validate(this._createContext(feature, extraContext), connectorId);
  }

  async executeChatTool(toolName, params = {}, extraContext = {}) {
    const featureId = this.chatToolMap.get(toolName);
    if (!featureId) return null;
    return {
      handled: true,
      result: await this.invoke(featureId, 'executeChatTool', { toolName, params }, extraContext),
    };
  }

  getAutomationDataSourceDefinition(type) {
    const featureId = this.automationDataSourceMap.get(type);
    if (!featureId) return null;
    const feature = this.getFeature(featureId);
    return (feature.automation?.dataSources ?? []).find((item) => item.value === type) ?? null;
  }

  async collectAutomationDataSource(dataSource, extraContext = {}) {
    const featureId = this.automationDataSourceMap.get(dataSource?.type);
    if (!featureId) return null;

    const feature = this.getFeature(featureId);
    const handler = feature.automation?.dataSourceCollectors?.[dataSource.type];
    if (typeof handler !== 'function') return null;

    return {
      handled: true,
      result: await handler(this._createContext(feature, extraContext), dataSource),
    };
  }

  async executeAutomationOutput(output, payload, extraContext = {}) {
    const featureId = this.automationOutputMap.get(output?.type);
    if (!featureId) return null;

    const feature = this.getFeature(featureId);
    const handler = feature.automation?.outputHandlers?.[output.type];
    if (typeof handler !== 'function') return null;

    return {
      handled: true,
      result: await handler(this._createContext(feature, extraContext), {
        output,
        ...payload,
      }),
    };
  }

  async buildPromptContext(extraContext = {}) {
    const connectedServices = [];
    const sections = [];

    for (const feature of this.features) {
      const getContext = feature.prompt?.getContext;
      if (typeof getContext !== 'function') continue;

      const promptContext = await getContext(this._createContext(feature, extraContext));
      if (!promptContext) continue;

      connectedServices.push(...(promptContext.connectedServices ?? []));
      sections.push(...(promptContext.sections ?? []));
    }

    return {
      connectedServices: uniqueBy(connectedServices),
      sections,
    };
  }

  async runLifecycle(method, extraContext = {}) {
    for (const feature of this.features) {
      const handler = feature.lifecycle?.[method];
      if (typeof handler !== 'function') continue;
      await handler(this._createContext(feature, extraContext));
    }
  }
}

export default FeatureRegistry;
