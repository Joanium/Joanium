# Channels

External messaging gateway — Telegram, WhatsApp, Discord, Slack, Zulip, Mattermost, ntfy.

---

## Architecture

```text
Channels Package
├── Index.js              — IPC handlers
├── Core/
│   ├── ChannelState.js   — Channel configuration
│   └── ChannelRuntime.js — Polling, validation, reply dispatch
└── I18n/
    └── en.js             — Channel strings
```

---

## Supported Channels

| Channel | Protocol |
|---|---|
| Telegram | Bot API |
| WhatsApp | Twilio API |
| Discord | Discord Bot API |
| Slack | Slack API |
| Mattermost | Mattermost API |
| Zulip | Zulip API |
| ntfy | ntfy HTTP |

---

## IPC Handlers (12 channels)

| Channel | Purpose |
|---|---|
| `channels:icon-paths` | Channel icon file paths |
| `channels:list` | List all channels |
| `channels:get` | Get a specific channel |
| `channels:save` | Save/update a channel |
| `channels:remove` | Remove a channel |
| `channels:toggle` | Enable/disable a channel |
| `channels:validate` | Validate credentials per channel type |
| `channels:reply` | Send reply to a channel message |
| `channels:save-message` | Save a channel message |
| `channels:list-messages` | List channel messages |
| `channels:delete-message` | Delete a channel message |
| `channels:clear-messages` | Clear all channel messages |

---

## Channel Configuration

Channel state is stored in `Data/Channels.json`:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "credentials": {
        "botToken": "..."
      },
      "systemPrompt": "Optional channel-specific prompt"
    },
    "discord": {
      "enabled": false,
      "credentials": {
        "botToken": "..."
      }
    }
  }
}
```

---

## Channel Runtime

`ChannelRuntime.js` manages:

- **Polling**: Periodic message polling for channels that don't support webhooks
- **Validation**: Credential verification per channel type
- **Reply dispatch**: Sending AI responses back to channels

### Reply Flow

```text
External message received
    ↓
ChannelRuntime polls or receives webhook
    ↓
Message passed to AssistantPipeline
    ↓
AI generates response
    ↓
ChannelRuntime sends reply via channel API
    ↓
Message saved to ChannelMessages
```

---

## Shared Assistant Pipeline

Channels use the same `AssistantPipeline` as Chat:

```js
const result = await runAssistantPipeline({
  messages: [{ role: 'user', content: incomingMessage }],
  persona: channelSystemPrompt,
  source: 'channel',
  maxToolCalls: 5,
});
```

This ensures external channel replies use the same prompt/context assembly and bounded tool loop as chat.

---

## Channel-Specific System Prompts

Each channel can have its own system prompt. This is stored in the channel configuration and included in the AI's context when processing messages from that channel.

---

## Channel Messages

Messages are stored in `Data/ChannelMessages/` for history and reference.

---

## Channel Validation

`channels:validate` checks credentials per channel type:

- **Telegram**: Verify bot token
- **WhatsApp**: Verify Twilio accountSid and auth token
- **Discord**: Verify bot token and channel ID
- **Slack**: Verify bot token and channel ID
- **Zulip**: Verify site URL, bot email, API key, and stream
- **Mattermost**: Verify site URL, access token, and channel ID
- **ntfy**: Verify site URL and topic

---

## Channel Icons

`channels:icon-paths` returns file paths for channel icons used in the UI. Icons are stored in `Assets/Icons/`.

---

## Enabling/Disabling Channels

`channels:toggle` enables or disables a channel:

- Enabled: Channel starts polling/webhook
- Disabled: Channel stops polling/webhook
