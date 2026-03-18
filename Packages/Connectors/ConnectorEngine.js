// ─────────────────────────────────────────────
//  openworld — Packages/Connectors/ConnectorEngine.js
//  Manages connector credentials stored in Data/Connectors.json
//  Runs in the Electron main process.
// ─────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';

const DEFAULT_STATE = {
  connectors: {
    gmail: {
      enabled:     false,
      credentials: {},
      connectedAt: null,
    },
    github: {
      enabled:     false,
      credentials: {},
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
    this._data    = null;
  }

  /* ── Private helpers ────────────────────── */

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw  = fs.readFileSync(this.filePath, 'utf-8');
        this._data = JSON.parse(raw);
      } else {
        this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    } catch {
      this._data = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }

    // Ensure default connector slots always exist
    for (const [key, val] of Object.entries(DEFAULT_STATE.connectors)) {
      if (!this._data.connectors[key])
        this._data.connectors[key] = { ...val };
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
   * Return status summary for all connectors (credentials omitted).
   */
  getAll() {
    const data = this._load();
    return Object.fromEntries(
      Object.entries(data.connectors).map(([name, c]) => [
        name,
        { enabled: c.enabled, connectedAt: c.connectedAt },
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
   * Return only the credentials object for a connector.
   * Returns null if connector is unknown or not connected.
   */
  getCredentials(name) {
    const c = this._load().connectors[name];
    if (!c?.enabled || !Object.keys(c.credentials ?? {}).length) return null;
    return c.credentials;
  }

  /**
   * Save (or update) a connector with new credentials.
   * Marks it as enabled and records the connect timestamp.
   */
  saveConnector(name, credentials) {
    this._load();
    this._data.connectors[name] = {
      enabled:     true,
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
   * Disconnect a connector (clears credentials + marks disabled).
   */
  removeConnector(name) {
    this._load();
    this._data.connectors[name] = {
      enabled:     false,
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
   * Returns true when the connector is enabled and has stored credentials.
   */
  isConnected(name) {
    const c = this._load().connectors[name];
    return Boolean(c?.enabled && Object.keys(c.credentials ?? {}).length > 0);
  }
}
