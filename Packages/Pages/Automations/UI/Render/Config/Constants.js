import { getFeatureBoot } from '../../../../../Features/Core/FeatureBoot.js';

export const MAX_JOBS = 5;

export const DATA_SOURCE_TYPES = [
  { value: 'rss_feed', label: 'RSS / Atom Feed', group: 'Web & Feeds' },
  { value: 'reddit_posts', label: 'Reddit - Subreddit posts', group: 'Web & Feeds' },
  { value: 'hacker_news', label: 'Hacker News - Top stories', group: 'Web & Feeds' },
  { value: 'fetch_url', label: 'Fetch URL - Any web page', group: 'Web & Feeds' },
  { value: 'weather', label: 'Weather - Current conditions', group: 'System & Data' },
  { value: 'crypto_price', label: 'Crypto - Live prices', group: 'System & Data' },
  { value: 'system_stats', label: 'System Stats - CPU / Memory', group: 'System & Data' },
  { value: 'read_file', label: 'Read File - Local file', group: 'System & Data' },
  { value: 'custom_context', label: 'Custom - Provide context directly', group: 'Other' },
];

export const OUTPUT_TYPES = [
  { value: 'send_email', label: 'Send email via Gmail', group: 'Messaging' },
  { value: 'send_notification', label: 'Desktop notification', group: 'Messaging' },
  { value: 'write_file', label: 'Write to a file', group: 'Files' },
  { value: 'append_to_memory', label: 'Append to AI Memory', group: 'AI' },
  { value: 'http_webhook', label: 'HTTP webhook / POST', group: 'Webhooks' },
];

export const INSTRUCTION_TEMPLATES = {
  rss_feed:
    'Read these feed articles. Identify the most relevant and interesting items. Summarize key developments.',
  reddit_posts:
    'Review these posts. Identify trending topics, significant discussions, and anything worth knowing.',
  hacker_news:
    'Summarize the most relevant stories. Focus on AI, engineering, and startup news. Give a brief insight for each.',
  fetch_url: 'Read and analyze this content. Extract key information and anything actionable.',
  weather:
    'Based on current weather, provide a practical briefing: what to wear, any warnings, and how it affects plans.',
  crypto_price: 'Analyze these prices and 24h changes. Flag significant moves and note any trends.',
  system_stats:
    'Analyze these system stats. Flag any concerning resource usage and provide a brief health assessment.',
  read_file:
    'Analyze this file content. Summarize key information, patterns, and anything actionable.',
  custom_context: 'Analyze the provided information and give a thoughtful, useful response.',
};

let automationsBootLoaded = false;

export async function loadAutomationsFeatureRegistry() {
  if (automationsBootLoaded) return;
  automationsBootLoaded = true;

  try {
    const boot = await getFeatureBoot();

    const existingDataSourceValues = new Set(DATA_SOURCE_TYPES.map((item) => item.value));
    for (const item of boot?.automations?.dataSources ?? []) {
      if (!item?.value || existingDataSourceValues.has(item.value)) continue;
      DATA_SOURCE_TYPES.push(item);
      existingDataSourceValues.add(item.value);
    }

    const existingOutputValues = new Set(OUTPUT_TYPES.map((item) => item.value));
    for (const item of boot?.automations?.outputTypes ?? []) {
      if (!item?.value || existingOutputValues.has(item.value)) continue;
      OUTPUT_TYPES.push(item);
      existingOutputValues.add(item.value);
    }

    Object.assign(INSTRUCTION_TEMPLATES, boot?.automations?.instructionTemplates ?? {});
  } catch (error) {
    console.warn('[AutomationsConstants] Failed to load feature automations:', error);
  }
}
