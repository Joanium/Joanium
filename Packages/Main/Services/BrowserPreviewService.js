import { BrowserView, WebContentsView } from 'electron';
import { EventEmitter } from 'events';

export const BUILTIN_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

const BUILTIN_BROWSER_LANGUAGE = 'en-IN,en-US;q=0.9,en;q=0.8';
const CHROME_CLIENT_HINTS = '"Not(A:Brand";v="99", "Google Chrome";v="134", "Chromium";v="134"';
const NAVIGATION_ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';

function getAcceptHeader(resourceType = '') {
  switch (resourceType) {
    case 'mainFrame':
    case 'subFrame':
      return NAVIGATION_ACCEPT;
    case 'image':
      return 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
    case 'stylesheet':
      return 'text/css,*/*;q=0.1';
    case 'script':
      return '*/*';
    case 'xhr':
    case 'fetch':
      return 'application/json, text/plain, */*';
    case 'font':
      return 'font/woff2,font/woff,font/ttf,*/*;q=0.8';
    default:
      return '*/*';
  }
}

function getFetchDestination(resourceType = '') {
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
}

function getFetchMode(resourceType = '') {
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
}

function getRegistrableDomain(hostname = '') {
  const parts = String(hostname).split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const thirdLevel = parts[parts.length - 3];
  const usesCompoundSuffix =
    tld.length === 2 && ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac'].includes(sld);

  return usesCompoundSuffix ? `${thirdLevel}.${sld}.${tld}` : `${sld}.${tld}`;
}

function getFetchSite(url = '', initiator = '') {
  try {
    if (!initiator || initiator === 'null') return 'none';

    const target = new URL(url);
    const source = new URL(initiator);

    if (target.origin === source.origin) return 'same-origin';
    if (getRegistrableDomain(target.hostname) === getRegistrableDomain(source.hostname))
      return 'same-site';
    return 'cross-site';
  } catch {
    return initiator ? 'cross-site' : 'none';
  }
}

function buildExtraHeaders(url, referrer = '') {
  const fetchSite = referrer ? getFetchSite(url, referrer) : 'none';
  const lines = [
    `Accept: ${NAVIGATION_ACCEPT}`,
    `Accept-Language: ${BUILTIN_BROWSER_LANGUAGE}`,
    'Cache-Control: max-age=0',
    'Pragma: no-cache',
    'Upgrade-Insecure-Requests: 1',
    `Sec-CH-UA: ${CHROME_CLIENT_HINTS}`,
    'Sec-CH-UA-Mobile: ?0',
    'Sec-CH-UA-Platform: "Windows"',
    'Sec-Fetch-Dest: document',
    'Sec-Fetch-Mode: navigate',
    `Sec-Fetch-Site: ${fetchSite}`,
    'Sec-Fetch-User: ?1',
  ];

  return `${lines.join('\n')}\n`;
}

function buildRequestHeaders(details) {
  const headers = { ...(details.requestHeaders ?? {}) };
  const resourceType = details.resourceType ?? '';
  const isNavigationRequest = resourceType === 'mainFrame' || resourceType === 'subFrame';
  const referrer =
    headers.Referer || headers.referer || details.referrer || details.initiator || '';
  const acceptHeader = headers.Accept || headers.accept || getAcceptHeader(resourceType);
  const languageHeader =
    headers['Accept-Language'] || headers['accept-language'] || BUILTIN_BROWSER_LANGUAGE;

  headers['User-Agent'] = BUILTIN_BROWSER_USER_AGENT;
  headers['Accept-Language'] = languageHeader;
  headers.Accept = acceptHeader;
  headers['Sec-CH-UA'] = headers['Sec-CH-UA'] || CHROME_CLIENT_HINTS;
  headers['Sec-CH-UA-Mobile'] = headers['Sec-CH-UA-Mobile'] || '?0';
  headers['Sec-CH-UA-Platform'] = headers['Sec-CH-UA-Platform'] || '"Windows"';
  headers['Sec-Fetch-Dest'] = headers['Sec-Fetch-Dest'] || getFetchDestination(resourceType);
  headers['Sec-Fetch-Mode'] = headers['Sec-Fetch-Mode'] || getFetchMode(resourceType);
  headers['Sec-Fetch-Site'] = headers['Sec-Fetch-Site'] || getFetchSite(details.url, referrer);

  delete headers.accept;
  delete headers['accept-language'];
  delete headers.referer;

  if (referrer && !headers.Referer && !headers.referer) {
    headers.Referer = referrer;
  }

  if (isNavigationRequest) {
    headers['Cache-Control'] = headers['Cache-Control'] || 'max-age=0';
    headers.Pragma = headers.Pragma || 'no-cache';
    headers['Upgrade-Insecure-Requests'] = headers['Upgrade-Insecure-Requests'] || '1';
    headers['Sec-Fetch-User'] = headers['Sec-Fetch-User'] || '?1';
  }

  return headers;
}

