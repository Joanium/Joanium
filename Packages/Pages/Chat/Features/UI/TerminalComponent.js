let dependencyPromise = null;
function assetUrl(relativePath) {
  return new URL(relativePath, window.location.href).toString();
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ow-src="${src}"]`);
    if (existing)
      return 'true' === existing.dataset.loaded
        ? void resolve()
        : (existing.addEventListener('load', resolve, { once: !0 }),
          void existing.addEventListener(
            'error',
            () => reject(new Error(`Failed to load script: ${src}`)),
            { once: !0 },
          ));
    const script = document.createElement('script');
    ((script.src = src),
      (script.dataset.owSrc = src),
      (script.onload = () => {
        ((script.dataset.loaded = 'true'), resolve());
      }),
      (script.onerror = () => reject(new Error(`Failed to load script: ${src}`))),
      document.head.appendChild(script));
  });
}
export async function mountTerminal(containerId, pid) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    await (async function () {
      return (
        dependencyPromise ||
          (dependencyPromise = (async () => {
            var href;
            href = assetUrl('../../../node_modules/@xterm/xterm/css/xterm.css');
            await Promise.all([
              new Promise((resolve, reject) => {
                if (document.querySelector(`link[data-ow-href="${href}"]`)) return void resolve();
                const link = document.createElement('link');
                ((link.rel = 'stylesheet'),
                  (link.href = href),
                  (link.dataset.owHref = href),
                  (link.onload = resolve),
                  (link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`))),
                  document.head.appendChild(link));
              }),
              loadScript(assetUrl('../../../node_modules/@xterm/xterm/lib/xterm.js')),
            ]);
            await loadScript(assetUrl('../../../node_modules/@xterm/addon-fit/lib/addon-fit.js'));
          })().catch((err) => {
            throw ((dependencyPromise = null), err);
          })),
        dependencyPromise
      );
    })();
  } catch (err) {
    return void (el.innerHTML = `<div style="padding:12px;color:#fca5a5;font:13px monospace;">Embedded terminal failed to load: ${err.message}</div>`);
  }
  const term = new window.Terminal({
      theme: { background: '#12141c', foreground: '#e2e8f0', cursor: '#f3e8ff' },
      fontFamily: 'monospace',
      fontSize: 13,
      convertEol: !0,
    }),
    fitAddon = new window.FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(el);
  // Defer initial fit — calling it synchronously here means the DOM hasn't
  // rendered yet, so FitAddon.proposeDimensions() sees 0×0 cells and bails
  // out silently, leaving the terminal with no usable dimensions.
  let _fitTimer = null;
  const ro = new ResizeObserver(() => {
    if (_fitTimer !== null) clearTimeout(_fitTimer);
    _fitTimer = setTimeout(() => {
      _fitTimer = null;
      fitAddon.fit();
    }, 50);
  });
  ro.observe(el);
  requestAnimationFrame(() => {
    fitAddon.fit();
    // One extra pass in case the first frame still resolves to 0 dimensions
    // (can happen when the container is inside a flex/grid that hasn't settled).
    setTimeout(() => fitAddon.fit(), 150);
  });
  const handleData = (incomingPid, data) => {
    incomingPid === pid && term.write(data);
  };
  (window.electronAPI?.onPtyData?.(handleData),
    term.onData((data) => {
      window.electronAPI?.invoke?.('pty-write', pid, data);
    }));
  const handleExit = (incomingPid, code) => {
    incomingPid === pid &&
      (term.write(`\n\r[Process exited with code ${code}]`),
      ro.disconnect(),
      window.electronAPI?.offPtyData?.(handleData),
      window.electronAPI?.offPtyExit?.(handleExit));
  };
  window.electronAPI?.onPtyExit?.(handleExit);
}
export function initTerminalObserver() {
  const initializedPids = new Set(),
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const mounts = node.classList?.contains('embedded-terminal-mount')
              ? [node]
              : node.querySelectorAll?.('.embedded-terminal-mount');
            mounts?.length &&
              mounts.forEach((mount) => {
                const pid = mount.dataset.pid;
                mount.classList.contains('initialized') ||
                  initializedPids.has(pid) ||
                  (mount.classList.add('initialized'),
                  (mount.id = mount.id || 'term_' + Math.random().toString(36).substring(2)),
                  pid && initializedPids.add(pid),
                  mountTerminal(mount.id, pid));
              });
          }
        });
      });
    });
  return (
    observer.observe(document.body, { childList: !0, subtree: !0 }),
    function () {
      (observer.disconnect(), initializedPids.clear());
    }
  );
}
