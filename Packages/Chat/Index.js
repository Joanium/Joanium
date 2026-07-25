import path from 'node:path';
import { app, dialog } from 'electron';
import { createChatStateManager } from './Core/ChatState.js';
import { createVoiceTranscriber } from './Core/VoiceTranscriber.js';
import strings from './I18n/en.js';
import {
  getSupportedAttachmentExtensions,
  getImageAttachmentExtensions,
  readAttachmentFiles,
} from './Core/ChatAttachments.js';
import { createUsageTracker, estimateTokens } from '../Shared/UsageTracker/UsageTracker.js';

export async function createPackage({ rootDirectory }) {
  const chatStateManager = createChatStateManager({ rootDirectory });
  const voiceTranscriber = createVoiceTranscriber({
    cacheDirectory: path.join(app.getPath('userData'), 'Models', 'Whisper'),
  });
  const usageTracker = createUsageTracker({ rootDirectory });
  const activeStreams = new Map();
  const networkErrorCodes = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EPIPE',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENETUNREACH',
  ]);
  const localProviderIds = new Set(['lmstudio', 'ollama']);

  function formatStreamError(error, request = {}) {
    const message = String(error?.message ?? error ?? '');
    if (
      networkErrorCodes.has(error?.code) ||
      /\b(?:ENOTFOUND|EAI_AGAIN|ENETUNREACH)\b/.test(message)
    ) {
      const providerId = String(request?.providerId ?? '').trim();
      if (localProviderIds.has(providerId)) {
        return strings.composer.localProviderError;
      }

      return strings.composer.networkError;
    }

    return message || strings.composer.responseError;
  }

  function sendIfAlive(event, channel, payload) {
    if (!event.sender.isDestroyed()) {
      event.sender.send(channel, payload);
    }
  }

  function toAudioSamples(value) {
    if (value instanceof ArrayBuffer) return new Float32Array(value);
    if (!ArrayBuffer.isView(value) || value.BYTES_PER_ELEMENT !== Float32Array.BYTES_PER_ELEMENT) {
      return null;
    }

    return new Float32Array(
      value.buffer,
      value.byteOffset,
      value.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
  }

  function createUsageExchange(meta, isNewSession) {
    const tokensIn = estimateTokens(meta?.charCountIn ?? 0);
    const tokensOut = estimateTokens(meta?.charCountOut ?? 0);
    if (tokensIn + tokensOut <= 0) return null;

    return {
      tokensIn,
      tokensOut,
      modelId: meta?.modelId ?? null,
      modelLabel: meta?.modelLabel ?? null,
      providerLabel: meta?.providerLabel ?? null,
      providerIconPath: meta?.providerIconPath ?? null,
      isNewSession,
    };
  }

  async function recordUsage(meta, isNewSession) {
    const exchange = createUsageExchange(meta, isNewSession);
    if (exchange) {
      await usageTracker.recordExchange(exchange);
    }
  }

  function streamMessage(
    event,
    request,
    channels,
    decorate = (payload) => payload,
    streamController = null,
  ) {
    const streamId = streamController?.streamId ?? null;
    const controller = streamController?.controller ?? null;
    const isCanceled = () => controller?.signal?.aborted === true;
    const cleanup = () => {
      if (streamId && activeStreams.get(streamId) === controller) {
        activeStreams.delete(streamId);
      }
    };
    const sendError = (error) => {
      if (isCanceled()) return;
      sendIfAlive(event, channels.error, decorate({ message: formatStreamError(error, request) }));
    };

    chatStateManager
      .streamMessage(request, {
        onChunk: (chunk) => {
          if (isCanceled()) return;
          sendIfAlive(event, channels.chunk, decorate(chunk));
        },
        onDone: (meta) => {
          if (isCanceled()) return;
          sendIfAlive(event, channels.done, decorate(meta));
          recordUsage(meta, Boolean(request?.isNewSession)).catch(() => {});
        },
        onError: sendError,
      })
      .catch(sendError)
      .finally(cleanup);
  }

  return {
    id: 'Chat',
    ipcHandlers: [
      {
        channel: 'chat:bootstrap',
        handler: async () => chatStateManager.getBootstrapPayload(),
      },
      {
        channel: 'chat:stream-message',
        handler: (event, request) => {
          const streamId =
            String(request?.streamId ?? '').trim() || `chat-${Date.now()}-${Math.random()}`;
          const controller = new AbortController();
          activeStreams.set(streamId, controller);
          streamMessage(
            event,
            { ...request, streamId, signal: controller.signal },
            {
              chunk: 'chat:stream-chunk',
              done: 'chat:stream-done',
              error: 'chat:stream-error',
            },
            (payload) => ({ streamId, ...payload }),
            { streamId, controller },
          );
          return null;
        },
      },
      {
        channel: 'chat:cancel-stream',
        handler: async (_event, request = {}) => {
          const streamId = String(request?.streamId ?? '').trim();
          const controller = activeStreams.get(streamId);
          if (!controller) {
            return { ok: true, canceled: false };
          }

          controller.abort();
          activeStreams.delete(streamId);
          return { ok: true, canceled: true };
        },
      },
      {
        channel: 'chat:cancel-all-streams',
        handler: async () => {
          const controllers = [...activeStreams.values()];
          activeStreams.clear();
          for (const controller of controllers) {
            controller.abort();
          }
          return { ok: true, canceled: controllers.length };
        },
      },

      // ── Agent streaming ──────────────────────────────────────────────────────
      // Like chat:stream-message but routes chunks to agents:stream-* channels
      // so agent token events don’t collide with the chat UI stream.
      // Each call carries a streamId that is echoed in every event so
      // concurrent agent tool-loop rounds can be demuxed in the renderer.
      {
        channel: 'chat:stream-message-agent',
        handler: (event, request) => {
          const { streamId } = request;
          streamMessage(
            event,
            { ...request, signal: null },
            {
              chunk: 'agents:stream-chunk',
              done: 'agents:stream-done',
              error: 'agents:stream-error',
            },
            (payload) => ({ streamId, ...payload }),
          );
          return null;
        },
      },
      {
        channel: 'chat:complete-message',
        handler: async (_event, request) => {
          const result = await chatStateManager.completeMessage(request);
          await recordUsage(result, Boolean(request?.isNewSession));
          return result;
        },
      },
      {
        channel: 'chat:enhance-prompt',
        handler: async (_event, { raw, providerId, modelId }) => {
          const result = await chatStateManager.enhancePrompt({ raw, providerId, modelId });
          await recordUsage(result, false);
          return result;
        },
      },
      {
        channel: 'chat:transcribe-voice',
        handler: async (event, request = {}) => {
          const samples = toAudioSamples(request.samples);
          if (!samples) return { ok: false, code: 'recording' };

          try {
            const text = await voiceTranscriber.transcribe(samples, (progress) => {
              sendIfAlive(event, 'chat:voice-model-progress', {
                progress: Number(progress?.progress ?? 0),
                status: progress?.status ?? '',
              });
            });
            return { ok: true, text };
          } catch (error) {
            return { ok: false, code: error?.code ?? 'transcription' };
          }
        },
      },
      {
        channel: 'chat:select-attachments',
        handler: async (event, options = {}) => {
          const allowImages = Boolean(options?.allowImages);
          const window = event.sender.getOwnerBrowserWindow();
          const docExtensions = getSupportedAttachmentExtensions();
          const imgExtensions = getImageAttachmentExtensions();

          const filters = [];

          if (allowImages) {
            filters.push({
              name: 'All supported files',
              extensions: [...imgExtensions, ...docExtensions],
            });
            filters.push({ name: 'Images', extensions: imgExtensions });
          }

          filters.push({ name: 'Documents, text, and code', extensions: docExtensions });

          const result = await dialog.showOpenDialog(window, {
            properties: ['openFile', 'multiSelections'],
            filters,
          });

          if (result.canceled) {
            return { attachments: [], rejected: [] };
          }

          return readAttachmentFiles(result.filePaths, { allowImages });
        },
      },
      {
        channel: 'chat:process-dropped-files',
        handler: async (_event, options = {}) => {
          const filePaths = Array.isArray(options?.filePaths) ? options.filePaths : [];
          const allowImages = Boolean(options?.allowImages);
          if (filePaths.length === 0) return { attachments: [], rejected: [] };
          return readAttachmentFiles(filePaths, { allowImages });
        },
      },
      {
        channel: 'chat:get-terminal-prompt',
        handler: async () => {
          const { terminalPrompt } = await chatStateManager.getBootstrapPayload();
          return { ok: true, terminalPrompt: terminalPrompt ?? '' };
        },
      },
      {
        // Proxy external HTTP GET requests through the main process so the
        // renderer is not blocked by CSP or Firebase origin restrictions when
        // the app is packaged.
        channel: 'chat:fetch-url',
        handler: async (_event, url) => {
          const { net } = await import('electron');
          const res = await net.fetch(url, {
            headers: { 'User-Agent': 'Joanium/1.0' },
          });
          if (!res.ok) return null;
          return res.json();
        },
      },
    ],
  };
}
