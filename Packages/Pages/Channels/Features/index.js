const api = window.electronAPI;
function setFb(channel, msg, tone = '') {
  const el = document.getElementById(`ch-fb-${channel}`);
  el && ((el.textContent = msg), (el.className = 'ch-feedback' + (tone ? ' ' + tone : '')));
}
function setStatus(channel, connected) {
  const dot = document.getElementById(`ch-dot-${channel}`),
    text = document.getElementById(`ch-status-${channel}`);
  (dot && (dot.className = 'ch-status-dot' + (connected ? ' is-on' : '')),
    text && (text.textContent = connected ? 'Connected & active' : 'Not connected'));
}
function setToggle(channel, enabled, configured) {
  const t = document.getElementById(`ch-toggle-${channel}`);
  t && ((t.checked = enabled), (t.disabled = !configured));
}
function setStepsVisible(channel, visible) {
  const el = document.getElementById(`ch-steps-${channel}`);
  el && (el.hidden = !visible);
}
function setDisconnectVisible(channel, visible) {
  const el = document.getElementById(`ch-disc-${channel}`);
  el && (el.hidden = !visible);
}
let _wired = !1;
async function disconnectChannel(name) {
  if (
    window.confirm(
      `Disconnect ${{ telegram: 'Telegram', whatsapp: 'WhatsApp', discord: 'Discord', slack: 'Slack' }[name] || name}? The bot will stop replying.`,
    )
  )
    try {
      const r = await api?.invoke?.('remove-channel', name);
      if (!r?.ok) throw new Error(r?.error ?? 'Failed');
      if (
        (setStatus(name, !1),
        setToggle(name, !1, !1),
        setStepsVisible(name, !0),
        setDisconnectVisible(name, !1),
        'telegram' === name)
      ) {
        const t = document.getElementById('ch-tg-token');
        t && ((t.value = ''), (t.placeholder = '1234567890:ABCdef…'));
      } else if ('whatsapp' === name) {
        const s = document.getElementById('ch-wa-sid');
        s && ((s.value = ''), (s.placeholder = 'ACxxxxxxxxxxxxxxxx'));
        const t = document.getElementById('ch-wa-token');
        t && ((t.value = ''), (t.placeholder = 'Your auth token'));
        const n = document.getElementById('ch-wa-number');
        n && (n.value = '');
      } else if ('discord' === name) {
        const t = document.getElementById('ch-dc-token');
        t && ((t.value = ''), (t.placeholder = 'Your bot token'));
        const c = document.getElementById('ch-dc-channel');
        c && (c.value = '');
      } else if ('slack' === name) {
        const t = document.getElementById('ch-sk-token');
        t && ((t.value = ''), (t.placeholder = 'xoxb-your-token'));
        const c = document.getElementById('ch-sk-channel');
        c && (c.value = '');
      }
      setFb(name, 'Disconnected.', '');
    } catch (err) {
      setFb(name, `Error: ${err.message}`, 'error');
    }
}
let _injected = !1;
export async function loadChannelsPanel() {
  const container = document.getElementById('channels-settings-panel');
  if (container) {
    _injected ||
      ((container.innerHTML =
        '\n<div class="ch-panel">\n\n  \x3c!-- ── Telegram card ── --\x3e\n  <div class="ch-card" id="ch-card-telegram">\n    <div class="ch-card-header">\n      <div class="ch-icon ch-icon--telegram">\n        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">\n          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>\n        </svg>\n      </div>\n      <div class="ch-title-group">\n        <div class="ch-name">Telegram</div>\n        <div class="ch-status">\n          <span class="ch-status-dot" id="ch-dot-telegram"></span>\n          <span id="ch-status-telegram">Not connected</span>\n        </div>\n      </div>\n      <label class="ch-toggle" title="Enable / disable">\n        <input type="checkbox" class="ch-toggle-input" id="ch-toggle-telegram" disabled />\n        <span class="ch-toggle-track"></span>\n      </label>\n    </div>\n\n    <div class="ch-steps" id="ch-steps-telegram">\n      <div class="ch-steps-label">Setup — under 60 seconds</div>\n      <ol class="ch-steps-list">\n        <li>Open Telegram and search for <strong>@BotFather</strong></li>\n        <li>Send <code>/newbot</code> → follow the prompts to name your bot</li>\n        <li>BotFather gives you a token like <code>1234567890:ABCdef…</code> — paste it below</li>\n        <li>Then message your new bot once to start the conversation</li>\n      </ol>\n    </div>\n\n    <div class="ch-form">\n      <div class="ch-field">\n        <label class="ch-label" for="ch-tg-token">Bot Token <span class="ch-req">*</span></label>\n        <div class="ch-input-wrap">\n          <input type="password" id="ch-tg-token" class="ch-input" placeholder="1234567890:ABCdef…" autocomplete="off" spellcheck="false" />\n          <button type="button" class="ch-eye" id="ch-eye-tg" title="Show/hide">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n          </button>\n        </div>\n      </div>\n      <div class="ch-actions">\n        <button type="button" class="ch-btn-danger" id="ch-disc-telegram" hidden>Disconnect</button>\n        <button type="button" class="ch-btn-primary" id="ch-connect-telegram">Connect</button>\n      </div>\n      <div class="ch-feedback" id="ch-fb-telegram" aria-live="polite"></div>\n    </div>\n  </div>\n\n  \x3c!-- ── WhatsApp card ── --\x3e\n  <div class="ch-card" id="ch-card-whatsapp">\n    <div class="ch-card-header">\n      <div class="ch-icon ch-icon--whatsapp">\n        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">\n          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>\n        </svg>\n      </div>\n      <div class="ch-title-group">\n        <div class="ch-name">WhatsApp</div>\n        <div class="ch-status">\n          <span class="ch-status-dot" id="ch-dot-whatsapp"></span>\n          <span id="ch-status-whatsapp">Not connected</span>\n        </div>\n      </div>\n      <label class="ch-toggle" title="Enable / disable">\n        <input type="checkbox" class="ch-toggle-input" id="ch-toggle-whatsapp" disabled />\n        <span class="ch-toggle-track"></span>\n      </label>\n    </div>\n\n    <div class="ch-steps" id="ch-steps-whatsapp">\n      <div class="ch-steps-label">Setup via Twilio Sandbox — free, ~3 minutes</div>\n      <ol class="ch-steps-list">\n        <li>Sign up free at <strong>twilio.com</strong> (no credit card needed for sandbox)</li>\n        <li>Go to <strong>Messaging → Try it out → Send a WhatsApp message</strong></li>\n        <li>From your phone, send the join code shown to the sandbox number</li>\n        <li>Copy your <strong>Account SID</strong>, <strong>Auth Token</strong> (from the Console homepage), and the <strong>sandbox number</strong> (e.g. <code>whatsapp:+14155238886</code>)</li>\n      </ol>\n    </div>\n\n    <div class="ch-form">\n      <div class="ch-fields-row">\n        <div class="ch-field">\n          <label class="ch-label" for="ch-wa-sid">Account SID <span class="ch-req">*</span></label>\n          <input type="text" id="ch-wa-sid" class="ch-input" placeholder="ACxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false" />\n        </div>\n        <div class="ch-field">\n          <label class="ch-label" for="ch-wa-token">Auth Token <span class="ch-req">*</span></label>\n          <div class="ch-input-wrap">\n            <input type="password" id="ch-wa-token" class="ch-input" placeholder="Your auth token" autocomplete="off" spellcheck="false" />\n            <button type="button" class="ch-eye" id="ch-eye-wa" title="Show/hide">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n            </button>\n          </div>\n        </div>\n      </div>\n      <div class="ch-field">\n        <label class="ch-label" for="ch-wa-number">Sandbox Number <span class="ch-req">*</span></label>\n        <input type="text" id="ch-wa-number" class="ch-input" placeholder="whatsapp:+14155238886" autocomplete="off" spellcheck="false" />\n        <div class="ch-hint">Include the <code>whatsapp:</code> prefix exactly as shown in Twilio.</div>\n      </div>\n      <div class="ch-actions">\n        <button type="button" class="ch-btn-danger" id="ch-disc-whatsapp" hidden>Disconnect</button>\n        <button type="button" class="ch-btn-primary" id="ch-connect-whatsapp">Connect</button>\n      </div>\n      <div class="ch-feedback" id="ch-fb-whatsapp" aria-live="polite"></div>\n    </div>\n  </div>\n\n  \x3c!-- ── Discord card ── --\x3e\n  <div class="ch-card" id="ch-card-discord">\n    <div class="ch-card-header">\n      <div class="ch-icon ch-icon--discord" style="color:#5865F2;">\n        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>\n      </div>\n      <div class="ch-title-group">\n        <div class="ch-name">Discord</div>\n        <div class="ch-status">\n          <span class="ch-status-dot" id="ch-dot-discord"></span>\n          <span id="ch-status-discord">Not connected</span>\n        </div>\n      </div>\n      <label class="ch-toggle" title="Enable / disable">\n        <input type="checkbox" class="ch-toggle-input" id="ch-toggle-discord" disabled />\n        <span class="ch-toggle-track"></span>\n      </label>\n    </div>\n\n    <div class="ch-steps" id="ch-steps-discord">\n      <div class="ch-steps-label">Setup — ~3 minutes</div>\n      <ol class="ch-steps-list">\n        <li>Go to <strong>discord.com/developers/applications</strong> → New Application → Bot → Add Bot</li>\n        <li>Under <strong>Bot → Privileged Gateway Intents</strong>, turn ON <strong>Message Content Intent</strong> ← this is required to read messages</li>\n        <li>Copy your <strong>Bot Token</strong> (Reset Token if needed)</li>\n        <li>Under <strong>OAuth2 → URL Generator</strong>: check <em>bot</em> scope + <em>Read Messages</em> + <em>Send Messages</em> permissions → open the generated URL to invite the bot to your server</li>\n        <li>Get your <strong>Channel ID</strong>: in Discord, enable Developer Mode (Settings → Advanced), then right-click any channel → Copy Channel ID</li>\n      </ol>\n    </div>\n\n    <div class="ch-form">\n      <div class="ch-fields-row">\n        <div class="ch-field">\n          <label class="ch-label" for="ch-dc-token">Bot Token <span class="ch-req">*</span></label>\n          <div class="ch-input-wrap">\n            <input type="password" id="ch-dc-token" class="ch-input" placeholder="Your bot token" autocomplete="off" spellcheck="false" />\n            <button type="button" class="ch-eye" id="ch-eye-dc" title="Show/hide">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n            </button>\n          </div>\n        </div>\n        <div class="ch-field">\n          <label class="ch-label" for="ch-dc-channel">Channel ID <span class="ch-req">*</span></label>\n          <input type="text" id="ch-dc-channel" class="ch-input" placeholder="123456789012345678" autocomplete="off" spellcheck="false" />\n          <div class="ch-hint">Right-click channel in Discord → Copy Channel ID (enable Developer Mode in Settings → Advanced first)</div>\n        </div>\n      </div>\n      <div class="ch-actions">\n        <button type="button" class="ch-btn-danger" id="ch-disc-discord" hidden>Disconnect</button>\n        <button type="button" class="ch-btn-primary" id="ch-connect-discord">Connect</button>\n      </div>\n      <div class="ch-feedback" id="ch-fb-discord" aria-live="polite"></div>\n    </div>\n  </div>\n\n  \x3c!-- ── Slack card ── --\x3e\n  <div class="ch-card" id="ch-card-slack">\n    <div class="ch-card-header">\n      <div class="ch-icon ch-icon--slack" style="color:#E01E5A;">\n        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.27 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.27a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 3.774a2.528 2.528 0 0 1 2.52-2.522 2.528 2.528 0 0 1 2.522 2.522 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zm-1.27 0a2.528 2.528 0 0 1-2.521 2.52 2.528 2.528 0 0 1-2.521-2.52V2.52A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.313zM15.166 18.96a2.528 2.528 0 0 1 2.521 2.52 2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521v-2.52h2.521zm0-1.27a2.528 2.528 0 0 1-2.521-2.52 2.528 2.528 0 0 1 2.521-2.522h6.313A2.528 2.528 0 0 1 24 15.167a2.528 2.528 0 0 1-2.522 2.521h-6.313z"/></svg>\n      </div>\n      <div class="ch-title-group">\n        <div class="ch-name">Slack</div>\n        <div class="ch-status">\n          <span class="ch-status-dot" id="ch-dot-slack"></span>\n          <span id="ch-status-slack">Not connected</span>\n        </div>\n      </div>\n      <label class="ch-toggle" title="Enable / disable">\n        <input type="checkbox" class="ch-toggle-input" id="ch-toggle-slack" disabled />\n        <span class="ch-toggle-track"></span>\n      </label>\n    </div>\n\n    <div class="ch-steps" id="ch-steps-slack">\n      <div class="ch-steps-label">Setup — ~3 minutes</div>\n      <ol class="ch-steps-list">\n        <li>Go to <strong>api.slack.com/apps</strong> → Create New App → From scratch</li>\n        <li>Under <strong>OAuth &amp; Permissions → Bot Token Scopes</strong>, add: <code>channels:history</code>, <code>channels:read</code>, <code>chat:write</code>, <code>groups:history</code></li>\n        <li>Click <strong>Install to Workspace</strong> → copy the <strong>Bot User OAuth Token</strong> (starts with <code>xoxb-</code>)</li>\n        <li>In your Slack workspace, <strong>/invite @YourBotName</strong> into the channel you want monitored</li>\n        <li>Get the <strong>Channel ID</strong>: open the channel in Slack → click the channel name at the top → scroll to the bottom of the popup — the ID starts with <code>C</code></li>\n      </ol>\n    </div>\n\n    <div class="ch-form">\n      <div class="ch-fields-row">\n        <div class="ch-field">\n          <label class="ch-label" for="ch-sk-token">Bot Token <span class="ch-req">*</span></label>\n          <div class="ch-input-wrap">\n            <input type="password" id="ch-sk-token" class="ch-input" placeholder="xoxb-your-token" autocomplete="off" spellcheck="false" />\n            <button type="button" class="ch-eye" id="ch-eye-sk" title="Show/hide">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n            </button>\n          </div>\n        </div>\n        <div class="ch-field">\n          <label class="ch-label" for="ch-sk-channel">Channel ID <span class="ch-req">*</span></label>\n          <input type="text" id="ch-sk-channel" class="ch-input" placeholder="C0123456789" autocomplete="off" spellcheck="false" />\n          <div class="ch-hint">Click the channel name in Slack → scroll to the bottom of the popup to find the ID (starts with C)</div>\n        </div>\n      </div>\n      <div class="ch-actions">\n        <button type="button" class="ch-btn-danger" id="ch-disc-slack" hidden>Disconnect</button>\n        <button type="button" class="ch-btn-primary" id="ch-connect-slack">Connect</button>\n      </div>\n      <div class="ch-feedback" id="ch-fb-slack" aria-live="polite"></div>\n    </div>\n  </div>\n\n</div>\n  '),
      (_injected = !0),
      _wired ||
        ((_wired = !0),
        document.getElementById('ch-eye-tg')?.addEventListener('click', () => {
          const i = document.getElementById('ch-tg-token');
          i && (i.type = 'password' === i.type ? 'text' : 'password');
        }),
        document.getElementById('ch-eye-wa')?.addEventListener('click', () => {
          const i = document.getElementById('ch-wa-token');
          i && (i.type = 'password' === i.type ? 'text' : 'password');
        }),
        document.getElementById('ch-eye-dc')?.addEventListener('click', () => {
          const i = document.getElementById('ch-dc-token');
          i && (i.type = 'password' === i.type ? 'text' : 'password');
        }),
        document.getElementById('ch-eye-sk')?.addEventListener('click', () => {
          const i = document.getElementById('ch-sk-token');
          i && (i.type = 'password' === i.type ? 'text' : 'password');
        }),
        document.getElementById('ch-toggle-telegram')?.addEventListener('change', async (e) => {
          try {
            (await api?.invoke?.('toggle-channel', 'telegram', e.target.checked),
              setStatus('telegram', e.target.checked),
              setFb(
                'telegram',
                e.target.checked ? 'Telegram enabled.' : 'Telegram paused.',
                'success',
              ));
          } catch (err) {
            ((e.target.checked = !e.target.checked), setFb('telegram', err.message, 'error'));
          }
        }),
        document.getElementById('ch-toggle-whatsapp')?.addEventListener('change', async (e) => {
          try {
            (await api?.invoke?.('toggle-channel', 'whatsapp', e.target.checked),
              setStatus('whatsapp', e.target.checked),
              setFb(
                'whatsapp',
                e.target.checked ? 'WhatsApp enabled.' : 'WhatsApp paused.',
                'success',
              ));
          } catch (err) {
            ((e.target.checked = !e.target.checked), setFb('whatsapp', err.message, 'error'));
          }
        }),
        document.getElementById('ch-toggle-discord')?.addEventListener('change', async (e) => {
          try {
            (await api?.invoke?.('toggle-channel', 'discord', e.target.checked),
              setStatus('discord', e.target.checked),
              setFb(
                'discord',
                e.target.checked ? 'Discord enabled.' : 'Discord paused.',
                'success',
              ));
          } catch (err) {
            ((e.target.checked = !e.target.checked), setFb('discord', err.message, 'error'));
          }
        }),
        document.getElementById('ch-toggle-slack')?.addEventListener('change', async (e) => {
          try {
            (await api?.invoke?.('toggle-channel', 'slack', e.target.checked),
              setStatus('slack', e.target.checked),
              setFb('slack', e.target.checked ? 'Slack enabled.' : 'Slack paused.', 'success'));
          } catch (err) {
            ((e.target.checked = !e.target.checked), setFb('slack', err.message, 'error'));
          }
        }),
        document.getElementById('ch-connect-telegram')?.addEventListener('click', async () => {
          const token = document.getElementById('ch-tg-token')?.value.trim(),
            hasSaved = document.getElementById('ch-tg-token')?.placeholder.includes('saved');
          if (!token && !hasSaved)
            return void setFb('telegram', 'Paste your bot token first.', 'error');
          const btn = document.getElementById('ch-connect-telegram');
          ((btn.disabled = !0), setFb('telegram', 'Validating…', ''));
          try {
            if (token) {
              const v = await api?.invoke?.('validate-channel', 'telegram', { botToken: token });
              if (!v?.ok) throw new Error(v?.error ?? 'Invalid token');
              setFb('telegram', `✓ @${v.username} verified`, 'success');
            }
            const payload = {};
            token && (payload.botToken = token);
            const r = await api?.invoke?.('save-channel', 'telegram', payload);
            if (!r?.ok) throw new Error(r?.error ?? 'Save failed');
            (setStatus('telegram', !0),
              setToggle('telegram', !0, !0),
              setStepsVisible('telegram', !1),
              setDisconnectVisible('telegram', !0),
              setFb('telegram', '🎉 Connected! Message your bot to test it.', 'success'));
          } catch (err) {
            setFb('telegram', `Error: ${err.message}`, 'error');
          } finally {
            btn.disabled = !1;
          }
        }),
        document.getElementById('ch-connect-whatsapp')?.addEventListener('click', async () => {
          const sid = document.getElementById('ch-wa-sid')?.value.trim(),
            token = document.getElementById('ch-wa-token')?.value.trim(),
            number = document.getElementById('ch-wa-number')?.value.trim(),
            sidSaved = document.getElementById('ch-wa-sid')?.placeholder.includes('saved'),
            tokenSaved = document.getElementById('ch-wa-token')?.placeholder.includes('saved');
          if (!sid && !sidSaved) return void setFb('whatsapp', 'Enter your Account SID.', 'error');
          if (!token && !tokenSaved)
            return void setFb('whatsapp', 'Enter your Auth Token.', 'error');
          if (!number)
            return void setFb(
              'whatsapp',
              'Enter the sandbox number (with whatsapp: prefix).',
              'error',
            );
          const btn = document.getElementById('ch-connect-whatsapp');
          ((btn.disabled = !0), setFb('whatsapp', 'Validating credentials…', ''));
          try {
            if (sid && token) {
              const v = await api?.invoke?.('validate-channel', 'whatsapp', {
                accountSid: sid,
                authToken: token,
              });
              if (!v?.ok) throw new Error(v?.error ?? 'Invalid credentials');
              setFb('whatsapp', `✓ ${v.friendlyName} verified`, 'success');
            }
            const payload = { fromNumber: number };
            (sid && (payload.accountSid = sid), token && (payload.authToken = token));
            const r = await api?.invoke?.('save-channel', 'whatsapp', payload);
            if (!r?.ok) throw new Error(r?.error ?? 'Save failed');
            (setStatus('whatsapp', !0),
              setToggle('whatsapp', !0, !0),
              setStepsVisible('whatsapp', !1),
              setDisconnectVisible('whatsapp', !0),
              setFb('whatsapp', '🎉 Connected! Send a WhatsApp message to test.', 'success'));
          } catch (err) {
            setFb('whatsapp', `Error: ${err.message}`, 'error');
          } finally {
            btn.disabled = !1;
          }
        }),
        document.getElementById('ch-connect-discord')?.addEventListener('click', async () => {
          const token = document.getElementById('ch-dc-token')?.value.trim(),
            channel = document.getElementById('ch-dc-channel')?.value.trim(),
            tokenSaved = document.getElementById('ch-dc-token')?.placeholder.includes('saved');
          if (!token && !tokenSaved) return void setFb('discord', 'Enter your Bot Token.', 'error');
          if (!channel) return void setFb('discord', 'Enter the Channel ID.', 'error');
          const btn = document.getElementById('ch-connect-discord');
          ((btn.disabled = !0), setFb('discord', 'Validating…', ''));
          try {
            if (token) {
              const v = await api?.invoke?.('validate-channel', 'discord', { botToken: token });
              if (!v?.ok) throw new Error(v?.error ?? 'Invalid bot token');
              setFb('discord', `✓ Bot @${v.username} verified`, 'success');
            }
            const payload = { channelId: channel };
            token && (payload.botToken = token);
            const r = await api?.saveChannel?.('discord', payload);
            if (!r?.ok) throw new Error(r?.error ?? 'Save failed');
            (setStatus('discord', !0),
              setToggle('discord', !0, !0),
              setStepsVisible('discord', !1),
              setDisconnectVisible('discord', !0),
              setFb(
                'discord',
                '🎉 Connected! Send a message in that Discord channel to test.',
                'success',
              ));
          } catch (err) {
            let msg = err.message;
            (msg.includes('403') || msg.includes('Missing Access')
              ? (msg =
                  'Bot cannot access that channel. Make sure: (1) bot is invited to the server, (2) Message Content Intent is ON in the Developer Portal.')
              : (msg.includes('401') || msg.includes('Invalid')) &&
                (msg = 'Invalid bot token. Go to Developer Portal → Bot → Reset Token.'),
              setFb('discord', `Error: ${msg}`, 'error'));
          } finally {
            btn.disabled = !1;
          }
        }),
        document.getElementById('ch-connect-slack')?.addEventListener('click', async () => {
          const token = document.getElementById('ch-sk-token')?.value.trim(),
            channel = document.getElementById('ch-sk-channel')?.value.trim(),
            tokenSaved = document.getElementById('ch-sk-token')?.placeholder.includes('saved');
          if (!token && !tokenSaved)
            return void setFb('slack', 'Enter your Bot Token (xoxb-…).', 'error');
          if (!channel)
            return void setFb('slack', 'Enter the Channel ID (starts with C).', 'error');
          const btn = document.getElementById('ch-connect-slack');
          ((btn.disabled = !0), setFb('slack', 'Validating…', ''));
          try {
            if (token) {
              const v = await api?.invoke?.('validate-channel', 'slack', { botToken: token });
              if (!v?.ok) throw new Error(v?.error ?? 'Invalid bot token');
              setFb('slack', `✓ Connected to ${v.team} as ${v.name}`, 'success');
            }
            const payload = { channelId: channel };
            token && (payload.botToken = token);
            const r = await api?.invoke?.('save-channel', 'slack', payload);
            if (!r?.ok) throw new Error(r?.error ?? 'Save failed');
            (setStatus('slack', !0),
              setToggle('slack', !0, !0),
              setStepsVisible('slack', !1),
              setDisconnectVisible('slack', !0),
              setFb(
                'slack',
                "🎉 Connected! Send a message in that Slack channel to test. (Remember to /invite your bot first if you haven't!)",
                'success',
              ));
          } catch (err) {
            let msg = err.message;
            (msg.includes('channel_not_found') || msg.includes('not_in_channel')
              ? (msg =
                  'Bot cannot access that channel. Run "/invite @YourBotName" in the Slack channel, then try again.')
              : (msg.includes('invalid_auth') || msg.includes('token')) &&
                (msg =
                  'Invalid bot token. Copy the "Bot User OAuth Token" (xoxb-…) from OAuth & Permissions in your Slack app.'),
              setFb('slack', `Error: ${msg}`, 'error'));
          } finally {
            btn.disabled = !1;
          }
        }),
        document
          .getElementById('ch-disc-telegram')
          ?.addEventListener('click', () => disconnectChannel('telegram')),
        document
          .getElementById('ch-disc-whatsapp')
          ?.addEventListener('click', () => disconnectChannel('whatsapp')),
        document
          .getElementById('ch-disc-discord')
          ?.addEventListener('click', () => disconnectChannel('discord')),
        document
          .getElementById('ch-disc-slack')
          ?.addEventListener('click', () => disconnectChannel('slack'))));
    try {
      const res = await api?.invoke?.('get-channels');
      if (!res?.ok) return;
      for (const [name, c] of Object.entries(res.channels ?? {}))
        (setStatus(name, c.configured && c.enabled),
          setToggle(name, c.enabled, c.configured),
          setStepsVisible(name, !c.configured),
          setDisconnectVisible(name, c.configured));
      await (async function () {
        for (const name of ['telegram', 'whatsapp', 'discord', 'slack'])
          try {
            const r = await api?.invoke?.('get-channel-config', name);
            if (!r?.ok) continue;
            const c = r.config;
            if ('telegram' === name && c.botTokenSet) {
              const el = document.getElementById('ch-tg-token');
              el && (el.placeholder = '••••••••  (saved)');
            }
            if ('whatsapp' === name) {
              if (c.accountSidSet) {
                const el = document.getElementById('ch-wa-sid');
                el && (el.placeholder = 'AC……  (saved)');
              }
              if (c.authTokenSet) {
                const el = document.getElementById('ch-wa-token');
                el && (el.placeholder = '••••••••  (saved)');
              }
              if (c.fromNumber) {
                const el = document.getElementById('ch-wa-number');
                el && (el.value = c.fromNumber);
              }
            }
            if ('discord' === name) {
              if (c.botTokenSet) {
                const el = document.getElementById('ch-dc-token');
                el && (el.placeholder = '••••••••  (saved)');
              }
              if (c.channelId) {
                const el = document.getElementById('ch-dc-channel');
                el && (el.value = c.channelId);
              }
            }
            if ('slack' === name) {
              if (c.botTokenSet) {
                const el = document.getElementById('ch-sk-token');
                el && (el.placeholder = '••••••••  (saved)');
              }
              if (c.channelId) {
                const el = document.getElementById('ch-sk-channel');
                el && (el.value = c.channelId);
              }
            }
          } catch {}
      })();
    } catch (err) {
      console.error('[ChannelsPanel] load error:', err);
    }
  }
}
