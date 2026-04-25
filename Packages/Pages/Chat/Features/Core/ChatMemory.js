import { t } from '../../../../System/I18n/index.js';
import { state } from '../../../../System/State.js';
import { fetchWithTools } from '../../../../Features/AI/index.js';
import { getPromptConfigs } from '../../../../System/Prompting/PromptConfig.js';
import { fillTemplate } from '../../../../System/Utils.js';
import { buildChatPayload } from '../Data/ChatPersistence.js';

let _memorySyncChain = Promise.resolve();
const _queuedSignatures = new Set();
// Abort controller for the active per-session memory-sync LLM call — cancelled when a new one starts
let _activeMemoryAbort = null;
// Abort controller for the active batch (catch-up) memory-sync LLM call.
// Killed immediately when the user sends a new message so it never competes
// with a live user query for API quota.
let _activeBatchMemoryAbort = null;
const _MAX_QUEUED_SIGNATURES = 100;

// Tracks the last time the user interacted (sent a message, loaded a chat, etc.).
// Memory flushes wait until the user has been genuinely idle for MIN_IDLE_MS.
const MIN_IDLE_BEFORE_FLUSH_MS = 10_000; // 10 s of quiet before touching the API
let _lastActivityAt = 0; // 0 = unknown, treated as very old

/** Call this whenever the user sends a message or loads a chat.
 *  Aborts ALL in-flight background memory LLM calls so the user's real
 *  query gets full API capacity — both the legacy batch path and the
 *  micro-queue path are killed instantly. */
export function markMemoryActivity() {
  _lastActivityAt = Date.now();
  if (_activeBatchMemoryAbort) {
    _activeBatchMemoryAbort.abort();
    _activeBatchMemoryAbort = null;
  }
  if (_microSyncAbort) {
    _microSyncAbort.abort();
    _microSyncAbort = null;
  }
}

function buildSnapshotScope(projectId = null) {
  return projectId ? { projectId: projectId } : {};
}

function hasMeaningfulConversation(messages = []) {
  return (Array.isArray(messages) ? messages : []).some(
    (message) =>
      'user' === message?.role &&
      (String(message?.content ?? '').trim() || (message?.attachments?.length ?? 0) > 0),
  );
}

function normalizeForSignature(value = '') {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function buildMemoryCatalogBlock(entries = [], mp = {}) {
  const catalogConfig = mp.catalog ?? {},
    fileList = entries.map((entry) => entry.filename).join(', '),
    nonEmptyEntries = entries.filter((entry) => {
      const lines = String(entry.content ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n');
      return (lines[0]?.trim().startsWith('#') && lines.shift(), lines.join('\n').trim());
    }),
    sections = [];
  return (
    fileList &&
      sections.push(fillTemplate(catalogConfig.availableFilesTemplate, { files: fileList })),
    nonEmptyEntries.length &&
      sections.push(
        nonEmptyEntries
          .map((entry) =>
            [
              fillTemplate(catalogConfig.fileHeaderTemplate, { filename: entry.filename }),
              catalogConfig.contentLabel,
              entry.content?.trim() || catalogConfig.emptyContentPlaceholder,
            ]
              .filter(Boolean)
              .join('\n'),
          )
          .join(catalogConfig.separator),
      ),
    sections.join('\n\n')
  );
}

function normalizeMemoryEntry(entry) {
  if (!entry || 'object' != typeof entry) return null;
  const filename = String(entry.filename ?? '').trim(),
    content = String(entry.content ?? '').trim();
  return filename && content ? { filename: filename, content: content } : null;
}

async function markSnapshotSynced(snapshot) {
  await window.electronAPI?.invoke?.(
    'mark-chat-personal-memory-synced',
    snapshot.id,
    snapshot.scope ?? {},
  );
}

function waitForUserIdle(pollMs = 500, maxWaitMs = 60000) {
  return new Promise((resolve) => {
    const isReallyIdle = () => {
      if (state.isTyping) return false;
      // Also require a minimum quiet period since the last user action so we
      // don't accidentally race with a request the user is about to send.
      if (_lastActivityAt > 0 && Date.now() - _lastActivityAt < MIN_IDLE_BEFORE_FLUSH_MS)
        return false;
      return true;
    };
    if (isReallyIdle()) return resolve();
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += pollMs;
      if (isReallyIdle() || elapsed >= maxWaitMs) {
        clearInterval(interval);
        resolve();
      }
    }, pollMs);
  });
}

