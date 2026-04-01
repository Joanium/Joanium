import { state } from '../../../../System/State.js';
import { modelLabel, modelDropdown, modelSelectorBtn } from '../../../Shared/Core/DOM.js';

/* ══════════════════════════════════════════
   INTERNAL HELPERS
══════════════════════════════════════════ */
function normalizeInputs(inputs = {}) {
  return {
    text: inputs.text !== false,
    image: Boolean(inputs.image),
    pdf: Boolean(inputs.pdf),
    docx: Boolean(inputs.docx),
  };
}

/** Sort model entries by their rank field (ascending — lower = better). */
function sortedModelEntries(models = {}) {
  return Object.entries(models).sort(
    ([, a], [, b]) => (a.rank ?? 999) - (b.rank ?? 999),
  );
}

/**
 * Find the single best model across all available providers.
 * Provider order in the array defines tie-breaking priority
 * (anthropic first, then openai, google, etc.).
 */
function findBestModel(providers) {
  let bestProvider = null;
  let bestModelId = null;
  let bestRank = Infinity;

  for (const provider of providers) {
    for (const [modelId, info] of Object.entries(provider.models ?? {})) {
      const rank = info.rank ?? 999;
      if (rank < bestRank) {
        bestRank = rank;
        bestProvider = provider;
        bestModelId = modelId;
      }
    }
  }

  return { bestProvider, bestModelId };
}

/* ══════════════════════════════════════════
   PUBLIC — QUERY HELPERS
══════════════════════════════════════════ */
export function getSelectedModelInfo() {
  return state.selectedProvider?.models?.[state.selectedModel] ?? null;
}

export function getModelInputs(
  provider = state.selectedProvider,
  modelId = state.selectedModel,
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
      modelId: state.selectedModel,
      model: getSelectedModelInfo(),
      inputs: getModelInputs(),
    },
  }));
}

/* ══════════════════════════════════════════
   LABEL
══════════════════════════════════════════ */
export function updateModelLabel() {
  if (!modelLabel) return;
  if (!state.selectedProvider || !state.selectedModel) {
    modelLabel.textContent = 'No AI providers connected';
    return;
  }
  modelLabel.textContent =
    state.selectedProvider.models[state.selectedModel]?.name ?? state.selectedModel;
}

/* ══════════════════════════════════════════
   DROPDOWN  (models sorted by rank within each provider)
══════════════════════════════════════════ */
export function buildModelDropdown() {
  if (!modelDropdown) return;
  modelDropdown.innerHTML = '';

  state.providers.forEach(provider => {
    const section = document.createElement('div');
    section.className = 'model-group';

    const header = document.createElement('div');
    header.className = 'model-group-header';
    header.textContent = provider.label;
    section.appendChild(header);

    // Sort models by rank before rendering
    sortedModelEntries(provider.models).forEach(([modelId, info]) => {
      const item = document.createElement('button');
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
        state.selectedModel = modelId;
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
    const prevModelId = state.selectedModel ?? null;

    state.allProviders = all;
    state.providers = all.filter((provider) => provider.configured);

    if (state.providers.length === 0) {
      state.selectedProvider = null;
      state.selectedModel = null;
      if (modelLabel) modelLabel.textContent = 'No AI providers connected';
      if (modelDropdown) modelDropdown.innerHTML = '';
      notifyModelSelectionChanged();
      return;
    }

    // Restore the previous selection if it's still valid
    const prevProvider = state.providers.find(p => p.provider === prevProviderId);
    const prevModelValid = prevProvider && prevModelId && prevProvider.models?.[prevModelId];

    if (prevModelValid) {
      state.selectedProvider = prevProvider;
      state.selectedModel = prevModelId;
    } else {
      // No valid prior selection — pick the globally best model.
      // Provider array order (anthropic → openai → google → …) acts as the
      // tie-breaker when two models share the same rank value.
      const { bestProvider, bestModelId } = findBestModel(state.providers);
      state.selectedProvider = bestProvider ?? state.providers[0];
      state.selectedModel = bestModelId ?? sortedModelEntries(state.selectedProvider.models)[0]?.[0];
    }

    updateModelLabel();
    buildModelDropdown();
    notifyModelSelectionChanged();
  } catch (err) {
    console.warn('[ModelSelector] Could not load models:', err);
    state.allProviders = [];
    state.providers = [];
    state.selectedProvider = null;
    state.selectedModel = null;
    if (modelLabel) modelLabel.textContent = 'Joanium';
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
