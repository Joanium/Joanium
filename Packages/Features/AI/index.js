function extractBase64(dataUrl) {
  return String(dataUrl ?? '').split(',', 2)[1] ?? '';
}
function normalizeMessage(msg) {
  return {
    role: msg?.role ?? 'user',
    content: String(msg?.content ?? ''),
    attachments: Array.isArray(msg?.attachments)
      ? msg.attachments.filter(
          (a) =>
            !(
              ('image' !== a?.type && 'file' !== a?.type) ||
              ('string' != typeof a.dataUrl && 'string' != typeof a.textContent)
            ),
        )
      : [],
  };
}
function estimateMessageSize(message) {
  return (
    String(message?.content ?? '').length +
    (Array.isArray(message?.attachments)
      ? message.attachments.reduce(
          (total, attachment) =>
            'file' !== attachment?.type
              ? total
              : total + Math.min(String(attachment?.textContent ?? '').length, 4e3),
          0,
        )
      : 0)
  );
}
function buildHistoryWindow(messages = []) {
  const normalized = messages.map(normalizeMessage),
    selected = [];
  let totalChars = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const message = normalized[index],
      estimatedSize = estimateMessageSize(message),
      wouldExceedBudget = totalChars + estimatedSize > 24e3,
      wouldExceedCount = selected.length >= 14;
    if (!(selected.length < 8) && (wouldExceedBudget || wouldExceedCount)) break;
    (selected.push(message), (totalChars += estimatedSize));
  }
  return selected.reverse();
}
function buildEmbeddedFileBlock(fileAttachment, maxChars, isRecentMessage) {
  const filename = fileAttachment?.name || 'attachment',
    rawText = String(fileAttachment?.textContent ?? '');
  if (!rawText.trim()) return `\n\nFile: ${filename}\n[file attached]`;
  if (maxChars <= 0)
    return `\n\nFile: ${filename}\n[file attached: content omitted to keep the request fast]`;
  const cappedLength = isRecentMessage ? maxChars : Math.min(maxChars, 1200);
  return `\n\nFile: ${filename}\n\`\`\`\n${rawText.length > cappedLength ? `${rawText.slice(0, cappedLength)}\n...(truncated for speed)` : rawText}\n\`\`\``;
}
function embedFileAttachments(messages) {
  let remainingAttachmentChars = 12e3;
  return messages.map((m, index) => {
    const fileAttachments = m.attachments ? m.attachments.filter((a) => 'file' === a.type) : [],
      imageAttachments = m.attachments ? m.attachments.filter((a) => 'image' === a.type) : [];
    let newContent = String(m.content || '');
    const isRecentMessage = index >= messages.length - 3;
    for (const f of fileAttachments) {
      const rawText = String(f?.textContent ?? ''),
        allowedChars = Math.min(remainingAttachmentChars, 4e3);
      ((newContent += buildEmbeddedFileBlock(f, allowedChars, isRecentMessage)),
        (remainingAttachmentChars = Math.max(
          0,
          remainingAttachmentChars - Math.min(rawText.length, allowedChars),
        )));
    }
    return { ...m, content: newContent, attachments: imageAttachments };
  });
}
function buildAnthropicContent(msg) {
  const blocks = [];
  return (
    msg.content && blocks.push({ type: 'text', text: msg.content }),
    msg.attachments.forEach((a) =>
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: a.mimeType || 'image/png',
          data: extractBase64(a.dataUrl),
        },
      }),
    ),
    1 === blocks.length && 'text' === blocks[0].type ? msg.content : blocks
  );
}
function buildGoogleParts(msg) {
  const parts = [];
  return (
    msg.content && parts.push({ text: msg.content }),
    msg.attachments.forEach((a) =>
      parts.push({
        inlineData: { mimeType: a.mimeType || 'image/png', data: extractBase64(a.dataUrl) },
      }),
    ),
    parts
  );
}
function buildOpenAIContent(msg) {
  if (!msg.attachments.length) return msg.content;
  const parts = [];
  return (
    msg.content && parts.push({ type: 'text', text: msg.content }),
    msg.attachments.forEach((a) =>
      parts.push({ type: 'image_url', image_url: { url: a.dataUrl } }),
    ),
    parts
  );
}
function buildOpenAIStyleHeaders(providerId, authHeader, authPrefix, apiKey) {
  return {
    'content-type': 'application/json',
    ...(authHeader && apiKey ? { [authHeader]: `${authPrefix}${apiKey}` } : {}),
    ...('openrouter' === providerId
      ? { 'HTTP-Referer': 'https://www.joanium.com', 'X-Title': 'Joanium' }
      : {}),
  };
}
function toAnthropicTools(tools) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(t.parameters).map(([key, p]) => [
          key,
          { type: p.type, description: p.description },
        ]),
      ),
      required: Object.entries(t.parameters)
        .filter(([, p]) => p.required)
        .map(([k]) => k),
    },
  }));
}
function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([key, p]) => [
            key,
            { type: p.type, description: p.description },
          ]),
        ),
        required: Object.entries(t.parameters)
          .filter(([, p]) => p.required)
          .map(([k]) => k),
      },
    },
  }));
}
function toGoogleTools(tools) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(t.parameters).map(([key, p]) => [
              key,
              { type: p.type.toUpperCase(), description: p.description },
            ]),
          ),
          required: Object.entries(t.parameters)
            .filter(([, p]) => p.required)
            .map(([k]) => k),
        },
      })),
    },
  ];
}
function isTransientError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('overloaded') ||
    msg.includes('rate limit') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('network')
  );
}
export async function withRetry(fn, maxAttempts = 3, baseDelayMs = 600) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++)
    try {
      return await fn();
    } catch (err) {
      if (((lastErr = err), err.noRetry)) throw err;
      if ('AbortError' === err.name) throw err;
      if (!isTransientError(err) || attempt >= maxAttempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + 300 * Math.random();
      (console.warn(
        `[AIProvider] Retry ${attempt + 1}/${maxAttempts - 1} in ${Math.round(delay)}ms — ${err.message}`,
      ),
        await new Promise((r) => setTimeout(r, delay)));
    }
  throw lastErr;
}
async function* parseSSE(response) {
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done: done, value: value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: !0 });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if ('[DONE]' === payload) return;
        payload && (yield payload);
      }
    }
    if (buffer.startsWith('data: ')) {
      const payload = buffer.slice(6).trim();
      payload && '[DONE]' !== payload && (yield payload);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}
