import { WebContentsView } from 'electron';
import { EventEmitter } from 'events';
export const BUILTIN_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const CHROME_CLIENT_HINTS = '"Not(A:Brand";v="99", "Google Chrome";v="134", "Chromium";v="134"',
  NAVIGATION_ACCEPT =
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
function getRegistrableDomain(hostname = '') {
  const parts = String(hostname).split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const tld = parts[parts.length - 1],
    sld = parts[parts.length - 2],
    thirdLevel = parts[parts.length - 3];
  return 2 === tld.length && ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac'].includes(sld)
    ? `${thirdLevel}.${sld}.${tld}`
    : `${sld}.${tld}`;
}
function getFetchSite(url = '', initiator = '') {
  try {
    if (!initiator || 'null' === initiator) return 'none';
    const target = new URL(url),
      source = new URL(initiator);
    return target.origin === source.origin
      ? 'same-origin'
      : getRegistrableDomain(target.hostname) === getRegistrableDomain(source.hostname)
        ? 'same-site'
        : 'cross-site';
  } catch {
    return initiator ? 'cross-site' : 'none';
  }
}
function buildExtraHeaders(url, referrer = '') {
  const fetchSite = referrer ? getFetchSite(url, referrer) : 'none';
  return `${[`Accept: ${NAVIGATION_ACCEPT}`, 'Accept-Language: en-IN,en-US;q=0.9,en;q=0.8', 'Cache-Control: max-age=0', 'Pragma: no-cache', 'Upgrade-Insecure-Requests: 1', `Sec-CH-UA: ${CHROME_CLIENT_HINTS}`, 'Sec-CH-UA-Mobile: ?0', 'Sec-CH-UA-Platform: "Windows"', 'Sec-Fetch-Dest: document', 'Sec-Fetch-Mode: navigate', `Sec-Fetch-Site: ${fetchSite}`, 'Sec-Fetch-User: ?1'].join('\n')}\n`;
}
function buildRequestHeaders(details) {
  const headers = { ...(details.requestHeaders ?? {}) },
    resourceType = details.resourceType ?? '',
    isNavigationRequest = 'mainFrame' === resourceType || 'subFrame' === resourceType,
    referrer = headers.Referer || headers.referer || details.referrer || details.initiator || '',
    acceptHeader =
      headers.Accept ||
      headers.accept ||
      (function (resourceType = '') {
        switch (resourceType) {
          case 'mainFrame':
          case 'subFrame':
            return NAVIGATION_ACCEPT;
          case 'image':
            return 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
          case 'stylesheet':
            return 'text/css,*/*;q=0.1';
          case 'script':
          default:
            return '*/*';
          case 'xhr':
          case 'fetch':
            return 'application/json, text/plain, */*';
          case 'font':
            return 'font/woff2,font/woff,font/ttf,*/*;q=0.8';
        }
      })(resourceType),
    languageHeader =
      headers['Accept-Language'] || headers['accept-language'] || 'en-IN,en-US;q=0.9,en;q=0.8';
  return (
    (headers['User-Agent'] = BUILTIN_BROWSER_USER_AGENT),
    (headers['Accept-Language'] = languageHeader),
    (headers.Accept = acceptHeader),
    (headers['Sec-CH-UA'] = headers['Sec-CH-UA'] || CHROME_CLIENT_HINTS),
    (headers['Sec-CH-UA-Mobile'] = headers['Sec-CH-UA-Mobile'] || '?0'),
    (headers['Sec-CH-UA-Platform'] = headers['Sec-CH-UA-Platform'] || '"Windows"'),
    (headers['Sec-Fetch-Dest'] =
      headers['Sec-Fetch-Dest'] ||
      (function (resourceType = '') {
        switch (resourceType) {
          case 'mainFrame':
            return 'document';
          case 'subFrame':
            return 'iframe';
          case 'image':
            return 'image';
          case 'stylesheet':
            return 'style';
          case 'script':
            return 'script';
          case 'font':
            return 'font';
          default:
            return 'empty';
        }
      })(resourceType)),
    (headers['Sec-Fetch-Mode'] =
      headers['Sec-Fetch-Mode'] ||
      (function (resourceType = '') {
        switch (resourceType) {
          case 'mainFrame':
          case 'subFrame':
            return 'navigate';
          case 'xhr':
          case 'fetch':
            return 'cors';
          default:
            return 'no-cors';
        }
      })(resourceType)),
    (headers['Sec-Fetch-Site'] = headers['Sec-Fetch-Site'] || getFetchSite(details.url, referrer)),
    delete headers.accept,
    delete headers['accept-language'],
    delete headers.referer,
    !referrer || headers.Referer || headers.referer || (headers.Referer = referrer),
    isNavigationRequest &&
      ((headers['Cache-Control'] = headers['Cache-Control'] || 'max-age=0'),
      (headers.Pragma = headers.Pragma || 'no-cache'),
      (headers['Upgrade-Insecure-Requests'] = headers['Upgrade-Insecure-Requests'] || '1'),
      (headers['Sec-Fetch-User'] = headers['Sec-Fetch-User'] || '?1')),
    headers
  );
}
function getViewWebContents(view) {
  return view?.webContents ?? null;
}
export class BrowserPreviewService extends EventEmitter {
  constructor() {
    (super(),
      (this._window = null),
      (this._view = null),
      (this._viewAttached = !1),
      (this._hostBounds = null),
      (this._visible = !1),
      (this._title = 'Built-in Browser'),
      (this._url = ''),
      (this._status = 'Ready'),
      (this._loading = !1),
      (this._sessionConfigured = !1),
      (this._lastEmittedState = null));
  }
  attachToWindow(win) {
    this._window !== win &&
      (this._resizeHandler &&
        this._window &&
        !this._window.isDestroyed() &&
        this._window.off('resize', this._resizeHandler),
      this._detachIfNeeded(),
      (this._window = win ?? null),
      this._window &&
        ((this._resizeHandler = () => {
          this._viewAttached && this._updateBounds();
        }),
        this._window.on('resize', this._resizeHandler)),
      this._attachIfNeeded(),
      this._emitState(!0));
  }
  getState() {
    const webContents = getViewWebContents(this._view),
      navigationHistory = webContents?.navigationHistory;
    return {
      visible: this._visible,
      hasView: Boolean(this._view),
      hasPage: Boolean(this._url),
      title: this._title,
      url: this._url,
      status: this._status,
      loading: this._loading,
      canGoBack: Boolean(navigationHistory?.canGoBack?.()),
      canGoForward: Boolean(navigationHistory?.canGoForward?.()),
    };
  }
  async ensureWebContents() {
    if (!this._view) {
      const webPreferences = {
        partition: 'persist:Joanium-browser-mcp',
        contextIsolation: !0,
        nodeIntegration: !1,
        sandbox: !0,
        backgroundThrottling: !1,
      };
      ((this._view = new WebContentsView({ webPreferences: webPreferences })),
        this._view.setBackgroundColor('#ffffff'),
        this._view.setVisible(!1));
      const webContents = getViewWebContents(this._view);
      if (!webContents) throw new Error('Could not create the built-in browser view.');
      (this._configureSession(webContents.session),
        webContents.setUserAgent(BUILTIN_BROWSER_USER_AGENT),
        this._wireViewEvents(this._view));
    }
    return (this.show(), getViewWebContents(this._view));
  }
  async loadURL(url, { referrer: referrer = '' } = {}) {
    const webContents = await this.ensureWebContents(),
      loadOptions = {
        userAgent: BUILTIN_BROWSER_USER_AGENT,
        extraHeaders: buildExtraHeaders(url, referrer),
      };
    return (
      referrer && (loadOptions.httpReferrer = referrer),
      await new Promise((resolve) => {
        let settled = !1;
        const settle = () => {
            settled ||
              ((settled = !0),
              clearTimeout(timer),
              webContents.removeListener('did-stop-loading', settle),
              webContents.removeListener('destroyed', settle),
              resolve());
          },
          timer = setTimeout(settle, 3e4);
        (webContents.once('did-stop-loading', settle),
          webContents.once('destroyed', settle),
          webContents.loadURL(url, loadOptions).catch((err) => {
            !(function (error) {
              const message = String(error?.message ?? '');
              return message.includes('ERR_HTTP2_PROTOCOL_ERROR') || message.includes('(-337)');
            })(err)
              ? settle()
              : (webContents.session.clearCache().catch(() => {}),
                webContents.loadURL(url, loadOptions).catch(() => settle()));
          }));
      }),
      webContents
    );
  }
  show() {
    ((this._visible = !0), this._attachIfNeeded(), this._emitState(!0));
  }
  hide() {
    ((this._visible = !1), this._detachIfNeeded(), this._emitState());
  }
  setVisible(visible) {
    visible ? this.show() : this.hide();
  }
  setHostBounds(bounds) {
    console.log('[BrowserPreview] setHostBounds:', JSON.stringify(bounds));
    const normalizedBounds = (function (bounds) {
      return !bounds || bounds.width <= 0 || bounds.height <= 0
        ? null
        : {
            x: Math.max(0, Math.round(bounds.x)),
            y: Math.max(0, Math.round(bounds.y)),
            width: Math.max(1, Math.round(bounds.width)),
            height: Math.max(1, Math.round(bounds.height)),
          };
    })(bounds);
    var left, right;
    ((left = this._hostBounds) === (right = normalizedBounds) ||
      (left &&
        right &&
        left.x === right.x &&
        left.y === right.y &&
        left.width === right.width &&
        left.height === right.height) ||
      (this._hostBounds = normalizedBounds),
      normalizedBounds ? (this._attachIfNeeded(), this._updateBounds()) : this._detachIfNeeded());
  }
  setStatus(status = 'Ready') {
    ((this._status = String(status ?? 'Ready').trim() || 'Ready'), this._emitState());
  }
  clearStatus() {
    this.setStatus(this._loading ? 'Loading page...' : 'Ready');
  }
  async close() {
    this.hide();
    const webContents = getViewWebContents(this._view);
    (webContents && !webContents.isDestroyed() && webContents.close(),
      (this._view = null),
      (this._title = 'Built-in Browser'),
      (this._url = ''),
      (this._status = 'Ready'),
      (this._loading = !1),
      (this._sessionConfigured = !1),
      (this._lastEmittedState = null),
      this._emitState());
  }
  _wireViewEvents(view) {
    const webContents = getViewWebContents(view);
    if (!webContents) return;
    (webContents.setWindowOpenHandler(
      ({ url: url }) => (
        url &&
          (this.setStatus(`Opening ${url}`),
          this.loadURL(url, { referrer: webContents.getURL() || '' }).catch(() => {})),
        { action: 'deny' }
      ),
    ),
      webContents.on('page-title-updated', (event, title) => {
        (event.preventDefault(), (this._title = title || 'Built-in Browser'), this._emitState());
      }),
      webContents.on('did-start-loading', () => {
        ((this._loading = !0), (this._status = 'Loading page...'), this._emitState());
      }),
      webContents.on('did-start-navigation', (_event, url, _isInPlace, isMainFrame) => {
        isMainFrame &&
          ((this._url = url || this._url),
          (this._status = url ? `Opening ${url}` : 'Loading page...'),
          this._emitState());
      }),
      webContents.on('did-stop-loading', () => {
        ((this._loading = !1),
          (this._url = webContents.getURL() || this._url),
          (this._title = webContents.getTitle() || this._title),
          (this._status = 'Ready'),
          this._emitState());
      }),
      webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          isMainFrame &&
            ((this._loading = !1),
            (this._url = validatedURL || this._url),
            (this._status = `Load failed (${errorCode}): ${errorDescription}`),
            this._emitState());
        },
      ));
    const syncLocation = () => {
      ((this._url = webContents.getURL() || this._url),
        (this._title = webContents.getTitle() || this._title),
        this._emitState());
    };
    (webContents.on('did-navigate', syncLocation),
      webContents.on('did-navigate-in-page', syncLocation),
      webContents.on('render-process-gone', () => {
        ((this._status = 'Browser process ended unexpectedly.'),
          (this._loading = !1),
          this._emitState());
      }),
      webContents.on('destroyed', () => {
        ((this._view = null),
          (this._viewAttached = !1),
          (this._loading = !1),
          (this._sessionConfigured = !1),
          this._emitState());
      }));
  }
  _configureSession(session) {
    session &&
      !this._sessionConfigured &&
      (session.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: buildRequestHeaders(details) });
      }),
      (this._sessionConfigured = !0));
  }
  _attachIfNeeded() {
    this._window &&
      !this._window.isDestroyed() &&
      this._view &&
      this._visible &&
      (this._viewAttached ||
        (this._window.contentView.addChildView(this._view),
        this._view.setVisible(!0),
        (this._viewAttached = !0)),
      this._updateBounds());
  }
  _detachIfNeeded() {
    this._window &&
      this._view &&
      this._viewAttached &&
      (this._window.isDestroyed() ||
        (this._window.contentView.removeChildView(this._view), this._view.setVisible(!1)),
      (this._viewAttached = !1));
  }
  async _queryRendererBounds() {
    if (!this._window || this._window.isDestroyed()) return null;
    try {
      return await this._window.webContents.executeJavaScript(
        "\n        (() => {\n          const mount = document.getElementById('browser-preview-mount');\n          if (!mount) return null;\n          const r = mount.getBoundingClientRect();\n          if (!r.width || !r.height) return null;\n          return {\n            x: Math.round(r.x),\n            y: Math.round(r.y),\n            width: Math.round(r.width),\n            height: Math.round(r.height),\n          };\n        })()\n      ",
      );
    } catch {
      return null;
    }
  }
  _computeFallbackBounds() {
    if (!this._window || this._window.isDestroyed()) return null;
    const [winWidth, winHeight] = this._window.getContentSize(),
      panelX = Math.round((2 * winWidth) / 5);
    return { x: panelX, y: 155, width: winWidth - panelX, height: Math.max(winHeight - 155, 100) };
  }
  _updateBounds() {
    if (!this._view || !this._viewAttached) return;
    const immediateBounds = this._hostBounds || this._computeFallbackBounds();
    (immediateBounds && (this._view.setBounds(immediateBounds), this._view.setVisible(!0)),
      this._queryRendererBounds().then((precise) => {
        precise &&
          this._view &&
          this._viewAttached &&
          (this._view.setBounds(precise),
          this._view.setVisible(!0),
          setTimeout(() => {
            this._queryRendererBounds().then((final) => {
              final && this._view && this._viewAttached && this._view.setBounds(final);
            });
          }, 400));
      }));
  }
  _emitState(force = !1) {
    const state = this.getState();
    var left, right;
    (!force &&
      ((left = state) === (right = this._lastEmittedState) ||
        (left &&
          right &&
          left.visible === right.visible &&
          left.hasView === right.hasView &&
          left.hasPage === right.hasPage &&
          left.title === right.title &&
          left.url === right.url &&
          left.status === right.status &&
          left.loading === right.loading &&
          left.canGoBack === right.canGoBack &&
          left.canGoForward === right.canGoForward))) ||
      ((this._lastEmittedState = { ...state }),
      this.emit('state', state),
      this._window &&
        !this._window.isDestroyed() &&
        this._window.webContents.send('browser-preview-state', state));
  }
}
let _browserPreviewService = null;
export function getBrowserPreviewService() {
  return (
    _browserPreviewService || (_browserPreviewService = new BrowserPreviewService()),
    _browserPreviewService
  );
}
