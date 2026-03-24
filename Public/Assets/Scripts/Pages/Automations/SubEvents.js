// Romelson — Pages/Automations/subEvents.js
// Appends optional sub-section controls to action field areas.

import { makeFieldRow, makeToggleRow } from './FieldBuilders.js';
import { capitalize } from './Utils.js';

export function appendFolderSubs(fieldsEl, data) {
  const cmdWrap = document.createElement('div');
  cmdWrap.className = 'action-sub-cmd-wrap';
  cmdWrap.appendChild(makeFieldRow('terminalCommand', data.terminalCommand ?? ''));
  fieldsEl.appendChild(makeToggleRow({
    checkClass: 'sub-open-terminal', checked: data.openTerminal ?? false,
    icon: '💻', labelText: 'Open terminal here', subEl: cmdWrap,
  }));
}

export function appendRunCommandSubs(fieldsEl, data) {
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-silent', checked: data.silent ?? false, icon: '🔇', labelText: 'Run silently (background, no terminal window)' }));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-notify-finish', checked: data.notifyOnFinish ?? false, icon: '🔔', labelText: 'Send notification when done' }));
}

export function appendRunScriptSubs(fieldsEl, data) {
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-silent', checked: data.silent ?? false, icon: '🔇', labelText: 'Run silently (background, no terminal window)' }));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-notify-finish', checked: data.notifyOnFinish ?? false, icon: '🔔', labelText: 'Send notification when done' }));
}

export function appendWriteFileSubs(fieldsEl, data) {
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-append', checked: data.append ?? false, icon: '➕', labelText: 'Append to file (instead of overwrite)' }));
}

export function appendNotifSubs(fieldsEl, data) {
  const urlWrap = document.createElement('div');
  urlWrap.className = 'action-sub-cmd-wrap';
  urlWrap.appendChild(makeFieldRow('clickUrl', data.clickUrl ?? ''));
  fieldsEl.appendChild(makeToggleRow({
    checkClass: 'sub-click-url', checked: !!(data.clickUrl),
    icon: '🔗', labelText: 'Open URL when notification is clicked', subEl: urlWrap,
  }));
}

export function appendHttpSubs(fieldsEl, data) {
  const headersWrap = document.createElement('div');
  headersWrap.className = 'action-sub-cmd-wrap';
  headersWrap.appendChild(makeFieldRow('httpHeaders', data.headers ?? ''));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-http-headers', checked: !!(data.headers), icon: '📋', labelText: 'Custom headers', subEl: headersWrap }));

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'action-sub-cmd-wrap';
  bodyWrap.appendChild(makeFieldRow('httpBody', data.body ?? ''));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-http-body', checked: !!(data.body), icon: '📄', labelText: 'Request body', subEl: bodyWrap }));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-http-notify', checked: data.notify ?? false, icon: '🔔', labelText: 'Send notification with response status' }));
}

export function appendGmailSendSubs(fieldsEl, data) {
  const ccWrap = document.createElement('div');
  ccWrap.className = 'action-sub-cmd-wrap';
  ccWrap.appendChild(makeFieldRow('cc', data.cc ?? ''));
  ccWrap.appendChild(makeFieldRow('bcc', data.bcc ?? ''));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-email-extra', checked: !!(data.cc || data.bcc), icon: '👥', labelText: 'Add CC / BCC', subEl: ccWrap }));
}

export function appendGithubCheckSubs(fieldsEl, type, data) {
  const stateWrap   = document.createElement('div');
  stateWrap.className = 'action-sub-cmd-wrap';
  const stateSelect = document.createElement('select');
  stateSelect.className = 'action-type-select';
  stateSelect.dataset.field = 'state';
  ['open', 'closed', 'all'].forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = capitalize(s);
    if (s === (data.state || 'open')) o.selected = true;
    stateSelect.appendChild(o);
  });
  const stateRow = document.createElement('div');
  stateRow.className = 'action-field-row';
  const lbl = document.createElement('label');
  lbl.className = 'action-field-label'; lbl.textContent = 'Filter by state';
  stateRow.append(lbl, stateSelect);
  stateWrap.appendChild(stateRow);
  fieldsEl.appendChild(makeToggleRow({
    checkClass: 'sub-filter-state',
    checked: !!(data.state && data.state !== 'open'),
    icon: '🔍', labelText: 'Filter by state (default: open)', subEl: stateWrap,
  }));
}

export function appendDeleteWarning(fieldsEl) {
  const warn = document.createElement('div');
  warn.className = 'action-connector-note';
  warn.style.borderColor = '#f87171';
  warn.textContent = '⚠ This permanently deletes the file. There is no undo.';
  fieldsEl.appendChild(warn);
}