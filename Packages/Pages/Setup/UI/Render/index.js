import { PROVIDERS, PROVIDERS_BY_ID } from './Providers/SetupProviders.js';
import { initStepController } from './Steps/SetupSteps.js';

// On Windows the native caption overlay defaults to dark colours.
// The setup page is always light — make the overlay invisible by matching
// the page background so no buttons appear.
window.electronAPI?.send('window-set-titlebar-overlay', {
  color: '#f5f4f1',
  symbolColor: '#f5f4f1',
  height: 36,
});
const state = { step: 0, name: '', selectedProviders: new Set(), providerConfigs: {} },
  stepSplash = document.getElementById('step-splash'),
  stepName = document.getElementById('step-name'),
  stepProviders = document.getElementById('step-providers'),
  stepDone = document.getElementById('step-done'),
  tcCheck = document.getElementById('tc-check'),
  splashContinue = document.getElementById('splash-continue'),
  nameInput = document.getElementById('name-input'),
  nameContinue = document.getElementById('name-continue'),
  providerGrid = document.getElementById('provider-grid'),
  keysSection = document.getElementById('keys-section'),
  keysContinue = document.getElementById('keys-continue'),
  progressTrack = document.getElementById('progress-track'),
  setupLogo = document.getElementById('setup-logo'),
  progressDots = document.querySelectorAll('.dot'),
  doneTitle = document.getElementById('done-title'),
  STEP_ELS = [stepSplash, stepName, stepProviders, stepDone],
  { goToStep: baseGoToStep } = initStepController({
    state: state,
    STEP_ELS: STEP_ELS,
    setupLogo: setupLogo,
    progressTrack: progressTrack,
    progressDots: progressDots,
    nameInput: nameInput,
    doneTitle: doneTitle,
  });
