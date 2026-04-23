const api = window.electronAPI;
function setFb(channel, msg, tone = '') {
  const el = document.getElementById(`ch-fb-${channel}`);
  el && ((el.textContent = msg), (el.className = 'ch-feedback' + (tone ? ' ' + tone : '')));
}
function setStatus(channel, connected) {
  const badge = document.getElementById(`ch-badge-${channel}`);
  const card = document.getElementById(`ch-card-${channel}`);
  badge &&
    ((badge.className = 'ch-badge ' + (connected ? 'ch-badge--on' : 'ch-badge--off')),
    (badge.textContent = connected ? '● Connected' : '○ Not connected'));
  card && card.classList.toggle('ch-connected', connected);
}
function setToggle(channel, enabled, configured) {
  const t = document.getElementById(`ch-toggle-${channel}`);
  t && ((t.checked = enabled), (t.disabled = !configured));
}
function setStepsVisible(channel, visible) {
  const el = document.getElementById(`ch-steps-${channel}`);
  el && (el.hidden = !visible);
  const row = document.getElementById(`ch-enable-row-${channel}`);
  row && (row.hidden = visible);
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
        '\n<div class="ch-panel">\n\n  <!-- \u2500\u2500 Telegram card \u2500\u2500 -->\n  <div class="ch-card" id="ch-card-telegram">\n    <div class="ch-card-header" id="ch-card-header-telegram">\n      <div class="ch-icon ch-icon--telegram">\n        <img src="../../../Assets/Icons/Telegram.png" alt="Telegram" width="22" height="22" style="object-fit:contain;" />\n      </div>\n      <div class="ch-info">\n        <h4>Telegram</h4>\n        <p>Auto-reply to messages via your Telegram bot</p>\n      </div>\n      <span class="ch-badge ch-badge--off" id="ch-badge-telegram">&#9675; Not connected</span>\n      <button type="button" class="ch-expand-btn" id="ch-expand-btn-telegram" aria-label="Expand">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>\n      </button>\n    </div>\n\n    <div class="ch-card-details" id="ch-details-telegram">\n      <div class="ch-enable-row" id="ch-enable-row-telegram" hidden>\n        <span class="ch-enable-label">Channel active</span>\n        <label class="ch-toggle" title="Enable / disable">\n          <input type="checkbox" class="ch-toggle-input" id="ch-toggle-telegram" disabled />\n          <span class="ch-toggle-track"></span>\n        </label>\n      </div>\n      <div class="ch-steps" id="ch-steps-telegram">\n        <div class="ch-steps-label">Setup \u2014 under 60 seconds</div>\n        <ol class="ch-steps-list">\n          <li>Open Telegram and search for <strong>@BotFather</strong></li>\n          <li>Send <code>/newbot</code> \u2192 follow the prompts to name your bot</li>\n          <li>BotFather gives you a token like <code>1234567890:ABCdef\u2026</code> \u2014 paste it below</li>\n          <li>Then message your new bot once to start the conversation</li>\n        </ol>\n      </div>\n\n      <div class="ch-form">\n        <div class="ch-field">\n          <label class="ch-label" for="ch-tg-token">Bot Token <span class="ch-req">*</span></label>\n          <div class="ch-input-wrap">\n            <input type="password" id="ch-tg-token" class="ch-input" placeholder="1234567890:ABCdef\u2026" autocomplete="off" spellcheck="false" />\n            <button type="button" class="ch-eye" id="ch-eye-tg" title="Show/hide">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n            </button>\n          </div>\n        </div>\n        <div class="ch-actions">\n          <button type="button" class="ch-btn-danger" id="ch-disc-telegram" hidden>Disconnect</button>\n          <button type="button" class="ch-btn-primary" id="ch-connect-telegram">Connect</button>\n        </div>\n        <div class="ch-feedback" id="ch-fb-telegram" aria-live="polite"></div>\n      </div>\n    </div>\n  </div>\n\n  <!-- \u2500\u2500 WhatsApp card \u2500\u2500 -->\n  <div class="ch-card" id="ch-card-whatsapp">\n    <div class="ch-card-header" id="ch-card-header-whatsapp">\n      <div class="ch-icon ch-icon--whatsapp">\n        <img src="../../../Assets/Icons/WhatsApp.png" alt="WhatsApp" width="22" height="22" style="object-fit:contain;" />\n      </div>\n      <div class="ch-info">\n        <h4>WhatsApp</h4>\n        <p>Auto-reply to WhatsApp messages via Twilio sandbox</p>\n      </div>\n      <span class="ch-badge ch-badge--off" id="ch-badge-whatsapp">&#9675; Not connected</span>\n      <button type="button" class="ch-expand-btn" id="ch-expand-btn-whatsapp" aria-label="Expand">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>\n      </button>\n    </div>\n\n    <div class="ch-card-details" id="ch-details-whatsapp">\n      <div class="ch-enable-row" id="ch-enable-row-whatsapp" hidden>\n        <span class="ch-enable-label">Channel active</span>\n        <label class="ch-toggle" title="Enable / disable">\n          <input type="checkbox" class="ch-toggle-input" id="ch-toggle-whatsapp" disabled />\n          <span class="ch-toggle-track"></span>\n        </label>\n      </div>\n      <div class="ch-steps" id="ch-steps-whatsapp">\n        <div class="ch-steps-label">Setup via Twilio Sandbox \u2014 free, ~3 minutes</div>\n        <ol class="ch-steps-list">\n          <li>Sign up free at <strong>twilio.com</strong> (no credit card needed for sandbox)</li>\n          <li>Go to <strong>Messaging \u2192 Try it out \u2192 Send a WhatsApp message</strong></li>\n          <li>From your phone, send the join code shown to the sandbox number</li>\n          <li>Copy your <strong>Account SID</strong>, <strong>Auth Token</strong> (from the Console homepage), and the <strong>sandbox number</strong> (e.g. <code>whatsapp:+14155238886</code>)</li>\n        </ol>\n      </div>\n\n      <div class="ch-form">\n        <div class="ch-fields-row">\n          <div class="ch-field">\n            <label class="ch-label" for="ch-wa-sid">Account SID <span class="ch-req">*</span></label>\n            <input type="text" id="ch-wa-sid" class="ch-input" placeholder="ACxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false" />\n          </div>\n          <div class="ch-field">\n            <label class="ch-label" for="ch-wa-token">Auth Token <span class="ch-req">*</span></label>\n            <div class="ch-input-wrap">\n              <input type="password" id="ch-wa-token" class="ch-input" placeholder="Your auth token" autocomplete="off" spellcheck="false" />\n              <button type="button" class="ch-eye" id="ch-eye-wa" title="Show/hide">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n              </button>\n            </div>\n          </div>\n        </div>\n        <div class="ch-field">\n          <label class="ch-label" for="ch-wa-number">Sandbox Number <span class="ch-req">*</span></label>\n          <input type="text" id="ch-wa-number" class="ch-input" placeholder="whatsapp:+14155238886" autocomplete="off" spellcheck="false" />\n          <div class="ch-hint">Include the <code>whatsapp:</code> prefix exactly as shown in Twilio.</div>\n        </div>\n        <div class="ch-actions">\n          <button type="button" class="ch-btn-danger" id="ch-disc-whatsapp" hidden>Disconnect</button>\n          <button type="button" class="ch-btn-primary" id="ch-connect-whatsapp">Connect</button>\n        </div>\n        <div class="ch-feedback" id="ch-fb-whatsapp" aria-live="polite"></div>\n      </div>\n    </div>\n  </div>\n\n  <!-- \u2500\u2500 Discord card \u2500\u2500 -->\n  <div class="ch-card" id="ch-card-discord">\n    <div class="ch-card-header" id="ch-card-header-discord">\n      <div class="ch-icon ch-icon--discord" style="background:#5865F2;box-shadow:0 2px 8px rgba(88,101,242,0.35);">\n        <img src="../../../Assets/Icons/Discord.png" alt="Discord" width="22" height="22" style="object-fit:contain;" />\n      </div>\n      <div class="ch-info">\n        <h4>Discord</h4>\n        <p>Auto-reply to messages in your Discord server</p>\n      </div>\n      <span class="ch-badge ch-badge--off" id="ch-badge-discord">&#9675; Not connected</span>\n      <button type="button" class="ch-expand-btn" id="ch-expand-btn-discord" aria-label="Expand">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>\n      </button>\n    </div>\n\n    <div class="ch-card-details" id="ch-details-discord">\n      <div class="ch-enable-row" id="ch-enable-row-discord" hidden>\n        <span class="ch-enable-label">Channel active</span>\n        <label class="ch-toggle" title="Enable / disable">\n          <input type="checkbox" class="ch-toggle-input" id="ch-toggle-discord" disabled />\n          <span class="ch-toggle-track"></span>\n        </label>\n      </div>\n      <div class="ch-steps" id="ch-steps-discord">\n        <div class="ch-steps-label">Setup \u2014 ~3 minutes</div>\n        <ol class="ch-steps-list">\n          <li>Go to <strong>discord.com/developers/applications</strong> \u2192 New Application \u2192 Bot \u2192 Add Bot</li>\n          <li>Under <strong>Bot \u2192 Privileged Gateway Intents</strong>, turn ON <strong>Message Content Intent</strong> \u2190 this is required to read messages</li>\n          <li>Copy your <strong>Bot Token</strong> (Reset Token if needed)</li>\n          <li>Under <strong>OAuth2 \u2192 URL Generator</strong>: check <em>bot</em> scope + <em>Read Messages</em> + <em>Send Messages</em> permissions \u2192 open the generated URL to invite the bot to your server</li>\n          <li>Get your <strong>Channel ID</strong>: in Discord, enable Developer Mode (Settings \u2192 Advanced), then right-click any channel \u2192 Copy Channel ID</li>\n        </ol>\n      </div>\n\n      <div class="ch-form">\n        <div class="ch-fields-row">\n          <div class="ch-field">\n            <label class="ch-label" for="ch-dc-token">Bot Token <span class="ch-req">*</span></label>\n            <div class="ch-input-wrap">\n              <input type="password" id="ch-dc-token" class="ch-input" placeholder="Your bot token" autocomplete="off" spellcheck="false" />\n              <button type="button" class="ch-eye" id="ch-eye-dc" title="Show/hide">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n              </button>\n            </div>\n          </div>\n          <div class="ch-field">\n            <label class="ch-label" for="ch-dc-channel">Channel ID <span class="ch-req">*</span></label>\n            <input type="text" id="ch-dc-channel" class="ch-input" placeholder="123456789012345678" autocomplete="off" spellcheck="false" />\n            <div class="ch-hint">Right-click channel in Discord \u2192 Copy Channel ID (enable Developer Mode in Settings \u2192 Advanced first)</div>\n          </div>\n        </div>\n        <div class="ch-actions">\n          <button type="button" class="ch-btn-danger" id="ch-disc-discord" hidden>Disconnect</button>\n          <button type="button" class="ch-btn-primary" id="ch-connect-discord">Connect</button>\n        </div>\n        <div class="ch-feedback" id="ch-fb-discord" aria-live="polite"></div>\n      </div>\n    </div>\n  </div>\n\n  <!-- \u2500\u2500 Slack card \u2500\u2500 -->\n  <div class="ch-card" id="ch-card-slack">\n    <div class="ch-card-header" id="ch-card-header-slack">\n      <div class="ch-icon ch-icon--slack" style="background:linear-gradient(135deg,#E01E5A,#36C5F0);box-shadow:0 2px 8px rgba(224,30,90,0.3);">\n        <img src="../../../Assets/Icons/Slack.png" alt="Slack" width="22" height="22" style="object-fit:contain;" />\n      </div>\n      <div class="ch-info">\n        <h4>Slack</h4>\n        <p>Auto-reply to messages in your Slack workspace</p>\n      </div>\n      <span class="ch-badge ch-badge--off" id="ch-badge-slack">&#9675; Not connected</span>\n      <button type="button" class="ch-expand-btn" id="ch-expand-btn-slack" aria-label="Expand">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>\n      </button>\n    </div>\n\n    <div class="ch-card-details" id="ch-details-slack">\n      <div class="ch-enable-row" id="ch-enable-row-slack" hidden>\n        <span class="ch-enable-label">Channel active</span>\n        <label class="ch-toggle" title="Enable / disable">\n          <input type="checkbox" class="ch-toggle-input" id="ch-toggle-slack" disabled />\n          <span class="ch-toggle-track"></span>\n        </label>\n      </div>\n      <div class="ch-steps" id="ch-steps-slack">\n        <div class="ch-steps-label">Setup \u2014 ~3 minutes</div>\n        <ol class="ch-steps-list">\n          <li>Go to <strong>api.slack.com/apps</strong> \u2192 Create New App \u2192 From scratch</li>\n          <li>Under <strong>OAuth &amp; Permissions \u2192 Bot Token Scopes</strong>, add: <code>channels:history</code>, <code>channels:read</code>, <code>chat:write</code>, <code>groups:history</code></li>\n          <li>Click <strong>Install to Workspace</strong> \u2192 copy the <strong>Bot User OAuth Token</strong> (starts with <code>xoxb-</code>)</li>\n          <li>In your Slack workspace, <strong>/invite @YourBotName</strong> into the channel you want monitored</li>\n          <li>Get the <strong>Channel ID</strong>: open the channel in Slack \u2192 click the channel name at the top \u2192 scroll to the bottom of the popup \u2014 the ID starts with <code>C</code></li>\n        </ol>\n      </div>\n\n      <div class="ch-form">\n        <div class="ch-fields-row">\n          <div class="ch-field">\n            <label class="ch-label" for="ch-sk-token">Bot Token <span class="ch-req">*</span></label>\n            <div class="ch-input-wrap">\n              <input type="password" id="ch-sk-token" class="ch-input" placeholder="xoxb-your-token" autocomplete="off" spellcheck="false" />\n              <button type="button" class="ch-eye" id="ch-eye-sk" title="Show/hide">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n              </button>\n            </div>\n          </div>\n          <div class="ch-field">\n            <label class="ch-label" for="ch-sk-channel">Channel ID <span class="ch-req">*</span></label>\n            <input type="text" id="ch-sk-channel" class="ch-input" placeholder="C0123456789" autocomplete="off" spellcheck="false" />\n            <div class="ch-hint">Click the channel name in Slack \u2192 scroll to the bottom of the popup to find the ID (starts with C)</div>\n          </div>\n        </div>\n        <div class="ch-actions">\n          <button type="button" class="ch-btn-danger" id="ch-disc-slack" hidden>Disconnect</button>\n          <button type="button" class="ch-btn-primary" id="ch-connect-slack">Connect</button>\n        </div>\n        <div class="ch-feedback" id="ch-fb-slack" aria-live="polite"></div>\n      </div>\n    </div>\n  </div>\n\n</div>\n'),
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
        ['telegram', 'whatsapp', 'discord', 'slack'].forEach((name) => {
          const btn = document.getElementById(`ch-expand-btn-${name}`);
          const header = document.getElementById(`ch-card-header-${name}`);
          const card = document.getElementById(`ch-card-${name}`);
          function toggleAccordion(e) {
            card?.classList.toggle('ch-expanded');
          }
          btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAccordion();
          });
          header?.addEventListener('click', toggleAccordion);
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
