import { syncModalOpenState } from '../Pages/Shared/Core/DOM.js';

const PREVIEW_CSP = [
  "default-src 'none'",
  "img-src data: blob: https: http:",
  "media-src data: blob: https: http:",
  "style-src 'unsafe-inline' data: https: http:",
  "font-src data: https: http:",
  "script-src 'none'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

const BLOCKED_ELEMENT_SELECTOR = [
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'portal',
  'base',
].join(', ');

const URL_ATTR_NAMES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster']);

let _modalApi = null;

function buildHTML() {
  return /* html */`
    <div id="html-preview-backdrop">
      <div id="html-preview-modal" role="dialog" aria-modal="true" aria-labelledby="html-preview-title">
        <div class="html-preview-header">
          <div class="html-preview-copy">
            <div class="html-preview-kicker">Safe Preview</div>
            <h2 id="html-preview-title">Rendered HTML</h2>
            <p class="html-preview-subtitle">Scripts, forms, popups, embeds, and navigation are blocked before rendering.</p>
          </div>
          <button class="settings-modal-close html-preview-close" id="html-preview-close" type="button" aria-label="Close HTML preview">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
            </svg>
          </button>
        </div>
        <div class="html-preview-body">
          <div class="html-preview-toolbar">
            <span class="html-preview-badge">Sandboxed iframe</span>
            <span class="html-preview-note">Links stay inside the preview and are disabled.</span>
          </div>
          <div class="html-preview-frame-shell">
            <iframe
              id="html-preview-frame"
              title="Rendered HTML preview"
              referrerpolicy="no-referrer"
              sandbox="allow-same-origin">
            </iframe>
          </div>
        </div>
      </div>
    </div>
  `;
}

function ensureModalElements() {
  if (document.getElementById('html-preview-backdrop')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = buildHTML();
  document.body.appendChild(wrap.firstElementChild);
}

function ensureHtmlDocument(markup) {
  const source = String(markup ?? '').trim();
  if (!source) {
    return '<!doctype html><html><head></head><body></body></html>';
  }

  if (/^\s*<!doctype html\b/i.test(source) || /^\s*<html[\s>]/i.test(source)) {
    return source;
  }

  return `<!doctype html><html><head></head><body>${source}</body></html>`;
}

function isBlockedUrl(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.startsWith('javascript:')
    || normalized.startsWith('vbscript:')
    || normalized.startsWith('file:')
    || normalized.startsWith('data:text/html');
}

function sanitizeAttributes(el) {
  Array.from(el.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    const value = attr.value;

    if (name.startsWith('on')) {
      el.removeAttribute(attr.name);
      return;
    }

    if (name === 'srcdoc' || name === 'autofocus') {
      el.removeAttribute(attr.name);
      return;
    }

    if (name === 'target') {
      el.setAttribute(attr.name, '_self');
      return;
    }

    if (URL_ATTR_NAMES.has(name) && isBlockedUrl(value)) {
      el.removeAttribute(attr.name);
    }
  });
}

function addSafetyMeta(head, doc) {
  head.querySelectorAll('meta[http-equiv]').forEach((el) => {
    const value = String(el.getAttribute('http-equiv') ?? '').toLowerCase();
    if (value === 'content-security-policy') el.remove();
  });

  if (!head.querySelector('meta[charset]')) {
    const charset = doc.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    head.prepend(charset);
  }

  if (!head.querySelector('meta[name="viewport"]')) {
    const viewport = doc.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    viewport.setAttribute('content', 'width=device-width, initial-scale=1');
    head.prepend(viewport);
  }

  const csp = doc.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content = PREVIEW_CSP;
  head.prepend(csp);
}

function sanitizePreviewHtml(markup) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(ensureHtmlDocument(markup), 'text/html');
  const htmlEl = doc.documentElement || doc.appendChild(doc.createElement('html'));

  let head = doc.head;
  if (!head) {
    head = doc.createElement('head');
    htmlEl.prepend(head);
  }

  let body = doc.body;
  if (!body) {
    body = doc.createElement('body');
    htmlEl.appendChild(body);
  }

  doc.querySelectorAll(BLOCKED_ELEMENT_SELECTOR).forEach((el) => el.remove());
  doc.querySelectorAll('meta[http-equiv]').forEach((el) => {
    const value = String(el.getAttribute('http-equiv') ?? '').toLowerCase();
    if (value === 'refresh') el.remove();
  });
  doc.querySelectorAll('*').forEach((el) => sanitizeAttributes(el));
  addSafetyMeta(head, doc);

  return `<!doctype html>\n${htmlEl.outerHTML}`;
}

function closestElement(node, selector) {
  const origin = node?.nodeType === 1 ? node : node?.parentElement;
  return origin?.closest(selector) ?? null;
}

function hardenPreviewFrame(frame) {
  const doc = frame.contentDocument;
  if (!doc) return;

  doc.addEventListener('click', (event) => {
    const anchor = closestElement(event.target, 'a');
    if (!anchor) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  doc.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, true);

  doc.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('rel', 'noopener noreferrer nofollow');
    anchor.setAttribute('target', '_self');
  });
}

export function getHtmlPreviewModal() {
  if (_modalApi) return _modalApi;

  ensureModalElements();

  const backdrop = document.getElementById('html-preview-backdrop');
  const closeBtn = document.getElementById('html-preview-close');
  const frame = document.getElementById('html-preview-frame');

  const close = () => {
    backdrop?.classList.remove('open');
    if (frame) frame.srcdoc = '';
    syncModalOpenState();
  };

  const open = (html) => {
    if (frame) {
      frame.srcdoc = sanitizePreviewHtml(html);
    }
    backdrop?.classList.add('open');
    syncModalOpenState();
    closeBtn?.focus();
  };

  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  frame?.addEventListener('load', () => hardenPreviewFrame(frame));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop?.classList.contains('open')) {
      close();
    }
  });

  _modalApi = {
    open,
    close,
    isOpen: () => backdrop?.classList.contains('open') ?? false,
  };

  return _modalApi;
}

export function openHtmlPreviewModal(html) {
  getHtmlPreviewModal().open(html);
}
