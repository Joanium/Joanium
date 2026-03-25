function extractBase64(dataUrl) {
  return String(dataUrl ?? '').split(',', 2)[1] ?? '';
}

function normalizeMessage(msg) {
  return {
    role: msg?.role ?? 'user',
    content: String(msg?.content ?? ''),
    attachments: Array.isArray(msg?.attachments)
      ? msg.attachments.filter(a => (a?.type === 'image' || a?.type === 'file') && (typeof a.dataUrl === 'string' || typeof a.textContent === 'string'))
      : [],
  };
}

function embedFileAttachments(messages) {
  return messages.map(m => {
    const fileAttachments = m.attachments ? m.attachments.filter(a => a.type === 'file') : [];
    const imageAttachments = m.attachments ? m.attachments.filter(a => a.type === 'image') : [];

    let newContent = String(m.content || '');
    for (const f of fileAttachments) {
      newContent += `\n\nFile: ${f.name}\n\`\`\`\n${f.textContent}\n\`\`\``;
    }

    return {
      ...m,
      content: newContent,
      attachments: imageAttachments
    };
  });
}

function buildAnthropicContent(msg) {
  const blocks = [];
  if (msg.content) blocks.push({ type: 'text', text: msg.content });
  msg.attachments.forEach(a => blocks.push({
    type: 'image',
    source: { type: 'base64', media_type: a.mimeType || 'image/png', data: extractBase64(a.dataUrl) },
  }));
  if (blocks.length === 1 && blocks[0].type === 'text') return msg.content;
  return blocks;
}

function buildGoogleParts(msg) {
  const parts = [];
  if (msg.content) parts.push({ text: msg.content });
  msg.attachments.forEach(a => parts.push({
    inlineData: { mimeType: a.mimeType || 'image/png', data: extractBase64(a.dataUrl) },
  }));
  return parts;
}

function buildOpenAIContent(msg) {
  if (!msg.attachments.length) return msg.content;
  const parts = [];
  if (msg.content) parts.push({ type: 'text', text: msg.content });
  msg.attachments.forEach(a => parts.push({ type: 'image_url', image_url: { url: a.dataUrl } }));
  return parts;
}

/* ══════════════════════════════════════════
   TOOL FORMAT CONVERTERS
══════════════════════════════════════════ */

function toAnthropicTools(tools) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(t.parameters).map(([key, p]) => [
          key,
          { type: p.type, description: p.description },
        ])
      ),
      required: Object.entries(t.parameters)
        .filter(([, p]) => p.required)
        .map(([k]) => k),
    },
  }));
}

function toOpenAITools(tools) {
  return tools.map(t => ({
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
          ])
        ),
        required: Object.entries(t.parameters)
          .filter(([, p]) => p.required)
          .map(([k]) => k),
      },
    },
  }));
}

function toGoogleTools(tools) {
  return [{
    functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([key, p]) => [
            key,
            { type: p.type.toUpperCase(), description: p.description },
          ])
        ),
        required: Object.entries(t.parameters)
          .filter(([, p]) => p.required)
          .map(([k]) => k),
      },
    })),
  }];
}