function flattenChunkText(value) {
  return value
    ? 'string' == typeof value
      ? value
      : Array.isArray(value)
        ? value.map(flattenChunkText).filter(Boolean).join('')
        : 'object' != typeof value
          ? ''
          : 'string' == typeof value.text
            ? value.text
            : 'string' == typeof value.content
              ? value.content
              : Array.isArray(value.content)
                ? flattenChunkText(value.content)
                : Array.isArray(value.parts)
                  ? flattenChunkText(value.parts)
                  : Array.isArray(value.details)
                    ? flattenChunkText(value.details)
                    : Array.isArray(value.summary)
                      ? flattenChunkText(value.summary)
                      : ''
    : '';
}
function extractOpenAITextChunk(delta) {
  return delta
    ? 'string' == typeof delta.content
      ? delta.content
      : Array.isArray(delta.content)
        ? delta.content
            .map((part) => ('text' === part?.type ? flattenChunkText(part) : ''))
            .filter(Boolean)
            .join('')
        : ''
    : '';
}
function extractOpenAIReasoningChunk(delta) {
  return delta
    ? [
        delta.reasoning,
        delta.reasoning_content,
        delta.reasoning_details,
        delta.reasoning_summary,
        delta.thinking,
        delta.thinking_content,
        delta.summary,
      ]
        .map(flattenChunkText)
        .find(Boolean) ||
        (Array.isArray(delta.content)
          ? delta.content
              .map((part) =>
                /reasoning|thinking|summary/.test(String(part?.type ?? ''))
                  ? flattenChunkText(part)
                  : '',
              )
              .filter(Boolean)
              .join('')
          : '')
    : '';
}
function shouldRequestReasoning(provider, modelId) {
  const providerId = provider?.provider;
  if ('openrouter' !== providerId && 'minimax' !== providerId) return !1;
  if ('minimax' === providerId) return !0;
  const modelInfo = provider.models?.[modelId] ?? {},
    haystack = [modelId, modelInfo.name, modelInfo.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  return /thinking|reasoning|reasoner|o1|o3|o4|r1|k2|deepseek/.test(haystack);
}
export async function fetchStreamingWithTools(
  provider,
  modelId,
  messages,
  sysPrompt = '',
  tools = [],
  onToken = null,
  onReasoning = null,
  signal = null,
) {
  if (!provider?.configured) throw new Error('Provider is not configured.');
  const {
      provider: providerId,
      endpoint: endpoint,
      auth_header: auth_header,
      auth_prefix: auth_prefix = '',
    } = provider,
    api = String(provider.api ?? '').trim();
  if (!1 !== provider.requires_api_key && !api) throw new Error(`No API key for "${providerId}"`);
  const history = embedFileAttachments(buildHistoryWindow(messages));
  if ('anthropic' === providerId) {
    const body = {
      model: modelId,
      max_tokens: provider.models?.[modelId]?.max_output ?? 4096,
      stream: !0,
      messages: history.map((m) => ({ role: m.role, content: buildAnthropicContent(m) })),
    };
    (sysPrompt && (body.system = sysPrompt),
      tools.length && (body.tools = toAnthropicTools(tools)));
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': api,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
    }
    let fullText = '';
    const toolBlocks = new Map();
    let currentToolBlockIndex = -1,
      inputTokens = 0,
      outputTokens = 0;
    for await (const raw of parseSSE(res)) {
      let ev;
      try {
        ev = JSON.parse(raw);
      } catch {
        continue;
      }
      switch (ev.type) {
        case 'message_start':
          inputTokens = ev.message?.usage?.input_tokens ?? 0;
          break;
        case 'content_block_start':
          'tool_use' === ev.content_block?.type &&
            ((currentToolBlockIndex = ev.index ?? toolBlocks.size),
            toolBlocks.set(currentToolBlockIndex, {
              name: ev.content_block.name,
              id: ev.content_block.id,
              inputJson: '',
            }));
          break;
        case 'content_block_delta': {
          const d = ev.delta;
          if ('text_delta' === d?.type && d.text) ((fullText += d.text), onToken?.(d.text));
          else if ('thinking_delta' === d?.type && d.thinking) onReasoning?.(d.thinking);
          else if ('input_json_delta' === d?.type) {
            const blockIdx = ev.index ?? currentToolBlockIndex,
              block = toolBlocks.get(blockIdx);
            block && (block.inputJson += d.partial_json ?? '');
          }
          break;
        }
        case 'message_delta':
          outputTokens = ev.usage?.output_tokens ?? 0;
      }
    }
    const usage = { inputTokens: inputTokens, outputTokens: outputTokens },
      toolBlockList = [...toolBlocks.values()];
    if (1 === toolBlockList.length) {
      const block = toolBlockList[0];
      let params = {};
      try {
        params = JSON.parse(block.inputJson);
      } catch {}
      return {
        type: 'tool_call',
        name: block.name,
        params: params,
        callId: block.id,
        usage: usage,
      };
    }
    return toolBlockList.length > 1
      ? {
          type: 'tool_calls',
          calls: toolBlockList.map((block) => {
            let params = {};
            try {
              params = JSON.parse(block.inputJson);
            } catch {}
            return { name: block.name, params: params, callId: block.id };
          }),
          usage: usage,
        }
      : { type: 'text', text: fullText || '(empty response)', usage: usage };
  }
  if ('google' === providerId) {
    const streamUrl =
        endpoint.replace('{model}', modelId).replace(':generateContent', ':streamGenerateContent') +
        `?key=${api}&alt=sse`,
      body = {
        contents: history.map((m) => ({
          role: 'assistant' === m.role ? 'model' : 'user',
          parts: buildGoogleParts(m),
        })),
      };
    (sysPrompt && (body.systemInstruction = { parts: [{ text: sysPrompt }] }),
      tools.length && (body.tools = toGoogleTools(tools)));
    const res = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
    }
    let fullText = '';
    const fnCalls = [];
    let inputTokens = 0,
      outputTokens = 0;
    for await (const raw of parseSSE(res)) {
      let ev;
      try {
        ev = JSON.parse(raw);
      } catch {
        continue;
      }
      const parts = ev.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts)
        part.text
          ? part.thought
            ? onReasoning?.(part.text)
            : ((fullText += part.text), onToken?.(part.text))
          : part.functionCall && fnCalls.push(part.functionCall);
      ev.usageMetadata &&
        ((inputTokens = ev.usageMetadata.promptTokenCount ?? inputTokens),
        (outputTokens = ev.usageMetadata.candidatesTokenCount ?? outputTokens));
    }
    const usage = { inputTokens: inputTokens, outputTokens: outputTokens };
    return 1 === fnCalls.length
      ? {
          type: 'tool_call',
          name: fnCalls[0].name,
          params: fnCalls[0].args ?? {},
          callId: null,
          usage: usage,
        }
      : fnCalls.length > 1
        ? {
            type: 'tool_calls',
            calls: fnCalls.map((fc) => ({ name: fc.name, params: fc.args ?? {}, callId: null })),
            usage: usage,
          }
        : { type: 'text', text: fullText || '(empty response)', usage: usage };
  }
  const openAIMessages = [
      ...(sysPrompt ? [{ role: 'system', content: sysPrompt }] : []),
      ...history.map((m) => ({ role: m.role, content: buildOpenAIContent(m) })),
    ],
    body = {
      model: modelId,
      max_tokens: provider.models?.[modelId]?.max_output ?? 4096,
      messages: openAIMessages,
      stream: !0,
    };
  (('openai' !== providerId && 'ollama' !== providerId) ||
    (body.stream_options = { include_usage: !0 }),
    shouldRequestReasoning(provider, modelId) &&
      ('minimax' === providerId ? (body.reasoning_split = !0) : (body.include_reasoning = !0)),
    tools.length && ((body.tools = toOpenAITools(tools)), (body.tool_choice = 'auto')));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildOpenAIStyleHeaders(providerId, auth_header, auth_prefix, api),
    body: JSON.stringify(body),
    signal: signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
  }
  let fullText = '';
  const toolCallsMap = new Map();
  let inputTokens = 0,
    outputTokens = 0;
  for await (const raw of parseSSE(res)) {
    let ev;
    try {
      ev = JSON.parse(raw);
    } catch {
      continue;
    }
    ev.usage &&
      ((inputTokens = ev.usage.prompt_tokens ?? inputTokens),
      (outputTokens = ev.usage.completion_tokens ?? outputTokens));
    const delta = ev.choices?.[0]?.delta;
    if (!delta) continue;
    const reasoningChunk = extractOpenAIReasoningChunk(delta);
    reasoningChunk && onReasoning?.(reasoningChunk);
    const textChunk = extractOpenAITextChunk(delta);
    textChunk && ((fullText += textChunk), onToken?.(textChunk));
    const tcs = delta.tool_calls ?? [];
    for (const tc of tcs) {
      const idx = tc.index ?? 0;
      toolCallsMap.has(idx) || toolCallsMap.set(idx, { name: '', id: null, argsJson: '' });
      const entry = toolCallsMap.get(idx);
      (tc.id && (entry.id = tc.id),
        tc.function?.name && (entry.name = tc.function.name),
        tc.function?.arguments && (entry.argsJson += tc.function.arguments));
    }
  }
  const usage = { inputTokens: inputTokens, outputTokens: outputTokens },
    toolCallEntries = [...toolCallsMap.values()].filter((e) => e.name);
  if (1 === toolCallEntries.length) {
    const entry = toolCallEntries[0];
    let params = {};
    try {
      params = JSON.parse(entry.argsJson);
    } catch {}
    return { type: 'tool_call', name: entry.name, params: params, callId: entry.id, usage: usage };
  }
  return toolCallEntries.length > 1
    ? {
        type: 'tool_calls',
        calls: toolCallEntries.map((entry) => {
          let params = {};
          try {
            params = JSON.parse(entry.argsJson);
          } catch {}
          return { name: entry.name, params: params, callId: entry.id };
        }),
        usage: usage,
      }
    : { type: 'text', text: fullText || '(empty response)', usage: usage };
}
export async function fetchWithTools(
  provider,
  modelId,
  messages,
  sysPrompt = '',
  tools = [],
  signal = null,
) {
  if (!provider?.configured) throw new Error('Provider is not configured.');
  const {
      provider: providerId,
      endpoint: endpoint,
      auth_header: auth_header,
      auth_prefix: auth_prefix = '',
    } = provider,
    api = String(provider.api ?? '').trim();
  if (!1 !== provider.requires_api_key && !api) throw new Error(`No API key for "${providerId}"`);
  const history = embedFileAttachments(buildHistoryWindow(messages));
  if ('anthropic' === providerId) {
    const body = {
      model: modelId,
      max_tokens: provider.models?.[modelId]?.max_output ?? 4096,
      messages: history.map((m) => ({ role: m.role, content: buildAnthropicContent(m) })),
    };
    (sysPrompt && (body.system = sysPrompt),
      tools.length && (body.tools = toAnthropicTools(tools)));
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': api,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = await res.json(),
      usage = {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      toolUseBlocks = (data.content ?? []).filter((b) => 'tool_use' === b.type);
    return 1 === toolUseBlocks.length
      ? {
          type: 'tool_call',
          name: toolUseBlocks[0].name,
          params: toolUseBlocks[0].input ?? {},
          callId: toolUseBlocks[0].id,
          usage: usage,
        }
      : toolUseBlocks.length > 1
        ? {
            type: 'tool_calls',
            calls: toolUseBlocks.map((b) => ({
              name: b.name,
              params: b.input ?? {},
              callId: b.id,
            })),
            usage: usage,
          }
        : {
            type: 'text',
            text: data.content?.find((b) => 'text' === b.type)?.text ?? '(empty response)',
            usage: usage,
          };
  }
  if ('google' === providerId) {
    const url = endpoint.replace('{model}', modelId) + `?key=${api}`,
      body = {
        contents: history.map((m) => ({
          role: 'assistant' === m.role ? 'model' : 'user',
          parts: buildGoogleParts(m),
        })),
      };
    (sysPrompt && (body.systemInstruction = { parts: [{ text: sysPrompt }] }),
      tools.length && (body.tools = toGoogleTools(tools)));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
    }
    const data = await res.json(),
      usage = {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      allParts = data.candidates?.[0]?.content?.parts ?? [],
      fnParts = allParts.filter((p) => p?.functionCall);
    if (1 === fnParts.length)
      return {
        type: 'tool_call',
        name: fnParts[0].functionCall.name,
        params: fnParts[0].functionCall.args ?? {},
        callId: null,
        usage: usage,
      };
    if (fnParts.length > 1)
      return {
        type: 'tool_calls',
        calls: fnParts.map((p) => ({
          name: p.functionCall.name,
          params: p.functionCall.args ?? {},
          callId: null,
        })),
        usage: usage,
      };
    const textPart = allParts.find((p) => p?.text);
    return { type: 'text', text: textPart?.text ?? '(empty response)', usage: usage };
  }
  const openAIMessages = [
      ...(sysPrompt ? [{ role: 'system', content: sysPrompt }] : []),
      ...history.map((m) => ({ role: m.role, content: buildOpenAIContent(m) })),
    ],
    body = {
      model: modelId,
      max_tokens: provider.models?.[modelId]?.max_output ?? 4096,
      messages: openAIMessages,
    };
  (shouldRequestReasoning(provider, modelId) &&
    'minimax' === providerId &&
    (body.reasoning_split = !0),
    tools.length && ((body.tools = toOpenAITools(tools)), (body.tool_choice = 'auto')));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildOpenAIStyleHeaders(providerId, auth_header, auth_prefix, api),
    body: JSON.stringify(body),
    signal: signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json(),
    usage = {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
    message = data.choices?.[0]?.message;
  if (1 === message?.tool_calls?.length) {
    const tc = message.tool_calls[0];
    return {
      type: 'tool_call',
      name: tc.function.name,
      params: JSON.parse(tc.function.arguments ?? '{}'),
      callId: tc.id,
      usage: usage,
    };
  }
  return message?.tool_calls?.length > 1
    ? {
        type: 'tool_calls',
        calls: message.tool_calls.map((tc) => ({
          name: tc.function.name,
          params: JSON.parse(tc.function.arguments ?? '{}'),
          callId: tc.id,
        })),
        usage: usage,
      }
    : { type: 'text', text: message?.content ?? '(empty response)', usage: usage };
}