function resolveProvider(snapshot = {}) {
  const preferredProviderId = String(snapshot.provider ?? '').trim();
  const preferredModelId = String(snapshot.model ?? '').trim();

  if (preferredProviderId && preferredModelId) {
    const provider = state.providers.find(
      (candidate) =>
        candidate.provider === preferredProviderId && candidate.models?.[preferredModelId],
    );
    if (provider) return { provider, modelId: preferredModelId };
  }

  return state.selectedProvider && state.selectedModel
    ? { provider: state.selectedProvider, modelId: state.selectedModel }
    : { provider: null, modelId: null };
}

function buildTranscript(messages = [], mp = {}) {
  const transcriptConfig = mp.transcript ?? {};
  return messages
    .map((message) => {
      const role =
        'assistant' === message.role ? transcriptConfig.assistantLabel : transcriptConfig.userLabel;
      const attachments = Array.isArray(message.attachments)
        ? message.attachments
            .map((attachment) => attachment?.name ?? attachment?.type ?? '')
            .filter(Boolean)
        : [];
      const attachmentLine = attachments.length
        ? `\n${fillTemplate(transcriptConfig.attachmentsTemplate, {
            attachments: attachments.join(', '),
          })}`
        : '';
      return `${fillTemplate(transcriptConfig.messageTemplate, {
        role,
        content: String(message.content ?? '').trim() || transcriptConfig.noTextPlaceholder,
      })}${attachmentLine}`;
    })
    .join('\n\n');
}

function extractJson(text = '') {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return -1 === start || -1 === end || end <= start ? null : text.slice(start, end + 1);
}

function normalizePayload(payload = {}) {
  return {
    updates: (Array.isArray(payload.updates) ? payload.updates : [])
      .map(normalizeMemoryEntry)
      .filter(Boolean),
    newFiles: (Array.isArray(payload.newFiles) ? payload.newFiles : [])
      .map(normalizeMemoryEntry)
      .filter(Boolean),
  };
}
function buildMemorySyncPrompt(
  { catalogBlock = '', transcript = '', conversationCount = null } = {},
  mp = {},
) {
  const intro =
    null == conversationCount
      ? mp.singleChatIntro
      : `${mp.batchChatIntroPrefix ?? ''}${conversationCount}${mp.batchChatIntroSuffix ?? ''}`;
  return [
    intro,
    '',
    mp.rulesLabel,
    ...(mp.rules ?? []).map((rule) => `- ${rule}`),
    '',
    mp.outputFormat,
    '',
    mp.catalogLabel,
    catalogBlock,
    '',
    null == conversationCount
      ? mp.singleTranscriptLabel
      : fillTemplate(mp.batchTranscriptLabelTemplate, { n: conversationCount }),
    transcript,
  ]
    .filter(Boolean)
    .join('\n');
}

function showMemoryIndicator(label) {
  const existing = document.getElementById('memory-learn-indicator');
  if (existing) {
    existing.querySelector('[data-memory-label]')?.replaceChildren(document.createTextNode(label));
    return () => {};
  }
  const el = document.createElement('div');
  el.id = 'memory-learn-indicator';
  el.innerHTML = `\n    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"\n         style="width:12px;height:12px;animation:spin 1.2s linear infinite;flex-shrink:0">\n      <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>\n    </svg>\n    <span data-memory-label>${label}</span>\n  `;
  el.style.cssText =
    '\n    position:fixed; top:48px; left:calc(var(--sidebar-w, 52px) + 14px); transform:none;\n    display:flex; align-items:center; gap:6px;\n    background:var(--bg-tertiary); border:1px solid var(--border-subtle);\n    border-radius:999px; padding:4px 12px;\n    font-size:11px; font-family:var(--font-ui); color:var(--text-muted);\n    z-index:50; animation:fadeIn 0.2s ease both;\n    pointer-events:none;\n  ';

  if (!document.getElementById('mem-spin-style')) {
    const style = document.createElement('style');
    style.id = 'mem-spin-style';
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(el);
  return () => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  };
}

