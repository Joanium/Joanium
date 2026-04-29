import { callModel } from './ModelInvoker.js';

const MAX_JOBS = 5;
const DEFAULT_TRIGGER = { type: 'daily', time: '09:00' };
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const VALID_TRIGGER_TYPES = new Set(['on_startup', 'interval', 'hourly', 'daily', 'weekly']);
const BUILTIN_DATA_SOURCES = [
  {
    value: 'rss_feed',
    label: 'RSS / Atom Feed',
    group: 'Web & Feeds',
    params: [
      { key: 'url', label: 'Feed URL', type: 'url', required: true },
      { key: 'maxResults', label: 'Max items', type: 'number', min: 1, max: 30, defaultValue: 10 },
    ],
  },
  {
    value: 'reddit_posts',
    label: 'Reddit - Subreddit posts',
    group: 'Web & Feeds',
    params: [
      { key: 'subreddit', label: 'Subreddit', type: 'text', required: true },
      {
        key: 'sort',
        label: 'Sort',
        type: 'select',
        options: ['hot', 'new', 'top', 'rising'],
        defaultValue: 'hot',
      },
      { key: 'maxResults', label: 'Max posts', type: 'number', min: 1, max: 25, defaultValue: 10 },
    ],
  },
  {
    value: 'hacker_news',
    label: 'Hacker News - Top stories',
    group: 'Web & Feeds',
    params: [
      { key: 'count', label: 'Stories', type: 'number', min: 3, max: 20, defaultValue: 10 },
      {
        key: 'hnType',
        label: 'Feed type',
        type: 'select',
        options: ['top', 'new', 'best', 'ask'],
        defaultValue: 'top',
      },
    ],
  },
  {
    value: 'fetch_url',
    label: 'Fetch URL - Any web page',
    group: 'Web & Feeds',
    params: [{ key: 'url', label: 'URL', type: 'url', required: true }],
  },
  {
    value: 'weather',
    label: 'Weather - Current conditions',
    group: 'System & Data',
    params: [
      { key: 'location', label: 'Location', type: 'text', required: true },
      {
        key: 'units',
        label: 'Units',
        type: 'select',
        options: ['celsius', 'fahrenheit'],
        defaultValue: 'celsius',
      },
    ],
  },
  {
    value: 'crypto_price',
    label: 'Crypto - Live prices',
    group: 'System & Data',
    params: [{ key: 'coins', label: 'Coins', type: 'text' }],
  },
  {
    value: 'system_stats',
    label: 'System Stats - CPU / Memory',
    group: 'System & Data',
    params: [],
  },
  {
    value: 'read_file',
    label: 'Read File - Local file',
    group: 'System & Data',
    params: [{ key: 'filePath', label: 'File path', type: 'text', required: true }],
  },
  {
    value: 'custom_context',
    label: 'Custom - Provide context directly',
    group: 'Other',
    params: [{ key: 'context', label: 'Context', type: 'textarea' }],
  },
];
const BUILTIN_OUTPUT_TYPES = [
  {
    value: 'send_email',
    label: 'Send email via Gmail',
    group: 'Messaging',
    params: [
      { key: 'to', label: 'Recipient email', type: 'email', required: true },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'cc', label: 'CC', type: 'email' },
      { key: 'bcc', label: 'BCC', type: 'email' },
    ],
  },
  {
    value: 'send_notification',
    label: 'Desktop notification',
    group: 'Messaging',
    params: [
      { key: 'title', label: 'Notification title', type: 'text' },
      { key: 'clickUrl', label: 'Click URL', type: 'url' },
    ],
  },
  {
    value: 'write_file',
    label: 'Write to a file',
    group: 'Files',
    params: [
      { key: 'filePath', label: 'File path', type: 'text', required: true },
      { key: 'append', label: 'Append', type: 'checkbox', defaultValue: false },
    ],
  },
  { value: 'append_to_memory', label: 'Append to AI Memory', group: 'AI', params: [] },
  {
    value: 'http_webhook',
    label: 'HTTP webhook / POST',
    group: 'Webhooks',
    params: [
      { key: 'url', label: 'Webhook URL', type: 'url', required: true },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        options: ['POST', 'GET'],
        defaultValue: 'POST',
      },
    ],
  },
];
const KEYWORD_HINTS = {
  email: ['gmail', 'send_email'],
  inbox: ['gmail_inbox'],
  unread: ['gmail_inbox'],
  gmail: ['gmail'],
  github: ['github'],
  repo: ['github_repos', 'github_repo_stats'],
  repository: ['github_repos', 'github_repo_stats'],
  pr: ['github_prs', 'github_pr_review'],
  pull: ['github_prs', 'github_pr_review'],
  review: ['github_prs', 'github_pr_review'],
  issue: ['github_issues'],
  issues: ['github_issues'],
  workflow: ['github_workflow_runs'],
  release: ['github_releases'],
  weather: ['weather'],
  forecast: ['weather'],
  crypto: ['crypto_price'],
  bitcoin: ['crypto_price'],
  ethereum: ['crypto_price'],
  rss: ['rss_feed'],
  feed: ['rss_feed'],
  news: ['rss_feed', 'hacker_news'],
  reddit: ['reddit_posts'],
  hn: ['hacker_news'],
  hacker: ['hacker_news'],
  website: ['fetch_url'],
  url: ['fetch_url'],
  site: ['fetch_url'],
  file: ['read_file'],
  notion: ['notion'],
  jira: ['jira'],
  linear: ['linear'],
  vercel: ['vercel'],
  netlify: ['netlify'],
  sentry: ['sentry'],
  stripe: ['stripe'],
  spotify: ['spotify'],
  figma: ['figma'],
  drive: ['drive'],
  docs: ['docs'],
  document: ['docs'],
  sheet: ['sheets'],
  sheets: ['sheets'],
};
const DAY_NAME_MAP = {
  monday: 'monday',
  mon: 'monday',
  tuesday: 'tuesday',
  tue: 'tuesday',
  tues: 'tuesday',
  wednesday: 'wednesday',
  wed: 'wednesday',
  thursday: 'thursday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  friday: 'friday',
  fri: 'friday',
  saturday: 'saturday',
  sat: 'saturday',
  sunday: 'sunday',
  sun: 'sunday',
};

