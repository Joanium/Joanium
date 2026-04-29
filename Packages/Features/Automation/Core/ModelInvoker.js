export async function callModel(providerData, modelId, systemPrompt, userMessage) {
  if (!providerData?.configured)
    throw new Error(`Provider "${providerData?.provider}" is not configured`);
  const {
      provider: pid,
      endpoint: endpoint,
      api: api,
      auth_header: authHeader,
      auth_prefix: authPrefix = '',
    } = providerData,
    apiKey = String(api ?? '').trim();
  if (!1 !== providerData.requires_api_key && !apiKey)
    throw new Error(`No API key for "${providerData?.provider}"`);
  if ('anthropic' === pid) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: providerData.models?.[modelId]?.max_output ?? 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      }),
      data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `Anthropic ${response.status}`);
    return {
      text: data.content?.find((block) => 'text' === block.type)?.text ?? '(empty)',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }
  if ('google' === pid) {
    const response = await fetch(endpoint.replace('{model}', modelId) + `?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        }),
      }),
      data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `Google ${response.status}`);
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty)',
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
  const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authHeader && apiKey ? { [authHeader]: `${authPrefix}${apiKey}` } : {}),
        ...('openrouter' === pid
          ? { 'HTTP-Referer': 'https://www.joanium.com', 'X-Title': 'Joanium' }
          : {}),
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: providerData.models?.[modelId]?.max_output ?? 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    }),
    data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `API ${response.status}`);
  return {
    text: data.choices?.[0]?.message?.content ?? '(empty)',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
