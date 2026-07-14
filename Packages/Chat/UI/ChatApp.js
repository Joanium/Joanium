import {
  getTimeGreetings,
  isBirthdayToday,
  getBirthdayGreeting,
  isChristmasToday,
  getChristmasGreeting,
  isNewYearToday,
  getNewYearGreeting,
  getPrivateGreeting,
} from '../../../Datasets/Messages.js';
import { getRandomSuggestions } from '../../../Datasets/Suggestions.js';
import {
  copyToClipboard,
  createElement,
  createLoadingDots,
  formatText,
} from '../../Shared/Utils/DomUtils.js';
import { collapseWhitespace, extractJsonObject, truncate } from '../../Shared/Utils/StringUtils.js';
import { toFileUrl } from '../../Shared/Utils/UrlUtils.js';
import { invokeIpc, onIpc } from '../../Shared/Ipc/RendererIpc.js';
import { createIcon } from '../../Shared/Icons/Icons.js';
import { EVENTS, dispatchEvent } from '../../Shared/Events/RendererEvents.js';
import { parseThinkingFromText } from '../../Shared/Markdown/ThinkingParser.js';
import { normalizeSubAgentTasks } from '../../Shared/SubAgents/SubAgentTasks.js';
import {
  createAssistantContextCache,
  createAssistantPipelineRequest,
  joinPromptParts,
  loadAssistantPipelineRuntime,
  resetAssistantContextCache,
} from '../../Shared/AssistantRuntime/AssistantPipeline.js';
import {
  executeTerminalTool as executeRendererTerminalTool,
  formatToolsetResultForModel,
  parseAllToolRequests,
} from '../../Shared/ToolLoop/RendererToolLoop.js';
import { SUB_AGENT_TERMINAL_TOOL_NAMES } from '../../Shared/ToolLoop/TerminalToolNames.js';
import { createAttachmentPill } from './AttachmentPill.js';
import { createBrowserPreviewPanel } from './BrowserPreviewPanel.js';
import { createTechFeedPanel } from './TechFeedPanel.js';
import { createDiagnosticPanel, measureFetch, resolveProviderBaseUrl } from './DiagnosticPanel.js';
import { createDropZoneOverlay } from './DropZoneOverlay.js';
import { createWhatsNewOverlay } from './WhatsNewOverlay.js';
import { createFileDiffTracker } from './FileDiffTracker.js';
import { createGitBranchPickerPanel, orderGitBranches } from './GitBranchPickerPanel.js';
import {
  createAssistantGroupElement,
  createMessageElement,
  createUserAvatar,
  updateLastStreamingMessage,
  updateSubAgentCard,
} from './MessageElements.js';
import { createModelPickerPanel, getPreferredProvider } from './ModelPickerPanel.js';
import {
  createChatTerminalPanel,
  formatTerminalResultForModel,
  getTerminalActionSummary,
  getTerminalToolLabel,
} from './TerminalPanel.js';
import {
  buildModelContent,
  formatPromptTemplate,
  generateSessionId,
  getFirstName,
  loadLiveBrowserContext,
  normalizeSubAgentPayloadParameters,
  sanitizeAssistantVisibleContent,
  toAttachmentSummary,
} from './Utils.js';
import {
  initSounds,
  markCompletionAborted,
  play,
  playCompletion,
} from '../../Shared/Sounds/SoundManager.js';
import { attachCustomScrollbar } from '../../Shared/CustomScrollbar/CustomScrollbar.js';
import { iconMarkup } from '../../Shared/Icons/Icons.js';
import { isOnline } from '../../Shared/OfflineMonitor/OfflineMonitor.js';
import { CHAT_PROMPTS } from '../Prompts/Prompts.js';
import { SEARCH_ENGINE_SEARCH_URLS } from './Shared/DefaultSearchInfo.js';

const MAX_TERMINAL_TOOL_CALLS = 100;
const SUB_AGENT_TERMINAL_TOOL_SET = new Set(SUB_AGENT_TERMINAL_TOOL_NAMES);
const PROJECT_SCOPED_MUTATION_TOOLS = new Set([
  'write_local_file',
  'apply_file_patch',
  'delete_local_item',
  'create_directory',
  'move_local_file',
  'copy_local_file',
]);
const SHELL_FILE_MUTATION_PATTERNS = Object.freeze([
  />{1,2}/,
  /\b(?:Set-Content|Add-Content|Out-File|New-Item|Remove-Item)\b/i,
  /\b(?:mkdir|md|touch|cp|copy|mv|move|rm|del|erase)\b/i,
  /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|unlink|link)\b/i,
]);

const PROTECTED_GIT_BRANCHES = new Set([
  'main',
  'master',
  'develop',
  'dev',
  'production',
  'prod',
  'staging',
  'release',
]);

