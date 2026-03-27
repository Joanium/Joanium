import { safeJson } from '../Shared/Utils.js';

const HANDLED = new Set(['search_web']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => {}) {
  if (toolName !== 'search_web') throw new Error(`SearchExecutor: unknown tool "${toolName}"`);

  const { query } = params;
  if (!query?.trim()) throw new Error('Missing required param: query');

  onStage(`🔍 Searching the web for "${query}"…`);

  // DuckDuckGo Instant Answer API — free, no key
  const data = await safeJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=0`
  );

  const lines = [`🔍 Web Search: "${query}"`, ''];

  // Abstract (direct answer)
  if (data.AbstractText) {
    lines.push(`**Answer:**`);
    lines.push(data.AbstractText);
    if (data.AbstractSource) lines.push(`Source: ${data.AbstractSource} — ${data.AbstractURL || ''}`);
    lines.push('');
  }

  // Instant answer (e.g. calculations, conversions)
  if (data.Answer && data.Answer !== data.AbstractText) {
    lines.push(`**Instant Answer:** ${data.Answer}`);
    lines.push('');
  }

  // Definition
  if (data.Definition) {
    lines.push(`**Definition:** ${data.Definition}`);
    if (data.DefinitionSource) lines.push(`Source: ${data.DefinitionSource}`);
    lines.push('');
  }

  // Infobox data (key facts)
  const infobox = data.Infobox?.content ?? [];
  if (infobox.length > 0) {
    lines.push('**Key Facts:**');
    infobox.slice(0, 8).forEach(item => {
      if (item.label && item.value) {
        lines.push(`  • ${item.label}: ${item.value}`);
      }
    });
    lines.push('');
  }

  // Related topics
  const related = (data.RelatedTopics ?? []).filter(t => t.Text && t.FirstURL);
  if (related.length > 0) {
    lines.push('**Related Topics:**');
    related.slice(0, 6).forEach((t, i) => {
      const text = t.Text.slice(0, 120) + (t.Text.length > 120 ? '…' : '');
      lines.push(`  ${i + 1}. ${text}`);
      lines.push(`     🔗 ${t.FirstURL}`);
    });
    lines.push('');
  }

  // Results (external links)
  const results = (data.Results ?? []).filter(r => r.Text && r.FirstURL);
  if (results.length > 0) {
    lines.push('**Top Results:**');
    results.slice(0, 4).forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.Text.slice(0, 100)}`);
      lines.push(`     🔗 ${r.FirstURL}`);
    });
    lines.push('');
  }

  if (lines.length <= 2) {
    lines.push(
      `No instant answer found for "${query}".`,
      '',
      `Try searching directly at: https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    );
  } else {
    lines.push(`Source: DuckDuckGo Instant Answers (duckduckgo.com)`);
  }

  return lines.join('\n');
}
