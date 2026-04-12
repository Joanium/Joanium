export let _pricing = {};
export let _records = [];
export let _range = 'today';
export function setPricing(p) {
  _pricing = p;
}
export function setRecords(r) {
  _records = r;
}
export function setRange(r) {
  _range = r;
}
export async function loadPricing() {
  try {
    const providers = (await window.electronAPI?.invoke?.('get-models')) ?? [];
    for (const provider of providers)
      for (const [modelId, info] of Object.entries(provider.models ?? {}))
        info.pricing && (_pricing[modelId] = { in: info.pricing.input, out: info.pricing.output });
  } catch (error) {
    console.warn('[Usage] Could not load model pricing:', error);
  }
}
export function tokenCost(model, inputTokens, outputTokens) {
  const pricing = _pricing[model] ?? { in: 1, out: 3 };
  return (inputTokens / 1e6) * pricing.in + (outputTokens / 1e6) * pricing.out;
}
export function sinceDate(range) {
  const now = new Date();
  if ('today' === range) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if ('7' === range) {
    const date = new Date(now);
    return (date.setDate(date.getDate() - 6), date.setHours(0, 0, 0, 0), date);
  }
  if ('30' === range) {
    const date = new Date(now);
    return (date.setDate(date.getDate() - 29), date.setHours(0, 0, 0, 0), date);
  }
  return null;
}
export function filteredRecords() {
  const since = sinceDate(_range);
  return since ? _records.filter((record) => new Date(record.timestamp) >= since) : _records;
}
export function computeStats(records) {
  let totalInput = 0,
    totalOutput = 0,
    totalCost = 0;
  const byModel = {},
    byProvider = {},
    byDay = {},
    byHour = {},
    byDow = {};
  for (const record of records) {
    const input = record.inputTokens ?? 0,
      output = record.outputTokens ?? 0,
      cost = tokenCost(record.model, input, output),
      provider = record.provider ?? 'unknown',
      day = String(record.timestamp).slice(0, 10),
      hour = new Date(record.timestamp).getHours(),
      dow = new Date(record.timestamp).getDay();
    ((totalInput += input),
      (totalOutput += output),
      (totalCost += cost),
      byModel[record.model] ||
        (byModel[record.model] = {
          name: record.modelName ?? record.model,
          input: 0,
          output: 0,
          calls: 0,
          cost: 0,
        }),
      (byModel[record.model].input += input),
      (byModel[record.model].output += output),
      (byModel[record.model].calls += 1),
      (byModel[record.model].cost += cost),
      byProvider[provider] || (byProvider[provider] = { input: 0, output: 0, calls: 0, cost: 0 }),
      (byProvider[provider].input += input),
      (byProvider[provider].output += output),
      (byProvider[provider].calls += 1),
      (byProvider[provider].cost += cost),
      byDay[day] || (byDay[day] = { input: 0, output: 0, calls: 0, cost: 0 }),
      (byDay[day].input += input),
      (byDay[day].output += output),
      (byDay[day].calls += 1),
      (byDay[day].cost += cost),
      byHour[hour] || (byHour[hour] = { calls: 0, tokens: 0 }),
      (byHour[hour].calls += 1),
      (byHour[hour].tokens += input + output),
      byDow[dow] || (byDow[dow] = { calls: 0, tokens: 0, cost: 0 }),
      (byDow[dow].calls += 1),
      (byDow[dow].tokens += input + output),
      (byDow[dow].cost += cost));
  }
  return {
    totalInput: totalInput,
    totalOutput: totalOutput,
    totalCost: totalCost,
    count: records.length,
    byModel: byModel,
    byProvider: byProvider,
    byDay: byDay,
    byHour: byHour,
    byDow: byDow,
  };
}
export async function loadRecords() {
  try {
    const result = await window.electronAPI?.invoke?.('get-usage');
    result?.ok && (_records = result.records ?? []);
  } catch (error) {
    console.error('[Usage] load error:', error);
  }
}
