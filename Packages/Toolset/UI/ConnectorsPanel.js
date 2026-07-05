import { createElement, setCardFeedback } from '../../Shared/Utils/DomUtils.js';
import { invokeIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createIcon, createProviderIcon } from '../../Shared/Icons/Icons.js';
import { createTwoColGrid } from '../../Shared/TwoColGrid/TwoColGrid.js';
import { getConnectorIconPath } from '../../Shared/Icons/ConnectorIcons/ConnectorIcons.js';
import { createSecretField } from '../../Shared/UI/SecretField.js';
import { EVENTS, dispatchEvent } from '../../Shared/Events/RendererEvents.js';
import defaultStrings from '../I18n/Connectors.en.js';

// ── Icon map: connector id → filename in Assets/Icons/ ──────────────────────
// ────────────────────────────────────────────────────────────────────────────

function createConnectorSecretField({ fieldConfig, strings }) {
  return createSecretField({
    label: fieldConfig.label,
    placeholder: fieldConfig.placeholder,
    strings: { show: strings.show, hide: strings.hide },
    className: 'connectors',
    type: fieldConfig.type === 'text' ? 'text' : 'password',
  });
}

function getConnectorFields(connector) {
  return Array.isArray(connector.fields) && connector.fields.length
    ? connector.fields
    : [
        {
          key: connector.credentialKey,
          label: connector.credentialLabel,
          placeholder: connector.credentialPlaceholder,
          type: 'password',
          required: !connector.optional,
        },
      ];
}

function getVisibleFields(connector) {
  return getConnectorFields(connector).filter((field) => !field.hidden);
}

function isPublicConnector(connector) {
  return (
    connector.publicTool === true || connector.noCredential === true || connector.noKey === true
  );
}

function createConnectorBadge(connector) {
  const badge = createElement('div', 'connectors-card__badge');
  const iconPath = getConnectorIconPath(connector.id);

  const badgeIcon = createProviderIcon(iconPath, {
    className: 'connectors-card__badge-img',
  });
  if (badgeIcon) {
    badge.append(badgeIcon);
  } else {
    badge.append(createIcon('globe', 'connectors-card__badge-icon'));
  }

  return badge;
}

function createConnectorCopy(connector) {
  const copy = createElement('div', 'connectors-card__copy');
  copy.append(
    createElement('h3', 'connectors-card__title', connector.label),
    createElement('p', 'connectors-card__description', connector.description),
  );
  return copy;
}