function uniqueByValue(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const value = String(item?.value ?? '').trim();
    return !(!value || seen.has(value) || (seen.add(value), 0));
  });
}

function sanitizeText(value, fallback = '') {
  return String(value ?? fallback)
    .replace(/\s+/g, ' ')
    .trim();
}

function createNameFromPrompt(prompt = '') {
  const normalized = sanitizeText(prompt);
  if (!normalized) return 'New Automation';
  const clipped = normalized.replace(/[.?!].*$/, '');
  return clipped.length <= 60 ? clipped : `${clipped.slice(0, 57).trim()}...`;
}

function normalizeTimeString(value, fallback = '09:00') {
  const raw = sanitizeText(value);
  if (/^\d{2}:\d{2}$/.test(raw)) {
    const [hour, minute] = raw.split(':').map((part) => parseInt(part, 10));
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return raw;
  }
  const match = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return fallback;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2] ?? '0', 10);
  const meridiem = match[3].toLowerCase();
  if ('pm' === meridiem && hour < 12) hour += 12;
  if ('am' === meridiem && 12 === hour) hour = 0;
  return `${String(Math.max(0, Math.min(hour, 23))).padStart(2, '0')}:${String(Math.max(0, Math.min(minute, 59))).padStart(2, '0')}`;
}

function normalizeTrigger(trigger = {}) {
  const type = VALID_TRIGGER_TYPES.has(trigger?.type) ? trigger.type : DEFAULT_TRIGGER.type;
  if ('interval' === type)
    return { type: 'interval', minutes: Math.max(1, parseInt(trigger.minutes, 10) || 30) };
  if ('daily' === type)
    return { type: 'daily', time: normalizeTimeString(trigger.time, DEFAULT_TRIGGER.time) };
  if ('weekly' === type)
    return {
      type: 'weekly',
      day: DAY_NAME_MAP[String(trigger.day ?? '').toLowerCase()] ?? 'monday',
      time: normalizeTimeString(trigger.time, DEFAULT_TRIGGER.time),
    };
  if ('hourly' === type || 'on_startup' === type) return { type: type };
  return { ...DEFAULT_TRIGGER };
}