/* ══════════════════════════════════════════
   RETRY HELPERS
══════════════════════════════════════════ */

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
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err.noRetry) throw err;
      // Don't retry AbortErrors
      if (err.name === 'AbortError') throw err;
      if (!isTransientError(err) || attempt >= maxAttempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 300;
      console.warn(
        `[AIProvider] Retry ${attempt + 1}/${maxAttempts - 1} in ${Math.round(delay)}ms — ${err.message}`,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/* ══════════════════════════════════════════
   SSE PARSER
══════════════════════════════════════════ */

async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;
        if (payload) yield payload;
      }
    }
    if (buffer.startsWith('data: ')) {
      const payload = buffer.slice(6).trim();
      if (payload && payload !== '[DONE]') yield payload;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

/* ══════════════════════════════════════════
   STREAMING FETCH — WITH NATIVE TOOL CALLING
   signal param allows external AbortController
   to cancel the fetch mid-stream.
══════════════════════════════════════════ */
export async function fetchStreamingWithTools(
  provider,
  modelId,
  messages,
  sysPrompt = '',
  tools = [],
  onToken = null,
  signal = null,
) {
  const { provider: providerId, endpoint, api, auth_header, auth_prefix = '' } = provider;
  const _history = messages.slice(-20).map(normalizeMessage);
  const history = embedFileAttachments(_history);

  /* ── Anthropic ── */
  if (providerId === 'anthropic') {
    const maxTokens = provider.models?.[modelId]?.max_output ?? 4096;
    const body = {
      model: modelId,
      max_tokens: maxTokens,
      stream: true,
      messages: history.map(m => ({ role: m.role, content: buildAnthropicContent(m) })),
    };
    if (sysPrompt) body.system = sysPrompt;
    if (tools.length) body.tools = toAnthropicTools(tools);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': api,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
    }

    let fullText = '';
    let toolName = null;
    let toolId = null;
    let toolInputJson = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const raw of parseSSE(res)) {
      let ev;
      try { ev = JSON.parse(raw); } catch { continue; }

      switch (ev.type) {
        case 'message_start':
          inputTokens = ev.message?.usage?.input_tokens ?? 0;
          break;

        case 'content_block_start':
          if (ev.content_block?.type === 'tool_use') {
            toolName = ev.content_block.name;
            toolId = ev.content_block.id;
            toolInputJson = '';
          }
          break;

        case 'content_block_delta': {
          const d = ev.delta;
          if (d?.type === 'text_delta' && d.text) {
            fullText += d.text;
            onToken?.(d.text);
          } else if (d?.type === 'input_json_delta') {
            toolInputJson += d.partial_json ?? '';
          }
          break;
        }

        case 'message_delta':
          outputTokens = ev.usage?.output_tokens ?? 0;
          break;
      }
    }

    const usage = { inputTokens, outputTokens };
    if (toolName) {
      let params = {};
      try { params = JSON.parse(toolInputJson); } catch { /* malformed JSON */ }
      return { type: 'tool_call', name: toolName, params, callId: toolId, usage };
    }
    return { type: 'text', text: fullText || '(empty response)', usage };
  }

  /* ── Google Gemini ── */
  if (providerId === 'google') {
    const streamUrl = endpoint
      .replace('{model}', modelId)
      .replace(':generateContent', ':streamGenerateContent') +
      `?key=${api}&alt=sse`;

    const body = {
      contents: history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: buildGoogleParts(m),
      })),
    };
    if (sysPrompt) body.systemInstruction = { parts: [{ text: sysPrompt }] };
    if (tools.length) body.tools = toGoogleTools(tools);

    const res = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
    }

    let fullText = '';
    let fnCall = null;
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const raw of parseSSE(res)) {
      let ev;
      try { ev = JSON.parse(raw); } catch { continue; }

      const part = ev.candidates?.[0]?.content?.parts?.[0];
      if (part?.text) {
        fullText += part.text;
        onToken?.(part.text);
      } else if (part?.functionCall && !fnCall) {
        fnCall = part.functionCall;
      }
      if (ev.usageMetadata) {
        inputTokens = ev.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = ev.usageMetadata.candidatesTokenCount ?? outputTokens;
      }
    }

    const usage = { inputTokens, outputTokens };
    if (fnCall) {
      return {
        type: 'tool_call',
        name: fnCall.name,
        params: fnCall.args ?? {},
        callId: null,
        usage,
      };
    }
    return { type: 'text', text: fullText || '(empty response)', usage };
  }

  /* ── OpenAI / OpenRouter / Mistral ── */
  const openAIMessages = [
    ...(sysPrompt ? [{ role: 'system', content: sysPrompt }] : []),
    ...history.map(m => ({ role: m.role, content: buildOpenAIContent(m) })),
  ];

  const maxTokens = provider.models?.[modelId]?.max_output ?? 4096;
  const body = {
    model: modelId,
    max_tokens: maxTokens,
    messages: openAIMessages,
    stream: true,
  };
  if (providerId === 'openai') {
    body.stream_options = { include_usage: true };
  }
  if (tools.length) {
    body.tools = toOpenAITools(tools);
    body.tool_choice = 'auto';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [auth_header]: `${auth_prefix}${api}`,
      ...(providerId === 'openrouter'
        ? { 'HTTP-Referer': 'https://romelson.app', 'X-Title': 'Evelina' }
        : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message ?? `HTTP ${res.status}`);
  }

  let fullText = '';
  let toolName = null;
  let toolId = null;
  let toolArgsJson = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const raw of parseSSE(res)) {
    let ev;
    try { ev = JSON.parse(raw); } catch { continue; }

    if (ev.usage) {
      inputTokens = ev.usage.prompt_tokens ?? inputTokens;
      outputTokens = ev.usage.completion_tokens ?? outputTokens;
    }

    const delta = ev.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      fullText += delta.content;
      onToken?.(delta.content);
    }

    const tc = delta.tool_calls?.[0];
    if (tc) {
      if (tc.id) toolId = tc.id;
      if (tc.function?.name) toolName = tc.function.name;
      if (tc.function?.arguments) toolArgsJson += tc.function.arguments;
    }
  }

  const usage = { inputTokens, outputTokens };
  if (toolName) {
    let params = {};
    try { params = JSON.parse(toolArgsJson); } catch { /* malformed */ }
    return { type: 'tool_call', name: toolName, params, callId: toolId, usage };
  }
  return { type: 'text', text: fullText || '(empty response)', usage };
}

