import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { app } from 'electron';
import { readProviderCatalog } from '../../Shared/ProviderCatalog/ProviderCatalog.js';
import { createLiveModelFilter } from '../../Shared/ProviderCatalog/LiveModelFilter.js';
import {
  normalizeLocalEndpoint,
  resolveLmStudioChatEndpoint,
  resolveOllamaChatEndpoint,
} from '../../Shared/ProviderCatalog/ProviderEndpointUtils.js';
import { getResourceFileUrl, readTextResource } from '../../Shared/Storage/ResourcePaths.js';
import {
  SUB_AGENT_TERMINAL_TOOL_NAMES,
  TERMINAL_TOOL_NAMES,
} from '../../Shared/ToolLoop/TerminalToolNames.js';
import { readUserState, sanitizeDefaultModel } from '../../Shared/UserData/UserData.js';
import { collapseWhitespace } from '../../Shared/Utils/StringUtils.js';
import { orderProvidersBySelection } from '../../Shared/ProviderCatalog/ProviderUtils.js';
import { debugLog } from '../../Shared/Debug/DebugLogger.js';
import { CHAT_PROMPTS } from '../Prompts/Prompts.js';

const openAiCompatibleProviders = new Set([
  'ai21',
  'alibaba',
  'cerebras',
  'cohere',
  'deepseek',
  'fireworks',
  'google-openai',
  'githubmodels',
  'groq',
  'huggingface',
  'hyperbolic',
  'moonshot',
  'lambda',
  'lmstudio',
  'minimax',
  'mistral',
  'mulerouter',
  'nvidia',
  'novita',
  'ollama',
  'openai',
  'openrouter',
  'parasail',
  'perplexity',
  'poe',
  'requesty',
  'sambanova',
  'siliconflow',
  'stepfun',
  'together',
  'vercelaigateway',
  'writer',
  'xai',
  'zai',
]);

