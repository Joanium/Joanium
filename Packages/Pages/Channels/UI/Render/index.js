/* ─────────────────────────────────────────────────────────────────
   Channels page — SPA module (mount/cleanup pattern)
   Matches the established pattern of Agents/Automations/Events pages
───────────────────────────────────────────────────────────────── */

/* ── HTML Template ───────────────────────────────────────────── */
function getHTML() {
  return `
<div class="channels-scroll">

  <!-- Page header -->
  <div class="channels-page-header">
    <div class="channels-page-header-copy">
      <h1>
        Channels
        <span class="channels-tagline-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Talks Back
        </span>
      </h1>
      <p>Connect WhatsApp or Telegram. When someone messages in, the AI replies — automatically.</p>
    </div>
  </div>

  <!-- Channel cards -->
  <div class="channels-grid" id="channels-grid">

    <!-- Telegram Card -->
    <div class="channel-card" id="card-telegram">
      <div class="channel-card-header">
        <div class="channel-icon channel-icon--telegram">
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </div>
        <div class="channel-card-title-group">
          <h2 class="channel-name">Telegram</h2>
          <div class="channel-status" id="status-telegram">
            <span class="status-dot"></span>
            <span class="status-text">Not connected</span>
          </div>
        </div>
        <label class="channel-toggle-wrap" title="Enable / disable Telegram channel">
          <input type="checkbox" class="channel-toggle-input" id="toggle-telegram" disabled />
          <span class="channel-toggle-track"></span>
        </label>
      </div>

      <div class="channel-steps" id="steps-telegram">
        <div class="steps-label">How to connect — takes 30 seconds</div>
        <ol class="steps-list">
          <li>Open Telegram and search for <strong>@BotFather</strong></li>
          <li>Send <code>/newbot</code> and follow the prompts</li>
          <li>Copy the <strong>bot token</strong> BotFather gives you</li>
          <li>Paste it below and hit <strong>Connect</strong></li>
        </ol>
      </div>

      <div class="channel-form" id="form-telegram">
        <div class="channel-field">
          <label class="channel-field-label" for="tg-token">Bot Token <span class="required">*</span></label>
          <div class="channel-input-wrap">
            <input type="password" id="tg-token" class="channel-input" placeholder="1234567890:ABCdef…" autocomplete="off" spellcheck="false" />
            <button type="button" class="channel-eye-btn" id="eye-tg-token" title="Show / Hide">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
        <div class="channel-field">
          <label class="channel-field-label" for="tg-prompt">AI System Prompt <span class="channel-field-hint-inline">(optional)</span></label>
          <textarea id="tg-prompt" class="channel-textarea" placeholder="You are a helpful assistant. Reply concisely and helpfully." rows="3"></textarea>
        </div>
        <div class="channel-form-actions">
          <button type="button" class="channel-btn-secondary" id="disconnect-telegram" hidden>Disconnect</button>
          <button type="button" class="channel-btn-primary" id="connect-telegram">Connect</button>
        </div>
        <div class="channel-feedback" id="feedback-telegram" aria-live="polite"></div>
      </div>
    </div>

    <!-- WhatsApp Card -->
    <div class="channel-card" id="card-whatsapp">
      <div class="channel-card-header">
        <div class="channel-icon channel-icon--whatsapp">
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
        </div>
        <div class="channel-card-title-group">
          <h2 class="channel-name">WhatsApp</h2>
          <div class="channel-status" id="status-whatsapp">
            <span class="status-dot"></span>
            <span class="status-text">Not connected</span>
          </div>
        </div>
        <label class="channel-toggle-wrap" title="Enable / disable WhatsApp channel">
          <input type="checkbox" class="channel-toggle-input" id="toggle-whatsapp" disabled />
          <span class="channel-toggle-track"></span>
        </label>
      </div>

      <div class="channel-steps" id="steps-whatsapp">
        <div class="steps-label">How to connect — free Twilio sandbox, ~3 minutes</div>
        <ol class="steps-list">
          <li>Create a free account at <strong>twilio.com</strong> — no credit card needed for sandbox</li>
          <li>Go to <strong>Messaging → Try it out → Send a WhatsApp message</strong></li>
          <li>Copy your <strong>Account SID</strong> and <strong>Auth Token</strong> from the Twilio Console</li>
          <li>Copy the <strong>Sandbox number</strong> (e.g. <code>whatsapp:+14155238886</code>)</li>
          <li>From your phone, send the join code shown in the sandbox to that number</li>
          <li>Paste all three values below and hit <strong>Connect</strong></li>
        </ol>
        <div class="steps-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Twilio sandbox is completely free. No charges will be made.
        </div>
      </div>

      <div class="channel-form" id="form-whatsapp">
        <div class="channel-fields-row">
          <div class="channel-field">
            <label class="channel-field-label" for="wa-sid">Account SID <span class="required">*</span></label>
            <input type="text" id="wa-sid" class="channel-input" placeholder="ACxxxxxxxxxxxxxxxx" autocomplete="off" spellcheck="false" />
          </div>
          <div class="channel-field">
            <label class="channel-field-label" for="wa-token">Auth Token <span class="required">*</span></label>
            <div class="channel-input-wrap">
              <input type="password" id="wa-token" class="channel-input" placeholder="Your auth token" autocomplete="off" spellcheck="false" />
              <button type="button" class="channel-eye-btn" id="eye-wa-token" title="Show / Hide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="channel-field">
          <label class="channel-field-label" for="wa-number">Sandbox Number <span class="required">*</span></label>
          <input type="text" id="wa-number" class="channel-input" placeholder="whatsapp:+14155238886" autocomplete="off" spellcheck="false" />
          <div class="channel-field-hint">Include the <code>whatsapp:</code> prefix as shown in Twilio.</div>
        </div>
        <div class="channel-field">
          <label class="channel-field-label" for="wa-prompt">AI System Prompt <span class="channel-field-hint-inline">(optional)</span></label>
          <textarea id="wa-prompt" class="channel-textarea" placeholder="You are a helpful assistant. Reply concisely and helpfully." rows="3"></textarea>
        </div>
        <div class="channel-form-actions">
          <button type="button" class="channel-btn-secondary" id="disconnect-whatsapp" hidden>Disconnect</button>
          <button type="button" class="channel-btn-primary" id="connect-whatsapp">Connect</button>
        </div>
        <div class="channel-feedback" id="feedback-whatsapp" aria-live="polite"></div>
      </div>
    </div>

  </div><!-- /channels-grid -->
</div>
  `;
}