function normalizePrimitive(value, type, fallback = undefined) {
  if ('checkbox' === type) return Boolean(value);
  if ('number' === type) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if ('textarea' === type) return String(value ?? fallback ?? '');
  return sanitizeText(value, fallback ?? '');
}

function sanitizeByDefinition(raw = {}, definition = null) {
  const result = {};
  for (const param of definition?.params ?? []) {
    const rawValue = raw?.[param.key];
    const normalized = normalizePrimitive(rawValue, param.type ?? 'text', param.defaultValue);
    if ('number' === param.type) {
      if (Number.isFinite(normalized)) {
        const bounded =
          null != param.min || null != param.max
            ? Math.max(param.min ?? normalized, Math.min(param.max ?? normalized, normalized))
            : normalized;
        result[param.key] = bounded;
      }
      continue;
    }
    if ('checkbox' === param.type) {
      result[param.key] = normalized;
      continue;
    }
    if (normalized || param.required || null != param.defaultValue) result[param.key] = normalized;
  }
  return result;
}

function parseJsonObject(text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('Empty draft response');
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1]?.trim() || trimmed;
  try {
    return JSON.parse(candidate);
  } catch {}
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Draft response was not valid JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

function collectQueryTokens(prompt = '') {
  return Array.from(
    new Set(
      sanitizeText(prompt)
        .toLowerCase()
        .split(/[^a-z0-9_./:-]+/)
        .filter((token) => token && token.length > 1),
    ),
  );
}

function getBootCatalog(featureRegistry) {
  const automations = featureRegistry?.getBootPayload?.()?.automations ?? {};
  return {
    dataSources: Array.isArray(automations.dataSources) ? automations.dataSources : [],
    outputTypes: Array.isArray(automations.outputTypes) ? automations.outputTypes : [],
  };
}

function getCatalog(featureRegistry) {
  const bootCatalog = getBootCatalog(featureRegistry);
  return {
    dataSources: uniqueByValue([...BUILTIN_DATA_SOURCES, ...bootCatalog.dataSources]),
    outputTypes: uniqueByValue([...BUILTIN_OUTPUT_TYPES, ...bootCatalog.outputTypes]),
  };
}

function getConnectorNameMap(featureRegistry) {
  const map = new Map();
  for (const feature of featureRegistry?.features ?? [])
    for (const connector of feature.connectors?.services ?? [])
      connector?.id && map.set(connector.id, connector.name ?? connector.id);
  return map;
}

function resolveConnectorIds(featureRegistry, featureId, seen = new Set()) {
  if (!featureId || seen.has(featureId)) return [];
  seen.add(featureId);
  const feature = featureRegistry?.getFeature?.(featureId);
  if (!feature) return [];
  const ownConnectors = (feature.connectors?.services ?? [])
    .map((connector) => connector.id)
    .filter(Boolean);
  if (ownConnectors.length) return ownConnectors;
  return Array.from(
    new Set(
      (feature.dependsOn ?? []).flatMap((dependencyId) =>
        resolveConnectorIds(featureRegistry, dependencyId, seen),
      ),
    ),
  );
}

function enrichDefinition(definition, featureRegistry, connectorEngine, connectorNameMap) {
  const connectorIds = definition?.featureId
      ? resolveConnectorIds(featureRegistry, definition.featureId)
      : [],
    connectorNames = connectorIds.map(
      (connectorId) => connectorNameMap.get(connectorId) ?? connectorId,
    );
  return {
    ...definition,
    connectorIds: connectorIds,
    connectorNames: connectorNames,
    connectorsReady: connectorIds.every((connectorId) =>
      connectorEngine?.isConnected?.(connectorId),
    ),
  };
}

