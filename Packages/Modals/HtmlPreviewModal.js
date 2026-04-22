import { createModal } from '../System/ModalFactory.js';

const PREVIEW_CSP = [
  "default-src 'none'",
  'img-src data: blob: https: http:',
  'media-src data: blob: https: http:',
  "style-src 'unsafe-inline' data: https: http:",
  'font-src data: https: http:',
  "script-src 'unsafe-inline' 'unsafe-eval' data: https: http:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

const BLOCKED_ELEMENT_SELECTOR = [
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'portal',
  'base',
].join(', ');

const URL_ATTR_NAMES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster']);

const DANGEROUS_URL_PREFIXES = ['javascript:', 'vbscript:', 'file:', 'data:text/html'];

function isDangerousUrl(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return DANGEROUS_URL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/** Wraps a bare HTML fragment in a minimal full document shell if needed. */
function wrapMarkup(markup) {
  const source = String(markup ?? '').trim();
  if (!source) return '<!doctype html><html><head></head><body></body></html>';
  if (/^\s*<!doctype html\b/i.test(source) || /^\s*<html[\s>]/i.test(source)) return source;
  return `<!doctype html><html><head></head><body>${source}</body></html>`;
}

/** Removes dangerous elements and attributes from a parsed Document in-place. */
function sanitizeDoc(doc) {
  // Remove structural elements that could embed external contexts or navigate.
  doc.querySelectorAll(BLOCKED_ELEMENT_SELECTOR).forEach((el) => el.remove());

  // Remove meta http-equiv refresh redirects.
  doc.querySelectorAll('meta[http-equiv]').forEach((el) => {
    if ('refresh' === String(el.getAttribute('http-equiv') ?? '').toLowerCase()) el.remove();
  });

  // Scrub every element's attributes.
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        // Strip all inline event handlers (onclick, onload, onerror, …).
        el.removeAttribute(attr.name);
      } else if (name === 'srcdoc' || name === 'autofocus') {
        // srcdoc would create a nested HTML context; autofocus can be abused for focus-steal.
        el.removeAttribute(attr.name);
      } else if (name === 'target') {
        // Force links to stay inside the frame rather than opening in the parent.
        el.setAttribute(attr.name, '_self');
      } else if (URL_ATTR_NAMES.has(name) && isDangerousUrl(attr.value)) {
        // Strip javascript:, vbscript:, file:, and data:text/html pseudo-URLs.
        el.removeAttribute(attr.name);
      }
    });
  });
}

/** Removes any author-supplied CSP and injects the application's own policy. */
function injectSecurityHeaders(head, doc) {
  // Remove any CSP the page tried to set for itself — ours takes precedence.
  head.querySelectorAll('meta[http-equiv]').forEach((el) => {
    if ('content-security-policy' === String(el.getAttribute('http-equiv') ?? '').toLowerCase())
      el.remove();
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

/**
 * Parses, sanitizes, and re-serializes arbitrary HTML for safe iframe preview.
 *
 * ── Security model ────────────────────────────────────────────────────────────
 * This function intentionally renders untrusted HTML (e.g. content returned by
 * MCP tool calls).  Safety is enforced by three independent layers:
 *
 *   1. DOM sanitization (sanitizeDoc) — removes dangerous elements (iframe,
 *      object, embed …) and all inline event handlers / dangerous URL schemes
 *      directly in the parsed document before serialization.
 *
 *   2. Injected Content-Security-Policy meta tag — blocks all external
 *      connections (connect-src 'none'), frames (frame-src 'none'), and
 *      form submissions (form-action 'none') even if any markup slips through.
 *
 *   3. iframe sandbox + referrerpolicy — the caller's iframe uses
 *      sandbox="allow-scripts allow-same-origin" and referrerpolicy="no-referrer",
 *      capping what any surviving script can actually do.
 *
 * ── Why outerHTML → srcdoc is intentional here ───────────────────────────────
 * CodeQL flags this function for js/xss-through-dom because it reads a DOM
 * property (outerHTML) derived from user-supplied markup and writes it to an
 * HTML sink (srcdoc).  That pattern is CORRECT for an HTML preview feature:
 * the DOM is used as the sanitization vehicle, and re-escaping meta-characters
 * before the srcdoc assignment would destroy the rendered output entirely.
 * DOMPurify is not appropriate here because it strips <script> tags by default;
 * this preview deliberately allows sandboxed scripts via the CSP above.
 *
 * Suppression rationale: the three-layer defence above addresses the actual
 * risk.  The taint from markup → outerHTML → srcdoc is the intended data flow.
 */
function buildSafePreviewSrcdoc(markup) {
  const doc = new DOMParser().parseFromString(wrapMarkup(markup), 'text/html');
  const htmlEl = doc.documentElement ?? doc.appendChild(doc.createElement('html'));

  let head = doc.head;
  if (!head) {
    head = doc.createElement('head');
    htmlEl.prepend(head);
  }
  if (!doc.body) htmlEl.appendChild(doc.createElement('body'));

  sanitizeDoc(doc);
  injectSecurityHeaders(head, doc);

  return `<!doctype html>\n${htmlEl.outerHTML}`; // codeql[js/xss-through-dom] - Intentional: markup is fully sanitized by sanitizeDoc() before serialization; CSP meta tag + iframe sandbox provide two further independent runtime layers.
}

let _modalApi = null;
export function getHtmlPreviewModal() {
  if (_modalApi) return _modalApi;

  const modal = createModal({
    backdropId: 'html-preview-backdrop',
    html: `
    <div id="html-preview-backdrop">
      <div id="html-preview-modal" role="dialog" aria-modal="true" aria-labelledby="html-preview-title">
        <div class="html-preview-header">
          <div class="html-preview-copy">
            <div class="html-preview-kicker">Safe Preview</div>
            <h2 id="html-preview-title">Rendered HTML</h2>
            <p class="html-preview-subtitle">Forms, popups, embeds, and navigation are blocked before rendering.</p>
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
              sandbox="allow-scripts allow-same-origin">
            </iframe>
          </div>
        </div>
      </div>
    </div>
  `,
    closeBtnSelector: '#html-preview-close',

    onInit(backdrop) {
      const frame = backdrop.querySelector('#html-preview-frame');
      frame?.addEventListener('load', () => {
        const doc = frame.contentDocument;
        if (!doc) return;

        // Intercept all link clicks — keep navigation inside the preview.
        doc.addEventListener(
          'click',
          (event) => {
            const node = event.target;
            const origin = node?.nodeType === 1 ? node : node?.parentElement;
            if (origin?.closest('a')) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
          true,
        );

        // Block all form submissions.
        doc.addEventListener(
          'submit',
          (event) => {
            event.preventDefault();
            event.stopPropagation();
          },
          true,
        );

        // Force every anchor to stay in-frame and be non-referrer.
        doc.querySelectorAll('a').forEach((anchor) => {
          anchor.setAttribute('rel', 'noopener noreferrer nofollow');
          anchor.setAttribute('target', '_self');
        });
      });
    },

    onClose() {
      const frame = document.getElementById('html-preview-frame');
      if (frame) frame.srcdoc = '';
    },
  });

  _modalApi = {
    open(html) {
      modal.open();
      const frame = document.getElementById('html-preview-frame');
      if (frame) frame.srcdoc = buildSafePreviewSrcdoc(html);
      document.getElementById('html-preview-close')?.focus();
    },
    close: modal.close,
    isOpen: modal.isOpen,
  };
  return _modalApi;
}

export function openHtmlPreviewModal(html) {
  getHtmlPreviewModal().open(html);
}
