import { PROVIDERS, PROVIDERS_BY_ID } from './Providers/SetupProviders.js';
import { initStepController } from './Steps/SetupSteps.js';

const state = {
  step: 0,
  name: '',
  selectedProviders: new Set(),
  providerConfigs: {},
};

const stepSplash = document.getElementById('step-splash');
const stepName = document.getElementById('step-name');
const stepProviders = document.getElementById('step-providers');
const stepDone = document.getElementById('step-done');

const tcCheck = document.getElementById('tc-check');
const splashContinue = document.getElementById('splash-continue');

const nameInput = document.getElementById('name-input');
const nameContinue = document.getElementById('name-continue');

const providerGrid = document.getElementById('provider-grid');
const keysSection = document.getElementById('keys-section');
const keysContinue = document.getElementById('keys-continue');

const progressTrack = document.getElementById('progress-track');
const setupLogo = document.getElementById('setup-logo');
const progressDots = document.querySelectorAll('.dot');
const doneTitle = document.getElementById('done-title');

const STEP_ELS = [stepSplash, stepName, stepProviders, stepDone];

const { goToStep: baseGoToStep } = initStepController({
  state, STEP_ELS, setupLogo, progressTrack, progressDots, nameInput, doneTitle,
});

function goToStep(nextStep) {
  baseGoToStep(nextStep);
  if (nextStep === 2) buildProviderGrid();
}

// ── Config helpers ────────────────────────────────────────────────────────────

function ensureProviderConfig(providerId) {
  const provider = PROVIDERS_BY_ID[providerId];
  const config = { ...(state.providerConfigs[providerId] ?? {}) };

  provider?.fields?.forEach((field) => {
    if (field.defaultValue != null && (config[field.key] == null || config[field.key] === '')) {
      config[field.key] = field.defaultValue;
    }
  });

  state.providerConfigs[providerId] = config;
  return config;
}

function getProviderValue(providerId, fieldKey) {
  return String(ensureProviderConfig(providerId)[fieldKey] ?? '');
}

function providerIsComplete(providerId) {
  const provider = PROVIDERS_BY_ID[providerId];
  if (!provider) return false;
  return provider.fields.every((field) => {
    if (!field.required) return true;
    return getProviderValue(providerId, field.key).trim().length >= (field.minLength ?? 1);
  });
}

function serializeProviderConfig(providerId) {
  const provider = PROVIDERS_BY_ID[providerId];
  const config = ensureProviderConfig(providerId);
  const payload = {};
  provider?.fields?.forEach((field) => {
    payload[field.key] = String(config[field.key] ?? '').trim();
  });
  return payload;
}

// ── Splash particles ──────────────────────────────────────────────────────────