function enqueueSnapshotMemorySync(snapshot, label = 'Updating memory...') {
  if (!snapshot) return Promise.resolve(false);
  const signature = (function (snapshot = {}) {
    const lastMessage = snapshot.messages?.[snapshot.messages.length - 1];
    return [
      snapshot.id,
      snapshot.updatedAt,
      snapshot.messages?.length ?? 0,
      normalizeForSignature(lastMessage?.content ?? ''),
    ].join('::');
  })(snapshot);

  if (_queuedSignatures.has(signature)) return _memorySyncChain;

  // Hard cap — prevent unbounded growth if many chats queue at once
  if (_queuedSignatures.size >= _MAX_QUEUED_SIGNATURES) _queuedSignatures.clear();

  _queuedSignatures.add(signature);
  _memorySyncChain = _memorySyncChain
    .catch(() => {})
    .then(async () => {
      const hideIndicator = showMemoryIndicator(label);
      try {
        const payload = { ...snapshot };
        delete payload.scope;
        delete payload.reason;
        await window.electronAPI?.invoke?.('save-chat', payload, snapshot.scope ?? {});

        const { provider, modelId } = resolveProvider(snapshot);
        if (!provider || !modelId) return false;

        const mp = (await getPromptConfigs()).memory ?? {},
          catalog = (await window.electronAPI?.invoke?.('get-personal-memory-catalog')) ?? [],
          transcript = buildTranscript(snapshot.messages, mp);

        if (!transcript.trim()) {
          await markSnapshotSynced(snapshot);
          _queuedSignatures.delete(signature);
          return true;
        }

        const prompt = buildMemorySyncPrompt(
          {
            catalogBlock: buildMemoryCatalogBlock(catalog, mp),
            transcript,
          },
          mp,
        );

        // Event-loop yield — lets channel events and other microtasks run
        // before we start a potentially long LLM call
        await new Promise((r) => setTimeout(r, 0));

        // Abort any in-flight memory sync and start a new one
        _activeMemoryAbort?.abort();
        _activeMemoryAbort = new AbortController();
        const signal = _activeMemoryAbort.signal;

        const result = await fetchWithTools(
          provider,
          modelId,
          [{ role: 'user', content: prompt, attachments: [] }],
          mp.systemPrompt,
          [],
          signal,
        );

        if (result.type !== 'text') throw new Error('Memory sync did not return text.');

        const jsonText = extractJson(result.text ?? '');
        if (!jsonText) throw new Error('Memory sync did not return valid JSON.');

        const updatePayload = normalizePayload(JSON.parse(jsonText));

        if (updatePayload.updates.length || updatePayload.newFiles.length) {
          const response = await window.electronAPI?.invoke?.(
            'apply-personal-memory-updates',
            updatePayload,
          );
          if (response?.ok === false) {
            throw new Error(response.error ?? 'Could not apply personal memory updates.');
          }
        }

        await markSnapshotSynced(snapshot);
        // Prune on success (was previously only pruned on failure)
        _queuedSignatures.delete(signature);
        return true;
      } finally {
        hideIndicator();
      }
    })
    .catch((error) => {
      _queuedSignatures.delete(signature);
      if (error?.name === 'AbortError') throw error;
      console.warn('[Chat] Personal memory sync failed (non-fatal):', error?.message ?? error);
      return false;
    });

  return _memorySyncChain;
}

