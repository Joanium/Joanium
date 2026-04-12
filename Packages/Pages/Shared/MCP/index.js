const STATE = {
  loaded: !1,
  servers: [],
  tools: [],
  editor: null,
  feedback: '',
  feedbackTone: 'info',
};
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function setFeedback(message = '', tone = 'info') {
  ((STATE.feedback = message), (STATE.feedbackTone = tone));
}
function renderPanel() {
  const panel = document.getElementById('mcp-settings-panel');
  if (!panel) return;
  const feedback = STATE.feedback
    ? `<div class="mcp-panel-feedback ${escapeHtml(STATE.feedbackTone)}">${escapeHtml(STATE.feedback)}</div>`
    : '';
  ((panel.innerHTML = `\n    <div class="mcp-toolbar">\n      <div class="mcp-toolbar-copy">\n        <strong>Configured Servers</strong>\n        <span>Use STDIO for local MCP processes and HTTP for remote MCP services.</span>\n      </div>\n      <div class="mcp-toolbar-actions">\n        <button id="mcp-refresh-btn" class="mcp-secondary-btn" type="button">Refresh</button>\n        <button id="mcp-add-btn" class="mcp-primary-btn" type="button">Add Server</button>\n      </div>\n    </div>\n\n    ${feedback}\n    ${(function () {
    if (!STATE.editor) return '';
    const server = STATE.editor.server ?? {},
      isEdit = 'edit' === STATE.editor.mode,
      isHttp = 'http' === server.transport;
    return `\n    <section class="mcp-editor-card">\n      <div class="mcp-editor-header">\n        <div>\n          <h4>${isEdit ? 'Edit MCP Server' : 'Add MCP Server'}</h4>\n          <p>\n            Connect any MCP server that exposes browser, web, or workflow tools.\n            Browser-style tools become available to chat automatically.\n          </p>\n        </div>\n      </div>\n\n      <div class="mcp-editor-grid">\n        <label class="settings-field">\n          <span class="settings-field-label">Server Name</span>\n          <input id="mcp-server-name" type="text" maxlength="80"\n                 placeholder="Browser Controller"\n                 value="${escapeHtml(server.name ?? '')}" />\n        </label>\n\n        <label class="settings-field">\n          <span class="settings-field-label">Transport</span>\n          <select id="mcp-server-transport" class="mcp-select">\n            <option value="stdio" ${isHttp ? '' : 'selected'}>STDIO</option>\n            <option value="http" ${isHttp ? 'selected' : ''}>HTTP</option>\n          </select>\n        </label>\n      </div>\n\n      <label class="mcp-checkbox-row">\n        <input id="mcp-server-enabled" type="checkbox" ${!1 !== server.enabled ? 'checked' : ''} />\n        <span>Connect automatically when Joanium launches</span>\n      </label>\n\n      <div id="mcp-stdio-fields" ${isHttp ? 'hidden' : ''}>\n        <div class="mcp-editor-grid">\n          <label class="settings-field">\n            <span class="settings-field-label">Command</span>\n            <input id="mcp-server-command" type="text"\n                   placeholder="npx"\n                   value="${escapeHtml(server.command ?? '')}" />\n          </label>\n          <label class="settings-field">\n            <span class="settings-field-label">Arguments</span>\n            <textarea id="mcp-server-args" class="mcp-textarea"\n                      placeholder="One argument per line&#10;@your-mcp/server&#10;--headless">${escapeHtml(
      (function (args = []) {
        return Array.isArray(args) ? args.join('\n') : '';
      })(server.args ?? []),
    )}</textarea>\n          </label>\n        </div>\n\n        <label class="settings-field">\n          <span class="settings-field-label">Environment Variables</span>\n          <textarea id="mcp-server-env" class="mcp-textarea"\n                    placeholder="Optional, one per line&#10;API_KEY=your-key&#10;BASE_URL=https://example.com">${escapeHtml(
      (function (env = {}) {
        return Object.entries(env ?? {})
          .map(([key, value]) => `${key}=${value ?? ''}`)
          .join('\n');
      })(server.env ?? {}),
    )}</textarea>\n        </label>\n      </div>\n\n      <div id="mcp-http-fields" ${isHttp ? '' : 'hidden'}>\n        <label class="settings-field">\n          <span class="settings-field-label">Server URL</span>\n          <input id="mcp-server-url" type="text"\n                 placeholder="https://your-server.example.com"\n                 value="${escapeHtml(server.url ?? '')}" />\n        </label>\n        <div class="mcp-inline-note">\n          Use the base MCP server URL. Joanium will call the MCP endpoint automatically.\n        </div>\n      </div>\n\n      <div class="mcp-editor-actions">\n        <button id="mcp-cancel-btn" class="mcp-secondary-btn" type="button">Cancel</button>\n        <button id="mcp-save-btn" class="mcp-secondary-btn" type="button">Save Server</button>\n        <button id="mcp-save-connect-btn" class="mcp-primary-btn" type="button">Save and Connect</button>\n      </div>\n    </section>\n  `;
  })()}\n\n    <div class="mcp-server-list">\n      ${
    STATE.servers.length
      ? (function (servers = []) {
          return [...servers].sort((a, b) =>
            Boolean(a.connected) !== Boolean(b.connected)
              ? Number(Boolean(b.connected)) - Number(Boolean(a.connected))
              : Boolean(a.enabled) !== Boolean(b.enabled)
                ? Number(Boolean(b.enabled)) - Number(Boolean(a.enabled))
                : String(a.name ?? '').localeCompare(String(b.name ?? '')),
          );
        })(STATE.servers)
          .map((server) => {
            const tools =
                ((serverId = server.id),
                STATE.tools
                  .filter((tool) => tool?._mcpServerId === serverId)
                  .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))),
              summary = (function (server) {
                return 'builtin' === server.transport
                  ? escapeHtml(
                      server.description || 'Built into Joanium and ready without extra setup.',
                    )
                  : 'http' === server.transport
                    ? escapeHtml(server.url || 'No URL configured')
                    : escapeHtml(
                        [
                          String(server.command ?? '').trim(),
                          ...(Array.isArray(server.args) ? server.args : []),
                        ]
                          .filter(Boolean)
                          .join(' ') || 'No command configured',
                      );
              })(server);
            var serverId;
            return `\n      <article class="mcp-server-card${server.connected ? ' is-connected' : ''}">\n        <div class="mcp-server-header">\n          <div class="mcp-server-copy">\n            <div class="mcp-server-title-row">\n              <h4>${escapeHtml(server.name || 'Unnamed MCP Server')}</h4>\n              <span class="mcp-status-badge ${server.connected ? 'is-on' : 'is-off'}">\n                ${server.connected ? 'Connected' : 'Disconnected'}\n              </span>\n              ${server.builtin ? '<span class="mcp-status-badge is-ready">Out of the box</span>' : ''}\n              ${server.enabled ? '<span class="mcp-status-badge is-auto">Auto-connect</span>' : ''}\n            </div>\n            <p>${(function (
              transport = 'stdio',
            ) {
              return 'builtin' === transport ? 'Built-in' : 'http' === transport ? 'HTTP' : 'STDIO';
            })(
              server.transport,
            )} server${tools.length ? ` - ${tools.length} tool${1 === tools.length ? '' : 's'}` : ''}</p>\n          </div>\n        </div>\n\n        <div class="mcp-command-preview">${summary}</div>\n\n        <div class="mcp-card-actions">\n          <button class="mcp-secondary-btn" type="button" data-mcp-action="${server.connected ? 'disconnect' : 'connect'}" data-server-id="${escapeHtml(server.id)}">\n            ${server.connected ? 'Disconnect' : 'Connect'}\n          </button>\n          ${server.builtin ? '' : `\n          <button class="mcp-secondary-btn" type="button" data-mcp-action="edit" data-server-id="${escapeHtml(server.id)}">\n            Edit\n          </button>\n          <button class="mcp-danger-btn" type="button" data-mcp-action="remove" data-server-id="${escapeHtml(server.id)}">\n            Delete\n          </button>`}\n        </div>\n      </article>\n    `;
          })
          .join('')
      : '\n      <div class="settings-empty-card">\n        No MCP servers yet. Add one here, then connect it to expose browser-control tools inside chat.\n      </div>\n    '
  }\n    </div>\n  `),
    document.getElementById('mcp-add-btn')?.addEventListener('click', () => {
      openEditor('create', { transport: 'stdio', enabled: !0 });
    }),
    document.getElementById('mcp-refresh-btn')?.addEventListener('click', () => {
      loadMCPPanel({ force: !0, keepFeedback: !0 });
    }),
    document.getElementById('mcp-cancel-btn')?.addEventListener('click', () => {
      ((STATE.editor = null), setFeedback(), renderPanel());
    }),
    document.getElementById('mcp-save-btn')?.addEventListener('click', () => {
      saveEditor(!1);
    }),
    document.getElementById('mcp-save-connect-btn')?.addEventListener('click', () => {
      saveEditor(!0);
    }),
    document.getElementById('mcp-server-transport')?.addEventListener('change', () => {
      !(function () {
        const transport = document.getElementById('mcp-server-transport')?.value ?? 'stdio',
          stdio = document.getElementById('mcp-stdio-fields'),
          http = document.getElementById('mcp-http-fields');
        (stdio && (stdio.hidden = 'stdio' !== transport),
          http && (http.hidden = 'http' !== transport));
      })();
    }),
    document.querySelectorAll('[data-mcp-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-mcp-action'),
          serverId = button.getAttribute('data-server-id');
        if (
          serverId &&
          ('connect' === action &&
            (async function (serverId) {
              const server = STATE.servers.find((entry) => entry.id === serverId);
              if (server)
                try {
                  const result = await window.electronAPI?.invoke?.('mcp-connect-server', serverId);
                  if (!result?.ok)
                    throw new Error(result?.error ?? 'Could not connect the MCP server.');
                  (await refreshData(),
                    setFeedback(`"${server.name}" connected successfully.`, 'success'),
                    renderPanel());
                } catch (err) {
                  (setFeedback(err.message || `Could not connect "${server.name}".`, 'error'),
                    renderPanel());
                }
            })(serverId),
          'disconnect' === action &&
            (async function (serverId) {
              const server = STATE.servers.find((entry) => entry.id === serverId);
              if (server)
                try {
                  const result = await window.electronAPI?.invoke?.(
                    'mcp-disconnect-server',
                    serverId,
                  );
                  if (!result?.ok)
                    throw new Error(result?.error ?? 'Could not disconnect the MCP server.');
                  (await refreshData(),
                    setFeedback(`"${server.name}" disconnected.`, 'success'),
                    renderPanel());
                } catch (err) {
                  (setFeedback(err.message || `Could not disconnect "${server.name}".`, 'error'),
                    renderPanel());
                }
            })(serverId),
          'remove' === action &&
            (async function (serverId) {
              const server = STATE.servers.find((entry) => entry.id === serverId);
              if (server && window.confirm(`Delete MCP server "${server.name}"?`))
                try {
                  const result = await window.electronAPI?.invoke?.('mcp-remove-server', serverId);
                  if (!result?.ok)
                    throw new Error(result?.error ?? 'Could not delete the MCP server.');
                  (STATE.editor?.server?.id === serverId && (STATE.editor = null),
                    await refreshData(),
                    setFeedback(`"${server.name}" deleted.`, 'success'),
                    renderPanel());
                } catch (err) {
                  (setFeedback(err.message || `Could not delete "${server.name}".`, 'error'),
                    renderPanel());
                }
            })(serverId),
          'edit' === action)
        ) {
          const server = STATE.servers.find((entry) => entry.id === serverId);
          server && openEditor('edit', server);
        }
      });
    }));
}
function openEditor(mode, server = {}) {
  ((STATE.editor = {
    mode: mode,
    server: {
      id: server.id ?? `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: server.name ?? '',
      transport: server.transport ?? 'stdio',
      command: server.command ?? '',
      args: Array.isArray(server.args) ? server.args : [],
      env: server.env ?? {},
      url: server.url ?? '',
      enabled: !1 !== server.enabled,
      connected: Boolean(server.connected),
    },
  }),
    setFeedback(),
    renderPanel());
}
async function refreshData() {
  const [servers, toolsResult] = await Promise.all([
    window.electronAPI?.invoke?.('mcp-list-servers') ?? [],
    window.electronAPI?.invoke?.('mcp-get-tools') ?? { ok: !1, tools: [] },
  ]);
  ((STATE.servers = Array.isArray(servers) ? servers : []),
    (STATE.tools = toolsResult?.ok ? (toolsResult.tools ?? []) : []),
    (STATE.loaded = !0));
}
async function saveEditor(connectAfterSave = !1) {
  const existing = STATE.editor?.server;
  if (existing)
    try {
      const payload = (function () {
          const editing = STATE.editor?.server;
          if (!editing) throw new Error('No MCP server is being edited.');
          const transport = document.getElementById('mcp-server-transport')?.value ?? 'stdio',
            payload = {
              id: editing.id,
              name: document.getElementById('mcp-server-name')?.value.trim() ?? '',
              transport: transport,
              enabled: Boolean(document.getElementById('mcp-server-enabled')?.checked),
            };
          if (!payload.name) throw new Error('Server name is required.');
          if ('http' === transport) {
            const rawUrl = document.getElementById('mcp-server-url')?.value.trim() ?? '';
            if (!rawUrl) throw new Error('Server URL is required for HTTP transport.');
            let url;
            try {
              url = new URL(rawUrl);
            } catch {
              throw new Error('Enter a valid HTTP server URL.');
            }
            payload.url = url.toString().replace(/\/$/, '');
          } else {
            if (
              ((payload.command =
                document.getElementById('mcp-server-command')?.value.trim() ?? ''),
              !payload.command)
            )
              throw new Error('Command is required for STDIO transport.');
            ((payload.args = (function (text = '') {
              return String(text)
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            })(document.getElementById('mcp-server-args')?.value ?? '')),
              (payload.env = (function (text = '') {
                const env = {};
                for (const rawLine of String(text).split(/\r?\n/)) {
                  const line = rawLine.trim();
                  if (!line) continue;
                  const eq = line.indexOf('=');
                  if (eq < 1) throw new Error(`Invalid env line "${line}". Use KEY=VALUE format.`);
                  const key = line.slice(0, eq).trim(),
                    value = line.slice(eq + 1);
                  if (!key) throw new Error(`Invalid env line "${line}". Missing key.`);
                  env[key] = value;
                }
                return env;
              })(document.getElementById('mcp-server-env')?.value ?? '')));
          }
          return payload;
        })(),
        shouldReconnect = Boolean(existing.connected);
      shouldReconnect &&
        (await window.electronAPI?.invoke?.('mcp-disconnect-server', payload.id).catch(() => {}));
      const saveResult = await window.electronAPI?.invoke?.('mcp-save-server', payload);
      if (!1 === saveResult?.ok)
        throw new Error(saveResult.error ?? 'Could not save the MCP server.');
      if (connectAfterSave || shouldReconnect) {
        const connectResult = await window.electronAPI?.invoke?.('mcp-connect-server', payload.id);
        if (!connectResult?.ok)
          throw new Error(connectResult?.error ?? 'Could not connect the MCP server.');
        setFeedback(`"${payload.name}" is connected and ready.`, 'success');
      } else setFeedback(`"${payload.name}" saved.`, 'success');
      ((STATE.editor = null), await refreshData(), renderPanel());
    } catch (err) {
      (setFeedback(err.message || 'Could not save the MCP server.', 'error'), renderPanel());
    }
}
export async function loadMCPPanel({ force: force = !1, keepFeedback: keepFeedback = !1 } = {}) {
  const panel = document.getElementById('mcp-settings-panel');
  if (panel) {
    (keepFeedback || setFeedback(),
      (STATE.loaded && !force) ||
        (panel.innerHTML = '<div class="cx-loading">Loading MCP servers...</div>'));
    try {
      (await refreshData(), renderPanel());
    } catch (err) {
      panel.innerHTML = `<div class="cx-loading">Could not load MCP servers: ${escapeHtml(err.message)}</div>`;
    }
  }
}
