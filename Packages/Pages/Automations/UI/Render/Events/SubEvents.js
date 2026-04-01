import { makeFieldRow, makeToggleRow } from '../Builders/FieldBuilders.js';

export function appendFolderSubs(fieldsEl, data) {
  const cmdWrap = document.createElement('div');
  cmdWrap.className = 'action-sub-cmd-wrap';
  cmdWrap.appendChild(makeFieldRow('terminalCommand', data.terminalCommand ?? ''));
  fieldsEl.appendChild(makeToggleRow({
    checkClass: 'sub-open-terminal', checked: data.openTerminal ?? false,
    icon: '>', labelText: 'Open terminal here', subEl: cmdWrap,
  }));
}

export function appendRunCommandSubs(fieldsEl, data) {
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-silent', checked: data.silent ?? false, icon: 'mute', labelText: 'Run silently (background, no terminal window)' }));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-notify-finish', checked: data.notifyOnFinish ?? false, icon: 'bell', labelText: 'Send notification when done' }));
}

export function appendRunScriptSubs(fieldsEl, data) {
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-silent', checked: data.silent ?? false, icon: 'mute', labelText: 'Run silently (background, no terminal window)' }));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-notify-finish', checked: data.notifyOnFinish ?? false, icon: 'bell', labelText: 'Send notification when done' }));
}

export function appendWriteFileSubs(fieldsEl, data) {
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-append', checked: data.append ?? false, icon: '+', labelText: 'Append to file (instead of overwrite)' }));
}

export function appendNotifSubs(fieldsEl, data) {
  const urlWrap = document.createElement('div');
  urlWrap.className = 'action-sub-cmd-wrap';
  urlWrap.appendChild(makeFieldRow('clickUrl', data.clickUrl ?? ''));
  fieldsEl.appendChild(makeToggleRow({
    checkClass: 'sub-click-url', checked: !!data.clickUrl,
    icon: 'link', labelText: 'Open URL when notification is clicked', subEl: urlWrap,
  }));
}

export function appendHttpSubs(fieldsEl, data) {
  const headersWrap = document.createElement('div');
  headersWrap.className = 'action-sub-cmd-wrap';
  headersWrap.appendChild(makeFieldRow('httpHeaders', data.headers ?? ''));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-http-headers', checked: !!data.headers, icon: 'hdr', labelText: 'Custom headers', subEl: headersWrap }));

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'action-sub-cmd-wrap';
  bodyWrap.appendChild(makeFieldRow('httpBody', data.body ?? ''));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-http-body', checked: !!data.body, icon: 'body', labelText: 'Request body', subEl: bodyWrap }));
  fieldsEl.appendChild(makeToggleRow({ checkClass: 'sub-http-notify', checked: data.notify ?? false, icon: 'bell', labelText: 'Send notification with response status' }));
}

export function appendDeleteWarning(fieldsEl) {
  const warn = document.createElement('div');
  warn.className = 'action-connector-note';
  warn.style.borderColor = '#f87171';
  warn.textContent = 'This permanently deletes the file. There is no undo.';
  fieldsEl.appendChild(warn);
}
