import { readUserState, writeUserState } from '../../Shared/UserData/UserData.js';
import { normalizeString } from '../../Shared/Utils/StringUtils.js';
import {
  CONNECTOR_CATALOG,
  createConnectorCatalog,
  getConnectorDefinition,
} from './ConnectorCatalog.js';

function getConnectorFields(connector) {
  return Array.isArray(connector.fields) && connector.fields.length
    ? connector.fields
    : [{ key: connector.credentialKey, required: !connector.optional }];
}

function hasCredential(connector, details = {}) {
  if (connector.optional) {
    return true;
  }

  return getConnectorFields(connector)
    .filter((field) => field.required !== false)
    .every((field) => Boolean(normalizeString(details[field.key])));
}

function hasAnySavedCredential(connector, details = {}) {
  return getConnectorFields(connector).some((field) =>
    Boolean(normalizeString(details[field.key])),
  );
}

function getSavedCredentialKeys(connector, details = {}) {
  return getConnectorFields(connector)
    .filter((field) => Boolean(normalizeString(details[field.key])))
    .map((field) => field.key);
}

export function createConnectorStateManager({
  rootDirectory,
  connectorCatalog = CONNECTOR_CATALOG,
}) {
  const catalog = createConnectorCatalog(connectorCatalog);

  async function readState() {
    return readUserState(rootDirectory);
  }

  async function writeState(updater) {
    const state = await readState();
    return writeUserState(rootDirectory, updater(state));
  }

  function toViewModel(connector, details = {}) {
    return {
      ...connector,
      configured: hasCredential(connector, details),
      credentialSaved: hasAnySavedCredential(connector, details),
      savedCredentialKeys: getSavedCredentialKeys(connector, details),
      credentialKey: connector.credentialKey,
    };
  }

  return {
    async listConnectors() {
      const state = await readState();
      const details = state.connectors?.details ?? {};
      return catalog.map((connector) => toViewModel(connector, details[connector.id] ?? {}));
    },

    async saveConnector(connectorId, incoming = {}) {
      const connector = getConnectorDefinition(connectorId, catalog);
      if (!connector) throw new Error('Unknown connector.');

      const fields = getConnectorFields(connector);
      const incomingCredentials =
        incoming.credentials && typeof incoming.credentials === 'object'
          ? incoming.credentials
          : { [connector.credentialKey]: incoming.credential };

      await writeState((state) => {
        const currentDetails = state.connectors?.details ?? {};
        const existing = currentDetails[connectorId] ?? {};
        const nextDetails = { ...existing };

        for (const field of fields) {
          const credential = sanitizeCredential(incomingCredentials[field.key]);
          if (credential) {
            nextDetails[field.key] = credential;
          }
        }

        if (!connector.optional) {
          const missingField = fields
            .filter((field) => field.required !== false)
            .find((field) => !sanitizeCredential(nextDetails[field.key]));
          if (missingField) {
            throw new Error(`${missingField.label ?? 'Credential'} is required.`);
          }
        }

        return {
          ...state,
          connectors: {
            ...(state.connectors ?? {}),
            details: {
              ...currentDetails,
              [connectorId]: nextDetails,
            },
          },
        };
      });

      const updated = await this.listConnectors();
      return updated.find((item) => item.id === connectorId) ?? null;
    },

    async removeConnector(connectorId) {
      await writeState((state) => {
        const currentDetails = state.connectors?.details ?? {};
        return {
          ...state,
          connectors: {
            ...(state.connectors ?? {}),
            details: Object.fromEntries(
              Object.entries(currentDetails).filter(([id]) => id !== connectorId),
            ),
          },
        };
      });
      return { ok: true };
    },

    async saveConnectorDetails(connectorId, rawDetails = {}) {
      await writeState((state) => {
        const currentDetails = state.connectors?.details ?? {};
        const existing = currentDetails[connectorId] ?? {};
        const nextDetails = { ...existing };
        for (const [key, value] of Object.entries(rawDetails)) {
          const sanitized = sanitizeCredential(value);
          if (sanitized) nextDetails[key] = sanitized;
        }
        return {
          ...state,
          connectors: {
            ...(state.connectors ?? {}),
            details: { ...currentDetails, [connectorId]: nextDetails },
          },
        };
      });
      const updated = await this.listConnectors();
      return updated.find((item) => item.id === connectorId) ?? null;
    },
  };
}