export function queueCurrentSessionMemorySync(reason = 'session-end') {
  const snapshot = (function (reason = 'session-end') {
    const payload = buildChatPayload({
      chatId: state.currentChatId,
      messages: state.messages,
      provider: state.selectedProvider,
      model: state.selectedModel,
      activeProject: state.activeProject,
      workspacePath: state.workspacePath,
      conversationSummary: state.conversationSummary,
      conversationSummaryMessageCount: state.conversationSummaryMessageCount,
    });
    return payload && hasMeaningfulConversation(payload.messages)
      ? { ...payload, reason, scope: buildSnapshotScope(payload.projectId) }
      : null;
  })(reason);
  return enqueueSnapshotMemorySync(snapshot, t('chat.updatingMemory'));
}

async function processBatchedMemorySync(chats, signal = null) {
  const { provider, modelId } = resolveProvider();
  if (!provider || !modelId) return;

  const mp = (await getPromptConfigs()).memory ?? {},
    transcriptConfig = mp.transcript ?? {},
    catalog = (await window.electronAPI?.invoke?.('get-personal-memory-catalog')) ?? [];

  const combinedTranscripts = chats
    .map((chat, idx) => {
      const transcript = buildTranscript(chat.messages, mp);
      return fillTemplate(transcriptConfig.conversationDividerTemplate, {
        n: idx + 1,
        transcript,
      });
    })
    .filter((t) => t.trim().length > 0)
    .join('\n\n');

  if (!combinedTranscripts.trim()) return;

  const prompt = buildMemorySyncPrompt(
    {
      catalogBlock: buildMemoryCatalogBlock(catalog, mp),
      transcript: combinedTranscripts,
      conversationCount: chats.length,
    },
    mp,
  );

  await waitForUserIdle();

  const result = await fetchWithTools(
    provider,
    modelId,
    [{ role: 'user', content: prompt, attachments: [] }],
    mp.systemPrompt,
    [],
    signal,
  );

  if (result.type !== 'text') return;

  const jsonText = extractJson(result.text ?? '');
  if (!jsonText) return;

  try {
    const payload = normalizePayload(JSON.parse(jsonText));
    if (payload.updates.length || payload.newFiles.length) {
      await window.electronAPI?.invoke?.('apply-personal-memory-updates', payload);
    }
  } catch (e) {
    console.warn('[Chat] Failed to parse personal memory batch payload:', e);
  }
}

export async function flushPendingPersonalMemorySyncs(limit = 10) {
  if (!state.providers.length || (!state.selectedProvider && !state.selectedModel)) return;
  await waitForUserIdle();

  const pendingChats =
    (await window.electronAPI?.invoke?.('get-pending-personal-memory-chats', { limit })) ?? [];

  const meaningful = pendingChats.filter(
    (chat) => chat?.id && hasMeaningfulConversation(chat.messages),
  );

  if (!meaningful.length) return;

  // Create a fresh abort controller for this batch run and store it so
  // markMemoryActivity() can kill it the moment the user sends a message.
  const batchAbort = new AbortController();
  _activeBatchMemoryAbort = batchAbort;

  const hideIndicator = showMemoryIndicator(t('chat.catchingUpMemory'));
  try {
    await processBatchedMemorySync(meaningful, batchAbort.signal);

    // Only mark chats as synced if the run wasn't aborted mid-flight.
    if (!batchAbort.signal.aborted) {
      for (const chat of meaningful) {
        const snapshot = {
          ...chat,
          reason: 'pending-chat',
          scope: buildSnapshotScope(chat.projectId ?? null),
        };
        await markSnapshotSynced(snapshot);
      }
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error('[Chat] Batch memory sync failed:', err);
    }
    // AbortError means the user started a query — stay silent and let the
    // next idle window (scheduled by jo:user-activity) retry.
  } finally {
    hideIndicator();
    // Clear the stored ref only if it's still ours (markMemoryActivity may
    // have already nulled it and set a new one).
    if (_activeBatchMemoryAbort === batchAbort) {
      _activeBatchMemoryAbort = null;
    }
  }
}

// ─── Micro-sync queue ──────────────────────────────────────────────────────────────────────
// Processes pending chats ONE AT A TIME in the natural idle windows that
// already exist in conversation (user reading a response, planner thinking).
// Each run is short so aborting is instantaneous — zero latency impact.

let _microQueue = [];
let _microQueueLoaded = false;
let _microSyncAbort = null;
let _microSyncRunning = false;

