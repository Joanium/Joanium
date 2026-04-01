import { state } from '../System/State.js';
import { syncModalOpenState } from '../Pages/Shared/Core/DOM.js';

function buildHTML() {
  return /* html */`
    <div id="projects-modal-backdrop">
      <div id="projects-panel" role="dialog" aria-modal="true" aria-labelledby="projects-modal-title">
        <div class="settings-modal-header">
          <div class="settings-modal-copy">
            <h2 id="projects-modal-title">Projects</h2>
            <p class="settings-modal-subtitle">Pin a local folder and the project context the AI should always remember.</p>
          </div>
          <button class="settings-modal-close" id="projects-close" type="button" aria-label="Close projects">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div class="settings-modal-body projects-modal-body">
          <section class="project-create-card">
            <div class="project-card-header">
              <div>
                <h3>Create a project</h3>
                <p>Local directory is the default workspace for every chat in this project.</p>
              </div>
            </div>
            <label class="project-field">
              <span class="project-field-label">Project name</span>
              <input id="project-name-input" type="text" placeholder="My Project" autocomplete="off" spellcheck="false"/>
            </label>
            <div class="project-field">
              <span class="project-field-label">Local directory</span>
              <div class="project-path-row">
                <input id="project-path-input" type="text" placeholder="Choose a folder" readonly/>
                <button id="project-path-btn" class="project-secondary-btn" type="button">Choose folder</button>
              </div>
            </div>
            <label class="project-field">
              <span class="project-field-label">Project info for the AI</span>
              <textarea id="project-context-input" rows="5" placeholder="What should the AI keep in mind about this project?"></textarea>
            </label>
            <div class="project-create-footer">
              <div id="project-create-status" class="project-status" aria-live="polite"></div>
              <button id="project-create-btn" class="project-primary-btn" type="button">Create project</button>
            </div>
          </section>
          <section class="project-list-card">
            <div class="project-card-header">
              <div>
                <h3>Saved projects</h3>
                <p>Select a project to open its workspace and keep its chats together.</p>
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
            <h2 id="edit-project-title">Edit project</h2>
            <p class="settings-modal-subtitle">Update the context and details for this saved project.</p>
          </div>
          <button class="settings-modal-close" id="edit-project-close" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div class="settings-modal-body edit-project-modal-body" style="padding:24px">
          <label class="project-field">
            <span class="project-field-label">Project name</span>
            <input id="project-edit-name-input" type="text" placeholder="My Project" autocomplete="off" spellcheck="false"/>
          </label>
          <div class="project-field" style="margin-top:16px">
            <span class="project-field-label">Local directory</span>
            <div class="project-path-row">
              <input id="project-edit-path-input" type="text" placeholder="Choose a folder" readonly/>
              <button id="project-edit-path-btn" class="project-secondary-btn" type="button">Choose folder</button>
            </div>
          </div>
          <label class="project-field" style="margin-top:16px">
            <span class="project-field-label">Project info for the AI</span>
            <textarea id="project-edit-context-input" rows="5" placeholder="What should the AI keep in mind?"></textarea>
          </label>
          <div class="project-create-footer" style="margin-top:24px">
            <div id="project-edit-status" class="project-status" aria-live="polite"></div>
            <div style="display:flex;gap:8px">
              <button id="project-edit-cancel-btn" class="project-secondary-btn" type="button">Cancel</button>
              <button id="project-edit-save-btn" class="project-primary-btn" type="button">Save changes</button>
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
        <h3 id="project-missing-title">Project folder not found</h3>
        <p id="project-missing-copy">This project's folder could not be found.</p>
        <div class="project-missing-actions">
          <button id="project-missing-cancel" class="project-secondary-btn" type="button">Cancel</button>
          <button id="project-missing-remove" class="project-danger-btn" type="button">Remove project</button>
          <button id="project-missing-locate" class="project-primary-btn" type="button">Locate folder</button>
        </div>
      </div>
    </div>

    <div id="global-confirm-backdrop">
      <div id="global-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="global-confirm-title">
        <h3 id="global-confirm-title">Confirm</h3>
        <p id="global-confirm-copy">Are you sure?</p>
        <div class="global-confirm-actions">
          <button id="global-confirm-cancel" class="project-secondary-btn" type="button">Cancel</button>
          <button id="global-confirm-action" class="project-danger-btn" type="button">Confirm</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRelativeDate(isoString) {
  if (!isoString) return '';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < hour) return 'Just now';
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  if (diff < 7 * day) return `${Math.max(1, Math.round(diff / day))}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function initProjectsModal({
  onProjectOpen = async () => false,
  onProjectRemoved = async () => { },
  onClose = () => { },
} = {}) {
  if (!document.getElementById('projects-modal-backdrop')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildHTML();
    document.body.append(...Array.from(wrap.children));
  }

  const backdrop = document.getElementById('projects-modal-backdrop');
  const closeBtn = document.getElementById('projects-close');
  const listEl = document.getElementById('project-list');
  const nameInput = document.getElementById('project-name-input');
  const pathInput = document.getElementById('project-path-input');
  const contextInput = document.getElementById('project-context-input');
  const pathBtn = document.getElementById('project-path-btn');
  const createBtn = document.getElementById('project-create-btn');
  const statusEl = document.getElementById('project-create-status');

  const editBackdrop = document.getElementById('edit-project-backdrop');
  const editCloseBtn = document.getElementById('edit-project-close');
  const editNameInput = document.getElementById('project-edit-name-input');
  const editPathInput = document.getElementById('project-edit-path-input');
  const editContextInput = document.getElementById('project-edit-context-input');
  const editPathBtn = document.getElementById('project-edit-path-btn');
  const editSaveBtn = document.getElementById('project-edit-save-btn');
  const editCancelBtn = document.getElementById('project-edit-cancel-btn');
  const editStatusEl = document.getElementById('project-edit-status');

  const confirmBackdrop = document.getElementById('global-confirm-backdrop');
  const confirmTitle = document.getElementById('global-confirm-title');
  const confirmCopy = document.getElementById('global-confirm-copy');
  const confirmCancel = document.getElementById('global-confirm-cancel');
  const confirmAction = document.getElementById('global-confirm-action');

  if (!backdrop || !listEl) {
    return {
      open() { },
      close() { },
      isOpen: () => false,
      refreshProjects: async () => [],
    };
  }

  let projects = [];
  let editingProject = null;

  function showConfirm(title, copy) {
    return new Promise((resolve) => {
      if (!confirmBackdrop) return resolve(window.confirm(`${title}\n\n${copy}`));
      confirmTitle.textContent = title;
      confirmCopy.textContent = copy;
      confirmBackdrop.classList.add('open');

      const cleanup = () => {
        confirmCancel?.removeEventListener('click', onCancel);
        confirmAction?.removeEventListener('click', onAction);
        confirmBackdrop.classList.remove('open');
      };

      const onCancel = () => { cleanup(); resolve(false); };
      const onAction = () => { cleanup(); resolve(true); };

      confirmCancel?.addEventListener('click', onCancel);
      confirmAction?.addEventListener('click', onAction);
    });
  }

  function setStatus(message = '', tone = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `project-status${tone ? ` ${tone}` : ''}`;
  }

  function clearForm() {
    if (nameInput) nameInput.value = '';
    if (pathInput) pathInput.value = '';
    if (contextInput) contextInput.value = '';
  }

  async function chooseFolder() {
    const defaultPath = pathInput?.value?.trim() || state.activeProject?.rootPath || undefined;
    const result = await window.electronAPI?.selectDirectory?.({ defaultPath });
    if (result?.ok && result.path && pathInput) {
      pathInput.value = result.path;
    }
  }

  function renderProjectList() {
    if (!listEl) return;

    if (!projects.length) {
      listEl.innerHTML = '<div class="project-empty">No projects yet. Create one to keep its folder, notes, and chats together.</div>';
      return;
    }

    listEl.innerHTML = '';

    projects.forEach(project => {
      const item = document.createElement('article');
      item.className = `project-item${state.activeProject?.id === project.id ? ' active' : ''}${project.folderExists ? '' : ' is-missing'}`;

      const context = project.context?.trim() || 'No saved project notes yet.';
      const lastOpened = formatRelativeDate(project.lastOpenedAt ?? project.updatedAt);

      item.innerHTML = `
        <div class="project-item-main">
          <div class="project-item-head">
            <div class="project-item-title">${escapeHtml(project.name)}</div>
            <div class="project-item-badges">
              ${state.activeProject?.id === project.id ? '<span class="project-badge current">Current</span>' : ''}
              ${project.folderExists ? '' : '<span class="project-badge missing">Missing folder</span>'}
            </div>
          </div>
          <div class="project-item-path">${escapeHtml(project.rootPath)}</div>
          <div class="project-item-context">${escapeHtml(context)}</div>
          <div class="project-item-context">${lastOpened ? `Last opened ${escapeHtml(lastOpened)}` : ''}</div>
        </div>
        <div class="project-item-actions">
          <button class="project-icon-btn project-open-btn" type="button" title="Open project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="project-icon-btn project-edit-btn" type="button" title="Edit project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="project-icon-btn project-delete-btn" type="button" title="Remove project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `;

      item.querySelector('.project-open-btn')?.addEventListener('click', async () => {
        const opened = await onProjectOpen(project);
        if (opened) close();
      });

      item.querySelector('.project-edit-btn')?.addEventListener('click', () => {
        editingProject = project;
        if (editNameInput) editNameInput.value = project.name || '';
        if (editPathInput) editPathInput.value = project.rootPath || '';
        if (editContextInput) editContextInput.value = project.context || '';
        if (editStatusEl) editStatusEl.textContent = '';
        if (editBackdrop) editBackdrop.classList.add('open');
      });

      item.querySelector('.project-delete-btn')?.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          'Remove project',
          `Remove "${project.name}" from Joanium and delete its saved project chats? Your local folder will not be touched.`
        );
        if (!confirmed) return;

        const result = await window.electronAPI?.deleteProject?.(project.id);
        if (!result?.ok) {
          setStatus(result?.error || 'Could not remove the project.', 'error');
          return;
        }

        if (state.activeProject?.id === project.id) {
          await onProjectRemoved(project);
        }

        setStatus(`Removed ${project.name}.`, 'success');
        await refreshProjects();
      });

      listEl.appendChild(item);
    });
  }

  async function refreshProjects() {
    try {
      projects = (await window.electronAPI?.getProjects?.()) ?? [];
    } catch {
      projects = [];
    }
    renderProjectList();
    return projects;
  }

  async function handleCreate() {
    const name = nameInput?.value?.trim() ?? '';
    const rootPath = pathInput?.value?.trim() ?? '';
    const context = contextInput?.value?.trim() ?? '';

    if (!name) {
      setStatus('Project name is required.', 'error');
      nameInput?.focus();
      return;
    }

    if (!rootPath) {
      setStatus('Choose a local directory for this project.', 'error');
      pathBtn?.focus();
      return;
    }

    setStatus('Creating project...');
    const result = await window.electronAPI?.createProject?.({ name, rootPath, context });
    if (!result?.ok || !result.project) {
      setStatus(result?.error || 'Could not create the project.', 'error');
      return;
    }

    clearForm();
    setStatus(`Created ${result.project.name}.`, 'success');
    await refreshProjects();
    try {
      const opened = await onProjectOpen(result.project);
      if (opened) close();
    } catch (err) {
      setStatus(`Project created but could not open: ${err.message}`, 'error');
    } finally {
      if (createBtn) { createBtn.disabled = false; createBtn.textContent = 'Create project'; }
    }
  }

  async function handleEditSave() {
    if (!editingProject) return;
    const name = editNameInput?.value?.trim() ?? '';
    const rootPath = editPathInput?.value?.trim() ?? '';
    const context = editContextInput?.value?.trim() ?? '';

    if (!name || !rootPath) {
      if (editStatusEl) {
        editStatusEl.textContent = 'Name and path are required.';
        editStatusEl.className = 'project-status error';
      }
      return;
    }

    if (editStatusEl) {
      editStatusEl.textContent = 'Saving...';
      editStatusEl.className = 'project-status';
    }

    const result = await window.electronAPI?.updateProject?.(editingProject.id, { name, rootPath, context });
    if (!result?.ok) {
      if (editStatusEl) {
        editStatusEl.textContent = result?.error || 'Could not update the project.';
        editStatusEl.className = 'project-status error';
      }
      return;
    }

    if (editBackdrop) editBackdrop.classList.remove('open');
    editingProject = null;
    await refreshProjects();
  }

  async function open() {
    backdrop.classList.add('open');
    syncModalOpenState();
    setStatus('');
    await refreshProjects();
    requestAnimationFrame(() => nameInput?.focus());
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
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) close();
  });
  pathBtn?.addEventListener('click', chooseFolder);
  createBtn?.addEventListener('click', handleCreate);

  const closeEdit = () => {
    if (editBackdrop) editBackdrop.classList.remove('open');
    editingProject = null;
  };

  editCancelBtn?.addEventListener('click', closeEdit);
  editCloseBtn?.addEventListener('click', closeEdit);

  editSaveBtn?.addEventListener('click', handleEditSave);
  editPathBtn?.addEventListener('click', async () => {
    const defaultPath = editPathInput?.value?.trim() || undefined;
    const result = await window.electronAPI?.selectDirectory?.({ defaultPath });
    if (result?.ok && result.path && editPathInput) {
      editPathInput.value = result.path;
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) close();
  });

  window.addEventListener('ow:project-changed', () => {
    if (isOpen()) refreshProjects();
  });

  return {
    open,
    close,
    isOpen,
    refreshProjects,
  };
}
