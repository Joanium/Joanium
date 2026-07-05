import { createElement, formatText, setCardFeedback } from '../../Shared/Utils/DomUtils.js';
import { invokeIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createIcon, createProviderIcon } from '../../Shared/Icons/Icons.js';
import { createTwoColGrid } from '../../Shared/TwoColGrid/TwoColGrid.js';
import { getConnectorIconPath } from '../../Shared/Icons/ConnectorIcons/ConnectorIcons.js';
import { createSecretField } from '../../Shared/UI/SecretField.js';
import { CHANNEL_NAMES } from '../../Shared/Utils/ChannelConstants.js';

function createField({ label, placeholder, type = 'text', multiline = false }) {
  const wrap = createElement('label', 'channels-field');
  const labelEl = createElement('span', 'channels-field__label', label);
  const input = multiline ? document.createElement('textarea') : document.createElement('input');

  input.className = multiline ? 'channels-field__textarea' : 'channels-field__input';
  input.placeholder = placeholder ?? '';
  if (!multiline) input.type = type;
  if (multiline) input.rows = 3;
  input.autocomplete = 'off';
  input.spellcheck = false;

  wrap.append(labelEl, input);
  return { wrap, input };
}

function createChannelSecretField({ label, placeholder, strings }) {
  return createSecretField({ label, placeholder, strings, className: 'channels' });
}

