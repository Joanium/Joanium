import fs from 'fs';
import path from 'path';

const DEFAULT_STATE = {
  connectors: {
    // ── Service connectors (need credentials) ──────────────────────────
    gmail: {
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

    // ── Free APIs — no key required, enabled by default ────────────────
    open_meteo: {
      enabled: true,
      isFree: true,
      noKey: true,
      credentials: {},
      connectedAt: null,
    },
    coingecko: {
      enabled: true,
      isFree: true,
      noKey: true,
      credentials: {},
      connectedAt: null,
    },
    exchange_rate: {
      enabled: true,
      isFree: true,
      noKey: true,
      credentials: {},
      connectedAt: null,
    },
    treasury: {
      enabled: true,
      isFree: true,
      noKey: true,
      credentials: {},
      connectedAt: null,
    },

    // ── Free APIs with optional/required keys ──────────────────────────
    fred: {
      enabled: true,
      isFree: true,
      noKey: false,
      credentials: { apiKey: '' },
      connectedAt: null,
    },
    openweathermap: {
      enabled: false,
      isFree: true,
      noKey: false,
      credentials: { apiKey: '' },
      connectedAt: null,
    },
    unsplash: {
      enabled: false,
      isFree: true,
      noKey: false,
      credentials: { apiKey: '' },
      connectedAt: null,
    },
  },
};

export class ConnectorEngine {
  /**
   * @param {string} filePath  Absolute path to Data/Connectors.json
   */
  constructor(filePath) {
    this.filePath = filePath;
    this._data = null;
  }

  /* ── Private helpers ────────────────────── */

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this._data = JSON.parse(raw);
      } else {
        this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    } catch {
      this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }

    // Ensure all default connector slots exist (merges in new free connectors)
    for (const [key, val] of Object.entries(DEFAULT_STATE.connectors)) {
      if (!this._data.connectors[key]) {
        // New connector not in saved file — use default (free ones get enabled: true)
        this._data.connectors[key] = JSON.parse(JSON.stringify(val));
      } else {
        // Preserve isFree / noKey flags from defaults
        this._data.connectors[key].isFree = val.isFree ?? false;
        this._data.connectors[key].noKey = val.noKey ?? false;
      }
    }

    return this._data;
  }

  _persist() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(this._data, null, 2),
      'utf-8',
    );
  }

  /* ── Public API ─────────────────────────── */

  /**
   * Return status summary for all connectors (credentials omitted for service connectors).
   */
  getAll() {
    const data = this._load();
    return Object.fromEntries(
      Object.entries(data.connectors).map(([name, c]) => [
        name,
        {
          enabled: c.enabled,
          connectedAt: c.connectedAt,
          isFree: c.isFree ?? false,
          noKey: c.noKey ?? false,
        },
      ]),
    );
  }

  /**
   * Return full state of a single connector (includes credentials).
   */
  getConnector(name) {
    return this._load().connectors[name] ?? null;
  }

  /**
   * Return only the credentials object for a service connector.
   * Returns null if connector is unknown or not connected.
   */
  getCredentials(name) {
    const c = this._load().connectors[name];
    if (!c?.enabled || !Object.keys(c.credentials ?? {}).length) return null;
    return c.credentials;
  }

  /**
   * Return config for a free API connector (enabled status + optional key).
   */
  getFreeConnectorConfig(name) {
    const c = this._load().connectors[name];
    if (!c) return null;
    return {
      enabled: c.enabled,
      isFree: c.isFree ?? false,
      noKey: c.noKey ?? false,
      credentials: c.credentials ?? {},
    };
  }

  /**
   * Toggle a free connector on/off.
   */
  toggleFreeConnector(name, enabled) {
    this._load();
    const c = this._data.connectors[name];
    if (!c || !c.isFree) return;
    c.enabled = Boolean(enabled);
    this._persist();
  }

  /**
   * Save (or update) an optional API key for a free connector.
   */
  saveFreeConnectorKey(name, apiKey) {
    this._load();
    const c = this._data.connectors[name];
    if (!c || !c.isFree) return;
    c.credentials = { ...c.credentials, apiKey: String(apiKey ?? '').trim() };
    if (!c.noKey && apiKey?.trim()) c.enabled = true;
    this._persist();
  }

  /**
   * Save (or update) a service connector with new credentials.
   * Marks it as enabled and records the connect timestamp.
   */
  saveConnector(name, credentials) {
    this._load();
    this._data.connectors[name] = {
      enabled: true,
      isFree: false,
      credentials: {
        ...(this._data.connectors[name]?.credentials ?? {}),
        ...credentials,
      },
      connectedAt: new Date().toISOString(),
    };
    this._persist();
    return { enabled: true, connectedAt: this._data.connectors[name].connectedAt };
  }

  /**
   * Disconnect a service connector (clears credentials + marks disabled).
   */
  removeConnector(name) {
    this._load();
    const isFree = this._data.connectors[name]?.isFree ?? false;
    if (isFree) return; // Don't "remove" free connectors, only toggle
    this._data.connectors[name] = {
      enabled: false,
      isFree: false,
      credentials: {},
      connectedAt: null,
    };
    this._persist();
  }

  /**
   * Patch only the credentials (e.g. after a token refresh).
   */
  updateCredentials(name, patch) {
    this._load();
    if (!this._data.connectors[name]) return;
    this._data.connectors[name].credentials = {
      ...this._data.connectors[name].credentials,
      ...patch,
    };
    this._persist();
  }

  /**
   * Returns true when the connector is enabled (and has credentials for service connectors).
   */
  isConnected(name) {
    const c = this._load().connectors[name];
    if (!c) return false;
    if (c.isFree) return Boolean(c.enabled);
    return Boolean(c.enabled && Object.keys(c.credentials ?? {}).length > 0);
  }

  /**
   * Returns true if a connector (free or service) is enabled.
   */
  isEnabled(name) {
    const c = this._load().connectors[name];
    return Boolean(c?.enabled);
  }
}