/* ══════════════════════════════════════════
   NON-STREAMING FETCH
══════════════════════════════════════════ */
export async function fetchWithTools(provider, modelId, messages, sysPrompt = '', tools = []) {
  const { provider: providerId, endpoint, api, auth_header, auth_prefix = '' } = provider;
  const _history = messages.slice(-20).map(normalizeMessage);
  const history = embedFileAttachments(_history);

  /* ── Anthropic ── */
  if (providerId === 'anthropic') {
    const maxTokens = provider.models?.[modelId]?.max_output ?? 4096;
    const body = {
      model: modelId,
      max_tokens: maxTokens,
      messages: history.map(m => ({ role: m.role, content: buildAnthropicContent(m) })),
    };
    if (sysPrompt) body.system = sysPrompt;
    if (tools.length) body.tools = toAnthropicTools(tools);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': api,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }

    const data = await res.json();
    const usage = {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };

    const toolUseBlock = data.content?.find(b => b.type === 'tool_use');
    if (toolUseBlock) {
      return {
        type: 'tool_call',
        name: toolUseBlock.name,
        params: toolUseBlock.input ?? {},
        callId: toolUseBlock.id,
        usage,
      };
    }
    return { type: 'text', text: data.content?.find(b => b.type === 'text')?.text ?? '(empty response)', usage };
  }

  /* ── Google Gemini ── */
  if (providerId === 'google') {
    const url = endpoint.replace('{model}', modelId) + `?key=${api}`;
    const body = {
      contents: history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: buildGoogleParts(m),
      })),
    };
    if (sysPrompt) body.systemInstruction = { parts: [{ text: sysPrompt }] };
    if (tools.length) body.tools = toGoogleTools(tools);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }

    const data = await res.json();
    const usage = {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
    const part = data.candidates?.[0]?.content?.parts?.[0];

    if (part?.functionCall) {
      return {
        type: 'tool_call',
        name: part.functionCall.name,
        params: part.functionCall.args ?? {},
        callId: null,
        usage,
      };
    }
    return { type: 'text', text: part?.text ?? '(empty response)', usage };
  }

  /* ── OpenAI / OpenRouter / Mistral ── */
  const openAIMessages = [
    ...(sysPrompt ? [{ role: 'system', content: sysPrompt }] : []),
    ...history.map(m => ({ role: m.role, content: buildOpenAIContent(m) })),
  ];

  const maxTokensNS = provider.models?.[modelId]?.max_output ?? 4096;
  const body = { model: modelId, max_tokens: maxTokensNS, messages: openAIMessages };
  if (tools.length) {
    body.tools = toOpenAITools(tools);
    body.tool_choice = 'auto';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [auth_header]: `${auth_prefix}${api}`,
      ...(providerId === 'openrouter'
        ? { 'HTTP-Referer': 'https://romelson.app', 'X-Title': 'Evelina' }
        : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }

  const data = await res.json();
  const usage = {
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
  const message = data.choices?.[0]?.message;

  if (message?.tool_calls?.length) {
    const tc = message.tool_calls[0];
    return {
      type: 'tool_call',
      name: tc.function.name,
      params: JSON.parse(tc.function.arguments ?? '{}'),
      callId: tc.id,
      usage,
    };
  }
  return { type: 'text', text: message?.content ?? '(empty response)', usage };
}
