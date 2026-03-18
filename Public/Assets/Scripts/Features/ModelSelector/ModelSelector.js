// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/ModelSelector/ModelSelector.js
//  Loads available models, renders the dropdown, and fires a custom event
//  whenever the active model changes so other features can react.
// ─────────────────────────────────────────────

import { state }                          from '../../Shared/State.js';
import { modelLabel, modelDropdown, modelSelectorBtn } from '../../Shared/DOM.js';

/* ══════════════════════════════════════════
   INTERNAL HELPERS
══════════════════════════════════════════ */
function normalizeInputs(inputs = {}) {
  return {
    text:  inputs.text  !== false,
    image: Boolean(inputs.image),
    pdf:   Boolean(inputs.pdf),
    docx:  Boolean(inputs.docx),
  };
}

/* ══════════════════════════════════════════
   PUBLIC — QUERY HELPERS
══════════════════════════════════════════ */
export function getSelectedModelInfo() {
  return state.selectedProvider?.models?.[state.selectedModel] ?? null;
}

export function getModelInputs(
  provider = state.selectedProvider,
  modelId  = state.selectedModel,
) {
  return normalizeInputs(provider?.models?.[modelId]?.inputs);
}

export function modelSupportsInput(kind, provider, modelId) {
  return Boolean(getModelInputs(provider, modelId)[kind]);
}

/* ══════════════════════════════════════════
   EVENT BUS
══════════════════════════════════════════ */
export function notifyModelSelectionChanged() {
  window.dispatchEvent(new CustomEvent('ow:model-selection-changed', {
    detail: {
      provider: state.selectedProvider,
      modelId:  state.selectedModel,
      model:    getSelectedModelInfo(),
      inputs:   getModelInputs(),
    },
  }));
}

/* ══════════════════════════════════════════
   LABEL
══════════════════════════════════════════ */
export function updateModelLabel() {
  if (!modelLabel) return;
  if (!state.selectedProvider || !state.selectedModel) {
    modelLabel.textContent = 'No API keys set';
    return;
  }
  modelLabel.textContent =
    state.selectedProvider.models[state.selectedModel]?.name ?? state.selectedModel;
}

/* ══════════════════════════════════════════
   DROPDOWN
══════════════════════════════════════════ */
export function buildModelDropdown() {
  if (!modelDropdown) return;
  modelDropdown.innerHTML = '';

  state.providers.forEach(provider => {
    const section = document.createElement('div');
    section.className = 'model-group';

    const header = document.createElement('div');
    header.className   = 'model-group-header';
    header.textContent = provider.label;
    section.appendChild(header);

    Object.entries(provider.models).forEach(([modelId, info]) => {
      const item     = document.createElement('button');
      item.className = 'model-item';
      const isActive =
        state.selectedProvider?.provider === provider.provider &&
        state.selectedModel === modelId;
      if (isActive) item.classList.add('active');

      item.innerHTML = `
        <span class="model-item-name">${info.name}</span>
        <span class="model-item-desc">${info.description}</span>`;

      item.addEventListener('click', () => {
        state.selectedProvider = provider;
        state.selectedModel    = modelId;
        updateModelLabel();
        buildModelDropdown();
        modelDropdown.classList.remove('open');
        notifyModelSelectionChanged();
      });

      section.appendChild(item);
    });

    modelDropdown.appendChild(section);
  });
}

/* ══════════════════════════════════════════
   LOAD  (called on startup)
══════════════════════════════════════════ */
export async function loadProviders() {
  try {
    const all = await window.electronAPI?.getModels() ?? [];

    const prevProviderId = state.selectedProvider?.provider ?? null;
    const prevModelId    = state.selectedModel ?? null;

    state.allProviders = all;
    state.providers    = all.filter(p => p.api && p.api.trim() !== '');

    if (state.providers.length === 0) {
      state.selectedProvider = null;
      state.selectedModel    = null;
      if (modelLabel) modelLabel.textContent = 'No API keys set';
      if (modelDropdown) modelDropdown.innerHTML = '';
      notifyModelSelectionChanged();
      return;
    }

    const nextProvider =
      state.providers.find(p => p.provider === prevProviderId) ?? state.providers[0];
    const nextModelId =
      (prevModelId && nextProvider.models?.[prevModelId]) ? prevModelId
      : Object.keys(nextProvider.models)[0];

    state.selectedProvider = nextProvider;
    state.selectedModel    = nextModelId;
    updateModelLabel();
    buildModelDropdown();
    notifyModelSelectionChanged();
  } catch (err) {
    console.warn('[ModelSelector] Could not load models:', err);
    state.allProviders = [];
    state.providers    = [];
    state.selectedProvider = null;
    state.selectedModel    = null;
    if (modelLabel)    modelLabel.textContent = 'openworld';
    if (modelDropdown) modelDropdown.innerHTML = '';
    notifyModelSelectionChanged();
  }
}

/* ══════════════════════════════════════════
   INIT (bind UI events)
══════════════════════════════════════════ */
export function init() {
  modelSelectorBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (state.providers.length === 0) return;
    modelDropdown?.classList.toggle('open');
  });
}
