// Romelson — Features/Chat/TerminalComponent.js

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
            existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
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
            await loadStylesheet(assetUrl('../node_modules/xterm/css/xterm.css'));
            await loadScript(assetUrl('../node_modules/xterm/lib/xterm.js'));
            await loadScript(assetUrl('../node_modules/xterm-addon-fit/lib/xterm-addon-fit.js'));
        })().catch(err => {
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
            cursor: '#f3e8ff'
        },
        fontFamily: 'monospace',
        fontSize: 13,
        convertEol: true
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
    term.onData(data => {
        window.electronAPI?.writePty?.(pid, data);
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

// Global observer to automatically mount terminals
export function initTerminalObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const mounts = node.classList?.contains('embedded-terminal-mount') 
                        ? [node] 
                        : node.querySelectorAll?.('.embedded-terminal-mount');
                    
                    if (mounts?.length) {
                        mounts.forEach(mount => {
                            if (!mount.classList.contains('initialized')) {
                                mount.classList.add('initialized');
                                mount.id = mount.id || 'term_' + Math.random().toString(36).substring(2);
                                mountTerminal(mount.id, mount.dataset.pid);
                            }
                        });
                    }
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}
