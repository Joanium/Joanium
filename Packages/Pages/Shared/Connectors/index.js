import { CONNECTORS, FREE_CONNECTORS, loadFeatureConnectorDefs } from './Catalog/ConnectorDefs.js';
import { buildFreeCard, setStatus, setConnectBtnState } from './Catalog/ConnectorCards.js';
export const cxState = { statuses: {}, pending: {}, freeStatuses: {}, freeKeys: {}, loaded: !1 };
function renderPanel() {
  const list = document.getElementById('connector-list');
  if (!list) return;
  list.innerHTML = '';
  const svcHeader = document.createElement('div');
  ((svcHeader.className = 'cx-section-header'),
    (svcHeader.innerHTML =
      '\n    <div class="cx-section-title">Service Connectors</div>\n    <div class="cx-section-sub">Requires authentication</div>'),
    list.appendChild(svcHeader),
    CONNECTORS.forEach((def) =>
      list.appendChild(
        (function (def, cxState, onConnect, onDisconnect) {
          const status = cxState.statuses[def.id] ?? { enabled: !1 },
            isConnected = Boolean(status.enabled),
            services = status.services ?? {},
            card = document.createElement('div');
          ((card.className = 'cx-card' + (isConnected ? ' cx-connected' : '')),
            (card.id = `cx-card-${def.id}`));
          const header = document.createElement('div');
          ((header.className = 'cx-card-header'),
            (header.innerHTML = `\n    <div class="cx-icon">${def.icon}</div>\n    <div class="cx-info">\n      <h4>${def.name}</h4>\n      <p>${def.description}</p>\n    </div>\n    <span class="cx-badge ${isConnected ? 'cx-badge--on' : 'cx-badge--off'}">\n      ${isConnected ? 'Connected' : 'Not connected'}\n    </span>\n    <button class="cx-expand-btn" type="button" aria-label="Toggle connector details">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>\n    </button>`),
            card.appendChild(header));
          const details = document.createElement('div');
          details.className = 'cx-card-details';
          header.querySelector('.cx-expand-btn').addEventListener('click', () => {
            card.classList.toggle('cx-expanded');
          });
          const caps = document.createElement('div');
          if (
            ((caps.className = 'cx-capabilities'),
            (def.capabilities ?? []).forEach((cap) => {
              const tag = document.createElement('span');
              ((tag.className = 'cx-cap-tag'), (tag.textContent = cap), caps.appendChild(tag));
            }),
            details.appendChild(caps),
            isConnected && status.accountInfo)
          ) {
            const info = document.createElement('div');
            info.className = 'cx-account-info';
            const display = status.accountInfo.email || status.accountInfo.username || 'Connected';
            ((info.innerHTML = `<div class="cx-account-avatar">${display[0].toUpperCase()}</div><span>${display}</span>`),
              details.appendChild(info));
          }
          if (isConnected && def.subServices?.length) {
            const badgesEl = (function (def, services = {}) {
              if (!def.subServices?.length) return null;
              const wrap = document.createElement('div');
              ((wrap.className = 'cx-service-badges'),
                (wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px;'));
              for (const svc of def.subServices) {
                const enabled = !0 === services[svc.key],
                  badge = document.createElement('div');
                ((badge.className =
                  'cx-service-badge ' +
                  (enabled ? 'cx-service-badge--on' : 'cx-service-badge--off')),
                  (badge.style.cssText = `\n      display:inline-flex;align-items:center;gap:5px;\n      padding:4px 10px;border-radius:20px;font-size:12px;font-family:var(--font-ui);\n      border:1px solid ${enabled ? 'var(--color-border-success)' : 'var(--color-border-tertiary)'};\n      background:${enabled ? 'var(--color-background-success)' : 'var(--color-background-secondary)'};\n      color:${enabled ? 'var(--color-text-success)' : 'var(--color-text-secondary)'};\n      cursor:${enabled ? 'default' : 'pointer'};\n    `));
                const dot = document.createElement('span');
                ((dot.textContent = enabled ? '●' : '○'), (dot.style.fontSize = '8px'));
                const label = document.createElement('span'),
                  iconHtml = svc.icon
                    ? `<span style="display:inline-flex;align-items:center;width:16px;height:16px;">${svc.icon.replace(/width: 26px; height: 26px;/, 'width: 100%; height: 100%;')}</span>`
                    : '';
                ((label.style.display = 'inline-flex'),
                  (label.style.alignItems = 'center'),
                  (label.style.gap = '4px'),
                  (label.innerHTML = iconHtml ? `${iconHtml} <span>${svc.name}</span>` : svc.name),
                  badge.append(dot, label),
                  enabled ||
                    ((badge.title = `${svc.name} API not detected. Click to enable it in Google Cloud.`),
                    badge.addEventListener('click', () => {
                      Object.assign(document.createElement('a'), {
                        href: svc.apiUrl,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      }).click();
                    })),
                  wrap.appendChild(badge));
              }
              return wrap;
            })(def, services);
            if (badgesEl) {
              const badgeWrap = document.createElement('div');
              badgeWrap.style.cssText = 'padding:0 16px 4px;';
              const badgeLabel = document.createElement('div');
              if (
                ((badgeLabel.style.cssText =
                  'font-size:11px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;'),
                (badgeLabel.textContent = 'Detected services'),
                badgeWrap.appendChild(badgeLabel),
                badgeWrap.appendChild(badgesEl),
                def.featureId && def.serviceRefreshMethod)
              ) {
                const refreshBtn = document.createElement('button');
                ((refreshBtn.style.cssText =
                  'font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:4px 0;text-decoration:underline;'),
                  (refreshBtn.textContent = 'Re-check services'),
                  refreshBtn.addEventListener('click', async () => {
                    ((refreshBtn.textContent = 'Checking...'), (refreshBtn.disabled = !0));
                    const res = await window.featureAPI?.invoke?.(
                      def.featureId,
                      def.serviceRefreshMethod,
                      {},
                    );
                    res?.ok
                      ? ((cxState.statuses[def.id] = {
                          ...cxState.statuses[def.id],
                          services: res.services,
                        }),
                        renderPanel())
                      : ((refreshBtn.textContent = `Error: ${res?.error ?? 'Unknown'}`),
                        setTimeout(() => {
                          ((refreshBtn.textContent = 'Re-check services'),
                            (refreshBtn.disabled = !1));
                        }, 3e3));
                  }),
                  badgeWrap.appendChild(refreshBtn));
              }
              details.appendChild(badgeWrap);
            }
          }
          if (def.automations?.length) {
            const autoSec = document.createElement('div');
            ((autoSec.className = 'cx-auto-section'),
              (autoSec.innerHTML = '<div class="cx-auto-label">Suggested Automations</div>'),
              def.automations.forEach((a) => {
                const item = document.createElement('div');
                ((item.className = 'cx-auto-item'),
                  (item.innerHTML = `<strong>${a.name}</strong> - <span>${a.description}</span>`),
                  autoSec.appendChild(item));
              }),
              details.appendChild(autoSec));
          }
          const statusEl = document.createElement('div');
          ((statusEl.className = 'cx-status-msg'),
            (statusEl.id = `cx-status-${def.id}`),
            details.appendChild(statusEl));
          const fieldsWrap = document.createElement('div');
          if (
            ((fieldsWrap.className = 'cx-fields'),
            (fieldsWrap.id = `cx-fields-${def.id}`),
            isConnected && (fieldsWrap.style.display = 'none'),
            !isConnected && def.setupSteps?.length)
          ) {
            const stepsEl = (function (def) {
              if (!def.setupSteps?.length) return null;
              const wrap = document.createElement('div');
              wrap.style.cssText = 'margin:10px 0;';
              const title = document.createElement('div');
              return (
                (title.style.cssText =
                  'font-size:11px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;'),
                (title.textContent = 'Setup steps'),
                wrap.appendChild(title),
                def.setupSteps.forEach((step, i) => {
                  const row = document.createElement('div');
                  row.style.cssText =
                    'display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12px;color:var(--text-secondary);';

                  const num = document.createElement('span');
                  num.style.cssText =
                    'min-width:16px;font-weight:500;color:var(--text-muted);flex-shrink:0;';
                  num.textContent = `${i + 1}.`;

                  const content = document.createElement('span');
                  content.style.cssText = 'flex:1;line-height:1.5;';

                  // Detect URLs in the step text and render them with a copy button
                  const urlPattern = /(https?:\/\/[^\s]+)/g;
                  const parts = step.split(urlPattern);
                  parts.forEach((part, _pi) => {
                    if (urlPattern.test(part)) {
                      const urlSpan = document.createElement('span');
                      urlSpan.style.cssText =
                        'display:inline-flex;align-items:center;gap:4px;background:var(--bg-subtle,rgba(0,0,0,0.08));border-radius:4px;padding:1px 6px;font-family:monospace;font-size:11px;color:var(--text-primary);';
                      urlSpan.textContent = part;

                      const copyBtn = document.createElement('button');
                      copyBtn.title = 'Copy';
                      copyBtn.style.cssText =
                        'background:none;border:none;cursor:pointer;padding:0;margin-left:2px;color:var(--text-muted);display:inline-flex;align-items:center;flex-shrink:0;opacity:0.7;';
                      copyBtn.innerHTML =
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                      copyBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(part).then(() => {
                          copyBtn.innerHTML =
                            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                          copyBtn.style.color = 'var(--accent-green,#22c55e)';
                          setTimeout(() => {
                            copyBtn.innerHTML =
                              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                            copyBtn.style.color = '';
                          }, 1500);
                        });
                      });

                      urlSpan.appendChild(copyBtn);
                      content.appendChild(urlSpan);
                    } else if (part) {
                      content.appendChild(document.createTextNode(part));
                    }
                    urlPattern.lastIndex = 0; // reset stateful regex
                  });

                  row.appendChild(num);
                  row.appendChild(content);
                  wrap.appendChild(row);
                }),
                wrap
              );
            })(def);
            stepsEl && fieldsWrap.appendChild(stepsEl);
          }
          (def.fields.forEach((field) => {
            const wrap = document.createElement('div');
            wrap.className = 'cx-field-wrap';
            const label = document.createElement('label');
            ((label.className = 'cx-field-label'),
              (label.textContent = field.label),
              (label.htmlFor = `cx-field-${def.id}-${field.key}`));
            const inputWrap = document.createElement('div');
            inputWrap.className = 'key-input-wrap';
            const input = document.createElement('input');
            if (
              ((input.id = `cx-field-${def.id}-${field.key}`),
              (input.type = 'password' === field.type ? 'password' : 'text'),
              (input.className = 'cx-field-input'),
              (input.placeholder = field.placeholder),
              (input.autocomplete = 'off'),
              (input.spellcheck = !1),
              input.addEventListener('input', () => {
                (cxState.pending[def.id] || (cxState.pending[def.id] = {}),
                  (cxState.pending[def.id][field.key] = input.value.trim()));
              }),
              inputWrap.appendChild(input),
              'password' === field.type)
            ) {
              const eyeBtn = document.createElement('button');
              ((eyeBtn.type = 'button'),
                (eyeBtn.className = 'key-eye'),
                (eyeBtn.title = 'Show / hide'),
                (eyeBtn.innerHTML =
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke-width="1.8"/></svg>'),
                eyeBtn.addEventListener('click', () => {
                  input.type = 'password' === input.type ? 'text' : 'password';
                }),
                inputWrap.appendChild(eyeBtn));
            }
            if ((wrap.append(label, inputWrap), field.hint)) {
              const hint = document.createElement('div');
              ((hint.className = 'cx-field-hint'),
                (hint.textContent = field.hint),
                wrap.appendChild(hint));
            }
            fieldsWrap.appendChild(wrap);
          }),
            details.appendChild(fieldsWrap));
          const actions = document.createElement('div');
          actions.className = 'cx-actions';
          const helpLink = document.createElement('a');
          ((helpLink.className = 'cx-help-link'),
            (helpLink.textContent = def.helpText),
            (helpLink.href = '#'),
            helpLink.addEventListener('click', (e) => {
              (e.preventDefault(),
                Object.assign(document.createElement('a'), {
                  href: def.helpUrl,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }).click());
            }),
            actions.appendChild(helpLink));
          const btnGroup = document.createElement('div');
          if (((btnGroup.className = 'cx-btn-group'), isConnected)) {
            const updateBtn = document.createElement('button');
            ((updateBtn.className = 'cx-secondary-btn'),
              (updateBtn.textContent = 'Update credentials'),
              updateBtn.addEventListener('click', () => {
                ((fieldsWrap.style.display = ''), (updateBtn.style.display = 'none'));
              }),
              btnGroup.appendChild(updateBtn));
            const disconnectBtn = document.createElement('button');
            ((disconnectBtn.className = 'cx-disconnect-btn'),
              (disconnectBtn.textContent = 'Disconnect'),
              disconnectBtn.addEventListener('click', () => onDisconnect(def.id)),
              btnGroup.appendChild(disconnectBtn));
          } else {
            const connectBtn = document.createElement('button');
            ((connectBtn.id = `cx-connect-btn-${def.id}`),
              (connectBtn.className = 'cx-connect-btn'),
              (connectBtn.textContent =
                def.connectLabel ??
                ('google' === def.oauthType ? 'Sign in with Google' : `Connect ${def.name}`)),
              connectBtn.addEventListener('click', () => onConnect(def.id, def)),
              btnGroup.appendChild(connectBtn));
          }
          return (
            actions.appendChild(btnGroup),
            details.appendChild(actions),
            card.appendChild(details),
            card
          );
        })(def, cxState, handleConnect, handleDisconnect),
      ),
    ));
  const freeHeader = document.createElement('div');
  ((freeHeader.className = 'cx-section-header cx-section-header--free'),
    (freeHeader.innerHTML =
      '\n    <div class="cx-section-title">Free APIs</div>\n    <div class="cx-section-sub">Enabled by default, toggle to disable</div>'),
    list.appendChild(freeHeader),
    FREE_CONNECTORS.forEach((def) => list.appendChild(buildFreeCard(def, cxState))));
}
async function handleConnect(id, def) {
  def.featureId && def.connectMethod
    ? await (async function (id, def) {
        const credentials = cxState.pending[id] ?? {},
          missing = def.fields.filter((f) => !credentials[f.key]?.trim());
        if (missing.length)
          setStatus(id, `Please fill in: ${missing.map((f) => f.label).join(', ')}`, 'error');
        else {
          (setConnectBtnState(id, !0, def.connectingLabel ?? 'Connecting...'),
            def.oauthType
              ? setStatus(
                  id,
                  'A browser window will open - sign in, grant access, then return here.',
                )
              : setStatus(id, ''));
          try {
            const result = await window.featureAPI?.invoke?.(
              def.featureId,
              def.connectMethod,
              credentials,
            );
            if (!result?.ok) throw new Error(result?.error ?? 'Connection failed');
            const enabledCount = Object.values(result.services ?? {}).filter(Boolean).length;
            ((cxState.statuses[id] = {
              enabled: !0,
              connectedAt: new Date().toISOString(),
              accountInfo: result.accountInfo ?? {
                email: result.email ?? null,
                username: result.username ?? null,
              },
              services: result.services ?? {},
            }),
              (cxState.pending[id] = {}));
            const defaultMessage = result.email
                ? `Connected as ${result.email}`
                : `Connected ${def.name}`,
              serviceMessage = enabledCount
                ? ` - ${enabledCount} service${1 !== enabledCount ? 's' : ''} detected`
                : '';
            (setStatus(id, result.message ?? `${defaultMessage}${serviceMessage}`, 'success'),
              setTimeout(renderPanel, 800));
          } catch (err) {
            (setStatus(id, `Failed: ${err.message}`, 'error'),
              setConnectBtnState(id, !1, def.connectLabel ?? `Connect ${def.name}`));
          }
        }
      })(id, def)
    : await (async function (id, def) {
        const credentials = cxState.pending[id] ?? {},
          missing = def.fields.filter((f) => !credentials[f.key]?.trim());
        if (missing.length)
          setStatus(id, `Please fill in: ${missing.map((f) => f.label).join(', ')}`, 'error');
        else {
          (setConnectBtnState(id, !0, 'Connecting...'), setStatus(id, ''));
          try {
            await window.electronAPI?.invoke?.('save-connector', id, credentials);
            const validation = await window.electronAPI?.invoke?.('validate-connector', id);
            if (!validation?.ok) throw new Error(validation?.error ?? 'Connection failed');
            ((cxState.statuses[id] = {
              enabled: !0,
              connectedAt: new Date().toISOString(),
              accountInfo: {
                email: validation.email ?? null,
                username: validation.username ?? null,
              },
              services: {},
            }),
              (cxState.pending[id] = {}),
              setStatus(id, 'Connected successfully!', 'success'),
              setTimeout(renderPanel, 800));
          } catch (err) {
            (await window.electronAPI?.invoke?.('remove-connector', id).catch(() => {}),
              (cxState.statuses[id] = { enabled: !1 }),
              setStatus(id, `Failed: ${err.message}`, 'error'),
              setConnectBtnState(id, !1, `Connect ${def.name}`));
          }
        }
      })(id, def);
}
async function handleDisconnect(id) {
  try {
    (await window.electronAPI?.invoke?.('remove-connector', id),
      (cxState.statuses[id] = { enabled: !1, accountInfo: null, services: {} }),
      (cxState.pending[id] = {}),
      renderPanel());
  } catch (err) {
    setStatus(id, `Could not disconnect: ${err.message}`, 'error');
  }
}
export async function loadConnectorsPanel() {
  const list = document.getElementById('connector-list');
  if (list) {
    cxState.loaded || (list.innerHTML = '<div class="cx-loading">Loading connectors...</div>');
    try {
      await loadFeatureConnectorDefs();
      const statuses = (await window.electronAPI?.invoke?.('get-connectors')) ?? {};
      cxState.statuses = {};
      for (const [name, s] of Object.entries(statuses))
        s.isFree || (cxState.statuses[name] = { ...s, accountInfo: null, services: {} });
      await Promise.all(
        Object.entries(cxState.statuses)
          .filter(([, s]) => s.enabled)
          .map(async ([name]) => {
            const v = await window.electronAPI
              ?.invoke?.('validate-connector', name)
              .catch(() => null);
            if (
              (v?.ok &&
                (cxState.statuses[name].accountInfo = {
                  email: v.email ?? null,
                  username: v.username ?? null,
                }),
              'google' === name)
            ) {
              const creds = await window.electronAPI
                ?.invoke?.('get-connector-safe-creds', 'google')
                .catch(() => null);
              creds?.ok && creds.services && (cxState.statuses[name].services = creds.services);
            }
          }),
      );
      for (const def of FREE_CONNECTORS) {
        const config = await window.electronAPI
          ?.invoke?.('get-free-connector-config', def.id)
          .catch(() => null);
        config
          ? ((cxState.freeStatuses[def.id] = config.enabled ?? !0),
            !def.noKey &&
              config.credentials?.apiKey &&
              (cxState.freeKeys[def.id] = { saved: !0, value: config.credentials.apiKey }))
          : (cxState.freeStatuses[def.id] = !0);
      }
      ((cxState.loaded = !0), renderPanel());
    } catch (err) {
      list &&
        (list.innerHTML = `<div class="cx-loading">Could not load connectors: ${err.message}</div>`);
    }
  }
}