function isHttp2ProtocolError(error) {
  const message = String(error?.message ?? '');
  return message.includes('ERR_HTTP2_PROTOCOL_ERROR') || message.includes('(-337)');
}

function normalizeHostBounds(bounds) {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  };
}

function areBoundsEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function areStatesEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    left.visible === right.visible &&
    left.hasView === right.hasView &&
    left.hasPage === right.hasPage &&
    left.title === right.title &&
    left.url === right.url &&
    left.status === right.status &&
    left.loading === right.loading &&
    left.canGoBack === right.canGoBack &&
    left.canGoForward === right.canGoForward
  );
}

function getViewWebContents(view) {
  return view?.webContents ?? null;
}

function isWebContentsViewInstance(view) {
  return typeof WebContentsView === 'function' && view instanceof WebContentsView;
}

export class BrowserPreviewService extends EventEmitter {
  constructor() {
    super();
    this._window = null;
    this._view = null;
    this._viewAttached = false;
    this._hostBounds = null;
    this._visible = false;
    this._title = 'Built-in Browser';
    this._url = '';
    this._status = 'Ready';
    this._loading = false;
    this._sessionConfigured = false;
    this._lastEmittedState = null;
  }

  attachToWindow(win) {
    if (this._window === win) return;

    this._detachIfNeeded();

    this._window = win ?? null;
    this._attachIfNeeded();
    this._emitState(true);
  }

  getState() {
    const webContents = getViewWebContents(this._view);
    const navigationHistory = webContents?.navigationHistory;

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
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      };

      if (typeof WebContentsView === 'function') {
        this._view = new WebContentsView({ webPreferences });
        this._view.setVisible(false);
      } else {
        this._view = new BrowserView({ webPreferences });
      }

      const webContents = getViewWebContents(this._view);
      if (!webContents) {
        throw new Error('Could not create the built-in browser view.');
      }

