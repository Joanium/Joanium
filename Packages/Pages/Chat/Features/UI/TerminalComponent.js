let dependencyPromise = null;

function assetUrl(relativePath) {
  return new URL(relativePath, window.location.href).toString();
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`link[data-ow-href="${href}"]`);
    if (existing) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.owHref = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ow-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.dataset.owSrc = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadDependencies() {
  if (!dependencyPromise) {
    dependencyPromise = (async () => {
      await loadStylesheet(assetUrl('../../../node_modules/@xterm/xterm/css/xterm.css'));
      await loadScript(assetUrl('../../../node_modules/@xterm/xterm/lib/xterm.js'));
      await loadScript(assetUrl('../../../node_modules/@xterm/addon-fit/lib/addon-fit.js'));
    })().catch((err) => {
      dependencyPromise = null;
      throw err;
    });
  }

  return dependencyPromise;
}

export async function mountTerminal(containerId, pid) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    await loadDependencies();
  } catch (err) {
    el.innerHTML = `<div style="padding:12px;color:#fca5a5;font:13px monospace;">Embedded terminal failed to load: ${err.message}</div>`;
    return;
  }

  const term = new window.Terminal({
    theme: {
      background: '#12141c',
      foreground: '#e2e8f0',
      cursor: '#f3e8ff',
    },
    fontFamily: 'monospace',
    fontSize: 13,
    convertEol: true,
  });

  const fitAddon = new window.FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  term.open(el);
  fitAddon.fit();

  // Resize observer
  const ro = new ResizeObserver(() => fitAddon.fit());
  ro.observe(el);

  // Write data to terminal when IPC receives it
  const handleData = (incomingPid, data) => {
    if (incomingPid === pid) term.write(data);
  };
  window.electronAPI?.onPtyData?.(handleData);

  // Write input to PTY
  term.onData((data) => {
    window.electronAPI?.invoke?.('pty-write', pid, data);
  });

  // Cleanup on exit
  const handleExit = (incomingPid, code) => {
    if (incomingPid === pid) {
      term.write(`\n\r[Process exited with code ${code}]`);
      ro.disconnect();
      window.electronAPI?.offPtyData?.(handleData);
      window.electronAPI?.offPtyExit?.(handleExit);
    }
  };
  window.electronAPI?.onPtyExit?.(handleExit);
}

/**
 * Set up a MutationObserver that automatically mounts xterm terminals into
 * any `.embedded-terminal-mount` elements that are added to the DOM.
 *
 * Returns a cleanup function that disconnects the observer — call it when the
 * Chat page unmounts to avoid accumulating observers across SPA navigations.
 *
 * @returns {() => void} cleanup
 */
export function initTerminalObserver() {
  const initializedPids = new Set();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const mounts = node.classList?.contains('embedded-terminal-mount')
            ? [node]
            : node.querySelectorAll?.('.embedded-terminal-mount');

          if (mounts?.length) {
            mounts.forEach((mount) => {
              const pid = mount.dataset.pid;
              // Guard against double-init within the same observer lifecycle
              if (!mount.classList.contains('initialized') && !initializedPids.has(pid)) {
                mount.classList.add('initialized');
                mount.id = mount.id || 'term_' + Math.random().toString(36).substring(2);
                if (pid) initializedPids.add(pid);
                mountTerminal(mount.id, pid);
              }
            });
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Return a cleanup function so callers can disconnect when the page unmounts
  return function cleanupTerminalObserver() {
    observer.disconnect();
    initializedPids.clear();
  };
}
