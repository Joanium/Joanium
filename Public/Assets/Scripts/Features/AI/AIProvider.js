// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/AI/AIProvider.js
//  All provider-specific fetch adapters.
//  Adding a new provider = add one case here, nothing else changes.
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   INTERNAL HELPERS
══════════════════════════════════════════ */
function extractBase64(dataUrl) {
  return String(dataUrl ?? '').split(',', 2)[1] ?? '';
}

function normalizeMessage(msg) {
  return {
    role:        msg?.role ?? 'user',
    content:     String(msg?.content ?? ''),
    attachments: Array.isArray(msg?.attachments)
      ? msg.attachments.filter(a => a?.type === 'image' && typeof a.dataUrl === 'string')
      : [],
  };
}

/* ── Anthropic content blocks ── */
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

/* ── Google parts ── */
function buildGoogleParts(msg) {
  const parts = [];
  if (msg.content) parts.push({ text: msg.content });
  msg.attachments.forEach(a => parts.push({
    inlineData: { mimeType: a.mimeType || 'image/png', data: extractBase64(a.dataUrl) },
  }));
  return parts;
}

/* ── OpenAI / OpenRouter content ── */
function buildOpenAIContent(msg) {
  if (!msg.attachments.length) return msg.content;
  const parts = [];
  if (msg.content) parts.push({ type: 'text', text: msg.content });
  msg.attachments.forEach(a => parts.push({ type: 'image_url', image_url: { url: a.dataUrl } }));
  return parts;
}

/* ══════════════════════════════════════════
   PUBLIC — MAIN FETCH FUNCTION
══════════════════════════════════════════ */

/**
 * Send the conversation history to the selected provider and return the reply.
 *
 * @param {object}   provider   – provider object from Models.json (with .api key)
 * @param {string}   modelId
 * @param {object[]} messages   – full conversation history
 * @param {string}   [sysPrompt]
 * @returns {Promise<string>}
 */
export async function fetchFromProvider(provider, modelId, messages, sysPrompt = '') {
  const { provider: providerId, endpoint, api, auth_header, auth_prefix = '' } = provider;

  // Keep the last 20 messages, always normalized
  const history = messages.slice(-20).map(normalizeMessage);

  /* ── Anthropic ── */
  if (providerId === 'anthropic') {
    const body = {
      model:      modelId,
      max_tokens: 2048,
      messages:   history.map(m => ({ role: m.role, content: buildAnthropicContent(m) })),
    };
    if (sysPrompt) body.system = sysPrompt;

    const res = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'content-type':        'application/json',
        'x-api-key':           api,
        'anthropic-version':   '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }
    return (await res.json()).content?.[0]?.text ?? '(empty response)';
  }

  /* ── Google Gemini ── */
  if (providerId === 'google') {
    const url  = endpoint.replace('{model}', modelId) + `?key=${api}`;
    const body = {
      contents: history.map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: buildGoogleParts(m),
      })),
    };
    if (sysPrompt) body.systemInstruction = { parts: [{ text: sysPrompt }] };

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }
    return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty response)';
  }

  /* ── OpenAI / OpenRouter (chat completions) ── */
  const openAIMessages = [
    ...(sysPrompt ? [{ role: 'system', content: sysPrompt }] : []),
    ...history.map(m => ({ role: m.role, content: buildOpenAIContent(m) })),
  ];

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'content-type': 'application/json',
      [auth_header]:  `${auth_prefix}${api}`,
      ...(providerId === 'openrouter'
        ? { 'HTTP-Referer': 'https://openworld.app', 'X-Title': 'openworld' }
        : {}),
    },
    body: JSON.stringify({ model: modelId, messages: openAIMessages }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }
  return (await res.json()).choices?.[0]?.message?.content ?? '(empty response)';
}
