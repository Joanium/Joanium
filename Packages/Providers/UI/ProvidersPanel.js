import { createElement, setCardFeedback } from '../../Shared/Utils/DomUtils.js';
import { invokeIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createIcon, createProviderIcon } from '../../Shared/Icons/Icons.js';
import { createTwoColGrid } from '../../Shared/TwoColGrid/TwoColGrid.js';
import { createSecretField } from '../../Shared/UI/SecretField.js';
import { EVENTS, dispatchEvent } from '../../Shared/Events/RendererEvents.js';

function createTextField({ label, placeholder }) {
  const wrap = createElement('label', 'providers-field');
  const labelEl = createElement('span', 'providers-field__label', label);
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'providers-field__input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  wrap.append(labelEl, input);
  return { wrap, input };
}

export function createProvidersPanel(strings) {
  const cardRefs = new Map();
  let grid = null;

  function setFeedback(providerId, message, tone = 'info') {
    const refs = cardRefs.get(providerId);
    if (!refs?.feedback) return;
    setCardFeedback(refs.feedback, message, tone, 'providers-card__feedback');
  }

  function refreshDisconnectGuards() {
    const configuredCount = [...cardRefs.values()].filter((refs) =>
      refs.card.classList.contains('providers-card--connected'),
    ).length;

    for (const refs of cardRefs.values()) {
      const isConnected = refs.card.classList.contains('providers-card--connected');
      const isLast = isConnected && configuredCount === 1;
      refs.disconnect.disabled = isLast;
    }
  }

  function setCardState(providerId, provider) {
    const refs = cardRefs.get(providerId);
    if (!refs) return;

    const configured = Boolean(provider?.configured);
    refs.card.classList.toggle('providers-card--connected', configured);
    refs.status.textContent = configured ? strings.connected : strings.notConnected;
    refs.status.className = `providers-card__status${configured ? ' providers-card__status--active' : ''}`;
    refs.disconnect.hidden = !configured;

    if (refs.apiKeyInput && provider?.apiKeySaved) {
      refs.apiKeyInput.placeholder = strings.savedSecret;
    }

    if (refs.endpointInput && provider?.savedEndpoint) {
      refs.endpointInput.value = provider.savedEndpoint;
    }
  }

  async function connectProvider(providerId) {
    const refs = cardRefs.get(providerId);
    const incoming = {};

    if (refs.apiKeyInput) {
      const val = refs.apiKeyInput.value.trim();
      const hasSaved = refs.apiKeyInput.placeholder === strings.savedSecret;
      if (!val && !hasSaved) {
        refs.apiKeyInput.focus();
        setFeedback(providerId, strings.required, 'error');
        return;
      }
      if (val && val.length < 10) {
        refs.apiKeyInput.focus();
        setFeedback(providerId, strings.apiKeyTooShort, 'error');
        return;
      }
      if (val) incoming.apiKey = val;
    }

    if (refs.endpointInput) {
      const val = refs.endpointInput.value.trim();
      if (!val) {
        refs.endpointInput.focus();
        setFeedback(providerId, strings.required, 'error');
        return;
      }
      incoming.endpoint = val;
    }

    refs.connectBtn.disabled = true;
    refs.connectLabel.textContent = strings.connecting;
    setFeedback(providerId, '', 'info');

    try {
      const saved = await invokeIpc('providers:save', providerId, incoming);
      if (refs.apiKeyInput) refs.apiKeyInput.value = '';
      setCardState(providerId, saved);
      refreshDisconnectGuards();
      setFeedback(providerId, strings.connected_feedback, 'success');
      dispatchEvent(EVENTS.PROVIDERS_CHANGED);
    } catch (error) {
      setFeedback(providerId, error?.message ?? strings.saveFailed, 'error');
    } finally {
      refs.connectBtn.disabled = false;
      refs.connectLabel.textContent = strings.connect;
    }
  }

  async function disconnectProvider(providerId) {
    try {
      await invokeIpc('providers:remove', providerId);
      const refs = cardRefs.get(providerId);
      if (refs.apiKeyInput) {
        refs.apiKeyInput.value = '';
        refs.apiKeyInput.placeholder = strings.apiKeyPlaceholder;
      }
      if (refs.endpointInput) refs.endpointInput.value = '';
      setCardState(providerId, { configured: false });
      refreshDisconnectGuards();
      setFeedback(providerId, strings.disconnected_feedback, 'info');
      dispatchEvent(EVENTS.PROVIDERS_CHANGED);
    } catch (error) {
      const message =
        error?.message === 'last_provider'
          ? strings.lastProvider
          : (error?.message ?? strings.disconnectFailed);
      setFeedback(providerId, message, 'error');
    }
  }

  function createProviderCard(provider) {
    const card = createElement('article', 'providers-card');

    // ── Header ───────────────────────────────────────────────────────────────
    const header = createElement('div', 'providers-card__header');

    const badge = createElement('div', 'providers-card__badge');
    badge.style.setProperty('--provider-tint', provider.palette?.tint ?? '#d0b4a2');
    badge.style.setProperty('--provider-glow', provider.palette?.glow ?? '#f7ede7');

    const badgeIcon = createProviderIcon(provider.iconPath, {
      className: 'providers-card__badge-img',
    });
    if (badgeIcon) {
      badge.append(badgeIcon);
    }

    const titleWrap = createElement('div', 'providers-card__title-wrap');
    const titleRow = createElement('div', 'providers-card__title-row');
    titleRow.append(createElement('h3', 'providers-card__title', provider.label));

    const typePill = createElement(
      'span',
      `providers-card__type providers-card__type--${provider.type}`,
      provider.type === 'local' ? strings.local : strings.cloud,
    );
    titleRow.append(typePill);

    const meta = createElement('p', 'providers-card__meta', strings.models(provider.modelCount));
    titleWrap.append(titleRow, meta);

    const status = createElement('span', 'providers-card__status', strings.notConnected);

    const expandBtn = createElement('button', 'providers-card__expand');
    expandBtn.type = 'button';
    expandBtn.setAttribute('aria-label', strings.expand);
    expandBtn.append(createIcon('chevronDownSmall', 'providers-card__expand-icon'));

    header.append(badge, titleWrap, status, expandBtn);

    // ── Collapsible body ─────────────────────────────────────────────────────
    const body = createElement('div', 'providers-card__body');
    const bodyInner = createElement('div', 'providers-card__body-inner');

    let apiKeyInput = null;
    let endpointInput = null;

    if (provider.requiresApiKey) {
      const field = createSecretField({
        label: strings.apiKeyLabel,
        placeholder: strings.apiKeyPlaceholder,
        strings,
        className: 'providers',
      });
      apiKeyInput = field.input;
      bodyInner.append(field.wrap);
    } else {
      const field = createTextField({
        label: strings.endpointLabel,
        placeholder: provider.requirements?.[0]?.defaultValue ?? 'http://localhost:11434',
      });
      endpointInput = field.input;
      bodyInner.append(field.wrap);
    }

    const actions = createElement('div', 'providers-card__actions');
    const disconnect = createElement('button', 'providers-card__secondary', strings.disconnect);
    const connectBtn = createElement('button', 'providers-card__primary');
    const connectLabel = createElement('span', 'providers-card__primary-label', strings.connect);
    disconnect.type = 'button';
    connectBtn.type = 'button';
    disconnect.hidden = true;

    disconnect.addEventListener('click', () => {
      void disconnectProvider(provider.id);
    });
    connectBtn.addEventListener('click', () => {
      void connectProvider(provider.id);
    });
    connectBtn.append(connectLabel);
    actions.append(disconnect, connectBtn);

    const feedback = createElement('div', 'providers-card__feedback');
    feedback.hidden = true;
    feedback.setAttribute('aria-live', 'polite');

    bodyInner.append(actions, feedback);
    body.append(bodyInner);
    card.append(header, body);

    expandBtn.addEventListener('click', () => {
      const isOpen = card.classList.contains('providers-card--open');
      // Close all cards
      for (const [, r] of cardRefs) {
        r.card.classList.remove('providers-card--open');
        r.card.querySelector('.providers-card__expand')?.setAttribute('aria-label', strings.expand);
      }
      // Open this one only if it was closed
      if (!isOpen) {
        card.classList.add('providers-card--open');
        expandBtn.setAttribute('aria-label', strings.collapse);
      }
    });

    cardRefs.set(provider.id, {
      card,
      status,
      disconnect,
      connectBtn,
      connectLabel,
      feedback,
      apiKeyInput,
      endpointInput,
    });

    return card;
  }

  function build() {
    const panel = createElement('div', 'providers');

    grid = createTwoColGrid();
    panel.append(grid.el);
    return panel;
  }

  async function populate() {
    const providers = await invokeIpc('providers:list-configured');

    if (grid.el.querySelector('.providers-card') === null) {
      for (const provider of providers) {
        grid.append(createProviderCard(provider));
      }
    }

    for (const provider of providers) {
      setCardState(provider.id, provider);
    }

    refreshDisconnectGuards();
  }

  return { build, populate };
}
