// ─────────────────────────────────────────────
//  openworld — setup.js
//  First-run onboarding · Provider key collection
// ─────────────────────────────────────────────

const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Claude',
    company: 'Anthropic',
    placeholder: 'sk-ant-api03-...',
    color: '#cc785c',
    iconPath: 'Assets/Icons/Claude.png',
    fallback: 'C',
  },
  {
    id: 'openai',
    label: 'ChatGPT',
    company: 'OpenAI',
    placeholder: 'sk-proj-...',
    color: '#10a37f',
    iconPath: 'Assets/Icons/ChatGPT.png',
    fallback: 'GPT',
  },
  {
    id: 'google',
    label: 'Gemini',
    company: 'Google',
    placeholder: 'AIza...',
    color: '#4285f4',
    iconPath: 'Assets/Icons/Gemini.png',
    fallback: 'G',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    company: '',
    placeholder: 'sk-or-v1-...',
    color: '#9b59b6',
    iconPath: 'Assets/Icons/OpenRouter.png',
    fallback: 'OR',
  },
];

/* ── State ── */
const state = {
  step: 1, // 1 = name, 2 = providers, 3 = done
  name: '',
  selectedProviders: new Set(),
  apiKeys: {}, // { providerId: 'key' }
};

/* ── DOM refs ── */
const stepName      = document.getElementById('step-name');
const stepProviders = document.getElementById('step-providers');
const stepDone      = document.getElementById('step-done');
const nameInput     = document.getElementById('name-input');
const nameContinue  = document.getElementById('name-continue');
const providerGrid  = document.getElementById('provider-grid');
const keysSection   = document.getElementById('keys-section');
const keysContinue  = document.getElementById('keys-continue');
const progressDots  = document.querySelectorAll('.dot');
const doneTitle     = document.getElementById('done-title');

/* ══════════════════════════════════════════
   STEP 1 — Name
══════════════════════════════════════════ */
nameInput.addEventListener('input', () => {
  const val = nameInput.value.trim();
  nameContinue.classList.toggle('ready', val.length >= 2);
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryAdvanceFromName();
});

nameContinue.addEventListener('click', tryAdvanceFromName);

function tryAdvanceFromName() {
  const val = nameInput.value.trim();
  if (val.length < 2) return;
  state.name = val;
  goToStep(2);
}

/* ══════════════════════════════════════════
   STEP 2 — Providers
══════════════════════════════════════════ */
function buildProviderGrid() {
  providerGrid.innerHTML = '';
  PROVIDERS.forEach(p => {
    const card = document.createElement('button');
    const isSelected = state.selectedProviders.has(p.id);

    card.type = 'button';
    card.className = 'provider-card';
    card.dataset.id = p.id;
    card.title = `${p.label}${p.company ? ` by ${p.company}` : ''}`;
    card.setAttribute('aria-label', card.title);
    card.setAttribute('aria-pressed', String(isSelected));
    card.style.setProperty('--p-color', p.color);
    card.innerHTML = `
      <span class="p-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M5 12l5 5L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/>
        </svg>
      </span>
      <span class="p-icon" aria-hidden="true">
        <img class="p-icon-image" src="${p.iconPath}" alt="" />
        <span class="p-icon-fallback">${p.fallback}</span>
      </span>`;

    if (isSelected) {
      card.classList.add('selected');
    }

    const image = card.querySelector('.p-icon-image');
    image.addEventListener('error', () => {
      card.classList.add('icon-missing');
    });
    image.addEventListener('load', () => {
      card.classList.remove('icon-missing');
    });
    if (image.complete && image.naturalWidth === 0) {
      card.classList.add('icon-missing');
    }

    card.addEventListener('click', () => toggleProvider(p.id, card));
    providerGrid.appendChild(card);
  });
}

function toggleProvider(id, card) {
  if (state.selectedProviders.has(id)) {
    state.selectedProviders.delete(id);
    card.classList.remove('selected');
    card.setAttribute('aria-pressed', 'false');
  } else {
    state.selectedProviders.add(id);
    card.classList.add('selected');
    card.setAttribute('aria-pressed', 'true');
  }
  renderKeyFields();
  updateKeysContinue();
}

