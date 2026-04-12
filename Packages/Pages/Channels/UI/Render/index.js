export function mount(outlet) {
  outlet.innerHTML =
    '<div class="channels-main">\n<div class="channels-scroll">\n\n  \x3c!-- Page header --\x3e\n  <div class="channels-page-header">\n    <div class="channels-page-header-copy">\n      <h1>\n        Channels\n        <span class="channels-tagline-badge">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">\n            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>\n          </svg>\n          Talks Back\n        </span>\n      </h1>\n      <p>Connect WhatsApp or Telegram. When someone messages in, the AI replies — automatically.</p>\n    </div>\n  </div>\n\n  \x3c!-- Channel cards --\x3e\n  <div class="channels-grid" id="channels-grid">\n\n    \x3c!-- Telegram Card --\x3e\n    <div class="channel-card" id="card-telegram">\n      <div class="channel-card-header">\n        <div class="channel-icon channel-icon--telegram">\n          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">\n            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>\n          </svg>\n        </div>\n        <div class="channel-card-title-group">\n          <h2 class="channel-name">Telegram</h2>\n          <div class="channel-status" id="status-telegram">\n            <span class="status-dot"></span>\n            <span class="status-text">Not connected</span>\n          </div>\n        </div>\n        <label class="channel-toggle-wrap" title="Enable / disable Telegram channel">\n          <input type="checkbox" class="channel-toggle-input" id="toggle-telegram" disabled />\n          <span class="channel-toggle-track"></span>\n        </label>\n      </div>\n\n      <div class="channel-steps" id="steps-telegram">\n        <div class="steps-label">How to connect — takes 30 seconds</div>\n        <ol class="steps-list">\n          <li>Open Telegram and search for <strong>@BotFather</strong></li>\n          <li>Send <code>/newbot</code> and follow the prompts</li>\n          <li>Copy the <strong>bot token</strong> BotFather gives you</li>\n          <li>Paste it below and hit <strong>Connect</strong></li>\n        </ol>\n      </div>\n\n      <div class="channel-form" id="form-telegram">\n        <div class="channel-field">\n          <label class="channel-field-label" for="tg-token">Bot Token <span class="required">*</span></label>\n          <div class="channel-input-wrap">\n            <input type="password" id="tg-token" class="channel-input" placeholder="1234567890:ABCdef…" autocomplete="off" spellcheck="false" />\n            <button type="button" class="channel-eye-btn" id="eye-tg-token" title="Show / Hide">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n            </button>\n          </div>\n        </div>\n        <div class="channel-field">\n          <label class="channel-field-label" for="tg-prompt">AI System Prompt <span class="channel-field-hint-inline">(optional)</span></label>\n          <textarea id="tg-prompt" class="channel-textarea" placeholder="You are a helpful assistant. Reply concisely and helpfully." rows="3"></textarea>\n        </div>\n        <div class="channel-form-actions">\n          <button type="button" class="channel-btn-secondary" id="disconnect-telegram" hidden>Disconnect</button>\n          <button type="button" class="channel-btn-primary" id="connect-telegram">Connect</button>\n        </div>\n        <div class="channel-feedback" id="feedback-telegram" aria-live="polite"></div>\n      </div>\n    </div>\n\n    \x3c!-- WhatsApp Card --\x3e\n    <div class="channel-card" id="card-whatsapp">\n      <div class="channel-card-header">\n        <div class="channel-icon channel-icon--whatsapp">\n          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">\n            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>\n          </svg>\n        </div>\n        <div class="channel-card-title-group">\n          <h2 class="channel-name">WhatsApp</h2>\n          <div class="channel-status" id="status-whatsapp">\n            <span class="status-dot"></span>\n            <span class="status-text">Not connected</span>\n          </div>\n        </div>\n        <label class="channel-toggle-wrap" title="Enable / disable WhatsApp channel">\n          <input type="checkbox" class="channel-toggle-input" id="toggle-whatsapp" disabled />\n          <span class="channel-toggle-track"></span>\n        </label>\n      </div>\n\n      <div class="channel-steps" id="steps-whatsapp">\n        <div class="steps-label">How to connect — free Twilio sandbox, ~3 minutes</div>\n        <ol class="steps-list">\n          <li>Create a free account at <strong>twilio.com</strong> — no credit card needed for sandbox</li>\n          <li>Go to <strong>Messaging → Try it out → Send a WhatsApp message</strong></li>\n          <li>Copy your <strong>Account SID</strong> and <strong>Auth Token</strong> from the Twilio Console</li>\n          <li>Copy the <strong>Sandbox number</strong> (e.g. <code>whatsapp:+14155238886</code>)</li>\n          <li>From your phone, send the join code shown in the sandbox to that number</li>\n          <li>Paste all three values below and hit <strong>Connect</strong></li>\n        </ol>\n        <div class="steps-note">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/></svg>\n          Twilio sandbox is completely free. No charges will be made.\n        </div>\n      </div>\n\n      <div class="channel-form" id="form-whatsapp">\n        <div class="channel-fields-row">\n          <div class="channel-field">\n            <label class="channel-field-label" for="wa-sid">Account SID <span class="required">*</span></label>\n            <input type="text" id="wa-sid" class="channel-input" placeholder="ACxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false" />\n          </div>\n          <div class="channel-field">\n            <label class="channel-field-label" for="wa-token">Auth Token <span class="required">*</span></label>\n            <div class="channel-input-wrap">\n              <input type="password" id="wa-token" class="channel-input" placeholder="Your auth token" autocomplete="off" spellcheck="false" />\n              <button type="button" class="channel-eye-btn" id="eye-wa-token" title="Show / Hide">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>\n              </button>\n            </div>\n          </div>\n        </div>\n        <div class="channel-field">\n          <label class="channel-field-label" for="wa-number">Sandbox Number <span class="required">*</span></label>\n          <input type="text" id="wa-number" class="channel-input" placeholder="whatsapp:+14155238886" autocomplete="off" spellcheck="false" />\n          <div class="channel-field-hint">Include the <code>whatsapp:</code> prefix as shown in Twilio.</div>\n        </div>\n        <div class="channel-field">\n          <label class="channel-field-label" for="wa-prompt">AI System Prompt <span class="channel-field-hint-inline">(optional)</span></label>\n          <textarea id="wa-prompt" class="channel-textarea" placeholder="You are a helpful assistant. Reply concisely and helpfully." rows="3"></textarea>\n        </div>\n        <div class="channel-form-actions">\n          <button type="button" class="channel-btn-secondary" id="disconnect-whatsapp" hidden>Disconnect</button>\n          <button type="button" class="channel-btn-primary" id="connect-whatsapp">Connect</button>\n        </div>\n        <div class="channel-feedback" id="feedback-whatsapp" aria-live="polite"></div>\n      </div>\n    </div>\n\n  </div>\x3c!-- /channels-grid --\x3e\n</div>\n  </div>';
  const api = window.electronAPI,
    $ = (id) => document.getElementById(id);
  function setFeedback(channel, message, tone = 'info') {
    const el = $(`feedback-${channel}`);
    el &&
      ((el.textContent = message),
      (el.className = message ? `channel-feedback ${tone}` : 'channel-feedback'));
  }
  function setStatus(channel, connected) {
    const el = $(`status-${channel}`);
    el &&
      (el.classList.toggle('is-connected', connected),
      (el.querySelector('.status-text').textContent = connected
        ? 'Connected & active'
        : 'Not connected'));
  }
  function setToggle(channel, enabled, configured) {
    const t = $(`toggle-${channel}`);
    t && ((t.checked = enabled), (t.disabled = !configured));
  }
  function onEyeTgToken() {
    const inp = $('tg-token');
    inp && (inp.type = 'password' === inp.type ? 'text' : 'password');
  }
  function onEyeWaToken() {
    const inp = $('wa-token');
    inp && (inp.type = 'password' === inp.type ? 'text' : 'password');
  }
  async function onToggleTelegram(e) {
    try {
      (await api?.invoke?.('toggle-channel', 'telegram', e.target.checked),
        setStatus('telegram', e.target.checked),
        setFeedback(
          'telegram',
          e.target.checked ? 'Telegram channel enabled.' : 'Telegram channel paused.',
          'success',
        ));
    } catch (err) {
      ((e.target.checked = !e.target.checked), setFeedback('telegram', err.message, 'error'));
    }
  }
  async function onToggleWhatsApp(e) {
    try {
      (await api?.invoke?.('toggle-channel', 'whatsapp', e.target.checked),
        setStatus('whatsapp', e.target.checked),
        setFeedback(
          'whatsapp',
          e.target.checked ? 'WhatsApp channel enabled.' : 'WhatsApp channel paused.',
          'success',
        ));
    } catch (err) {
      ((e.target.checked = !e.target.checked), setFeedback('whatsapp', err.message, 'error'));
    }
  }
  async function onConnectTelegram() {
    const token = $('tg-token')?.value.trim(),
      prompt = $('tg-prompt')?.value.trim(),
      tokenSaved = $('tg-token')?.placeholder.includes('saved');
    if (!token && !tokenSaved)
      return (
        setFeedback('telegram', 'Paste your bot token first.', 'error'),
        void $('tg-token')?.focus()
      );
    const btn = $('connect-telegram');
    ((btn.disabled = !0), setFeedback('telegram', 'Validating token…', 'info'));
    try {
      if (token) {
        const val = await api?.invoke?.('validate-channel', 'telegram', { botToken: token });
        if (!val?.ok) throw new Error(val?.error ?? 'Invalid token');
        setFeedback('telegram', `✓ Bot verified: @${val.username}`, 'success');
      }
      const payload = { systemPrompt: prompt || void 0 };
      token && (payload.botToken = token);
      const saved = await api?.invoke?.('save-channel', 'telegram', payload);
      if (!saved?.ok) throw new Error(saved?.error ?? 'Could not save');
      (setStatus('telegram', !0),
        setToggle('telegram', !0, !0),
        ($('steps-telegram').hidden = !0),
        ($('disconnect-telegram').hidden = !1),
        setFeedback(
          'telegram',
          '🎉 Telegram connected! Send a message to your bot to test it.',
          'success',
        ));
    } catch (err) {
      setFeedback('telegram', `Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = !1;
    }
  }
  async function onConnectWhatsApp() {
    const sid = $('wa-sid')?.value.trim(),
      token = $('wa-token')?.value.trim(),
      number = $('wa-number')?.value.trim(),
      prompt = $('wa-prompt')?.value.trim(),
      sidSaved = $('wa-sid')?.placeholder.includes('saved'),
      tokenSaved = $('wa-token')?.placeholder.includes('saved');
    if (!sid && !sidSaved)
      return (
        setFeedback('whatsapp', 'Paste your Twilio Account SID.', 'error'),
        void $('wa-sid')?.focus()
      );
    if (!token && !tokenSaved)
      return (
        setFeedback('whatsapp', 'Paste your Twilio Auth Token.', 'error'),
        void $('wa-token')?.focus()
      );
    if (!number)
      return (
        setFeedback('whatsapp', 'Enter the sandbox number (e.g. whatsapp:+14155238886).', 'error'),
        void $('wa-number')?.focus()
      );
    const btn = $('connect-whatsapp');
    ((btn.disabled = !0), setFeedback('whatsapp', 'Validating credentials…', 'info'));
    try {
      if (sid && token) {
        const val = await api?.invoke?.('validate-channel', 'whatsapp', {
          accountSid: sid,
          authToken: token,
        });
        if (!val?.ok) throw new Error(val?.error ?? 'Invalid Twilio credentials');
        setFeedback('whatsapp', `✓ Account verified: ${val.friendlyName}`, 'success');
      }
      const payload = { fromNumber: number, systemPrompt: prompt || void 0 };
      (sid && (payload.accountSid = sid), token && (payload.authToken = token));
      const saved = await api?.invoke?.('save-channel', 'whatsapp', payload);
      if (!saved?.ok) throw new Error(saved?.error ?? 'Could not save');
      (setStatus('whatsapp', !0),
        setToggle('whatsapp', !0, !0),
        ($('steps-whatsapp').hidden = !0),
        ($('disconnect-whatsapp').hidden = !1),
        setFeedback(
          'whatsapp',
          '🎉 WhatsApp connected! Send a message from your joined phone to test.',
          'success',
        ));
    } catch (err) {
      setFeedback('whatsapp', `Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = !1;
    }
  }
  async function disconnectChannel(name) {
    const msg =
      'telegram' === name
        ? 'Disconnect Telegram? The bot will stop replying.'
        : 'Disconnect WhatsApp? The bot will stop replying.';
    if (window.confirm(msg))
      try {
        const res = await api?.invoke?.('remove-channel', name);
        if (!res?.ok) throw new Error(res?.error ?? 'Could not disconnect');
        (setStatus(name, !1),
          setToggle(name, !1, !1),
          ($(`steps-${name}`).hidden = !1),
          ($(`disconnect-${name}`).hidden = !0),
          'telegram' === name
            ? (($('tg-token').value = ''),
              ($('tg-token').placeholder = '1234567890:ABCdef…'),
              ($('tg-prompt').value = ''))
            : (($('wa-sid').value = ''),
              ($('wa-sid').placeholder = 'ACxxxxxxxxxxxxxxxx'),
              ($('wa-token').value = ''),
              ($('wa-token').placeholder = 'Your auth token'),
              ($('wa-number').value = ''),
              ($('wa-prompt').value = '')),
          setFeedback(name, 'Disconnected.', 'info'));
      } catch (err) {
        setFeedback(name, `Error: ${err.message}`, 'error');
      }
  }
  function onDisconnectTelegram() {
    disconnectChannel('telegram');
  }
  function onDisconnectWhatsApp() {
    disconnectChannel('whatsapp');
  }
  return (
    $('eye-tg-token')?.addEventListener('click', onEyeTgToken),
    $('eye-wa-token')?.addEventListener('click', onEyeWaToken),
    $('toggle-telegram')?.addEventListener('change', onToggleTelegram),
    $('toggle-whatsapp')?.addEventListener('change', onToggleWhatsApp),
    $('connect-telegram')?.addEventListener('click', onConnectTelegram),
    $('connect-whatsapp')?.addEventListener('click', onConnectWhatsApp),
    $('disconnect-telegram')?.addEventListener('click', onDisconnectTelegram),
    $('disconnect-whatsapp')?.addEventListener('click', onDisconnectWhatsApp),
    (async function () {
      try {
        const res = await api?.invoke?.('get-channels');
        if (!res?.ok) return;
        for (const name of ['telegram', 'whatsapp']) {
          const c = res.channels[name] ?? {};
          (setStatus(name, c.configured && c.enabled), setToggle(name, c.enabled, c.configured));
          const stepsEl = $(`steps-${name}`);
          stepsEl && (stepsEl.hidden = c.configured);
          const disconnectBtn = $(`disconnect-${name}`);
          disconnectBtn && (disconnectBtn.hidden = !c.configured);
        }
        (await (async function () {
          try {
            const res = await api?.invoke?.('get-channel-config', 'telegram');
            if (!res?.ok) return;
            (res.config.botTokenSet && ($('tg-token').placeholder = '••••••••  (saved)'),
              res.config.systemPrompt && ($('tg-prompt').value = res.config.systemPrompt));
          } catch {}
        })(),
          await (async function () {
            try {
              const res = await api?.invoke?.('get-channel-config', 'whatsapp');
              if (!res?.ok) return;
              (res.config.accountSidSet && ($('wa-sid').placeholder = 'AC……  (saved)'),
                res.config.authTokenSet && ($('wa-token').placeholder = '••••••••  (saved)'),
                res.config.fromNumber && ($('wa-number').value = res.config.fromNumber),
                res.config.systemPrompt && ($('wa-prompt').value = res.config.systemPrompt));
            } catch {}
          })());
      } catch (err) {
        console.error('[Channels] hydrate failed:', err);
      }
    })().catch((err) => console.error('[Channels] init failed:', err)),
    function () {
      ($('eye-tg-token')?.removeEventListener('click', onEyeTgToken),
        $('eye-wa-token')?.removeEventListener('click', onEyeWaToken),
        $('toggle-telegram')?.removeEventListener('change', onToggleTelegram),
        $('toggle-whatsapp')?.removeEventListener('change', onToggleWhatsApp),
        $('connect-telegram')?.removeEventListener('click', onConnectTelegram),
        $('connect-whatsapp')?.removeEventListener('click', onConnectWhatsApp),
        $('disconnect-telegram')?.removeEventListener('click', onDisconnectTelegram),
        $('disconnect-whatsapp')?.removeEventListener('click', onDisconnectWhatsApp));
    }
  );
}
