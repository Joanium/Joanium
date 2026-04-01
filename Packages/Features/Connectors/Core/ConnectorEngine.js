import fs from 'fs';
import path from 'path';

const STATIC_DEFAULT_CONNECTORS = {
  google: {
    enabled: false,
    isFree: false,
    credentials: {},
    connectedAt: null,
  },
  github: {
    enabled: false,
    isFree: false,
    credentials: {},
    connectedAt: null,
  },
  open_meteo: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  coingecko: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  exchange_rate: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  treasury: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  wikipedia: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  ipgeo: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  funfacts: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  jokeapi: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  quotes: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  restcountries: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  hackernews: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  cleanuri: { enabled: true, isFree: true, noKey: true, credentials: {}, connectedAt: null },
  nasa: { enabled: true, isFree: true, noKey: false, credentials: { apiKey: '' }, connectedAt: null },
  fred: { enabled: true, isFree: true, noKey: false, credentials: { apiKey: '' }, connectedAt: null },
  openweathermap: { enabled: false, isFree: true, noKey: false, credentials: { apiKey: '' }, connectedAt: null },
  unsplash: { enabled: false, isFree: true, noKey: false, credentials: { apiKey: '' }, connectedAt: null },
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildDefaultState(featureRegistry = null) {
  const connectors = deepClone(STATIC_DEFAULT_CONNECTORS);
  for (const connector of featureRegistry?.getConnectorDefaults?.() ?? []) {
    if (!connector?.id) continue;
    connectors[connector.id] = {
      ...(connectors[connector.id] ?? {}),
      ...deepClone(connector.defaultState ?? {}),
    };
  }
  return { connectors };
}

export class ConnectorEngine {
  constructor(filePath, featureRegistry = null) {
    this.filePath = filePath;
    this.featureRegistry = featureRegistry;
    this._data = null;
  }

  _load() {
    const defaultState = buildDefaultState(this.featureRegistry);

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this._data = JSON.parse(raw);
      } else {
        this._data = deepClone(defaultState);
      }
    } catch {
      this._data = deepClone(defaultState);
    }

    for (const [key, value] of Object.entries(defaultState.connectors)) {
      if (!this._data.connectors[key]) {
        this._data.connectors[key] = deepClone(value);
      } else {
        this._data.connectors[key].isFree = value.isFree ?? false;
        this._data.connectors[key].noKey = value.noKey ?? false;
      }
    }

    return this._data;
  }

  _persist() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this._data, null, 2), 'utf-8');
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
          isFree: connector.isFree ?? false,
          noKey: connector.noKey ?? false,
        },
      ]),
    );
  }

  getConnector(name) {
    return this._load().connectors[name] ?? null;
  }

  getCredentials(name) {
    const connector = this._load().connectors[name];
    if (!connector?.enabled || !Object.keys(connector.credentials ?? {}).length) return null;
    return connector.credentials;
  }

  getSafeCredentials(name) {
    const credentials = this.getCredentials(name);
    if (!credentials) return null;
    const { accessToken, refreshToken, clientSecret, token, apiKey, ...safe } = credentials;
    return safe;
  }

  getFreeConnectorConfig(name) {
    const connector = this._load().connectors[name];
    if (!connector) return null;
    return {
      enabled: connector.enabled,
      isFree: connector.isFree ?? false,
      noKey: connector.noKey ?? false,
      credentials: connector.credentials ?? {},
    };
  }

  toggleFreeConnector(name, enabled) {
    this._load();
    const connector = this._data.connectors[name];
    if (!connector || !connector.isFree) return;
    connector.enabled = Boolean(enabled);
    this._persist();
  }

  saveFreeConnectorKey(name, apiKey) {
    this._load();
    const connector = this._data.connectors[name];
    if (!connector || !connector.isFree) return;
    connector.credentials = { ...connector.credentials, apiKey: String(apiKey ?? '').trim() };
    if (!connector.noKey && apiKey?.trim()) connector.enabled = true;
    this._persist();
  }

  saveConnector(name, credentials) {
    this._load();
    this._data.connectors[name] = {
      enabled: true,
      isFree: this._data.connectors[name]?.isFree ?? false,
      noKey: this._data.connectors[name]?.noKey ?? false,
      credentials: { ...(this._data.connectors[name]?.credentials ?? {}), ...credentials },
      connectedAt: new Date().toISOString(),
    };
    this._persist();
    return { enabled: true, connectedAt: this._data.connectors[name].connectedAt };
  }

  removeConnector(name) {
    this._load();
    const connector = this._data.connectors[name];
    if (connector?.isFree) return;
    this._data.connectors[name] = {
      enabled: false,
      isFree: connector?.isFree ?? false,
      noKey: connector?.noKey ?? false,
      credentials: {},
      connectedAt: null,
    };
    this._persist();
  }

  updateCredentials(name, patch) {
    this._load();
    if (!this._data.connectors[name]) return;
    this._data.connectors[name].credentials = { ...this._data.connectors[name].credentials, ...patch };
    this._persist();
  }

  isConnected(name) {
    const connector = this._load().connectors[name];
    if (!connector) return false;
    if (connector.isFree) return Boolean(connector.enabled);
    return Boolean(connector.enabled && Object.keys(connector.credentials ?? {}).length > 0);
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