function createAbortError() {
  const error = new Error('Request aborted.');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

async function readSystemPromptFile(rootDirectory) {
  try {
    return await readTextResource(rootDirectory, 'Prompts', 'System.md');
  } catch {
    return '';
  }
}

async function readEnhancePromptFile(rootDirectory) {
  return readTextResource(rootDirectory, 'Prompts', 'PromptEnhance.md');
}

async function readTerminalPromptFile(rootDirectory) {
  const template = await readTextResource(rootDirectory, 'Prompts', 'Terminal.md', {
    trim: false,
  });
  return template.replace('{{TERMINAL_TOOL_NAMES}}', TERMINAL_TOOL_NAMES.join(', ')).trim();
}

async function readSubAgentPromptFile(rootDirectory) {
  return readTextResource(rootDirectory, 'Prompts', 'SubAgent.md');
}

async function readSubAgentTerminalPromptFile(rootDirectory) {
  const template = await readTextResource(rootDirectory, 'Prompts', 'SubAgentTerminal.md', {
    trim: false,
  });
  return template
    .replace('{{SUB_AGENT_TERMINAL_TOOL_NAMES}}', SUB_AGENT_TERMINAL_TOOL_NAMES.join(', '))
    .trim();
}

async function readMemoryPromptFile(rootDirectory) {
  return readTextResource(rootDirectory, 'Prompts', 'Memory.md');
}

async function readProjectContextPromptFile(rootDirectory) {
  return readTextResource(rootDirectory, 'Prompts', 'ProjectContext.md');
}

async function readGitCommitPromptFile(rootDirectory) {
  return readTextResource(rootDirectory, 'Prompts', 'GitCommit.md');
}

async function readGitCommitDiffPromptFile(rootDirectory) {
  return readTextResource(rootDirectory, 'Prompts', 'GitCommitDiff.md');
}

async function buildBaseSystemPrompt(rootDirectory, user) {
  const prompt = await readSystemPromptFile(rootDirectory);
  const now = new Date();
  const displayName = collapseWhitespace(user?.profile?.name) || os.userInfo().username || 'User';
  const locale =
    collapseWhitespace(user?.locale) || Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  let appVersion = 'unknown';
  try {
    const pkg = JSON.parse(await readFile(path.join(rootDirectory, 'package.json'), 'utf8'));
    appVersion = pkg.version ?? 'unknown';
  } catch {
    // package.json unreadable — fall back to 'unknown'
  }

  return [
    prompt || CHAT_PROMPTS.fallbackSystem,
    '# Runtime And User Info',
    `- User: ${displayName}`,
    `- Joanium version: ${appVersion} (yyyy.month-date.sub version)`,
    `- Local time: ${now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`,
    `- Timezone: ${timezone} (Do not assume this is the user's location. Multiple locations can share the same timezone, and the user's device timezone may differ from their physical location.)`,
    `- Locale: ${locale}`,
    `- Platform: ${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
    `- Home directory: ${os.homedir()}`,
  ].join('\n');
}

function sanitizeConversationMessages(candidateMessages) {
  if (!Array.isArray(candidateMessages)) {
    return [];
  }

  const cleaned = candidateMessages
    .map((message) => {
      const role = message?.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof message?.content === 'string' ? message.content.trim() : '';

      if (!content) {
        return null;
      }

      const result = { role, content };

      // Carry image attachments through so provider functions can build
      // multimodal content blocks (base64 data lives only in-memory).
      if (
        role === 'user' &&
        Array.isArray(message?.imageAttachments) &&
        message.imageAttachments.length > 0
      ) {
        result.imageAttachments = message.imageAttachments;
      }

      return result;
    })
    .filter(Boolean);

  // Enforce strict user/assistant alternation that most models require.
  // Consecutive same-role turns are merged so the model always sees a clean
  // back-and-forth, even when retries or error placeholders slipped through.
  const alternating = [];
  for (const message of cleaned) {
    const last = alternating[alternating.length - 1];
    if (last && last.role === message.role) {
      // Merge into the previous turn rather than producing an invalid sequence.
      last.content += `\n\n${message.content}`;
      if (message.imageAttachments) {
        last.imageAttachments = [...(last.imageAttachments ?? []), ...message.imageAttachments];
      }
    } else {
      alternating.push({ ...message });
    }
  }

  // Drop any leading assistant turns — some providers reject conversations
  // that don't start with a user message.
  while (alternating.length > 0 && alternating[0].role === 'assistant') {
    alternating.shift();
  }

  return alternating;
}

function resolveProviderDetails(user, provider) {
  return user?.providers?.details?.[provider.id] ?? {};
}

function resolveProviderEndpoint(provider, providerDetails, modelId) {
  const rawEndpoint =
    collapseWhitespace(providerDetails?.endpoint) || collapseWhitespace(provider.endpoint);
  const configuredEndpoint = provider.requiresApiKey
    ? rawEndpoint
    : normalizeLocalEndpoint(rawEndpoint);

  if (!configuredEndpoint) {
    return '';
  }

  if (provider.id === 'ollama') {
    return resolveOllamaChatEndpoint(configuredEndpoint);
  }

  if (provider.id === 'lmstudio') {
    return resolveLmStudioChatEndpoint(configuredEndpoint);
  }

  return modelId ? configuredEndpoint.replace('{model}', modelId) : configuredEndpoint;
}

function resolveCredential(provider, providerDetails) {
  if (!provider.requiresApiKey) {
    return '';
  }

  return collapseWhitespace(providerDetails?.apiKey);
}

function canUseProvider(user, provider) {
  const providerDetails = resolveProviderDetails(user, provider);
  const model = provider.models?.[0] ?? null;
  const endpoint = resolveProviderEndpoint(provider, providerDetails, model?.id ?? '');

  if (!endpoint) {
    return false;
  }

  if (provider.requiresApiKey && !resolveCredential(provider, providerDetails)) {
    return false;
  }

  return Boolean(model?.id);
}

function resolveActiveProvider(user, providers) {
  const orderedProviders = orderProvidersBySelection(user, providers);
  return (
    orderedProviders.find((provider) => canUseProvider(user, provider)) ??
    orderedProviders[0] ??
    null
  );
}

function extractText(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractText(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  if (typeof value.text === 'string') {
    return value.text.trim();
  }

  if (typeof value.output_text === 'string') {
    return value.output_text.trim();
  }

  if (typeof value.content === 'string') {
    return value.content.trim();
  }

  if (Array.isArray(value.content)) {
    return extractText(value.content);
  }

  if (Array.isArray(value.parts)) {
    return extractText(value.parts);
  }

  if (value.message) {
    return extractText(value.message);
  }

  return '';
}

// ---------------------------------------------------------------------------
// Node.js HTTP helper — bypasses Electron's fetch buffering entirely.
// Returns a fetch-like response: { ok, status, statusText, text(), body }.
// body is the raw Node.js IncomingMessage (async-iterable, chunk by chunk).
// ---------------------------------------------------------------------------

function nodeRequest(urlString, { method = 'POST', headers = {}, body = '', signal = null } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let parsed;

    try {
      parsed = new URL(urlString);
    } catch {
      return reject(new Error(`Invalid URL: ${urlString}`));
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const defaultPort = parsed.protocol === 'https:' ? 443 : 80;

    let responseMessage = null;
    let settled = false;
    let req = null;

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    const abortRequest = () => {
      const error = createAbortError();
      responseMessage?.destroy(error);
      req?.destroy(error);
      settle(reject, error);
    };

    req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : defaultPort,
        path: parsed.pathname + parsed.search,
        method,
        headers,
      },
      (res) => {
        responseMessage = res;
        const status = res.statusCode ?? 0;
        const statusText = res.statusMessage ?? '';

        settle(resolve, {
          status,
          statusText,
          ok: status >= 200 && status < 300,
          // Streaming: body IS the IncomingMessage (async-iterable)
          body: res,
          // Non-streaming: read everything as UTF-8 text
          text() {
            return new Promise((rs, rj) => {
              const parts = [];
              res.on('data', (chunk) => parts.push(chunk));
              res.on('end', () => rs(Buffer.concat(parts).toString('utf8')));
              res.on('error', rj);
            });
          },
        });
      },
    );

    if (signal) {
      signal.addEventListener('abort', abortRequest, { once: true });
      req.on('close', () => {
        signal.removeEventListener('abort', abortRequest);
      });
    }

    req.on('error', (error) => {
      settle(reject, signal?.aborted ? createAbortError() : error);
    });

    // Keep the TCP connection alive so routers / NATs don't silently drop long
    // streaming responses before the model finishes generating.
    // No hard idle timeout is set — thinking models, long contexts, and complex
    // agentic tasks can legitimately take a very long time. Dead sockets are
    // caught by the keep-alive probe above instead.
    req.on('socket', (socket) => {
      socket.setKeepAlive(true, 30_000);
    });

    if (body) {
      // CodeQL js/file-access-to-http: intentional and safe.
      // `body` is always the output of JSON.stringify() on a purpose-built
      // request object. File-sourced data enters only as string values inside
      // that JSON — prompt text from *.md resources and a semver string from
      // package.json. API keys are read from User.json but are placed in
      // request *headers* (Authorization / x-api-key) by the caller, never in
      // the body. No raw file bytes, file paths, or sensitive credentials are
      // written here.
      req.write(body); // codeql[js/file-access-to-http]
    }

    req.end();
  });
}

async function parseResponse(response) {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return { data: null, rawText: '' };
  }

  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: null, rawText };
  }
}

function formatProviderError(response, data, rawText) {
  const message =
    extractText(data?.error) ||
    extractText(data?.message) ||
    extractText(data?.details) ||
    rawText.trim();

  if (message) {
    return `${response.status} ${response.statusText}: ${message}`;
  }

  return `${response.status} ${response.statusText}`;
}

async function assertProviderResponse(response) {
  if (!response.ok) {
    const { data, rawText } = await parseResponse(response);
    const error = new Error(formatProviderError(response, data, rawText));
    error.statusCode = response.status;
    throw error;
  }
}

async function postJsonStream(endpoint, bodyString, headers, signal = null) {
  throwIfAborted(signal);

  const response = await nodeRequest(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'content-length': Buffer.byteLength(bodyString),
    },
    body: bodyString,
    signal,
  });

  await assertProviderResponse(response);
  return response;
}

// ---------------------------------------------------------------------------
// SSE streaming parser — reads directly from a Node.js IncomingMessage.
// Yields { event, data } for every complete SSE event.
// ---------------------------------------------------------------------------

async function* parseSSE(nodeResponse, signal = null) {
  let buffer = '';
  let eventType = 'message';
  let dataLines = [];

  for await (const rawChunk of nodeResponse) {
    throwIfAborted(signal);
    buffer += rawChunk.toString('utf8');

    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';

    for (const rawLine of parts) {
      const line = rawLine.replace(/\r$/, '');

      if (line === '') {
        if (dataLines.length > 0) {
          const payload = dataLines.join('\n');

          if (payload === '[DONE]') {
            return;
          }

          try {
            yield { event: eventType, data: JSON.parse(payload) };
          } catch {
            // Non-JSON keep-alive or comment line — skip
          }
        }

        eventType = 'message';
        dataLines = [];
      } else if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Streaming providers
// Each function reads the SSE stream and calls onChunk({ type, text }) for
// every text or thinking token that arrives.
// ---------------------------------------------------------------------------

async function streamGoogleMessage({
  endpoint,
  provider,
  providerDetails,
  messages,
  systemPrompt,
  onChunk,
  signal,
}) {
  throwIfAborted(signal);

  const apiKey = resolveCredential(provider, providerDetails);

  if (!apiKey) {
    throw new Error('Google API key is missing.');
  }

  // Swap generateContent → streamGenerateContent and request SSE format
  const streamEndpoint = endpoint.replace(':generateContent', ':streamGenerateContent');
  const streamUrl = streamEndpoint.includes('?')
    ? `${streamEndpoint}&alt=sse`
    : `${streamEndpoint}?alt=sse`;

  const googleBody = {
    contents: messages.map((message) => {
      const role = message.role === 'assistant' ? 'model' : 'user';
      if (message.role === 'assistant' || !message.imageAttachments?.length) {
        return { role, parts: [{ text: message.content }] };
      }
      const parts = [];
      if (message.content) parts.push({ text: message.content });
      for (const img of message.imageAttachments) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
      }
      return { role, parts };
    }),
    generationConfig: { temperature: 0.7 },
  };

  if (systemPrompt) {
    googleBody.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const streamBodyStr = JSON.stringify(googleBody);

  const response = await postJsonStream(
    streamUrl,
    streamBodyStr,
    {
      'content-type': 'application/json',
      [provider.authHeader]: `${provider.authPrefix ?? ''}${apiKey}`,
    },
    signal,
  );

  for await (const { data } of parseSSE(response.body, signal)) {
    if (!data || typeof data !== 'object') continue;

    const text = (data.candidates ?? [])
      .flatMap((candidate) => candidate?.content?.parts ?? [])
      .map((part) => extractText(part))
      .filter(Boolean)
      .join('');

    if (text) {
      onChunk({ type: 'text', text });
    }
  }
}

async function streamAnthropicMessage({
  endpoint,
  provider,
  providerDetails,
  model,
  messages,
  systemPrompt,
  onChunk,
  signal,
}) {
  throwIfAborted(signal);

  const apiKey = resolveCredential(provider, providerDetails);

  if (!apiKey) {
    throw new Error('Anthropic API key is missing.');
  }

  const supportsThinking = model.thinking === true;
  const thinkingBudget = model.thinking_budget ?? 8000;

  const requestBody = {
    model: model.id,
    max_tokens: Math.min(model.max_output ?? 16000, 16000),
    stream: true,
    messages: messages.map((message) => {
      if (message.role === 'assistant' || !message.imageAttachments?.length) {
        return { role: message.role, content: [{ type: 'text', text: message.content }] };
      }
      // Multimodal user turn — interleave text and image blocks.
      const content = [];
      if (message.content) content.push({ type: 'text', text: message.content });
      for (const img of message.imageAttachments) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
        });
      }
      return { role: message.role, content };
    }),
  };

  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  if (supportsThinking) {
    requestBody.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
    // thinking requires a higher temperature than 1 isn't permitted — use default
    requestBody.temperature = 1;
  }

  const streamReqBodyStr = JSON.stringify(requestBody);

  const response = await postJsonStream(
    endpoint,
    streamReqBodyStr,
    {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      [provider.authHeader]: `${provider.authPrefix ?? ''}${apiKey}`,
    },
    signal,
  );

  for await (const { data } of parseSSE(response.body, signal)) {
    if (!data || typeof data !== 'object') continue;

    if (data.type === 'content_block_delta') {
      const delta = data.delta;

      // Standard text token
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        onChunk({ type: 'text', text: delta.text });
      }

      // Extended thinking token (claude-3-7-sonnet, claude-4 with thinking enabled)
      if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        onChunk({ type: 'thinking', text: delta.thinking });
      }
    } else if (data.type === 'error') {
      throw new Error(data.error?.message ?? 'Anthropic streaming error.');
    }
  }
}

async function streamOpenAiCompatibleMessage({
  endpoint,
  provider,
  providerDetails,
  model,
  messages,
  systemPrompt,
  onChunk,
  signal,
}) {
  throwIfAborted(signal);

  const headers = { 'content-type': 'application/json' };

  if (provider.id === 'githubmodels') {
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2026-03-10';
  }

  if (provider.requiresApiKey) {
    const apiKey = resolveCredential(provider, providerDetails);

    if (!apiKey) {
      throw new Error(`${provider.label} API key is missing.`);
    }

    headers[provider.authHeader] = `${provider.authPrefix ?? ''}${apiKey}`;
  }

  const oaiMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const streamOaiBodyStr = JSON.stringify({
    model: model.id,
    messages: oaiMessages.map((message) => {
      if (message.role !== 'user' || !message.imageAttachments?.length) {
        return { role: message.role, content: message.content };
      }
      // Multimodal user turn — data-URI images in the OpenAI vision format.
      const content = [];
      if (message.content) content.push({ type: 'text', text: message.content });
      for (const img of message.imageAttachments) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }
      return { role: message.role, content };
    }),
    temperature: 0.7,
    stream: true,
  });

  const response = await postJsonStream(endpoint, streamOaiBodyStr, headers, signal);

  for await (const { data } of parseSSE(response.body, signal)) {
    if (!data || typeof data !== 'object') continue;

    const delta = data.choices?.[0]?.delta;
    if (!delta) continue;

    // Standard response text (all OpenAI-compatible providers)
    if (typeof delta.content === 'string' && delta.content) {
      onChunk({ type: 'text', text: delta.content });
    }

    // DeepSeek-R1 reasoning tokens and providers that follow the same pattern.
    // Use else-if: some providers populate both fields on the same delta; treating
    // them as mutually exclusive prevents the same thinking text being emitted twice.
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      onChunk({ type: 'thinking', text: delta.reasoning_content });
    } else if (typeof delta.reasoning === 'string' && delta.reasoning) {
      // Some providers (e.g. Qwen-QwQ via OpenRouter) use a different field name
      onChunk({ type: 'thinking', text: delta.reasoning });
    }
  }
}

// ---------------------------------------------------------------------------
// Transient-error retry wrapper
// Retries the stream up to MAX_ATTEMPTS times with exponential backoff.
// Only retries BEFORE any tokens have been emitted — once streaming has
// started we cannot replay chunks, so a mid-stream failure is surfaced
// immediately as an error.
// Retryable: 429, 500, 502, 503, 504 and network-level codes.
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 800;

const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
]);

function isRetryable(error) {
  if (!error) return false;
  if (RETRYABLE_CODES.has(error.code)) return true;
  // HTTP errors formatted as "504 Gateway Timeout: ..."
  const statusMatch = String(error.message ?? '').match(/^(\d{3})\b/);
  if (statusMatch) return RETRYABLE_HTTP.has(Number(statusMatch[1]));
  return false;
}

function delay(ms, signal = null) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abortDelay);
      resolve();
    }, ms);

    const abortDelay = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    signal?.addEventListener('abort', abortDelay, { once: true });
  });
}

async function requestChatCompletionStreamWithRetry({ user, providers, request, onChunk, signal }) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    throwIfAborted(signal);

    let tokensEmitted = false;

    const guardedChunk = (chunk) => {
      tokensEmitted = true;
      onChunk(chunk);
    };

    try {
      const result = await requestChatCompletionStream({
        user,
        providers,
        request,
        onChunk: guardedChunk,
        signal,
      });

      // If the stream ended cleanly but produced zero tokens, treat it as a
      // transient failure and retry — this is the root cause of "No response
      // received" / "Empty Response" on weaker models.
      if (!tokensEmitted && attempt < MAX_ATTEMPTS) {
        await delay(BASE_DELAY_MS * 2 ** (attempt - 1), signal);
        continue;
      }

      return result;
    } catch (error) {
      lastError = error;

      // Once tokens are streaming we cannot retry — surface immediately.
      if (tokensEmitted) throw error;

      const willRetry = !isAbortError(error) && attempt < MAX_ATTEMPTS && isRetryable(error);
      if (!willRetry) throw error;

      const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
      await delay(backoff, signal);
    }
  }

  throw lastError ?? new Error('Empty response after retries.');
}

async function requestChatCompletionStream({ user, providers, request, onChunk, signal }) {
  throwIfAborted(signal);

  const messages = sanitizeConversationMessages(request?.messages);
  const parts = [];
  if (typeof request?.baseSystemPrompt === 'string' && request.baseSystemPrompt.trim()) {
    parts.push(request.baseSystemPrompt.trim());
  }
  if (typeof request?.persona === 'string' && request.persona.trim()) {
    parts.push(request.persona.trim());
  }
  if (typeof request?.modeInstruction === 'string' && request.modeInstruction.trim()) {
    parts.push(request.modeInstruction.trim());
  }
  if (typeof user?.customInstructions === 'string' && user.customInstructions.trim()) {
    parts.push(user.customInstructions.trim());
  }
  if (typeof request?.projectInfo === 'string' && request.projectInfo.trim()) {
    parts.push(request.projectInfo.trim());
  }
  if (typeof request?.memoryContext === 'string' && request.memoryContext.trim()) {
    parts.push(request.memoryContext.trim());
  }
  if (typeof request?.terminalTools === 'string' && request.terminalTools.trim()) {
    parts.push(request.terminalTools.trim());
  }
  if (typeof request?.toolsetTools === 'string' && request.toolsetTools.trim()) {
    parts.push(request.toolsetTools.trim());
  }
  if (typeof request?.skillsContext === 'string' && request.skillsContext.trim()) {
    parts.push(request.skillsContext.trim());
  }
  if (request?.source === 'chat' && !request?.projectInfo) {
    parts.push(
      '# No Project Context' +
        '\n\n' +
        'The user has not opened a project or workspace.' +
        ' You MUST NOT create, edit, rename, move, or delete any files.' +
        ' Do not suggest opening a project or prompt the user to set one up.' +
        ' Respond as a conversational assistant only — answer questions, discuss ideas, and provide information without performing file operations.',
    );
  }

  const systemPrompt = parts.length > 0 ? parts.join('\n\n') : null;

  // Prepend a lightweight multi-turn anchor so weaker models always know
  // which message they should be responding to, even in long conversations.
  const groundedSystemPrompt = systemPrompt
    ? `${CHAT_PROMPTS.latestUserMessageAnchor}\n\n${systemPrompt}`
    : CHAT_PROMPTS.latestUserMessageAnchor;

  if (messages.length === 0) {
    throw new Error('A message is required to start the chat.');
  }

  let provider = null;
  let model = null;

  if (request?.providerId && request?.modelId) {
    const requestedProvider = providers.find((p) => p.id === request.providerId) ?? null;
    const requestedModel = requestedProvider?.models?.find((m) => m.id === request.modelId) ?? null;

    if (requestedProvider && requestedModel) {
      provider = requestedProvider;
      model = requestedModel;
    }
  }

  // Fall back to the user's chosen default model (set in Settings) before
  // blindly using the first model in the provider catalog. This ensures
  // channels, agents, and any other caller that omits providerId/modelId
  // still run on the same model the user picked in the UI.
  if (!provider) {
    const defaultModel = sanitizeDefaultModel(user?.appSettings?.defaultModel);
    if (defaultModel) {
      const defaultProvider = providers.find((p) => p.id === defaultModel.providerId) ?? null;
      const defaultModelEntry =
        defaultProvider?.models?.find((m) => m.id === defaultModel.modelId) ?? null;
      if (defaultProvider && defaultModelEntry && canUseProvider(user, defaultProvider)) {
        provider = defaultProvider;
        model = defaultModelEntry;
      }
    }
  }

  if (!provider) {
    provider = resolveActiveProvider(user, providers);
  }

  if (!provider) {
    throw new Error('No AI providers are available yet. Complete provider setup first.');
  }

  const providerDetails = resolveProviderDetails(user, provider);

  if (!model) {
    model = provider.models?.[0] ?? null;
  }

  if (!model?.id) {
    throw new Error(`No model is configured for ${provider.label}.`);
  }

  debugLog('Chat', 'Resolved chat completion request', {
    source: request?.source ?? 'chat',
    messageCount: messages.length,
    providerId: provider.id,
    modelId: model.id,
    hasProjectInfo: Boolean(request?.projectInfo),
    hasPersona: Boolean(request?.persona),
    hasModeInstruction: Boolean(request?.modeInstruction),
    memoryChars: String(request?.memoryContext ?? '').length,
    terminalToolPromptChars: String(request?.terminalTools ?? '').length,
    toolsetPromptChars: String(request?.toolsetTools ?? '').length,
  });

  const endpoint = resolveProviderEndpoint(provider, providerDetails, model.id);

  if (!endpoint) {
    throw new Error(`No endpoint is configured for ${provider.label}.`);
  }

  const meta = {
    providerId: provider.id,
    providerLabel: provider.label,
    providerIconPath: provider.iconPath ?? null,
    modelId: model.id,
    modelLabel: model.name,
  };

  // Estimate input character count across all messages + system prompt.
  const charCountIn =
    messages.reduce((sum, m) => {
      const textCount = m.content?.length ?? 0;
      const imageCount = (m.imageAttachments ?? []).reduce(
        (s, img) => s + (img.base64?.length ?? 0),
        0,
      );
      return sum + textCount + imageCount;
    }, 0) + (systemPrompt?.length ?? 0);

  // Wrap onChunk to accumulate output character count.
  let charCountOut = 0;
  const trackingChunk = (chunk) => {
    if (chunk?.type === 'text' && typeof chunk.text === 'string') {
      charCountOut += chunk.text.length;
    }
    onChunk(chunk);
  };

  if (provider.id === 'google') {
    await streamGoogleMessage({
      endpoint,
      provider,
      providerDetails,
      model,
      messages,
      systemPrompt: groundedSystemPrompt,
      onChunk: trackingChunk,
      signal,
    });
  } else if (provider.id === 'anthropic') {
    await streamAnthropicMessage({
      endpoint,
      provider,
      providerDetails,
      model,
      messages,
      systemPrompt: groundedSystemPrompt,
      onChunk: trackingChunk,
      signal,
    });
  } else if (openAiCompatibleProviders.has(provider.id)) {
    await streamOpenAiCompatibleMessage({
      endpoint,
      provider,
      providerDetails,
      model,
      messages,
      systemPrompt: groundedSystemPrompt,
      onChunk: trackingChunk,
      signal,
    });
  } else {
    throw new Error(`${provider.label} chat is not wired up yet.`);
  }

  return { ...meta, charCountIn, charCountOut };
}

export function createChatStateManager({ rootDirectory }) {
  // One filter instance per manager so the in-memory cache is shared across
  // all getBootstrapPayload() calls within the same app session.
  const liveModelFilter = createLiveModelFilter();

  async function getActiveProviders(user) {
    const providers = await readProviderCatalog(rootDirectory);
    return app.isPackaged ? liveModelFilter.filterProviders(providers, user) : providers;
  }

  return {
    async getBootstrapPayload() {
      const user = await readUserState(rootDirectory);
      const [
        providers,
        terminalPrompt,
        subAgentPrompt,
        subAgentTerminalPrompt,
        memoryPrompt,
        projectContextPrompt,
        gitCommitPrompt,
        gitCommitDiffPrompt,
      ] = await Promise.all([
        getActiveProviders(user),
        readTerminalPromptFile(rootDirectory),
        readSubAgentPromptFile(rootDirectory),
        readSubAgentTerminalPromptFile(rootDirectory),
        readMemoryPromptFile(rootDirectory).catch(() => ''),
        readProjectContextPromptFile(rootDirectory),
        readGitCommitPromptFile(rootDirectory),
        readGitCommitDiffPromptFile(rootDirectory),
      ]);

      const privateIconUrl = getResourceFileUrl(rootDirectory, 'Assets', 'App', 'Private.png');
      const trophyUrl = getResourceFileUrl(rootDirectory, 'Assets', 'App', 'Trophy.png');

      // In packaged builds the Config/Models JSONs are frozen inside the asar
      // archive and ModelSync never runs. Use the live model filter to cross-
      // reference each provider's API and remove models no longer listed.
      // In dev mode ModelSync already keeps the JSONs up-to-date on disk.
      return {
        user,
        providers,
        terminalPrompt,
        subAgentPrompt,
        subAgentTerminalPrompt,
        memoryPrompt,
        projectContextPrompt,
        gitCommitPrompt,
        gitCommitDiffPrompt,
        privateIconUrl,
        trophyUrl,
      };
    },
    // Streaming entry point — resolves once the stream ends (or rejects on error).
    // onChunk({ type: 'text'|'thinking', text }) is called for every token.
    // onDone(meta) is called when the stream completes successfully.
    // onError(error) is called if anything goes wrong.
    async streamMessage(request, { onChunk, onDone, onError }) {
      try {
        const user = await readUserState(rootDirectory);
        const providers = await getActiveProviders(user);
        const baseSystemPrompt = await buildBaseSystemPrompt(rootDirectory, user);

        const meta = await requestChatCompletionStreamWithRetry({
          user,
          providers,
          request: { ...request, baseSystemPrompt },
          onChunk,
          signal: request?.signal ?? null,
        });

        onDone(meta);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        onError(error);
      }
    },

    async completeMessage(request) {
      const user = await readUserState(rootDirectory);
      const providers = await getActiveProviders(user);
      const baseSystemPrompt = await buildBaseSystemPrompt(rootDirectory, user);

      let text = '';
      let thinking = '';
      const meta = await requestChatCompletionStreamWithRetry({
        user,
        providers,
        request: { ...request, baseSystemPrompt },
        onChunk(chunk) {
          if (chunk?.type === 'text' && chunk.text) text += chunk.text;
          if (chunk?.type === 'thinking' && chunk.text) thinking += chunk.text;
        },
        signal: request?.signal ?? null,
      });

      return { ...meta, text, thinking };
    },

    async enhancePrompt({ raw, providerId, modelId }) {
      const instruction = await readEnhancePromptFile(rootDirectory);
      const content = `${instruction}\n\n${raw}`;

      const user = await readUserState(rootDirectory);
      const providers = await getActiveProviders(user);
      const baseSystemPrompt = await buildBaseSystemPrompt(rootDirectory, user);

      let text = '';
      const meta = await requestChatCompletionStreamWithRetry({
        user,
        providers,
        request: {
          messages: [{ role: 'user', content }],
          providerId: providerId ?? null,
          modelId: modelId ?? null,
          baseSystemPrompt,
        },
        onChunk(chunk) {
          if (chunk?.type === 'text' && chunk.text) text += chunk.text;
        },
        signal: null,
      });

      return { ...meta, text: text.trim() };
    },
  };
}
