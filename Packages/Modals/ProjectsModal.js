import { state } from '../System/State.js';
import { escapeHtml } from '../System/Utils.js';
import { syncModalOpenState } from '../Pages/Shared/Core/DOM.js';
export function initProjectsModal({
  onProjectOpen: onProjectOpen = async () => !1,
  onProjectRemoved: onProjectRemoved = async () => {},
  onClose: onClose = () => {},
} = {}) {
  if (!document.getElementById('projects-modal-backdrop')) {
    const wrap = document.createElement('div');
    ((wrap.innerHTML =
      '\n    <div id="projects-modal-backdrop">\n      <div id="projects-panel" role="dialog" aria-modal="true" aria-labelledby="projects-modal-title">\n        <div class="settings-modal-header">\n          <div class="settings-modal-copy">\n            <h2 id="projects-modal-title">Projects</h2>\n            <p class="settings-modal-subtitle">Pin a local folder and the project context the AI should always remember.</p>\n          </div>\n          <button class="settings-modal-close" id="projects-close" type="button" aria-label="Close projects">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n        <div class="settings-modal-body projects-modal-body">\n          <section class="project-create-card">\n            <div class="project-card-header">\n              <div>\n                <h3>Create a project</h3>\n                <p>Local directory is the default workspace for every chat in this project.</p>\n              </div>\n            </div>\n            <label class="project-field">\n              <span class="project-field-label">Project name</span>\n              <input id="project-name-input" type="text" placeholder="My Project" autocomplete="off" spellcheck="false"/>\n            </label>\n            <div class="project-field">\n              <span class="project-field-label">Local directory</span>\n              <div class="project-path-row">\n                <input id="project-path-input" type="text" placeholder="Choose a folder" readonly/>\n                <button id="project-path-btn" class="project-secondary-btn" type="button">Choose folder</button>\n              </div>\n            </div>\n            <label class="project-field">\n              <span class="project-field-label">Project info for the AI</span>\n              <textarea id="project-context-input" rows="5" placeholder="What should the AI keep in mind about this project?"></textarea>\n            </label>\n            <div class="project-create-footer">\n              <div id="project-create-status" class="project-status" aria-live="polite"></div>\n              <button id="project-create-btn" class="project-primary-btn" type="button">Create project</button>\n            </div>\n          </section>\n          <section class="project-list-card">\n            <div class="project-card-header">\n              <div>\n                <h3>Saved projects</h3>\n                <p>Select a project to open its workspace and keep its chats together.</p>\n              </div>\n            </div>\n            <div id="project-list" class="project-list"></div>\n          </section>\n        </div>\n      </div>\n    </div>\n\n    <div id="edit-project-backdrop">\n      <div id="edit-project-panel" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">\n        <div class="settings-modal-header">\n          <div class="settings-modal-copy">\n            <h2 id="edit-project-title">Edit project</h2>\n            <p class="settings-modal-subtitle">Update the context and details for this saved project.</p>\n          </div>\n          <button class="settings-modal-close" id="edit-project-close" type="button" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n        <div class="settings-modal-body edit-project-modal-body" style="padding:24px">\n          <label class="project-field">\n            <span class="project-field-label">Project name</span>\n            <input id="project-edit-name-input" type="text" placeholder="My Project" autocomplete="off" spellcheck="false"/>\n          </label>\n          <div class="project-field" style="margin-top:16px">\n            <span class="project-field-label">Local directory</span>\n            <div class="project-path-row">\n              <input id="project-edit-path-input" type="text" placeholder="Choose a folder" readonly/>\n              <button id="project-edit-path-btn" class="project-secondary-btn" type="button">Choose folder</button>\n            </div>\n          </div>\n          <label class="project-field" style="margin-top:16px">\n            <span class="project-field-label">Project info for the AI</span>\n            <textarea id="project-edit-context-input" rows="5" placeholder="What should the AI keep in mind?"></textarea>\n          </label>\n          <div class="project-create-footer" style="margin-top:24px">\n            <div id="project-edit-status" class="project-status" aria-live="polite"></div>\n            <div style="display:flex;gap:8px">\n              <button id="project-edit-cancel-btn" class="project-secondary-btn" type="button">Cancel</button>\n              <button id="project-edit-save-btn" class="project-primary-btn" type="button">Save changes</button>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <div id="project-missing-backdrop">\n      <div id="project-missing-dialog" role="dialog" aria-modal="true" aria-labelledby="project-missing-title">\n        <div class="project-missing-icon">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n            <path d="M10 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            <path d="M12 11v4M12 18h.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n          </svg>\n        </div>\n        <h3 id="project-missing-title">Project folder not found</h3>\n        <p id="project-missing-copy">This project\'s folder could not be found.</p>\n        <div class="project-missing-actions">\n          <button id="project-missing-cancel" class="project-secondary-btn" type="button">Cancel</button>\n          <button id="project-missing-remove" class="project-danger-btn" type="button">Remove project</button>\n          <button id="project-missing-locate" class="project-primary-btn" type="button">Locate folder</button>\n        </div>\n      </div>\n    </div>\n\n    <div id="global-confirm-backdrop">\n      <div id="global-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="global-confirm-title">\n        <h3 id="global-confirm-title">Confirm</h3>\n        <p id="global-confirm-copy">Are you sure?</p>\n        <div class="global-confirm-actions">\n          <button id="global-confirm-cancel" class="project-secondary-btn" type="button">Cancel</button>\n          <button id="global-confirm-action" class="project-danger-btn" type="button">Confirm</button>\n        </div>\n      </div>\n    </div>\n  '),
      document.body.append(...Array.from(wrap.children)));
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
              const context = project.context?.trim() || 'No saved project notes yet.',
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
              ((item.innerHTML = `\n        <div class="project-item-main">\n          <div class="project-item-head">\n            <div class="project-item-title">${escapeHtml(project.name)}</div>\n            <div class="project-item-badges">\n              ${state.activeProject?.id === project.id ? '<span class="project-badge current">Current</span>' : ''}\n              ${project.folderExists ? '' : '<span class="project-badge missing">Missing folder</span>'}\n            </div>\n          </div>\n          <div class="project-item-path">${escapeHtml(project.rootPath)}</div>\n          <div class="project-item-context">${escapeHtml(context)}</div>\n          <div class="project-item-context">${lastOpened ? `Last opened ${escapeHtml(lastOpened)}` : ''}</div>\n        </div>\n        <div class="project-item-actions">\n          <button class="project-icon-btn project-open-btn" type="button" title="Open project">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>\n          </button>\n          <button class="project-icon-btn project-edit-btn" type="button" title="Edit project">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>\n          </button>\n          <button class="project-icon-btn project-delete-btn" type="button" title="Remove project">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>\n          </button>\n        </div>\n      `),
                item.querySelector('.project-open-btn')?.addEventListener('click', async () => {
                  (await onProjectOpen(project)) && close();
                }),
                item.querySelector('.project-edit-btn')?.addEventListener('click', () => {
                  ((editingProject = project),
                    editNameInput && (editNameInput.value = project.name || ''),
                    editPathInput && (editPathInput.value = project.rootPath || ''),
                    editContextInput && (editContextInput.value = project.context || ''),
                    editStatusEl && (editStatusEl.textContent = ''),
                    editBackdrop && editBackdrop.classList.add('open'));
                }),
                item.querySelector('.project-delete-btn')?.addEventListener('click', async () => {
                  var copy;
                  if (
                    !(await ((copy = `Remove "${project.name}" from Joanium and delete its saved project chats? Your local folder will not be touched.`),
                    new Promise((resolve) => {
                      if (!confirmBackdrop)
                        return resolve(window.confirm(`Remove project\n\n${copy}`));
                      ((confirmTitle.textContent = 'Remove project'),
                        (confirmCopy.textContent = copy),
                        confirmBackdrop.classList.add('open'));
                      const cleanup = () => {
                          (confirmCancel?.removeEventListener('click', onCancel),
                            confirmAction?.removeEventListener('click', onAction),
                            confirmBackdrop.classList.remove('open'));
                        },
                        onCancel = () => {
                          (cleanup(), resolve(!1));
                        },
                        onAction = () => {
                          (cleanup(), resolve(!0));
                        };
                      (confirmCancel?.addEventListener('click', onCancel),
                        confirmAction?.addEventListener('click', onAction));
                    })))
                  )
                    return;
                  const result = await window.electronAPI?.invoke('delete-project', project.id);
                  result?.ok
                    ? (state.activeProject?.id === project.id && (await onProjectRemoved(project)),
                      setStatus(`Removed ${project.name}.`, 'success'),
                      await refreshProjects())
                    : setStatus(result?.error || 'Could not remove the project.', 'error');
                }),
                listEl.appendChild(item));
            }))
          : (listEl.innerHTML =
              '<div class="project-empty">No projects yet. Create one to keep its folder, notes, and chats together.</div>')),
      projects
    );
  }
  function close() {
    (backdrop.classList.remove('open'), syncModalOpenState(), onClose());
  }
  function isOpen() {
    return backdrop.classList.contains('open');
  }
  (closeBtn?.addEventListener('click', close),
    backdrop.addEventListener('click', (event) => {
      event.target === backdrop && close();
    }),
    pathBtn?.addEventListener('click', async function () {
      const defaultPath = pathInput?.value?.trim() || state.activeProject?.rootPath || void 0,
        result = await window.electronAPI?.invoke('select-directory', { defaultPath: defaultPath });
      result?.ok && result.path && pathInput && (pathInput.value = result.path);
    }),
    createBtn?.addEventListener('click', async function () {
      const name = nameInput?.value?.trim() ?? '',
        rootPath = pathInput?.value?.trim() ?? '',
        context = contextInput?.value?.trim() ?? '';
      if (!name) return (setStatus('Project name is required.', 'error'), void nameInput?.focus());
      if (!rootPath)
        return (
          setStatus('Choose a local directory for this project.', 'error'),
          void pathBtn?.focus()
        );
      setStatus('Creating project...');
      const result = await window.electronAPI?.invoke('create-project', {
        name: name,
        rootPath: rootPath,
        context: context,
      });
      if (result?.ok && result.project) {
        (nameInput && (nameInput.value = ''),
          pathInput && (pathInput.value = ''),
          contextInput && (contextInput.value = ''),
          setStatus(`Created ${result.project.name}.`, 'success'),
          await refreshProjects());
        try {
          (await onProjectOpen(result.project)) && close();
        } catch (err) {
          setStatus(`Project created but could not open: ${err.message}`, 'error');
        } finally {
          createBtn && ((createBtn.disabled = !1), (createBtn.textContent = 'Create project'));
        }
      } else setStatus(result?.error || 'Could not create the project.', 'error');
    }));
  const closeEdit = () => {
    (editBackdrop && editBackdrop.classList.remove('open'), (editingProject = null));
  };
  return (
    editCancelBtn?.addEventListener('click', closeEdit),
    editCloseBtn?.addEventListener('click', closeEdit),
    editSaveBtn?.addEventListener('click', async function () {
      if (!editingProject) return;
      const name = editNameInput?.value?.trim() ?? '',
        rootPath = editPathInput?.value?.trim() ?? '',
        context = editContextInput?.value?.trim() ?? '';
      if (!name || !rootPath)
        return void (
          editStatusEl &&
          ((editStatusEl.textContent = 'Name and path are required.'),
          (editStatusEl.className = 'project-status error'))
        );
      editStatusEl &&
        ((editStatusEl.textContent = 'Saving...'), (editStatusEl.className = 'project-status'));
      const result = await window.electronAPI?.invoke('update-project', editingProject.id, {
        name: name,
        rootPath: rootPath,
        context: context,
      });
      result?.ok
        ? (editBackdrop && editBackdrop.classList.remove('open'),
          (editingProject = null),
          await refreshProjects())
        : editStatusEl &&
          ((editStatusEl.textContent = result?.error || 'Could not update the project.'),
          (editStatusEl.className = 'project-status error'));
    }),
    editPathBtn?.addEventListener('click', async () => {
      const defaultPath = editPathInput?.value?.trim() || void 0,
        result = await window.electronAPI?.invoke('select-directory', { defaultPath: defaultPath });
      result?.ok && result.path && editPathInput && (editPathInput.value = result.path);
    }),
    document.addEventListener('keydown', (event) => {
      'Escape' === event.key && isOpen() && close();
    }),
    window.addEventListener('ow:project-changed', () => {
      isOpen() && refreshProjects();
    }),
    {
      open: async function () {
        (backdrop.classList.add('open'),
          syncModalOpenState(),
          setStatus(''),
          await refreshProjects(),
          requestAnimationFrame(() => nameInput?.focus()));
      },
      close: close,
      isOpen: isOpen,
      refreshProjects: refreshProjects,
    }
  );
}