export async function createChatView(
  strings,
  {
    getActiveProject,
    onActiveProjectChange,
    getActivePersona,
    onActivePersonaChange,
    getProfile,
    onNavigate,
    onOpenSettings,
    onLockApp,
  } = {},
) {
  initSounds();

  const [payload, appSettings, fetchedFavourites] = await Promise.all([
    invokeIpc('chat:bootstrap'),
    invokeIpc('app-settings:get').catch(() => null),
    invokeIpc('providers:list-model-favourites').catch(() => []),
  ]);
  const view = createElement('div', 'chat-view');
  let currentAppSettings = appSettings ?? {};
  let modelFavourites = fetchedFavourites || [];
  const dropOverlay = createDropZoneOverlay(strings);
  const profile = getProfile?.() ?? payload.user?.profile ?? {};
  const firstName = getFirstName(profile.name, strings.appName);
  const hour = new Date().getHours();
  const isBirthday = isBirthdayToday(profile.dateOfBirth);
  const isChristmas = !isBirthday && isChristmasToday();
  const isNewYear = !isBirthday && !isChristmas && isNewYearToday();
  const greetings = getTimeGreetings(hour, firstName);

  // Resolve the active provider/model. A user-configured default model (set
  // in App Settings) takes precedence; if none is set we fall back to the
  // auto-detected preferred provider.
  let activeProvider = null;
  let activeModel = null;
  let activeModelLabel = strings.composer.modelFallback;

  const dm = currentAppSettings?.defaultModel;
  if (dm?.providerId && dm?.modelId) {
    const dmProvider = payload.providers.find((p) => p.id === dm.providerId) ?? null;
    const dmModel = dmProvider?.models?.find((m) => m.id === dm.modelId) ?? null;
    if (dmProvider && dmModel) {
      activeProvider = dmProvider;
      activeModel = dmModel;
      activeModelLabel = dmModel.name ?? dmModel.id;
    }
  }

  if (!activeProvider) {
    activeProvider = getPreferredProvider(payload);
    activeModel = activeProvider?.models?.[0] ?? null;
    activeModelLabel =
      activeModel?.name ?? activeProvider?.featuredModels?.[0] ?? strings.composer.modelFallback;
  }
  let activePersona = getActivePersona?.() ?? null;
  let activeProject = getActiveProject?.() ?? null;
  let draftValue = '';
  let pendingAttachments = [];
  let attachmentNoticeTimer = null;
  let isSending = false;
  let isEnhancing = false;
  let isPrivate = false;
  let accText = '';
  let accThinking = '';
  let sessionId = null;
  let sessionCreatedAt = null;
  let messages = [];
  let prevHasMessages = false;
  let isLoadingSession = false;
  let streamDisposers = [];
  let generationToken = 0;
  let streamSequence = 0;
  let activeStreamId = null;
  let modelPickerPanel = null;
  let modelPickerDispose = null;
  let modelPickerHide = null;
  let modelPickerOpen = false;
  let modelPickerNeedsRebuild = false;
  let terminalPanel = null;
  let scrollToBottomBtn = null;
  let diagTimer = null;
  let diagPanel = null;
  let memorySyncTimer = null;
  let memorySyncRunning = false;
  let slashCommandsLoaded = false;
  let track = null;
  let trackLabel = null;
  let slashCommands = [];
  let slashFilteredCommands = [];
  let slashSelectedIndex = 0;
  let slashStartIndex = 0;
  let activeMode = null;
  let activeModeInstruction = null;
  let terminalProcessRenderFrame = null;
  let terminalProcessCardsWired = false;
  let completedWrites = new Set(); // dedup guard for write_local_file
  let streamUpdateFrame = null;
  const assistantContextCache = createAssistantContextCache();

  // Tracks whether the live browser panel is currently visible so the
  // composer browser button can reflect the active state correctly.
  let isBrowserOpen = false;

  let userScrolledUp = false;
  let scrollToBottomFrame = null;

  function isNearBottom() {
    if (!scroll) return true;
    return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
  }

  function scheduleScrollToBottom() {
    if (userScrolledUp) return;
    if (scrollToBottomFrame) return;
    scrollToBottomFrame = requestAnimationFrame(() => {
      scrollToBottomFrame = null;
      if (!userScrolledUp && scroll) scroll.scrollTop = scroll.scrollHeight;
    });
  }

  function syncScrollToBottomBtn() {
    if (!scrollToBottomBtn) return;
    scrollToBottomBtn.classList.toggle('chat-scroll-to-bottom-btn--visible', userScrolledUp);
  }

  function showUserTyping() {
    if (!thread || thread.hidden) return;
    if (!userTypingEl) {
      userTypingEl = createElement('div', 'chat-message chat-message--user chat-message--typing');
      const row = createElement('div', 'chat-message__row');
      const contentEl = createElement('div', 'chat-message__content');
      const bubble = createElement('div', 'chat-message__bubble');
      bubble.append(createLoadingDots());
      contentEl.append(bubble);
      const currentProfile = getProfile?.() ?? profile;
      row.append(contentEl, createUserAvatar(currentProfile));
      userTypingEl.append(row);
    }
    if (!userTypingEl.isConnected) thread.append(userTypingEl);
    scheduleScrollToBottom();
  }

  function hideUserTyping() {
    clearTimeout(userTypingTimer);
    userTypingTimer = null;
    userTypingEl?.remove();
  }

  let composerField = null;
  let attachmentsEl = null;
  let attachmentNotice = null;
  let slashMenu = null;
  let slashScroller = null;
  let sendButton = null;
  let enhanceBtn = null;
  let attachBtn = null;
  let terminalBtn = null;
  let browserBtn = null;
  let thread = null;
  let userTypingEl = null;
  let userTypingTimer = null;
  let title = null;
  let bubblesEl = null;
  let techFeedEl = null;
  let welcomeWrap = null;
  let composer = null;
  let scroll = null;
  let bottom = null;
  let fileDiffPanel = null;
  let fileDiffTracker = null;

  let projectPill = null;
  let projectNameEl = null;
  let projectMetaEl = null;
  let projectIconEl = null;
  let gitBarEl = null;
  let gitIdentityEl = null;
  let gitBranchEl = null;
  let gitMetaEl = null;
  let gitStatusDotEl = null;
  let gitBranchButton = null;
  let gitBranchButtonLabelEl = null;
  let gitBranchButtonDotEl = null;
  let gitBranchPicker = null;
  let gitBranchPickerOpen = false;
  let gitBranchPickerBusy = false;
  let gitBranchPickerCleanup = null;
  let gitBranchPickerListenerTimer = null;
  let gitPrimaryBtn = null;
  let gitSecondaryBtn = null;
  let gitMenuBtn = null;
  let gitRefreshBtn = null;
  let gitActionMenuEl = null;
  let gitCommitPanelEl = null;
  let gitCommitFieldWrapEl = null;
  let gitCommitMessageEl = null;
  let gitCommitConfirmBtn = null;
  let gitCommitCancelBtn = null;
  let gitCommitAiBtn = null;
  let gitCommitStatusEl = null;
  let gitPendingAction = null;
  let gitRefreshTimer = null;
  let gitState = null;
  let gitBusy = false;
  let gitAiBusy = false;
  let modelButton = null;
  let contextViz = null;
  let contextVizVisible = false;

  function scheduleTerminalProcessRender() {
    if (terminalProcessRenderFrame) return;
    terminalProcessRenderFrame = requestAnimationFrame(() => {
      terminalProcessRenderFrame = null;
      renderThread();
    });
  }

  function appendTerminalCardOutput(currentOutput, nextText) {
    const output = `${String(currentOutput ?? '')}${String(nextText ?? '')}`;
    return output.length > 96000 ? output.slice(output.length - 96000) : output;
  }

  function formatVisibleToolOutput(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function refreshContextVisualizer() {
    if (!contextViz || !contextVizVisible) return;

    const systemPrompt = document.querySelector('.chat-system-prompt')?.textContent ?? '';
    contextViz.update({
      systemPrompt,
      model: activeModel,
      conversation:
        messages?.filter((message) => !message.pending && !message.streaming && !message.empty) ??
        [],
    });
  }

  function isLocalProvider(provider) {
    return provider?.type === 'local' || provider?.requiresApiKey === false;
  }

  function shouldShortCircuitOffline() {
    return !isOnline() && !isLocalProvider(activeProvider);
  }

  function updateTerminalProcessCard(processId, updater) {
    const id = String(processId ?? '').trim();
    if (!id) return;

    let changed = false;
    messages = messages.map((message) => {
      if (message.terminal?.processId !== id) return message;
      changed = true;
      return {
        ...message,
        terminal: updater(message.terminal),
      };
    });

    if (changed) scheduleTerminalProcessRender();
  }

  function wireTerminalProcessCards() {
    if (terminalProcessCardsWired) return;
    terminalProcessCardsWired = true;

    onIpc('terminal:process-output', (payload) => {
      updateTerminalProcessCard(payload?.processId, (terminal) => ({
        ...terminal,
        status: 'running',
        statusLabel: strings.terminal.running,
        output: appendTerminalCardOutput(terminal.output, payload?.text ?? ''),
      }));
    });

    onIpc('terminal:process-exit', (payload) => {
      const exitLine = `\n${formatText(strings.terminal.processExited, { code: String(payload?.code ?? 0) })}\n`;
      updateTerminalProcessCard(payload?.processId, (terminal) => ({
        ...terminal,
        status: payload?.code === 0 ? 'completed' : 'failed',
        statusLabel:
          payload?.code === 0 ? strings.terminal.completedTool : strings.terminal.failedTool,
        output: appendTerminalCardOutput(terminal.output, exitLine),
        exitCode: payload?.code ?? 0,
      }));
    });
  }

  if (!activePersona) {
    try {
      activePersona = await invokeIpc('personas:load-persona', 'Joanium', 'Joana.md');
      onActivePersonaChange?.(activePersona);
    } catch (error) {
      console.error('[Joanium] Failed to load default persona:', error);
    }
  }

  function showAttachmentNotice(message, tone = 'info') {
    if (!attachmentNotice) return;

    clearTimeout(attachmentNoticeTimer);
    attachmentNotice.textContent = message;
    attachmentNotice.hidden = false;
    attachmentNotice.className = `chat-composer__notice chat-composer__notice--${tone}`;

    attachmentNoticeTimer = setTimeout(() => {
      if (attachmentNotice) {
        attachmentNotice.hidden = true;
        attachmentNotice.textContent = '';
      }
    }, 3200);
  }

  function renderPendingAttachments() {
    if (!attachmentsEl) return;

    attachmentsEl.replaceChildren();
    attachmentsEl.hidden = pendingAttachments.length === 0;

    for (const attachment of pendingAttachments) {
      attachmentsEl.append(
        createAttachmentPill(attachment, strings, {
          removable: true,
          onRemove(id) {
            pendingAttachments = pendingAttachments.filter((item) => item.id !== id);
            renderPendingAttachments();
            syncComposer();
            focusComposer();
          },
        }),
      );
    }
  }

  function applyAttachmentResult(result) {
    const incoming = Array.isArray(result?.attachments) ? result.attachments : [];
    const rejected = Array.isArray(result?.rejected) ? result.rejected : [];

    if (incoming.length > 0) {
      pendingAttachments = [...pendingAttachments, ...incoming];
      renderPendingAttachments();
      syncComposer();
    } else if (rejected.length === 0) {
      attachmentNotice.hidden = true;
    }

    if (rejected.length > 0) {
      showAttachmentNotice(
        formatText(strings.composer.attachmentRejected, { count: String(rejected.length) }),
        'warning',
      );
    }
  }

  async function selectAttachments() {
    if (isSending) return;
    const allowImages = activeModel?.inputs?.image === true;

    try {
      const result = await invokeIpc('chat:select-attachments', { allowImages });
      applyAttachmentResult(result);
    } catch (error) {
      showAttachmentNotice(
        formatText(strings.composer.attachmentFailed, {
          message: error?.message ?? String(error),
        }),
        'warning',
      );
    } finally {
      focusComposer();
    }
  }

  function removeStreamListeners() {
    if (streamUpdateFrame) {
      cancelAnimationFrame(streamUpdateFrame);
      streamUpdateFrame = null;
    }
    for (const dispose of streamDisposers) {
      dispose();
    }
    streamDisposers = [];
  }

  function createStreamId(runToken) {
    streamSequence += 1;
    return `${sessionId ?? 'chat'}-${runToken}-${streamSequence}-${Date.now()}`;
  }

  function clearActiveStreamId(streamId) {
    if (activeStreamId === streamId) {
      activeStreamId = null;
    }
  }

  function cancelActiveStream() {
    const streamId = activeStreamId;
    if (!streamId) return;
    activeStreamId = null;
    void invokeIpc('chat:cancel-stream', { streamId }).catch(() => {});
  }

  async function saveCurrentSession({ bumpUpdatedAt = true } = {}) {
    if (isPrivate) return;
    if (!sessionId || messages.length === 0) return;
    const firstUser = messages.find((message) => message.role === 'user');
    if (!firstUser) return;

    const now = new Date().toISOString();
    const sessionMessages = messages
      .filter(
        (message) =>
          !message.hidden &&
          !message.streaming &&
          !message.pending &&
          (message.content || message.terminal),
      )
      .map(
        ({
          role,
          content,
          thinking,
          modelContent,
          attachments,
          terminal,
          providerLabel,
          modelLabel,
          starred,
        }) => {
          const safeContent =
            role === 'assistant' ? sanitizeAssistantVisibleContent(content) : content;
          const entry = { role, content: safeContent };
          if (thinking) {
            entry.thinking =
              role === 'assistant' ? sanitizeAssistantVisibleContent(thinking) : thinking;
          }
          if (modelContent && modelContent !== content) entry.modelContent = modelContent;
          if (attachments?.length) entry.attachments = attachments.map(toAttachmentSummary);
          if (terminal) entry.terminal = terminal;
          if (providerLabel && role === 'assistant') entry.providerLabel = providerLabel;
          if (modelLabel && role === 'assistant') entry.modelLabel = modelLabel;
          if (starred) entry.starred = true;
          return entry;
        },
      )
      .filter((message) => message.content || message.terminal);

    const sessionData = {
      id: sessionId,
      title: truncate(collapseWhitespace(firstUser.content), 60),
      createdAt: sessionCreatedAt ?? now,
      // Only bump updatedAt when content is actually changing (not for metadata
      // operations like starring a message that shouldn't move the session to
      // the top of the history list or change its date-group label).
      ...(bumpUpdatedAt ? { updatedAt: now } : {}),
      messages: sessionMessages,
    };

    if (activeProject?.id) {
      sessionData.projectId = activeProject.id;
    }

    const savedSession = await invokeIpc('history:save-session', sessionData);
    if (savedSession?.personalMemoryPending) {
      scheduleMemorySync(12000);
    }
    return savedSession;
  }

  async function buildProjectContext(project) {
    if (!project) return '';

    const info = collapseWhitespace(project.info);
    const folder = collapseWhitespace(project.folderPath ?? project.rootPath);

    const base = formatPromptTemplate(payload.projectContextPrompt, {
      name: collapseWhitespace(project.name),
      info,
      folder,
    });

    // Automatically inject key doc files from the project folder so the AI
    // always has full project context without the user needing to attach them.
    let docsPrompt = '';
    if (folder) {
      try {
        docsPrompt = (await invokeIpc('projects:read-project-docs', folder)) ?? '';
      } catch {
        // Non-fatal — proceed without doc injection if the IPC fails.
      }
    }

    return docsPrompt ? `${base}\n\n${docsPrompt}` : base;
  }

  async function loadMemoryContext() {
    const { memoryContext } = await loadAssistantPipelineRuntime({
      contextCache: assistantContextCache,
      includeTerminalPrompt: false,
      includeToolsetPrompt: false,
    });
    return memoryContext;
  }

  function normalizeMemoryEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const filename = String(entry.filename ?? '').trim();
    const content = String(entry.content ?? '').trim();
    return filename && content ? { filename, content } : null;
  }

  function normalizeMemorySyncPayload(rawPayload = {}) {
    return {
      updates: (Array.isArray(rawPayload.updates) ? rawPayload.updates : [])
        .map(normalizeMemoryEntry)
        .filter(Boolean),
      newFiles: (Array.isArray(rawPayload.newFiles) ? rawPayload.newFiles : [])
        .map(normalizeMemoryEntry)
        .filter(Boolean),
    };
  }

  function buildMemoryCatalogBlock(catalog = []) {
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return strings.memorySync.emptyContent;
    }
    const fileList = catalog
      .map((entry) => entry.filename)
      .filter(Boolean)
      .join(', ');
    const sections = [];

    if (fileList) {
      sections.push(formatText(strings.memorySync.availableFiles, { files: fileList }));
    }

    const fileSections = catalog
      .map((entry) => {
        const content = String(entry.content ?? '').trim() || strings.memorySync.emptyContent;
        return [
          formatText(strings.memorySync.fileHeader, { filename: entry.filename ?? '' }),
          strings.memorySync.contentLabel,
          content,
        ].join('\n');
      })
      .join('\n\n---\n\n');

    if (fileSections) {
      sections.push(fileSections);
    }

    return sections.join('\n\n');
  }

  function buildMemoryTranscript(session) {
    return (Array.isArray(session?.messages) ? session.messages : [])
      .map((message) => {
        const role =
          message.role === 'assistant'
            ? strings.memorySync.assistantLabel
            : strings.memorySync.userLabel;
        const content = String(message.content ?? message.modelContent ?? '').trim();
        const attachments = Array.isArray(message.attachments)
          ? message.attachments
              .map((attachment) => attachment?.name ?? attachment?.filename ?? attachment?.kind)
              .filter(Boolean)
          : [];
        const attachmentLine = attachments.length
          ? `\n${formatText(strings.memorySync.attachmentsLabel, {
              attachments: attachments.join(', '),
            })}`
          : '';
        return `${role}: ${content || strings.memorySync.noText}${attachmentLine}`;
      })
      .join('\n\n');
  }

  function showMemorySyncIndicator(label) {
    dispatchEvent(EVENTS.MEMORY_SYNC, { active: true, message: label });
  }

  function hideMemorySyncIndicator() {
    dispatchEvent(EVENTS.MEMORY_SYNC, { active: false });
  }

  function cancelScheduledMemorySync() {
    if (memorySyncTimer) {
      clearTimeout(memorySyncTimer);
      memorySyncTimer = null;
    }
  }

  function scheduleMemorySync(delayMs = 45000) {
    cancelScheduledMemorySync();
    if (currentAppSettings?.autoMemoryUpdates === false) {
      return;
    }
    memorySyncTimer = setTimeout(() => {
      memorySyncTimer = null;
      void processPendingMemorySyncs();
    }, delayMs);
  }

  async function runMemorySyncForSession(session) {
    const catalog = await invokeIpc('memory:get-catalog');
    const prompt = [
      `${strings.memorySync.catalogLabel}:`,
      buildMemoryCatalogBlock(catalog),
      '',
      `${strings.memorySync.transcriptLabel}:`,
      buildMemoryTranscript(session),
    ].join('\n');

    const result = await invokeIpc('chat:complete-message', {
      messages: [{ role: 'user', content: prompt }],
      providerId: activeProvider?.id ?? null,
      modelId: activeModel?.id ?? null,
      modeInstruction: payload.memoryPrompt || null,
      isNewSession: false,
    });

    const jsonText = extractJsonObject(result?.text);
    if (!jsonText) {
      throw new Error('Memory sync did not return JSON.');
    }

    const memoryPayload = normalizeMemorySyncPayload(JSON.parse(jsonText));
    if (memoryPayload.updates.length || memoryPayload.newFiles.length) {
      await invokeIpc('memory:apply-updates', memoryPayload);
    }

    await invokeIpc('history:mark-memory-synced', session.id, {
      projectId: session.projectId ?? null,
      fingerprint: session.personalMemoryFingerprint ?? null,
    });
  }

  async function processPendingMemorySyncs({ force = false } = {}) {
    if (memorySyncRunning || isSending || isPrivate) {
      return;
    }

    const latestSettings = await invokeIpc('app-settings:get').catch(() => currentAppSettings);
    currentAppSettings = latestSettings ?? currentAppSettings;
    if (!force && currentAppSettings?.autoMemoryUpdates === false) {
      return;
    }

    const pending = await invokeIpc('history:list-memory-pending', { limit: 3 }).catch(() => []);
    if (!Array.isArray(pending) || pending.length === 0) {
      return;
    }

    memorySyncRunning = true;
    showMemorySyncIndicator(
      pending.length > 1 ? strings.memorySync.catchingUp : strings.memorySync.updating,
    );

    try {
      for (const session of pending) {
        if (isSending) break;
        await runMemorySyncForSession(session);
      }
    } catch {
      // Background memory learning is best-effort; failed sessions remain pending.
    } finally {
      memorySyncRunning = false;
      hideMemorySyncIndicator();
      invokeIpc('memory:run-cleanup').catch(() => {});
      if (!isSending) {
        scheduleMemorySync(90000);
      }
    }
  }

  window.addEventListener(EVENTS.CONNECTORS_CHANGED, () => {
    resetAssistantContextCache(assistantContextCache);
  });

  // Re-fetch provider data whenever the user connects or disconnects a provider.
  // The initial payload (providers + user details incl. API keys) is fetched once
  // at boot and cached — without this refresh, newly-saved API keys are invisible
  // to the model picker, so the provider never appears as selectable.
  window.addEventListener(EVENTS.PROVIDERS_CHANGED, () => {
    invokeIpc('chat:bootstrap')
      .then((freshPayload) => {
        payload.providers = freshPayload.providers;
        payload.user = freshPayload.user;
        // Destroy the cached picker panel so it rebuilds with the updated
        // provider list and API-key details on the next open.
        if (modelPickerPanel) {
          modelPickerDispose?.();
          modelPickerPanel = null;
          modelPickerDispose = null;
          modelPickerHide = null;
          modelPickerOpen = false;
        }
      })
      .catch(() => {
        // Silent fail — stale data is better than a crash.
      });
  });

  function applyActiveProject(project) {
    const previousRoot = collapseWhitespace(activeProject?.folderPath ?? activeProject?.rootPath);
    activeProject = project
      ? {
          id: project.id,
          name: project.name ?? '',
          icon: project.icon ?? '',
          info: project.info ?? '',
          folderPath: project.folderPath ?? project.rootPath ?? '',
          rootPath: project.rootPath ?? project.folderPath ?? '',
          coverImagePath: project.coverImagePath ?? '',
        }
      : null;
    syncActiveProjectPill();
    refreshContextVisualizer();
    const nextRoot = collapseWhitespace(activeProject?.folderPath ?? activeProject?.rootPath);
    if (previousRoot !== nextRoot) {
      fileDiffTracker?.reset();
    } else {
      fileDiffTracker?.render();
    }
  }

  function clearActiveProject() {
    applyActiveProject(null);
    onActiveProjectChange?.(null);
  }

  function getActiveProjectFolder() {
    return collapseWhitespace(activeProject?.folderPath ?? activeProject?.rootPath);
  }

  function isShellFileMutation(action) {
    if (action?.tool !== 'run_shell_command') return false;
    const command = String(action.payload?.command ?? '');
    return SHELL_FILE_MUTATION_PATTERNS.some((pattern) => pattern.test(command));
  }

  function parseGitStatusOutput(stdout = '') {
    const lines = String(stdout ?? '')
      .split(/\r?\n/)
      .filter(Boolean);
    const header = lines[0] ?? '';
    const branchMatch = header.match(/^## (?:No commits yet on )?(.+?)(?:\.\.\.|\s|$)/);
    const aheadMatch = header.match(/ahead (\d+)/);
    const behindMatch = header.match(/behind (\d+)/);
    const dirty = lines.slice(1).some((line) => line.trim());

    return {
      branch: branchMatch?.[1]?.trim() || strings.git.unknownBranch,
      dirty,
      ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
      behind: behindMatch ? Number(behindMatch[1]) : 0,
    };
  }

  function positionFloatingPanel(panel, triggerButton, preferredWidth = 320) {
    if (!panel || !triggerButton) return;
    const rect = triggerButton.getBoundingClientRect();
    const panelWidth = Math.min(preferredWidth, window.innerWidth - 32);
    const maxLeft = Math.max(16, window.innerWidth - panelWidth - 16);
    const left = Math.min(Math.max(rect.left, 16), maxLeft);
    panel.style.left = `${left}px`;
    panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  }

  function clearGitBranchPickerListeners() {
    if (gitBranchPickerListenerTimer) {
      clearTimeout(gitBranchPickerListenerTimer);
      gitBranchPickerListenerTimer = null;
    }
    gitBranchPickerCleanup?.();
    gitBranchPickerCleanup = null;
  }

  function setGitBranchPickerBusy(busy) {
    gitBranchPickerBusy = busy;
    gitBranchPicker?.setBusy(gitBusy || busy);
    syncGitBranchButton();
  }

  function closeGitBranchPicker({ reset = false } = {}) {
    if (!gitBranchPicker) return;
    gitBranchPicker.element.classList.remove('chat-branch-picker--open');
    gitBranchButton?.classList.remove('chat-composer__branch--open');
    clearGitBranchPickerListeners();
    gitBranchPickerOpen = false;
    setGitBranchPickerBusy(false);

    if (reset) {
      gitBranchPicker.input.value = '';
      gitBranchPicker.setStatus('');
      gitBranchPicker.renderBranches({ current: '', branches: [] });
    }
  }

  function syncGitBranchButton() {
    if (!gitBranchButton || !gitBranchButtonLabelEl || !gitBranchButtonDotEl) return;

    const visible = Boolean(activeProject && gitState);
    gitBranchButton.hidden = !visible;

    if (!visible) {
      gitBranchButtonLabelEl.textContent = '';
      gitBranchButton.classList.remove('chat-composer__branch--open');
      gitBranchButton.disabled = true;
      return;
    }

    gitBranchButtonLabelEl.textContent = gitState.branch;
    gitBranchButton.setAttribute(
      'aria-label',
      formatText(strings.git.switchBranch, { branch: gitState.branch }),
    );
    gitBranchButtonDotEl.classList.toggle('chat-gitbar__dot--dirty', gitState.dirty);
    gitBranchButtonDotEl.classList.toggle('chat-gitbar__dot--clean', !gitState.dirty);
    gitBranchButtonDotEl.setAttribute(
      'aria-label',
      gitState.dirty ? strings.git.dirty : strings.git.clean,
    );
    gitBranchButton.disabled = isEnhancing || gitBusy || gitBranchPickerBusy;
  }

  function ensureGitBranchPicker() {
    if (gitBranchPicker) return gitBranchPicker;

    function isBranchDeletable(name) {
      return !PROTECTED_GIT_BRANCHES.has(
        String(name ?? '')
          .trim()
          .toLowerCase(),
      );
    }

    gitBranchPicker = createGitBranchPickerPanel({
      strings,
      onCreateBranch: async (branchName) => {
        await runGitBranchMutation({
          branch: branchName,
          channel: 'terminal:git-create-branch',
          resultLabel: strings.git.resultLabels.createBranch,
          commandLabel: strings.git.commands.createBranch,
          successText: (nextBranch) =>
            formatText(strings.git.branchCreated, { branch: nextBranch }),
        });
      },
      onCheckoutBranch: async (branchName) => {
        if (branchName === gitState?.branch) {
          closeGitBranchPicker();
          return;
        }

        await runGitBranchMutation({
          branch: branchName,
          channel: 'terminal:git-checkout-branch',
          resultLabel: strings.git.resultLabels.checkout,
          commandLabel: strings.git.commands.checkout,
          successText: (nextBranch) =>
            formatText(strings.git.branchSwitched, { branch: nextBranch }),
        });
      },
      onDeleteBranch: async (branchName) => {
        if (branchName === gitState?.branch) {
          gitBranchPicker?.setStatus(strings.git.cannotDeleteCurrent, 'warning');
          return;
        }
        if (!isBranchDeletable(branchName)) {
          gitBranchPicker?.setStatus(
            formatText(strings.git.cannotDeleteProtected, { branch: branchName }),
            'warning',
          );
          return;
        }
        await runGitBranchMutation({
          branch: branchName,
          channel: 'terminal:git-delete-branch',
          resultLabel: strings.git.resultLabels.deleteBranch,
          commandLabel: strings.git.commands.deleteBranch,
          successText: (nextBranch) =>
            formatText(strings.git.branchDeleted, { branch: nextBranch }),
        });
      },
      isDeleteAllowed: isBranchDeletable,
    });

    return gitBranchPicker;
  }

  async function loadGitBranchesIntoPicker() {
    const workingDir = getActiveProjectFolder();
    const picker = ensureGitBranchPicker();
    if (!workingDir) {
      picker.setStatus(strings.git.noProjectFolder, 'warning');
      picker.renderBranches({ current: '', branches: [] });
      return;
    }

    setGitBranchPickerBusy(true);
    picker.setStatus(strings.git.loadingBranches, 'muted');
    picker.renderBranches({ current: '', branches: [] });

    try {
      const result = await invokeIpc('terminal:git-branches', { workingDir });
      if (!result?.ok) {
        picker.setStatus(
          result?.hint || result?.error || strings.git.branchesLoadFailed,
          'warning',
        );
        picker.renderBranches({ current: '', branches: [] });
        return;
      }

      const current = String(result.current ?? gitState?.branch ?? '').trim();
      picker.renderBranches({
        current,
        branches: orderGitBranches(result.branches ?? [], current),
      });
      picker.setStatus('');
    } catch (error) {
      picker.setStatus(error?.message ?? strings.git.branchesLoadFailed, 'warning');
      picker.renderBranches({ current: '', branches: [] });
    } finally {
      setGitBranchPickerBusy(false);
    }
  }

  async function runGitBranchMutation({ branch, channel, resultLabel, commandLabel, successText }) {
    const workingDir = getActiveProjectFolder();
    if (!workingDir) {
      showAttachmentNotice(strings.git.noProjectFolder, 'warning');
      return false;
    }

    const nextBranch = String(branch ?? '').trim();
    if (!nextBranch) {
      gitBranchPicker?.input.focus();
      return false;
    }

    setGitBarBusy(true);
    setGitBranchPickerBusy(true);

    try {
      const result = await invokeIpc(channel, {
        workingDir,
        branch: nextBranch,
        allowRisky: true,
      });
      await appendGitResultMessage(
        resultLabel,
        commandLabel,
        !result?.ok || result.exitCode !== 0
          ? { ...result, stdout: '', stderr: '', error: null, hint: null }
          : result,
      );

      if (!result?.ok || result.exitCode !== 0) {
        gitBranchPicker?.setStatus('');
        return false;
      }

      gitBranchPicker?.setStatus(successText(nextBranch), 'success');
      showAttachmentNotice(successText(nextBranch), 'info');
      closeGitBranchPicker({ reset: true });
      focusComposer();
      return true;
    } catch {
      gitBranchPicker?.setStatus('');
      return false;
    } finally {
      setGitBarBusy(false);
      setGitBranchPickerBusy(false);
      await refreshProjectGitStatus({ silent: true });
    }
  }

  async function openGitBranchPicker(triggerButton) {
    if (gitBranchPickerOpen) {
      closeGitBranchPicker();
      return;
    }

    if (!activeProject || !gitState) return;

    closeModelPicker();
    const picker = ensureGitBranchPicker();
    gitBranchPickerOpen = true;
    gitBranchButton?.classList.add('chat-composer__branch--open');
    positionFloatingPanel(picker.element, triggerButton);
    requestAnimationFrame(() => picker.element.classList.add('chat-branch-picker--open'));
    picker.input.focus();

    const reposition = () => {
      positionFloatingPanel(picker.element, triggerButton);
    };
    const onDocClick = (event) => {
      if (!picker.element.contains(event.target) && !triggerButton.contains(event.target)) {
        closeGitBranchPicker();
      }
    };
    const onDocKey = (event) => {
      if (event.key === 'Escape') {
        closeGitBranchPicker();
        triggerButton.focus();
      }
    };

    clearGitBranchPickerListeners();
    gitBranchPickerListenerTimer = setTimeout(() => {
      document.addEventListener('click', onDocClick, { capture: true });
      document.addEventListener('keydown', onDocKey);
      window.addEventListener('resize', reposition);
      gitBranchPickerListenerTimer = null;
    }, 0);
    gitBranchPickerCleanup = () => {
      document.removeEventListener('click', onDocClick, { capture: true });
      document.removeEventListener('keydown', onDocKey);
      window.removeEventListener('resize', reposition);
    };

    await loadGitBranchesIntoPicker();
  }

  function setGitBarBusy(busy) {
    gitBusy = busy;
    for (const button of [
      gitBranchButton,
      gitPrimaryBtn,
      gitSecondaryBtn,
      gitMenuBtn,
      gitRefreshBtn,
      gitCommitConfirmBtn,
      gitCommitCancelBtn,
    ]) {
      if (button) button.disabled = busy;
    }
    if (gitCommitMessageEl) gitCommitMessageEl.disabled = busy || gitAiBusy;
    if (gitCommitAiBtn) gitCommitAiBtn.disabled = busy || gitAiBusy;
    gitBranchPicker?.setBusy(busy || gitBranchPickerBusy);
  }

  function setGitCommitStatus(text = '') {
    if (!gitCommitStatusEl) return;
    gitCommitStatusEl.textContent = text;
    gitCommitStatusEl.hidden = !text;
  }

  function setGitAiBusy(busy) {
    gitAiBusy = busy;
    gitCommitFieldWrapEl?.classList.toggle('chat-gitbar__commit-field-wrap--generating', busy);
    if (gitCommitAiBtn) {
      gitCommitAiBtn.disabled = busy || gitBusy;
      gitCommitAiBtn.classList.toggle('chat-gitbar__commit-ai--loading', busy);
    }
    if (gitCommitConfirmBtn) gitCommitConfirmBtn.disabled = busy || gitBusy;
    if (gitCommitCancelBtn) gitCommitCancelBtn.disabled = busy || gitBusy;
    if (gitCommitMessageEl) gitCommitMessageEl.disabled = busy || gitBusy;
  }

  function closeGitActionMenu() {
    if (gitActionMenuEl) gitActionMenuEl.hidden = true;
    gitMenuBtn?.classList.remove('chat-gitbar__menu-button--open');
  }

  function closeGitCommitPanel({ clear = true } = {}) {
    if (gitCommitPanelEl) gitCommitPanelEl.hidden = true;
    projectPill?.classList.remove('chat-composer__project--commit-mode');
    if (clear && gitCommitMessageEl) gitCommitMessageEl.value = '';
    gitPendingAction = null;
    setGitCommitStatus('');
    setGitAiBusy(false);
  }

  function buildGitActionMenuItems() {
    if (!gitState) return [];
    if (gitState.dirty) {
      return ['commit', 'commitPush', 'commitSync', 'pull'];
    }
    if (gitState.ahead > 0) {
      return ['push', 'pull', 'sync'];
    }
    return ['pull'];
  }

  function renderGitActionMenu() {
    if (!gitActionMenuEl || !gitMenuBtn) return;
    const actions = buildGitActionMenuItems();
    gitActionMenuEl.replaceChildren();

    for (const action of actions) {
      const item = createElement('button', 'chat-gitbar__menu-item');
      item.type = 'button';
      item._gitAction = action;
      item.append(
        createElement('span', 'chat-gitbar__menu-label', strings.git.actions[action]),
        createElement('span', 'chat-gitbar__menu-meta', strings.git.actionMeta[action]),
      );
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        closeGitActionMenu();
        void runGitBarAction(action);
      });
      gitActionMenuEl.append(item);
    }

    const hasMenu = actions.length > 0;
    gitMenuBtn.hidden = !hasMenu;
    gitMenuBtn.disabled = !hasMenu || gitBusy;
    gitPrimaryBtn?.classList.toggle('chat-gitbar__primary--solo', !hasMenu);
  }

  function syncGitBarView() {
    if (
      !gitBarEl ||
      !gitBranchEl ||
      !gitMetaEl ||
      !gitStatusDotEl ||
      !gitPrimaryBtn ||
      !gitSecondaryBtn
    )
      return;

    if (!activeProject || !gitState) {
      gitBarEl.hidden = true;
      if (gitIdentityEl) gitIdentityEl.hidden = true;
      gitBranchEl.textContent = '';
      gitBranchEl.hidden = true;
      gitMetaEl.textContent = '';
      closeGitActionMenu();
      closeGitCommitPanel();
      closeGitBranchPicker({ reset: true });
      syncGitBranchButton();
      return;
    }

    gitBarEl.hidden = false;
    gitStatusDotEl.hidden = true;
    gitBranchEl.textContent = '';
    gitBranchEl.hidden = true;

    const meta = [];
    if (gitState.ahead > 0)
      meta.push(formatText(strings.git.ahead, { count: String(gitState.ahead) }));
    if (gitState.behind > 0)
      meta.push(formatText(strings.git.behind, { count: String(gitState.behind) }));
    gitMetaEl.textContent = meta.join(' / ');
    if (gitIdentityEl) gitIdentityEl.hidden = meta.length === 0;

    const primaryAction = gitState.dirty ? 'commit' : gitState.ahead > 0 ? 'push' : 'pull';
    gitPrimaryBtn._gitAction = primaryAction;
    gitPrimaryBtn.textContent = strings.git.actions[primaryAction];

    gitSecondaryBtn._gitAction = 'status';
    gitSecondaryBtn.textContent = strings.git.actions.status;
    syncGitBranchButton();
    renderGitActionMenu();
  }

  async function refreshProjectGitStatus({ silent = false } = {}) {
    const workingDir = getActiveProjectFolder();
    if (!workingDir) {
      gitState = null;
      syncGitBarView();
      return;
    }

    try {
      const result = await invokeIpc('terminal:git-status', { workingDir });
      if (!result?.ok || result.exitCode !== 0) {
        gitState = null;
        syncGitBarView();
        return;
      }

      gitState = parseGitStatusOutput(result.stdout);
      syncGitBarView();
    } catch (error) {
      gitState = null;
      syncGitBarView();
      if (!silent) showAttachmentNotice(error?.message ?? strings.git.refreshFailed, 'warning');
    }
  }

  function restartGitStatusTimer() {
    if (gitRefreshTimer) {
      clearInterval(gitRefreshTimer);
      gitRefreshTimer = null;
    }

    if (getActiveProjectFolder()) {
      gitRefreshTimer = setInterval(() => {
        void refreshProjectGitStatus({ silent: true });
      }, 15000);
    }
  }

  async function appendGitResultMessage(label, command, result) {
    const rawOutput =
      [result?.stdout, result?.stderr]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join('\n\n') ||
      result?.hint ||
      result?.error ||
      null;
    const output = rawOutput ?? (result?.ok ? strings.git.emptyOutput : null);

    messages = [
      ...messages,
      {
        role: 'assistant',
        content: '',
        terminal: {
          label,
          command,
          status: result?.ok ? 'completed' : 'failed',
          statusLabel: result?.ok ? strings.terminal.completedTool : strings.terminal.failedTool,
          output,
          error: result?.ok ? null : result?.error,
          exitCode: result?.exitCode ?? 0,
        },
      },
    ];

    renderThread();
    scheduleScrollToBottom();
    await saveCurrentSession();
  }

  function normalizeGeneratedCommitMessage(text = '') {
    const parsed = parseThinkingFromText(String(text ?? ''));
    const visible = sanitizeAssistantVisibleContent(parsed.content || text);
    return visible
      .replace(/^```(?:text|gitcommit|commit)?\s*/i, '')
      .replace(/```$/i, '')
      .replace(/^commit message:\s*/i, '')
      .replace(/^["']|["']$/g, '')
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  }

  async function typeIntoGitCommitMessage(text) {
    if (!gitCommitMessageEl) return;
    gitCommitMessageEl.value = '';
    for (let index = 0; index < text.length; index += 1) {
      if (gitCommitPanelEl?.hidden) return;
      gitCommitMessageEl.value = text.slice(0, index + 1);
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }

  async function generateGitCommitMessage() {
    if (gitBusy || gitAiBusy) return;
    const workingDir = getActiveProjectFolder();
    if (!workingDir) {
      showAttachmentNotice(strings.git.noProjectFolder, 'warning');
      return;
    }

    setGitAiBusy(true);
    setGitCommitStatus(strings.git.commitStatus.generating);

    try {
      const [unstagedResult, stagedResult] = await Promise.all([
        invokeIpc('terminal:git-diff', { workingDir, staged: false }),
        invokeIpc('terminal:git-diff', { workingDir, staged: true }),
      ]);

      const diff = [stagedResult?.stdout, unstagedResult?.stdout]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join('\n\n');

      if (!diff) {
        showAttachmentNotice(strings.git.noDiffForCommitMessage, 'warning');
        return;
      }

      const cappedDiff =
        diff.length > 12000 ? `${diff.slice(0, 12000)}\n\n${strings.git.diffTruncated}` : diff;

      const result = await invokeIpc('chat:complete-message', {
        messages: [
          {
            role: 'user',
            content: formatPromptTemplate(payload.gitCommitDiffPrompt, { diff: cappedDiff }),
          },
        ],
        providerId: activeProvider?.id ?? null,
        modelId: activeModel?.id ?? null,
        modeInstruction: payload.gitCommitPrompt,
        isNewSession: false,
      });

      const message = normalizeGeneratedCommitMessage(result?.text);
      if (!message) {
        showAttachmentNotice(strings.git.aiCommitEmpty, 'warning');
        return;
      }

      await typeIntoGitCommitMessage(message);
    } catch {
      showAttachmentNotice(strings.git.aiCommitFailed, 'warning');
    } finally {
      setGitCommitStatus('');
      setGitAiBusy(false);
      gitCommitMessageEl?.focus();
    }
  }

  function openGitCommitPanel(action) {
    if (!gitCommitPanelEl || !gitCommitConfirmBtn) return;
    gitPendingAction = action;
    gitCommitConfirmBtn.textContent = strings.git.actions[action] ?? strings.git.actions.commit;
    projectPill?.classList.add('chat-composer__project--commit-mode');
    gitCommitPanelEl.hidden = false;
    closeGitActionMenu();
    gitCommitMessageEl?.focus();
  }

  async function performGitCommitAction() {
    if (gitBusy) return;
    const workingDir = getActiveProjectFolder();
    if (!workingDir) {
      showAttachmentNotice(strings.git.noProjectFolder, 'warning');
      return;
    }

    const message = String(gitCommitMessageEl?.value ?? '').trim();
    if (!message) {
      gitCommitMessageEl?.focus();
      showAttachmentNotice(strings.git.commitMessageRequired, 'warning');
      return;
    }

    const action = gitPendingAction ?? 'commit';
    const shouldPush = action === 'commitPush';
    const shouldSync = action === 'commitSync';

    setGitBarBusy(true);
    setGitCommitStatus(strings.git.commitStatus.staging);
    const hooksTimer = setTimeout(() => {
      setGitCommitStatus(strings.git.commitStatus.hooks);
    }, 2500);

    try {
      const commitResult = await invokeIpc('terminal:git-commit', {
        workingDir,
        message,
        allowRisky: true,
      });
      clearTimeout(hooksTimer);
      await appendGitResultMessage(
        strings.git.resultLabels.commit,
        strings.git.commands.commit,
        commitResult,
      );

      if (!commitResult?.ok) {
        showAttachmentNotice(
          commitResult?.hint || commitResult?.error || strings.git.actionFailed,
          'warning',
        );
        return;
      }

      let followUpResult = null;
      if (shouldPush) {
        setGitCommitStatus(strings.git.commitStatus.pushing);
        followUpResult = await invokeIpc('terminal:git-push', {
          workingDir,
          allowRisky: true,
        });
        await appendGitResultMessage(
          strings.git.resultLabels.push,
          strings.git.commands.push,
          followUpResult,
        );
      }
      if (shouldSync) {
        setGitCommitStatus(strings.git.commitStatus.syncing);
        followUpResult = await invokeIpc('terminal:git-push-sync', {
          workingDir,
          allowRisky: true,
        });
        await appendGitResultMessage(
          strings.git.resultLabels.sync,
          strings.git.commands.sync,
          followUpResult,
        );
      }

      const ok = followUpResult ? followUpResult.ok : commitResult.ok;
      showAttachmentNotice(
        ok
          ? strings.git.actionComplete
          : followUpResult?.hint || followUpResult?.error || strings.git.actionFailed,
        ok ? 'info' : 'warning',
      );
      closeGitCommitPanel();
      await refreshProjectGitStatus({ silent: true });
    } catch (error) {
      showAttachmentNotice(error?.message ?? strings.git.actionFailed, 'warning');
    } finally {
      clearTimeout(hooksTimer);
      setGitCommitStatus('');
      setGitBarBusy(false);
      await refreshProjectGitStatus({ silent: true });
    }
  }

  async function runGitBarAction(action) {
    if (gitBusy) return;
    const workingDir = getActiveProjectFolder();
    if (!workingDir) {
      showAttachmentNotice(strings.git.noProjectFolder, 'warning');
      return;
    }

    if (['commit', 'commitPush', 'commitSync'].includes(action)) {
      closeGitBranchPicker();
      openGitCommitPanel(action);
      return;
    }

    const channel = {
      status: 'terminal:git-status',
      diff: 'terminal:git-diff',
      pull: 'terminal:git-pull',
      push: 'terminal:git-push',
      sync: 'terminal:git-push-sync',
    }[action];

    if (!channel) return;
    closeGitBranchPicker();
    setGitBarBusy(true);

    try {
      const result = await invokeIpc(channel, {
        workingDir,
        allowRisky: action === 'pull' || action === 'push' || action === 'sync',
      });
      await appendGitResultMessage(
        strings.git.resultLabels[action],
        strings.git.commands[action],
        result,
      );

      if (action === 'pull' || action === 'push' || action === 'sync') {
        showAttachmentNotice(
          result?.ok
            ? strings.git.actionComplete
            : result?.hint || result?.error || strings.git.actionFailed,
          result?.ok ? 'info' : 'warning',
        );
      }

      await refreshProjectGitStatus({ silent: true });
    } catch (error) {
      showAttachmentNotice(error?.message ?? strings.git.actionFailed, 'warning');
    } finally {
      setGitBarBusy(false);
    }
  }

  function syncActiveProjectPill() {
    if (!projectPill || !projectNameEl || !projectMetaEl) return;

    if (!activeProject) {
      projectPill.hidden = true;
      projectNameEl.textContent = '';
      projectMetaEl.textContent = '';
      gitState = null;
      closeGitBranchPicker({ reset: true });
      syncGitBarView();
      restartGitStatusTimer();
      return;
    }

    closeGitBranchPicker({ reset: true });
    projectPill.hidden = false;
    projectNameEl.textContent = activeProject.name;
    projectMetaEl.textContent =
      collapseWhitespace(activeProject.folderPath ?? activeProject.rootPath) ||
      strings.projects.activeHint;

    // Show cover image if the project has one, otherwise fall back to the folder icon.
    if (projectIconEl) {
      const coverPath = collapseWhitespace(activeProject.coverImagePath);
      if (coverPath) {
        const fileUrl = toFileUrl(coverPath) ?? '';
        let imgEl = projectIconEl.querySelector('.chat-composer__project-cover');
        if (!imgEl) {
          imgEl = document.createElement('img');
          imgEl.className = 'chat-composer__project-cover';
          imgEl.alt = '';
          imgEl.draggable = false;
        }
        imgEl.src = fileUrl;
        projectIconEl.replaceChildren(imgEl);
      } else {
        // Restore the default folder glyph if there is no cover image.
        const existingImg = projectIconEl.querySelector('.chat-composer__project-cover');
        if (existingImg) {
          projectIconEl.replaceChildren(
            createIcon('tabProjects', 'chat-composer__project-icon-glyph'),
          );
        }
      }
    }

    void refreshProjectGitStatus({ silent: true });
    restartGitStatusTimer();
  }

  async function loadSession(id) {
    try {
      cancelActiveStream();
      generationToken += 1;
      removeStreamListeners();
      clearTimeout(diagTimer);
      diagTimer = null;
      diagPanel?.hide();
      isSending = false;
      accText = '';
      accThinking = '';
      isLoadingSession = true;
      renderThread();
      const session = await invokeIpc('history:load-session', id, activeProject?.id);
      isLoadingSession = false;
      messages = (session.messages ?? [])
        .map((message) => {
          const role = message.role === 'assistant' ? 'assistant' : 'user';
          const content = typeof message.content === 'string' ? message.content : '';
          return {
            role,
            content: role === 'assistant' ? sanitizeAssistantVisibleContent(content) : content,
            modelContent: typeof message.modelContent === 'string' ? message.modelContent : null,
            attachments: Array.isArray(message.attachments)
              ? message.attachments.map(toAttachmentSummary)
              : [],
            terminal: message.terminal ?? null,
            thinking: sanitizeAssistantVisibleContent(message.thinking ?? ''),
            providerLabel: typeof message.providerLabel === 'string' ? message.providerLabel : '',
            modelLabel: typeof message.modelLabel === 'string' ? message.modelLabel : '',
            starred: message.starred === true,
            streaming: false,
          };
        })
        .filter((message) => message.content || message.terminal);

      sessionId = session.id;
      sessionCreatedAt = session.createdAt ?? new Date().toISOString();
      userScrolledUp = false;
      fileDiffTracker?.reset();

      syncScrollToBottomBtn();
      renderThread();
      focusComposer();
    } catch (error) {
      console.error('[Joanium] Failed to load session:', error);
    } finally {
      isLoadingSession = false;
    }
  }

  function closeModelPicker() {
    modelPickerPanel?.classList.remove('chat-model-picker--open');
    modelButton?.classList.remove('chat-composer__model--open');
    // Call hide() — closes the info popover and clears active states but
    // keeps the scrollbar, DOM nodes, and event listeners alive so the panel
    // reopens correctly on the next click without needing a full rebuild.
    modelPickerHide?.();
    modelPickerOpen = false;
  }

  function syncPickerActiveStates() {
    if (!modelPickerPanel) return;

    for (const option of modelPickerPanel.querySelectorAll('.chat-model-picker__option')) {
      const isActive =
        option._pickerProviderId === activeProvider?.id &&
        option._pickerModelId === activeModel?.id;
      option.classList.toggle('chat-model-picker__option--active', isActive);
      const existing = option.querySelector('.chat-model-picker__check');
      if (isActive && !existing) {
        option.append(createIcon('check', 'chat-model-picker__check'));
      } else if (!isActive && existing) {
        existing.remove();
      }
    }
  }

  function openModelPicker(triggerButton) {
    if (modelPickerOpen) {
      closeModelPicker();
      return;
    }

    closeGitBranchPicker();
    if (modelPickerNeedsRebuild && modelPickerPanel) {
      modelPickerDispose?.();
      modelPickerPanel?.remove();
      modelPickerPanel = null;
      modelPickerNeedsRebuild = false;
    }

    if (!modelPickerPanel) {
      const picker = createModelPickerPanel({
        providers: payload.providers,
        userProviderDetails: payload.user?.providers?.details ?? {},
        strings,
        favourites: modelFavourites,
        onToggleFavourite: async (provider, model) => {
          const result = await invokeIpc('providers:toggle-model-favourite', provider.id, model.id);
          modelFavourites = result?.favourites ?? [];
          modelPickerNeedsRebuild = true;
        },
        onSelect(provider, model) {
          activeProvider = provider;
          activeModel = model;
          activeModelLabel = model.name ?? model.id;
          const labelEl = triggerButton.querySelector('.chat-composer__model-label');
          if (labelEl) labelEl.textContent = activeModelLabel;
          const providerIconEl = triggerButton.querySelector('.chat-composer__model-provider-icon');
          if (providerIconEl) {
            providerIconEl.src = provider.iconPath ?? '';
            providerIconEl.hidden = !provider.iconPath;
          }
          refreshContextVisualizer();
          syncPickerActiveStates();
          closeModelPicker();
        },
      });
      modelPickerPanel = picker.element;
      modelPickerDispose = picker.dispose;
      modelPickerHide = picker.hide;
    }

    syncPickerActiveStates();
    modelPickerOpen = true;
    modelButton.classList.add('chat-composer__model--open');
    const rect = triggerButton.getBoundingClientRect();
    modelPickerPanel.style.left = `${rect.left}px`;
    modelPickerPanel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    requestAnimationFrame(() => {
      modelPickerPanel?.classList.add('chat-model-picker--open');
      const activeOption = modelPickerPanel?.querySelector('.chat-model-picker__option--active');
      if (activeOption) {
        activeOption.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    });

    const onDocClick = (event) => {
      if (!modelPickerPanel?.contains(event.target) && !triggerButton.contains(event.target)) {
        closeModelPicker();
        document.removeEventListener('click', onDocClick, { capture: true });
        document.removeEventListener('keydown', onDocKey);
      }
    };
    const onDocKey = (event) => {
      if (event.key === 'Escape') {
        closeModelPicker();
        document.removeEventListener('click', onDocClick, { capture: true });
        document.removeEventListener('keydown', onDocKey);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', onDocClick, { capture: true });
      document.addEventListener('keydown', onDocKey);
    }, 0);
  }

  function normalizeSlashId(value = '') {
    return String(value ?? '')
      .trim()
      .replace(/^\/+/, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  async function ensureSlashCommandsLoaded() {
    if (slashCommandsLoaded) return;

    let baseCommands = [];
    try {
      const rawCommands = await invokeIpc('slash-commands:list');
      baseCommands = (Array.isArray(rawCommands) ? rawCommands : []).map((command) => ({
        ...command,
        id: normalizeSlashId(command.id),
      }));
    } catch {
      // SlashCommands package unavailable — palette still works for templates and agents.
    }
    const templateCommands = [];
    const agentCommands = [];

    try {
      const templates = await invokeIpc('templates:list-templates');
      for (const template of Array.isArray(templates) ? templates : []) {
        const id = normalizeSlashId(template.command || template.id || template.name);
        if (!id || !template.prompt) continue;
        templateCommands.push({
          id,
          label: template.name || id,
          description: template.prompt.slice(0, 90),
          type: 'template',
          icon: 'tabTemplates',
          prompt: template.prompt,
        });
      }
    } catch {
      // Templates are optional.
    }

    try {
      const agents = await invokeIpc('agents:list-agents');
      for (const agent of Array.isArray(agents) ? agents : []) {
        const id = normalizeSlashId(agent.id || agent.name);
        if (!id || !agent.prompt) continue;
        agentCommands.push({
          id,
          label: agent.name || id,
          description: agent.prompt.slice(0, 90),
          type: 'agent',
          icon: 'tabAgents',
          prompt: agent.prompt,
        });
      }
    } catch {
      // Agents are optional.
    }

    slashCommands = [...baseCommands, ...templateCommands, ...agentCommands];
    slashCommandsLoaded = true;
  }

  function closeSlashMenu() {
    slashFilteredCommands = [];
    slashSelectedIndex = 0;
    if (slashMenu) {
      slashMenu.hidden = true;
      slashMenu.classList.remove('chat-slash-menu--open');
      slashScroller?.replaceChildren();
    }
  }

  function renderSlashMenu() {
    if (!slashMenu || !slashScroller) return;

    slashScroller.replaceChildren();
    if (slashFilteredCommands.length === 0) {
      slashMenu.hidden = true;
      return;
    }

    const groups = [
      ['action', strings.slash.sections.actions],
      ['mode', strings.slash.sections.modes],
      ['navigate', strings.slash.sections.navigate],
      ['template', strings.slash.sections.templates],
      ['agent', strings.slash.sections.agents],
    ];

    let globalIndex = 0;
    for (const [type, sectionLabel] of groups) {
      const commands = slashFilteredCommands.filter((command) => command.type === type);
      if (commands.length === 0) continue;

      slashScroller.append(createElement('div', 'chat-slash-menu__section', sectionLabel));

      for (const command of commands) {
        const item = createElement(
          'button',
          `chat-slash-menu__item${globalIndex === slashSelectedIndex ? ' chat-slash-menu__item--active' : ''}`,
        );
        item.type = 'button';
        item._slashIndex = globalIndex;
        item._slashCommand = command;
        item.setAttribute('aria-selected', String(globalIndex === slashSelectedIndex));

        const icon = createIcon(command.icon || 'terminal', 'chat-slash-menu__icon');
        const copy = createElement('span', 'chat-slash-menu__copy');
        const label = createElement('span', 'chat-slash-menu__label');
        label.append(
          createElement('span', 'chat-slash-menu__slash', '/'),
          createElement('span', 'chat-slash-menu__id', command.id),
          createElement('span', 'chat-slash-menu__name', command.label),
        );
        const description = createElement(
          'span',
          'chat-slash-menu__description',
          command.description || '',
        );
        copy.append(label, description);
        const badge = createElement(
          'span',
          `chat-slash-menu__badge chat-slash-menu__badge--${command.type}`,
          strings.slash.badges[command.type] ?? command.type,
        );
        item.append(icon, copy, badge);
        item.addEventListener('mouseenter', () => {
          slashSelectedIndex = item._slashIndex;
          updateSlashActiveState();
        });
        item.addEventListener('click', () => {
          applySlashCommand(command);
        });
        slashScroller.append(item);
        globalIndex += 1;
      }
    }

    slashMenu.hidden = false;
    requestAnimationFrame(() => slashMenu?.classList.add('chat-slash-menu--open'));
  }

  function getSlashQuery() {
    if (!composerField) return null;

    const cursor = composerField.selectionStart;
    const beforeCursor = draftValue.slice(0, cursor);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const currentLine = beforeCursor.slice(lineStart);
    const match = currentLine.match(/(^|\s)(\/[a-z0-9_-]*)$/i);
    if (!match) return null;

    const token = match[2];
    slashStartIndex = lineStart + currentLine.length - token.length;
    return token.slice(1).toLowerCase();
  }

  async function updateSlashMenu() {
    const query = getSlashQuery();
    if (query === null) {
      closeSlashMenu();
      return;
    }

    await ensureSlashCommandsLoaded();
    slashFilteredCommands = slashCommands.filter(
      (command) =>
        command.id.includes(query) ||
        String(command.label ?? '')
          .toLowerCase()
          .includes(query) ||
        String(command.description ?? '')
          .toLowerCase()
          .includes(query),
    );
    slashSelectedIndex = 0;
    renderSlashMenu();
  }

  function setDraftValue(nextValue, cursorPosition = nextValue.length) {
    draftValue = nextValue;
    syncComposer();
    if (composerField) {
      composerField.focus();
      composerField.setSelectionRange(cursorPosition, cursorPosition);
    }
    void updateSlashMenu();
  }

  function removeSlashToken(replacement = '') {
    if (!composerField) return;
    const cursor = composerField.selectionStart;
    const before = draftValue.slice(0, slashStartIndex);
    const after = draftValue.slice(cursor);
    setDraftValue(`${before}${replacement}${after}`, before.length + replacement.length);
  }

  function applySlashCommand(command) {
    closeSlashMenu();

    // Templates and agents paste their prompt into the composer.
    if (command.type === 'template' || command.type === 'agent') {
      removeSlashToken(command.prompt || '');
      return;
    }

    removeSlashToken('');

    // ── Actions ───────────────────────────────────────────────────────────────
    // Dispatched by the `action` field defined in Core/Commands.js.
    // To add a new action command, add it to Commands.js with an `action` value
    // that matches one of the cases below. Only add a new case here when you
    // need a genuinely new kind of side effect.
    if (command.type === 'action') {
      switch (command.action) {
        case 'clearConversation':
          clearConversation();
          break;

        case 'openTerminal':
          terminalPanel?.setOpen(true);
          focusComposer();
          break;

        case 'openSettings':
          onOpenSettings?.();
          break;

        case 'lockApp':
          onLockApp?.();
          break;

        case 'closeApp':
          void invokeIpc('app-settings:quit-app').catch(() => {});
          break;

        case 'restartApp':
          void invokeIpc('app-settings:restart-app').catch(() => {});
          break;

        case 'syncMemory':
          void processPendingMemorySyncs({ force: true });
          focusComposer();
          break;

        case 'togglePrivate':
          privateBtn.click();
          break;

        case 'switchTheme': {
          const mode = command.payload?.mode;
          if (mode) {
            // Apply immediately so the switch feels instant.
            document.documentElement.classList.remove('joanium-theme-light', 'joanium-theme-dark');
            document.documentElement.classList.add(`joanium-theme-${mode}`);
            // Persist — preserve the existing motion preference.
            invokeIpc('themes:get')
              .then((state) => invokeIpc('themes:save', { motion: state?.motion ?? 'full', mode }))
              .catch(() => invokeIpc('themes:save', { mode, motion: 'full' }).catch(() => {}));
            // Notify any open panels (e.g. ThemePanel) so their UI stays in sync.
            dispatchEvent(EVENTS.THEME_CHANGED, { mode });
            focusComposer();
          }
          break;
        }
      }
      return;
    }

    // ── Modes ─────────────────────────────────────────────────────────────────
    // Toggles a persistent system-prompt instruction for the session.
    if (command.type === 'mode') {
      if (activeMode === command.id) {
        activeMode = null;
        activeModeInstruction = null;
      } else {
        activeMode = command.id;
        activeModeInstruction = null;
        invokeIpc('slash-commands:get-mode-instruction', command.id)
          .then((instruction) => {
            activeModeInstruction = instruction ?? null;
          })
          .catch(() => {});
      }
      focusComposer();
      return;
    }

    // ── Navigation ────────────────────────────────────────────────────────────
    // Routes to the shell panel whose id matches command.id.
    if (command.type === 'navigate') {
      void onNavigate?.(command.id);
    }
  }

  function getModeInstruction() {
    return activeModeInstruction;
  }

  function updateSlashActiveState() {
    if (!slashMenu) return;
    const items = slashMenu.querySelectorAll('.chat-slash-menu__item');
    items.forEach((item, i) => {
      const isActive = i === slashSelectedIndex;
      item.classList.toggle('chat-slash-menu__item--active', isActive);
      item.setAttribute('aria-selected', String(isActive));
      if (isActive) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function handleSlashKeydown(event) {
    if (!slashMenu || slashMenu.hidden || slashFilteredCommands.length === 0) {
      return false;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      slashSelectedIndex = Math.min(slashSelectedIndex + 1, slashFilteredCommands.length - 1);
      updateSlashActiveState();
      return true;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      slashSelectedIndex = Math.max(slashSelectedIndex - 1, 0);
      updateSlashActiveState();
      return true;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applySlashCommand(slashFilteredCommands[slashSelectedIndex]);
      return true;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSlashMenu();
      return true;
    }

    return false;
  }

  async function stopStream() {
    generationToken += 1;
    clearTimeout(diagTimer);
    diagTimer = null;
    diagPanel?.hide();
    markCompletionAborted();
    cancelActiveStream();
    removeStreamListeners();
    const stoppedNote = strings.composer.generationStopped;
    messages = messages.map((message, index) => {
      if (index !== messages.length - 1) return message;
      const { content: parsedStopped, thinking: inlineStopped } = parseThinkingFromText(accText);
      const cleanedStopped = sanitizeAssistantVisibleContent(parsedStopped);
      const content = cleanedStopped ? `${cleanedStopped}\n\n${stoppedNote}` : stoppedNote;
      return {
        role: 'assistant',
        content,
        thinking: accThinking || inlineStopped,
        streaming: false,
        stopped: true,
        providerLabel: activeProvider?.label ?? 'AI',
        modelLabel: activeModelLabel,
      };
    });
    accText = '';
    accThinking = '';
    isSending = false;
    await saveCurrentSession();
    syncComposer();
    renderThread();
  }

  async function enhancePrompt() {
    const raw = draftValue.trim();
    if (!raw || isEnhancing || isSending) return;

    isEnhancing = true;
    syncComposer();

    try {
      const result = await invokeIpc('chat:enhance-prompt', {
        raw,
        providerId: activeProvider?.id ?? null,
        modelId: activeModel?.id ?? null,
      });

      const enhanced = result?.text?.trim();
      if (enhanced) {
        draftValue = enhanced;
        syncComposer();
        focusComposer();
      } else {
        showAttachmentNotice(strings.composer.enhanceFailed, 'warning');
      }
    } catch {
      showAttachmentNotice(strings.composer.enhanceFailed, 'warning');
    } finally {
      isEnhancing = false;
      syncComposer();
    }
  }

  function syncComposerFieldHeight() {
    if (!composerField) return;
    composerField.style.height = 'auto';
    composerField.style.height = `${composerField.scrollHeight}px`;
  }

  function syncComposer() {
    if (!composerField || !sendButton) return;
    composerField.value = draftValue;
    syncComposerFieldHeight();

    const iconEl = sendButton.querySelector('.chat-composer__send-icon');
    const labelEl = sendButton.querySelector('.chat-composer__send-label');

    if (isSending) {
      sendButton.disabled = false;
      sendButton.classList.add('chat-composer__send--stop');
      if (iconEl) iconEl.innerHTML = iconMarkup.stop;
      if (labelEl) {
        labelEl.textContent = strings.composer.stop;
        labelEl.hidden = false;
      }
    } else {
      sendButton.disabled = isEnhancing;
      sendButton.classList.remove('chat-composer__send--stop');
      if (iconEl) iconEl.innerHTML = iconMarkup.send;
      if (labelEl) {
        labelEl.textContent = '';
        labelEl.hidden = true;
      }
    }

    if (enhanceBtn) {
      const hasText = draftValue.trim().length > 0;
      enhanceBtn.disabled = !hasText || isSending || isEnhancing;
      enhanceBtn.classList.toggle('chat-composer__icon-button--active', isEnhancing);
    }

    if (modelButton) {
      modelButton.disabled = isEnhancing;
    }

    if (gitBranchButton) {
      gitBranchButton.disabled =
        !activeProject || !gitState || isEnhancing || gitBusy || gitBranchPickerBusy;
    }

    if (attachBtn) {
      attachBtn.disabled = isEnhancing;
    }

    if (terminalBtn) {
      terminalBtn.disabled = isEnhancing;
      terminalBtn.classList.toggle(
        'chat-composer__icon-button--active',
        terminalPanel?.isOpen() ?? false,
      );
    }

    if (browserBtn) {
      browserBtn.disabled = isEnhancing;
      browserBtn.classList.toggle('chat-composer__icon-button--active', isBrowserOpen);
    }

    if (composer) {
      composer.classList.toggle('chat-composer--enhancing', isEnhancing);
    }

    composerField.disabled = isEnhancing;
  }

  function focusComposer() {
    if (!composerField) return;
    composerField.focus();
    composerField.setSelectionRange(draftValue.length, draftValue.length);
  }

  function clearConversation() {
    generationToken += 1;
    cancelActiveStream();
    messages = [];
    draftValue = '';
    pendingAttachments = [];
    isSending = false;
    sessionId = null;
    sessionCreatedAt = null;
    userScrolledUp = false;
    syncScrollToBottomBtn();
    removeStreamListeners();
    closeSlashMenu();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    fileDiffTracker?.reset();
    completedWrites = new Set();
    renderPendingAttachments();
    if (attachmentNotice) {
      attachmentNotice.hidden = true;
      attachmentNotice.textContent = '';
    }
    syncComposer();
    renderThread();
    focusComposer();
  }

  function renderTrack() {
    if (!track || !trackLabel || !thread || !scroll) return;

    const userMsgs = Array.from(thread.querySelectorAll('.chat-message--user'));

    track.querySelectorAll('.chat-thread-track__dot').forEach((d) => d.remove());

    if (userMsgs.length < 2) {
      track.hidden = true;
      trackLabel.hidden = true;
      return;
    }

    track.hidden = false;
    const totalH = scroll.scrollHeight;

    for (const msgEl of userMsgs) {
      const dot = createElement('button', 'chat-thread-track__dot');
      dot.type = 'button';
      const pct = totalH > 0 ? (msgEl.offsetTop / totalH) * 100 : 0;
      dot.style.top = `${pct}%`;

      const preview = truncate(
        collapseWhitespace(msgEl.querySelector('.chat-message__bubble')?.textContent ?? ''),
        38,
      );

      dot.addEventListener('mouseenter', () => {
        trackLabel.textContent = preview;
        trackLabel.style.top = dot.style.top;
        trackLabel.hidden = false;
      });
      dot.addEventListener('mouseleave', () => {
        trackLabel.hidden = true;
      });
      dot.addEventListener('click', () => {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgEl.classList.add('chat-message--highlighted');
        setTimeout(() => msgEl.classList.remove('chat-message--highlighted'), 1600);
      });

      track.append(dot);
    }

    updateTrackActive();
  }

  function updateTrackActive() {
    if (!track || !thread || !scroll) return;

    const dots = Array.from(track.querySelectorAll('.chat-thread-track__dot'));
    const userMsgs = Array.from(thread.querySelectorAll('.chat-message--user'));
    if (!dots.length) return;

    const scrollMid = scroll.scrollTop + scroll.clientHeight * 0.4;
    let activeIdx = 0;
    let minDist = Infinity;

    userMsgs.forEach((msgEl, i) => {
      const dist = Math.abs(msgEl.offsetTop - scrollMid);
      if (dist < minDist) {
        minDist = dist;
        activeIdx = i;
      }
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('chat-thread-track__dot--active', i === activeIdx);
    });
  }

  async function continueAssistantResponse(messageIndex) {
    if (isSending) return;
    const target = messages[messageIndex];
    if (!target?.needsContinuation) return;

    messages = [
      ...messages.map((message, index) =>
        index === messageIndex ? { ...message, needsContinuation: false, empty: true } : message,
      ),
      {
        role: 'user',
        content: strings.composer.continueHiddenLabel,
        modelContent: CHAT_PROMPTS.continueWithoutReasoning,
        hidden: true,
      },
      {
        role: 'assistant',
        content: '',
        thinking: '',
        streaming: true,
        providerLabel: activeProvider?.label ?? 'AI',
        modelLabel: activeModelLabel,
      },
    ];

    isSending = true;
    accText = '';
    accThinking = '';
    userScrolledUp = false;
    const generationStartTime = Date.now();
    const runToken = ++generationToken;
    syncComposer();
    renderThread();
    scheduleScrollToBottom();

    await startAssistantStream({
      isNewSession: false,
      terminalDepth: 0,
      runToken,
      generationStartTime,
    });
  }

  function renderThread() {
    if (!thread || !title || !composer || !scroll || !bottom) return;
    refreshContextVisualizer();

    const currentProfile = getProfile?.() ?? profile;

    hideUserTyping();
    userTypingEl = null; // rebuild fresh on next type so profile/avatar stays current

    const hasMessages = messages.length > 0 || isLoadingSession;
    const isFirstMessage = hasMessages && !prevHasMessages;
    prevHasMessages = hasMessages;

    if (isFirstMessage) {
      // ── Sequential FLIP transition ──────────────────────────────────────────
      // Phase 1: pin welcome elements at their visual coords, swap the layout
      // class (fixed elements are immune to the reflow), then animate them out.
      // Phase 2: only after they're fully gone, reveal and animate the thread in.
      // No overlap — no z-index battles, no bleed-through.

      const WELCOME_EXIT_MS = 220;
      const THREAD_ENTER_MS = 400;

      // 1. Capture visual positions before any change
      const titleRect = title.getBoundingClientRect();
      const bubblesRect = bubblesEl.getBoundingClientRect();
      const techFeedRect = techFeedEl ? techFeedEl.getBoundingClientRect() : null;

      // 2. Pin elements at their exact screen positions
      const pinTargets = [
        [title, titleRect],
        [bubblesEl, bubblesRect],
        ...(techFeedEl && techFeedRect ? [[techFeedEl, techFeedRect]] : []),
      ];
      for (const [el, rect] of pinTargets) {
        el.style.position = 'fixed';
        el.style.top = `${rect.top}px`;
        el.style.left = `${rect.left}px`;
        el.style.width = `${rect.width}px`;
        el.style.margin = '0';
        el.style.zIndex = '100';
      }

      // 3. Swap layout and composer state — fixed elements are unaffected
      scroll.classList.add('chat-stage__scroll--conversation');
      bottom.classList.add('chat-stage__bottom--conversation');
      composer.classList.add('chat-composer--conversation');
      composer.classList.add('chat-composer--entering');

      // 4. Start welcome exit on the next paint
      requestAnimationFrame(() => {
        title.classList.add('chat-stage__title--exiting');
        bubblesEl.classList.add('chat-prompt-bubbles--exiting');
        if (techFeedEl) techFeedEl.classList.add('tech-feed--exiting');
      });

      // 5. Phase 2 — after welcome is fully gone, reveal and animate thread
      setTimeout(() => {
        for (const el of [welcomeWrap, title, bubblesEl, techFeedEl].filter(Boolean)) {
          el.hidden = true;
          for (const prop of ['position', 'top', 'left', 'width', 'margin', 'zIndex']) {
            el.style[prop] = '';
          }
        }
        title.classList.remove('chat-stage__title--exiting');
        bubblesEl.classList.remove('chat-prompt-bubbles--exiting');
        if (techFeedEl) techFeedEl.classList.remove('tech-feed--exiting');

        thread.hidden = false;
        thread.classList.add('chat-thread--entering');

        // Stagger messages in after thread is visible
        requestAnimationFrame(() => {
          const msgEls = thread.querySelectorAll('.chat-message');
          msgEls.forEach((el, i) => {
            el.classList.add('chat-message--entering');
            el.style.setProperty('--msg-enter-delay', `${i * 55}ms`);
          });
        });
      }, WELCOME_EXIT_MS);

      // 6. Cleanup thread and composer animation classes
      setTimeout(() => {
        thread.classList.remove('chat-thread--entering');
        composer.classList.remove('chat-composer--entering');
      }, WELCOME_EXIT_MS + THREAD_ENTER_MS);
    } else {
      title.hidden = hasMessages;
      bubblesEl.hidden = hasMessages;
      if (techFeedEl) {
        techFeedEl.hidden = hasMessages || currentAppSettings?.showTechFeed === false;
        techFeedEl.style.display = techFeedEl.hidden ? 'none' : '';
      }
      if (welcomeWrap) {
        welcomeWrap.hidden = hasMessages;
        welcomeWrap.classList.toggle(
          'chat-welcome--no-feed',
          currentAppSettings?.showTechFeed === false,
        );
      }
      thread.hidden = !hasMessages;
      composer.classList.toggle('chat-composer--conversation', hasMessages);
      scroll.classList.toggle('chat-stage__scroll--conversation', hasMessages);
      bottom.classList.toggle('chat-stage__bottom--conversation', hasMessages);
    }

    if (!hasMessages) {
      thread.replaceChildren();
      if (track) track.hidden = true;
      if (trackLabel) trackLabel.hidden = true;
      return;
    }

    const visibleMessages = messages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => !message.hidden);

    // Group consecutive assistant messages so the entire tool-loop response
    // (think → call tool → think → answer) renders as one article with blocks
    // in the order they were generated, matching Claude.ai behaviour.
    const renderGroups = [];
    let assistantGroup = null;

    for (const item of visibleMessages) {
      if (item.message.role === 'assistant') {
        if (!assistantGroup) assistantGroup = [];
        assistantGroup.push(item);
      } else {
        if (assistantGroup) {
          renderGroups.push({ type: 'assistant', items: assistantGroup });
          assistantGroup = null;
        }
        renderGroups.push({ type: 'user', items: [item] });
      }
    }
    if (assistantGroup) renderGroups.push({ type: 'assistant', items: assistantGroup });

    const providerIconByLabel = new Map(payload.providers.map((p) => [p.label, p.iconPath ?? '']));
    const getProviderIcon = (message) =>
      (message.providerLabel ? (providerIconByLabel.get(message.providerLabel) ?? '') : '') ||
      activeProvider?.iconPath ||
      '';

    thread.replaceChildren(
      ...renderGroups.map((group) => {
        if (group.type === 'user') {
          const { message, index } = group.items[0];
          const onCopy = () => copyToClipboard(message.content ?? '');
          const onRetry = () => {
            if (isSending) return;
            const userMessage = messages[index];
            if (!userMessage?.content) return;
            messages = messages.slice(0, index);
            draftValue = '';
            pendingAttachments = [];
            renderPendingAttachments();
            renderThread();
            void submitPrompt({
              content: userMessage.content,
              modelContent: userMessage.modelContent,
              attachments: userMessage.attachments ?? [],
              imageAttachments: userMessage.imageAttachments ?? [],
            });
          };
          const onStar = (starBtn) => {
            const newStarred = !messages[index].starred;
            messages[index].starred = newStarred;
            // Toggle state directly on the existing DOM elements — no full re-render needed.
            starBtn?.classList.toggle('chat-message__action-button--starred', newStarred);
            starBtn
              ?.closest('.chat-message')
              ?.classList.toggle('chat-message--starred', newStarred);
            void saveCurrentSession({ bumpUpdatedAt: false });
          };
          return createMessageElement(message, strings, {
            onCopy,
            onRetry,
            onStar,
            userProfile: currentProfile,
          });
        }

        // Assistant group — find the preceding user message for retry
        const firstIndex = group.items[0].index;
        const lastMessage = group.items[group.items.length - 1].message;
        const continuationItem = group.items.find(({ message }) => message.needsContinuation);
        const onCopy = () => copyToClipboard(lastMessage.content ?? '');
        const onRetry = () => {
          if (isSending) return;
          let userIndex = -1;
          for (let candidate = firstIndex - 1; candidate >= 0; candidate -= 1) {
            if (messages[candidate]?.role === 'user' && !messages[candidate]?.hidden) {
              userIndex = candidate;
              break;
            }
          }
          if (userIndex < 0) return;
          const userMessage = messages[userIndex];
          if (!userMessage?.content) return;
          messages = messages.slice(0, userIndex);
          draftValue = '';
          pendingAttachments = [];
          renderPendingAttachments();
          renderThread();
          void submitPrompt({
            content: userMessage.content,
            modelContent: userMessage.modelContent,
            attachments: userMessage.attachments ?? [],
            imageAttachments: userMessage.imageAttachments ?? [],
          });
        };
        const onContinue = continuationItem
          ? () => {
              void continueAssistantResponse(continuationItem.index);
            }
          : undefined;
        const onStar = (starBtn) => {
          const newState = !lastMessage.starred;
          for (const { message } of group.items) {
            message.starred = newState;
          }
          // Toggle state directly on the existing DOM elements — no full re-render needed.
          starBtn?.classList.toggle('chat-message__action-button--starred', newState);
          starBtn?.closest('.chat-message')?.classList.toggle('chat-message--starred', newState);
          void saveCurrentSession({ bumpUpdatedAt: false });
        };

        return createAssistantGroupElement(group.items, strings, {
          onCopy,
          onRetry,
          onContinue,
          onStar,
          isGenerating: isSending,
          getProviderIcon,
        });
      }),
    );

    requestAnimationFrame(() => {
      if (!userScrolledUp) scroll.scrollTop = scroll.scrollHeight;
      renderTrack();
      if (isFirstMessage) {
        const msgEls = thread.querySelectorAll('.chat-message');
        msgEls.forEach((el, i) => {
          el.classList.add('chat-message--entering');
          el.style.setProperty('--msg-enter-delay', `${90 + i * 55}ms`);
        });
      }
    });
  }

  async function resolveTerminalCwd(requestedPath = '') {
    const explicitPath = String(requestedPath ?? '').trim();
    if (explicitPath) return explicitPath;

    const projectFolder = collapseWhitespace(activeProject?.folderPath ?? activeProject?.rootPath);
    if (projectFolder) return projectFolder;

    try {
      const result = await invokeIpc('terminal:get-default-cwd');
      return result?.ok ? result.cwd : '';
    } catch {
      return '';
    }
  }

  async function executeTerminalTool(action) {
    // ── Dedup guard: skip exact repeated write_local_file calls within a session ──
    if (action?.tool === 'write_local_file') {
      const filePath = action.payload?.path ?? action.payload?.filePath ?? '';
      const dedupKey = `${filePath}::${action.payload?.content ?? ''}`;
      if (completedWrites.has(dedupKey)) {
        return { ok: true, path: filePath, bytes: 0, _skippedDuplicate: true };
      }
    }

    let nextAction = action;

    if (PROJECT_SCOPED_MUTATION_TOOLS.has(action?.tool) || isShellFileMutation(action)) {
      const projectRoot = getActiveProjectFolder();

      if (!projectRoot) {
        return { ok: false, error: strings.terminal.projectRequired };
      }

      nextAction = {
        ...action,
        payload: {
          ...(action.payload ?? {}),
          enforceProjectRoot: true,
          projectRoot,
        },
      };
    }

    const result = await executeRendererTerminalTool(nextAction, {
      resolveCwd: resolveTerminalCwd,
      unsupportedError: strings.terminal.unsupportedTool,
    });

    // Track successful writes for dedup
    if (action?.tool === 'write_local_file' && result?.ok) {
      const filePath = action.payload?.path ?? action.payload?.filePath ?? '';
      const dedupKey = `${filePath}::${action.payload?.content ?? ''}`;
      completedWrites.add(dedupKey);
    }

    return result;
  }

  function buildSubAgentTaskPrompt(task, coordinationGoal, index, total) {
    const template =
      String(payload.subAgentPrompt ?? '').trim() ||
      'You are sub-agent {index} of {total}.\n\nTeam objective: {coordinationGoal}\n\n## Task\n{title}: {goal}\n{context}\n{deliverable}';
    return template
      .replace('{index}', String(index + 1))
      .replace('{total}', String(total))
      .replace('{coordinationGoal}', coordinationGoal ? `Team objective: ${coordinationGoal}` : '')
      .replace('{title}', task.title)
      .replace('{goal}', task.goal)
      .replace('{context}', task.context ? `Extra context:\n${task.context}` : '')
      .replace('{deliverable}', task.deliverable ? `Expected handoff:\n${task.deliverable}` : '')
      .split('\n')
      .filter((line) => line.trim())
      .join('\n');
  }

  function getSubAgentConversationContext() {
    return messages
      .filter(
        (message) => !message.hidden && !message.streaming && !message.pending && message.content,
      )
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.modelContent || message.content,
      }));
  }

  function formatSubAgentOutput(tasks, results, coordinationGoal, synthesisStyle = 'detailed') {
    const lines = [strings.tools.subAgentsResultHeader];

    if (coordinationGoal) {
      lines.push(
        '',
        formatText(strings.tools.subAgentsCoordinationGoal, { goal: coordinationGoal }),
      );
    }

    tasks.forEach((task, index) => {
      const result = results[index] ?? {};
      lines.push(
        '',
        formatText(strings.tools.subAgentsTaskHeader, {
          index: String(index + 1),
          title: task.title,
        }),
        formatText(strings.tools.subAgentsGoal, { goal: task.goal }),
      );

      if (task.deliverable) {
        lines.push(
          formatText(strings.tools.subAgentsDeliverable, { deliverable: task.deliverable }),
        );
      }

      if (!result.ok) {
        lines.push('', `${strings.tools.subAgentsError}:\n${result.error}`);
        return;
      }

      if (synthesisStyle === 'brief') {
        // Compact — first 300 chars of handoff only
        const summary = result.text.length > 300 ? `${result.text.slice(0, 300)}…` : result.text;
        lines.push('', `Summary: ${summary}`);
      } else if (synthesisStyle === 'action_items') {
        // Surface action-oriented lines: lines starting with verbs, numbers, dashes, or "Action"/"Next"
        const actionLines = result.text
          .split('\n')
          .map((l) => l.trim())
          .filter(
            (l) =>
              l &&
              (l.match(
                /^(\d+[.)\s]|[-*•]|Action|Next|Step|TODO|Fix|Add|Update|Create|Run|Deploy|Implement)/i,
              ) ||
                l.startsWith('Action') ||
                l.startsWith('Next')),
          );
        if (actionLines.length > 0) {
          lines.push('', 'Action items:', ...actionLines.map((l) => `  • ${l}`));
        } else {
          lines.push('', `${strings.tools.subAgentsHandoff}:\n${result.text}`);
        }
      } else if (synthesisStyle === 'comparison') {
        // Label result with agent index for easy side-by-side reading
        lines.push('', `[Agent ${index + 1} — ${task.title}]:\n${result.text}`);
      } else {
        // Default: detailed (full handoff)
        lines.push('', `${strings.tools.subAgentsHandoff}:\n${result.text}`);
      }
    });

    return lines.join('\n');
  }

  async function runSubAgentConversation({ conversationContext, prompt, memoryContext }) {
    const localMessages = [
      ...conversationContext,
      {
        role: 'user',
        content: prompt,
      },
    ];
    let usage = { input: 0, output: 0 };
    let lastMeta = {};
    const MAX_SUB_AGENT_TOOL_CALLS = 1000;

    for (let depth = 0; depth <= MAX_SUB_AGENT_TOOL_CALLS; depth += 1) {
      const result = await invokeIpc('chat:complete-message', {
        messages: localMessages,
        providerId: activeProvider?.id ?? null,
        modelId: activeModel?.id ?? null,
        memoryContext: memoryContext || null,
        projectInfo: (await buildProjectContext(activeProject)) || null,
        persona: (getActivePersona?.() ?? activePersona)?.content || null,
        modeInstruction: [getModeInstruction(), CHAT_PROMPTS.subAgentResearchMode]
          .filter(Boolean)
          .join('\n\n'),
        terminalTools: payload.subAgentTerminalPrompt || null,
        toolsetTools: null,
        isNewSession: false,
      });

      usage = {
        input: usage.input + (result?.charCountIn ?? 0),
        output: usage.output + (result?.charCountOut ?? 0),
      };
      lastMeta = result ?? {};

      const { content: parsedContent } = parseThinkingFromText(String(result?.text ?? ''));
      const { terminalActions, toolsetActions, hasTools, visibleContent } = parseAllToolRequests(
        parsedContent,
        SUB_AGENT_TERMINAL_TOOL_SET,
      );

      if (!hasTools) {
        return {
          ...lastMeta,
          text: sanitizeAssistantVisibleContent(parsedContent) || strings.composer.emptyResponse,
          charCountIn: usage.input,
          charCountOut: usage.output,
        };
      }

      if (depth >= MAX_SUB_AGENT_TOOL_CALLS) {
        return {
          ...lastMeta,
          text:
            sanitizeAssistantVisibleContent(visibleContent || parsedContent) ||
            strings.tools.subAgentDepthLimit,
          charCountIn: usage.input,
          charCountOut: usage.output,
        };
      }

      // Execute all tool calls from this turn in parallel
      const allActions = [
        ...terminalActions.map((a) => ({ ...a, _kind: 'terminal' })),
        ...toolsetActions.map((a) => ({ ...a, _kind: 'toolset' })),
      ];

      const allResults = await Promise.all(
        allActions.map(async (action) => {
          try {
            if (action._kind === 'terminal') {
              const toolResult = await executeTerminalTool(action).catch((error) => ({
                ok: false,
                error: error?.message ?? String(error),
              }));
              return { action, result: toolResult };
            }

            const toolResult = {
              ok: false,
              tool: action.tool,
              error:
                action.tool === 'spawn_sub_agents'
                  ? CHAT_PROMPTS.nestedSubAgentsUnavailable
                  : CHAT_PROMPTS.subAgentToolAccessDenied.replace(
                      '{tool}',
                      action.tool || 'unknown',
                    ),
            };
            return { action, result: toolResult };
          } catch (error) {
            return { action, result: { ok: false, error: error?.message ?? String(error) } };
          }
        }),
      );

      const modelParts = allResults.map(({ action, result }) => {
        if (action._kind === 'terminal') {
          let part = formatTerminalResultForModel(strings, action, result);
          if (!result?.ok && result?.error) part += `\n\n${CHAT_PROMPTS.toolFailureRetry}`;
          return part;
        }
        let part = formatToolsetResultForModel(action, result);
        if (!result?.ok && result?.error) part += `\n\n${CHAT_PROMPTS.toolFailureRetry}`;
        return part;
      });

      localMessages.push({
        role: 'assistant',
        content: sanitizeAssistantVisibleContent(visibleContent) || null,
      });
      localMessages.push({
        role: 'user',
        content: modelParts.join('\n\n---\n\n'),
      });
    }

    return {
      text: strings.composer.emptyResponse,
      charCountIn: usage.input,
      charCountOut: usage.output,
      providerLabel: lastMeta.providerLabel ?? '',
      modelLabel: lastMeta.modelLabel ?? '',
    };
  }

  async function executeSubAgentTool(action, onProgress) {
    const payload = action?.payload ?? {};
    const parameters = normalizeSubAgentPayloadParameters(payload);
    const tasks = normalizeSubAgentTasks(parameters);

    if (!tasks.length) {
      return {
        ok: false,
        tool: action.tool,
        error: strings.tools.subAgentsNoTasks,
      };
    }

    const coordinationGoal = collapseWhitespace(
      parameters.coordination_goal ??
        parameters.coordinationGoal ??
        CHAT_PROMPTS.subAgentFallbackGoal,
    );
    const synthesisStyle = collapseWhitespace(
      parameters.synthesis_style ?? parameters.synthesisStyle ?? 'detailed',
    );
    const conversationContext = getSubAgentConversationContext();
    const memoryContext = await loadMemoryContext();

    const results = await Promise.all(
      tasks.map(async (task, index) => {
        const prompt = buildSubAgentTaskPrompt(task, coordinationGoal, index, tasks.length);
        onProgress?.(index, { status: 'running', prompt });

        try {
          const result = await runSubAgentConversation({
            conversationContext,
            prompt,
            memoryContext,
          });

          const agentResult = {
            ok: true,
            text: String(result?.text ?? '').trim() || strings.composer.emptyResponse,
            usage: {
              input: result?.charCountIn ?? 0,
              output: result?.charCountOut ?? 0,
            },
            providerLabel: result?.providerLabel ?? '',
            modelLabel: result?.modelLabel ?? '',
          };
          onProgress?.(index, { status: 'completed', output: agentResult.text });
          return agentResult;
        } catch (error) {
          const agentResult = { ok: false, error: error?.message ?? String(error) };
          onProgress?.(index, { status: 'failed', error: agentResult.error });
          return agentResult;
        }
      }),
    );

    return {
      ok: results.some((result) => result.ok),
      tool: action.tool,
      output: formatSubAgentOutput(tasks, results, coordinationGoal, synthesisStyle),
      results,
    };
  }

  async function executeToolsetTool(action) {
    // ── read_skill: fetch a skill document and inject it as context ──────────
    if (action?.tool === 'read_skill') {
      const namespace = String(
        action.payload?.namespace ?? action.payload?.parameters?.namespace ?? '',
      ).trim();
      const filename = String(
        action.payload?.filename ?? action.payload?.parameters?.filename ?? '',
      ).trim();
      try {
        const skill = await invokeIpc('skills:load-skill', namespace, filename);
        return {
          ok: true,
          tool: 'read_skill',
          output: `# Skill: ${skill.name}\n\n${skill.content}`,
        };
      } catch (error) {
        return {
          ok: false,
          tool: 'read_skill',
          error: error?.message ?? 'Skill not found.',
        };
      }
    }

    if (action?.tool === 'spawn_sub_agents') {
      return executeSubAgentTool(action);
    }

    const payload = action?.payload ?? {};
    const {
      tool: _tool,
      parameters: explicitParams,
      arguments: explicitArgs,
      ...topLevel
    } = payload;
    const parameters = { ...topLevel, ...(explicitArgs ?? {}), ...(explicitParams ?? {}) };
    return invokeIpc('toolset:execute-tool', {
      tool: action.tool,
      parameters,
    });
  }

  // Returns a human-readable card label for a toolset action.
  function getToolsetCardLabel(action) {
    if (action?.tool === 'spawn_sub_agents') return strings.tools.subAgentsLabel;
    if (action?.tool === 'read_skill') {
      const raw =
        String(action.payload?.filename ?? '').replace(/\.md$/i, '') ||
        String(action.payload?.namespace ?? '') ||
        'skill';
      return `Reading ${raw}`;
    }
    return action?.tool || strings.tools.runningTool;
  }

  function updateLastAssistantMessage(updater) {
    messages = messages.map((message, index) =>
      index !== messages.length - 1 ? message : updater(message),
    );
  }

  function updateAssistantMessageAt(messageIndex, updater) {
    messages = messages.map((message, index) =>
      index !== messageIndex ? message : updater(message),
    );
  }

  function buildTerminalDisplayOutput(result) {
    const parts = [];
    if (result?.stdout) parts.push(result.stdout);
    if (result?.stderr) parts.push(result.stderr);
    if (result?.error) parts.push(result.error);
    if (result?.summary) parts.push(JSON.stringify(result.summary, null, 2));
    if (result?.hint) parts.push(result.hint);
    if (result?.category) parts.push(`Category: ${result.category}`);
    if (result?.current || Array.isArray(result?.branches)) {
      parts.push(
        [
          result.current ? `Current branch: ${result.current}` : '',
          Array.isArray(result.branches) ? `Branches:\n${result.branches.join('\n')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    if (Array.isArray(result?.matches)) parts.push(JSON.stringify(result.matches, null, 2));
    if (Array.isArray(result?.entries)) parts.push(JSON.stringify(result.entries, null, 2));
    if (result?.content) parts.push(result.content);
    if (result?.processId) parts.push(`Process id: ${result.processId}`);
    if (result?.buffer) parts.push(result.buffer);
    return parts.map(formatVisibleToolOutput).join('\n\n').trim();
  }

  async function continueAfterTerminalTool(
    actionOrActions,
    terminalDepth,
    runToken,
    generationStartTime,
    extraToolsetActions = [],
  ) {
    const actions = (Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]).filter(
      Boolean,
    );
    const toolsetActions = (
      Array.isArray(extraToolsetActions) ? extraToolsetActions : [extraToolsetActions]
    ).filter(Boolean);

    const executionResults = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (runToken !== generationToken) return;

      // For actions beyond the first, add a dedicated terminal card.
      // The first action's card was already set up by the stream-done handler.
      if (i > 0) {
        const label = getTerminalToolLabel(strings, action.tool);
        const command = getTerminalActionSummary(action, strings);
        messages = [
          ...messages,
          {
            role: 'assistant',
            content: sanitizeAssistantVisibleContent(action.visibleContent) || null,
            thinking: '',
            streaming: false,
            providerLabel: activeProvider?.label ?? 'AI',
            modelLabel: activeModelLabel,
            terminal: {
              label,
              command,
              status: action.unsupported ? 'failed' : 'running',
              statusLabel: action.unsupported
                ? strings.terminal.unsupportedTool
                : strings.terminal.running,
            },
          },
        ];
        syncComposer();
        renderThread();
        scheduleScrollToBottom();

        if (action.unsupported) {
          executionResults.push({
            action,
            result: { ok: false, error: strings.terminal.unsupportedTool },
          });
          continue;
        }
      }

      if (runToken !== generationToken) return;

      let result;
      try {
        result = await executeTerminalTool(action);
      } catch (error) {
        result = { ok: false, error: error?.message ?? String(error) };
      }
      executionResults.push({ action, result });

      if (runToken !== generationToken) return;

      const isBlocked = Boolean(result?.risk?.blocked);
      const isRunningProcess = result?.ok && result?.running === true && result?.processId;
      const status = isBlocked
        ? 'blocked'
        : isRunningProcess
          ? 'running'
          : result?.ok
            ? 'completed'
            : 'failed';
      const statusLabel = isBlocked
        ? strings.terminal.blockedTool
        : isRunningProcess
          ? strings.terminal.running
          : result?.ok
            ? strings.terminal.completedTool
            : strings.terminal.failedTool;

      updateLastAssistantMessage((message) => ({
        ...message,
        terminal: {
          ...(message.terminal ?? {}),
          status,
          statusLabel,
          processId: result?.processId ?? message.terminal?.processId ?? null,
          output: buildTerminalDisplayOutput(result),
          exitCode: result?.exitCode,
        },
      }));
      renderThread();
      scheduleScrollToBottom();
    }

    if (runToken !== generationToken) return;

    const toolsetExecutionResults = [];
    const toolsetMessageIndexes = [];

    if (toolsetActions.length > 0) {
      const toolsetMessages = [];
      for (const action of toolsetActions) {
        toolsetMessageIndexes.push(messages.length + toolsetMessages.length);
        toolsetMessages.push({
          role: 'assistant',
          content: sanitizeAssistantVisibleContent(action.visibleContent) || null,
          thinking: '',
          streaming: false,
          providerLabel: activeProvider?.label ?? 'AI',
          modelLabel: activeModelLabel,
          terminal: {
            label: getToolsetCardLabel(action),
            command: action.tool,
            status: 'running',
            statusLabel: strings.terminal.running,
          },
        });
      }

      messages = [...messages, ...toolsetMessages];
      syncComposer();
      renderThread();
      scheduleScrollToBottom();

      const results = await Promise.all(
        toolsetActions.map(async (action, index) => {
          try {
            const result = await executeToolsetTool(action);
            return { action, index, result };
          } catch (error) {
            return {
              action,
              index,
              result: { ok: false, error: error?.message ?? String(error), tool: action.tool },
            };
          }
        }),
      );
      toolsetExecutionResults.push(...results);

      if (runToken !== generationToken) return;

      for (const { index, result } of toolsetExecutionResults) {
        const ok = result?.ok !== false && !result?.error;
        updateAssistantMessageAt(toolsetMessageIndexes[index], (message) => ({
          ...message,
          terminal: {
            ...(message.terminal ?? {}),
            status: ok ? 'completed' : 'failed',
            statusLabel: ok ? strings.tools.completedTool : strings.tools.failedTool,
            output: formatVisibleToolOutput(result?.output ?? result?.error ?? ''),
          },
        }));
      }

      renderThread();
      scheduleScrollToBottom();
    }

    const allResults = [...executionResults, ...toolsetExecutionResults];
    const allOk = allResults.every(({ result }) => result?.ok !== false && !result?.error);
    const combinedParts = [
      ...executionResults.map(({ action, result }) =>
        formatTerminalResultForModel(strings, action, result),
      ),
      ...toolsetExecutionResults.map(({ action, result }) =>
        formatToolsetResultForModel(action, result),
      ),
    ];
    const baseModelResult = combinedParts.join('\n\n---\n\n');
    const modelResult = allOk
      ? `${baseModelResult}\n\n${CHAT_PROMPTS.terminalToolsCompleted}`
      : `${baseModelResult}\n\n${CHAT_PROMPTS.toolCallsFailedRetry}`;

    messages = [
      ...messages,
      {
        role: 'user',
        content: strings.terminal.hiddenResultLabel,
        modelContent: modelResult,
        hidden: true,
      },
      {
        role: 'assistant',
        content: '',
        thinking: '',
        streaming: true,
        providerLabel: activeProvider?.label ?? 'AI',
        modelLabel: activeModelLabel,
      },
    ];

    accText = '';
    accThinking = '';
    syncComposer();
    renderThread();

    await startAssistantStream({
      isNewSession: false,
      terminalDepth: terminalDepth + 1,
      runToken,
      generationStartTime,
    });
  }

  async function continueAfterToolsetTool(
    actionOrActions,
    terminalDepth,
    runToken,
    generationStartTime,
  ) {
    const actions = (Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]).filter(
      Boolean,
    );
    const primaryAction = actions[0];
    if (!primaryAction) return;

    // ── Sub-agents: special-cased for live per-task progress ─────────────────
    if (actions.length === 1 && primaryAction.tool === 'spawn_sub_agents') {
      const initTasks = normalizeSubAgentTasks(
        normalizeSubAgentPayloadParameters(primaryAction.payload),
      );
      let currentSubAgents = initTasks.map((task) => ({
        title: task.title,
        goal: task.goal,
        deliverable: task.deliverable,
        prompt: '',
        status: 'queued',
        output: '',
        error: '',
      }));

      updateLastAssistantMessage((message) => ({
        ...message,
        terminal: {
          ...(message.terminal ?? {}),
          status: 'running',
          statusLabel: strings.tools.subAgentsRunning,
          subAgents: currentSubAgents,
        },
      }));
      syncComposer();
      renderThread();

      const onProgress = (index, agentState) => {
        if (runToken !== generationToken) return;
        currentSubAgents = currentSubAgents.map((a, i) =>
          i === index ? { ...a, ...agentState } : a,
        );
        updateSubAgentCard(thread, currentSubAgents, strings);
      };

      let subAgentResult;
      try {
        subAgentResult = await executeSubAgentTool(primaryAction, onProgress);
      } catch (error) {
        subAgentResult = {
          ok: false,
          error: error?.message ?? String(error),
          tool: primaryAction.tool,
        };
      }

      if (runToken !== generationToken) return;

      if (Array.isArray(subAgentResult?.results)) {
        subAgentResult.results.forEach((agentResult, i) => {
          currentSubAgents = currentSubAgents.map((a, idx) => {
            if (idx !== i) return a;
            return agentResult.ok
              ? { ...a, status: 'completed', output: agentResult.text ?? '' }
              : { ...a, status: 'failed', error: agentResult.error ?? '' };
          });
        });
      }

      const subAgentOk = subAgentResult?.ok !== false && !subAgentResult?.error;
      const subAgentModelResult = formatToolsetResultForModel(primaryAction, subAgentResult);

      updateLastAssistantMessage((message) => ({
        ...message,
        terminal: {
          ...(message.terminal ?? {}),
          status: subAgentOk ? 'completed' : 'failed',
          statusLabel: subAgentOk ? strings.tools.subAgentsComplete : strings.tools.subAgentsFailed,
          output: formatVisibleToolOutput(subAgentResult?.output ?? subAgentResult?.error ?? ''),
          subAgents: currentSubAgents,
        },
      }));

      messages = [
        ...messages,
        {
          role: 'user',
          content: strings.tools.hiddenResultLabel,
          modelContent: subAgentModelResult,
          hidden: true,
        },
        {
          role: 'assistant',
          content: '',
          thinking: '',
          streaming: true,
          providerLabel: activeProvider?.label ?? 'AI',
          modelLabel: activeModelLabel,
        },
      ];

      accText = '';
      accThinking = '';
      syncComposer();
      renderThread();

      await startAssistantStream({
        isNewSession: false,
        terminalDepth: terminalDepth + 1,
        runToken,
        generationStartTime,
      });
      return;
    }

    // ── All other toolset tools ───────────────────────────────────────────────
    const toolMessageIndexes = [messages.length - 1];
    const additionalMessages = [];

    for (let index = 1; index < actions.length; index += 1) {
      const action = actions[index];
      toolMessageIndexes.push(messages.length + additionalMessages.length);
      additionalMessages.push({
        role: 'assistant',
        content: sanitizeAssistantVisibleContent(action.visibleContent) || null,
        thinking: '',
        streaming: false,
        providerLabel: activeProvider?.label ?? 'AI',
        modelLabel: activeModelLabel,
        terminal: {
          label: getToolsetCardLabel(action),
          command: action.tool,
          status: 'running',
          statusLabel: strings.terminal.running,
        },
      });
    }

    if (additionalMessages.length > 0) {
      messages = [...messages, ...additionalMessages];
      syncComposer();
      renderThread();
      scheduleScrollToBottom();
    }

    const executionResults = await Promise.all(
      actions.map(async (action, index) => {
        try {
          const result = await executeToolsetTool(action);
          return { action, index, result };
        } catch (error) {
          return {
            action,
            index,
            result: { ok: false, error: error?.message ?? String(error), tool: action.tool },
          };
        }
      }),
    );

    if (runToken !== generationToken) return;

    for (const { index, result } of executionResults) {
      const ok = result?.ok !== false && !result?.error;
      updateAssistantMessageAt(toolMessageIndexes[index], (message) => ({
        ...message,
        terminal: {
          ...(message.terminal ?? {}),
          status: ok ? 'completed' : 'failed',
          statusLabel: ok ? strings.tools.completedTool : strings.tools.failedTool,
          output: formatVisibleToolOutput(result?.output ?? result?.error ?? ''),
        },
      }));
    }

    const allOk = executionResults.every(({ result }) => result?.ok !== false && !result?.error);
    const baseModelResult = executionResults
      .map(({ action, result }) => formatToolsetResultForModel(action, result))
      .join('\n\n---\n\n');
    const modelResult = allOk
      ? `${baseModelResult}\n\n${CHAT_PROMPTS.toolsetToolsCompleted}`
      : `${baseModelResult}\n\n${CHAT_PROMPTS.toolCallsFailedRetry}`;

    messages = [
      ...messages,
      {
        role: 'user',
        content: strings.tools.hiddenResultLabel,
        modelContent: modelResult,
        hidden: true,
      },
      {
        role: 'assistant',
        content: '',
        thinking: '',
        streaming: true,
        providerLabel: activeProvider?.label ?? 'AI',
        modelLabel: activeModelLabel,
      },
    ];

    accText = '';
    accThinking = '';
    syncComposer();
    renderThread();

    await startAssistantStream({
      isNewSession: false,
      terminalDepth: terminalDepth + 1,
      runToken,
      generationStartTime,
    });
  }

  async function startAssistantStream({
    isNewSession,
    terminalDepth = 0,
    runToken,
    generationStartTime,
  }) {
    if (shouldShortCircuitOffline()) {
      if (runToken !== generationToken) return;
      removeStreamListeners();
      clearTimeout(diagTimer);
      diagTimer = null;
      diagPanel?.hide();
      updateLastAssistantMessage(() => ({
        role: 'assistant',
        content: strings.composer.offlineResponse,
        thinking: '',
        streaming: false,
        error: true,
        providerLabel: activeProvider?.label ?? 'AI',
        modelLabel: activeModelLabel,
      }));
      isSending = false;
      accText = '';
      accThinking = '';
      await saveCurrentSession();
      syncComposer();
      renderThread();
      return;
    }

    removeStreamListeners();
    const streamId = createStreamId(runToken);
    activeStreamId = streamId;
    const isCurrentStreamEvent = (payload) =>
      runToken === generationToken && activeStreamId === streamId && payload?.streamId === streamId;

    // Start the diagnostic timer only on the first turn (not tool continuations).
    // If the model hasn't sent a single token after 10 seconds, show the panel
    // and run internet + provider reachability checks in parallel.
    if (terminalDepth === 0) {
      clearTimeout(diagTimer);
      diagTimer = setTimeout(async () => {
        if (runToken !== generationToken) return;

        diagPanel.show(thread);
        diagPanel.addItem(strings.diag.slowResponse);

        const userProviderDetails = payload.user?.providers?.details ?? {};

        // Run internet and provider checks concurrently so results appear as
        // they finish rather than sequentially.
        const netRef = diagPanel.addItem(strings.diag.checkingInternet, 'spin');
        const provLabel = activeProvider?.label ?? 'AI provider';
        const provBaseUrl = activeProvider
          ? resolveProviderBaseUrl(activeProvider, userProviderDetails)
          : null;
        const provRef = diagPanel.addItem(
          strings.diag.checkingProvider.replace('AI provider', provLabel),
          'spin',
        );

        const [netResult, provResult] = await Promise.all([
          measureFetch('https://dns.google/resolve?name=google.com&type=A'),
          provBaseUrl ? measureFetch(provBaseUrl) : Promise.resolve(null),
        ]);

        if (runToken !== generationToken) return;

        const internetDown = !netResult.ok;

        if (netResult.ok) {
          if (netResult.ms > 1500) {
            netRef.update(`${strings.diag.internetSlow} (${netResult.ms}ms)`, 'warn');
          } else {
            netRef.update(`${strings.diag.internetStable} (${netResult.ms}ms)`);
          }
        } else {
          netRef.update(strings.diag.internetUnreachable, 'error');
        }

        if (internetDown) {
          // Internet is down — provider check is meaningless; don't mislead the user.
          provRef.update(strings.diag.providerSkipped, 'warn');
        } else if (provResult === null) {
          provRef.update(strings.diag.providerNoEndpoint, 'warn');
        } else if (provResult.ok) {
          if (provResult.ms > 3000) {
            provRef.update(`${provLabel}: Reachable (${provResult.ms}ms)`, 'warn');
            diagPanel.addItem(strings.diag.providerSlow);
          } else {
            provRef.update(`${provLabel}: Reachable (${provResult.ms}ms)`);
          }
        } else {
          provRef.update(`${provLabel}: Unreachable`, 'error');
          diagPanel.addItem(strings.diag.checkSettings, 'warn');
        }
      }, 10_000);
    }

    streamDisposers.push(
      onIpc('chat:stream-chunk', (chunk) => {
        if (!isCurrentStreamEvent(chunk)) return;
        if (chunk?.type === 'text' && chunk.text) accText += chunk.text;
        if (chunk?.type === 'thinking' && chunk.text) accThinking += chunk.text;
        // Batch UI updates to once per animation frame instead of every token.
        // Text accumulation above is still instant so tool detection in
        // stream-done always sees the complete text.
        if (!streamUpdateFrame) {
          streamUpdateFrame = requestAnimationFrame(() => {
            streamUpdateFrame = null;
            const { content: displayContent, thinking: inlineThinking } =
              parseThinkingFromText(accText);
            const displayThinking = accThinking || inlineThinking;
            // Estimate live tokens/sec: approximate 1 token ≈ 4 chars, show
            // once at least 1 second has elapsed and a few chars accumulated.
            const elapsedSec = (Date.now() - generationStartTime) / 1000;
            const approxTokens = accText.length / 4;
            const liveTps =
              elapsedSec >= 1 && approxTokens > 0
                ? String(Math.round(approxTokens / elapsedSec))
                : null;
            updateLastStreamingMessage(thread, {
              content: sanitizeAssistantVisibleContent(displayContent),
              thinking: sanitizeAssistantVisibleContent(displayThinking),
              tps: liveTps,
            });
            scheduleScrollToBottom();
          });
        }
      }),
    );

    streamDisposers.push(
      onIpc('chat:stream-done', async (meta) => {
        if (!isCurrentStreamEvent(meta)) return;
        // Cancel any pending rAF — we are about to do a final authoritative
        // render that supersedes any in-flight streaming frame.
        if (streamUpdateFrame) {
          cancelAnimationFrame(streamUpdateFrame);
          streamUpdateFrame = null;
        }
        clearActiveStreamId(streamId);
        clearTimeout(diagTimer);
        diagTimer = null;
        diagPanel?.hide();
        removeStreamListeners();
        const { content: parsedContent, thinking: inlineThinking } = parseThinkingFromText(accText);
        // Some models (e.g. Nemotron) embed tool calls inside their reasoning/thinking blocks.
        // Search content first, then fall back to thinking text so we never miss a tool call.
        const thinkingText = accThinking || inlineThinking || '';
        const primaryTools = parseAllToolRequests(parsedContent);
        const fallback = primaryTools.hasTools
          ? primaryTools
          : thinkingText
            ? parseAllToolRequests(thinkingText)
            : null;
        const terminalActions = fallback?.terminalActions.length ? fallback.terminalActions : null;
        let terminalAction = terminalActions?.[0] ?? null;
        const toolsetActions = fallback?.toolsetActions.length ? fallback.toolsetActions : null;
        const toolsetAction = toolsetActions?.[0] ?? null;

        if ((terminalAction || toolsetAction) && terminalDepth >= MAX_TERMINAL_TOOL_CALLS) {
          const action = terminalAction || toolsetAction;
          updateLastAssistantMessage((message) => ({
            ...message,
            role: 'assistant',
            content:
              sanitizeAssistantVisibleContent(action.visibleContent) ||
              strings.terminal.unsupportedTool,
            thinking: sanitizeAssistantVisibleContent(accThinking || inlineThinking),
            streaming: false,
            error: true,
            providerLabel: meta?.providerLabel ?? activeProvider?.label ?? 'AI',
            modelLabel: meta?.modelLabel ?? activeModelLabel,
          }));
          isSending = false;
          await saveCurrentSession();
          void playCompletion(generationStartTime);
          syncComposer();
          renderThread();
          return;
        }

        if (terminalAction) {
          const label = getTerminalToolLabel(strings, terminalAction.tool);
          const command = getTerminalActionSummary(terminalAction, strings);
          updateLastAssistantMessage((message) => ({
            ...message,
            role: 'assistant',
            content: sanitizeAssistantVisibleContent(terminalAction.visibleContent) || null,
            thinking: sanitizeAssistantVisibleContent(accThinking || inlineThinking),
            streaming: false,
            providerLabel: meta?.providerLabel ?? activeProvider?.label ?? 'AI',
            modelLabel: meta?.modelLabel ?? activeModelLabel,
            terminal: {
              label,
              command,
              status: terminalAction.unsupported ? 'failed' : 'running',
              statusLabel: terminalAction.unsupported
                ? strings.terminal.unsupportedTool
                : strings.terminal.running,
            },
          }));
          syncComposer();
          renderThread();

          if (terminalAction.unsupported) {
            isSending = false;
            await saveCurrentSession();
            void playCompletion(generationStartTime);
            syncComposer();
            return;
          }

          void continueAfterTerminalTool(
            terminalActions,
            terminalDepth,
            runToken,
            generationStartTime,
            toolsetActions,
          );
          return;
        }

        if (toolsetAction) {
          updateLastAssistantMessage((message) => ({
            ...message,
            role: 'assistant',
            content: sanitizeAssistantVisibleContent(toolsetAction.visibleContent) || null,
            thinking: sanitizeAssistantVisibleContent(accThinking || inlineThinking),
            streaming: false,
            providerLabel: meta?.providerLabel ?? activeProvider?.label ?? 'AI',
            modelLabel: meta?.modelLabel ?? activeModelLabel,
            terminal: {
              label: getToolsetCardLabel(toolsetAction),
              command: toolsetAction.tool,
              status: 'running',
              statusLabel: strings.terminal.running,
            },
          }));
          syncComposer();
          renderThread();
          void continueAfterToolsetTool(
            toolsetActions ?? toolsetAction,
            terminalDepth,
            runToken,
            generationStartTime,
          );
          return;
        }

        const finalContent = sanitizeAssistantVisibleContent(parsedContent);
        const finalThinking = sanitizeAssistantVisibleContent(accThinking || inlineThinking);
        const needsContinuation = !finalContent && Boolean(finalThinking);
        const durationMs = Date.now() - generationStartTime;
        // Compute average tokens/sec for the completed response.
        // Approximate: 1 token ≈ 4 chars. Round to 1 decimal place.
        const durationSec = durationMs / 1000;
        const totalApproxTokens = accText.length / 4;
        const avgTps =
          durationSec > 0 && totalApproxTokens > 0
            ? Math.round((totalApproxTokens / durationSec) * 10) / 10
            : 0;
        updateLastAssistantMessage(() => ({
          role: 'assistant',
          content: needsContinuation ? '' : finalContent || strings.composer.emptyResponse,
          thinking: finalThinking,
          streaming: false,
          empty: !finalContent,
          needsContinuation,
          durationMs,
          avgTps,
          providerLabel: meta?.providerLabel ?? activeProvider?.label ?? 'AI',
          modelLabel: meta?.modelLabel ?? activeModelLabel,
        }));
        isSending = false;
        await saveCurrentSession();
        void playCompletion(generationStartTime);
        syncComposer();
        renderThread();
      }),
    );

    streamDisposers.push(
      onIpc('chat:stream-error', (error) => {
        if (!isCurrentStreamEvent(error)) return;
        if (streamUpdateFrame) {
          cancelAnimationFrame(streamUpdateFrame);
          streamUpdateFrame = null;
        }
        clearActiveStreamId(streamId);
        clearTimeout(diagTimer);
        diagTimer = null;
        diagPanel?.hide();
        removeStreamListeners();
        updateLastAssistantMessage(() => ({
          role: 'assistant',
          content: error?.message || strings.composer.responseError,
          thinking: sanitizeAssistantVisibleContent(accThinking),
          streaming: false,
          error: true,
          providerLabel: activeProvider?.label ?? 'AI',
          modelLabel: activeModelLabel,
        }));
        isSending = false;
        syncComposer();
        renderThread();
      }),
    );

    const historyToSend = messages
      .slice(0, -1)
      .filter(({ error, stopped, empty }) => !error && !stopped && !empty)
      .map(({ role, content, modelContent, imageAttachments }) => {
        if (role !== 'user') return { role, content };
        const textContent = modelContent || content;
        // Carry image data so providers can build multimodal content blocks.
        if (!imageAttachments?.length) return { role, content: textContent };
        return { role, content: textContent, imageAttachments };
      });
    const liveBrowserContext = await loadLiveBrowserContext(strings);
    const pipelineRequest = await createAssistantPipelineRequest({
      messages: historyToSend,
      contextCache: assistantContextCache,
      providerId: activeProvider?.id ?? null,
      modelId: activeModel?.id ?? null,
      projectInfo: (await buildProjectContext(activeProject)) || null,
      persona: (getActivePersona?.() ?? activePersona)?.content || null,
      modeInstruction: joinPromptParts([getModeInstruction(), liveBrowserContext]),
      terminalTools: payload.terminalPrompt,
      isNewSession,
      source: 'chat',
    });

    if (runToken !== generationToken) return;

    void invokeIpc('chat:stream-message', {
      ...pipelineRequest,
      streamId,
    });
  }

  async function submitPrompt(resend = null) {
    hideUserTyping();
    const isResend = resend !== null;

    // Display summaries shown in the thread (no base64 — safe to store in session).
    // Exception: image attachments keep mimeType + base64 in-memory so the thread
    // can render thumbnails. saveCurrentSession() strips them via toAttachmentSummary.
    const allDisplayAttachments = isResend
      ? (resend.attachments ?? [])
      : pendingAttachments.map((a) =>
          a.kind === 'image'
            ? { ...toAttachmentSummary(a), mimeType: a.mimeType, base64: a.base64 }
            : toAttachmentSummary(a),
        );

    // Text-only attachments used to build the model context block.
    const textAttachments = isResend
      ? allDisplayAttachments.filter((a) => a.kind !== 'image')
      : pendingAttachments.filter((a) => a.kind !== 'image');

    // Image attachments with base64 for the API.  Never persisted to disk.
    const imageAttachmentsData = isResend
      ? (resend.imageAttachments ?? [])
      : pendingAttachments
          .filter((a) => a.kind === 'image')
          .map((a) => ({ mimeType: a.mimeType, base64: a.base64 }));

    const prompt =
      String(resend?.content ?? draftValue).trim() ||
      (allDisplayAttachments.length ? CHAT_PROMPTS.attachmentOnly : '');

    if ((!prompt && allDisplayAttachments.length === 0) || isSending) return;
    cancelScheduledMemorySync();

    const isNewSession = !sessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionCreatedAt = new Date().toISOString();
    }

    const modelContent =
      resend?.modelContent || buildModelContent(strings, prompt, textAttachments);

    messages = [
      ...messages,
      {
        role: 'user',
        content: prompt,
        modelContent,
        attachments: allDisplayAttachments,
        imageAttachments: imageAttachmentsData,
      },
      {
        role: 'assistant',
        content: '',
        thinking: '',
        streaming: true,
        providerLabel: activeProvider?.label ?? 'AI',
        modelLabel: activeModelLabel,
      },
    ];

    draftValue = '';
    pendingAttachments = [];
    if (shouldShortCircuitOffline()) {
      messages = [
        ...messages.slice(0, -1),
        {
          role: 'assistant',
          content: strings.composer.offlineResponse,
          thinking: '',
          streaming: false,
          error: true,
          providerLabel: activeProvider?.label ?? 'AI',
          modelLabel: activeModelLabel,
        },
      ];
      isSending = false;
      accText = '';
      accThinking = '';
      userScrolledUp = false;
      closeSlashMenu();
      renderPendingAttachments();
      syncComposer();
      renderThread();
      focusComposer();
      await saveCurrentSession();
      return;
    }

    isSending = true;
    accText = '';
    accThinking = '';
    userScrolledUp = false;
    const generationStartTime = Date.now();
    const runToken = ++generationToken;
    closeSlashMenu();
    renderPendingAttachments();
    syncComposer();
    renderThread();
    focusComposer();
    await startAssistantStream({
      isNewSession,
      terminalDepth: 0,
      runToken,
      generationStartTime,
    });
  }

  scroll = createElement('div', 'chat-stage__scroll');
  Object.assign(scroll.style, {
    flex: 1,
    minHeight: 0,
    width: '100%',
  });
  const scrollWrap = createElement('div', 'chat-stage__scroll-wrap');
  Object.assign(scrollWrap.style, {
    flex: 1,
    height: '100%',
    minHeight: 0,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  });
  scrollWrap.append(scroll);
  attachCustomScrollbar(scrollWrap, scroll, { right: 4, top: 48, bottom: 4, minThumb: 24 });

  bottom = createElement('div', 'chat-stage__bottom');
  const rawGreeting = isBirthday
    ? getBirthdayGreeting(firstName)
    : isChristmas
      ? getChristmasGreeting(firstName)
      : isNewYear
        ? getNewYearGreeting(firstName)
        : greetings[Math.floor(Math.random() * greetings.length)];
  const greeting = rawGreeting.replace(/\s(\S+\s*)$/, '\u00A0$1');
  title = createElement('h1', 'chat-stage__title', greeting);
  thread = createElement('section', 'chat-thread');
  thread.hidden = true;

  // ── Prompt bubbles ──────────────────────────────────────────────────────
  bubblesEl = createElement('div', 'chat-prompt-bubbles');
  for (const { icon, label, prompt, submit } of getRandomSuggestions()) {
    const btn = createElement('button', 'chat-prompt-bubble');
    btn.type = 'button';
    btn.append(
      createIcon(icon, 'chat-prompt-bubble__icon'),
      createElement('span', 'chat-prompt-bubble__label', label),
    );
    btn.addEventListener('click', () => {
      setDraftValue(prompt);
      if (submit) void submitPrompt();
      else focusComposer();
    });
    bubblesEl.append(btn);
  }

  if (currentAppSettings?.showTechFeed !== false) {
    const techFeedPanel = createTechFeedPanel(strings.techFeed, payload.user?.usageModes ?? []);
    techFeedEl = techFeedPanel.element;
  }

  composer = createElement('section', 'chat-composer');
  projectPill = createElement('div', 'chat-composer__project');
  projectPill.hidden = true;
  fileDiffPanel = createElement('section', 'chat-file-diff');
  fileDiffPanel.hidden = true;

  const projectMainEl = createElement('div', 'chat-composer__project-main');
  projectIconEl = createElement('span', 'chat-composer__project-icon');
  projectIconEl.append(createIcon('tabProjects', 'chat-composer__project-icon-glyph'));
  const projectBodyEl = createElement('div', 'chat-composer__project-body');
  projectNameEl = createElement('div', 'chat-composer__project-name');
  projectMetaEl = createElement('div', 'chat-composer__project-meta');
  projectBodyEl.append(projectNameEl, projectMetaEl);
  const projectClearBtn = createElement('button', 'chat-composer__project-clear');
  projectClearBtn.type = 'button';
  projectClearBtn.setAttribute('aria-label', strings.projects.removeActive);
  projectClearBtn.append(createIcon('close', 'chat-composer__project-clear-icon'));
  projectClearBtn.addEventListener('click', () => {
    clearActiveProject();
    focusComposer();
  });
  projectMainEl.append(projectIconEl, projectBodyEl);

  gitBarEl = createElement('div', 'chat-gitbar');
  gitBarEl.hidden = true;
  gitIdentityEl = createElement('div', 'chat-gitbar__identity');
  gitStatusDotEl = createElement('span', 'chat-gitbar__dot');
  gitStatusDotEl.hidden = true;
  const gitCopy = createElement('div', 'chat-gitbar__copy');
  gitBranchEl = createElement('div', 'chat-gitbar__branch');
  gitBranchEl.hidden = true;
  gitMetaEl = createElement('div', 'chat-gitbar__meta');
  gitCopy.append(gitBranchEl, gitMetaEl);
  gitIdentityEl.append(gitStatusDotEl, gitCopy);

  const gitActions = createElement('div', 'chat-gitbar__actions');
  gitRefreshBtn = createElement('button', 'chat-gitbar__icon-button');
  gitRefreshBtn.type = 'button';
  gitRefreshBtn.setAttribute('aria-label', strings.git.refresh);
  gitRefreshBtn.append(createIcon('retry', 'chat-gitbar__button-icon'));
  gitRefreshBtn.addEventListener('click', () => {
    void refreshProjectGitStatus();
  });

  gitSecondaryBtn = createElement('button', 'chat-gitbar__secondary');
  gitSecondaryBtn.type = 'button';
  gitSecondaryBtn.addEventListener('click', () => {
    void runGitBarAction(gitSecondaryBtn._gitAction);
  });

  const gitActionWrap = createElement('div', 'chat-gitbar__action-wrap');
  gitPrimaryBtn = createElement('button', 'chat-gitbar__primary');
  gitPrimaryBtn.type = 'button';
  gitPrimaryBtn.addEventListener('click', () => {
    void runGitBarAction(gitPrimaryBtn._gitAction);
  });

  gitMenuBtn = createElement('button', 'chat-gitbar__menu-button');
  gitMenuBtn.type = 'button';
  gitMenuBtn.hidden = true;
  gitMenuBtn.setAttribute('aria-label', strings.git.moreActions);
  gitMenuBtn.append(createIcon('chevronDown', 'chat-gitbar__menu-button-icon'));
  gitMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (gitBusy || !gitActionMenuEl) return;
    const willOpen = gitActionMenuEl.hidden;
    if (willOpen) {
      const rect = gitMenuBtn.getBoundingClientRect();
      // Tentatively open below the button
      gitActionMenuEl.style.top = `${rect.bottom + 4}px`;
      gitActionMenuEl.style.bottom = '';
      gitActionMenuEl.style.right = `${window.innerWidth - rect.right}px`;
      gitActionMenuEl.hidden = false;
      gitMenuBtn.classList.add('chat-gitbar__menu-button--open');
      // After render, flip upward if it clips the bottom of the viewport
      requestAnimationFrame(() => {
        const menuRect = gitActionMenuEl.getBoundingClientRect();
        if (menuRect.bottom > window.innerHeight - 8) {
          gitActionMenuEl.style.top = '';
          gitActionMenuEl.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        }
      });
    } else {
      gitActionMenuEl.hidden = true;
      gitMenuBtn.classList.remove('chat-gitbar__menu-button--open');
    }
  });

  gitActionMenuEl = createElement('div', 'chat-gitbar__menu');
  gitActionMenuEl.hidden = true;

  gitActionWrap.append(gitPrimaryBtn, gitMenuBtn);
  document.body.append(gitActionMenuEl);
  gitActions.append(gitRefreshBtn, gitSecondaryBtn, gitActionWrap);
  gitBarEl.append(gitIdentityEl, gitActions);

  gitCommitPanelEl = createElement('div', 'chat-gitbar__commit-panel');
  gitCommitPanelEl.hidden = true;
  gitCommitFieldWrapEl = createElement('div', 'chat-gitbar__commit-field-wrap');
  gitCommitMessageEl = document.createElement('textarea');
  gitCommitMessageEl.className = 'chat-gitbar__commit-message';
  gitCommitMessageEl.placeholder = strings.git.commitMessagePlaceholder;
  gitCommitMessageEl.rows = 3;
  gitCommitMessageEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void performGitCommitAction();
    }
  });
  gitCommitAiBtn = createElement('button', 'chat-gitbar__commit-ai');
  gitCommitAiBtn.type = 'button';
  gitCommitAiBtn.setAttribute('aria-label', strings.git.generateCommitMessage);
  gitCommitAiBtn.append(createIcon('aiSparkle', 'chat-gitbar__commit-ai-icon'));
  gitCommitAiBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    void generateGitCommitMessage();
  });
  gitCommitFieldWrapEl.append(gitCommitMessageEl, gitCommitAiBtn);

  gitCommitStatusEl = createElement('p', 'chat-gitbar__commit-status');
  gitCommitStatusEl.hidden = true;
  const gitCommitActions = createElement('div', 'chat-gitbar__commit-actions');
  gitCommitCancelBtn = createElement('button', 'chat-gitbar__commit-cancel', strings.git.cancel);
  gitCommitCancelBtn.type = 'button';
  gitCommitCancelBtn.addEventListener('click', () => {
    if (!gitBusy) closeGitCommitPanel();
    focusComposer();
  });
  gitCommitConfirmBtn = createElement('button', 'chat-gitbar__commit-confirm');
  gitCommitConfirmBtn.type = 'button';
  gitCommitConfirmBtn.addEventListener('click', () => {
    void performGitCommitAction();
  });
  gitCommitActions.append(gitCommitCancelBtn, gitCommitConfirmBtn);
  gitCommitPanelEl.append(gitCommitFieldWrapEl, gitCommitStatusEl, gitCommitActions);

  projectPill.append(projectMainEl, gitBarEl, projectClearBtn, gitCommitPanelEl);

  composerField = document.createElement('textarea');
  composerField.className = 'chat-composer__field';
  composerField.placeholder = strings.composer.placeholder;
  composerField.rows = 1;
  composerField.addEventListener('input', (event) => {
    draftValue = event.target.value;
    syncComposerFieldHeight();
    syncComposer();
    void updateSlashMenu();
    void play('type');
    // User typing indicator
    if (draftValue.trim() && messages.length > 0) {
      clearTimeout(userTypingTimer);
      showUserTyping();
      userTypingTimer = setTimeout(hideUserTyping, 2000);
    } else {
      hideUserTyping();
    }
  });
  composerField.addEventListener('keydown', (event) => {
    if (handleSlashKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitPrompt();
    }
  });

  const composerFooter = createElement('div', 'chat-composer__footer');
  const composerActions = createElement('div', 'chat-composer__actions');

  attachBtn = createElement('button', 'chat-composer__icon-button');
  attachBtn.type = 'button';
  attachBtn.setAttribute('aria-label', strings.composer.attachFiles);
  attachBtn.append(createIcon('paperclip', 'chat-composer__icon'));
  attachBtn.addEventListener('click', () => {
    void selectAttachments();
  });

  enhanceBtn = createElement('button', 'chat-composer__icon-button');
  enhanceBtn.type = 'button';
  enhanceBtn.setAttribute('aria-label', strings.composer.enhancePrompt);
  enhanceBtn.append(createIcon('aiSparkle', 'chat-composer__icon'));
  enhanceBtn.addEventListener('click', () => {
    void enhancePrompt();
  });

  terminalBtn = createElement('button', 'chat-composer__icon-button');
  terminalBtn.type = 'button';
  terminalBtn.setAttribute('aria-label', strings.composer.openTerminal);
  terminalBtn.append(createIcon('terminal', 'chat-composer__icon'));
  terminalBtn.addEventListener('click', () => {
    terminalPanel?.toggle();
  });

  // ── Browser button ────────────────────────────────────────────────────────
  // Opens the live browser panel with a search bar. The search bar is only
  // shown when the browser is opened via this button — not when it opens from
  // a link click inside a chat message.
  browserBtn = createElement('button', 'chat-composer__icon-button');
  browserBtn.type = 'button';
  browserBtn.setAttribute('aria-label', strings.composer.openBrowser ?? 'Open browser');
  browserBtn.append(createIcon('globe', 'chat-composer__icon'));
  browserBtn.addEventListener('click', () => {
    const engineKey = currentAppSettings?.defaultSearchEngine ?? 'google';
    const homeUrl = SEARCH_ENGINE_SEARCH_URLS[engineKey] ?? 'https://www.google.com';
    browserPreview.showWithSearchBar(homeUrl, engineKey);
  });
  // ─────────────────────────────────────────────────────────────────────────

  composerActions.append(attachBtn, enhanceBtn, terminalBtn, browserBtn);

  const contextVizBtn = createElement('button', 'chat-composer__icon-button');
  contextVizBtn.type = 'button';
  contextVizBtn.setAttribute('aria-label', strings.composer.contextWindow);
  contextVizBtn.append(createIcon('info', 'chat-composer__icon'));
  contextVizBtn.addEventListener('click', async () => {
    contextVizVisible = !contextVizVisible;
    if (contextVizVisible && !contextViz) {
      const { createContextVisualizer: createCV } =
        await import('../../Shared/ContextVisualizer/ContextVisualizer.js');
      contextViz = createCV();
      composer.parentElement?.insertBefore(contextViz.element, composer);
    }
    if (contextViz) {
      contextViz.element.hidden = !contextVizVisible;
      if (contextVizVisible) {
        refreshContextVisualizer();
      }
    }
  });
  composerActions.append(contextVizBtn);

  const composerSubmit = createElement('div', 'chat-composer__submit');
  gitBranchButton = createElement('button', 'chat-composer__branch');
  gitBranchButton.type = 'button';
  gitBranchButton.hidden = true;
  gitBranchButtonDotEl = createElement('span', 'chat-gitbar__dot chat-composer__branch-status');
  gitBranchButtonLabelEl = createElement('span', 'chat-composer__branch-label');
  gitBranchButton.append(
    gitBranchButtonDotEl,
    gitBranchButtonLabelEl,
    createIcon('chevronDown', 'chat-composer__branch-chevron'),
  );
  gitBranchButton.addEventListener('click', (event) => {
    event.stopPropagation();
    void openGitBranchPicker(gitBranchButton);
  });

  modelButton = createElement('button', 'chat-composer__model');
  modelButton.type = 'button';
  const modelProviderIcon = document.createElement('img');
  modelProviderIcon.className = 'chat-composer__model-provider-icon';
  modelProviderIcon.alt = '';
  modelProviderIcon.draggable = false;
  if (activeProvider?.iconPath) {
    modelProviderIcon.src = activeProvider.iconPath;
    modelProviderIcon.hidden = false;
  } else {
    modelProviderIcon.hidden = true;
  }
  modelButton.append(
    modelProviderIcon,
    createElement('span', 'chat-composer__model-label', activeModelLabel),
    createIcon('chevronDown', 'chat-composer__model-icon'),
  );
  modelButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openModelPicker(modelButton);
  });

  sendButton = createElement('button', 'chat-composer__send');
  sendButton.type = 'button';
  const sendLabel = createElement('span', 'chat-composer__send-label');
  sendLabel.hidden = true;
  sendButton.append(createIcon('send', 'chat-composer__send-icon'), sendLabel);
  sendButton.addEventListener('click', async () => {
    if (isSending) {
      await stopStream();
    } else {
      void submitPrompt();
    }
  });

  composerSubmit.append(gitBranchButton, modelButton, sendButton);
  composerFooter.append(composerActions, composerSubmit);
  attachmentsEl = createElement('div', 'chat-composer__attachments');
  attachmentsEl.hidden = true;
  attachmentNotice = createElement('div', 'chat-composer__notice');
  attachmentNotice.hidden = true;
  slashMenu = createElement('div', 'chat-slash-menu');
  slashMenu.hidden = true;
  slashMenu.setAttribute('role', 'listbox');
  slashMenu.setAttribute('aria-label', strings.slash.label);
  slashScroller = createElement('div', 'chat-slash-menu__scroller');
  slashMenu.append(slashScroller);
  attachCustomScrollbar(slashMenu, slashScroller, { top: 6, bottom: 6, right: 4, minThumb: 24 });
  diagPanel = createDiagnosticPanel(strings);
  composer.append(
    projectPill,
    fileDiffPanel,
    attachmentsEl,
    attachmentNotice,
    composerField,
    composerFooter,
    slashMenu,
  );
  welcomeWrap = createElement('div', 'chat-welcome');

  // ── Live date/time pill ──────────────────────────────────────────────────
  const datetimePill = createElement('div', 'chat-datetime-pill');
  const _dtDayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const _dtMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  function _updateDatetimePill() {
    const _now = new Date();
    const _rawH = _now.getHours();
    const _h = String(_rawH % 12 || 12);
    const _m = String(_now.getMinutes()).padStart(2, '0');
    const _ampm = _rawH < 12 ? 'AM' : 'PM';
    datetimePill.textContent = `${_dtDayNames[_now.getDay()]} ${_now.getDate()} ${_dtMonthNames[_now.getMonth()]}  ·  ${_h}:${_m} ${_ampm}`;
  }
  _updateDatetimePill();
  setInterval(_updateDatetimePill, 1000);

  welcomeWrap.append(datetimePill, title, bubblesEl);
  if (techFeedEl) welcomeWrap.append(techFeedEl);
  scroll.append(welcomeWrap, thread);
  scrollToBottomBtn = createElement('button', 'chat-scroll-to-bottom-btn');
  scrollToBottomBtn.type = 'button';
  scrollToBottomBtn.setAttribute('aria-label', strings.composer.scrollToBottom);
  scrollToBottomBtn.append(createIcon('chevronDown', 'chat-scroll-to-bottom-btn__icon'));
  scrollToBottomBtn.addEventListener('click', () => {
    userScrolledUp = false;
    if (scroll) scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
    syncScrollToBottomBtn();
  });
  bottom.append(scrollToBottomBtn, composer);

  const browserPreview = createBrowserPreviewPanel(strings.browserPreview, {
    onVisibilityChange: (visible) => {
      isBrowserOpen = visible;
      view.classList.toggle('chat-view--browser-preview', visible);
      // Keep the composer browser button active state in sync.
      if (browserBtn) {
        browserBtn.classList.toggle('chat-composer__icon-button--active', visible);
      }
    },
    onHistoryChange: (open) => {
      view.classList.toggle('chat-view--browser-history', open);
    },
  });

  terminalPanel = createChatTerminalPanel(strings, {
    onOpenChange: (open) => {
      view.classList.toggle('chat-view--terminal', open);
      syncComposer();
    },
  });
  const privateBtn = createElement('button', 'chat-private-btn');
  privateBtn.type = 'button';
  privateBtn.setAttribute('aria-label', strings.composer.privateToggle);
  privateBtn.setAttribute('aria-pressed', 'false');
  const privateBtnIcon = document.createElement('img');
  privateBtnIcon.src = payload.privateIconUrl ?? '';
  privateBtnIcon.alt = '';
  privateBtnIcon.draggable = false;
  privateBtnIcon.className = 'chat-private-btn__icon';
  privateBtn.append(privateBtnIcon);
  const originalGreeting = greeting;
  privateBtn.addEventListener('click', () => {
    isPrivate = !isPrivate;
    privateBtn.classList.toggle('chat-private-btn--active', isPrivate);
    privateBtn.setAttribute('aria-pressed', String(isPrivate));
    if (title && messages.length === 0) {
      if (isPrivate) {
        title.textContent = getPrivateGreeting(firstName).replace(/\s(\S+\s*)$/, '\u00A0$1');
      } else {
        title.textContent = originalGreeting;
      }
    }
    if (isPrivate) {
      cancelScheduledMemorySync();
    } else {
      scheduleMemorySync(12000);
    }
  });

  const leaderboardBtn = createElement('button', 'chat-leaderboard-btn');
  leaderboardBtn.type = 'button';
  leaderboardBtn.setAttribute('aria-label', 'Leaderboard');
  const leaderboardBtnIcon = document.createElement('img');
  leaderboardBtnIcon.src = payload.trophyUrl ?? '';
  leaderboardBtnIcon.alt = '';
  leaderboardBtnIcon.draggable = false;
  leaderboardBtnIcon.className = 'chat-leaderboard-btn__icon';
  leaderboardBtn.append(leaderboardBtnIcon);
  leaderboardBtn.addEventListener('click', () => {
    void onNavigate?.('leaderboard');
  });

  view.append(
    scrollWrap,
    bottom,
    browserPreview.element,
    terminalPanel.build(),
    privateBtn,
    leaderboardBtn,
  );
  track = createElement('div', 'chat-thread-track');
  track.hidden = true;
  trackLabel = createElement('div', 'chat-thread-track__label');
  trackLabel.hidden = true;
  track.append(trackLabel);
  view.append(track, dropOverlay);
  scroll.addEventListener('scroll', () => updateTrackActive(), { passive: true });
  scroll.addEventListener(
    'scroll',
    () => {
      userScrolledUp = !isNearBottom();
      syncScrollToBottomBtn();
    },
    { passive: true },
  );
  browserPreview.start();
  wireTerminalProcessCards();
  fileDiffTracker = createFileDiffTracker({
    panel: fileDiffPanel,
    getWorkspaceRoot: () =>
      collapseWhitespace(activeProject?.folderPath ?? activeProject?.rootPath),
  });
  fileDiffTracker.init();

  // ── Open markdown links in the live browser ───────────────────────────────
  view.addEventListener('jo:open-url', (event) => {
    const url = event.detail?.url;
    if (!url || url === '#') return;
    void invokeIpc('browser-preview:load-url', url).catch(() => {});
  });

  // ── File drag-and-drop (chat page only) ───────────────────────────────────
  // Scoped entirely to the chat view element so drag events from other Shell
  // pages never trigger this overlay. Uses a counter to handle the fact that
  // dragenter/dragleave fire on every child element crossing.
  let dropDragCounter = 0;

  function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  function syncDropOverlayLabel() {
    const allowImages = activeModel?.inputs?.image === true;
    const labelEl = dropOverlay.querySelector('.chat-drop-overlay__label');
    const hintEl = dropOverlay.querySelector('.chat-drop-overlay__hint');
    if (labelEl) {
      labelEl.textContent = allowImages ? strings.dropZone.labelWithImages : strings.dropZone.label;
    }
    if (hintEl) {
      hintEl.textContent = allowImages ? strings.dropZone.hintWithImages : strings.dropZone.hint;
    }
  }

  view.addEventListener('dragenter', (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dropDragCounter += 1;
    if (dropDragCounter === 1) {
      syncDropOverlayLabel();
      dropOverlay.classList.add('chat-drop-overlay--visible');
    }
  });

  view.addEventListener('dragover', (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  view.addEventListener('dragleave', (event) => {
    if (!isFileDrag(event)) return;
    dropDragCounter -= 1;
    if (dropDragCounter <= 0) {
      dropDragCounter = 0;
      dropOverlay.classList.remove('chat-drop-overlay--visible');
    }
  });

  view.addEventListener('drop', (event) => {
    event.preventDefault();
    dropDragCounter = 0;
    dropOverlay.classList.remove('chat-drop-overlay--visible');
    if (isSending) return;

    const files = Array.from(event.dataTransfer?.files ?? []);
    const filePaths = files.map((file) => window.Joanium.getPathForFile(file)).filter(Boolean);
    if (filePaths.length === 0) return;

    const allowImages = activeModel?.inputs?.image === true;

    invokeIpc('chat:process-dropped-files', { filePaths, allowImages })
      .then((result) => {
        applyAttachmentResult(result);
        focusComposer();
      })
      .catch((error) => {
        showAttachmentNotice(
          formatText(strings.composer.attachmentFailed, {
            message: error?.message ?? String(error),
          }),
          'warning',
        );
        focusComposer();
      });
  });

  document.addEventListener('click', (event) => {
    if (!projectPill?.contains(event.target)) {
      closeGitActionMenu();
    }
  });

  applyActiveProject(activeProject);
  syncComposer();
  renderThread();

  // ── React to default-model changes made in App Settings ──────────────────
  // When the user saves a new default model, update the active provider/model
  // and the composer button label so the UI stays in sync without requiring a
  // full reload. The flag is kept for future policy decisions around in-chat picks.
  function applyDefaultModelFromSettings(settings) {
    const dm = settings?.defaultModel;
    const dmProvider = dm?.providerId
      ? (payload.providers.find((p) => p.id === dm.providerId) ?? null)
      : null;
    const dmModel = dmProvider?.models?.find((m) => m.id === dm?.modelId) ?? null;

    if (dmProvider && dmModel) {
      activeProvider = dmProvider;
      activeModel = dmModel;
      activeModelLabel = dmModel.name ?? dmModel.id;
    } else {
      // Default model was cleared or is no longer available — fall back.
      activeProvider = getPreferredProvider(payload);
      activeModel = activeProvider?.models?.[0] ?? null;
      activeModelLabel =
        activeModel?.name ?? activeProvider?.featuredModels?.[0] ?? strings.composer.modelFallback;
    }

    // Sync the composer button label and provider icon.
    const labelEl = modelButton?.querySelector('.chat-composer__model-label');
    if (labelEl) labelEl.textContent = activeModelLabel;
    const providerIconEl = modelButton?.querySelector('.chat-composer__model-provider-icon');
    if (providerIconEl) {
      providerIconEl.src = activeProvider?.iconPath ?? '';
      providerIconEl.hidden = !activeProvider?.iconPath;
    }
  }

  window.addEventListener(EVENTS.APP_SETTINGS_CHANGED, (event) => {
    currentAppSettings = event.detail ?? currentAppSettings;
    applyDefaultModelFromSettings(event.detail);
    if (currentAppSettings?.autoMemoryUpdates === false) {
      cancelScheduledMemorySync();
    } else {
      scheduleMemorySync(12000);
    }

    // Create feed element on first enable if it was never created.
    if (currentAppSettings?.showTechFeed !== false && !techFeedEl) {
      const techFeedPanel = createTechFeedPanel(strings.techFeed, payload.user?.usageModes ?? []);
      techFeedEl = techFeedPanel.element;
      if (welcomeWrap) welcomeWrap.append(techFeedEl);
    }

    // Sync feed visibility immediately — no refresh required.
    if (techFeedEl) {
      const feedEnabled = currentAppSettings?.showTechFeed !== false;
      const feedVisible = feedEnabled && messages.length === 0;
      techFeedEl.hidden = !feedVisible;
      techFeedEl.style.display = feedVisible ? '' : 'none';
    }
    if (welcomeWrap) {
      welcomeWrap.classList.toggle(
        'chat-welcome--no-feed',
        currentAppSettings?.showTechFeed === false,
      );
    }
    syncComposer();
  });

  // Manual memory sync trigger fired from AppSettingsPanel when auto-update is off.
  window.addEventListener(EVENTS.TRIGGER_MEMORY_SYNC, () => {
    void processPendingMemorySyncs({ force: true });
  });

  scheduleMemorySync(18000);

  // ── What's New overlay (shown once after update) ───────────────────────
  void (async () => {
    try {
      const whatsNewData = await invokeIpc('whats-new:get');
      if (!whatsNewData?.shouldShow) return;

      const whatsNewOverlay = createWhatsNewOverlay({
        strings,
        version: whatsNewData.version,
        imagePath: whatsNewData.imagePath || '',
        entries: whatsNewData.entries ?? [],
        onDismiss() {
          void invokeIpc('whats-new:mark-seen', whatsNewData.version).catch(() => {});
        },
      });
      view.append(whatsNewOverlay);
    } catch {
      // Non-fatal — the overlay is a nice-to-have.
    }
  })();

  return {
    element: view,
    clearConversation,
    focusComposer,
    loadSession,
    setActiveProject: applyActiveProject,
    setActivePersona(persona) {
      activePersona = persona ?? null;
    },
    getCurrentSessionId() {
      return sessionId;
    },
    // Called by ShellApp when the user navigates away from chat — detaches the
    // native BrowserView so it doesn't paint over other panels.
    pauseBrowserPreview() {
      browserPreview.pause();
    },
    // Called by ShellApp when the user returns to chat — re-syncs the native
    // BrowserView bounds so it reappears in the correct position.
    resumeBrowserPreview() {
      browserPreview.resume();
    },
  };
}
