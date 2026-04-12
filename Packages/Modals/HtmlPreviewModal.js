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
  ].join('; '),
  BLOCKED_ELEMENT_SELECTOR = [
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'portal',
    'base',
  ].join(', '),
  URL_ATTR_NAMES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster']);
let _modalApi = null;
export function getHtmlPreviewModal() {
  if (_modalApi) return _modalApi;
  const modal = createModal({
    backdropId: 'html-preview-backdrop',
    html: '\n    <div id="html-preview-backdrop">\n      <div id="html-preview-modal" role="dialog" aria-modal="true" aria-labelledby="html-preview-title">\n        <div class="html-preview-header">\n          <div class="html-preview-copy">\n            <div class="html-preview-kicker">Safe Preview</div>\n            <h2 id="html-preview-title">Rendered HTML</h2>\n            <p class="html-preview-subtitle">Forms, popups, embeds, and navigation are blocked before rendering.</p>\n          </div>\n          <button class="settings-modal-close html-preview-close" id="html-preview-close" type="button" aria-label="Close HTML preview">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">\n              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>\n            </svg>\n          </button>\n        </div>\n        <div class="html-preview-body">\n          <div class="html-preview-toolbar">\n            <span class="html-preview-badge">Sandboxed iframe</span>\n            <span class="html-preview-note">Links stay inside the preview and are disabled.</span>\n          </div>\n          <div class="html-preview-frame-shell">\n            <iframe\n              id="html-preview-frame"\n              title="Rendered HTML preview"\n              referrerpolicy="no-referrer"\n              sandbox="allow-scripts allow-same-origin">\n            </iframe>\n          </div>\n        </div>\n      </div>\n    </div>\n  ',
    closeBtnSelector: '#html-preview-close',
    onInit(backdrop) {
      const frame = backdrop.querySelector('#html-preview-frame');
      frame?.addEventListener('load', () =>
        (function (frame) {
          const doc = frame.contentDocument;
          doc &&
            (doc.addEventListener(
              'click',
              (event) => {
                (function (node) {
                  const origin = 1 === node?.nodeType ? node : node?.parentElement;
                  return origin?.closest('a') ?? null;
                })(event.target) && (event.preventDefault(), event.stopPropagation());
              },
              !0,
            ),
            doc.addEventListener(
              'submit',
              (event) => {
                (event.preventDefault(), event.stopPropagation());
              },
              !0,
            ),
            doc.querySelectorAll('a').forEach((anchor) => {
              (anchor.setAttribute('rel', 'noopener noreferrer nofollow'),
                anchor.setAttribute('target', '_self'));
            }));
        })(frame),
      );
    },
    onClose() {
      const frame = document.getElementById('html-preview-frame');
      frame && (frame.srcdoc = '');
    },
  });
  return (
    (_modalApi = {
      open(html) {
        modal.open();
        const f = document.getElementById('html-preview-frame');
        f &&
          (f.srcdoc = (function (markup) {
            const doc = new DOMParser().parseFromString(
                (function (markup) {
                  const source = String(markup ?? '').trim();
                  return source
                    ? /^\s*<!doctype html\b/i.test(source) || /^\s*<html[\s>]/i.test(source)
                      ? source
                      : `<!doctype html><html><head></head><body>${source}</body></html>`
                    : '<!doctype html><html><head></head><body></body></html>';
                })(markup),
                'text/html',
              ),
              htmlEl = doc.documentElement || doc.appendChild(doc.createElement('html'));
            let head = doc.head;
            head || ((head = doc.createElement('head')), htmlEl.prepend(head));
            let body = doc.body;
            return (
              body || ((body = doc.createElement('body')), htmlEl.appendChild(body)),
              doc.querySelectorAll(BLOCKED_ELEMENT_SELECTOR).forEach((el) => el.remove()),
              doc.querySelectorAll('meta[http-equiv]').forEach((el) => {
                'refresh' === String(el.getAttribute('http-equiv') ?? '').toLowerCase() &&
                  el.remove();
              }),
              doc.querySelectorAll('*').forEach((el) =>
                (function (el) {
                  Array.from(el.attributes).forEach((attr) => {
                    const name = attr.name.toLowerCase();
                    name.startsWith('on')
                      ? el.removeAttribute(attr.name)
                      : 'srcdoc' !== name && 'autofocus' !== name
                        ? 'target' !== name
                          ? URL_ATTR_NAMES.has(name) &&
                            (function (value) {
                              const normalized = String(value ?? '')
                                .trim()
                                .toLowerCase();
                              return (
                                normalized.startsWith('javascript:') ||
                                normalized.startsWith('vbscript:') ||
                                normalized.startsWith('file:') ||
                                normalized.startsWith('data:text/html')
                              );
                            })(attr.value) &&
                            el.removeAttribute(attr.name)
                          : el.setAttribute(attr.name, '_self')
                        : el.removeAttribute(attr.name);
                  });
                })(el),
              ),
              (function (head, doc) {
                if (
                  (head.querySelectorAll('meta[http-equiv]').forEach((el) => {
                    'content-security-policy' ===
                      String(el.getAttribute('http-equiv') ?? '').toLowerCase() && el.remove();
                  }),
                  !head.querySelector('meta[charset]'))
                ) {
                  const charset = doc.createElement('meta');
                  (charset.setAttribute('charset', 'utf-8'), head.prepend(charset));
                }
                if (!head.querySelector('meta[name="viewport"]')) {
                  const viewport = doc.createElement('meta');
                  (viewport.setAttribute('name', 'viewport'),
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1'),
                    head.prepend(viewport));
                }
                const csp = doc.createElement('meta');
                ((csp.httpEquiv = 'Content-Security-Policy'),
                  (csp.content = PREVIEW_CSP),
                  head.prepend(csp));
              })(head, doc),
              `<!doctype html>\n${htmlEl.outerHTML}`
            );
          })(html));
        const closeBtn = document.getElementById('html-preview-close');
        closeBtn?.focus();
      },
      close: modal.close,
      isOpen: modal.isOpen,
    }),
    _modalApi
  );
}
export function openHtmlPreviewModal(html) {
  getHtmlPreviewModal().open(html);
}