/* ══════════════════════════════════════════
   MOUNT  — entry point called by SPA router
══════════════════════════════════════════ */
export function mount(outlet) {
  outlet.innerHTML = `<div class="channels-main">${getHTML()}</div>`;

  const api = window.electronAPI;
  const $ = (id) => document.getElementById(id);

  /* ── Helpers ───────────────────────────────────────────────── */
  function setFeedback(channel, message, tone = 'info') {
    const el = $(`feedback-${channel}`);
    if (!el) return;
    el.textContent = message;
    el.className = message ? `channel-feedback ${tone}` : 'channel-feedback';
  }

  function setStatus(channel, connected) {
    const el = $(`status-${channel}`);
    if (!el) return;
    el.classList.toggle('is-connected', connected);
    el.querySelector('.status-text').textContent = connected ? 'Connected & active' : 'Not connected';
  }

  function setToggle(channel, enabled, configured) {
    const t = $(`toggle-${channel}`);
    if (!t) return;
    t.checked  = enabled;
    t.disabled = !configured;
  }

  /* ── Hydrate ───────────────────────────────────────────────── */
  async function hydrate() {
    try {
      const res = await api?.getChannels?.();
      if (!res?.ok) return;
      for (const name of ['telegram', 'whatsapp']) {
        const c = res.channels[name] ?? {};
        setStatus(name, c.configured && c.enabled);
        setToggle(name, c.enabled, c.configured);
        const stepsEl = $(`steps-${name}`);
        if (stepsEl) stepsEl.hidden = c.configured;
        const disconnectBtn = $(`disconnect-${name}`);
        if (disconnectBtn) disconnectBtn.hidden = !c.configured;
      }
      await prefillTelegram();
      await prefillWhatsApp();
    } catch (err) {
      console.error('[Channels] hydrate failed:', err);
    }
  }

  async function prefillTelegram() {
    try {
      const res = await api?.getChannelConfig?.('telegram');
      if (!res?.ok) return;
      if (res.config.botTokenSet) $('tg-token').placeholder = '••••••••  (saved)';
      if (res.config.systemPrompt) $('tg-prompt').value = res.config.systemPrompt;
    } catch { /* ignore */ }
  }

  async function prefillWhatsApp() {
    try {
      const res = await api?.getChannelConfig?.('whatsapp');
      if (!res?.ok) return;
      if (res.config.accountSidSet) $('wa-sid').placeholder = 'AC……  (saved)';
      if (res.config.authTokenSet)  $('wa-token').placeholder = '••••••••  (saved)';
      if (res.config.fromNumber)    $('wa-number').value = res.config.fromNumber;
      if (res.config.systemPrompt)  $('wa-prompt').value = res.config.systemPrompt;
    } catch { /* ignore */ }
  }

  /* ── Eye-button toggles ───────────────────────────────────── */
  function onEyeTgToken() {
    const inp = $('tg-token');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  }
  function onEyeWaToken() {
    const inp = $('wa-token');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  }
  $('eye-tg-token')?.addEventListener('click', onEyeTgToken);
  $('eye-wa-token')?.addEventListener('click', onEyeWaToken);

  /* ── Toggle on/off ────────────────────────────────────────── */
  async function onToggleTelegram(e) {
    try {
      await api?.toggleChannel?.('telegram', e.target.checked);
      setStatus('telegram', e.target.checked);
      setFeedback('telegram', e.target.checked ? 'Telegram channel enabled.' : 'Telegram channel paused.', 'success');
    } catch (err) {
      e.target.checked = !e.target.checked;
      setFeedback('telegram', err.message, 'error');
    }
  }
  async function onToggleWhatsApp(e) {
    try {
      await api?.toggleChannel?.('whatsapp', e.target.checked);
      setStatus('whatsapp', e.target.checked);
      setFeedback('whatsapp', e.target.checked ? 'WhatsApp channel enabled.' : 'WhatsApp channel paused.', 'success');
    } catch (err) {
      e.target.checked = !e.target.checked;
      setFeedback('whatsapp', err.message, 'error');
    }
  }
  $('toggle-telegram')?.addEventListener('change', onToggleTelegram);
  $('toggle-whatsapp')?.addEventListener('change', onToggleWhatsApp);

  /* ── Connect Telegram ─────────────────────────────────────── */
  async function onConnectTelegram() {
    const token  = $('tg-token')?.value.trim();
    const prompt = $('tg-prompt')?.value.trim();
    const tokenSaved = $('tg-token')?.placeholder.includes('saved');

    if (!token && !tokenSaved) {
      setFeedback('telegram', 'Paste your bot token first.', 'error');
      $('tg-token')?.focus();
      return;
    }

    const btn = $('connect-telegram');
    btn.disabled = true;
    setFeedback('telegram', 'Validating token…', 'info');

    try {
      if (token) {
        const val = await api?.validateChannel?.('telegram', { botToken: token });
        if (!val?.ok) throw new Error(val?.error ?? 'Invalid token');
        setFeedback('telegram', `✓ Bot verified: @${val.username}`, 'success');
      }

      const payload = { systemPrompt: prompt || undefined };
      if (token) payload.botToken = token;

      const saved = await api?.saveChannel?.('telegram', payload);
      if (!saved?.ok) throw new Error(saved?.error ?? 'Could not save');

      setStatus('telegram', true);
      setToggle('telegram', true, true);
      $('steps-telegram').hidden = true;
      $('disconnect-telegram').hidden = false;
      setFeedback('telegram', '🎉 Telegram connected! Send a message to your bot to test it.', 'success');
    } catch (err) {
      setFeedback('telegram', `Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  }
  $('connect-telegram')?.addEventListener('click', onConnectTelegram);

  /* ── Connect WhatsApp ─────────────────────────────────────── */
  async function onConnectWhatsApp() {
    const sid    = $('wa-sid')?.value.trim();
    const token  = $('wa-token')?.value.trim();
    const number = $('wa-number')?.value.trim();
    const prompt = $('wa-prompt')?.value.trim();
    const sidSaved   = $('wa-sid')?.placeholder.includes('saved');
    const tokenSaved = $('wa-token')?.placeholder.includes('saved');

    if (!sid && !sidSaved)   { setFeedback('whatsapp', 'Paste your Twilio Account SID.', 'error'); $('wa-sid')?.focus(); return; }
    if (!token && !tokenSaved) { setFeedback('whatsapp', 'Paste your Twilio Auth Token.', 'error'); $('wa-token')?.focus(); return; }
    if (!number) { setFeedback('whatsapp', 'Enter the sandbox number (e.g. whatsapp:+14155238886).', 'error'); $('wa-number')?.focus(); return; }

    const btn = $('connect-whatsapp');
    btn.disabled = true;
    setFeedback('whatsapp', 'Validating credentials…', 'info');

    try {
      if (sid && token) {
        const val = await api?.validateChannel?.('whatsapp', { accountSid: sid, authToken: token });
        if (!val?.ok) throw new Error(val?.error ?? 'Invalid Twilio credentials');
        setFeedback('whatsapp', `✓ Account verified: ${val.friendlyName}`, 'success');
      }

      const payload = { fromNumber: number, systemPrompt: prompt || undefined };
      if (sid)   payload.accountSid = sid;
      if (token) payload.authToken  = token;

      const saved = await api?.saveChannel?.('whatsapp', payload);
      if (!saved?.ok) throw new Error(saved?.error ?? 'Could not save');

      setStatus('whatsapp', true);
      setToggle('whatsapp', true, true);
      $('steps-whatsapp').hidden = true;
      $('disconnect-whatsapp').hidden = false;
      setFeedback('whatsapp', '🎉 WhatsApp connected! Send a message from your joined phone to test.', 'success');
    } catch (err) {
      setFeedback('whatsapp', `Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  }
  $('connect-whatsapp')?.addEventListener('click', onConnectWhatsApp);

  /* ── Disconnect ───────────────────────────────────────────── */
  async function disconnectChannel(name) {
    const msg = name === 'telegram'
      ? 'Disconnect Telegram? The bot will stop replying.'
      : 'Disconnect WhatsApp? The bot will stop replying.';
    if (!window.confirm(msg)) return;

    try {
      const res = await api?.removeChannel?.(name);
      if (!res?.ok) throw new Error(res?.error ?? 'Could not disconnect');

      setStatus(name, false);
      setToggle(name, false, false);
      $(`steps-${name}`).hidden = false;
      $(`disconnect-${name}`).hidden = true;

      if (name === 'telegram') {
        $('tg-token').value = '';       $('tg-token').placeholder = '1234567890:ABCdef…';
        $('tg-prompt').value = '';
      } else {
        $('wa-sid').value = '';         $('wa-sid').placeholder = 'ACxxxxxxxxxxxxxxxx';
        $('wa-token').value = '';       $('wa-token').placeholder = 'Your auth token';
        $('wa-number').value = '';
        $('wa-prompt').value = '';
      }
      setFeedback(name, 'Disconnected.', 'info');
    } catch (err) {
      setFeedback(name, `Error: ${err.message}`, 'error');
    }
  }

  function onDisconnectTelegram() { disconnectChannel('telegram'); }
  function onDisconnectWhatsApp() { disconnectChannel('whatsapp'); }
  $('disconnect-telegram')?.addEventListener('click', onDisconnectTelegram);
  $('disconnect-whatsapp')?.addEventListener('click', onDisconnectWhatsApp);

  /* ── Load ─────────────────────────────────────────────────── */
  hydrate().catch(err => console.error('[Channels] init failed:', err));

  /* ── Cleanup ──────────────────────────────────────────────── */
  return function cleanup() {
    $('eye-tg-token')?.removeEventListener('click', onEyeTgToken);
    $('eye-wa-token')?.removeEventListener('click', onEyeWaToken);
    $('toggle-telegram')?.removeEventListener('change', onToggleTelegram);
    $('toggle-whatsapp')?.removeEventListener('change', onToggleWhatsApp);
    $('connect-telegram')?.removeEventListener('click', onConnectTelegram);
    $('connect-whatsapp')?.removeEventListener('click', onConnectWhatsApp);
    $('disconnect-telegram')?.removeEventListener('click', onDisconnectTelegram);
    $('disconnect-whatsapp')?.removeEventListener('click', onDisconnectWhatsApp);
  };
}