(function spawnParticles() {
  const canvas = document.getElementById('splash-canvas');
  if (!canvas) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 2 + Math.random() * 4;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      bottom:${Math.random() * 40}%;
      --dur:${4 + Math.random() * 6}s;
      --delay:-${Math.random() * 5}s;
    `;
    canvas.appendChild(p);
  }
}());

// ── Splash step ───────────────────────────────────────────────────────────────

tcCheck.addEventListener('change', () => {
  const checked = tcCheck.checked;
  splashContinue.disabled = !checked;
  splashContinue.classList.toggle('ready', checked);
});

splashContinue.addEventListener('click', () => {
  if (!tcCheck.checked) return;
  goToStep(1);
});

// ── Name step ─────────────────────────────────────────────────────────────────

nameInput.addEventListener('input', () => {
  nameContinue.classList.toggle('ready', nameInput.value.trim().length >= 2);
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryAdvanceFromName();
});

nameContinue.addEventListener('click', tryAdvanceFromName);

function tryAdvanceFromName() {
  const value = nameInput.value.trim();
  if (value.length < 2) return;
  state.name = value;
  goToStep(2);
}

// ── Provider grid ─────────────────────────────────────────────────────────────

function bindProviderCardIcon(card, provider) {
  const image = card.querySelector('.p-icon-image');
  if (!image || !provider.iconPath) {
    card.classList.add('icon-missing');
    return;
  }
  image.addEventListener('error', () => card.classList.add('icon-missing'));
  image.addEventListener('load', () => card.classList.remove('icon-missing'));
  if (image.complete && image.naturalWidth === 0) card.classList.add('icon-missing');
}

function buildProviderGrid() {
  providerGrid.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'provider-row';

  PROVIDERS.forEach((provider) => {
    const card = document.createElement('button');
    const isSelected = state.selectedProviders.has(provider.id);

    card.type = 'button';
    card.className = 'provider-card';
    card.dataset.id = provider.id;
    card.dataset.provider = provider.id;
    card.dataset.iconFrame = provider.iconFrame || 'none';
    card.title = `${provider.label}${provider.company ? ` by ${provider.company}` : ''}`;
    card.setAttribute('aria-label', card.title);
    card.setAttribute('aria-pressed', String(isSelected));
    card.style.setProperty('--p-color', provider.color);
    if (provider.iconSize) card.style.setProperty('--p-icon-size', provider.iconSize);

    card.innerHTML = `
      <span class="p-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M5 12l5 5L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/>
        </svg>
      </span>
      <span class="p-card-stack">
        <span class="p-icon" aria-hidden="true">
          <img class="p-icon-image" src="${provider.iconPath || 'data:,'}" alt="" />
          <span class="p-icon-fallback">${provider.fallback}</span>
        </span>
        <span class="p-name">${provider.label}</span>
        <span class="p-caption">${provider.caption}</span>
      </span>
    `;

    if (isSelected) card.classList.add('selected');
    bindProviderCardIcon(card, provider);

    // Only fire click if NOT a drag scroll
    card.addEventListener('click', () => {
      if (providerGrid._wasDragging) return;
      toggleProvider(provider.id);
    });

    row.appendChild(card);
  });

  providerGrid.appendChild(row);
  initDragScroll(providerGrid);
}

// ── Drag-to-scroll ────────────────────────────────────────────────────────────

function initDragScroll(el) {
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  el._wasDragging = false;

  el.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
    el._wasDragging = false;
  });

  el.addEventListener('mouseleave', () => { isDown = false; });
  el.addEventListener('mouseup', () => { isDown = false; });

  el.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.2;
    if (Math.abs(walk) > 4) el._wasDragging = true;
    el.scrollLeft = scrollLeft - walk;
  });
}

// ── Toggle selection ──────────────────────────────────────────────────────────

function toggleProvider(providerId) {
  if (state.selectedProviders.has(providerId)) {
    state.selectedProviders.delete(providerId);
  } else {
    state.selectedProviders.add(providerId);
    ensureProviderConfig(providerId);
  }

  const selected = state.selectedProviders.has(providerId);
  providerGrid.querySelectorAll(`[data-id="${providerId}"]`).forEach((card) => {
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });

  renderProviderFields();
  updateKeysContinue();
}

// ── Key fields ────────────────────────────────────────────────────────────────

function createProviderField(providerId, field) {
  const wrapper = document.createElement('label');
  wrapper.className = 'config-field';

  if (field.label) {
    const label = document.createElement('span');
    label.className = 'config-field-label';
    label.textContent = field.label;
    wrapper.appendChild(label);
  }

  const inputWrap = document.createElement('div');
  inputWrap.className = 'key-input-wrap';

  const input = document.createElement('input');
  input.className = 'key-input';
  input.id = `provider-${providerId}-${field.key}`;
  input.type = field.type === 'password' ? 'password' : 'text';
  input.placeholder = field.placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = getProviderValue(providerId, field.key);

  input.addEventListener('input', () => {
    ensureProviderConfig(providerId)[field.key] = input.value;
    updateKeysContinue();
  });

  inputWrap.appendChild(input);

  if (field.type === 'password') {
    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'key-eye';
    eye.title = 'Show or hide';
    eye.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>
        <circle cx="12" cy="12" r="3" stroke-width="1.8"/>
      </svg>
    `;
    eye.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    inputWrap.appendChild(eye);
  }

  wrapper.appendChild(inputWrap);
  return wrapper;
}

function renderProviderFields() {
  keysSection.innerHTML = '';
  if (state.selectedProviders.size === 0) return;

  const heading = document.createElement('div');
  heading.className = 'keys-copy';
  heading.innerHTML = `
    <p class="keys-heading">Connect your selected providers</p>
    <p class="keys-subheading">Cloud providers use an API key. Ollama and LM Studio use a local server URL and model name.</p>
  `;
  keysSection.appendChild(heading);

  PROVIDERS
    .filter((p) => state.selectedProviders.has(p.id))
    .forEach((provider) => {
      const card = document.createElement('div');
      card.className = 'provider-config-card';
      card.style.setProperty('--p-color', provider.color);

      const header = document.createElement('div');
      header.className = 'provider-config-header';
      header.innerHTML = `
        <div class="provider-config-title">
          <span class="key-dot"></span>
          <span>${provider.label}</span>
        </div>
        <span class="provider-config-badge">${provider.caption}</span>
      `;

      const fields = document.createElement('div');
      fields.className = `provider-config-fields provider-config-fields--${provider.fields.length > 1 ? 'multi' : 'single'}`;
      provider.fields.forEach((field) => fields.appendChild(createProviderField(provider.id, field)));

      card.append(header, fields);

      if (provider.hint) {
        const hint = document.createElement('p');
        hint.className = 'provider-config-hint';
        hint.textContent = provider.hint;
        card.appendChild(hint);
      }

      keysSection.appendChild(card);
    });
}

function updateKeysContinue() {
  if (state.selectedProviders.size === 0) {
    keysContinue.classList.remove('ready');
    return;
  }
  const allReady = [...state.selectedProviders].every(providerIsComplete);
  keysContinue.classList.toggle('ready', allReady);
}

// ── Save & finish ─────────────────────────────────────────────────────────────

keysContinue.addEventListener('click', async () => {
  if (!keysContinue.classList.contains('ready')) return;
  await saveSetup();
  goToStep(3);
});

async function saveSetup() {
  try {
    await window.electronAPI.saveUser({
      name: state.name,
      setup_complete: true,
      created_at: new Date().toISOString(),
      preferences: {
        theme: 'light',
        default_provider: [...state.selectedProviders][0] || null,
        default_model: null,
      },
    });

    await window.electronAPI.saveProviderConfigs(
      Object.fromEntries(
        [...state.selectedProviders].map((id) => [id, serializeProviderConfig(id)]),
      ),
    );
  } catch (error) {
    console.error('[setup] Save error:', error);
  }
}

// ── Init dots ─────────────────────────────────────────────────────────────────

progressDots.forEach((dot, i) => dot.classList.toggle('active', i === 0));