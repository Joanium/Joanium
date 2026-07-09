import { createElement } from '../../Shared/Utils/DomUtils.js';
import { invokeIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createCheckbox } from '../../Shared/Bubbly/Checkbox/Checkbox.js';
import { createDropDownLite } from '../../Shared/DropDownLite/DropDownLite.js';
import {
  buildAvailableModelOptions,
  decodeModelValue,
  encodeModelValue,
} from '../../Shared/ProviderCatalog/ModelOptions.js';
import { getSearchEngineIconPath } from '../../Shared/Icons/SearchEngineIcons/SearchEngineIcons.js';
import { EVENTS } from '../../Shared/Events/RendererEvents.js';
import { createSettingsPanelState } from './Utils.js';

const OPTION_KEYS = ['runOnStartup', 'keepAwake', 'soundEffects', 'showTechFeed', 'showChangelog'];

export function createAppSettingsPanel(strings) {
  const view = createElement('div', 'app-settings');
  const options = createElement('div', 'app-settings__options');
  const dataSection = createElement('section', 'app-settings__data');
  const danger = createElement('section', 'app-settings__danger');
  const status = createElement('p', 'app-settings__status');
  let defaultViewDropdown = null;
  let defaultModelDropdown = null;
  let defaultSearchEngineDropdown = null;
  let resetConfirmTimer = null;
  let resetConfirming = false;
  let disposed = false;
  let removeSettingsChangeListener = null;
  const state = createSettingsPanelState({ status, strings });

  function handleSettingsChanged(event) {
    if (!disposed) {
      state.setSettings(event.detail ?? state.settings);
    }
  }

  async function updateDefaultView(value) {
    try {
      await state.savePatch({ defaultView: value });
    } catch {
      state.setStatus(strings.saveFailed, 'error');
    }
  }

  async function updateDefaultModel(value) {
    try {
      const defaultModel = decodeModelValue(value);
      await state.savePatch({ defaultModel });
    } catch {
      state.setStatus(strings.saveFailed, 'error');
    }
  }

  async function updateDefaultSearchEngine(value) {
    try {
      await state.savePatch({ defaultSearchEngine: value });
    } catch {
      state.setStatus(strings.saveFailed, 'error');
    }
  }

  /** Resolve a display name for the active persona from User.json bootstrap data. */
  function resolvePersonaName(user) {
    const persona = user?.activePersona;
    if (!persona) return 'Joana';

    // filename like "Joana.md" → "Joana"
    if (typeof persona.filename === 'string') {
      return persona.filename.replace(/\.md$/i, '');
    }

    // namespace fallback
    if (typeof persona.namespace === 'string') return persona.namespace;

    return 'Joana';
  }

  /** Build the Data Portability section and append it to `dataSection`. */
  function buildDataSection(personaName) {
    const dp = strings.dataPortability;

    dataSection.replaceChildren();
    dataSection.append(createElement('h3', 'app-settings__danger-title', dp.title));

    // ── Export card ──────────────────────────────────────────────────────────
    const exportRow = createElement('div', 'app-settings__dropdown-row app-settings__data-row');
    const exportMeta = createElement('div', 'app-settings__dropdown-meta');
    exportMeta.append(
      createElement('span', 'app-settings__dropdown-label', dp.export.label(personaName)),
      createElement('span', 'app-settings__dropdown-desc', dp.export.description),
    );

    const exportBtn = createElement(
      'button',
      'app-settings__data-btn',
      dp.export.button(personaName),
    );
    exportBtn.type = 'button';
    exportBtn.addEventListener('click', async () => {
      if (exportBtn.disabled) return;
      exportBtn.disabled = true;
      exportBtn.textContent = dp.export.exporting;

      try {
        const result = await invokeIpc('data:export');
        if (result?.ok) {
          state.setStatus(dp.export.success, 'ok');
        } else if (!result?.canceled) {
          state.setStatus(dp.export.failed, 'error');
        }
      } catch {
        state.setStatus(dp.export.failed, 'error');
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = dp.export.button(personaName);
      }
    });

    exportRow.append(exportMeta, exportBtn);
    dataSection.append(exportRow);

    // ── Import card ──────────────────────────────────────────────────────────
    const importRow = createElement('div', 'app-settings__dropdown-row app-settings__data-row');
    const importMeta = createElement('div', 'app-settings__dropdown-meta');
    importMeta.append(
      createElement('span', 'app-settings__dropdown-label', dp.import.label),
      createElement('span', 'app-settings__dropdown-desc', dp.import.description),
    );

    const importBtn = createElement('button', 'app-settings__data-btn', dp.import.button);
    importBtn.type = 'button';
    importBtn.addEventListener('click', async () => {
      if (importBtn.disabled) return;
      importBtn.disabled = true;
      importBtn.textContent = dp.import.importing;

      try {
        const result = await invokeIpc('data:import');
        if (result?.ok) {
          state.setStatus(dp.import.success, 'ok');
        } else if (!result?.canceled) {
          state.setStatus(dp.import.failed, 'error');
        }
      } catch {
        state.setStatus(dp.import.failed, 'error');
      } finally {
        importBtn.disabled = false;
        importBtn.textContent = dp.import.button;
      }
    });

    importRow.append(importMeta, importBtn);
    dataSection.append(importRow);
  }

  async function populate() {
    // Fetch app settings and provider catalog in parallel.
    const [nextSettings, bootstrap, modelFavourites] = await Promise.all([
      invokeIpc('app-settings:get'),
      invokeIpc('chat:bootstrap').catch(() => ({ providers: [], user: {} })),
      invokeIpc('providers:list-model-favourites').catch(() => []),
    ]);

    if (disposed) {
      return;
    }

    state.setSettings(nextSettings);
    resetConfirming = false;
    options.replaceChildren();
    dataSection.replaceChildren();
    danger.replaceChildren();
    defaultViewDropdown?.dispose();
    defaultViewDropdown = null;
    defaultModelDropdown?.dispose();
    defaultModelDropdown = null;
    defaultSearchEngineDropdown?.dispose();
    defaultSearchEngineDropdown = null;

    // ── Default view row ───────────────────────────────────────────────────
    const viewOptions = Object.entries(strings.defaultView.views).map(([value, label]) => ({
      value,
      label,
    }));
    defaultViewDropdown = createDropDownLite({
      label: '',
      options: viewOptions,
      value: state.settings.defaultView ?? 'chat',
      onChange: (value) => {
        void updateDefaultView(value);
      },
    });

    const dropdownRow = createElement('div', 'app-settings__dropdown-row');
    const dropdownMeta = createElement('div', 'app-settings__dropdown-meta');
    const dropdownLabel = createElement(
      'span',
      'app-settings__dropdown-label',
      strings.defaultView.label,
    );
    const dropdownDesc = createElement(
      'span',
      'app-settings__dropdown-desc',
      strings.defaultView.description,
    );
    dropdownMeta.append(dropdownLabel, dropdownDesc);
    dropdownRow.append(dropdownMeta, defaultViewDropdown.element);
    options.append(dropdownRow);

    // ── Default model row ──────────────────────────────────────────────────
    const providers = Array.isArray(bootstrap.providers) ? bootstrap.providers : [];
    const userProviderDetails = bootstrap.user?.providers?.details ?? {};
    const modelOptions = buildAvailableModelOptions(providers, userProviderDetails, {
      modelFavourites,
    });

    const savedModelValue = encodeModelValue(state.settings.defaultModel);
    const currentModelValue = savedModelValue || (modelOptions[0]?.value ?? '');

    defaultModelDropdown = createDropDownLite({
      label: '',
      options: modelOptions,
      value: currentModelValue,
      searchable: true,
      searchPlaceholder: strings.defaultModel.searchPlaceholder ?? 'Search models…',
      onChange: (value) => {
        void updateDefaultModel(value);
      },
      onToggleFavourite: async (opt) => {
        if (!opt.provider?.id || !opt.model?.id) return;
        await invokeIpc('providers:toggle-model-favourite', opt.provider.id, opt.model.id).catch(
          () => null,
        );
        void populate();
      },
    });

    const modelRow = createElement(
      'div',
      'app-settings__dropdown-row app-settings__dropdown-row--wide',
    );
    const modelMeta = createElement('div', 'app-settings__dropdown-meta');
    const modelLabel = createElement(
      'span',
      'app-settings__dropdown-label',
      strings.defaultModel.label,
    );
    const modelDesc = createElement(
      'span',
      'app-settings__dropdown-desc',
      strings.defaultModel.description,
    );
    modelMeta.append(modelLabel, modelDesc);
    modelRow.append(modelMeta, defaultModelDropdown.element);
    options.append(modelRow);

    // ── Default search engine row ──────────────────────────────────────────
    const searchEngineOptions = strings.defaultSearchEngine.options.map((option) => ({
      ...option,
      iconPath: getSearchEngineIconPath(option.value),
    }));

    defaultSearchEngineDropdown = createDropDownLite({
      label: '',
      options: searchEngineOptions,
      value: state.settings.defaultSearchEngine ?? 'google',
      onChange: (value) => {
        void updateDefaultSearchEngine(value);
      },
    });

    const searchEngineRow = createElement('div', 'app-settings__dropdown-row');
    const searchEngineMeta = createElement('div', 'app-settings__dropdown-meta');
    searchEngineMeta.append(
      createElement('span', 'app-settings__dropdown-label', strings.defaultSearchEngine.label),
      createElement('span', 'app-settings__dropdown-desc', strings.defaultSearchEngine.description),
    );
    searchEngineRow.append(searchEngineMeta, defaultSearchEngineDropdown.element);
    options.append(searchEngineRow);

    // ── Boolean toggles ────────────────────────────────────────────────────
    for (const key of OPTION_KEYS) {
      const option = strings.options[key];
      const checkbox = createCheckbox({
        label: option.label,
        description: option.description,
        checked: Boolean(state.settings[key]),
        onChange: (checked) => {
          void state.updateSetting(key, checked, checkbox.element);
        },
      });
      options.append(checkbox.element);
    }

    // ── Data portability section ───────────────────────────────────────────
    const personaName = resolvePersonaName(bootstrap.user);
    buildDataSection(personaName);

    // ── Danger zone ────────────────────────────────────────────────────────
    danger.append(createElement('h3', 'app-settings__danger-title', strings.reset.title));
    const resetRow = createElement('div', 'app-settings__danger-row');
    const resetMeta = createElement('div', 'app-settings__dropdown-meta');
    resetMeta.append(
      createElement('span', 'app-settings__dropdown-label', strings.reset.label),
      createElement('span', 'app-settings__dropdown-desc', strings.reset.description),
      createElement('span', 'app-settings__danger-warning', strings.reset.warning),
    );
    const resetButton = createElement('button', 'app-settings__reset-btn', strings.reset.button);
    resetButton.type = 'button';
    resetButton.addEventListener('click', async () => {
      if (!resetConfirming) {
        resetConfirming = true;
        resetButton.classList.add('app-settings__reset-btn--confirm');
        resetButton.textContent = strings.reset.confirm;
        clearTimeout(resetConfirmTimer);
        resetConfirmTimer = setTimeout(() => {
          resetConfirming = false;
          resetButton.classList.remove('app-settings__reset-btn--confirm');
          resetButton.textContent = strings.reset.button;
        }, 3200);
        return;
      }

      clearTimeout(resetConfirmTimer);
      resetButton.disabled = true;
      resetButton.textContent = strings.reset.resetting;

      try {
        await invokeIpc('app-settings:reset-app');
      } catch {
        resetConfirming = false;
        resetButton.disabled = false;
        resetButton.classList.remove('app-settings__reset-btn--confirm');
        resetButton.textContent = strings.reset.button;
        state.setStatus(strings.reset.failed, 'error');
      }
    });
    resetRow.append(resetMeta, resetButton);
    danger.append(resetRow);

    if (!removeSettingsChangeListener) {
      window.addEventListener(EVENTS.APP_SETTINGS_CHANGED, handleSettingsChanged);
      removeSettingsChangeListener = () => {
        window.removeEventListener(EVENTS.APP_SETTINGS_CHANGED, handleSettingsChanged);
      };
    }
  }

  view._dispose = () => {
    disposed = true;
    clearTimeout(resetConfirmTimer);
    removeSettingsChangeListener?.();
    removeSettingsChangeListener = null;
    defaultViewDropdown?.dispose();
    defaultModelDropdown?.dispose();
    defaultSearchEngineDropdown?.dispose();
  };

  view.append(options, dataSection, danger, status);
  void populate().catch(() => state.setStatus(strings.saveFailed, 'error'));
  return view;
}
