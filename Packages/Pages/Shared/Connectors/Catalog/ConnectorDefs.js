export const STATIC_CONNECTORS = [
  {
    id: 'google',
    name: 'Google Workspace',
    icon: '<img src="../../../Assets/Icons/Google.png" alt="Google" style="width: 26px; height: 26px; object-fit: contain;" />',
    description: 'Connect once with one Client ID and get access to all enabled Google services.',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
    helpText: 'Create OAuth credentials + enable APIs →',
    featureId: 'google-workspace',
    oauthType: 'google',
    connectMethod: 'oauthStart',
    connectLabel: 'Sign in with Google',
    connectingLabel: 'Opening Google sign-in...',
    serviceRefreshMethod: 'detectServices',
    subServices: [
      {
        key: 'gmail',
        icon: '<img src="../../../Assets/Icons/Gmail.png" alt="Gmail" style="width: 26px; height: 26px; object-fit: contain;" />',
        name: 'Gmail',
        apiUrl: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
      },
      {
        key: 'drive',
        icon: '<img src="../../../Assets/Icons/Drive.png" alt="Drive" style="width: 26px; height: 26px; object-fit: contain;" />',
        name: 'Google Drive',
        apiUrl: 'https://console.cloud.google.com/apis/library/drive.googleapis.com',
      },
      {
        key: 'calendar',
        icon: '<img src="../../../Assets/Icons/Calendar.png" alt="Calendar" style="width: 26px; height: 26px; object-fit: contain;" />',
        name: 'Google Calendar',
        apiUrl: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
      },
    ],
    setupSteps: [
      'Go to Google Cloud Console → Create or select a project',
      'APIs & Services → Enable: Gmail API, Google Drive API, Google Calendar API',
      'Credentials → Create OAuth 2.0 Client ID (type: Desktop app)',
      'Copy Client ID and Client Secret below',
    ],
    capabilities: [
      'Read & send Gmail in chat',
      'Browse, read, and create Drive files',
      'View and manage Calendar events',
      'All via one sign-in — no re-auth needed',
    ],
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        placeholder: 'xxxxxxxxxxxx.apps.googleusercontent.com',
        type: 'text',
        hint: 'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → Desktop app type',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        placeholder: 'GOCSPX-…',
        type: 'password',
        hint: 'Found next to your Client ID. Keep it private.',
      },
    ],
    automations: [
      {
        name: 'Morning Briefing',
        description: 'Daily — summarize emails, calendar, and Drive changes',
      },
      {
        name: 'Meeting Prep',
        description: 'Before meetings — pull agenda from Calendar + related Drive docs',
      },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '<img src="../../../Assets/Icons/Github.png" alt="Github" style="width: 26px; height: 26px; object-fit: contain;" />',
    description:
      'Browse repos, load code into chat, track issues & PRs, and monitor notifications.',
    helpUrl: 'https://github.com/settings/tokens/new?scopes=repo,read:user,notifications',
    helpText: 'Create a Personal Access Token →',
    featureId: 'github',
    oauthType: null,
    subServices: [],
    setupSteps: [],
    capabilities: [
      'Ask "load file X from owner/repo" in chat',
      'List repos, issues, and pull requests',
      'AI knows your repos via system prompt',
      'Track PRs & issues via automations',
    ],
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        placeholder: 'ghp_…',
        type: 'password',
        hint: 'Create at github.com/settings/tokens — needs: repo, read:user, notifications scopes',
      },
    ],
    automations: [
      { name: 'Daily PR Summary', description: 'Every morning — notify about open pull requests' },
      { name: 'Issue Tracker', description: 'Daily — notify about open issues in a repo' },
      {
        name: 'GitHub Notifications',
        description: 'Hourly — notify if there are unread notifications',
      },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: '<img src="../../../Assets/Icons/Gitlab.png" alt="GitLab" style="width: 26px; height: 26px; object-fit: contain;" />',
    description:
      'Browse projects, load code into chat, track issues & merge requests, and monitor notifications.',
    helpUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
    helpText: 'Create a Personal Access Token →',
    featureId: 'gitlab',
    oauthType: null,
    subServices: [],
    setupSteps: [],
    capabilities: [
      'Ask "load file X from owner/project" in chat',
      'List projects, issues, and merge requests',
      'AI knows your projects via system prompt',
      'Track MRs & issues via automations',
    ],
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        placeholder: 'glpat-…',
        type: 'password',
        hint: 'Create at gitlab.com/profile/personal_access_tokens — needs: read_api, read_repository, read_user, read_all scopes',
      },
    ],
    automations: [
      { name: 'Daily MR Summary', description: 'Every morning — notify about open merge requests' },
      { name: 'Issue Tracker', description: 'Daily — notify about open issues in a project' },
      {
        name: 'GitLab Notifications',
        description: 'Hourly — notify if there are unread notifications',
      },
    ],
  },
];
export const STATIC_FREE_CONNECTORS = [
  {
    id: 'open_meteo',
    name: 'Open-Meteo',
    icon: '<img src="../../../Assets/Icons/OpenMeteo.png" alt="OpenMeteo" style="width: 26px; height: 26px; object-fit: contain;" />',
    description:
      'Real-time weather for any city — temperature, humidity, wind, and 3-day forecast.',
    noKey: !0,
    docsUrl: 'https://open-meteo.com',
    toolHint: 'Ask: "What\'s the weather in Tokyo?"',
  },
  {
    id: 'coingecko',
    name: 'CoinGecko',
    icon: '<img src="../../../Assets/Icons/CoinGecko.png" alt="CoinGecko" style="width: 26px; height: 26px; object-fit: contain;" />',
    description:
      'Live crypto prices, market caps, 24h changes, and trending coins. 10,000+ tokens.',
    noKey: !0,
    docsUrl: 'https://coingecko.com',
    toolHint: 'Ask: "What\'s the price of Ethereum?"',
  },
  {
    id: 'exchange_rate',
    name: 'Exchange Rates',
    icon: '💱',
    description: 'Real-time currency exchange rates for 160+ currencies.',
    noKey: !0,
    docsUrl: 'https://open.er-api.com',
    toolHint: 'Ask: "Convert 100 USD to INR"',
  },
  {
    id: 'treasury',
    name: 'US Treasury',
    icon: '🏛️',
    description: 'Official US fiscal data — national debt, treasury rates, daily cash balance.',
    noKey: !0,
    docsUrl: 'https://fiscaldata.treasury.gov',
    toolHint: 'Ask: "What is the current US national debt?"',
  },
  {
    id: 'fred',
    name: 'Federal Reserve (FRED)',
    icon: '📊',
    description: 'Economic indicators — GDP, unemployment, CPI, interest rates, and hundreds more.',
    noKey: !1,
    optionalKey: !0,
    keyLabel: 'FRED API Key',
    keyPlaceholder: 'Get your free key at fred.stlouisfed.org',
    keyHint: 'Free at fred.stlouisfed.org/docs/API/api_key.html',
    docsUrl: 'https://fred.stlouisfed.org/docs/API/api_key.html',
    toolHint: 'Ask: "Show me US GDP"',
  },
  {
    id: 'openweathermap',
    name: 'OpenWeatherMap',
    icon: '<img src="../../../Assets/Icons/OpenWeatherMap.png" alt="OpenWeatherMap" style="width: 26px; height: 26px; object-fit: contain;" />',
    description: 'Detailed weather with hourly forecasts, air quality, and historical data.',
    noKey: !1,
    optionalKey: !1,
    keyLabel: 'OpenWeatherMap API Key',
    keyPlaceholder: 'openweathermap.org/api',
    keyHint: 'Free tier: 1,000 calls/day.',
    docsUrl: 'https://openweathermap.org/api',
    toolHint: 'Richer weather data when a key is provided.',
  },
  {
    id: 'unsplash',
    name: 'Unsplash',
    icon: '<img src="../../../Assets/Icons/Unsplash.png" alt="Unsplash" style="width: 26px; height: 26px; object-fit: contain;" />',
    description: 'Search millions of high-quality free photos by topic.',
    noKey: !1,
    optionalKey: !1,
    keyLabel: 'Unsplash Access Key',
    keyPlaceholder: 'unsplash.com/developers',
    keyHint: 'Free tier: 50 requests/hour.',
    docsUrl: 'https://unsplash.com/developers',
    toolHint: 'Ask: "Find me photos of minimal workspace setups"',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    icon: '<img src="../../../Assets/Icons/Wikipedia.png" alt="Wikipedia" style="width: 26px; height: 26px; object-fit: contain;" />',
    description: 'Search any topic — get summaries, descriptions, and direct links.',
    noKey: !0,
    docsUrl: 'https://en.wikipedia.org',
    toolHint: 'Ask: "Tell me about quantum computing"',
  },
  {
    id: 'ipgeo',
    name: 'IP Geolocation',
    icon: '🌍',
    description: 'Look up geolocation, ISP, and timezone info for any IP address.',
    noKey: !0,
    docsUrl: 'https://ip-api.com',
    toolHint: 'Ask: "What\'s my IP location?"',
  },
  {
    id: 'funfacts',
    name: 'Fun Facts & Trivia',
    icon: '🎲',
    description: 'Random fun facts, number trivia, math facts, and date facts.',
    noKey: !0,
    docsUrl: 'https://uselessfacts.jsph.pl',
    toolHint: 'Ask: "Give me a random fact"',
  },
  {
    id: 'jokeapi',
    name: 'Jokes',
    icon: '😂',
    description: 'Random jokes — programming, puns, misc, and more.',
    noKey: !0,
    docsUrl: 'https://v2.jokeapi.dev',
    toolHint: 'Ask: "Tell me a joke"',
  },
  {
    id: 'quotes',
    name: 'Quotes',
    icon: '💬',
    description: 'Inspirational and thought-provoking quotes.',
    noKey: !0,
    docsUrl: 'https://zenquotes.io',
    toolHint: 'Ask: "Give me an inspirational quote"',
  },
  {
    id: 'restcountries',
    name: 'Country Info',
    icon: '🌐',
    description: 'Detailed country data — capital, population, languages, currencies, and more.',
    noKey: !0,
    docsUrl: 'https://restcountries.com',
    toolHint: 'Ask: "Tell me about Japan"',
  },
  {
    id: 'nasa',
    name: 'NASA / Astronomy',
    icon: '<img src="../../../Assets/Icons/Nasa.png" alt="Nasa" style="width: 26px; height: 26px; object-fit: contain;" />',
    description: 'NASA Astronomy Picture of the Day and real-time ISS tracking.',
    noKey: !1,
    optionalKey: !0,
    keyLabel: 'NASA API Key',
    keyPlaceholder: 'api.nasa.gov',
    keyHint: 'Free key with 1,000 req/hr. Works without key (30/hr).',
    docsUrl: 'https://api.nasa.gov',
    toolHint: 'Ask: "Show me NASA\'s picture of the day"',
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    icon: '<img src="../../../Assets/Icons/HackerNews.png" alt="HackerNews" style="width: 26px; height: 26px; object-fit: contain;" />',
    description: 'Top stories from Hacker News — the leading tech and startup news aggregator.',
    noKey: !0,
    docsUrl: 'https://news.ycombinator.com',
    toolHint: 'Ask: "What\'s on Hacker News?"',
  },
  {
    id: 'cleanuri',
    name: 'URL Shortener',
    icon: '🔗',
    description: 'Shorten any long URL into a compact, shareable link.',
    noKey: !0,
    docsUrl: 'https://cleanuri.com',
    toolHint: 'Ask: "Shorten this URL: ..."',
  },
];
export let CONNECTORS = [...STATIC_CONNECTORS];
export let FREE_CONNECTORS = [...STATIC_FREE_CONNECTORS];
function dedupeById(items = []) {
  const map = new Map();
  for (const item of items) item?.id && !map.has(item.id) && map.set(item.id, item);
  return [...map.values()];
}
export async function loadFeatureConnectorDefs() {
  if (!window.featureAPI?.getBoot)
    return (
      (CONNECTORS = [...STATIC_CONNECTORS]),
      (FREE_CONNECTORS = [...STATIC_FREE_CONNECTORS]),
      { services: CONNECTORS, free: FREE_CONNECTORS }
    );
  try {
    const boot = await window.featureAPI.getBoot();
    ((CONNECTORS = dedupeById([...(boot?.connectors?.services ?? []), ...STATIC_CONNECTORS])),
      (FREE_CONNECTORS = dedupeById([
        ...(boot?.connectors?.free ?? []),
        ...STATIC_FREE_CONNECTORS,
      ])));
  } catch (error) {
    (console.warn('[ConnectorDefs] Failed to load feature connector defs:', error),
      (CONNECTORS = [...STATIC_CONNECTORS]),
      (FREE_CONNECTORS = [...STATIC_FREE_CONNECTORS]));
  }
  return { services: CONNECTORS, free: FREE_CONNECTORS };
}
