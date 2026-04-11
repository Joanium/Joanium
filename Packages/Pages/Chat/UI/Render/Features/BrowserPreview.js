import {
  browserPreviewPanel,
  browserPreviewMount,
  browserPreviewTitle,
  browserPreviewUrl,
  browserPreviewStatus,
  browserPreviewStatusDot,
} from '../../../../Shared/Core/DOM.js';

const DEFAULT_PREVIEW_STATE = Object.freeze({
  visible: false,
  hasView: false,
  hasPage: false,
  title: 'Built-in Browser',
  url: '',
  status: 'Ready',
  loading: false,
  canGoBack: false,
  canGoForward: false,
});

function normalizePreviewState(nextState = {}) {
  return { ...DEFAULT_PREVIEW_STATE, ...nextState };
}

function arePreviewStatesEqual(left, right) {
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

function getBoundsKey(bounds) {
  if (!bounds) return 'null';
  return `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
}

function getStatusTone(state) {
  const status = String(state.status ?? '').toLowerCase();
  if (state.loading) return 'loading';
  if (/failed|timed out|unexpected|error/.test(status)) return 'error';
  if (state.visible && state.hasPage) return 'live';
  if (state.hasPage) return 'paused';
  return 'idle';
}

function isReadingState(state) {
  const status = String(state.status ?? '').toLowerCase();
  return /scanning|reading|finding|listing|checking|inspecting|analyzing|capturing|snapshot/.test(
    status,
  );
}

function setStatusTone(element, tone) {
  if (!element) return;
  element.classList.remove('is-idle', 'is-loading', 'is-live', 'is-paused', 'is-error');
  element.classList.add(`is-${tone}`);
}

export function createBrowserPreviewFeature() {
  if (!browserPreviewPanel || !browserPreviewMount) {
    return { cleanup() {} };
  }

  const browserPreviewViewport = browserPreviewMount.querySelector(
    '[data-browser-preview-viewport="true"]',
  );
  const chatWorkspace = document.getElementById('main');
  let currentState = normalizePreviewState();
  let animationFrameId = 0;
  let resizeObserver = null;
  let modalObserver = null;
  let disposed = false;
  let hasRenderedState = false;
  let lastBoundsKey = 'uninitialized';

  function syncPreviewUI() {
    if (disposed) return;

    const tone = getStatusTone(currentState);
    const shouldShowPreview = Boolean(currentState.visible);

    browserPreviewPanel.hidden = !shouldShowPreview;
    browserPreviewPanel.classList.toggle('is-active', shouldShowPreview);
    chatWorkspace?.classList.toggle('has-browser-preview', shouldShowPreview);

    browserPreviewPanel.classList.toggle('has-page', currentState.hasPage);
    browserPreviewPanel.classList.toggle('is-live', currentState.visible && currentState.hasPage);
    browserPreviewPanel.classList.toggle('is-loading', currentState.loading);
    browserPreviewPanel.classList.toggle(
      'is-reading',
      shouldShowPreview && isReadingState(currentState),
    );
    browserPreviewPanel.classList.toggle('is-empty', !currentState.hasPage);

    if (browserPreviewTitle) {
      browserPreviewTitle.textContent = currentState.title || 'Built-in Browser';
    }

    if (browserPreviewUrl) {
      browserPreviewUrl.textContent =
        currentState.url || 'AI browser activity will appear here once Joanium starts navigating.';
      browserPreviewUrl.title = currentState.url || 'Built-in Browser';
    }

    if (browserPreviewStatus) {
      browserPreviewStatus.textContent =
        currentState.status || (currentState.loading ? 'Loading page...' : 'Ready');
      setStatusTone(browserPreviewStatus, tone);
    }

    setStatusTone(browserPreviewStatusDot, tone);
  }

  async function syncBounds() {
    if (disposed || !window.electronAPI?.invoke) return;

    let nextBounds = null;

    if (
      document.body.classList.contains('modal-open') ||
      browserPreviewPanel.hidden ||
      !currentState.visible
    ) {
      nextBounds = null;
    } else {
      const rect = (browserPreviewViewport || browserPreviewMount).getBoundingClientRect();
      if (rect.width && rect.height) {
        nextBounds = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }
    }

    const nextBoundsKey = getBoundsKey(nextBounds);
    if (nextBoundsKey === lastBoundsKey) return;

    try {
      await window.electronAPI.invoke('browser-preview-set-bounds', nextBounds);
      lastBoundsKey = nextBoundsKey;
    } catch (err) {
      console.warn('[Chat] Failed to sync browser preview bounds:', err);
      lastBoundsKey = 'uninitialized';
    }
  }

  function scheduleBoundsSync() {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(() => {
      void syncBounds();
    });
  }

  function applyState(nextState) {
    const normalizedState = normalizePreviewState(nextState);
    if (hasRenderedState && arePreviewStatesEqual(currentState, normalizedState)) {
      return;
    }

    currentState = normalizedState;
    hasRenderedState = true;
    syncPreviewUI();
    scheduleBoundsSync();
  }

  async function refreshInitialState() {
    try {
      const result = await window.electronAPI?.invoke?.('browser-preview-get-state');
      if (result?.ok) {
        applyState(result.state);
        return;
      }
    } catch (err) {
      console.warn('[Chat] Failed to get browser preview state:', err);
    }

    applyState(DEFAULT_PREVIEW_STATE);
  }

  function handlePreviewState(nextState) {
    applyState(nextState);
  }

  window.addEventListener('resize', scheduleBoundsSync);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleBoundsSync);
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => scheduleBoundsSync());
    resizeObserver.observe(browserPreviewPanel);
    resizeObserver.observe(browserPreviewMount);
  }

  modalObserver = new MutationObserver(() => scheduleBoundsSync());
  modalObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  window.electronAPI?.onBrowserPreviewState?.(handlePreviewState);
  void refreshInitialState().finally(scheduleBoundsSync);

  return {
    cleanup() {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      modalObserver?.disconnect();
      window.removeEventListener('resize', scheduleBoundsSync);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', scheduleBoundsSync);
      }
      window.electronAPI?.offBrowserPreviewState?.(handlePreviewState);
      hasRenderedState = false;
      lastBoundsKey = 'uninitialized';
      browserPreviewPanel.hidden = true;
      browserPreviewPanel.classList.remove('is-active');
      browserPreviewPanel.classList.remove('is-reading');
      chatWorkspace?.classList.remove('has-browser-preview');
      void window.electronAPI?.invoke?.('browser-preview-set-bounds', null);
      void window.electronAPI?.invoke?.('browser-preview-set-visible', false);
    },
  };
}