function rankDefinition(definition, tokens = []) {
  const haystack = [
    definition?.value,
    definition?.label,
    definition?.group,
    definition?.featureId,
    ...(definition?.connectorNames ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return tokens.reduce((score, token) => {
    let nextScore = score;
    if (haystack.includes(token)) nextScore += 4;
    for (const hint of KEYWORD_HINTS[token] ?? [])
      if (haystack.includes(hint.toLowerCase())) nextScore += 6;
    return nextScore;
  }, 0);
}

function pickRelevantDefinitions(definitions, prompt, { includeBuiltins = true, limit = 18 } = {}) {
  const tokens = collectQueryTokens(prompt),
    builtins = definitions.filter((definition) => !definition.featureId),
    scored = definitions
      .map((definition) => ({ definition, score: rankDefinition(definition, tokens) }))
      .filter((entry) => entry.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.definition.label.localeCompare(right.definition.label),
      )
      .map((entry) => entry.definition);
  return uniqueByValue([
    ...(includeBuiltins ? builtins : []),
    ...scored.slice(0, Math.max(0, limit - (includeBuiltins ? builtins.length : 0))),
  ]).slice(0, limit);
}

function formatDefinitionForPrompt(definition) {
  const params = (definition?.params ?? [])
    .map(
      (param) => `${param.key}:${param.type ?? 'text'}:${param.required ? 'required' : 'optional'}`,
    )
    .join(', ');
  const connectorText = definition?.connectorNames?.length
    ? ` | connectors: ${definition.connectorNames.join(', ')} (${definition.connectorsReady ? 'connected' : 'not connected'})`
    : '';
  return `- ${definition.value} | ${definition.label} | ${definition.group}${connectorText}${params ? ` | params: ${params}` : ''}`;
}

function buildGenerationPrompt({
  prompt,
  catalog,
  preferredModel,
  featureRegistry,
  connectorEngine,
}) {
  const connectorNameMap = getConnectorNameMap(featureRegistry),
    enrichedSources = catalog.dataSources.map((definition) =>
      enrichDefinition(definition, featureRegistry, connectorEngine, connectorNameMap),
    ),
    enrichedOutputs = catalog.outputTypes.map((definition) =>
      enrichDefinition(definition, featureRegistry, connectorEngine, connectorNameMap),
    ),
    sourceOptions = pickRelevantDefinitions(enrichedSources, prompt, {
      includeBuiltins: true,
      limit: 20,
    }),
    outputOptions = pickRelevantDefinitions(enrichedOutputs, prompt, {
      includeBuiltins: true,
      limit: 12,
    }),
    preferredModelLine = preferredModel
      ? `Preferred model: ${preferredModel.provider}/${preferredModel.modelId}. Use it exactly in primaryModel.`
      : 'Preferred model: none selected. Set primaryModel to null.';
  return {
    systemPrompt: [
      'You convert plain-English requests into Joanium automation drafts.',
      'Return valid JSON only. No markdown. No explanations outside the JSON.',
      'Create a draft the user can review before saving.',
      'Schema:',
      '{"name":"string","description":"string","primaryModel":{"provider":"string","modelId":"string"}|null,"jobs":[{"name":"string","trigger":{"type":"on_startup|interval|hourly|daily|weekly","minutes?":number,"time?":"HH:MM","day?":"monday|tuesday|wednesday|thursday|friday|saturday|sunday"},"dataSources":[{"type":"string","otherParams":"..."}],"instruction":"string","output":{"type":"string","otherParams":"..."}}],"notes":["string"]}',
      'Rules:',
      '- Maximum 5 jobs.',
      '- Use only the allowed data source and output types.',
      '- If the user requests weekdays, it is acceptable to create one weekly job per weekday.',
      '- Leave unknown required params as empty strings and mention them in notes.',
      '- Do not invent fake file paths, repository names, URLs, or email addresses.',
      '- Keep instructions concise but actionable.',
      '- Prefer practical, normal-user-friendly setups over clever ones.',
    ].join('\n'),
    userMessage: [
      preferredModelLine,
      '',
      'Allowed data sources:',
      sourceOptions.map(formatDefinitionForPrompt).join('\n'),
      '',
      'Allowed outputs:',
      outputOptions.map(formatDefinitionForPrompt).join('\n'),
      '',
      'User request:',
      prompt,
    ].join('\n'),
  };
}

function parseRepository(prompt = '') {
  const match = String(prompt).match(/\b([a-z0-9_.-]+)\/([a-z0-9_.-]+)\b/i);
  return match ? { owner: match[1], repo: match[2] } : { owner: '', repo: '' };
}

function parseEmail(prompt = '') {
  return String(prompt).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
}

function parseUrl(prompt = '') {
  return String(prompt).match(/https?:\/\/[^\s)]+/i)?.[0] ?? '';
}

function parseWindowsOrUnixPath(prompt = '') {
  const text = String(prompt);
  return (
    text.match(/[A-Za-z]:\\[^\s"']+/)?.[0] ??
    text.match(/\/(?:Users|home|var|tmp|etc|opt|srv|mnt|Volumes)\/[^\s"']+/)?.[0] ??
    ''
  );
}

function parseTimeFromPrompt(prompt = '') {
  const time24 = String(prompt).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time24) return `${String(parseInt(time24[1], 10)).padStart(2, '0')}:${time24[2]}`;
  return normalizeTimeString(prompt, DEFAULT_TRIGGER.time);
}

function parseExplicitDay(prompt = '') {
  const lower = String(prompt).toLowerCase();
  for (const [token, day] of Object.entries(DAY_NAME_MAP)) if (lower.includes(token)) return day;
  return null;
}

function buildWeekdayJobs(baseJob) {
  return WEEK_DAYS.map((day) => ({
    ...baseJob,
    name: `${baseJob.name} (${day[0].toUpperCase()}${day.slice(1)})`,
    trigger: {
      type: 'weekly',
      day: day,
      time: normalizeTimeString(baseJob.trigger?.time, DEFAULT_TRIGGER.time),
    },
  }));
}

function heuristicDraftFromPrompt(prompt = '', preferredModel = null) {
  const lower = String(prompt).toLowerCase(),
    email = parseEmail(prompt),
    url = parseUrl(prompt),
    repo = parseRepository(prompt),
    filePath = parseWindowsOrUnixPath(prompt),
    time = parseTimeFromPrompt(prompt),
    explicitDay = parseExplicitDay(prompt);
  let trigger = { ...DEFAULT_TRIGGER, time: time };
  const notes = [];
  if (/startup|start up|when .*opens|when .*launches|on launch/i.test(prompt))
    trigger = { type: 'on_startup' };
  else {
    const intervalMatch = prompt.match(
      /\bevery\s+(\d{1,4})\s*(minute|minutes|min|hour|hours|hr|hrs)\b/i,
    );
    if (intervalMatch) {
      const amount = parseInt(intervalMatch[1], 10);
      const unit = intervalMatch[2].toLowerCase();
      trigger = {
        type: 'interval',
        minutes: unit.startsWith('hour') || 'hr' === unit || 'hrs' === unit ? amount * 60 : amount,
      };
    } else if (/hourly|every hour/.test(lower)) trigger = { type: 'hourly' };
    else if (/weekday|weekdays|monday to friday/.test(lower))
      trigger = { type: 'weekly', day: 'monday', time: time };
    else if (explicitDay) trigger = { type: 'weekly', day: explicitDay, time: time };
  }
  let dataSource = { type: 'custom_context', context: prompt };
  if (lower.includes('gmail') || lower.includes('inbox') || lower.includes('unread email'))
    dataSource = /\bfrom:|\bsubject:|\blabel:/i.test(prompt)
      ? {
          type: 'gmail_search',
          query: prompt.match(/(from:[^\s]+.*)$/i)?.[1]?.trim() ?? '',
          maxResults: 10,
        }
      : { type: 'gmail_inbox', maxResults: 20 };
  else if (lower.includes('github') || lower.includes('pull request') || /\bprs?\b/.test(lower))
    dataSource = lower.includes('issue')
      ? { type: 'github_issues', owner: repo.owner, repo: repo.repo, state: 'open', maxResults: 20 }
      : lower.includes('workflow')
        ? {
            type: 'github_workflow_runs',
            owner: repo.owner,
            repo: repo.repo,
            branch: '',
            event: '',
            maxResults: 20,
          }
        : lower.includes('release')
          ? { type: 'github_releases', owner: repo.owner, repo: repo.repo, maxResults: 10 }
          : lower.includes('notification')
            ? { type: 'github_notifications' }
            : {
                type: 'github_prs',
                owner: repo.owner,
                repo: repo.repo,
                state: 'open',
                maxResults: 20,
              };
  else if (lower.includes('weather') || lower.includes('forecast'))
    dataSource = {
      type: 'weather',
      location: prompt.match(/\b(?:for|in)\s+([A-Za-z][A-Za-z\s,-]{1,40})/i)?.[1]?.trim() ?? '',
      units: /fahrenheit/.test(lower) ? 'fahrenheit' : 'celsius',
    };
  else if (lower.includes('rss') || lower.includes('feed'))
    dataSource = { type: 'rss_feed', url: url, maxResults: 10 };
  else if (lower.includes('reddit')) {
    const subreddit =
      prompt.match(/\br\/([A-Za-z0-9_]+)/i)?.[1] ??
      prompt.match(/\bsubreddit\s+([A-Za-z0-9_]+)/i)?.[1] ??
      '';
    dataSource = { type: 'reddit_posts', subreddit: subreddit, sort: 'hot', maxResults: 10 };
  } else if (lower.includes('hacker news') || /\bhn\b/.test(lower))
    dataSource = { type: 'hacker_news', count: 10, hnType: 'top' };
  else if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('ethereum'))
    dataSource = { type: 'crypto_price', coins: 'bitcoin,ethereum' };
  else if (
    lower.includes('cpu') ||
    lower.includes('memory') ||
    lower.includes('ram') ||
    lower.includes('system stats')
  )
    dataSource = { type: 'system_stats' };
  else if (filePath) dataSource = { type: 'read_file', filePath: filePath };
  else if (url) dataSource = { type: 'fetch_url', url: url };
  let output = { type: 'send_notification', title: '' };
  if (lower.includes('email me') || lower.includes('send me an email') || lower.includes('mail me'))
    output = { type: 'send_email', to: email, subject: '' };
  else if (lower.includes('webhook') || lower.includes('post to'))
    output = { type: 'http_webhook', url: url, method: 'POST' };
  else if (
    lower.includes('write to file') ||
    lower.includes('save to file') ||
    lower.includes('log to')
  )
    output = { type: 'write_file', filePath: filePath, append: true };
  else if (lower.includes('remember') || lower.includes('memory'))
    output = { type: 'append_to_memory' };
  const job = {
    name: dataSource.type.startsWith('gmail')
      ? 'Inbox Brief'
      : dataSource.type.startsWith('github')
        ? 'GitHub Check'
        : dataSource.type,
    trigger: trigger,
    dataSources: [dataSource],
    instruction: dataSource.type.startsWith('gmail')
      ? 'Summarize the important emails, highlight urgent items, and tell me what needs action first.'
      : dataSource.type.startsWith('github')
        ? 'Summarize what changed, call out blockers, and tell me what needs my attention first.'
        : dataSource.type === 'weather'
          ? 'Give a practical weather briefing, including what I should know or do.'
          : `Follow this user request carefully: ${sanitizeText(prompt)}`,
    output: output,
  };
  if ('weekly' === trigger.type && /weekday|weekdays|monday to friday/.test(lower)) {
    notes.push('This request mentioned weekdays, so review the generated schedule before saving.');
    return {
      name: createNameFromPrompt(prompt),
      description: `Generated from: ${sanitizeText(prompt)}`,
      primaryModel: preferredModel,
      jobs: buildWeekdayJobs(job).slice(0, MAX_JOBS),
      notes: notes,
    };
  }
  return {
    name: createNameFromPrompt(prompt),
    description: `Generated from: ${sanitizeText(prompt)}`,
    primaryModel: preferredModel,
    jobs: [job],
    notes: notes,
  };
}

function buildCatalogMaps(catalog) {
  return {
    sourceDefinitions: new Map(
      catalog.dataSources.map((definition) => [definition.value, definition]),
    ),
    outputDefinitions: new Map(
      catalog.outputTypes.map((definition) => [definition.value, definition]),
    ),
  };
}

function normalizeDraftJob(job, catalogMaps, userPrompt) {
  const sourceDefinitions = catalogMaps.sourceDefinitions,
    outputDefinitions = catalogMaps.outputDefinitions;
  let dataSources = Array.isArray(job?.dataSources) ? job.dataSources : [];
  dataSources = dataSources
    .map((source) => {
      const definition = sourceDefinitions.get(source?.type);
      if (!definition) return null;
      return { type: definition.value, ...sanitizeByDefinition(source, definition) };
    })
    .filter(Boolean);
  if (!dataSources.length)
    dataSources = [{ type: 'custom_context', context: sanitizeText(userPrompt) }];
  const outputDefinition = outputDefinitions.get(job?.output?.type),
    output = outputDefinition
      ? { type: outputDefinition.value, ...sanitizeByDefinition(job.output, outputDefinition) }
      : { type: 'send_notification' };
  return {
    name: sanitizeText(job?.name),
    enabled: !1 !== job?.enabled,
    trigger: normalizeTrigger(job?.trigger),
    dataSources: dataSources,
    instruction:
      sanitizeText(job?.instruction) ||
      `Follow this user request carefully: ${sanitizeText(userPrompt)}`,
    output: output,
  };
}

function collectMissingParams(job, catalogMaps) {
  const notes = [];
  job.dataSources.forEach((source) => {
    const definition = catalogMaps.sourceDefinitions.get(source.type),
      missing = (definition?.params ?? [])
        .filter((param) => param.required && !sanitizeText(source?.[param.key]))
        .map((param) => param.label ?? param.key);
    missing.length &&
      notes.push(`${definition?.label ?? source.type} still needs ${missing.join(', ')}.`);
  });
  const outputDefinition = catalogMaps.outputDefinitions.get(job.output?.type),
    outputMissing = (outputDefinition?.params ?? [])
      .filter((param) => param.required && !sanitizeText(job.output?.[param.key]))
      .map((param) => param.label ?? param.key);
  outputMissing.length &&
    notes.push(
      `${outputDefinition?.label ?? job.output?.type} still needs ${outputMissing.join(', ')}.`,
    );
  return notes;
}

function collectConnectorWarnings(jobs, catalog, featureRegistry, connectorEngine) {
  const connectorNameMap = getConnectorNameMap(featureRegistry),
    definitionMap = new Map(
      [...catalog.dataSources, ...catalog.outputTypes].map((definition) => [
        definition.value,
        definition,
      ]),
    ),
    warnings = new Set();
  jobs.forEach((job) => {
    const definitions = [
      ...job.dataSources.map((source) => definitionMap.get(source.type)).filter(Boolean),
      definitionMap.get(job.output?.type),
    ].filter(Boolean);
    definitions.forEach((definition) => {
      resolveConnectorIds(featureRegistry, definition.featureId)
        .filter((connectorId) => !connectorEngine?.isConnected?.(connectorId))
        .map((connectorId) => connectorNameMap.get(connectorId) ?? connectorId)
        .forEach((name) => warnings.add(`Connect ${name} before this draft can run.`));
    });
  });
  return [...warnings];
}

function sanitizeDraft(
  rawDraft,
  { prompt, preferredModel, catalog, featureRegistry, connectorEngine },
) {
  const catalogMaps = buildCatalogMaps(catalog),
    normalizedJobs = (Array.isArray(rawDraft?.jobs) ? rawDraft.jobs : [])
      .slice(0, MAX_JOBS)
      .map((job) => normalizeDraftJob(job, catalogMaps, prompt));
  if (!normalizedJobs.length)
    normalizedJobs.push(
      ...heuristicDraftFromPrompt(prompt, preferredModel).jobs.map((job) =>
        normalizeDraftJob(job, catalogMaps, prompt),
      ),
    );
  const normalized = {
      name: sanitizeText(rawDraft?.name) || createNameFromPrompt(prompt),
      description: sanitizeText(rawDraft?.description) || `Generated from: ${sanitizeText(prompt)}`,
      primaryModel:
        preferredModel?.provider && preferredModel?.modelId
          ? { provider: preferredModel.provider, modelId: preferredModel.modelId }
          : rawDraft?.primaryModel?.provider && rawDraft?.primaryModel?.modelId
            ? {
                provider: sanitizeText(rawDraft.primaryModel.provider),
                modelId: sanitizeText(rawDraft.primaryModel.modelId),
              }
            : null,
      jobs: normalizedJobs,
      notes: Array.isArray(rawDraft?.notes)
        ? rawDraft.notes.map((note) => sanitizeText(note)).filter(Boolean)
        : [],
    },
    deterministicNotes = new Set(normalized.notes);
  normalized.jobs.forEach((job) =>
    collectMissingParams(job, catalogMaps).forEach((note) => deterministicNotes.add(note)),
  );
  collectConnectorWarnings(normalized.jobs, catalog, featureRegistry, connectorEngine).forEach(
    (note) => deterministicNotes.add(note),
  );
  normalized.primaryModel ||
    deterministicNotes.add('Choose a primary model before saving this automation.');
  normalized.notes = [...deterministicNotes];
  return normalized;
}

async function selectPreferredModel(userService, preferredModel = null) {
  const providers = (await userService.readModelsWithKeys?.()) ?? [],
    user = userService.readUser?.() ?? {},
    candidates = [];
  const pushCandidate = (providerId, modelId, reason = '') => {
    if (!providerId || !modelId) return;
    const provider = providers.find((item) => item.provider === providerId && item.configured);
    if (!provider?.models?.[modelId]) return;
    candidates.push({
      provider: provider.provider,
      modelId: modelId,
      providerName: provider.label ?? provider.provider,
      modelName: provider.models?.[modelId]?.name ?? modelId,
      reason: reason,
    });
  };
  preferredModel?.provider &&
    preferredModel?.modelId &&
    pushCandidate(preferredModel.provider, preferredModel.modelId, 'preferred');
  user.preferences?.default_provider &&
    user.preferences?.default_model &&
    pushCandidate(user.preferences.default_provider, user.preferences.default_model, 'default');
  providers.forEach((provider) => {
    if (!provider?.configured) return;
    Object.entries(provider.models ?? {})
      .sort(
        ([leftId, leftInfo], [rightId, rightInfo]) =>
          (leftInfo?.rank ?? 999) - (rightInfo?.rank ?? 999) ||
          String(leftInfo?.name ?? leftId).localeCompare(String(rightInfo?.name ?? rightId)),
      )
      .forEach(([modelId]) => pushCandidate(provider.provider, modelId, 'fallback'));
  });
  return (
    candidates.find(
      (candidate, index) =>
        index ===
        candidates.findIndex(
          (other) => other.provider === candidate.provider && other.modelId === candidate.modelId,
        ),
    ) ?? null
  );
}

export async function generateAutomationDraft({
  prompt,
  preferredModel = null,
  featureRegistry,
  connectorEngine,
  userService,
}) {
  const trimmedPrompt = sanitizeText(prompt);
  if (!trimmedPrompt) throw new Error('Describe what you want the automation to do.');
  const catalog = getCatalog(featureRegistry),
    selectedModel = await selectPreferredModel(userService, preferredModel);
  let usedFallback = false;
  let rawDraft = null;
  if (selectedModel) {
    try {
      const providers = (await userService.readModelsWithKeys?.()) ?? [],
        providerData = providers.find((provider) => provider.provider === selectedModel.provider),
        promptParts = buildGenerationPrompt({
          prompt: trimmedPrompt,
          catalog: catalog,
          preferredModel: selectedModel,
          featureRegistry: featureRegistry,
          connectorEngine: connectorEngine,
        }),
        response = await callModel(
          providerData,
          selectedModel.modelId,
          promptParts.systemPrompt,
          promptParts.userMessage,
        );
      rawDraft = parseJsonObject(response.text);
    } catch (error) {
      usedFallback = true;
      rawDraft = heuristicDraftFromPrompt(trimmedPrompt, {
        provider: selectedModel.provider,
        modelId: selectedModel.modelId,
      });
      rawDraft.notes = [
        ...(rawDraft.notes ?? []),
        `AI drafting failed, so Joanium created a best-effort local draft instead: ${error.message}`,
      ];
    }
  } else {
    usedFallback = true;
    rawDraft = heuristicDraftFromPrompt(trimmedPrompt, null);
    rawDraft.notes = [
      ...(rawDraft.notes ?? []),
      'No configured AI model was available, so Joanium created a best-effort local draft.',
    ];
  }
  return {
    draft: sanitizeDraft(rawDraft, {
      prompt: trimmedPrompt,
      preferredModel: selectedModel
        ? { provider: selectedModel.provider, modelId: selectedModel.modelId }
        : preferredModel,
      catalog: catalog,
      featureRegistry: featureRegistry,
      connectorEngine: connectorEngine,
    }),
    usedFallback: usedFallback,
    selectedModel: selectedModel,
  };
}

export const __test__ = {
  buildWeekdayJobs,
  createNameFromPrompt,
  heuristicDraftFromPrompt,
  normalizeTimeString,
  normalizeTrigger,
  parseEmail,
  parseExplicitDay,
  parseRepository,
  parseUrl,
  parseWindowsOrUnixPath,
  sanitizeDraft,
};