function goToStep(nextStep) {
  (baseGoToStep(nextStep),
    2 === nextStep &&
      (function () {
        providerGrid.innerHTML = '';
        const row = document.createElement('div');
        ((row.className = 'provider-row'),
          PROVIDERS.forEach((provider) => {
            const card = document.createElement('button'),
              isSelected = state.selectedProviders.has(provider.id);
            ((card.type = 'button'),
              (card.className = 'provider-card'),
              (card.dataset.id = provider.id),
              (card.dataset.provider = provider.id),
              (card.dataset.iconFrame = provider.iconFrame || 'none'),
              (card.title = `${provider.label}${provider.company ? ` by ${provider.company}` : ''}`),
              card.setAttribute('aria-label', card.title),
              card.setAttribute('aria-pressed', String(isSelected)),
              card.style.setProperty('--p-color', provider.color),
              provider.iconSize && card.style.setProperty('--p-icon-size', provider.iconSize),
              (card.innerHTML = `\n      <span class="p-check" aria-hidden="true">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n          <path d="M5 12l5 5L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/>\n        </svg>\n      </span>\n      <span class="p-card-stack">\n        <span class="p-icon" aria-hidden="true">\n          <img class="p-icon-image" src="${provider.iconPath || 'data:,'}" alt="" />\n          <span class="p-icon-fallback">${provider.fallback}</span>\n        </span>\n        <span class="p-name">${provider.label}</span>\n        <span class="p-caption">${provider.caption}</span>\n      </span>\n    `),
              isSelected && card.classList.add('selected'),
              (function (card, provider) {
                const image = card.querySelector('.p-icon-image');
                image && provider.iconPath
                  ? (image.addEventListener('error', () => card.classList.add('icon-missing')),
                    image.addEventListener('load', () => card.classList.remove('icon-missing')),
                    image.complete &&
                      0 === image.naturalWidth &&
                      card.classList.add('icon-missing'))
                  : card.classList.add('icon-missing');
              })(card, provider),
              card.addEventListener('click', () => {
                providerGrid._wasDragging ||
                  (function (providerId) {
                    state.selectedProviders.has(providerId)
                      ? state.selectedProviders.delete(providerId)
                      : (state.selectedProviders.add(providerId), ensureProviderConfig(providerId));
                    const selected = state.selectedProviders.has(providerId);
                    (providerGrid.querySelectorAll(`[data-id="${providerId}"]`).forEach((card) => {
                      (card.classList.toggle('selected', selected),
                        card.setAttribute('aria-pressed', String(selected)));
                    }),
                      (function () {
                        if (((keysSection.innerHTML = ''), 0 === state.selectedProviders.size))
                          return;
                        const heading = document.createElement('div');
                        ((heading.className = 'keys-copy'),
                          (heading.innerHTML =
                            '\n    <p class="keys-heading">Connect your selected providers</p>\n    <p class="keys-subheading">Cloud providers use an API key. Ollama and LM Studio use a local server URL, and you can optionally choose a preferred local model.</p>\n  '),
                          keysSection.appendChild(heading),
                          PROVIDERS.filter((p) => state.selectedProviders.has(p.id)).forEach(
                            (provider) => {
                              const card = document.createElement('div');
                              ((card.className = 'provider-config-card'),
                                card.style.setProperty('--p-color', provider.color));
                              const header = document.createElement('div');
                              ((header.className = 'provider-config-header'),
                                (header.innerHTML = `\n        <div class="provider-config-title">\n          <span class="key-dot"></span>\n          <span>${provider.label}</span>\n        </div>\n        <span class="provider-config-badge">${provider.caption}</span>\n      `));
                              const fields = document.createElement('div');
                              if (
                                ((fields.className =
                                  'provider-config-fields provider-config-fields--' +
                                  (provider.fields.length > 1 ? 'multi' : 'single')),
                                provider.fields.forEach((field) =>
                                  fields.appendChild(
                                    (function (providerId, field) {
                                      const wrapper = document.createElement('label');
                                      if (((wrapper.className = 'config-field'), field.label)) {
                                        const label = document.createElement('span');
                                        ((label.className = 'config-field-label'),
                                          (label.textContent = field.label),
                                          wrapper.appendChild(label));
                                      }
                                      const inputWrap = document.createElement('div');
                                      inputWrap.className = 'key-input-wrap';
                                      const input = document.createElement('input');
                                      if (
                                        ((input.className = 'key-input'),
                                        (input.id = `provider-${providerId}-${field.key}`),
                                        (input.type =
                                          'password' === field.type ? 'password' : 'text'),
                                        (input.placeholder = field.placeholder),
                                        (input.autocomplete = 'off'),
                                        (input.spellcheck = !1),
                                        (input.value = getProviderValue(providerId, field.key)),
                                        input.addEventListener('input', () => {
                                          ((ensureProviderConfig(providerId)[field.key] =
                                            input.value),
                                            updateKeysContinue());
                                        }),
                                        inputWrap.appendChild(input),
                                        'password' === field.type)
                                      ) {
                                        const eye = document.createElement('button');
                                        ((eye.type = 'button'),
                                          (eye.className = 'key-eye'),
                                          (eye.title = 'Show or hide'),
                                          (eye.innerHTML =
                                            '\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>\n        <circle cx="12" cy="12" r="3" stroke-width="1.8"/>\n      </svg>\n    '),
                                          eye.addEventListener('click', () => {
                                            input.type =
                                              'password' === input.type ? 'text' : 'password';
                                          }),
                                          inputWrap.appendChild(eye));
                                      }
                                      return (wrapper.appendChild(inputWrap), wrapper);
                                    })(provider.id, field),
                                  ),
                                ),
                                card.append(header, fields),
                                provider.hint)
                              ) {
                                const hint = document.createElement('p');
                                ((hint.className = 'provider-config-hint'),
                                  (hint.textContent = provider.hint),
                                  card.appendChild(hint));
                              }
                              keysSection.appendChild(card);
                            },
                          ));
                      })(),
                      updateKeysContinue());
                  })(provider.id);
              }),
              row.appendChild(card));
          }),
          providerGrid.appendChild(row),
          (function (el) {
            let isDown = !1,
              startX = 0,
              scrollLeft = 0;
            ((el._wasDragging = !1),
              el.addEventListener('mousedown', (e) => {
                ((isDown = !0),
                  (startX = e.pageX - el.offsetLeft),
                  (scrollLeft = el.scrollLeft),
                  (el._wasDragging = !1));
              }),
              el.addEventListener('mouseleave', () => {
                isDown = !1;
              }),
              el.addEventListener('mouseup', () => {
                isDown = !1;
              }),
              el.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const walk = 1.2 * (e.pageX - el.offsetLeft - startX);
                (Math.abs(walk) > 4 && (el._wasDragging = !0), (el.scrollLeft = scrollLeft - walk));
              }));
          })(providerGrid));
      })());
}
function ensureProviderConfig(providerId) {
  const provider = PROVIDERS_BY_ID[providerId],
    config = { ...(state.providerConfigs[providerId] ?? {}) };
  return (
    provider?.fields?.forEach((field) => {
      null == field.defaultValue ||
        (null != config[field.key] && '' !== config[field.key]) ||
        (config[field.key] = field.defaultValue);
    }),
    (state.providerConfigs[providerId] = config),
    config
  );
}
function getProviderValue(providerId, fieldKey) {
  return String(ensureProviderConfig(providerId)[fieldKey] ?? '');
}
function providerIsComplete(providerId) {
  const provider = PROVIDERS_BY_ID[providerId];
  return (
    !!provider &&
    provider.fields.every(
      (field) =>
        !field.required ||
        getProviderValue(providerId, field.key).trim().length >= (field.minLength ?? 1),
    )
  );
}
function serializeProviderConfig(providerId) {
  const provider = PROVIDERS_BY_ID[providerId],
    config = ensureProviderConfig(providerId),
    payload = {};
  return (
    provider?.fields?.forEach((field) => {
      payload[field.key] = String(config[field.key] ?? '').trim();
    }),
    payload
  );
}
function tryAdvanceFromName() {
  const value = nameInput.value.trim();
  value.length < 2 || ((state.name = value), goToStep(2));
}
function updateKeysContinue() {
  if (0 === state.selectedProviders.size) return void keysContinue.classList.remove('ready');
  const allReady = [...state.selectedProviders].every(providerIsComplete);
  keysContinue.classList.toggle('ready', allReady);
}
(!(function () {
  const canvas = document.getElementById('splash-canvas');
  if (canvas)
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + 4 * Math.random();
      ((p.style.cssText = `\n      width:${size}px; height:${size}px;\n      left:${100 * Math.random()}%;\n      bottom:${40 * Math.random()}%;\n      --dur:${4 + 6 * Math.random()}s;\n      --delay:-${5 * Math.random()}s;\n    `),
        canvas.appendChild(p));
    }
})(),
  tcCheck.addEventListener('change', () => {
    const checked = tcCheck.checked;
    ((splashContinue.disabled = !checked), splashContinue.classList.toggle('ready', checked));
  }),
  splashContinue.addEventListener('click', () => {
    tcCheck.checked && goToStep(1);
  }),
  nameInput.addEventListener('input', () => {
    nameContinue.classList.toggle('ready', nameInput.value.trim().length >= 2);
  }),
  nameInput.addEventListener('keydown', (e) => {
    'Enter' === e.key && tryAdvanceFromName();
  }),
  nameContinue.addEventListener('click', tryAdvanceFromName),
  keysContinue.addEventListener('click', async () => {
    keysContinue.classList.contains('ready') &&
      (await (async function () {
        try {
          (await window.electronAPI.invoke('save-user', {
            name: state.name,
            setup_complete: !0,
            created_at: new Date().toISOString(),
            preferences: {
              theme: 'light',
              default_provider: [...state.selectedProviders][0] || null,
              default_model: null,
            },
          }),
            await window.electronAPI.invoke(
              'save-provider-configs',
              Object.fromEntries(
                [...state.selectedProviders].map((id) => [id, serializeProviderConfig(id)]),
              ),
            ),
            await window.electronAPI.invoke('collect-static-system-info'));
        } catch (error) {
          console.error('[setup] Save error:', error);
        }
      })(),
      goToStep(3));
  }),
  progressDots.forEach((dot, i) => dot.classList.toggle('active', 0 === i)));