export function createConnectorsPanel(strings = defaultStrings) {
  const refs = new Map();
  let servicesMount = null;
  let publicMount = null;

  function setFeedback(connectorId, message, tone = 'info') {
    const ref = refs.get(connectorId);
    if (!ref) return;
    setCardFeedback(ref.feedback, message, tone, 'connectors-card__feedback');
  }

  function setCardState(connector) {
    const ref = refs.get(connector.id);
    if (!ref) return;

    ref.card.classList.toggle('connectors-card--connected', Boolean(connector.configured));
    ref.status.textContent = connector.configured ? strings.connected : strings.notConnected;
    ref.status.className = `connectors-card__status${connector.configured ? ' connectors-card__status--active' : ''}`;
    ref.remove.hidden = !connector.credentialSaved;
    const savedKeys = new Set(connector.savedCredentialKeys ?? []);

    for (const field of getVisibleFields(connector)) {
      const input = ref.inputs.get(field.key);
      if (!input) continue;
      if (savedKeys.has(field.key)) {
        input.value = '';
        input.placeholder = strings.savedSecret;
      } else {
        input.placeholder = field.placeholder ?? '';
      }
    }
  }

  function collectCredentials(connector, inputs, { allowOptionalBlank = false } = {}) {
    const credentials = {};
    let firstMissingInput = null;
    let firstShortInput = null;

    for (const field of getVisibleFields(connector)) {
      const input = inputs.get(field.key);
      credentials[field.key] = input?.value.trim() ?? '';
      const fieldHasSavedCredential = input?.placeholder === strings.savedSecret;
      const canSkipBlank = allowOptionalBlank && connector.optional;

      if (
        field.required !== false &&
        !credentials[field.key] &&
        !fieldHasSavedCredential &&
        !canSkipBlank &&
        !firstMissingInput
      ) {
        firstMissingInput = input;
      }

      if (
        !firstShortInput &&
        field.type !== 'text' &&
        credentials[field.key] &&
        credentials[field.key].length < 10
      ) {
        firstShortInput = input;
      }
    }

    return { credentials, firstMissingInput, firstShortInput };
  }

  function showCredentialError(connectorId, { firstMissingInput, firstShortInput }) {
    if (firstMissingInput) {
      firstMissingInput.focus();
      setFeedback(connectorId, strings.credentialRequired, 'error');
      return true;
    }

    if (firstShortInput) {
      firstShortInput.focus();
      setFeedback(connectorId, strings.credentialTooShort, 'error');
      return true;
    }

    return false;
  }

  async function saveConnector(connector) {
    const ref = refs.get(connector.id);
    const validation = collectCredentials(connector, ref.inputs, { allowOptionalBlank: true });
    if (showCredentialError(connector.id, validation)) return;

    ref.save.disabled = true;
    ref.saveLabel.textContent = strings.saving;
    setFeedback(connector.id, '', 'info');

    try {
      const updated = await invokeIpc('connectors:save', connector.id, {
        credentials: validation.credentials,
      });
      setCardState(updated);
      setFeedback(connector.id, strings.connectedFeedback, 'success');
      dispatchEvent(EVENTS.CONNECTORS_CHANGED);
    } catch (error) {
      setFeedback(connector.id, error?.message ?? strings.saveFailed, 'error');
    } finally {
      ref.save.disabled = false;
      ref.saveLabel.textContent = strings.save;
    }
  }

  async function removeConnector(connector) {
    try {
      await invokeIpc('connectors:remove', connector.id);
      const ref = refs.get(connector.id);
      for (const field of getConnectorFields(connector)) {
        const input = ref.inputs.get(field.key);
        if (!input) continue;
        input.value = '';
        input.placeholder = field.placeholder ?? '';
      }
      setCardState({ ...connector, configured: connector.optional, credentialSaved: false });
      setFeedback(connector.id, strings.disconnectedFeedback, 'info');
      dispatchEvent(EVENTS.CONNECTORS_CHANGED);
    } catch (error) {
      setFeedback(connector.id, error?.message ?? strings.disconnectFailed, 'error');
    }
  }

  function createConnectorCard(connector) {
    const card = createElement('article', 'connectors-card');

    // ── Header (always visible) ──────────────────────────────────────────────
    const header = createElement('div', 'connectors-card__header');

    const status = createElement('span', 'connectors-card__status', strings.notConnected);

    const expandBtn = createElement('button', 'connectors-card__expand');
    expandBtn.type = 'button';
    expandBtn.setAttribute('aria-label', strings.expand);
    expandBtn.append(createIcon('chevronDownSmall', 'connectors-card__expand-icon'));

    header.append(
      createConnectorBadge(connector),
      createConnectorCopy(connector),
      status,
      expandBtn,
    );

    // ── Collapsible body ─────────────────────────────────────────────────────
    const body = createElement('div', 'connectors-card__body');
    const bodyInner = createElement('div', 'connectors-card__body-inner');

    const inputs = new Map();
    const fields = getVisibleFields(connector).map((fieldConfig) => {
      const { wrap: field, input } = createConnectorSecretField({ fieldConfig, strings });
      inputs.set(fieldConfig.key, input);
      return field;
    });
    const actions = createElement('div', 'connectors-card__actions');
    const remove = createElement('button', 'connectors-card__secondary', strings.disconnect);
    remove.type = 'button';
    remove.hidden = true;
    remove.addEventListener('click', () => {
      void removeConnector(connector);
    });

    let save;
    let saveLabel;

    if (connector.oauthChannel) {
      // ── OAuth flow button ──────────────────────────────────────────────────
      save = createElement('button', 'connectors-card__primary');
      saveLabel = createElement('span', 'connectors-card__primary-label', strings.connect);
      save.type = 'button';
      save.append(saveLabel);
      save.addEventListener('click', async () => {
        const validation = collectCredentials(connector, inputs);
        if (showCredentialError(connector.id, validation)) return;

        save.disabled = true;
        saveLabel.textContent = strings.connecting;
        setFeedback(connector.id, '', 'info');
        try {
          const updated = await invokeIpc(connector.oauthChannel, validation.credentials);
          setCardState(updated);
          setFeedback(connector.id, strings.connectedFeedback, 'success');
          dispatchEvent(EVENTS.CONNECTORS_CHANGED);
        } catch (error) {
          setFeedback(connector.id, error?.message ?? strings.oauthFailed, 'error');
        } finally {
          save.disabled = false;
          saveLabel.textContent = strings.connect;
        }
      });
    } else {
      // ── Normal save button ─────────────────────────────────────────────────
      save = createElement('button', 'connectors-card__primary');
      saveLabel = createElement('span', 'connectors-card__primary-label', strings.save);
      save.type = 'button';
      save.append(saveLabel);
      save.addEventListener('click', () => {
        void saveConnector(connector);
      });
    }

    actions.append(remove, save);

    const feedback = createElement('div', 'connectors-card__feedback');
    feedback.hidden = true;
    feedback.setAttribute('aria-live', 'polite');

    bodyInner.append(...fields, actions, feedback);
    body.append(bodyInner);
    card.append(header, body);

    expandBtn.addEventListener('click', () => {
      const isOpen = card.classList.contains('connectors-card--open');
      // Close all cards
      for (const [, ref] of refs) {
        ref.card.classList.remove('connectors-card--open');
        ref.card
          .querySelector('.connectors-card__expand')
          ?.setAttribute('aria-label', strings.expand);
      }
      // Open this one only if it was closed
      if (!isOpen) {
        card.classList.add('connectors-card--open');
        expandBtn.setAttribute('aria-label', strings.collapse);
      }
    });

    refs.set(connector.id, { card, inputs, status, save, saveLabel, remove, feedback });
    setCardState(connector);
    return card;
  }

  function createPublicConnectorCard(connector) {
    const card = createElement(
      'article',
      'connectors-card connectors-card--connected connectors-card--public',
    );
    const header = createElement('div', 'connectors-card__header');
    const status = createElement(
      'span',
      'connectors-card__status connectors-card__status--active',
      strings.available,
    );
    header.append(createConnectorBadge(connector), createConnectorCopy(connector), status);
    card.append(header);

    if (connector.toolHint) {
      const hint = createElement('p', 'connectors-card__public-hint', connector.toolHint);
      card.append(hint);
    }

    return card;
  }

  function createSection(title, subtitle) {
    const section = createElement('section', 'connectors-section');
    const header = createElement('div', 'connectors-section__header');
    header.append(
      createElement('h3', 'connectors-section__title', title),
      createElement('p', 'connectors-section__subtitle', subtitle),
    );
    const mount = createElement('div', 'connectors-section__grid');
    section.append(header, mount);
    return { section, mount };
  }

  function renderGrid(mount, connectors, createCard) {
    mount.replaceChildren();
    if (!connectors.length) {
      mount.append(createElement('p', 'connectors-section__empty', strings.emptySection));
      return;
    }

    const nextGrid = createTwoColGrid();
    for (const connector of connectors) {
      nextGrid.append(createCard(connector));
    }
    mount.append(nextGrid.el);
  }

  function build() {
    const panel = createElement('div', 'connectors');
    const servicesSection = createSection(strings.credentialsTitle, strings.credentialsSubtitle);
    const publicSection = createSection(strings.publicTitle, strings.publicSubtitle);
    servicesMount = servicesSection.mount;
    publicMount = publicSection.mount;
    panel.append(servicesSection.section, publicSection.section);
    return panel;
  }

  async function populate() {
    const connectors = await invokeIpc('connectors:list');
    const serviceConnectors = connectors.filter((connector) => !isPublicConnector(connector));
    const publicConnectors = connectors.filter(isPublicConnector);

    refs.clear();
    renderGrid(servicesMount, serviceConnectors, createConnectorCard);
    renderGrid(publicMount, publicConnectors, createPublicConnectorCard);

    for (const connector of serviceConnectors) {
      setCardState(connector);
    }
  }

  return { build, populate };
}
