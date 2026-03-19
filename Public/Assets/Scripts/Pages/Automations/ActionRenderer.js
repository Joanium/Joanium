// openworld — Pages/Automations/actionRenderer.js
// Renders the dynamic field area for each action type,
// builds complete action rows, and reads form data back out.

import { ACTION_META } from './Constants.js';
import { makeFieldRow, makeConnectorNote } from './FieldBuilders.js';
import {
    appendFolderSubs, appendRunCommandSubs, appendRunScriptSubs,
    appendWriteFileSubs, appendNotifSubs, appendHttpSubs,
    appendGmailSendSubs, appendGithubCheckSubs, appendDeleteWarning,
} from './SubEvents.js';

export function renderActionFields(fieldsEl, type, data = {}) {
    fieldsEl.innerHTML = '';
    const meta = ACTION_META[type];
    if (!meta) return;
    if (meta.group === 'Gmail' || meta.group === 'GitHub')
        fieldsEl.appendChild(makeConnectorNote(meta.group));
    const showLabel = meta.fields.length > 1 || meta.group !== 'System';
    for (const fieldKey of meta.fields)
        fieldsEl.appendChild(makeFieldRow(fieldKey, data[fieldKey] ?? '', !showLabel));
    switch (type) {
        case 'open_folder': appendFolderSubs(fieldsEl, data); break;
        case 'run_command': appendRunCommandSubs(fieldsEl, data); break;
        case 'run_script': appendRunScriptSubs(fieldsEl, data); break;
        case 'write_file': appendWriteFileSubs(fieldsEl, data); break;
        case 'send_notification': appendNotifSubs(fieldsEl, data); break;
        case 'http_request': appendHttpSubs(fieldsEl, data); break;
        case 'gmail_send_email': appendGmailSendSubs(fieldsEl, data); break;
        case 'github_check_prs':
        case 'github_check_issues': appendGithubCheckSubs(fieldsEl, type, data); break;
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
        const og = document.createElement('optgroup');
        og.label = groupName;
        for (const { value, label } of items) {
            const opt = document.createElement('option');
            opt.value = value; opt.textContent = label;
            if (value === action.type) opt.selected = true;
            og.appendChild(opt);
        }
        typeSelect.appendChild(og);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'action-remove-btn';
    removeBtn.title = 'Remove action';
    removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>`;
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
            action.url = get('url'); if (!action.url) return null; break;
        case 'open_multiple_sites':
            action.urls = getVal('urls'); if (!action.urls.trim()) return null; break;
        case 'open_folder':
            action.path = get('path'); if (!action.path) return null;
            action.openTerminal = getCb('sub-open-terminal');
            action.terminalCommand = get('terminalCommand'); break;
        case 'run_command':
            action.command = get('command'); if (!action.command) return null;
            action.silent = getCb('sub-silent'); action.notifyOnFinish = getCb('sub-notify-finish'); break;
        case 'run_script':
            action.scriptPath = get('scriptPath'); if (!action.scriptPath) return null;
            action.args = get('args');
            action.silent = getCb('sub-silent'); action.notifyOnFinish = getCb('sub-notify-finish'); break;
        case 'open_app':
            action.appPath = get('appPath'); if (!action.appPath) return null; break;
        case 'send_notification':
            action.title = get('notifTitle'); if (!action.title) return null;
            action.body = get('notifBody');
            if (getCb('sub-click-url')) action.clickUrl = get('clickUrl'); break;
        case 'copy_to_clipboard':
            action.text = get('text'); if (!action.text) return null; break;
        case 'write_file':
            action.filePath = get('filePath'); if (!action.filePath) return null;
            action.content = getVal('content'); action.append = getCb('sub-append'); break;
        case 'move_file':
        case 'copy_file':
            action.sourcePath = get('sourcePath'); action.destPath = get('destPath');
            if (!action.sourcePath || !action.destPath) return null; break;
        case 'delete_file':
            action.filePath = get('filePath'); if (!action.filePath) return null; break;
        case 'create_folder':
            action.path = get('path'); if (!action.path) return null; break;
        case 'lock_screen': break;
        case 'http_request':
            action.url = get('url'); if (!action.url) return null;
            action.method = get('httpMethod') || 'GET';
            if (getCb('sub-http-headers')) action.headers = getVal('httpHeaders');
            if (getCb('sub-http-body')) action.body = getVal('httpBody');
            action.notify = getCb('sub-http-notify'); break;
        case 'gmail_send_email':
            action.to = get('to'); action.subject = get('subject'); action.body = getVal('gmailBody');
            if (!action.to || !action.subject) return null;
            if (getCb('sub-email-extra')) { action.cc = get('cc'); action.bcc = get('bcc'); } break;
        case 'gmail_get_brief':
            action.maxResults = parseInt(get('maxResults'), 10) || 10; break;
        case 'gmail_get_unread_count': break;
        case 'gmail_search_notify':
            action.query = get('query'); if (!action.query) return null;
            action.maxResults = parseInt(get('maxResults'), 10) || 5; break;
        case 'github_open_repo':
            action.owner = get('owner'); action.repo = get('repo');
            if (!action.owner || !action.repo) return null; break;
        case 'github_check_prs':
        case 'github_check_issues':
            action.owner = get('owner'); action.repo = get('repo');
            if (!action.owner || !action.repo) return null;
            action.state = getCb('sub-filter-state') ? (row.querySelector('[data-field="state"]')?.value || 'open') : 'open'; break;
        case 'github_check_commits':
            action.owner = get('owner'); action.repo = get('repo');
            if (!action.owner || !action.repo) return null;
            action.maxResults = parseInt(get('maxResults'), 10) || 5; break;
        case 'github_check_releases':
            action.owner = get('owner'); action.repo = get('repo');
            if (!action.owner || !action.repo) return null; break;
        case 'github_check_notifs': break;
        case 'github_create_issue':
            action.owner = get('owner'); action.repo = get('repo'); action.issueTitle = get('issueTitle');
            if (!action.owner || !action.repo || !action.issueTitle) return null;
            action.issueBody = getVal('issueBody'); action.labels = get('labels'); break;
        default: return null;
    }
    return action;
}