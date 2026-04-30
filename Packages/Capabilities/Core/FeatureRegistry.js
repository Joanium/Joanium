import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { cloneValue as deepClone } from '../../System/Utils/CloneValue.js';
function uniqueBy(items = [], keyFn = (item) => item) {
  const seen = new Set(),
    result = [];
  for (const item of items) {
    const key = keyFn(item);
    seen.has(key) || (seen.add(key), result.push(item));
  }
  return result;
}
function normalizeFeatureStorage(feature = {}) {
  const raw = feature.storage;
  return raw
    ? (Array.isArray(raw) ? raw : Array.isArray(raw.descriptors) ? raw.descriptors : [raw])
        .filter((item) => item && 'object' == typeof item && !Array.isArray(item))
        .map((item) => deepClone(item))
    : [];
}
function sortByOrder(items = []) {
  return [...items].sort((left, right) => {
    const leftOrder = left.order ?? 999,
      rightOrder = right.order ?? 999;
    return leftOrder !== rightOrder
      ? leftOrder - rightOrder
      : String(left.name ?? left.id ?? '').localeCompare(String(right.name ?? right.id ?? ''));
  });
}
function serializeServiceConnector(featureId, connector) {
  return {
    featureId: featureId,
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
    order: connector.order ?? 999,
  };
}
function serializeFreeConnector(featureId, connector) {
  return {
    featureId: featureId,
    id: connector.id,
    name: connector.name,
    icon: connector.icon,
    description: connector.description,
    noKey: connector.noKey ?? !1,
    optionalKey: connector.optionalKey ?? !1,
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
    return (
      (function visit(directory) {
        const entries = fs
          .readdirSync(directory, { withFileTypes: !0 })
          .sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);
          entry.isDirectory()
            ? visit(fullPath)
            : entry.isFile() && 'Feature.js' === entry.name && featureFiles.push(fullPath);
        }
      })(rootDir),
      featureFiles
    );
  }
  static async load(featuresRoots = []) {
    const existingRoots = (
      Array.isArray(featuresRoots) ? featuresRoots : featuresRoots ? [featuresRoots] : []
    )
      .filter((root) => 'string' == typeof root && root.trim())
      .map((root) => path.resolve(root))
      .filter((root, index, values) => values.indexOf(root) === index)
      .filter((root) => fs.existsSync(root));
    if (!existingRoots.length) return new FeatureRegistry([], existingRoots);
    const featureFiles = uniqueBy(
        existingRoots.flatMap((root) => FeatureRegistry._findFeatureFiles(root)),
        (filePath) => path.resolve(filePath),
      ),
      loadedFeatures = [],
      featureSources = new Map();
    for (const featureFile of featureFiles) {
      const imported = await import(pathToFileURL(featureFile).href),
        feature = imported.default ?? imported.feature ?? imported;
      if (!feature?.id) throw new Error(`[FeatureRegistry] Missing feature id in ${featureFile}.`);
      const previousSource = featureSources.get(feature.id);
      if (previousSource)
        throw new Error(
          `[FeatureRegistry] Duplicate feature id "${feature.id}" in ${previousSource} and ${featureFile}.`,
        );
      (featureSources.set(feature.id, featureFile), loadedFeatures.push(feature));
    }
    return new FeatureRegistry(loadedFeatures, existingRoots);
  }
  constructor(features = [], featuresDir = []) {
    ((this.featuresDir = Array.isArray(featuresDir) ? [...featuresDir] : featuresDir),
      (this.features = (function (features = []) {
        const byId = new Map(features.map((feature) => [feature.id, feature])),
          visiting = new Set(),
          visited = new Set(),
          result = [];
        function visit(feature) {
          if (!visited.has(feature.id)) {
            if (visiting.has(feature.id))
              throw new Error(`[FeatureRegistry] Circular dependency involving "${feature.id}".`);
            visiting.add(feature.id);
            for (const dependencyId of feature.dependsOn ?? []) {
              const dependency = byId.get(dependencyId);
              if (!dependency)
                throw new Error(
                  `[FeatureRegistry] Feature "${feature.id}" depends on missing feature "${dependencyId}".`,
                );
              visit(dependency);
            }
            (visiting.delete(feature.id), visited.add(feature.id), result.push(feature));
          }
        }
        for (const feature of features) visit(feature);
        return result;
      })(features)),
      (this.featureMap = new Map(this.features.map((feature) => [feature.id, feature]))),
      (this.baseContext = {}),
      (this.windows = new Set()),
      (this.chatToolMap = new Map()),
      (this.connectorValidatorMap = new Map()),
      this._indexFeatures());
  }
  _indexFeatures() {
    for (const feature of this.features) {
      for (const tool of feature.renderer?.chatTools ?? [])
        tool?.name && this.chatToolMap.set(tool.name, feature.id);
      for (const connector of feature.connectors?.services ?? [])
        connector?.id &&
          'function' == typeof connector.validate &&
          this.connectorValidatorMap.set(connector.id, feature.id);
    }
  }
  setBaseContext(baseContext = {}) {
    this.baseContext = baseContext;
  }
  attachWindow(windowRef) {
    windowRef &&
      (this.windows.add(windowRef), windowRef.on?.('closed', () => this.windows.delete(windowRef)));
  }
  emit(featureId, event, payload) {
    for (const windowRef of this.windows)
      windowRef &&
        !windowRef.isDestroyed?.() &&
        windowRef.webContents?.send?.('feature:event', {
          featureId: featureId,
          event: event,
          payload: payload,
        });
  }
  _createContext(feature, extraContext = {}) {
    const paths = this.baseContext.paths ?? {},
      defaultStorageKey = (function (feature = {}) {
        return normalizeFeatureStorage(feature)[0]?.key ?? feature.id;
      })(feature);
    return {
      ...this.baseContext,
      ...extraContext,
      feature: feature,
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
      for (const connector of feature.connectors?.services ?? [])
        defaults.push({
          id: connector.id,
          defaultState: {
            enabled: connector.defaultState?.enabled ?? !1,
            isFree: !1,
            noKey: !1,
            credentials: deepClone(connector.defaultState?.credentials ?? {}),
            connectedAt: null,
          },
        });
      for (const connector of feature.connectors?.free ?? [])
        defaults.push({
          id: connector.id,
          defaultState: {
            enabled: connector.defaultState?.enabled ?? !0,
            isFree: !0,
            noKey: connector.noKey ?? !1,
            credentials: deepClone(connector.defaultState?.credentials ?? {}),
            connectedAt: null,
          },
        });
    }
    return defaults;
  }
  getStorageDescriptors() {
    const descriptors = [];
    for (const feature of this.features) descriptors.push(...normalizeFeatureStorage(feature));
    return descriptors;
  }
  _buildServiceConnectors() {
    const serviceMap = new Map();
    for (const feature of this.features)
      for (const connector of feature.connectors?.services ?? [])
        serviceMap.set(connector.id, serializeServiceConnector(feature.id, connector));
    for (const feature of this.features)
      for (const extension of feature.connectors?.serviceExtensions ?? []) {
        if (!extension?.target) continue;
        const current = serviceMap.get(extension.target);
        current &&
          ((current.subServices = uniqueBy(
            [...current.subServices, ...deepClone(extension.subServices ?? [])],
            (item) => item.key,
          )),
          (current.capabilities = uniqueBy(
            [...current.capabilities, ...deepClone(extension.capabilities ?? [])],
            (item) => item,
          )));
      }
    return sortByOrder([...serviceMap.values()]);
  }
  _buildFreeConnectors() {
    const freeConnectors = [];
    for (const feature of this.features)
      for (const connector of feature.connectors?.free ?? [])
        freeConnectors.push(serializeFreeConnector(feature.id, connector));
    return sortByOrder(freeConnectors);
  }
  getBootPayload() {
    const chatTools = [],
      featurePages = [];
    for (const feature of this.features) {
      for (const page of feature.pages ?? [])
        page?.id && featurePages.push({ featureId: feature.id, ...deepClone(page) });
      for (const tool of feature.renderer?.chatTools ?? [])
        chatTools.push({ featureId: feature.id, ...deepClone(tool) });
    }
    return {
      features: this.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        dependsOn: [...(feature.dependsOn ?? [])],
      })),
      pages: featurePages,
      connectors: { services: this._buildServiceConnectors(), free: this._buildFreeConnectors() },
      chat: { tools: chatTools },
    };
  }
  async invoke(featureId, method, payload = {}, extraContext = {}) {
    const feature = this.getFeature(featureId);
    if (!feature) throw new Error(`[FeatureRegistry] Unknown feature "${featureId}".`);
    const handler = feature.main?.methods?.[method];
    if ('function' != typeof handler)
      throw new Error(`[FeatureRegistry] Feature "${featureId}" has no main method "${method}".`);
    return handler(this._createContext(feature, extraContext), payload);
  }
  async validateConnector(connectorId, extraContext = {}) {
    const featureId = this.connectorValidatorMap.get(connectorId);
    if (!featureId) return null;
    const feature = this.getFeature(featureId),
      connector = (feature.connectors?.services ?? []).find((item) => item.id === connectorId);
    return connector && 'function' == typeof connector.validate
      ? connector.validate(this._createContext(feature, extraContext), connectorId)
      : null;
  }
  async executeChatTool(toolName, params = {}, extraContext = {}) {
    const featureId = this.chatToolMap.get(toolName);
    return featureId
      ? {
          handled: !0,
          result: await this.invoke(
            featureId,
            'executeChatTool',
            { toolName: toolName, params: params },
            extraContext,
          ),
        }
      : null;
  }
  async buildPromptContext(extraContext = {}) {
    const connectedServices = [],
      sections = [];
    for (const feature of this.features) {
      const getContext = feature.prompt?.getContext;
      if ('function' != typeof getContext) continue;
      const promptContext = await getContext(this._createContext(feature, extraContext));
      promptContext &&
        (connectedServices.push(...(promptContext.connectedServices ?? [])),
        sections.push(...(promptContext.sections ?? [])));
    }
    return { connectedServices: uniqueBy(connectedServices), sections: sections };
  }
  async runLifecycle(method, extraContext = {}) {
    for (const feature of this.features) {
      const handler = feature.lifecycle?.[method];
      'function' == typeof handler && (await handler(this._createContext(feature, extraContext)));
    }
  }
}
export default FeatureRegistry;