export function createChannelsPanel(strings) {
  let panel = null;
  let cardsWrap = null;
  const cardRefs = new Map();

  function setFeedback(channelName, message, tone = 'info') {
    const refs = cardRefs.get(channelName);
    if (!refs?.feedback) return;
    setCardFeedback(refs.feedback, message, tone, 'channels-card__feedback');
  }

  function setCardState(channelName, config) {
    const refs = cardRefs.get(channelName);
    if (!refs) return;

    const configured = Boolean(config?.configured);
    const enabled = Boolean(config?.enabled);
    refs.card.classList.toggle('channels-card--connected', configured);
    refs.card.classList.toggle('channels-card--paused', configured && !enabled);
    refs.status.textContent = configured
      ? enabled
        ? strings.common.active
        : strings.common.paused
      : strings.common.notConnected;
    refs.status.className = `channels-card__status ${configured && enabled ? 'channels-card__status--active' : ''}`;
    refs.toggle.checked = enabled;
    refs.toggle.disabled = !configured;
    refs.disconnect.hidden = !configured;
    refs.steps.hidden = configured;

    if (refs.secretFields.botToken && config?.botTokenSet) {
      refs.secretFields.botToken.placeholder = strings.common.savedSecret;
    } else if (refs.secretFields.botToken) {
      refs.secretFields.botToken.placeholder = refs.placeholders.botToken;
    }

    if (refs.secretFields.authToken && config?.authTokenSet) {
      refs.secretFields.authToken.placeholder = strings.common.savedSecret;
    } else if (refs.secretFields.authToken) {
      refs.secretFields.authToken.placeholder = refs.placeholders.authToken;
    }

    if (refs.secretFields.accountSid && config?.accountSidSet) {
      refs.secretFields.accountSid.placeholder = strings.common.savedSecret;
    } else if (refs.secretFields.accountSid) {
      refs.secretFields.accountSid.placeholder = refs.placeholders.accountSid;
    }

    if (refs.secretFields.apiKey && config?.apiKeySet) {
      refs.secretFields.apiKey.placeholder = strings.common.savedSecret;
    } else if (refs.secretFields.apiKey) {
      refs.secretFields.apiKey.placeholder = refs.placeholders.apiKey;
    }

    if (refs.secretFields.accessToken && config?.accessTokenSet) {
      refs.secretFields.accessToken.placeholder = strings.common.savedSecret;
    } else if (refs.secretFields.accessToken) {
      refs.secretFields.accessToken.placeholder = refs.placeholders.accessToken;
    }

    if (refs.inputs.siteUrl && config?.siteUrl) {
      refs.inputs.siteUrl.value = config.siteUrl;
    }

    if (refs.inputs.email && config?.email) {
      refs.inputs.email.value = config.email;
    }

    if (refs.inputs.stream && config?.stream) {
      refs.inputs.stream.value = config.stream;
    }

    if (refs.inputs.topic) {
      refs.inputs.topic.value = config?.topic ?? '';
    }

    if (refs.inputs.channelId && config?.channelId) {
      refs.inputs.channelId.value = config.channelId;
    }

    if (refs.inputs.fromNumber && config?.fromNumber) {
      refs.inputs.fromNumber.value = config.fromNumber;
    }
  }

  function getPayload(channelName) {
    const refs = cardRefs.get(channelName);
    const payload = {};

    if (channelName === 'telegram') {
      const botToken = refs.inputs.botToken.value.trim();
      if (botToken) payload.botToken = botToken;
    }

    if (channelName === 'whatsapp') {
      const accountSid = refs.inputs.accountSid.value.trim();
      const authToken = refs.inputs.authToken.value.trim();
      const fromNumber = refs.inputs.fromNumber.value.trim();
      if (accountSid) payload.accountSid = accountSid;
      if (authToken) payload.authToken = authToken;
      payload.fromNumber = fromNumber;
    }

    if (channelName === 'discord' || channelName === 'slack') {
      const botToken = refs.inputs.botToken.value.trim();
      const channelId = refs.inputs.channelId.value.trim();
      if (botToken) payload.botToken = botToken;
      payload.channelId = channelId;
    }

    if (channelName === 'zulip') {
      const siteUrl = refs.inputs.siteUrl.value.trim();
      const email = refs.inputs.email.value.trim();
      const apiKey = refs.inputs.apiKey.value.trim();
      const stream = refs.inputs.stream.value.trim();
      const topic = refs.inputs.topic.value.trim();
      payload.siteUrl = siteUrl;
      payload.email = email;
      if (apiKey) payload.apiKey = apiKey;
      payload.stream = stream;
      payload.topic = topic;
    }

    if (channelName === 'mattermost') {
      const siteUrl = refs.inputs.siteUrl.value.trim();
      const accessToken = refs.inputs.accessToken.value.trim();
      const channelId = refs.inputs.channelId.value.trim();
      payload.siteUrl = siteUrl;
      if (accessToken) payload.accessToken = accessToken;
      payload.channelId = channelId;
    }

    if (channelName === 'ntfy') {
      const siteUrl = refs.inputs.siteUrl.value.trim();
      const topic = refs.inputs.topic.value.trim();
      payload.siteUrl = siteUrl;
      payload.topic = topic;
    }

    return payload;
  }

  function hasSavedSecret(input) {
    return input.placeholder === strings.common.savedSecret;
  }

  function validateRequired(channelName) {
    const refs = cardRefs.get(channelName);

    if (channelName === 'telegram') {
      const val = refs.inputs.botToken.value.trim();
      if (!val && !hasSavedSecret(refs.inputs.botToken)) {
        refs.inputs.botToken.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (val && val.length < 10) {
        refs.inputs.botToken.focus();
        setFeedback(channelName, strings.common.tokenTooShort, 'error');
        return false;
      }
    }

    if (channelName === 'whatsapp') {
      const sidVal = refs.inputs.accountSid.value.trim();
      if (!sidVal && !hasSavedSecret(refs.inputs.accountSid)) {
        refs.inputs.accountSid.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (sidVal && sidVal.length < 10) {
        refs.inputs.accountSid.focus();
        setFeedback(channelName, strings.common.sidTooShort, 'error');
        return false;
      }
      const authVal = refs.inputs.authToken.value.trim();
      if (!authVal && !hasSavedSecret(refs.inputs.authToken)) {
        refs.inputs.authToken.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (authVal && authVal.length < 10) {
        refs.inputs.authToken.focus();
        setFeedback(channelName, strings.common.authTokenTooShort, 'error');
        return false;
      }
      const numVal = refs.inputs.fromNumber.value.trim();
      if (!numVal) {
        refs.inputs.fromNumber.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (numVal.replace(/[^0-9]/g, '').length < 7) {
        refs.inputs.fromNumber.focus();
        setFeedback(channelName, strings.common.numberTooShort, 'error');
        return false;
      }
    }

    if (channelName === 'discord' || channelName === 'slack') {
      const tokenVal = refs.inputs.botToken.value.trim();
      if (!tokenVal && !hasSavedSecret(refs.inputs.botToken)) {
        refs.inputs.botToken.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (tokenVal && tokenVal.length < 10) {
        refs.inputs.botToken.focus();
        setFeedback(channelName, strings.common.tokenTooShort, 'error');
        return false;
      }
      const channelIdVal = refs.inputs.channelId.value.trim();
      if (!channelIdVal) {
        refs.inputs.channelId.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (channelIdVal.length < 5) {
        refs.inputs.channelId.focus();
        setFeedback(channelName, strings.common.channelIdTooShort, 'error');
        return false;
      }
    }

    if (channelName === 'zulip') {
      const siteUrl = refs.inputs.siteUrl.value.trim();
      if (!siteUrl) {
        refs.inputs.siteUrl.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      const email = refs.inputs.email.value.trim();
      if (!email) {
        refs.inputs.email.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      const apiKey = refs.inputs.apiKey.value.trim();
      if (!apiKey && !hasSavedSecret(refs.inputs.apiKey)) {
        refs.inputs.apiKey.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (apiKey && apiKey.length < 10) {
        refs.inputs.apiKey.focus();
        setFeedback(channelName, strings.common.apiKeyTooShort, 'error');
        return false;
      }
      const stream = refs.inputs.stream.value.trim();
      if (!stream) {
        refs.inputs.stream.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
    }

    if (channelName === 'mattermost') {
      const siteUrl = refs.inputs.siteUrl.value.trim();
      if (!siteUrl) {
        refs.inputs.siteUrl.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      const accessToken = refs.inputs.accessToken.value.trim();
      if (!accessToken && !hasSavedSecret(refs.inputs.accessToken)) {
        refs.inputs.accessToken.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (accessToken && accessToken.length < 10) {
        refs.inputs.accessToken.focus();
        setFeedback(channelName, strings.common.tokenTooShort, 'error');
        return false;
      }
      const channelIdVal = refs.inputs.channelId.value.trim();
      if (!channelIdVal) {
        refs.inputs.channelId.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (channelIdVal.length < 5) {
        refs.inputs.channelId.focus();
        setFeedback(channelName, strings.common.channelIdTooShort, 'error');
        return false;
      }
    }

    if (channelName === 'ntfy') {
      const siteUrl = refs.inputs.siteUrl.value.trim();
      if (!siteUrl) {
        refs.inputs.siteUrl.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      const topic = refs.inputs.topic.value.trim();
      if (!topic) {
        refs.inputs.topic.focus();
        setFeedback(channelName, strings.common.required, 'error');
        return false;
      }
      if (topic.length < 3) {
        refs.inputs.topic.focus();
        setFeedback(channelName, strings.common.channelIdTooShort, 'error');
        return false;
      }
    }

    return true;
  }

  async function validateChannel(channelName, payload) {
    if (channelName === 'telegram' && payload.botToken) {
      const result = await invokeIpc('channels:validate', channelName, {
        botToken: payload.botToken,
      });
      setFeedback(
        channelName,
        formatText(strings.feedback.tokenVerified, {
          value: result.username ? `@${result.username}` : strings.channels.telegram.name,
        }),
        'success',
      );
    }

    if (channelName === 'whatsapp' && payload.accountSid && payload.authToken) {
      const result = await invokeIpc('channels:validate', channelName, {
        accountSid: payload.accountSid,
        authToken: payload.authToken,
      });
      setFeedback(
        channelName,
        formatText(strings.feedback.accountVerified, {
          value: result.friendlyName ?? strings.channels.whatsapp.name,
        }),
        'success',
      );
    }

    if (channelName === 'discord' && payload.botToken) {
      const result = await invokeIpc('channels:validate', channelName, {
        botToken: payload.botToken,
        channelId: payload.channelId,
      });
      setFeedback(
        channelName,
        formatText(strings.feedback.tokenVerified, {
          value:
            result.channelName ||
            (result.username ? `@${result.username}` : strings.channels.discord.name),
        }),
        'success',
      );
    }

    if (channelName === 'slack' && payload.botToken) {
      const result = await invokeIpc('channels:validate', channelName, {
        botToken: payload.botToken,
        channelId: payload.channelId,
      });
      setFeedback(
        channelName,
        formatText(strings.feedback.slackVerified, {
          value: result.channelName || result.team || result.name || strings.channels.slack.name,
        }),
        'success',
      );
    }

    if (channelName === 'zulip' && (payload.apiKey || payload.siteUrl || payload.stream)) {
      const result = await invokeIpc('channels:validate', channelName, {
        siteUrl: payload.siteUrl,
        email: payload.email,
        apiKey: payload.apiKey,
        stream: payload.stream,
      });
      setFeedback(
        channelName,
        formatText(strings.feedback.zulipVerified, {
          value: result.streamName || result.fullName || strings.channels.zulip.name,
        }),
        'success',
      );
      return result;
    }

    if (channelName === 'mattermost' && (payload.accessToken || payload.siteUrl)) {
      const result = await invokeIpc('channels:validate', channelName, {
        siteUrl: payload.siteUrl,
        accessToken: payload.accessToken,
        channelId: payload.channelId,
      });
      setFeedback(
        channelName,
        formatText(strings.feedback.mattermostVerified, {
          value: result.channelName || result.username || strings.channels.mattermost.name,
        }),
        'success',
      );
      return result;
    }

    if (channelName === 'ntfy' && payload.siteUrl && payload.topic) {
      const result = await invokeIpc('channels:validate', channelName, {
        siteUrl: payload.siteUrl,
        topic: payload.topic,
      });
      setFeedback(
        channelName,
        formatText(strings.feedback.ntfyVerified, {
          value: result.topic || strings.channels.ntfy.name,
        }),
        'success',
      );
      return result;
    }

    return null;
  }

  async function connectChannel(channelName) {
    const refs = cardRefs.get(channelName);
    if (!validateRequired(channelName)) {
      return;
    }

    refs.connect.disabled = true;
    refs.connectLabel.textContent = strings.common.connecting;
    setFeedback(channelName, '', 'info');

    try {
      const payload = getPayload(channelName);
      const validation = await validateChannel(channelName, payload);
      if (validation?.userId) payload.userId = validation.userId;
      const saved = await invokeIpc('channels:save', channelName, payload);
      setCardState(channelName, saved);
      if (refs.inputs.botToken) refs.inputs.botToken.value = '';
      if (refs.inputs.authToken) refs.inputs.authToken.value = '';
      if (refs.inputs.accountSid) refs.inputs.accountSid.value = '';
      if (refs.inputs.apiKey) refs.inputs.apiKey.value = '';
      if (refs.inputs.accessToken) refs.inputs.accessToken.value = '';
      setFeedback(channelName, strings.feedback[`${channelName}Connected`], 'success');
      await populate();
    } catch (error) {
      setFeedback(channelName, error?.message ?? strings.common.saveFailed, 'error');
    } finally {
      refs.connect.disabled = false;
      refs.connectLabel.textContent = strings.common.connect;
    }
  }

  async function disconnectChannel(channelName) {
    try {
      await invokeIpc('channels:remove', channelName);
      const config = await invokeIpc('channels:get', channelName);
      const refs = cardRefs.get(channelName);
      for (const input of Object.values(refs.inputs)) {
        input.value = '';
      }
      setCardState(channelName, config);
      setFeedback(channelName, strings.feedback.disconnected, 'info');
      await populate();
    } catch (error) {
      setFeedback(channelName, error?.message ?? strings.common.disconnectFailed, 'error');
    }
  }

  async function toggleChannel(channelName, enabled) {
    const refs = cardRefs.get(channelName);
    try {
      const config = await invokeIpc('channels:toggle', channelName, enabled);
      setCardState(channelName, config);
      setFeedback(
        channelName,
        enabled ? strings.feedback.enabled : strings.feedback.paused,
        'success',
      );
      await populate();
    } catch (error) {
      refs.toggle.checked = !enabled;
      setFeedback(channelName, error?.message ?? strings.common.toggleFailed, 'error');
    }
  }

  function createSetupSteps(channelName) {
    const steps = createElement('div', 'channels-card__steps');
    steps.append(
      createElement('div', 'channels-card__steps-title', strings.channels[channelName].setupTitle),
    );

    const list = createElement('ol', 'channels-card__steps-list');
    for (const step of strings.channels[channelName].steps) {
      list.append(createElement('li', 'channels-card__step', step));
    }
    steps.append(list);
    return steps;
  }

  function createChannelCard(channelName) {
    const channelStrings = strings.channels[channelName];
    const card = createElement('article', 'channels-card');

    // ── Header (always visible) ──────────────────────────────────────────────
    const header = createElement('div', 'channels-card__header');
    const badge = createElement('div', 'channels-card__badge');
    const iconPath = getConnectorIconPath(channelName);
    const badgeIcon = createProviderIcon(iconPath, {
      className: 'channels-card__badge-img',
    });
    if (badgeIcon) {
      badge.append(badgeIcon);
    } else {
      badge.append(createIcon('globe', 'channels-card__badge-icon'));
    }
    const titleWrap = createElement('div', 'channels-card__title-wrap');
    const titleRow = createElement('div', 'channels-card__title-row');
    const status = createElement('span', 'channels-card__status', strings.common.notConnected);

    titleRow.append(createElement('h3', 'channels-card__title', channelStrings.name), status);
    titleWrap.append(titleRow);

    const toggleWrap = createElement('label', 'channels-toggle');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'channels-toggle__input';
    toggle.disabled = true;
    toggle.addEventListener('change', () => {
      void toggleChannel(channelName, toggle.checked);
    });
    toggleWrap.append(toggle, createElement('span', 'channels-toggle__track'));

    const expandBtn = createElement('button', 'channels-card__expand');
    expandBtn.type = 'button';
    expandBtn.setAttribute('aria-label', strings.common.expand);
    expandBtn.append(createIcon('chevronDownSmall', 'channels-card__expand-icon'));

    header.append(badge, titleWrap, toggleWrap, expandBtn);

    // ── Collapsible body ─────────────────────────────────────────────────────
    const body = createElement('div', 'channels-card__body');
    const bodyInner = createElement('div', 'channels-card__body-inner');

    const steps = createSetupSteps(channelName);
    const form = createElement('div', 'channels-card__form');
    const inputs = {};
    const secretFields = {};
    const placeholders = {};

    if (channelName === 'telegram') {
      const botToken = createChannelSecretField({
        label: strings.fields.botToken,
        placeholder: strings.placeholders.telegramToken,
        strings,
      });
      inputs.botToken = botToken.input;
      secretFields.botToken = botToken.input;
      placeholders.botToken = strings.placeholders.telegramToken;
      form.append(botToken.wrap);
    }

    if (channelName === 'whatsapp') {
      const row = createElement('div', 'channels-card__field-row');
      const accountSid = createChannelSecretField({
        label: strings.fields.accountSid,
        placeholder: strings.placeholders.whatsappSid,
        strings,
      });
      const authToken = createChannelSecretField({
        label: strings.fields.authToken,
        placeholder: strings.placeholders.whatsappToken,
        strings,
      });
      const fromNumber = createField({
        label: strings.fields.sandboxNumber,
        placeholder: strings.placeholders.whatsappNumber,
      });
      inputs.accountSid = accountSid.input;
      inputs.authToken = authToken.input;
      inputs.fromNumber = fromNumber.input;
      secretFields.accountSid = accountSid.input;
      secretFields.authToken = authToken.input;
      placeholders.accountSid = strings.placeholders.whatsappSid;
      placeholders.authToken = strings.placeholders.whatsappToken;
      row.append(accountSid.wrap, authToken.wrap);
      form.append(row, fromNumber.wrap);
      if (channelStrings.hint) {
        form.append(createElement('p', 'channels-card__hint', channelStrings.hint));
      }
    }

    if (channelName === 'discord' || channelName === 'slack') {
      const row = createElement('div', 'channels-card__field-row');
      const botToken = createChannelSecretField({
        label: strings.fields.botToken,
        placeholder:
          channelName === 'discord'
            ? strings.placeholders.discordToken
            : strings.placeholders.slackToken,
        strings,
      });
      const channelId = createField({
        label: strings.fields.channelId,
        placeholder:
          channelName === 'discord'
            ? strings.placeholders.discordChannel
            : strings.placeholders.slackChannel,
      });
      inputs.botToken = botToken.input;
      inputs.channelId = channelId.input;
      secretFields.botToken = botToken.input;
      placeholders.botToken =
        channelName === 'discord'
          ? strings.placeholders.discordToken
          : strings.placeholders.slackToken;
      row.append(botToken.wrap, channelId.wrap);
      form.append(row);
    }

    if (channelName === 'zulip') {
      const rowOne = createElement('div', 'channels-card__field-row');
      const rowTwo = createElement('div', 'channels-card__field-row');
      const siteUrl = createField({
        label: strings.fields.siteUrl,
        placeholder: strings.placeholders.zulipSite,
      });
      const email = createField({
        label: strings.fields.email,
        placeholder: strings.placeholders.zulipEmail,
      });
      const apiKey = createChannelSecretField({
        label: strings.fields.apiKey,
        placeholder: strings.placeholders.zulipApiKey,
        strings,
      });
      const stream = createField({
        label: strings.fields.zulipStream,
        placeholder: strings.placeholders.zulipStream,
      });
      const topic = createField({
        label: strings.fields.zulipTopic,
        placeholder: strings.placeholders.zulipTopic,
      });
      inputs.siteUrl = siteUrl.input;
      inputs.email = email.input;
      inputs.apiKey = apiKey.input;
      inputs.stream = stream.input;
      inputs.topic = topic.input;
      secretFields.apiKey = apiKey.input;
      placeholders.apiKey = strings.placeholders.zulipApiKey;
      rowOne.append(siteUrl.wrap, email.wrap);
      rowTwo.append(apiKey.wrap, stream.wrap);
      form.append(rowOne, rowTwo, topic.wrap);
      if (channelStrings.hint) {
        form.append(createElement('p', 'channels-card__hint', channelStrings.hint));
      }
    }

    if (channelName === 'mattermost') {
      const row = createElement('div', 'channels-card__field-row');
      const siteUrl = createField({
        label: strings.fields.siteUrl,
        placeholder: strings.placeholders.mattermostSite,
      });
      const channelId = createField({
        label: strings.fields.channelId,
        placeholder: strings.placeholders.mattermostChannel,
      });
      const accessToken = createChannelSecretField({
        label: strings.fields.accessToken,
        placeholder: strings.placeholders.mattermostToken,
        strings,
      });
      inputs.siteUrl = siteUrl.input;
      inputs.channelId = channelId.input;
      inputs.accessToken = accessToken.input;
      secretFields.accessToken = accessToken.input;
      placeholders.accessToken = strings.placeholders.mattermostToken;
      row.append(siteUrl.wrap, channelId.wrap);
      form.append(row, accessToken.wrap);
      if (channelStrings.hint) {
        form.append(createElement('p', 'channels-card__hint', channelStrings.hint));
      }
    }

    if (channelName === 'ntfy') {
      const row = createElement('div', 'channels-card__field-row');
      const siteUrl = createField({
        label: strings.fields.siteUrl,
        placeholder: strings.placeholders.ntfySite,
      });
      const topic = createField({
        label: strings.fields.ntfyTopic,
        placeholder: strings.placeholders.ntfyTopic,
      });
      inputs.siteUrl = siteUrl.input;
      inputs.topic = topic.input;
      row.append(siteUrl.wrap, topic.wrap);
      form.append(row);
      if (channelStrings.hint) {
        form.append(createElement('p', 'channels-card__hint', channelStrings.hint));
      }
    }

    const actions = createElement('div', 'channels-card__actions');
    const disconnect = createElement(
      'button',
      'channels-card__secondary',
      strings.common.disconnect,
    );
    const connect = createElement('button', 'channels-card__primary');
    const connectLabel = createElement(
      'span',
      'channels-card__primary-label',
      strings.common.connect,
    );
    disconnect.type = 'button';
    connect.type = 'button';
    disconnect.hidden = true;
    disconnect.addEventListener('click', () => {
      void disconnectChannel(channelName);
    });
    connect.addEventListener('click', () => {
      void connectChannel(channelName);
    });
    connect.append(connectLabel);
    actions.append(disconnect, connect);

    const feedback = createElement('div', 'channels-card__feedback');
    feedback.hidden = true;
    feedback.setAttribute('aria-live', 'polite');

    const summary = createElement('p', 'channels-card__summary', channelStrings.summary);
    bodyInner.append(summary, steps, form, actions, feedback);
    body.append(bodyInner);
    card.append(header, body);

    expandBtn.addEventListener('click', () => {
      const isOpen = card.classList.contains('channels-card--open');
      // Close all cards
      for (const [, r] of cardRefs) {
        r.card.classList.remove('channels-card--open');
        r.card
          .querySelector('.channels-card__expand')
          ?.setAttribute('aria-label', strings.common.expand);
      }
      // Open this one only if it was closed
      if (!isOpen) {
        card.classList.add('channels-card--open');
        expandBtn.setAttribute('aria-label', strings.common.collapse);
      }
    });

    cardRefs.set(channelName, {
      card,
      status,
      toggle,
      steps,
      inputs,
      secretFields,
      placeholders,
      connect,
      connectLabel,
      disconnect,
      feedback,
    });
    return card;
  }

  async function populate() {
    const channels = await invokeIpc('channels:list');
    for (const channelName of CHANNEL_NAMES) {
      setCardState(channelName, channels[channelName] ?? {});
    }
  }

  function build() {
    panel = createElement('div', 'channels');
    panel.hidden = true;

    const body = createElement('div', 'channels__body');
    cardsWrap = createTwoColGrid();
    for (const channelName of CHANNEL_NAMES) {
      cardsWrap.append(createChannelCard(channelName));
    }
    body.append(cardsWrap.el);

    panel.append(body);
    panel._populate = populate;
    return panel;
  }

  return { build, populate };
}
