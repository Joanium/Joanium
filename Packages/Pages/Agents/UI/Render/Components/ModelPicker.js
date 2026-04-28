import { escapeHtml, resolveModelLabel } from '../Utils/Utils.js';
export function createModelPicker({
  state: state,
  primaryModelBtn: primaryModelBtn,
  primaryModelLabel: primaryModelLabel,
  primaryModelMenu: primaryModelMenu,
}) {
  function closeMenu() {
    (primaryModelMenu?.classList.remove('open'), primaryModelBtn?.classList.remove('open'));
  }
  function syncPrimaryModelLabel() {
    primaryModelLabel &&
      (primaryModelLabel.textContent = state.primaryModel
        ? resolveModelLabel(
            state.allModels,
            state.primaryModel.provider,
            state.primaryModel.modelId,
          )
        : 'Select a model...');
  }
  const onPrimaryClick = (event) => {
      event.stopPropagation();
      const isOpen = primaryModelMenu?.classList.contains('open');
      (primaryModelMenu?.classList.toggle('open', !isOpen),
        primaryModelBtn?.classList.toggle('open', !isOpen),
        isOpen ||
          (function () {
            if (((primaryModelMenu.innerHTML = ''), !state.allModels.length))
              return void (primaryModelMenu.innerHTML =
                '<div class="agent-model-empty">No models. Connect a provider in Settings.</div>');
            const groups = state.allModels.reduce(
              (result, model) => (
                result[model.provider] || (result[model.provider] = []),
                result[model.provider].push(model),
                result
              ),
              {},
            );
            Object.entries(groups).forEach(([groupName, models]) => {
              const headerEl = document.createElement('div');
              ((headerEl.className = 'agent-model-group-header'),
                (headerEl.textContent = groupName),
                primaryModelMenu.appendChild(headerEl),
                models.forEach((model) => {
                  const button = document.createElement('button');
                  ((button.type = 'button'),
                    (button.className =
                      'agent-model-option' +
                      (model.providerId === state.primaryModel?.provider &&
                      model.modelId === state.primaryModel?.modelId
                        ? ' selected'
                        : '')),
                    (button.innerHTML = `\n          <span>${escapeHtml(model.modelName)}</span>\n          ${model.description ? `<span class="agent-model-option-desc">${escapeHtml(model.description)}</span>` : ''}`),
                    button.addEventListener('click', () => {
                      ((state.primaryModel = {
                        provider: model.providerId,
                        modelId: model.modelId,
                      }),
                        syncPrimaryModelLabel(),
                        closeMenu());
                    }),
                    primaryModelMenu.appendChild(button));
                }));
            });
          })());
    },
    onDocumentClick = (event) => {
      primaryModelBtn?.contains(event.target) ||
        primaryModelMenu?.contains(event.target) ||
        closeMenu();
    };
  return (
    primaryModelBtn?.addEventListener('click', onPrimaryClick),
    document.addEventListener('click', onDocumentClick),
    {
      closeMenu: closeMenu,
      syncPrimaryModelLabel: syncPrimaryModelLabel,
      cleanup() {
        (primaryModelBtn?.removeEventListener('click', onPrimaryClick),
          document.removeEventListener('click', onDocumentClick),
          closeMenu());
      },
    }
  );
}
