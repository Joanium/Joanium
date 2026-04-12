import { agentLoop } from '../../Chat/Features/Core/Agent.js';
import { trackUsage } from '../../Chat/Features/Data/ChatPersistence.js';
import { state } from '../../../System/State.js';
const api = window.electronAPI;
let _initialised = !1;
export function initChannelGateway() {
  _initialised ||
    ((_initialised = !0),
    api?.on?.('channel-incoming', async ({ id: id, channelName: channelName, text: text }) => {
      try {
        if (!state.selectedProvider || !state.selectedModel)
          return void (await api.invoke(
            'channel-reply',
            id,
            'No AI provider is configured yet. Open Settings → AI Providers to add one.',
          ));
        const messages = [{ role: 'user', content: text, attachments: [] }],
          {
            text: reply,
            usage: usage,
            usedProvider: usedProvider,
            usedModel: usedModel,
          } = await agentLoop(
            messages,
            {
              push: () => ({ done: () => {} }),
              set: () => {},
              finalize: () => {},
              streamThinking: () => {},
              showPhotoGallery: () => {},
              showToolOutput: () => {},
              getAttachments: () => [],
              setAborted: () => {},
            },
            [],
            [],
            state.systemPrompt,
            null,
          );
        (await trackUsage(usage, `channel:${channelName}`, usedProvider, usedModel),
          await api.invoke('channel-reply', id, reply ?? '(no response)'));
      } catch (err) {
        console.error('[ChannelGateway] processing error:', err);
        try {
          await api.invoke('channel-reply', id, `Sorry, something went wrong: ${err.message}`);
        } catch {}
      }
    }));
}