/**
 * Load all pending-memory chats into the micro-queue once per session.
 * Sorted most-recent-first so the freshest memories land first.
 * Idempotent — safe to call multiple times.
 */
export async function initMemoryMicroQueue() {
  if (_microQueueLoaded) return;
  _microQueueLoaded = true;
  try {
    const pending =
      (await window.electronAPI?.invoke?.('get-pending-personal-memory-chats', { limit: 50 })) ??
      [];
    _microQueue = pending.filter((chat) => chat?.id && hasMeaningfulConversation(chat.messages));
    // Most-recent conversations first — they’re most likely to be relevant
    // to whatever the user is working on right now.
    _microQueue.sort((a, b) => {
      const tA = new Date(a.updatedAt ?? 0).getTime();
      const tB = new Date(b.updatedAt ?? 0).getTime();
      return tB - tA;
    });
  } catch {
    _microQueue = [];
  }
}

/**
 * Re-order the micro-queue so pending chats that share topic tokens with the
 * user’s current message float to the front. Call this before each agentLoop
 * so the most contextually-relevant memories are caught up first — if they’re
 * relevant to right now, they should be processed before ones that aren’t.
 */
export function reprioritizeMemoryQueue(userText = '') {
  if (_microQueue.length < 2 || !userText.trim()) return;
  const tokens = new Set(userText.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
  if (!tokens.size) return;
  _microQueue.sort((a, b) => _scoreTopicMatch(b, tokens) - _scoreTopicMatch(a, tokens));
}

function _scoreTopicMatch(chat, tokens) {
  const haystack = [
    chat.title ?? '',
    ...(chat.messages ?? []).slice(-6).map((m) => String(m.content ?? '').slice(0, 300)),
  ]
    .join(' ')
    .toLowerCase();
  let score = 0;
  for (const token of tokens) if (haystack.includes(token)) score++;
  return score;
}

/**
 * Process the NEXT pending chat from the micro-queue.
 *
 * Designed to be called at two natural idle points:
 *  1. RIGHT AFTER each AI response completes (user is reading = free window)
 *  2. IN PARALLEL with the planning phase (planning takes ~500ms anyway)
 *
 * One chat per call keeps each LLM round short. If the user starts typing
 * before it finishes, markMemoryActivity() kills it instantly via the abort
 * signal — the chat stays in the queue and retries at the next idle window.
 */
export async function triggerMicroSync() {
  if (_microSyncRunning || !_microQueue.length) return;
  const { provider, modelId } = resolveProvider();
  if (!provider || !modelId) return;

  // Brief yield: let the UI finish painting before opening a background
  // network connection. Keeps the response render feeling snappy.
  await new Promise((r) => setTimeout(r, 800));

  // If the user became active during the yield, stand down.
  if (
    state.isTyping ||
    (_lastActivityAt > 0 && Date.now() - _lastActivityAt < MIN_IDLE_BEFORE_FLUSH_MS)
  )
    return;

  const chat = _microQueue[0];
  if (!chat) return;

  _microSyncRunning = true;
  const abort = new AbortController();
  _microSyncAbort = abort;

  const hideIndicator = showMemoryIndicator(t('chat.catchingUpMemory'));
  try {
    // Re-use the existing batch processor with a single-element array —
    // same logic, same prompt, same quality. Just one chat at a time.
    await processBatchedMemorySync([chat], abort.signal);

    if (!abort.signal.aborted) {
      _microQueue.shift(); // only pop on confirmed success
      const snapshot = {
        ...chat,
        reason: 'micro-sync',
        scope: buildSnapshotScope(chat.projectId ?? null),
      };
      await markSnapshotSynced(snapshot);
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      // Persistent failure — skip so the rest of the queue isn’t blocked
      _microQueue.shift();
      console.warn('[Chat] Micro-sync skipped after error:', err?.message);
    }
    // AbortError: user became active — leave in queue, retry next gap
  } finally {
    hideIndicator();
    _microSyncRunning = false;
    if (_microSyncAbort === abort) _microSyncAbort = null;
  }
}
