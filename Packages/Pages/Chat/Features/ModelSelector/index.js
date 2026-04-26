import { state } from '../../../../System/State.js';
import { modelLabel, modelDropdown, modelSelectorBtn } from '../../../Shared/Core/DOM.js';
function sortedModelEntries(models = {}) {
  return Object.entries(models);
}
export function getSelectedModelInfo() {
  return state.selectedProvider?.models?.[state.selectedModel] ?? null;
}
export function getModelInputs(provider = state.selectedProvider, modelId = state.selectedModel) {
  return (function (inputs = {}) {
    return {
      text: !1 !== inputs.text,
      image: Boolean(inputs.image),
      pdf: Boolean(inputs.pdf),
      docx: Boolean(inputs.docx),
    };
  })(provider?.models?.[modelId]?.inputs);
}
export function modelSupportsInput(kind, provider, modelId) {
  return Boolean(getModelInputs(provider, modelId)[kind]);
}
export function notifyModelSelectionChanged() {
  window.dispatchEvent(
    new CustomEvent('jo:model-selection-changed', {
      detail: {
        provider: state.selectedProvider,
        modelId: state.selectedModel,
        model: getSelectedModelInfo(),
        inputs: getModelInputs(),
      },
    }),
  );
}
export function updateModelLabel() {
  modelLabel &&
    (state.selectedProvider && state.selectedModel
      ? (modelLabel.textContent =
          state.selectedProvider.models[state.selectedModel]?.name ?? state.selectedModel)
      : (modelLabel.textContent = 'No AI providers connected'));
}
export function buildModelDropdown() {
  modelDropdown &&
    ((modelDropdown.innerHTML = ''),
    state.providers.forEach((provider) => {
      const section = document.createElement('div');
      section.className = 'model-group';
      const header = document.createElement('div');
      ((header.className = 'model-group-header'),
        (header.textContent = provider.label),
        section.appendChild(header),
        sortedModelEntries(provider.models).forEach(([modelId, info]) => {
          const item = document.createElement('button');
          ((item.className = 'model-item'),
            state.selectedProvider?.provider === provider.provider &&
              state.selectedModel === modelId &&
              item.classList.add('active'),
            (item.innerHTML = `\n        <span class="model-item-name">${info.name}</span>\n        <span class="model-item-desc">${info.description}</span>`),
            item.addEventListener('click', () => {
              ((state.selectedProvider = provider),
                (state.selectedModel = modelId),
                updateModelLabel(),
                buildModelDropdown(),
                modelDropdown.classList.remove('open'),
                notifyModelSelectionChanged());
            }),
            section.appendChild(item));
        }),
        modelDropdown.appendChild(section));
    }));
}
export async function loadProviders() {
  try {
    const [all, user] = await Promise.all([
      window.electronAPI?.invoke?.('get-models') ?? [],
      window.electronAPI?.invoke?.('get-user') ?? null,
    ]);
    const prevProviderId = state.selectedProvider?.provider ?? null;
    const prevModelId = state.selectedModel ?? null;
    const savedDefaultProvider = user?.preferences?.default_provider ?? null;
    const savedDefaultModel = user?.preferences?.default_model ?? null;
    if (
      ((state.allProviders = all),
      (state.providers = all.filter((provider) => provider.configured)),
      0 === state.providers.length)
    )
      return (
        (state.selectedProvider = null),
        (state.selectedModel = null),
        modelLabel && (modelLabel.textContent = 'No AI providers connected'),
        modelDropdown && (modelDropdown.innerHTML = ''),
        void notifyModelSelectionChanged()
      );
    // 1. Keep the in-session selection if still valid (user already picked something this session)
    const prevProvider = state.providers.find((p) => p.provider === prevProviderId);
    if (prevProvider && prevModelId && prevProvider.models?.[prevModelId]) {
      ((state.selectedProvider = prevProvider), (state.selectedModel = prevModelId));
    } else {
      // 2. Try to apply the user's saved default model preference
      const defaultProvider = savedDefaultProvider
        ? state.providers.find((p) => p.provider === savedDefaultProvider)
        : null;
      if (defaultProvider && savedDefaultModel && defaultProvider.models?.[savedDefaultModel]) {
        ((state.selectedProvider = defaultProvider), (state.selectedModel = savedDefaultModel));
      } else {
        // 3. Fall back to the first available model
        const { bestProvider: bestProvider, bestModelId: bestModelId } = (function (providers) {
          const bestProvider = providers[0] ?? null;
          const bestModelId = bestProvider
            ? (Object.keys(bestProvider.models ?? {})[0] ?? null)
            : null;
          return { bestProvider: bestProvider, bestModelId: bestModelId };
        })(state.providers);
        ((state.selectedProvider = bestProvider ?? state.providers[0]),
          (state.selectedModel =
            bestModelId ?? sortedModelEntries(state.selectedProvider.models)[0]?.[0]));
      }
    }
    (updateModelLabel(), buildModelDropdown(), notifyModelSelectionChanged());
  } catch (err) {
    (console.warn('[ModelSelector] Could not load models:', err),
      (state.allProviders = []),
      (state.providers = []),
      (state.selectedProvider = null),
      (state.selectedModel = null),
      modelLabel && (modelLabel.textContent = 'Joanium'),
      modelDropdown && (modelDropdown.innerHTML = ''),
      notifyModelSelectionChanged());
  }
}
export function init() {
  modelSelectorBtn?.addEventListener('click', (e) => {
    (e.stopPropagation(), 0 !== state.providers.length && modelDropdown?.classList.toggle('open'));
  });
}
