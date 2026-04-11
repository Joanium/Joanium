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

  /**
   * Measure the viewport area where the WebContentsView should be placed.
   * Tries multiple strategies to guarantee a valid rect even if the viewport
   * element reports 0×0 during CSS transitions.
   */
  function measureViewportRect() {
    // Strategy 1: the viewport element itself (position: absolute inside mount)
    if (browserPreviewViewport) {
      const r = browserPreviewViewport.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
    }

    // Strategy 2: fall back to the mount container
    if (browserPreviewMount) {
      const r = browserPreviewMount.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
    }

    // Strategy 3: compute from the panel, subtracting the header area
    const panelRect = browserPreviewPanel.getBoundingClientRect();
    if (panelRect.width > 0 && panelRect.height > 0 && browserPreviewMount) {
      // Use the mount's offsetTop relative to the card / panel to find
      // where the content area begins.
      const mountOffsetTop = browserPreviewMount.offsetTop || 0;
      return {
        x: panelRect.x,
        y: panelRect.y + mountOffsetTop,
        width: panelRect.width,
        height: Math.max(panelRect.height - mountOffsetTop, 50),
      };
    }

    return null;
  }

  async function syncBounds() {
    if (disposed || !window.electronAPI?.invoke) return;

    let nextBounds = null;

    const isModalOpen = document.body.classList.contains('modal-open');
    const isPanelHidden = browserPreviewPanel.hidden;
    const isStateVisible = currentState.visible;

    if (isModalOpen || isPanelHidden || !isStateVisible) {
      nextBounds = null;
    } else {
      const rect = measureViewportRect();
      if (rect) {
        nextBounds = {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }
    }

    const nextBoundsKey = getBoundsKey(nextBounds);
    if (nextBoundsKey === lastBoundsKey) return;

    try {
      await window.electronAPI.invoke('browser-preview-set-bounds', nextBounds);
      lastBoundsKey = nextBoundsKey;
    } catch (err) {
      lastBoundsKey = 'uninitialized';
    }
  }

  function scheduleBoundsSync() {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(() => {
      void syncBounds();
    });
  }

  // After a CSS show-transition, the viewport rect may have been
  // zero-sized during the initial rAF. These staggered retries ensure we
  // eventually send valid bounds once the transition settles.
  let delayedBoundsSyncTimers = [];
  function scheduleBoundsSyncDelayed() {
    delayedBoundsSyncTimers.forEach(clearTimeout);
    delayedBoundsSyncTimers = [];
    for (const ms of [50, 150, 350, 700]) {
      delayedBoundsSyncTimers.push(
        setTimeout(() => {
          lastBoundsKey = 'uninitialized'; // force re-send
          void syncBounds();
        }, ms),
      );
    }
  }

  // Also re-sync when the panel's CSS transition finishes (opacity/transform).
  function onPanelTransitionEnd() {
    if (disposed || !currentState.visible) return;
    lastBoundsKey = 'uninitialized';
    scheduleBoundsSync();
  }
  browserPreviewPanel.addEventListener('transitionend', onPanelTransitionEnd);

  function applyState(nextState) {
    const normalizedState = normalizePreviewState(nextState);
    if (hasRenderedState && arePreviewStatesEqual(currentState, normalizedState)) {
      return;
    }

    const wasVisible = currentState.visible;
    currentState = normalizedState;
    hasRenderedState = true;
    syncPreviewUI();
    scheduleBoundsSync();

    // If the preview just became visible, schedule staggered retries so that
    // any zero-size rects measured during the CSS open-transition are corrected.
    if (!wasVisible && normalizedState.visible) {
      scheduleBoundsSyncDelayed();
    }
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
      delayedBoundsSyncTimers.forEach(clearTimeout);
      delayedBoundsSyncTimers = [];
      resizeObserver?.disconnect();
      modalObserver?.disconnect();
      browserPreviewPanel.removeEventListener('transitionend', onPanelTransitionEnd);
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