function renderKeyFields() {
  keysSection.innerHTML = '';
  if (state.selectedProviders.size === 0) return;

  const heading = document.createElement('p');
  heading.className = 'keys-heading';
  heading.textContent = 'Enter your API keys';
  keysSection.appendChild(heading);

  PROVIDERS.filter(p => state.selectedProviders.has(p.id)).forEach(p => {
    const row = document.createElement('div');
    row.className = 'key-row';
    row.style.setProperty('--p-color', p.color);
    row.innerHTML = `
      <label class="key-label">
        <span class="key-dot"></span>
        ${p.label}
      </label>
      <div class="key-input-wrap">
        <input
          type="password"
          class="key-input"
          id="key-${p.id}"
          placeholder="${p.placeholder}"
          autocomplete="off"
          spellcheck="false"
        />
        <button type="button" class="key-eye" data-target="key-${p.id}" title="Show/hide">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/>
            <circle cx="12" cy="12" r="3" stroke-width="1.8"/>
          </svg>
        </button>
      </div>`;

    const input = row.querySelector('.key-input');
    input.value = state.apiKeys[p.id] || '';
    input.addEventListener('input', () => {
      state.apiKeys[p.id] = input.value.trim();
      updateKeysContinue();
    });

    const eye = row.querySelector('.key-eye');
    eye.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    keysSection.appendChild(row);
  });
}

function updateKeysContinue() {
  if (state.selectedProviders.size === 0) {
    keysContinue.classList.remove('ready');
    return;
  }
  // All selected providers must have a non-empty key
  const allFilled = [...state.selectedProviders].every(id => {
    const input = document.getElementById(`key-${id}`);
    return input && input.value.trim().length > 8;
  });
  keysContinue.classList.toggle('ready', allFilled);
}

keysContinue.addEventListener('click', async () => {
  if (!keysContinue.classList.contains('ready')) return;

  // Collect final keys
  state.selectedProviders.forEach(id => {
    const input = document.getElementById(`key-${id}`);
    if (input) state.apiKeys[id] = input.value.trim();
  });

  await saveSetup();
  goToStep(3);
});

/* ══════════════════════════════════════════
   SAVE — write User.json + Models.json
══════════════════════════════════════════ */
async function saveSetup() {
  try {
    // Save user profile
    await window.electronAPI.saveUser({
      name: state.name,
      setup_complete: true,
      created_at: new Date().toISOString(),
      preferences: {
        theme: 'dark',
        default_provider: [...state.selectedProviders][0] || null,
        default_model: null,
      },
    });

    // Save API keys into Models.json
    await window.electronAPI.saveAPIKeys(
      Object.fromEntries(
        [...state.selectedProviders].map(id => [id, state.apiKeys[id]])
      )
    );
  } catch (err) {
    console.error('[setup] Save error:', err);
    // Graceful degradation: still advance
  }
}

/* ══════════════════════════════════════════
   STEP TRANSITIONS
══════════════════════════════════════════ */
function goToStep(n) {
  state.step = n;

  // Update dots
  progressDots.forEach((dot, i) => {
    dot.classList.toggle('active', i < n);
    dot.classList.toggle('done', i < n - 1);
  });

  const steps = [stepName, stepProviders, stepDone];
  steps.forEach((el, i) => {
    if (i + 1 === n) {
      el.classList.add('entering');
      el.style.display = 'flex';
      requestAnimationFrame(() => {
        el.classList.remove('entering');
        el.classList.add('visible');
      });
    } else {
      el.classList.remove('visible');
      el.classList.add('leaving');
      setTimeout(() => {
        el.classList.remove('leaving');
        el.style.display = 'none';
      }, 320);
    }
  });

  if (n === 2) buildProviderGrid();
  if (n === 3) {
    const first = state.name.split(' ')[0];
    doneTitle.textContent = `You're all set, ${first} 🎉`;
    setTimeout(() => {
      window.electronAPI?.launchMain?.();
    }, 2200);
  }
}

/* ── Init ── */
stepProviders.style.display = 'none';
stepDone.style.display = 'none';
nameInput.focus();
