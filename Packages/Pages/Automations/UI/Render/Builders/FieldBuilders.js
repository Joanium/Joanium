import { FIELD_META, FIELD_LABELS } from '../Config/Constants.js';
import { escapeHtml } from '../Utils/Utils.js';

export function makeField(fieldKey, value = '') {
  const meta = FIELD_META[fieldKey] ?? { placeholder: '', textarea: false };
  let el;

  if (meta.type === 'checkbox') {
    el = document.createElement('input');
    el.type = 'checkbox';
    el.className = 'action-value-checkbox';
    el.checked = Boolean(value);
  } else if (meta.type === 'select') {
    el = document.createElement('select');
    el.className = 'action-type-select';
    (meta.options || []).forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (String(opt) === String(value || meta.options?.[0] || '')) option.selected = true;
      el.appendChild(option);
    });
  } else if (meta.textarea) {
    el = document.createElement('textarea');
    el.className = 'action-value-textarea';
    el.rows = meta.rows ?? 3;
    el.placeholder = meta.placeholder ?? '';
    el.value = value;
  } else {
    el = document.createElement('input');
    el.type = meta.type === 'number' ? 'number' : 'text';
    el.className = 'action-value-input';
    el.placeholder = meta.placeholder ?? '';
    if (meta.min != null) el.min = String(meta.min);
    if (meta.max != null) el.max = String(meta.max);
    el.value = value;
  }

  el.dataset.field = fieldKey;
  return el;
}

export function makeFieldRow(fieldKey, value = '', hideLabel = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'action-field-row';
  if (!hideLabel) {
    const label = document.createElement('label');
    label.className = 'action-field-label';
    label.textContent = FIELD_LABELS[fieldKey] ?? fieldKey;
    wrapper.appendChild(label);
  }
  wrapper.appendChild(makeField(fieldKey, value));
  return wrapper;
}

export function makeToggleRow({ checkClass, checked = false, icon = '', labelText, subEl = null }) {
  const wrap = document.createElement('div');
  wrap.className = 'action-sub-event';
  const label = document.createElement('label');
  label.className = 'action-sub-toggle';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = `action-sub-check ${checkClass}`;
  if (checked) cb.checked = true;
  const span = document.createElement('span');
  span.className = 'action-sub-toggle-text';
  span.innerHTML = icon ? `${icon} ${escapeHtml(labelText)}` : escapeHtml(labelText);
  label.append(cb, span);
  wrap.appendChild(label);
  if (subEl) {
    if (!checked) subEl.classList.add('hidden');
    cb.addEventListener('change', () => subEl.classList.toggle('hidden', !cb.checked));
    wrap.appendChild(subEl);
  }
  return wrap;
}

export function makeConnectorNote(group) {
  const warn = document.createElement('div');
  warn.className = 'action-connector-note';
  warn.textContent = `Requires ${group} connected in Settings -> Connectors`;
  return warn;
}
