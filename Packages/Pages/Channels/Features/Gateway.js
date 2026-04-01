/**
 * Channel Gateway — renderer side
 *
 * Listens for `channel-incoming` IPC events dispatched by the ChannelEngine
 * (main process) when a Telegram or WhatsApp message arrives. Processes the
 * message through the SAME agentLoop the normal chat window uses — same tools,
 * model selection, skills, and usage tracking. Returns the result back to the
 * main process via `channel-reply` so the engine can forward it to the user.
 *
 * Initialised once in Main.js right after the app boots.
 */

import { agentLoop } from '../../Chat/Features/Core/Agent.js';
import { trackUsage } from '../../Chat/Features/Data/ChatPersistence.js';
import { state } from '../../../System/State.js';

const api = window.electronAPI;

/**
 * A silent, no-op "live" adapter that satisfies every method agentLoop calls
 * but produces no visible output — the result comes back via IPC, not the UI.
 */
function makeSilentLive() {
  return {
    push:            () => ({ done: () => {} }),
    set:             () => {},
    finalize:        () => {},
    streamThinking:  () => {},
    showPhotoGallery:() => {},
    showToolOutput:  () => {},
    getAttachments:  () => [],
    setAborted:      () => {},
  };
}

let _initialised = false;

export function initChannelGateway() {
  if (_initialised) return;
  _initialised = true;

  api?.onChannelIncoming?.(async ({ id, channelName, text }) => {

    try {
      if (!state.selectedProvider || !state.selectedModel) {
        await api.channelReply(id, 'No AI provider is configured yet. Open Settings → AI Providers to add one.');
        return;
      }

      // Single-turn messages array — same format as normal chat
      const messages = [{ role: 'user', content: text, attachments: [] }];

      // Full agent loop — tools, skills, failover, everything
      const { text: reply, usage, usedProvider, usedModel } = await agentLoop(
        messages,
        makeSilentLive(),   // no-op UI adapter — output goes back via IPC
        [],                 // planRequest not needed for gateway (keeps latency down)
        [],
        state.systemPrompt, // uses the global system prompt from Settings
        null,               // no AbortSignal
      );

      // Track usage exactly like a normal chat call
      await trackUsage(usage, `channel:${channelName}`, usedProvider, usedModel);

      await api.channelReply(id, reply ?? '(no response)');
    } catch (err) {
      console.error('[ChannelGateway] processing error:', err);
      try { await api.channelReply(id, `Sorry, something went wrong: ${err.message}`); } catch { /* ignore */ }
    }
  });
}