      this._configureSession(webContents.session);
      webContents.setUserAgent(BUILTIN_BROWSER_USER_AGENT);
      this._wireViewEvents(this._view);
    }

    this.show();
    return getViewWebContents(this._view);
  }

  async loadURL(url, { referrer = '' } = {}) {
    const webContents = await this.ensureWebContents();
    const loadOptions = {
      userAgent: BUILTIN_BROWSER_USER_AGENT,
      extraHeaders: buildExtraHeaders(url, referrer),
    };

    if (referrer) {
      loadOptions.httpReferrer = referrer;
    }

    await new Promise((resolve) => {
      const TIMEOUT_MS = 30_000;
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        webContents.removeListener('did-stop-loading', settle);
        webContents.removeListener('destroyed', settle);
        resolve();
      };

      const timer = setTimeout(settle, TIMEOUT_MS);
      webContents.once('did-stop-loading', settle);
      webContents.once('destroyed', settle);

      webContents.loadURL(url, loadOptions).catch((err) => {
        if (!isHttp2ProtocolError(err)) {
          settle();
          return;
        }
        webContents.session.clearCache().catch(() => {});
        webContents.loadURL(url, loadOptions).catch(() => settle());
      });
    });

    return webContents;
  }

  show() {
    this._visible = true;
    this._attachIfNeeded();
    this._emitState();
  }

  hide() {
    this._visible = false;
    this._detachIfNeeded();
    this._emitState();
  }

  setVisible(visible) {
    if (visible) this.show();
    else this.hide();
  }

  setHostBounds(bounds) {
    const normalizedBounds = normalizeHostBounds(bounds);

    if (areBoundsEqual(this._hostBounds, normalizedBounds)) {
      if (!normalizedBounds) {
        this._detachIfNeeded();
      } else {
        this._attachIfNeeded();
        this._updateBounds();
      }
      return;
    }

    this._hostBounds = normalizedBounds;

    if (!normalizedBounds) {
      this._detachIfNeeded();
      return;
    }

    this._attachIfNeeded();
    this._updateBounds();
  }

  setStatus(status = 'Ready') {
    this._status = String(status ?? 'Ready').trim() || 'Ready';
    this._emitState();
  }

  clearStatus() {
    this.setStatus(this._loading ? 'Loading page...' : 'Ready');
  }

  async close() {
    this.hide();
    const webContents = getViewWebContents(this._view);
    if (webContents && !webContents.isDestroyed()) {
      webContents.close();
    }
    this._view = null;
    this._title = 'Built-in Browser';
    this._url = '';
    this._status = 'Ready';
    this._loading = false;
    this._sessionConfigured = false;
    this._lastEmittedState = null;
    this._emitState();
  }

  _wireViewEvents(view) {
    const webContents = getViewWebContents(view);
    if (!webContents) return;

    webContents.setWindowOpenHandler(({ url }) => {
      if (url) {
        this.setStatus(`Opening ${url}`);
        void this.loadURL(url, { referrer: webContents.getURL() || '' }).catch(() => {});
      }
      return { action: 'deny' };
    });

    webContents.on('page-title-updated', (event, title) => {
      event.preventDefault();
      this._title = title || 'Built-in Browser';
      this._emitState();
    });

    webContents.on('did-start-loading', () => {
      this._loading = true;
      this._status = 'Loading page...';
      this._emitState();
    });

    webContents.on('did-start-navigation', (_event, url, _isInPlace, isMainFrame) => {
      if (!isMainFrame) return;
      this._url = url || this._url;
      this._status = url ? `Opening ${url}` : 'Loading page...';
      this._emitState();
    });

    webContents.on('did-stop-loading', () => {
      this._loading = false;
      this._url = webContents.getURL() || this._url;
      this._title = webContents.getTitle() || this._title;
      this._status = 'Ready';
      this._emitState();
    });

    webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return;
        this._loading = false;
        this._url = validatedURL || this._url;
        this._status = `Load failed (${errorCode}): ${errorDescription}`;
        this._emitState();
      },
    );

    const syncLocation = () => {
      this._url = webContents.getURL() || this._url;
      this._title = webContents.getTitle() || this._title;
      this._emitState();
    };

    webContents.on('did-navigate', syncLocation);
    webContents.on('did-navigate-in-page', syncLocation);

    webContents.on('render-process-gone', () => {
      this._status = 'Browser process ended unexpectedly.';
      this._loading = false;
      this._emitState();
    });

    webContents.on('destroyed', () => {
      this._view = null;
      this._viewAttached = false;
      this._loading = false;
      this._sessionConfigured = false;
      this._emitState();
    });
  }

  _configureSession(session) {
    if (!session || this._sessionConfigured) return;

    session.webRequest.onBeforeSendHeaders((details, callback) => {
      callback({ requestHeaders: buildRequestHeaders(details) });
    });

    this._sessionConfigured = true;
  }

  _attachIfNeeded() {
    if (
      !this._window ||
      this._window.isDestroyed() ||
      !this._view ||
      !this._visible ||
      !this._hostBounds
    )
      return;
    if (this._viewAttached) {
      this._updateBounds();
      return;
    }

    if (isWebContentsViewInstance(this._view)) {
      this._window.contentView.addChildView(this._view);
      this._view.setVisible(true);
    } else {
      this._window.addBrowserView(this._view);
    }

    this._viewAttached = true;
    this._updateBounds();
  }

  _detachIfNeeded() {
    if (!this._window || !this._view || !this._viewAttached) return;
    if (this._window.isDestroyed()) {
      this._viewAttached = false;
      return;
    }

    if (isWebContentsViewInstance(this._view)) {
      this._window.contentView.removeChildView(this._view);
      this._view.setVisible(false);
    } else {
      this._window.removeBrowserView(this._view);
    }

    this._viewAttached = false;
  }

  _updateBounds() {
    if (!this._view || !this._viewAttached || !this._hostBounds) return;
    this._view.setBounds(this._hostBounds);
    if (isWebContentsViewInstance(this._view)) {
      this._view.setVisible(true);
      return;
    }

    this._view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false });
  }

  _emitState(force = false) {
    const state = this.getState();

    if (!force && areStatesEqual(state, this._lastEmittedState)) {
      return;
    }

    this._lastEmittedState = { ...state };
    this.emit('state', state);

    if (this._window && !this._window.isDestroyed()) {
      this._window.webContents.send('browser-preview-state', state);
    }
  }
}

let _browserPreviewService = null;

export function getBrowserPreviewService() {
  if (!_browserPreviewService) {
    _browserPreviewService = new BrowserPreviewService();
  }
  return _browserPreviewService;
}
