export function fmtTokens(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function fmtCost(value) {
  if (value === 0) return '$0.00';
  if (value < 0.001) return '<$0.001';
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(3)}`;
}

export function fmtTime(iso) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function providerLabel(id) {
  const labels = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    openrouter: 'OpenRouter',
    mistral: 'Mistral AI',
    nvidia: 'NVIDIA',
    deepseek: 'DeepSeek',
    minimax: 'MiniMax',
    ollama: 'Ollama',
    lmstudio: 'LM Studio',
  };
  return labels[id] ?? id;
}

export function buildDayList(range) {
  const days = range === 'today' ? 1 : range === '7' ? 7 : 30;
  const dayList = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    dayList.push(date.toISOString().slice(0, 10));
  }
  return dayList;
}
