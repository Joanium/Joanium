import defineEngine from '../../../System/Contracts/DefineEngine.js';
import { cloneValue as deepClone } from '../../../System/Utils/CloneValue.js';
export class ConnectorEngine {
  constructor(storage, featureRegistry = null) {
    ((this.storage = storage), (this.featureRegistry = featureRegistry), (this._data = null));
  }
  _load() {
    const defaultState = (function (featureRegistry = null) {
      const connectors = {};
      for (const connector of featureRegistry?.getConnectorDefaults?.() ?? [])
        connector?.id && (connectors[connector.id] = deepClone(connector.defaultState));
      return { connectors: connectors };
    })(this.featureRegistry);
    try {
      const loaded = this.storage.load(() => deepClone(defaultState)),
        connectors =
          loaded?.connectors &&
          'object' == typeof loaded.connectors &&
          !Array.isArray(loaded.connectors)
            ? loaded.connectors
            : {};
      this._data = {
        ...(loaded && 'object' == typeof loaded && !Array.isArray(loaded) ? loaded : {}),
        connectors: connectors,
      };
    } catch {
      this._data = deepClone(defaultState);
    }
    for (const [key, value] of Object.entries(defaultState.connectors)) {
      const current = this._data.connectors[key];
      !current || 'object' != typeof current || Array.isArray(current)
        ? (this._data.connectors[key] = deepClone(value))
        : (this._data.connectors[key] = {
            ...deepClone(value),
            ...current,
            credentials: { ...(value.credentials ?? {}), ...(current.credentials ?? {}) },
            isFree: value.isFree ?? !1,
            noKey: value.noKey ?? !1,
          });
    }
    return this._data;
  }
  _persist() {
    try {
      this.storage.save(this._data);
    } catch (err) {
      console.error('[ConnectorEngine] _persist error:', err);
    }
  }
  getAll() {
    const data = this._load();
    return Object.fromEntries(
      Object.entries(data.connectors).map(([name, connector]) => [
        name,
        {
          enabled: connector.enabled,
          connectedAt: connector.connectedAt,
          isFree: connector.isFree ?? !1,
          noKey: connector.noKey ?? !1,
        },
      ]),
    );
  }
  getConnector(name) {
    return this._load().connectors[name] ?? null;
  }
  getCredentials(name) {
    const connector = this._load().connectors[name];
    return connector?.enabled && Object.keys(connector.credentials ?? {}).length
      ? connector.credentials
      : null;
  }
  getSafeCredentials(name) {
    const credentials = this.getCredentials(name);
    if (!credentials) return null;
    const {
      accessToken: accessToken,
      refreshToken: refreshToken,
      clientSecret: clientSecret,
      token: token,
      apiKey: apiKey,
      ...safe
    } = credentials;
    return safe;
  }
  getFreeConnectorConfig(name) {
    const connector = this._load().connectors[name];
    return connector
      ? {
          enabled: connector.enabled,
          isFree: connector.isFree ?? !1,
          noKey: connector.noKey ?? !1,
          credentials: connector.credentials ?? {},
        }
      : null;
  }
  toggleFreeConnector(name, enabled) {
    this._load();
    const connector = this._data.connectors[name];
    connector && connector.isFree && ((connector.enabled = Boolean(enabled)), this._persist());
  }
  saveFreeConnectorKey(name, apiKey) {
    this._load();
    const connector = this._data.connectors[name];
    connector &&
      connector.isFree &&
      ((connector.credentials = { ...connector.credentials, apiKey: String(apiKey ?? '').trim() }),
      !connector.noKey && apiKey?.trim() && (connector.enabled = !0),
      this._persist());
  }
  saveConnector(name, credentials) {
    return (
      this._load(),
      (this._data.connectors[name] = {
        enabled: !0,
        isFree: this._data.connectors[name]?.isFree ?? !1,
        noKey: this._data.connectors[name]?.noKey ?? !1,
        credentials: { ...(this._data.connectors[name]?.credentials ?? {}), ...credentials },
        connectedAt: new Date().toISOString(),
      }),
      this._persist(),
      { enabled: !0, connectedAt: this._data.connectors[name].connectedAt }
    );
  }
  removeConnector(name) {
    this._load();
    const connector = this._data.connectors[name];
    connector?.isFree ||
      ((this._data.connectors[name] = {
        enabled: !1,
        isFree: connector?.isFree ?? !1,
        noKey: connector?.noKey ?? !1,
        credentials: {},
        connectedAt: null,
      }),
      this._persist());
  }
  updateCredentials(name, patch) {
    (this._load(),
      this._data.connectors[name] &&
        ((this._data.connectors[name].credentials = {
          ...this._data.connectors[name].credentials,
          ...patch,
        }),
        this._persist()));
  }
  isConnected(name) {
    const connector = this._load().connectors[name];
    return (
      !!connector &&
      (connector.isFree
        ? Boolean(connector.enabled)
        : Boolean(connector.enabled && Object.keys(connector.credentials ?? {}).length > 0))
    );
  }
  isEnabled(name) {
    const connector = this._load().connectors[name];
    return Boolean(connector?.enabled);
  }
  isGoogleServiceEnabled(service) {
    const credentials = this.getCredentials('google');
    return Boolean(credentials?.services?.[service]);
  }
}
export const engineMeta = defineEngine({
  id: 'connectors',
  provides: 'connectorEngine',
  needs: ['featureRegistry', 'featureStorage'],
  storage: { key: 'connectors', featureKey: 'connectors', fileName: 'Connectors.json' },
  create: ({ featureRegistry: featureRegistry, featureStorage: featureStorage }) =>
    new ConnectorEngine(featureStorage.get('connectors'), featureRegistry),
});
