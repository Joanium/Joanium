import {
  browserPreviewPanel,
  browserPreviewMount,
  browserPreviewTitle,
  browserPreviewUrl,
  browserPreviewStatus,
  browserPreviewStatusDot,
} from '../../../../Shared/Core/DOM.js';
const DEFAULT_PREVIEW_STATE = Object.freeze({
  visible: !1,
  hasView: !1,
  hasPage: !1,
  title: 'Built-in Browser',
  url: '',
  status: 'Ready',
  loading: !1,
  canGoBack: !1,
  canGoForward: !1,
});
function normalizePreviewState(nextState = {}) {
  return { ...DEFAULT_PREVIEW_STATE, ...nextState };
}
function setStatusTone(element, tone) {
  element &&
    (element.classList.remove('is-idle', 'is-loading', 'is-live', 'is-paused', 'is-error'),
    element.classList.add(`is-${tone}`));
}
export function createBrowserPreviewFeature() {
  if (!browserPreviewPanel || !browserPreviewMount) return { cleanup() {} };
  const browserPreviewViewport = browserPreviewMount.querySelector(
      '[data-browser-preview-viewport="true"]',
    ),
    chatWorkspace = document.getElementById('main');
  let currentState = normalizePreviewState(),
    animationFrameId = 0,
    resizeObserver = null,
    modalObserver = null,
    disposed = !1,
    hasRenderedState = !1,
    lastBoundsKey = 'uninitialized';
  async function syncBounds() {
    if (disposed || !window.electronAPI?.invoke) return;
    let nextBounds = null;
    const isModalOpen = document.body.classList.contains('modal-open'),
      isPanelHidden = browserPreviewPanel.hidden,
      isStateVisible = currentState.visible;
    if (isModalOpen || isPanelHidden || !isStateVisible) nextBounds = null;
    else {
      const rect = (function () {
        if (browserPreviewViewport) {
          const r = browserPreviewViewport.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return r;
        }
        if (browserPreviewMount) {
          const r = browserPreviewMount.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return r;
        }
        const panelRect = browserPreviewPanel.getBoundingClientRect();
        if (panelRect.width > 0 && panelRect.height > 0 && browserPreviewMount) {
          const mountOffsetTop = browserPreviewMount.offsetTop || 0;
          return {
            x: panelRect.x,
            y: panelRect.y + mountOffsetTop,
            width: panelRect.width,
            height: Math.max(panelRect.height - mountOffsetTop, 50),
          };
        }
        return null;
      })();
      rect &&
        (nextBounds = {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
    }
    const nextBoundsKey = (bounds = nextBounds)
      ? `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`
      : 'null';
    var bounds;
    if (nextBoundsKey !== lastBoundsKey)
      try {
        (await window.electronAPI.invoke('browser-preview-set-bounds', nextBounds),
          (lastBoundsKey = nextBoundsKey));
      } catch (err) {
        lastBoundsKey = 'uninitialized';
      }
  }
  function scheduleBoundsSync() {
    (cancelAnimationFrame(animationFrameId),
      (animationFrameId = requestAnimationFrame(() => {
        syncBounds();
      })));
  }
  let delayedBoundsSyncTimers = [];
  function onPanelTransitionEnd() {
    !disposed && currentState.visible && ((lastBoundsKey = 'uninitialized'), scheduleBoundsSync());
  }
  function applyState(nextState) {
    const normalizedState = normalizePreviewState(nextState);
    if (
      hasRenderedState &&
      ((left = currentState) === (right = normalizedState) ||
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
          left.canGoForward === right.canGoForward))
    )
      return;
    var left, right;
    const wasVisible = currentState.visible;
    ((currentState = normalizedState),
      (hasRenderedState = !0),
      (function () {
        if (disposed) return;
        const tone = (function (state) {
            const status = String(state.status ?? '').toLowerCase();
            return state.loading
              ? 'loading'
              : /failed|timed out|unexpected|error/.test(status)
                ? 'error'
                : state.visible && state.hasPage
                  ? 'live'
                  : state.hasPage
                    ? 'paused'
                    : 'idle';
          })(currentState),
          shouldShowPreview = Boolean(currentState.visible);
        ((browserPreviewPanel.hidden = !shouldShowPreview),
          browserPreviewPanel.classList.toggle('is-active', shouldShowPreview),
          chatWorkspace?.classList.toggle('has-browser-preview', shouldShowPreview),
          browserPreviewPanel.classList.toggle('has-page', currentState.hasPage),
          browserPreviewPanel.classList.toggle(
            'is-live',
            currentState.visible && currentState.hasPage,
          ),
          browserPreviewPanel.classList.toggle('is-loading', currentState.loading),
          browserPreviewPanel.classList.toggle(
            'is-reading',
            shouldShowPreview &&
              (function (state) {
                const status = String(state.status ?? '').toLowerCase();
                return /scanning|reading|finding|listing|checking|inspecting|analyzing|capturing|snapshot/.test(
                  status,
                );
              })(currentState),
          ),
          browserPreviewPanel.classList.toggle('is-empty', !currentState.hasPage),
          browserPreviewTitle &&
            (browserPreviewTitle.textContent = currentState.title || 'Built-in Browser'),
          browserPreviewUrl &&
            ((browserPreviewUrl.textContent =
              currentState.url ||
              'AI browser activity will appear here once Joanium starts navigating.'),
            (browserPreviewUrl.title = currentState.url || 'Built-in Browser')),
          browserPreviewStatus &&
            ((browserPreviewStatus.textContent =
              currentState.status || (currentState.loading ? 'Loading page...' : 'Ready')),
            setStatusTone(browserPreviewStatus, tone)),
          setStatusTone(browserPreviewStatusDot, tone));
      })(),
      scheduleBoundsSync(),
      !wasVisible &&
        normalizedState.visible &&
        (function () {
          (delayedBoundsSyncTimers.forEach(clearTimeout), (delayedBoundsSyncTimers = []));
          for (const ms of [50, 150, 350, 700])
            delayedBoundsSyncTimers.push(
              setTimeout(() => {
                ((lastBoundsKey = 'uninitialized'), syncBounds());
              }, ms),
            );
        })());
  }
  function handlePreviewState(nextState) {
    applyState(nextState);
  }
  return (
    browserPreviewPanel.addEventListener('transitionend', onPanelTransitionEnd),
    window.addEventListener('resize', scheduleBoundsSync),
    window.visualViewport && window.visualViewport.addEventListener('resize', scheduleBoundsSync),
    'undefined' != typeof ResizeObserver &&
      ((resizeObserver = new ResizeObserver(() => scheduleBoundsSync())),
      resizeObserver.observe(browserPreviewPanel),
      resizeObserver.observe(browserPreviewMount)),
    (modalObserver = new MutationObserver(() => scheduleBoundsSync())),
    modalObserver.observe(document.body, { attributes: !0, attributeFilter: ['class'] }),
    window.electronAPI?.onBrowserPreviewState?.(handlePreviewState),
    (async function () {
      try {
        const result = await window.electronAPI?.invoke?.('browser-preview-get-state');
        if (result?.ok) return void applyState(result.state);
      } catch (err) {
        console.warn('[Chat] Failed to get browser preview state:', err);
      }
      applyState(DEFAULT_PREVIEW_STATE);
    })().finally(scheduleBoundsSync),
    {
      cleanup() {
        ((disposed = !0),
          cancelAnimationFrame(animationFrameId),
          delayedBoundsSyncTimers.forEach(clearTimeout),
          (delayedBoundsSyncTimers = []),
          resizeObserver?.disconnect(),
          modalObserver?.disconnect(),
          browserPreviewPanel.removeEventListener('transitionend', onPanelTransitionEnd),
          window.removeEventListener('resize', scheduleBoundsSync),
          window.visualViewport &&
            window.visualViewport.removeEventListener('resize', scheduleBoundsSync),
          window.electronAPI?.offBrowserPreviewState?.(handlePreviewState),
          (hasRenderedState = !1),
          (lastBoundsKey = 'uninitialized'),
          (browserPreviewPanel.hidden = !0),
          browserPreviewPanel.classList.remove('is-active'),
          browserPreviewPanel.classList.remove('is-reading'),
          chatWorkspace?.classList.remove('has-browser-preview'),
          window.electronAPI?.invoke?.('browser-preview-set-bounds', null),
          window.electronAPI?.invoke?.('browser-preview-set-visible', !1));
      },
    }
  );
}
