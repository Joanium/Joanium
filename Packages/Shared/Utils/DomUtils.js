export function formatText(template, replacements) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

export function createElement(tagName, className, text = '') {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function copyToClipboard(text) {
  const value = String(text ?? '');

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(value).catch(() => copyWithExecCommand(value));
  }

  copyWithExecCommand(value);
  return Promise.resolve();
}

export function makeEditableTextarea(textarea) {
  textarea.style.webkitUserSelect = 'text';
  textarea.style.userSelect = 'text';
  textarea.style.cursor = 'text';
}

// The dots that you see when the user is typing or when the system is generating a response. The dots are animated with CSS.
export function createLoadingDots(className = 'chat-message__dots') {
  const dots = createElement('span', className);
  dots.innerHTML = '<span></span><span></span><span></span>';
  return dots;
}

export function setCardFeedback(el, message, tone, baseClass) {
  el.textContent = message;
  el.className = `${baseClass} ${baseClass}--${tone}`;
  el.hidden = !message;
}

export function setupDismissListeners(onClick, onKey) {
  setTimeout(() => {
    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('keydown', onKey);
  }, 0);
  return () => {
    document.removeEventListener('click', onClick, { capture: true });
    document.removeEventListener('keydown', onKey);
  };
}

function copyWithExecCommand(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
  } catch {
    // No further browser clipboard fallback is available.
  } finally {
    textarea.remove();
  }
}
