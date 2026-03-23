// openworld — Features/Chat/TerminalComponent.js
import { state } from '../../Shared/State.js';

let xtermCssLoaded = false;
let xtermScriptLoaded = false;
let fitAddonScriptLoaded = false;

async function loadDependencies() {
    if (!xtermCssLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '../../../../node_modules/xterm/css/xterm.css';
        document.head.appendChild(link);
        xtermCssLoaded = true;
    }

    if (!xtermScriptLoaded) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = '../../../../node_modules/xterm/lib/xterm.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        xtermScriptLoaded = true;
    }

    if (!fitAddonScriptLoaded) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = '../../../../node_modules/xterm-addon-fit/lib/xterm-addon-fit.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        fitAddonScriptLoaded = true;
    }
}

export async function mountTerminal(containerId, pid) {
    const el = document.getElementById(containerId);
    if (!el) return;

    await loadDependencies();

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
    window.electronAPI?.onPtyData?.((incomingPid, data) => {
        if (incomingPid === pid) term.write(data);
    });

    // Write input to PTY
    term.onData(data => {
        window.electronAPI?.writePty?.(pid, data);
    });

    // Cleanup on exit
    window.electronAPI?.onPtyExit?.((incomingPid, code) => {
        if (incomingPid === pid) {
            term.write(`\n\r[Process exited with code ${code}]`);
            // Optionally could disable input or visually dim the terminal here
        }
    });
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
