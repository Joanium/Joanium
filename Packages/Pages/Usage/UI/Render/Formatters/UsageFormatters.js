export function fmtTokens(value) {
  return value >= 1e6
    ? `${(value / 1e6).toFixed(2)}M`
    : value >= 1e3
      ? `${(value / 1e3).toFixed(1)}K`
      : String(value);
}
export function fmtCost(value) {
  return 0 === value
    ? '$0.00'
    : value < 0.001
      ? '<$0.001'
      : value < 1
        ? `$${value.toFixed(4)}`
        : `$${value.toFixed(3)}`;
}
export function fmtTime(iso) {
  const date = new Date(iso),
    diff = Date.now() - date.getTime();
  return diff < 6e4
    ? 'just now'
    : diff < 36e5
      ? `${Math.floor(diff / 6e4)}m ago`
      : diff < 864e5
        ? `${Math.floor(diff / 36e5)}h ago`
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function providerLabel(id) {
  return (
    {
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
    }[id] ?? id
  );
}
export function buildDayList(range) {
  const dayList = [];
  for (
    let offset = ('today' === range ? 1 : '7' === range ? 7 : 30) - 1;
    offset >= 0;
    offset -= 1
  ) {
    const date = new Date();
    (date.setDate(date.getDate() - offset), dayList.push(date.toISOString().slice(0, 10)));
  }
  return dayList;
}
