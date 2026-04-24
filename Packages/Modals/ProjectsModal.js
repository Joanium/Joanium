import { state } from '../System/State.js';
import { escapeHtml } from '../System/Utils.js';
import { t } from '../System/I18n/index.js';
import { syncModalOpenState } from '../Pages/Shared/Core/DOM.js';
export function initProjectsModal({
  onProjectOpen: onProjectOpen = async () => !1,
  onProjectRemoved: onProjectRemoved = async () => {},
  onClose: onClose = () => {},
} = {}) {
  if (!document.getElementById('projects-modal-backdrop')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div id="projects-modal-backdrop">
      <div id="projects-panel" role="dialog" aria-modal="true" aria-labelledby="projects-modal-title">
        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="projects-modal-title">${t('projects.modalTitle')}</h2>
            <p class="settings-modal-subtitle">${t('projects.modalSubtitle')}</p>
          </div>
          <button class="settings-modal-close" id="projects-close" type="button" aria-label="${t('projects.closeLabel')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div class="settings-modal-body projects-modal-body">
          <section class="project-create-card">
            <div class="project-card-header">
              <div>
                <h3>${t('projects.createTitle')}</h3>
                <p>${t('projects.createDesc')}</p>
              </div>
            </div>
            <label class="project-field">
              <span class="project-field-label">${t('projects.nameLabel')}</span>
              <input id="project-name-input" type="text" placeholder="${t('projects.namePlaceholder')}" autocomplete="off" spellcheck="false"/>
            </label>
            <div class="project-field">
              <span class="project-field-label">${t('projects.dirLabel')}</span>
              <div class="project-path-row">
                <input id="project-path-input" type="text" placeholder="${t('projects.dirPlaceholder')}" readonly/>
                <button id="project-path-btn" class="project-secondary-btn" type="button">${t('projects.chooseFolder')}</button>
              </div>
            </div>
            <label class="project-field">
              <span class="project-field-label">${t('projects.contextLabel')}</span>
              <textarea id="project-context-input" rows="5" placeholder="${t('projects.contextPlaceholder')}"></textarea>
            </label>
            <div class="project-create-footer">
              <div id="project-create-status" class="project-status" aria-live="polite"></div>
              <button id="project-create-btn" class="project-primary-btn" type="button">${t('projects.createBtn')}</button>
            </div>
          </section>
          <section class="project-list-card">
            <div class="project-card-header">
              <div>
                <h3>${t('projects.savedTitle')}</h3>
                <p>${t('projects.savedDesc')}</p>
              </div>
            </div>
            <div id="project-list" class="project-list"></div>
          </section>
        </div>
      </div>
    </div>

    <div id="edit-project-backdrop">
      <div id="edit-project-panel" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="edit-project-title">${t('projects.editTitle')}</h2>
            <p class="settings-modal-subtitle">${t('projects.editSubtitle')}</p>
          </div>
          <button class="settings-modal-close" id="edit-project-close" type="button" aria-label="${t('projects.closeLabel')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div class="settings-modal-body edit-project-modal-body" style="padding:24px">
          <label class="project-field">
            <span class="project-field-label">${t('projects.nameLabel')}</span>
            <input id="project-edit-name-input" type="text" placeholder="${t('projects.namePlaceholder')}" autocomplete="off" spellcheck="false"/>
          </label>
          <div class="project-field" style="margin-top:16px">
            <span class="project-field-label">${t('projects.dirLabel')}</span>
            <div class="project-path-row">
              <input id="project-edit-path-input" type="text" placeholder="${t('projects.dirPlaceholder')}" readonly/>
              <button id="project-edit-path-btn" class="project-secondary-btn" type="button">${t('projects.chooseFolder')}</button>
            </div>
          </div>
          <label class="project-field" style="margin-top:16px">
            <span class="project-field-label">${t('projects.contextLabel')}</span>
            <textarea id="project-edit-context-input" rows="5" placeholder="${t('projects.editContextPlaceholder')}"></textarea>
          </label>
          <div class="project-create-footer" style="margin-top:24px">
            <div id="project-edit-status" class="project-status" aria-live="polite"></div>
            <div style="display:flex;gap:8px">
              <button id="project-edit-cancel-btn" class="project-secondary-btn" type="button">${t('projects.cancel')}</button>
              <button id="project-edit-save-btn" class="project-primary-btn" type="button">${t('projects.saveChanges')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="project-missing-backdrop">
      <div id="project-missing-dialog" role="dialog" aria-modal="true" aria-labelledby="project-missing-title">
        <div class="project-missing-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M10 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            <path d="M12 11v4M12 18h.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
          </svg>
        </div>
        <h3 id="project-missing-title">${t('projects.missingTitle')}</h3>
        <p id="project-missing-copy">${t('projects.missingCopy')}</p>
        <div class="project-missing-actions">
          <button id="project-missing-cancel" class="project-secondary-btn" type="button">${t('projects.cancel')}</button>
          <button id="project-missing-remove" class="project-danger-btn" type="button">${t('projects.removeProject')}</button>
          <button id="project-missing-locate" class="project-primary-btn" type="button">${t('projects.locateFolder')}</button>
        </div>
      </div>
    </div>

    <div id="global-confirm-backdrop">
      <div id="global-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="global-confirm-title">
        <h3 id="global-confirm-title">${t('projects.confirmTitle')}</h3>
        <p id="global-confirm-copy">${t('projects.confirmBody')}</p>
        <div class="global-confirm-actions">
          <button id="global-confirm-cancel" class="project-secondary-btn" type="button">${t('projects.cancel')}</button>
          <button id="global-confirm-action" class="project-danger-btn" type="button">${t('projects.confirmTitle')}</button>
        </div>
      </div>
    </div>
  `;
    document.body.append(...Array.from(wrap.children));
  }
  const backdrop = document.getElementById('projects-modal-backdrop'),
    closeBtn = document.getElementById('projects-close'),
    listEl = document.getElementById('project-list'),
    nameInput = document.getElementById('project-name-input'),
    pathInput = document.getElementById('project-path-input'),
    contextInput = document.getElementById('project-context-input'),
    pathBtn = document.getElementById('project-path-btn'),
    createBtn = document.getElementById('project-create-btn'),
    statusEl = document.getElementById('project-create-status'),
    editBackdrop = document.getElementById('edit-project-backdrop'),
    editCloseBtn = document.getElementById('edit-project-close'),
    editNameInput = document.getElementById('project-edit-name-input'),
    editPathInput = document.getElementById('project-edit-path-input'),
    editContextInput = document.getElementById('project-edit-context-input'),
    editPathBtn = document.getElementById('project-edit-path-btn'),
    editSaveBtn = document.getElementById('project-edit-save-btn'),
    editCancelBtn = document.getElementById('project-edit-cancel-btn'),
    editStatusEl = document.getElementById('project-edit-status'),
    confirmBackdrop = document.getElementById('global-confirm-backdrop'),
    confirmTitle = document.getElementById('global-confirm-title'),
    confirmCopy = document.getElementById('global-confirm-copy'),
    confirmCancel = document.getElementById('global-confirm-cancel'),
    confirmAction = document.getElementById('global-confirm-action');
  if (!backdrop || !listEl)
    return { open() {}, close() {}, isOpen: () => !1, refreshProjects: async () => [] };
  let projects = [],
    editingProject = null;
  function setStatus(message = '', tone = '') {
    statusEl &&
      ((statusEl.textContent = message),
      (statusEl.className = 'project-status' + (tone ? ` ${tone}` : '')));
  }
  async function refreshProjects() {
    try {
      projects = (await window.electronAPI?.invoke('get-projects')) ?? [];
    } catch {
      projects = [];
    }
    return (
      listEl &&
        (projects.length
          ? ((listEl.innerHTML = ''),
            projects.forEach((project) => {
              const item = document.createElement('article');
              item.className = `project-item${state.activeProject?.id === project.id ? ' active' : ''}${project.folderExists ? '' : ' is-missing'}`;
              const context = project.context?.trim() || t('projects.contextPlaceholder'),
                lastOpened = (function (isoString) {
                  if (!isoString) return '';
                  const date = new Date(isoString);
                  if (Number.isNaN(date.getTime())) return '';
                  const diff = Date.now() - date.getTime(),
                    day = 864e5;
                  return diff < 36e5
                    ? 'Just now'
                    : diff < day
                      ? `${Math.max(1, Math.round(diff / 36e5))}h ago`
                      : diff < 7 * day
                        ? `${Math.max(1, Math.round(diff / day))}d ago`
                        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                })(project.lastOpenedAt ?? project.updatedAt);
              item.innerHTML = `
        <div class="project-item-main">
          <div class="project-item-head">
            <div class="project-item-title">${escapeHtml(project.name)}</div>
            <div class="project-item-badges">
              ${state.activeProject?.id === project.id ? `<span class="project-badge current">${t('projects.current')}</span>` : ''}
              ${project.folderExists ? '' : `<span class="project-badge missing">${t('projects.missingFolder')}</span>`}
            </div>
          </div>
          <div class="project-item-path">${escapeHtml(project.rootPath)}</div>
          <div class="project-item-context">${escapeHtml(context)}</div>
          <div class="project-item-context">${lastOpened ? t('projects.lastOpened').replace('{time}', escapeHtml(lastOpened)) : ''}</div>
        </div>
        <div class="project-item-actions">
          <button class="project-icon-btn project-open-btn" type="button" title="${t('projects.openProject')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="project-icon-btn project-edit-btn" type="button" title="${t('projects.editProject')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="project-icon-btn project-delete-btn" type="button" title="${t('projects.removeProject')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;
              item.querySelector('.project-open-btn')?.addEventListener('click', async () => {
                (await onProjectOpen(project)) && close();
              });
              item.querySelector('.project-edit-btn')?.addEventListener('click', () => {
                editingProject = project;
                editNameInput && (editNameInput.value = project.name || '');
                editPathInput && (editPathInput.value = project.rootPath || '');
                editContextInput && (editContextInput.value = project.context || '');
                editStatusEl && (editStatusEl.textContent = '');
                editBackdrop && editBackdrop.classList.add('open');
              });
              item.querySelector('.project-delete-btn')?.addEventListener('click', async () => {
                const copy = t('projects.removeConfirmBody').replace('{name}', project.name);
                const confirmed = await new Promise((resolve) => {
                  if (!confirmBackdrop)
                    return resolve(
                      window.confirm(`${t('projects.removeConfirmTitle')}\n\n${copy}`),
                    );
                  confirmTitle.textContent = t('projects.removeConfirmTitle');
                  confirmCopy.textContent = copy;
                  confirmBackdrop.classList.add('open');
                  const cleanup = () => {
                    confirmCancel?.removeEventListener('click', onCancel);
                    confirmAction?.removeEventListener('click', onAction);
                    confirmBackdrop.classList.remove('open');
                  };
                  const onCancel = () => {
                    cleanup();
                    resolve(!1);
                  };
                  const onAction = () => {
                    cleanup();
                    resolve(!0);
                  };
                  confirmCancel?.addEventListener('click', onCancel);
                  confirmAction?.addEventListener('click', onAction);
                });
                if (!confirmed) return;
                const result = await window.electronAPI?.invoke('delete-project', project.id);
                result?.ok
                  ? (state.activeProject?.id === project.id && (await onProjectRemoved(project)),
                    setStatus(t('projects.removed').replace('{name}', project.name), 'success'),
                    await refreshProjects())
                  : setStatus(result?.error || t('projects.couldNotRemove'), 'error');
              });
              listEl.appendChild(item);
            }))
          : (listEl.innerHTML = `<div class="project-empty">${t('projects.empty')}</div>`)),
      projects
    );
  }
  function close() {
    backdrop.classList.remove('open');
    syncModalOpenState();
    onClose();
  }
  function isOpen() {
    return backdrop.classList.contains('open');
  }
  closeBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    event.target === backdrop && close();
  });
  pathBtn?.addEventListener('click', async function () {
    const defaultPath = pathInput?.value?.trim() || state.activeProject?.rootPath || void 0,
      result = await window.electronAPI?.invoke('select-directory', { defaultPath });
    result?.ok && result.path && pathInput && (pathInput.value = result.path);
  });
  createBtn?.addEventListener('click', async function () {
    const name = nameInput?.value?.trim() ?? '',
      rootPath = pathInput?.value?.trim() ?? '',
      context = contextInput?.value?.trim() ?? '';
    if (!name) return (setStatus(t('projects.nameRequired'), 'error'), void nameInput?.focus());
    if (!rootPath) return (setStatus(t('projects.dirRequired'), 'error'), void pathBtn?.focus());
    setStatus(t('projects.creating'));
    const result = await window.electronAPI?.invoke('create-project', { name, rootPath, context });
    if (result?.ok && result.project) {
      nameInput && (nameInput.value = '');
      pathInput && (pathInput.value = '');
      contextInput && (contextInput.value = '');
      setStatus(t('projects.created').replace('{name}', result.project.name), 'success');
      await refreshProjects();
      try {
        (await onProjectOpen(result.project)) && close();
      } catch (err) {
        setStatus(t('projects.openFailed').replace('{error}', err.message), 'error');
      } finally {
        createBtn && ((createBtn.disabled = !1), (createBtn.textContent = t('projects.createBtn')));
      }
    } else setStatus(result?.error || t('projects.couldNotCreate'), 'error');
  });
  const closeEdit = () => {
    editBackdrop && editBackdrop.classList.remove('open');
    editingProject = null;
  };
  editCancelBtn?.addEventListener('click', closeEdit);
  editCloseBtn?.addEventListener('click', closeEdit);
  editSaveBtn?.addEventListener('click', async function () {
    if (!editingProject) return;
    const name = editNameInput?.value?.trim() ?? '',
      rootPath = editPathInput?.value?.trim() ?? '',
      context = editContextInput?.value?.trim() ?? '';
    if (!name || !rootPath)
      return void (
        editStatusEl &&
        ((editStatusEl.textContent = t('projects.namePathRequired')),
        (editStatusEl.className = 'project-status error'))
      );
    editStatusEl &&
      ((editStatusEl.textContent = t('projects.saving')),
      (editStatusEl.className = 'project-status'));
    const result = await window.electronAPI?.invoke('update-project', editingProject.id, {
      name,
      rootPath,
      context,
    });
    result?.ok
      ? (editBackdrop && editBackdrop.classList.remove('open'),
        (editingProject = null),
        await refreshProjects())
      : editStatusEl &&
        ((editStatusEl.textContent = result?.error || t('projects.couldNotUpdate')),
        (editStatusEl.className = 'project-status error'));
  });
  editPathBtn?.addEventListener('click', async () => {
    const defaultPath = editPathInput?.value?.trim() || void 0,
      result = await window.electronAPI?.invoke('select-directory', { defaultPath });
    result?.ok && result.path && editPathInput && (editPathInput.value = result.path);
  });
  document.addEventListener('keydown', (event) => {
    'Escape' === event.key && isOpen() && close();
  });
  window.addEventListener('ow:project-changed', () => {
    isOpen() && refreshProjects();
  });
  return {
    open: async function () {
      backdrop.classList.add('open');
      syncModalOpenState();
      setStatus('');
      await refreshProjects();
      requestAnimationFrame(() => nameInput?.focus());
    },
    close,
    isOpen,
    refreshProjects,
  };
}
