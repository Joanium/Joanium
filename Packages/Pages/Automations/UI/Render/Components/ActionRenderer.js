import { ACTION_META, FIELD_META } from '../Config/Constants.js';
import { makeFieldRow, makeConnectorNote } from '../Builders/FieldBuilders.js';
import {
  appendFolderSubs, appendRunCommandSubs, appendRunScriptSubs,
  appendWriteFileSubs, appendNotifSubs, appendHttpSubs,
  appendDeleteWarning,
} from '../Events/SubEvents.js';

function parseGenericFieldValue(fieldKey, input) {
  const meta = FIELD_META[fieldKey] ?? {};
  if (!input) return undefined;

  if (meta.type === 'checkbox') return Boolean(input.checked);
  if (meta.type === 'number') {
    if (input.value === '') return undefined;
    const parsed = parseInt(input.value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  const rawValue = meta.textarea ? input.value : input.value?.trim?.() ?? input.value;
  if (meta.parse === 'json') {
    if (!String(rawValue ?? '').trim()) return undefined;
    try {
      return JSON.parse(rawValue);
    } catch {
      return null;
    }
  }

  if (typeof rawValue === 'string' && rawValue.trim() === '') return undefined;
  return rawValue;
}

function collectGenericAction(row, type) {
  const meta = ACTION_META[type];
  if (!meta) return null;

  const action = { type };
  const requiredFields = new Set(meta.requiredFields ?? meta.fields ?? []);

  for (const fieldKey of meta.fields ?? []) {
    const input = row.querySelector(`[data-field="${fieldKey}"]`);
    const value = parseGenericFieldValue(fieldKey, input);
    if (value === null) return null;
    if (requiredFields.has(fieldKey) && (value == null || value === '')) return null;
    if (value !== undefined) action[fieldKey] = value;
  }

  return action;
}

export function renderActionFields(fieldsEl, type, data = {}) {
  fieldsEl.innerHTML = '';
  const meta = ACTION_META[type];
  if (!meta) return;
  if (meta.group !== 'System') fieldsEl.appendChild(makeConnectorNote(meta.group));
  const showLabel = meta.fields.length > 1 || meta.group !== 'System';
  for (const fieldKey of meta.fields) {
    fieldsEl.appendChild(makeFieldRow(fieldKey, data[fieldKey] ?? '', !showLabel));
  }

  switch (type) {
    case 'open_folder': appendFolderSubs(fieldsEl, data); break;
    case 'run_command': appendRunCommandSubs(fieldsEl, data); break;
    case 'run_script': appendRunScriptSubs(fieldsEl, data); break;
    case 'write_file': appendWriteFileSubs(fieldsEl, data); break;
    case 'send_notification': appendNotifSubs(fieldsEl, data); break;
    case 'http_request': appendHttpSubs(fieldsEl, data); break;
    case 'delete_file': appendDeleteWarning(fieldsEl); break;
    default: break;
  }
}

export function createActionRow(action = { type: 'open_site' }) {
  const row = document.createElement('div');
  row.className = 'action-row';

  const topBar = document.createElement('div');
  topBar.className = 'action-row-top';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'action-type-select';

  const groups = {};
  for (const [value, meta] of Object.entries(ACTION_META)) {
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push({ value, label: meta.label });
  }
  for (const [groupName, items] of Object.entries(groups)) {
    const group = document.createElement('optgroup');
    group.label = groupName;
    for (const { value, label } of items) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (value === action.type) option.selected = true;
      group.appendChild(option);
    }
    typeSelect.appendChild(group);
  }

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'action-remove-btn';
  removeBtn.title = 'Remove action';
  removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>';
  removeBtn.addEventListener('click', () => row.remove());

  topBar.append(typeSelect, removeBtn);

  const fieldsArea = document.createElement('div');
  fieldsArea.className = 'action-fields';
  renderActionFields(fieldsArea, action.type, action);
  typeSelect.addEventListener('change', () => renderActionFields(fieldsArea, typeSelect.value, {}));

  row.append(topBar, fieldsArea);
  return row;
}

export function collectActionFromRow(row) {
  const type = row.querySelector('.action-type-select')?.value;
  if (!type) return null;
  const get = field => row.querySelector(`[data-field="${field}"]`)?.value?.trim() ?? '';
  const getVal = field => row.querySelector(`[data-field="${field}"]`)?.value ?? '';
  const getCb = cls => row.querySelector(`.${cls}`)?.checked ?? false;
  const action = { type };

  switch (type) {
    case 'open_site':
      action.url = get('url'); if (!action.url) return null; return action;
    case 'open_multiple_sites':
      action.urls = getVal('urls'); if (!action.urls.trim()) return null; return action;
    case 'open_folder':
      action.path = get('path'); if (!action.path) return null;
      action.openTerminal = getCb('sub-open-terminal');
      action.terminalCommand = get('terminalCommand'); return action;
    case 'run_command':
      action.command = get('command'); if (!action.command) return null;
      action.silent = getCb('sub-silent'); action.notifyOnFinish = getCb('sub-notify-finish'); return action;
    case 'run_script':
      action.scriptPath = get('scriptPath'); if (!action.scriptPath) return null;
      action.args = get('args'); action.silent = getCb('sub-silent'); action.notifyOnFinish = getCb('sub-notify-finish'); return action;
    case 'open_app':
      action.appPath = get('appPath'); if (!action.appPath) return null; return action;
    case 'send_notification':
      action.title = get('notifTitle'); if (!action.title) return null;
      action.body = get('notifBody');
      if (getCb('sub-click-url')) action.clickUrl = get('clickUrl');
      return action;
    case 'copy_to_clipboard':
      action.text = get('text'); if (!action.text) return null; return action;
    case 'write_file':
      action.filePath = get('filePath'); if (!action.filePath) return null;
      action.content = getVal('content'); action.append = getCb('sub-append'); return action;
    case 'move_file':
    case 'copy_file':
      action.sourcePath = get('sourcePath'); action.destPath = get('destPath');
      if (!action.sourcePath || !action.destPath) return null; return action;
    case 'delete_file':
      action.filePath = get('filePath'); if (!action.filePath) return null; return action;
    case 'create_folder':
      action.path = get('path'); if (!action.path) return null; return action;
    case 'lock_screen':
      return action;
    case 'http_request':
      action.url = get('url'); if (!action.url) return null;
      action.method = get('httpMethod') || 'GET';
      if (getCb('sub-http-headers')) action.headers = getVal('httpHeaders');
      if (getCb('sub-http-body')) action.body = getVal('httpBody');
      action.notify = getCb('sub-http-notify');
      return action;
    default:
      return collectGenericAction(row, type);
  }
}
