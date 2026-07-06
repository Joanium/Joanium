import { clampInteger } from '../../../../Shared/Utils/ValueUtils.js';

const DEFAULT_HEADERS = Object.freeze({
  accept: 'application/json',
  'user-agent': 'Joanium/2026 Toolset',
});
const DEFAULT_FETCH_TIMEOUT_MS = 12000;

const WEATHER_CODES = new Map([
  [0, 'Clear sky'],
  [1, 'Mainly clear'],
  [2, 'Partly cloudy'],
  [3, 'Overcast'],
  [45, 'Fog'],
  [48, 'Depositing rime fog'],
  [51, 'Light drizzle'],
  [53, 'Moderate drizzle'],
  [55, 'Dense drizzle'],
  [61, 'Slight rain'],
  [63, 'Moderate rain'],
  [65, 'Heavy rain'],
  [71, 'Slight snow'],
  [73, 'Moderate snow'],
  [75, 'Heavy snow'],
  [80, 'Slight rain showers'],
  [81, 'Moderate rain showers'],
  [82, 'Violent rain showers'],
  [95, 'Thunderstorm'],
]);

function tool(name, description, category, parameters = {}) {
  return { name, description, category, parameters };
}

export const PUBLIC_DATA_TOOL_DEFINITIONS = [
  tool(
    'search_web',
    'Search the live web via DuckDuckGo and return real organic results (title, snippet, URL) plus an instant-answer summary when one is available. Falls back to Wikipedia and Hacker News only if live web results cannot be fetched. Use this for current events, general knowledge, or anything not covered by a more specific tool.',
    'search',
    {
      query: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', required: false, description: 'Result count, default 8, max 10.' },
    },
  ),
  tool('search_wikipedia', 'Get a Wikipedia summary for a topic.', 'wikipedia', {
    query: { type: 'string', required: true, description: 'Topic or article title.' },
  }),
  tool(
    'get_wikipedia_search_results',
    'Search Wikipedia and return matching article titles and snippets.',
    'wikipedia',
    {
      query: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool('get_wikipedia_full_article', 'Fetch plain-text Wikipedia article extract.', 'wikipedia', {
    title: { type: 'string', required: true, description: 'Article title.' },
    max_chars: {
      type: 'number',
      required: false,
      description: 'Maximum characters, default 6000.',
    },
  }),
  tool('get_wikipedia_sections', 'List section headings for a Wikipedia article.', 'wikipedia', {
    title: { type: 'string', required: true, description: 'Article title.' },
  }),
  tool(
    'get_wikipedia_random_article',
    'Fetch a random Wikipedia article summary.',
    'wikipedia',
    {},
  ),
  tool(
    'get_wikipedia_on_this_day',
    'Get Wikipedia on-this-day events for a month and day.',
    'wikipedia',
    {
      month: { type: 'number', required: false, description: 'Month 1-12. Defaults to today.' },
      day: { type: 'number', required: false, description: 'Day of month. Defaults to today.' },
      type: {
        type: 'string',
        required: false,
        description: 'all, events, births, deaths, or holidays.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool('get_definition', 'Look up English dictionary definitions and examples.', 'reference', {
    word: { type: 'string', required: true, description: 'English word to define.' },
  }),
  tool(
    'get_country_info',
    'Look up country facts including capital, population, region, languages, and currencies.',
    'reference',
    {
      country: { type: 'string', required: true, description: 'Country name or ISO country code.' },
    },
  ),
  tool('get_quote', 'Fetch a short quote, optionally by tag.', 'fun', {
    tag: { type: 'string', required: false, description: 'Optional quote tag or topic.' },
  }),
  tool('get_joke', 'Fetch a safe joke from JokeAPI.', 'fun', {
    category: {
      type: 'string',
      required: false,
      description: 'Any, Programming, Misc, Pun, Spooky, or Christmas.',
    },
  }),
  tool(
    'get_hacker_news',
    'Fetch top, new, best, ask, show, or job stories from Hacker News.',
    'news',
    {
      type: {
        type: 'string',
        required: false,
        description: 'top, new, best, ask, show, or job. Defaults to top.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'search_photos',
    'Search Wikimedia Commons for reusable images and return file links.',
    'media',
    {
      query: { type: 'string', required: true, description: 'Image search query.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 12.' },
    },
  ),
  tool('npm_search', 'Search the npm registry for packages.', 'npm', {
    query: { type: 'string', required: true, description: 'Package name or keywords.' },
    size: { type: 'number', required: false, description: 'Result count, default 5, max 10.' },
  }),
  tool('npm_package_info', 'Get npm package metadata for an exact package name.', 'npm', {
    name: { type: 'string', required: true, description: 'Exact npm package name.' },
  }),
  tool('npm_package_versions', 'List recent npm package versions and publish dates.', 'npm', {
    name: { type: 'string', required: true, description: 'Exact npm package name.' },
    limit: { type: 'number', required: false, description: 'Result count, default 15, max 30.' },
  }),
  tool('npm_package_downloads', 'Get npm package download counts for a period.', 'npm', {
    name: { type: 'string', required: true, description: 'Exact npm package name.' },
    period: {
      type: 'string',
      required: false,
      description: 'last-week, last-month, or last-year.',
    },
  }),
  tool(
    'npm_compare_packages',
    'Compare two npm packages by version, downloads, license, dependencies, and publish date.',
    'npm',
    {
      package_a: { type: 'string', required: true, description: 'First package.' },
      package_b: { type: 'string', required: true, description: 'Second package.' },
    },
  ),
  tool('stackoverflow_search', 'Search Stack Overflow questions by query.', 'stackoverflow', {
    query: { type: 'string', required: true, description: 'Question, error, or topic.' },
    count: { type: 'number', required: false, description: 'Result count, default 5, max 10.' },
  }),
  tool(
    'stackoverflow_question_answers',
    'Fetch top answers for a Stack Overflow question id.',
    'stackoverflow',
    {
      question_id: { type: 'string', required: true, description: 'Question id.' },
      count: { type: 'number', required: false, description: 'Answer count, default 3, max 5.' },
    },
  ),
  tool(
    'stackoverflow_questions_by_tag',
    'Fetch high-scoring Stack Overflow questions for a tag.',
    'stackoverflow',
    {
      tag: { type: 'string', required: true, description: 'Stack Overflow tag.' },
      count: { type: 'number', required: false, description: 'Result count, default 5, max 10.' },
    },
  ),
  tool(
    'stackoverflow_hot',
    'Fetch hot Stack Overflow questions, optionally by tag.',
    'stackoverflow',
    {
      tag: { type: 'string', required: false, description: 'Optional tag.' },
      count: { type: 'number', required: false, description: 'Result count, default 5, max 10.' },
    },
  ),
  tool(
    'stackoverflow_similar',
    'Find Stack Overflow questions similar to an error or title.',
    'stackoverflow',
    {
      title: { type: 'string', required: true, description: 'Error text or question title.' },
      count: { type: 'number', required: false, description: 'Result count, default 5, max 10.' },
    },
  ),
  tool('get_weather', 'Get current Open-Meteo weather for a city or place.', 'weather', {
    location: { type: 'string', required: true, description: 'City or place.' },
    units: { type: 'string', required: false, description: 'celsius or fahrenheit.' },
  }),
  tool('get_hourly_forecast', 'Get hourly Open-Meteo forecast for a city or place.', 'weather', {
    location: { type: 'string', required: true, description: 'City or place.' },
    units: { type: 'string', required: false, description: 'celsius or fahrenheit.' },
    hours: { type: 'number', required: false, description: 'Hours to show, default 24, max 48.' },
  }),
  tool('get_weekly_forecast', 'Get a 7-day Open-Meteo forecast for a city or place.', 'weather', {
    location: { type: 'string', required: true, description: 'City or place.' },
    units: { type: 'string', required: false, description: 'celsius or fahrenheit.' },
  }),
  tool(
    'get_air_quality',
    'Get current Open-Meteo air-quality readings for a city or place.',
    'weather',
    {
      location: { type: 'string', required: true, description: 'City or place.' },
    },
  ),
  tool(
    'get_sunrise_sunset',
    'Get sunrise, sunset, and daylight duration for the next week.',
    'weather',
    {
      location: { type: 'string', required: true, description: 'City or place.' },
    },
  ),
  tool('get_exchange_rate', 'Convert or list exchange rates using open.er-api.com.', 'finance', {
    from: { type: 'string', required: true, description: 'Source currency code.' },
    to: { type: 'string', required: false, description: 'Target currency code.' },
    amount: { type: 'number', required: false, description: 'Amount to convert, default 1.' },
  }),
  tool(
    'get_treasury_data',
    'Get official US Treasury debt, rates, or daily cash-balance data.',
    'finance',
    {
      type: {
        type: 'string',
        required: false,
        description: 'debt, rates, or balance. Defaults to debt.',
      },
      limit: { type: 'number', required: false, description: 'Rows to return, default 5, max 20.' },
    },
  ),
  tool(
    'get_fred_data',
    'Get recent Federal Reserve economic series observations from FRED graph data.',
    'finance',
    {
      series_id: {
        type: 'string',
        required: true,
        description: 'FRED series ID such as GDP, UNRATE, CPIAUCSL, FEDFUNDS, DGS10, or SP500.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Observations to return, default 5, max 25.',
      },
    },
  ),
  tool(
    'get_crypto_price',
    'Get crypto price, market cap, volume, and 24h change from CoinGecko.',
    'crypto',
    {
      coin: { type: 'string', required: true, description: 'Coin name, symbol, or id.' },
      vs_currency: { type: 'string', required: false, description: 'Currency, default usd.' },
    },
  ),
  tool('get_crypto_trending', 'Get trending coins from CoinGecko.', 'crypto', {
    limit: { type: 'number', required: false, description: 'Result count, default 7, max 15.' },
  }),
  tool('get_top_coins', 'List top crypto assets by market cap.', 'crypto', {
    vs_currency: { type: 'string', required: false, description: 'Currency, default usd.' },
    limit: { type: 'number', required: false, description: 'Result count, default 10, max 50.' },
  }),
  tool('search_crypto', 'Search CoinGecko for coins and tokens.', 'crypto', {
    query: { type: 'string', required: true, description: 'Coin search query.' },
    limit: { type: 'number', required: false, description: 'Result count, default 8, max 20.' },
  }),
  tool(
    'get_apod',
    'Fetch NASA Astronomy Picture of the Day. Uses DEMO_KEY unless api_key is provided.',
    'astronomy',
    {
      date: { type: 'string', required: false, description: 'YYYY-MM-DD date.' },
      api_key: { type: 'string', required: false, description: 'Optional NASA API key.' },
    },
  ),
  tool(
    'get_iss_location',
    'Get the current International Space Station position.',
    'astronomy',
    {},
  ),
  tool('shorten_url', 'Shorten a long URL using CleanURI.', 'url', {
    url: { type: 'string', required: true, description: 'URL to shorten.' },
  }),
  tool(
    'get_url_metadata',
    'Fetch public page title, description, image, and publisher metadata using Microlink.',
    'url',
    {
      url: { type: 'string', required: true, description: 'Public URL to inspect.' },
    },
  ),
  tool('generate_qr_code_url', 'Generate a QR-code image URL for any link.', 'url', {
    url: { type: 'string', required: true, description: 'URL to encode.' },
    size: {
      type: 'number',
      required: false,
      description: 'Square image size in pixels, default 200, max 1000.',
    },
  }),
  tool('get_whois_info', 'Retrieve RDAP registration info for a domain.', 'url', {
    domain: { type: 'string', required: true, description: 'Domain name such as example.com.' },
  }),
  tool('check_redirect_chain', 'Trace redirect hops for a URL.', 'url', {
    url: { type: 'string', required: true, description: 'URL to check.' },
    limit: {
      type: 'number',
      required: false,
      description: 'Maximum redirect hops, default 8, max 15.',
    },
  }),
  tool(
    'get_ip_info',
    'Look up geolocation and network info for an IP address, or current public IP when omitted.',
    'geo',
    {
      ip: { type: 'string', required: false, description: 'IP address to look up.' },
    },
  ),
  tool(
    'forward_geocode',
    'Convert a place name or address into coordinates using OpenStreetMap Nominatim.',
    'geo',
    {
      query: { type: 'string', required: true, description: 'Address or place name.' },
      limit: {
        type: 'number',
        required: false,
        description: 'Results to return, default 3, max 10.',
      },
    },
  ),
  tool(
    'reverse_geocode',
    'Convert latitude/longitude coordinates into an address using OpenStreetMap Nominatim.',
    'geo',
    {
      lat: { type: 'number', required: true, description: 'Latitude.' },
      lon: { type: 'number', required: true, description: 'Longitude.' },
    },
  ),
  tool(
    'search_places',
    'Search places with optional country restriction using OpenStreetMap Nominatim.',
    'geo',
    {
      query: { type: 'string', required: true, description: 'Place search query.' },
      country_code: { type: 'string', required: false, description: 'Optional ISO country code.' },
      limit: {
        type: 'number',
        required: false,
        description: 'Results to return, default 5, max 20.',
      },
    },
  ),
  tool('get_postal_code_info', 'Resolve a postal/ZIP code to city, region, and country.', 'geo', {
    country_code: { type: 'string', required: true, description: 'ISO 2-letter country code.' },
    postal_code: { type: 'string', required: true, description: 'Postal or ZIP code.' },
  }),
  tool('get_elevation', 'Get terrain elevation for one or more latitude/longitude points.', 'geo', {
    locations: {
      type: 'array',
      required: true,
      description: 'Array of { lat, lon } objects, or JSON string.',
    },
  }),

  // ── Calculator ─────────────────────────────────────────────────────────────────
  tool(
    'calculate',
    'Evaluate a mathematical expression precisely. Supports arithmetic, Math.sqrt, Math.pow, Math.sin, Math.cos, Math.log, Math.PI, Math.E, exponentiation (**), and all other Math built-ins. Always use this for any numeric calculation instead of computing in your head.',
    'math',
    {
      expression: {
        type: 'string',
        required: true,
        description:
          'Math expression, e.g. "Math.sqrt(144)", "(1000 * Math.pow(1.05, 10)).toFixed(2)", "Math.PI * 10 ** 2"',
      },
    },
  ),

  // ── Date & Time ───────────────────────────────────────────────────────────
  tool(
    'get_current_datetime',
    'Get the current date and time in any IANA timezone. Returns date, time, day of week, week number, day of year, and Unix timestamp. Always use this when the user asks about the current time, date, or day — never guess.',
    'datetime',
    {
      timezone: {
        type: 'string',
        required: false,
        description:
          'IANA timezone name e.g. "America/New_York", "Asia/Kolkata", "Europe/London". Defaults to system timezone.',
      },
    },
  ),
  tool(
    'date_calculator',
    'Perform date arithmetic: calculate the difference between two dates in days/weeks/months, add or subtract days/months/years from a date, or find the day of the week for any historical or future date.',
    'datetime',
    {
      operation: {
        type: 'string',
        required: true,
        description:
          '"diff" (days between two dates), "add" (add/subtract time from a date), or "weekday" (day of week for a date).',
      },
      date: {
        type: 'string',
        required: true,
        description: 'Primary date in YYYY-MM-DD format, or "today", "tomorrow", "yesterday".',
      },
      date2: {
        type: 'string',
        required: false,
        description: 'Second date for "diff" operation (YYYY-MM-DD).',
      },
      days: {
        type: 'number',
        required: false,
        description: 'Days to add (positive) or subtract (negative) for "add" operation.',
      },
      months: {
        type: 'number',
        required: false,
        description: 'Months to add or subtract for "add" operation.',
      },
      years: {
        type: 'number',
        required: false,
        description: 'Years to add or subtract for "add" operation.',
      },
    },
  ),

  // ── arXiv ──────────────────────────────────────────────────────────────────────
  tool(
    'search_arxiv',
    'Search arXiv for academic and scientific papers. Returns title, authors, abstract, and link. Use for research questions, AI/ML papers, math, physics, computer science, and any academic topic.',
    'research',
    {
      query: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
      category: {
        type: 'string',
        required: false,
        description:
          'Optional arXiv category: cs (computer science), math, physics, stat, q-bio, econ, eess.',
      },
    },
  ),
  tool(
    'get_arxiv_paper',
    'Fetch full details and complete abstract of a specific arXiv paper by its ID (e.g. "2301.00001" or "cs/0501022").',
    'research',
    {
      id: { type: 'string', required: true, description: 'arXiv paper ID.' },
    },
  ),

  // ── Reddit ───────────────────────────────────────────────────────────────────
  tool(
    'get_reddit_posts',
    'Fetch posts from any subreddit. Use to find community discussions, real-world opinions, personal experiences, and niche knowledge on any topic.',
    'social',
    {
      subreddit: {
        type: 'string',
        required: true,
        description: 'Subreddit name without r/ prefix.',
      },
      sort: {
        type: 'string',
        required: false,
        description: 'hot, new, top, or rising. Default: hot.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 10, max 25.' },
    },
  ),
  tool(
    'search_reddit',
    'Search Reddit posts and discussions across all subreddits or within a specific one. Great for finding community opinions, product experiences, and practical advice.',
    'social',
    {
      query: { type: 'string', required: true, description: 'Search query.' },
      subreddit: {
        type: 'string',
        required: false,
        description: 'Optional subreddit to restrict search to.',
      },
      sort: {
        type: 'string',
        required: false,
        description: 'relevance, hot, new, or top. Default: relevance.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 10, max 25.' },
    },
  ),

  // ── Open Library ───────────────────────────────────────────────────────────
  tool(
    'search_books',
    'Search Open Library for books by title, author, subject, or keyword. Returns title, author, year, page count, ISBN, and subject tags.',
    'books',
    {
      query: {
        type: 'string',
        required: true,
        description: 'Search query: book title, author name, ISBN, or subject.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'get_book_by_isbn',
    'Get detailed information about a book by its ISBN-10 or ISBN-13 from Open Library.',
    'books',
    {
      isbn: {
        type: 'string',
        required: true,
        description: 'ISBN-10 or ISBN-13 (with or without dashes).',
      },
    },
  ),

  // ── World Bank ──────────────────────────────────────────────────────────────
  tool(
    'get_world_bank_data',
    'Get World Bank economic and development indicators for any country. Without an indicator returns a summary of GDP, population, inflation, unemployment, and life expectancy. Indicator options: gdp, gdp_per_capita, gdp_growth, population, inflation, unemployment, co2, life_expectancy, internet_usage, literacy, exports, imports — or any raw World Bank indicator code.',
    'economics',
    {
      country: {
        type: 'string',
        required: true,
        description: 'Country name or ISO 2-letter code (e.g. "India" or "IN").',
      },
      indicator: {
        type: 'string',
        required: false,
        description: 'Indicator name or World Bank code. Omit for a key-indicators summary.',
      },
      years: {
        type: 'number',
        required: false,
        description: 'Number of recent years to return, default 5, max 20.',
      },
    },
  ),

  // ── USGS Earthquakes ───────────────────────────────────────────────────────
  tool(
    'get_earthquakes',
    'Fetch recent earthquakes from the USGS real-time feed. Filter by magnitude, time window, and optionally by proximity to a location. Use for natural disaster awareness, geology questions, or checking if an earthquake happened near the user.',
    'geoscience',
    {
      min_magnitude: {
        type: 'number',
        required: false,
        description: 'Minimum magnitude, default 4.0.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 10, max 50.' },
      days: {
        type: 'number',
        required: false,
        description: 'Past number of days to search, default 7, max 30.',
      },
      lat: { type: 'number', required: false, description: 'Latitude for nearby search.' },
      lon: { type: 'number', required: false, description: 'Longitude for nearby search.' },
      radius_km: {
        type: 'number',
        required: false,
        description: 'Search radius in km when lat/lon provided, default 500.',
      },
    },
  ),

  // ── Wikidata ──────────────────────────────────────────────────────────────
  tool(
    'search_wikidata',
    'Search Wikidata for entities (people, places, organisations, concepts) and return their QIDs and descriptions.',
    'wikidata',
    {
      query: { type: 'string', required: true, description: 'Entity name or concept to search.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'get_wikidata_entity',
    'Get rich structured data for a Wikidata entity by its QID (e.g. Q42 for Douglas Adams). Returns label, description, aliases, and key claims including: instance of, sex/gender, date of birth/death, place of birth/death, country of citizenship, occupation, notable works, awards received, education, spouse, children, parents, and official website. Entity QID labels are resolved to human-readable names. Use this whenever you need biographical details, occupations, awards, or factual properties about a person, place, or concept.',
    'wikidata',
    {
      id: {
        type: 'string',
        required: true,
        description: 'Wikidata entity QID such as Q42.',
      },
    },
  ),

  // ── WHO Global Health Observatory ─────────────────────────────────────────
  tool(
    'list_who_indicators',
    'List or search WHO Global Health Observatory indicator codes and names. Use this to discover indicator codes before calling get_who_health_data.',
    'who_gho',
    {
      search: {
        type: 'string',
        required: false,
        description: 'Optional keyword to filter indicator names, e.g. "mortality", "obesity".',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 15, max 50.' },
    },
  ),
  tool(
    'get_who_health_data',
    'Get WHO Global Health Observatory data for an indicator, optionally filtered by country. Common indicators: WHOSIS_000001 (life expectancy), NCD_BMI_30A (obesity), MDG_0000000001 (infant mortality).',
    'who_gho',
    {
      indicator: {
        type: 'string',
        required: true,
        description:
          'WHO indicator code, e.g. WHOSIS_000001. Use list_who_indicators to find codes.',
      },
      country: {
        type: 'string',
        required: false,
        description: 'Optional ISO 3-letter country code, e.g. IND, USA, GBR, CHN.',
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Result count, default 10, max 30.',
      },
    },
  ),

  // ── PubChem ───────────────────────────────────────────────────────────────
  tool(
    'search_compound',
    'Search PubChem for chemical compounds by name, synonym, or formula. Returns CID, molecular formula, molecular weight, and IUPAC name.',
    'pubchem',
    {
      query: {
        type: 'string',
        required: true,
        description:
          'Compound name, synonym, or molecular formula, e.g. "aspirin", "caffeine", "C6H12O6".',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 10.' },
    },
  ),
  tool(
    'get_compound_info',
    'Get detailed chemical property data from PubChem for a specific Compound ID (CID), including SMILES, InChIKey, XLogP, and synonyms.',
    'pubchem',
    {
      cid: {
        type: 'string',
        required: true,
        description: 'PubChem Compound ID (CID), e.g. "2244" for aspirin.',
      },
    },
  ),

  // ── Crossref ──────────────────────────────────────────────────────────────
  tool(
    'search_crossref',
    'Search Crossref for scholarly works (journal articles, books, preprints, datasets) by topic, title, or author. Returns title, authors, year, journal, citation count, and DOI.',
    'crossref',
    {
      query: {
        type: 'string',
        required: true,
        description: 'Search query: topic keywords, paper title, or author name.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
      type: {
        type: 'string',
        required: false,
        description:
          'Filter by work type: journal-article, book, proceedings-article, dataset, preprint, or omit for all.',
      },
    },
  ),
  tool(
    'get_doi_info',
    'Retrieve full metadata for a scholarly work by its DOI using Crossref. Returns title, authors, journal, publisher, citation count, and reference count.',
    'crossref',
    {
      doi: {
        type: 'string',
        required: true,
        description: 'DOI string, e.g. "10.1038/nature12373".',
      },
    },
  ),

  // ── Open Food Facts ─────────────────────────────────────────────────────────
  tool(
    'search_food',
    'Search Open Food Facts for food products by name or ingredient. Returns product name, brand, Nutri-Score, and per-100g macronutrients (calories, fat, carbs, protein, sugar, salt). Use for nutrition and dietary questions.',
    'nutrition',
    {
      query: { type: 'string', required: true, description: 'Food product name or ingredient.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'get_food_by_barcode',
    'Get complete nutritional information for a food product by its barcode (EAN-13, UPC-A, etc.) from Open Food Facts.',
    'nutrition',
    {
      barcode: { type: 'string', required: true, description: 'Product barcode number.' },
    },
  ),
  tool(
    'search_openalex_works',
    'Search OpenAlex for scholarly works and citation metadata.',
    'openalex',
    {
      query: { type: 'string', required: true, description: 'Topic, title, or author search.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'search_europe_pmc',
    'Search Europe PMC for biomedical and life-science papers.',
    'europe_pmc',
    {
      query: { type: 'string', required: true, description: 'Biomedical literature query.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'search_clinical_trials',
    'Search ClinicalTrials.gov studies by condition, drug, or topic.',
    'clinical_trials',
    {
      query: {
        type: 'string',
        required: true,
        description: 'Condition, intervention, or study topic.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'search_drug_labels',
    'Search openFDA drug labels by brand or generic drug name.',
    'openfda',
    {
      query: { type: 'string', required: true, description: 'Drug brand or generic name.' },
      limit: { type: 'number', required: false, description: 'Result count, default 3, max 10.' },
    },
  ),
  tool(
    'search_rxnorm_drugs',
    'Search RxNorm drug concepts and return RXCUI identifiers.',
    'rxnorm',
    {
      query: { type: 'string', required: true, description: 'Drug name to search.' },
      limit: { type: 'number', required: false, description: 'Result count, default 8, max 20.' },
    },
  ),
  tool(
    'search_species',
    'Search GBIF species taxonomy records by scientific or common name.',
    'gbif',
    {
      query: { type: 'string', required: true, description: 'Species or taxon name.' },
      limit: { type: 'number', required: false, description: 'Result count, default 8, max 20.' },
    },
  ),
  tool(
    'search_inaturalist_observations',
    'Search recent iNaturalist observations by taxon name.',
    'inaturalist',
    {
      query: { type: 'string', required: true, description: 'Taxon name or common name.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool('search_gdelt_news', 'Search the GDELT global news index for recent articles.', 'gdelt', {
    query: { type: 'string', required: true, description: 'News search query.' },
    limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    timespan: {
      type: 'string',
      required: false,
      description: 'Optional timespan such as 1d, 7d, or 1m.',
    },
  }),
  tool('search_federal_register', 'Search US Federal Register documents.', 'federal_register', {
    query: { type: 'string', required: true, description: 'Rule, notice, agency, or topic.' },
    limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
  }),
  tool('search_sec_companies', 'Search SEC EDGAR company ticker and CIK records.', 'sec_edgar', {
    query: { type: 'string', required: true, description: 'Company name, ticker, or CIK.' },
    limit: { type: 'number', required: false, description: 'Result count, default 8, max 25.' },
  }),
  tool(
    'get_public_holidays',
    'Get public holidays from Nager.Date for a country and year.',
    'public_holidays',
    {
      country_code: { type: 'string', required: true, description: 'ISO 2-letter country code.' },
      year: { type: 'number', required: false, description: 'Year, default current year.' },
    },
  ),
  tool('search_musicbrainz_artists', 'Search MusicBrainz artist records.', 'musicbrainz', {
    query: { type: 'string', required: true, description: 'Artist or band name.' },
    limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
  }),
  tool(
    'search_itunes',
    'Search the iTunes public catalog for music, podcasts, movies, and apps.',
    'itunes',
    {
      query: { type: 'string', required: true, description: 'Catalog search query.' },
      media: {
        type: 'string',
        required: false,
        description: 'Optional media type: music, podcast, movie, software, ebook, or all.',
      },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'search_tv_shows',
    'Search TVMaze for TV show metadata, status, network, and genres.',
    'tvmaze',
    {
      query: { type: 'string', required: true, description: 'TV show title.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool(
    'search_breweries',
    'Search Open Brewery DB by brewery name, city, or region.',
    'open_brewery_db',
    {
      query: { type: 'string', required: true, description: 'Brewery search query.' },
      limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
    },
  ),
  tool('search_anime', 'Search Jikan for anime metadata from MyAnimeList.', 'jikan', {
    query: { type: 'string', required: true, description: 'Anime title.' },
    limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
  }),
  tool('search_recipes', 'Search TheMealDB recipes by meal name.', 'themealdb', {
    query: { type: 'string', required: true, description: 'Meal or recipe name.' },
    limit: { type: 'number', required: false, description: 'Result count, default 5, max 20.' },
  }),
  tool('query_osv_vulnerabilities', 'Query OSV.dev for known package vulnerabilities.', 'osv', {
    package_name: { type: 'string', required: true, description: 'Package name.' },
    ecosystem: {
      type: 'string',
      required: true,
      description: 'Ecosystem such as npm, PyPI, Maven, Go, or crates.io.',
    },
    version: { type: 'string', required: false, description: 'Optional package version.' },
    limit: { type: 'number', required: false, description: 'Result count, default 10, max 20.' },
  }),
];

function requireText(params, key) {
  const value = String(params?.[key] ?? '').trim();
  if (!value) throw new Error(`Missing required parameter: ${key}.`);
  return value;
}

function requireNumberParam(params, key) {
  const value = Number(params?.[key]);
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid parameter: ${key}.`);
  return value;
}

function stripHtml(value = '') {
  let s = String(value);
  // Remove script/style blocks including their inner content.
  // Uses an index-based slicing approach instead of multi-character regex replacement
  // to avoid the CodeQL js/incomplete-multi-character-sanitization warning — crafted
  // inputs like "<scr<script>…</script>ipt>" can reconstruct a tag after one regex
  // pass even when the replacement is looped.
  for (const tag of ['script', 'style']) {
    const openRe = new RegExp(`<${tag}(?=[\\s>])`, 'gi');
    let m;
    while ((m = openRe.exec(s)) !== null) {
      const start = m.index;
      const closeRe = new RegExp(`<\\/${tag}[^>]*>`, 'gi');
      closeRe.lastIndex = start;
      const closeMatch = closeRe.exec(s);
      const end = closeMatch ? closeRe.lastIndex : s.length;
      s = s.slice(0, start) + s.slice(end);
      openRe.lastIndex = start;
    }
  }
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function withDefaultFetchSignal(options) {
  if (options.signal) return options;
  return { ...options, signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS) };
}

function normalizeFetchError(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return new Error(`Request timed out after ${DEFAULT_FETCH_TIMEOUT_MS}ms.`);
  }

  return error;
}

async function fetchJson(url, { headers = {}, ...options } = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...withDefaultFetchSignal(options),
      headers: { ...DEFAULT_HEADERS, ...headers },
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.message || data?.error || text || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function fetchText(url, { headers = {}, ...options } = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...withDefaultFetchSignal(options),
      headers: { ...DEFAULT_HEADERS, ...headers },
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  return text;
}

function formatList(title, rows) {
  return [title, '', ...rows.map((row, index) => `${index + 1}. ${row}`)].join('\n');
}

function toTitleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
}

async function wikipediaSummary(params) {
  const query = requireText(params, 'query');
  const encoded = encodeURIComponent(query);
  let data = await fetchJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`,
  ).catch(() => null);

  if (!data?.title || data?.type === 'disambiguation') {
    const search = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json&origin=*`,
    );
    const title = search?.[1]?.[0];
    if (title) {
      data = await fetchJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
      );
    }
  }

  if (!data?.title) throw new Error('No Wikipedia article found.');
  return [
    `Wikipedia: ${data.title}`,
    '',
    data.description ? `Description: ${data.description}` : null,
    data.extract,
    '',
    `URL: ${data.content_urls?.desktop?.page ?? toTitleUrl(data.title)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function wikipediaSearchResults(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&srprop=snippet|titlesnippet&format=json&origin=*`,
  );
  const rows = (data.query?.search ?? []).map((result) =>
    [`${result.title}`, stripHtml(result.snippet), toTitleUrl(result.title)]
      .filter(Boolean)
      .join('\n   '),
  );
  return rows.length
    ? formatList(`Wikipedia search: ${query}`, rows)
    : `No Wikipedia results for "${query}".`;
}

async function wikipediaFullArticle(params) {
  const title = requireText(params, 'title');
  const maxChars = clampInteger(params.max_chars, 6000, 500, 20000);
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&exsectionformat=plain&format=json&origin=*`,
  );
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page?.extract) throw new Error('No Wikipedia article extract found.');
  const extract =
    page.extract.length > maxChars ? `${page.extract.slice(0, maxChars)}...` : page.extract;
  return [
    `Wikipedia Article: ${page.title}`,
    '',
    extract,
    '',
    `URL: ${toTitleUrl(page.title)}`,
  ].join('\n');
}

async function wikipediaSections(params) {
  const title = requireText(params, 'title');
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`,
  );
  const rows = (data.parse?.sections ?? []).map(
    (section) =>
      `${'  '.repeat(Math.max(0, Number(section.level) - 1))}${section.number} ${section.line}`,
  );
  return rows.length
    ? [`Wikipedia sections: ${data.parse?.title ?? title}`, '', ...rows].join('\n')
    : 'No sections found.';
}

async function wikipediaRandomArticle() {
  const data = await fetchJson('https://en.wikipedia.org/api/rest_v1/page/random/summary');
  return [
    `Random Wikipedia Article: ${data.title}`,
    '',
    data.description ? `Description: ${data.description}` : null,
    data.extract,
    '',
    `URL: ${data.content_urls?.desktop?.page ?? toTitleUrl(data.title)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function wikipediaOnThisDay(params) {
  const now = new Date();
  const month = clampInteger(params.month, now.getMonth() + 1, 1, 12);
  const day = clampInteger(params.day, now.getDate(), 1, 31);
  const type = String(params.type ?? 'events')
    .trim()
    .toLowerCase();
  const safeType = ['all', 'events', 'births', 'deaths', 'holidays'].includes(type)
    ? type
    : 'events';
  const limit = clampInteger(params.limit, 5, 1, 20);
  const data = await fetchJson(
    `https://en.wikipedia.org/api/rest_v1/feed/onthisday/${safeType}/${month}/${day}`,
  );
  const sections = safeType === 'all' ? ['events', 'births', 'deaths', 'holidays'] : [safeType];
  const rows = [];
  for (const section of sections) {
    for (const item of (data[section] ?? []).slice(0, limit)) {
      const page = item.pages?.[0];
      rows.push(
        `${item.year ? `${item.year}: ` : ''}${item.text}${page?.content_urls?.desktop?.page ? `\n   ${page.content_urls.desktop.page}` : ''}`,
      );
    }
  }
  return rows.length
    ? formatList(`Wikipedia on this day: ${month}/${day}`, rows.slice(0, limit))
    : 'No on-this-day items found.';
}

// A realistic desktop-browser UA/Accept set. DuckDuckGo's HTML endpoint (unlike its
// JSON "instant answer" API) returns actual organic results, but it will serve a
// bot-check page to obvious non-browser clients, so we present as a normal browser.
const BROWSER_LIKE_HEADERS = Object.freeze({
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
});

// DuckDuckGo's HTML result links are proxied through a redirect like
// "//duckduckgo.com/l/?uddg=<encoded-real-url>&rut=..." — unwrap it back to the
// real destination URL so the AI/user gets a directly usable link.
function decodeDuckDuckGoRedirect(href) {
  try {
    const normalized = href.startsWith('//') ? `https:${href}` : href;
    const url = new URL(normalized, 'https://duckduckgo.com');
    const real = url.searchParams.get('uddg');
    return real ? decodeURIComponent(real) : normalized;
  } catch {
    return href;
  }
}

function parseDuckDuckGoOrganicResults(html, limit) {
  const titleRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const titles = [...html.matchAll(titleRe)];
  const snippets = [...html.matchAll(snippetRe)];
  const results = [];
  const seenUrls = new Set();
  for (let index = 0; index < titles.length && results.length < limit; index += 1) {
    const url = decodeDuckDuckGoRedirect(titles[index][1]);
    if (!url.startsWith('http') || seenUrls.has(url)) continue;
    const title = stripHtml(titles[index][2]);
    if (!title) continue;
    seenUrls.add(url);
    results.push({ title, url, snippet: stripHtml(snippets[index]?.[1] ?? '') });
  }
  return results;
}

async function fetchDuckDuckGoOrganicResults(query, limit) {
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`,
    { headers: BROWSER_LIKE_HEADERS },
  ).catch(() => null);
  if (!html) return [];
  return parseDuckDuckGoOrganicResults(html, limit);
}

// Wikipedia + Hacker News fallback, used only when the live DuckDuckGo scrape
// above returns nothing (e.g. DuckDuckGo is rate-limiting or temporarily blocking).
async function fetchWebSearchFallback(query) {
  const rows = [];
  const wiki = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3&srprop=snippet&origin=*`,
  ).catch(() => null);
  for (const result of wiki?.query?.search ?? []) {
    rows.push(`${result.title}\n   ${stripHtml(result.snippet)}\n   ${toTitleUrl(result.title)}`);
  }
  const hn = await fetchJson(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=3`,
  ).catch(() => null);
  for (const hit of hn?.hits ?? []) {
    rows.push(
      `${hit.title || hit.story_title}\n   Points: ${hit.points ?? 0}, comments: ${hit.num_comments ?? 0}\n   ${hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`}`,
    );
  }
  return rows;
}

async function searchWeb(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 8, 1, 10);
  const sections = [];

  const [duck, organic] = await Promise.all([
    fetchJson(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=0`,
    ).catch(() => null),
    fetchDuckDuckGoOrganicResults(query, limit),
  ]);

  if (duck?.AbstractText) {
    sections.push(
      [
        'Featured answer:',
        duck.Heading || query,
        duck.AbstractText,
        duck.AbstractURL || 'https://duckduckgo.com/',
      ].join('\n'),
    );
  }

  if (organic.length) {
    const rows = organic.map(
      (result) =>
        `${result.title}\n   ${result.snippet || 'No snippet available.'}\n   ${result.url}`,
    );
    sections.push(formatList(`Web results: ${query}`, rows));
  } else {
    const fallbackRows = await fetchWebSearchFallback(query);
    if (fallbackRows.length) {
      sections.push(formatList(`Related results: ${query}`, fallbackRows.slice(0, limit)));
    }
  }

  return sections.length ? sections.join('\n\n') : `No public search results found for "${query}".`;
}

async function getDefinition(params) {
  const word = requireText(params, 'word');
  const data = await fetchJson(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  );
  const entry = data?.[0];
  if (!entry) throw new Error('No definition found.');
  const lines = [`Definition: ${entry.word}`, ''];
  for (const meaning of entry.meanings ?? []) {
    lines.push(`${meaning.partOfSpeech}:`);
    for (const item of (meaning.definitions ?? []).slice(0, 3)) {
      lines.push(`- ${item.definition}${item.example ? ` Example: ${item.example}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

async function getCountryInfo(params) {
  const country = requireText(params, 'country');
  const endpoint =
    country.length <= 3
      ? `https://restcountries.com/v3.1/alpha/${encodeURIComponent(country)}`
      : `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=false`;
  const data = await fetchJson(endpoint);
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) throw new Error('Country not found.');
  const currencies = Object.entries(item.currencies ?? {}).map(
    ([code, value]) => `${code} (${value.name ?? 'currency'})`,
  );
  return [
    `Country: ${item.name?.common ?? country}`,
    `Official name: ${item.name?.official ?? ''}`,
    `Capital: ${(item.capital ?? []).join(', ') || 'n/a'}`,
    `Region: ${[item.region, item.subregion].filter(Boolean).join(' / ') || 'n/a'}`,
    `Population: ${Number(item.population ?? 0).toLocaleString('en-US')}`,
    `Languages: ${Object.values(item.languages ?? {}).join(', ') || 'n/a'}`,
    `Currencies: ${currencies.join(', ') || 'n/a'}`,
    `Timezones: ${(item.timezones ?? []).join(', ') || 'n/a'}`,
    `Map: ${item.maps?.googleMaps ?? ''}`,
  ].join('\n');
}

async function getQuote(params) {
  const tag = String(params.tag ?? '').trim();
  const zen = await fetchJson('https://zenquotes.io/api/random').catch(() => null);
  const item = Array.isArray(zen) ? zen[0] : null;
  if (item?.q) return [`Quote`, '', `"${item.q}"`, `- ${item.a ?? 'Unknown'}`].join('\n');

  const tagParam = tag ? `&tags=${encodeURIComponent(tag)}` : '';
  const data = await fetchJson(`https://api.quotable.io/quotes/random?limit=1${tagParam}`);
  const quote = Array.isArray(data) ? data[0] : data;
  return [`Quote`, '', `"${quote.content}"`, `- ${quote.author ?? 'Unknown'}`].join('\n');
}

async function getJoke(params) {
  const category = String(params.category ?? 'Any').trim() || 'Any';
  const safeCategory = ['Any', 'Programming', 'Misc', 'Pun', 'Spooky', 'Christmas'].includes(
    category,
  )
    ? category
    : 'Any';
  const data = await fetchJson(
    `https://v2.jokeapi.dev/joke/${safeCategory}?blacklistFlags=nsfw,racist,sexist&type=single,twopart`,
  );
  if (data.type === 'twopart') return [`Joke`, '', data.setup, data.delivery].join('\n');
  return [`Joke`, '', data.joke ?? 'No joke returned.'].join('\n');
}

async function getHackerNews(params) {
  const type = String(params.type ?? 'top')
    .trim()
    .toLowerCase();
  const endpoint =
    {
      top: 'topstories',
      new: 'newstories',
      best: 'beststories',
      ask: 'askstories',
      show: 'showstories',
      job: 'jobstories',
    }[type] ?? 'topstories';
  const limit = clampInteger(params.limit, 5, 1, 20);
  const ids = await fetchJson(`https://hacker-news.firebaseio.com/v0/${endpoint}.json`);
  const stories = await Promise.all(
    ids
      .slice(0, limit)
      .map((id) =>
        fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null),
      ),
  );
  const rows = stories
    .filter(Boolean)
    .map(
      (story) =>
        `${story.title}\n   Score: ${story.score ?? 0}, comments: ${story.descendants ?? 0}\n   ${story.url || `https://news.ycombinator.com/item?id=${story.id}`}`,
    );
  return rows.length ? formatList(`Hacker News: ${type}`, rows) : 'No Hacker News stories found.';
}

async function searchPhotos(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 12);
  const data = await fetchJson(
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit}&prop=imageinfo&iiprop=url|mime|size|user&format=json&origin=*`,
  );
  const pages = Object.values(data.query?.pages ?? {});
  const rows = pages.map((page) => {
    const image = page.imageinfo?.[0] ?? {};
    return `${page.title.replace(/^File:/, '')}\n   ${image.url ?? ''}\n   Source: https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
  });
  return rows.length
    ? formatList(`Wikimedia Commons images: ${query}`, rows)
    : `No reusable images found for "${query}".`;
}

async function npmSearch(params) {
  const query = requireText(params, 'query');
  const size = clampInteger(params.size, 5, 1, 10);
  const data = await fetchJson(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`,
  );
  const rows = (data.objects ?? []).map(
    ({ package: pkg }) =>
      `${pkg.name}@${pkg.version}\n   ${pkg.description ?? 'No description'}\n   https://www.npmjs.com/package/${pkg.name}`,
  );
  return rows.length
    ? formatList(`npm search: ${query}`, rows)
    : `No npm packages found for "${query}".`;
}

async function npmPackage(name) {
  return fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
}

function latestPackageVersion(pkg) {
  const latest = pkg['dist-tags']?.latest;
  return latest ? pkg.versions?.[latest] : null;
}

async function npmPackageInfo(params) {
  const name = requireText(params, 'name');
  const pkg = await npmPackage(name);
  const latest = latestPackageVersion(pkg);
  if (!latest) throw new Error('Package has no latest version.');
  return [
    `npm package: ${pkg.name}`,
    `Latest: ${latest.version}`,
    `Description: ${pkg.description ?? latest.description ?? 'n/a'}`,
    `License: ${latest.license ?? pkg.license ?? 'n/a'}`,
    `Dependencies: ${Object.keys(latest.dependencies ?? {}).length}`,
    `Homepage: ${pkg.homepage ?? latest.homepage ?? 'n/a'}`,
    `Repository: ${typeof latest.repository === 'string' ? latest.repository : (latest.repository?.url ?? 'n/a')}`,
    `Published: ${pkg.time?.[latest.version] ?? 'n/a'}`,
    `URL: https://www.npmjs.com/package/${pkg.name}`,
  ].join('\n');
}

async function npmPackageVersions(params) {
  const name = requireText(params, 'name');
  const limit = clampInteger(params.limit, 15, 1, 30);
  const pkg = await npmPackage(name);
  const rows = Object.keys(pkg.versions ?? {})
    .reverse()
    .slice(0, limit)
    .map((version) => `${version}${pkg.time?.[version] ? ` - ${pkg.time[version]}` : ''}`);
  return rows.length ? [`npm versions: ${pkg.name}`, '', ...rows].join('\n') : 'No versions found.';
}

async function npmPackageDownloads(params) {
  const name = requireText(params, 'name');
  const period = ['last-week', 'last-month', 'last-year'].includes(params.period)
    ? params.period
    : 'last-week';
  const data = await fetchJson(
    `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(name)}`,
  );
  return [
    `npm downloads: ${name}`,
    `Period: ${period}`,
    `Downloads: ${Number(data.downloads ?? 0).toLocaleString('en-US')}`,
  ].join('\n');
}

async function npmComparePackages(params) {
  const packageA = requireText(params, 'package_a');
  const packageB = requireText(params, 'package_b');
  const [infoA, infoB, downloadsA, downloadsB] = await Promise.all([
    npmPackage(packageA),
    npmPackage(packageB),
    fetchJson(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageA)}`,
    ).catch(() => null),
    fetchJson(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageB)}`,
    ).catch(() => null),
  ]);
  const latestA = latestPackageVersion(infoA);
  const latestB = latestPackageVersion(infoB);
  const row = (label, pkg, latest, downloads) =>
    `${label}: ${pkg.name}@${latest?.version ?? 'n/a'} | weekly downloads ${Number(downloads?.downloads ?? 0).toLocaleString('en-US')} | license ${latest?.license ?? 'n/a'} | deps ${Object.keys(latest?.dependencies ?? {}).length} | published ${pkg.time?.[latest?.version] ?? 'n/a'}`;
  return [
    'npm package comparison',
    '',
    row('A', infoA, latestA, downloadsA),
    row('B', infoB, latestB, downloadsB),
  ].join('\n');
}

function stackExchangeUrl(path, params) {
  const url = new URL(`https://api.stackexchange.com/2.3/${path}`);
  url.searchParams.set('site', 'stackoverflow');
  for (const [key, value] of Object.entries(params)) {
    if (value != null && String(value).trim() !== '') url.searchParams.set(key, value);
  }
  return url.toString();
}

function formatStackQuestion(question) {
  return `${stripHtml(question.title)}\n   Score: ${question.score ?? 0}, answers: ${question.answer_count ?? 0}, views: ${question.view_count ?? 0}\n   ${question.link}`;
}

async function stackOverflowSearch(params) {
  const query = requireText(params, 'query');
  const count = clampInteger(params.count, 5, 1, 10);
  const data = await fetchJson(
    stackExchangeUrl('search/advanced', {
      order: 'desc',
      sort: 'relevance',
      q: query,
      pagesize: count,
    }),
  );
  const rows = (data.items ?? []).map(formatStackQuestion);
  return rows.length
    ? formatList(`Stack Overflow search: ${query}`, rows)
    : 'No Stack Overflow questions found.';
}

async function stackOverflowAnswers(params) {
  const questionId = requireText(params, 'question_id');
  const count = clampInteger(params.count, 3, 1, 5);
  const data = await fetchJson(
    stackExchangeUrl(`questions/${encodeURIComponent(questionId)}/answers`, {
      order: 'desc',
      sort: 'votes',
      pagesize: count,
      filter: 'withbody',
    }),
  );
  const rows = (data.items ?? []).map(
    (answer) =>
      `Score: ${answer.score ?? 0}${answer.is_accepted ? ' (accepted)' : ''}\n   ${stripHtml(answer.body).slice(0, 1200)}\n   https://stackoverflow.com/a/${answer.answer_id}`,
  );
  return rows.length
    ? formatList(`Stack Overflow answers: ${questionId}`, rows)
    : 'No answers found.';
}

async function stackOverflowQuestionsByTag(params) {
  const tag = requireText(params, 'tag');
  const count = clampInteger(params.count, 5, 1, 10);
  const data = await fetchJson(
    stackExchangeUrl('questions', {
      order: 'desc',
      sort: 'votes',
      tagged: tag,
      pagesize: count,
    }),
  );
  const rows = (data.items ?? []).map(formatStackQuestion);
  return rows.length
    ? formatList(`Top Stack Overflow questions: ${tag}`, rows)
    : 'No questions found.';
}

async function stackOverflowHot(params) {
  const count = clampInteger(params.count, 5, 1, 10);
  const data = await fetchJson(
    stackExchangeUrl('questions', {
      order: 'desc',
      sort: 'hot',
      tagged: String(params.tag ?? '').trim(),
      pagesize: count,
    }),
  );
  const rows = (data.items ?? []).map(formatStackQuestion);
  return rows.length ? formatList('Hot Stack Overflow questions', rows) : 'No hot questions found.';
}

async function stackOverflowSimilar(params) {
  const title = requireText(params, 'title');
  const count = clampInteger(params.count, 5, 1, 10);
  const data = await fetchJson(
    stackExchangeUrl('similar', {
      order: 'desc',
      sort: 'relevance',
      title,
      pagesize: count,
    }),
  );
  const rows = (data.items ?? []).map(formatStackQuestion);
  return rows.length
    ? formatList(`Similar Stack Overflow questions: ${title}`, rows)
    : 'No similar questions found.';
}

async function geocodeLocation(location) {
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
  );
  const result = data.results?.[0];
  if (!result) throw new Error(`Location not found: ${location}`);
  return result;
}

function temperatureUnit(units) {
  return String(units ?? '')
    .toLowerCase()
    .startsWith('f')
    ? 'fahrenheit'
    : 'celsius';
}

function weatherLabel(code) {
  return WEATHER_CODES.get(Number(code)) ?? `Weather code ${code}`;
}

async function getWeather(params) {
  const location = await geocodeLocation(requireText(params, 'location'));
  const units = temperatureUnit(params.units);
  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,cloud_cover,surface_pressure&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=${units}&wind_speed_unit=kmh&timezone=auto&forecast_days=3`,
  );
  const current = data.current ?? {};
  const daily = data.daily ?? {};
  return [
    `Weather: ${location.name}, ${location.country}`,
    `Current: ${current.temperature_2m} ${data.current_units?.temperature_2m ?? ''}, feels like ${current.apparent_temperature} ${data.current_units?.apparent_temperature ?? ''}`,
    `Condition: ${weatherLabel(current.weather_code)}`,
    `Humidity: ${current.relative_humidity_2m}%`,
    `Wind: ${current.wind_speed_10m} km/h`,
    `Precipitation: ${current.precipitation ?? 0} mm`,
    '',
    'Next days:',
    ...(daily.time ?? []).map(
      (date, index) =>
        `${date}: ${daily.temperature_2m_min?.[index]}-${daily.temperature_2m_max?.[index]} ${data.daily_units?.temperature_2m_max ?? ''}, ${weatherLabel(daily.weather_code?.[index])}, rain ${daily.precipitation_sum?.[index] ?? 0} mm`,
    ),
  ].join('\n');
}

async function getHourlyForecast(params) {
  const location = await geocodeLocation(requireText(params, 'location'));
  const units = temperatureUnit(params.units);
  const hours = clampInteger(params.hours, 24, 1, 48);
  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=${units}&wind_speed_unit=kmh&timezone=auto&forecast_days=2`,
  );
  const hourly = data.hourly ?? {};
  const rows = (hourly.time ?? [])
    .slice(0, hours)
    .map(
      (time, index) =>
        `${time}: ${hourly.temperature_2m?.[index]} ${data.hourly_units?.temperature_2m ?? ''}, ${weatherLabel(hourly.weather_code?.[index])}, rain chance ${hourly.precipitation_probability?.[index] ?? 0}%, wind ${hourly.wind_speed_10m?.[index] ?? 0} km/h`,
    );
  return [`Hourly forecast: ${location.name}, ${location.country}`, '', ...rows].join('\n');
}

async function getWeeklyForecast(params) {
  const location = await geocodeLocation(requireText(params, 'location'));
  const units = temperatureUnit(params.units);
  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,uv_index_max,precipitation_probability_max,wind_speed_10m_max&temperature_unit=${units}&wind_speed_unit=kmh&timezone=auto&forecast_days=7`,
  );
  const daily = data.daily ?? {};
  const rows = (daily.time ?? []).map(
    (date, index) =>
      `${date}: ${daily.temperature_2m_min?.[index]}-${daily.temperature_2m_max?.[index]} ${data.daily_units?.temperature_2m_max ?? ''}, ${weatherLabel(daily.weather_code?.[index])}, rain ${daily.precipitation_sum?.[index] ?? 0} mm, UV ${daily.uv_index_max?.[index] ?? 'n/a'}`,
  );
  return [`Weekly forecast: ${location.name}, ${location.country}`, '', ...rows].join('\n');
}

async function getAirQuality(params) {
  const location = await geocodeLocation(requireText(params, 'location'));
  const data = await fetchJson(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,european_aqi`,
  );
  const current = data.current ?? {};
  return [
    `Air quality: ${location.name}, ${location.country}`,
    `European AQI: ${current.european_aqi ?? 'n/a'}`,
    `PM2.5: ${current.pm2_5 ?? 'n/a'} ug/m3`,
    `PM10: ${current.pm10 ?? 'n/a'} ug/m3`,
    `Ozone: ${current.ozone ?? 'n/a'} ug/m3`,
    `NO2: ${current.nitrogen_dioxide ?? 'n/a'} ug/m3`,
    `CO: ${current.carbon_monoxide ?? 'n/a'} ug/m3`,
  ].join('\n');
}

async function getSunriseSunset(params) {
  const location = await geocodeLocation(requireText(params, 'location'));
  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=sunrise,sunset,daylight_duration,sunshine_duration&timezone=auto&forecast_days=7`,
  );
  const daily = data.daily ?? {};
  const rows = (daily.time ?? []).map(
    (date, index) =>
      `${date}: sunrise ${daily.sunrise?.[index] ?? 'n/a'}, sunset ${daily.sunset?.[index] ?? 'n/a'}, daylight ${Math.round((daily.daylight_duration?.[index] ?? 0) / 60)} min`,
  );
  return [`Sunrise and sunset: ${location.name}, ${location.country}`, '', ...rows].join('\n');
}

async function getExchangeRate(params) {
  const from = requireText(params, 'from').toUpperCase();
  const to = String(params.to ?? '')
    .trim()
    .toUpperCase();
  const amount = Number(params.amount ?? 1);
  if (!Number.isFinite(amount)) throw new Error('amount must be a number.');
  const data = await fetchJson(`https://open.er-api.com/v6/latest/${from}`);
  if (data.result !== 'success')
    throw new Error(data['error-type'] ?? 'Exchange rate lookup failed.');
  if (to) {
    const rate = data.rates?.[to];
    if (!Number.isFinite(rate)) throw new Error(`No exchange rate for ${to}.`);
    return [
      `Exchange rate`,
      `${amount} ${from} = ${(amount * rate).toFixed(4)} ${to}`,
      `Rate: ${rate}`,
      `Updated: ${data.time_last_update_utc}`,
    ].join('\n');
  }
  const rows = Object.entries(data.rates ?? {})
    .slice(0, 25)
    .map(([code, rate]) => `${code}: ${rate}`);
  return [`Exchange rates from ${from}`, `Updated: ${data.time_last_update_utc}`, '', ...rows].join(
    '\n',
  );
}

async function findCoinId(query) {
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
  );
  const coin = data.coins?.[0];
  if (!coin?.id) throw new Error(`No CoinGecko coin found for "${query}".`);
  return coin;
}

async function getCryptoPrice(params) {
  const coin = await findCoinId(requireText(params, 'coin'));
  const vs =
    String(params.vs_currency ?? 'usd')
      .trim()
      .toLowerCase() || 'usd';
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=${vs}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true`,
  );
  const price = data[coin.id] ?? {};
  return [
    `Crypto price: ${coin.name} (${coin.symbol?.toUpperCase()})`,
    `Price: ${price[vs] ?? 'n/a'} ${vs.toUpperCase()}`,
    `24h change: ${price[`${vs}_24h_change`]?.toFixed?.(2) ?? 'n/a'}%`,
    `Market cap: ${Number(price[`${vs}_market_cap`] ?? 0).toLocaleString('en-US')} ${vs.toUpperCase()}`,
    `24h volume: ${Number(price[`${vs}_24h_vol`] ?? 0).toLocaleString('en-US')} ${vs.toUpperCase()}`,
  ].join('\n');
}

async function getCryptoTrending(params) {
  const limit = clampInteger(params.limit, 7, 1, 15);
  const data = await fetchJson('https://api.coingecko.com/api/v3/search/trending');
  const rows = (data.coins ?? [])
    .slice(0, limit)
    .map(
      ({ item }) =>
        `${item.name} (${item.symbol}) - rank ${item.market_cap_rank ?? 'n/a'} - https://www.coingecko.com/en/coins/${item.id}`,
    );
  return rows.length ? formatList('Trending crypto assets', rows) : 'No trending coins found.';
}

async function getTopCoins(params) {
  const vs =
    String(params.vs_currency ?? 'usd')
      .trim()
      .toLowerCase() || 'usd';
  const limit = clampInteger(params.limit, 10, 1, 50);
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`,
  );
  const rows = data.map(
    (coin) =>
      `${coin.market_cap_rank}. ${coin.name} (${coin.symbol.toUpperCase()}): ${coin.current_price} ${vs.toUpperCase()}, 24h ${coin.price_change_percentage_24h?.toFixed?.(2) ?? 'n/a'}%`,
  );
  return formatList(`Top crypto assets by market cap (${vs.toUpperCase()})`, rows);
}

async function searchCrypto(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 8, 1, 20);
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
  );
  const rows = (data.coins ?? [])
    .slice(0, limit)
    .map(
      (coin) =>
        `${coin.name} (${coin.symbol}) - id ${coin.id} - rank ${coin.market_cap_rank ?? 'n/a'}`,
    );
  return rows.length ? formatList(`CoinGecko search: ${query}`, rows) : 'No crypto assets found.';
}

async function getApod(params) {
  const apiKey = String(params.api_key ?? 'DEMO_KEY').trim() || 'DEMO_KEY';
  const date = String(params.date ?? '').trim();
  const url = new URL('https://api.nasa.gov/planetary/apod');
  url.searchParams.set('api_key', apiKey);
  if (date) url.searchParams.set('date', date);
  const data = await fetchJson(url.toString());
  return [
    `NASA APOD: ${data.title}`,
    `Date: ${data.date}`,
    `Media type: ${data.media_type}`,
    `URL: ${data.hdurl ?? data.url ?? 'n/a'}`,
    '',
    data.explanation,
  ].join('\n');
}

async function getIssLocation() {
  const data = await fetchJson('http://api.open-notify.org/iss-now.json');
  const pos = data.iss_position ?? {};
  return [
    'International Space Station position',
    `Latitude: ${pos.latitude}`,
    `Longitude: ${pos.longitude}`,
    `Timestamp: ${data.timestamp ? new Date(data.timestamp * 1000).toISOString() : 'n/a'}`,
    'Map: https://spotthestation.nasa.gov/tracking_map.cfm',
  ].join('\n');
}

function parseUrlValue(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported.');
  }
  return parsed;
}

async function shortenUrl(params) {
  const input = requireText(params, 'url');
  parseUrlValue(input);
  const body = new URLSearchParams({ url: input });
  const data = await fetchJson('https://cleanuri.com/api/v1/shorten', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  return ['Shortened URL', '', `Original: ${input}`, `Short: ${data.result_url ?? 'n/a'}`].join(
    '\n',
  );
}

async function getUrlMetadata(params) {
  const input = requireText(params, 'url');
  parseUrlValue(input);
  const data = await fetchJson(`https://api.microlink.io/?url=${encodeURIComponent(input)}`);
  const item = data.data ?? {};
  return [
    'URL metadata',
    '',
    `URL: ${input}`,
    `Title: ${item.title ?? 'n/a'}`,
    `Description: ${item.description ?? 'n/a'}`,
    `Publisher: ${item.publisher ?? 'n/a'}`,
    `Language: ${item.lang ?? 'n/a'}`,
    `Image: ${item.image?.url ?? 'n/a'}`,
  ].join('\n');
}

function generateQrCodeUrl(params) {
  const input = requireText(params, 'url');
  parseUrlValue(input);
  const size = clampInteger(params.size, 200, 80, 1000);
  const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(input)}`;
  return ['QR code URL', '', `Input: ${input}`, `Size: ${size}x${size}`, `Image: ${imageUrl}`].join(
    '\n',
  );
}

async function getWhoisInfo(params) {
  const domain = requireText(params, 'domain')
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .toLowerCase();
  const data = await fetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
  const events = Object.fromEntries(
    (data.events ?? []).map((event) => [event.eventAction, event.eventDate]),
  );
  const nameservers = (data.nameservers ?? []).map((item) => item.ldhName).filter(Boolean);
  return [
    `RDAP: ${domain}`,
    '',
    `Handle: ${data.handle ?? 'n/a'}`,
    `Status: ${(data.status ?? []).join(', ') || 'n/a'}`,
    `Created: ${events.registration ?? events.creation ?? 'n/a'}`,
    `Updated: ${events['last changed'] ?? events.lastChanged ?? 'n/a'}`,
    `Expires: ${events.expiration ?? 'n/a'}`,
    `Nameservers: ${nameservers.join(', ') || 'n/a'}`,
  ].join('\n');
}

async function checkRedirectChain(params) {
  let current = requireText(params, 'url');
  parseUrlValue(current);
  const limit = clampInteger(params.limit, 8, 1, 15);
  const rows = [];
  for (let index = 0; index < limit; index += 1) {
    const response = await fetch(current, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'user-agent': DEFAULT_HEADERS['user-agent'] },
    }).catch(() => fetch(current, { method: 'GET', redirect: 'manual' }));
    const location = response.headers.get('location');
    rows.push(`${index + 1}. ${response.status} ${response.statusText} - ${current}`);
    if (!location || response.status < 300 || response.status >= 400) break;
    current = new URL(location, current).toString();
  }
  return ['Redirect chain', '', ...rows, '', `Final URL: ${current}`].join('\n');
}

async function getTreasuryData(params) {
  const type = String(params.type ?? 'debt')
    .trim()
    .toLowerCase();
  const limit = clampInteger(params.limit, 5, 1, 20);
  const config =
    {
      debt: {
        title: 'US Treasury debt to the penny',
        url: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny',
        fields: ['record_date', 'tot_pub_debt_out_amt'],
      },
      rates: {
        title: 'US Treasury average interest rates',
        url: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates',
        fields: ['record_date', 'security_desc', 'avg_interest_rate_amt'],
      },
      balance: {
        title: 'US Treasury daily cash balance',
        url: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/dts_table_1',
        fields: ['record_date', 'account_type', 'close_today_bal'],
      },
    }[type] ?? null;
  if (!config) throw new Error('type must be debt, rates, or balance.');
  const url = new URL(config.url);
  url.searchParams.set('sort', '-record_date');
  url.searchParams.set('page[size]', String(limit));
  const data = await fetchJson(url.toString());
  const rows = (data.data ?? []).map((row) =>
    config.fields.map((field) => `${field}: ${row[field] ?? 'n/a'}`).join(' | '),
  );
  return rows.length
    ? [config.title, '', ...rows].join('\n')
    : `${config.title}\n\nNo rows returned.`;
}

async function getFredData(params) {
  const seriesId = requireText(params, 'series_id').toUpperCase();
  const limit = clampInteger(params.limit, 5, 1, 25);
  const csv = await fetchText(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`,
  );
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [date, value] = line.split(',');
      return { date, value };
    })
    .filter((row) => row.date && row.value && row.value !== '.')
    .slice(-limit);
  return rows.length
    ? [`FRED series: ${seriesId}`, '', ...rows.map((row) => `${row.date}: ${row.value}`)].join('\n')
    : `No FRED observations found for ${seriesId}.`;
}

async function getIpInfo(params) {
  const ip = String(params.ip ?? '').trim();
  const data = await fetchJson(`https://ipapi.co/${ip ? `${encodeURIComponent(ip)}/` : ''}json/`);
  return [
    `IP info: ${data.ip ?? ip ?? 'current IP'}`,
    `Location: ${[data.city, data.region, data.country_name].filter(Boolean).join(', ') || 'n/a'}`,
    `Coordinates: ${data.latitude ?? 'n/a'}, ${data.longitude ?? 'n/a'}`,
    `Timezone: ${data.timezone ?? 'n/a'}`,
    `Network: ${data.org ?? data.asn ?? 'n/a'}`,
  ].join('\n');
}

function formatPlace(place, index = null) {
  return [
    `${index == null ? '' : `${index + 1}. `}${place.display_name}`,
    `Type: ${[place.class, place.type].filter(Boolean).join('/') || 'n/a'}`,
    `Coordinates: ${place.lat}, ${place.lon}`,
    place.importance ? `Importance: ${place.importance}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function forwardGeocode(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 3, 1, 10);
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return data.length
    ? formatList(`Geocode: ${query}`, data.map(formatPlace))
    : `No geocoding results for "${query}".`;
}

async function reverseGeocode(params) {
  const lat = requireNumberParam(params, 'lat');
  const lon = requireNumberParam(params, 'lon');
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
  );
  return ['Reverse geocode', '', formatPlace(data)].join('\n');
}

async function searchPlaces(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const country = String(params.country_code ?? '')
    .trim()
    .toLowerCase();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  if (country) url.searchParams.set('countrycodes', country);
  const data = await fetchJson(url.toString());
  return data.length
    ? formatList(`Place search: ${query}`, data.map(formatPlace))
    : `No places found for "${query}".`;
}

async function getPostalCodeInfo(params) {
  const country = requireText(params, 'country_code').toLowerCase();
  const postalCode = requireText(params, 'postal_code');
  const data = await fetchJson(
    `https://api.zippopotam.us/${encodeURIComponent(country)}/${encodeURIComponent(postalCode)}`,
  );
  const places = data.places ?? [];
  return [
    `Postal code: ${postalCode}, ${data.country ?? country.toUpperCase()}`,
    '',
    ...places.map(
      (place, index) =>
        `${index + 1}. ${place['place name']}, ${place.state}\n   Coordinates: ${place.latitude}, ${place.longitude}`,
    ),
  ].join('\n');
}

async function getElevation(params) {
  const rawLocations = params.locations;
  const locations = Array.isArray(rawLocations)
    ? rawLocations
    : JSON.parse(String(rawLocations ?? '[]'));
  if (!Array.isArray(locations) || locations.length === 0)
    throw new Error('locations must be a non-empty array.');
  const safeLocations = locations.slice(0, 100).map((item) => ({
    latitude: Number(item.lat ?? item.latitude),
    longitude: Number(item.lon ?? item.longitude),
  }));
  const data = await fetchJson('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locations: safeLocations }),
  });
  return formatList(
    'Elevation results',
    (data.results ?? []).map(
      (item, index) => `${index + 1}. ${item.latitude}, ${item.longitude}: ${item.elevation} m`,
    ),
  );
}

// ── Calculator ──────────────────────────────────────────────────────────────────
function calculate(params) {
  const expression = requireText(params, 'expression');
  if (
    /import|require|process|global|\beval\b|Function|__proto__|prototype|constructor/i.test(
      expression,
    )
  ) {
    throw new Error('Expression contains disallowed keywords.');
  }
  let result;
  try {
    result = new Function(
      'Math',
      'Number',
      'Infinity',
      'NaN',
      'isFinite',
      'isNaN',
      `'use strict'; return (${expression});`,
    )(Math, Number, Infinity, NaN, isFinite, isNaN);
  } catch (error) {
    throw new Error(`Calculation error: ${error.message}`);
  }
  if (result === undefined || result === null) throw new Error('Expression returned no value.');
  return `Result: ${result}`;
}

// ── Date & Time ───────────────────────────────────────────────────────────────
function getCurrentDatetime(params) {
  const timezone =
    String(params.timezone ?? '').trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
      hour12: false,
    }).formatToParts(now);
  } catch {
    throw new Error(
      `Unknown timezone: "${timezone}". Use an IANA timezone name like "America/New_York".`,
    );
  }
  const part = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const year = Number(part('year'));
  const month = Number(part('month'));
  const day = Number(part('day'));
  const rawHour = part('hour');
  const hour = rawHour === '24' ? '00' : rawHour;
  const minute = part('minute');
  const second = part('second');
  const weekday = part('weekday');
  // ISO 8601 week number
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  // Day of year
  const dayOfYear =
    Math.round(
      (new Date(Date.UTC(year, month - 1, day)) - new Date(Date.UTC(year, 0, 1))) / 86400000,
    ) + 1;
  return [
    `Current date and time`,
    `Timezone: ${timezone}`,
    `Date: ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    `Time: ${hour}:${minute}:${second}`,
    `Day: ${weekday}`,
    `Week: ${weekNumber} of ${year}`,
    `Day of year: ${dayOfYear}`,
    `Unix timestamp: ${Math.floor(now.getTime() / 1000)}`,
  ].join('\n');
}

function dateCalculator(params) {
  const operation = requireText(params, 'operation').toLowerCase();
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parseDate = (value) => {
    const str = String(value ?? '')
      .trim()
      .toLowerCase();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (str === 'today') return new Date(today);
    if (str === 'tomorrow') {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + 1);
      return d;
    }
    if (str === 'yesterday') {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - 1);
      return d;
    }
    const parsed = new Date(`${str}T00:00:00Z`);
    if (isNaN(parsed.getTime()))
      throw new Error(`Invalid date: "${value}". Use YYYY-MM-DD format.`);
    return parsed;
  };
  if (operation === 'weekday') {
    const date = parseDate(requireText(params, 'date'));
    return [
      `Day of week`,
      `Date: ${date.toISOString().slice(0, 10)}`,
      `Day: ${WEEKDAYS[date.getUTCDay()]}`,
    ].join('\n');
  }
  if (operation === 'diff') {
    const date1 = parseDate(requireText(params, 'date'));
    const date2 = parseDate(requireText(params, 'date2'));
    const diffDays = Math.round((date2 - date1) / 86400000);
    const absDays = Math.abs(diffDays);
    return [
      `Date difference`,
      `From: ${date1.toISOString().slice(0, 10)} (${WEEKDAYS[date1.getUTCDay()]})`,
      `To: ${date2.toISOString().slice(0, 10)} (${WEEKDAYS[date2.getUTCDay()]})`,
      `Difference: ${diffDays} days`,
      `Weeks: ${Math.floor(absDays / 7)} weeks and ${absDays % 7} days`,
      `Months (approx): ${(absDays / 30.44).toFixed(1)}`,
    ].join('\n');
  }
  if (operation === 'add') {
    const date = parseDate(requireText(params, 'date'));
    const days = Number(params.days ?? 0);
    const months = Number(params.months ?? 0);
    const years = Number(params.years ?? 0);
    const result = new Date(date);
    if (years) result.setUTCFullYear(result.getUTCFullYear() + years);
    if (months) result.setUTCMonth(result.getUTCMonth() + months);
    if (days) result.setUTCDate(result.getUTCDate() + days);
    const diffDays = Math.round((result - date) / 86400000);
    const parts = [
      years ? `${years} year(s)` : null,
      months ? `${months} month(s)` : null,
      days ? `${days} day(s)` : null,
    ].filter(Boolean);
    return [
      `Date calculation`,
      `Start: ${date.toISOString().slice(0, 10)} (${WEEKDAYS[date.getUTCDay()]})`,
      `Added: ${parts.join(', ') || 'nothing'}`,
      `Result: ${result.toISOString().slice(0, 10)} (${WEEKDAYS[result.getUTCDay()]})`,
      `Total change: ${diffDays} days`,
    ].join('\n');
  }
  throw new Error('operation must be "diff", "add", or "weekday".');
}

// ── arXiv ──────────────────────────────────────────────────────────────────────
function parseAtomXml(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = match[1];
    const text = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? stripHtml(m[1]) : '';
    };
    const attr = (tag, attribute) => {
      const m = block.match(new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]*)"[^>]*(?:\\/>|>)`));
      return m ? m[1] : '';
    };
    const allAuthors = [
      ...block.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g),
    ].map((m) => m[1].trim());
    const rawId = text('id');
    const id = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, '');
    entries.push({
      id,
      title: text('title').replace(/\s+/g, ' '),
      summary: text('summary').replace(/\s+/g, ' '),
      authors: allAuthors,
      published: text('published').slice(0, 10),
      link: attr('link', 'href') || `https://arxiv.org/abs/${id}`,
    });
  }
  return entries;
}

async function searchArxiv(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const category = String(params.category ?? '').trim();
  const encodedQuery = encodeURIComponent(query);
  const searchQuery = category
    ? `cat:${encodeURIComponent(category)}+AND+all:${encodedQuery}`
    : `all:${encodedQuery}`;
  const xml = await fetchText(
    `https://export.arxiv.org/api/query?search_query=${searchQuery}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`,
    { headers: { accept: 'application/xml' } },
  );
  const entries = parseAtomXml(xml);
  if (!entries.length) return `No arXiv papers found for "${query}".`;
  const rows = entries.map((entry) =>
    [
      entry.title,
      `Authors: ${entry.authors.slice(0, 3).join(', ')}${entry.authors.length > 3 ? ` +${entry.authors.length - 3} more` : ''}`,
      `Published: ${entry.published}`,
      `Abstract: ${entry.summary.slice(0, 300)}${entry.summary.length > 300 ? '...' : ''}`,
      `Link: https://arxiv.org/abs/${entry.id}`,
    ].join('\n   '),
  );
  return formatList(`arXiv search: ${query}`, rows);
}

async function getArxivPaper(params) {
  const id = requireText(params, 'id').replace(/^https?:\/\/arxiv\.org\/abs\//, '');
  const xml = await fetchText(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    { headers: { accept: 'application/xml' } },
  );
  const entries = parseAtomXml(xml);
  const entry = entries[0];
  if (!entry?.title) throw new Error(`arXiv paper not found: ${id}`);
  return [
    `arXiv: ${entry.title}`,
    `ID: ${entry.id}`,
    `Authors: ${entry.authors.join(', ')}`,
    `Published: ${entry.published}`,
    `Link: https://arxiv.org/abs/${entry.id}`,
    '',
    'Abstract:',
    entry.summary,
  ].join('\n');
}

// ── Reddit ────────────────────────────────────────────────────────────────────
async function getRedditPosts(params) {
  const subreddit = requireText(params, 'subreddit').replace(/^r\//, '');
  const sort = ['hot', 'new', 'top', 'rising'].includes(String(params.sort ?? 'hot').toLowerCase())
    ? String(params.sort).toLowerCase()
    : 'hot';
  const limit = clampInteger(params.limit, 10, 1, 25);
  const data = await fetchJson(
    `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort}.json?limit=${limit}`,
  );
  const posts = data?.data?.children ?? [];
  if (!posts.length) return `No posts found in r/${subreddit}.`;
  const rows = posts.map(({ data: post }) =>
    [
      post.title,
      `Score: ${post.score ?? 0}, comments: ${post.num_comments ?? 0}`,
      post.selftext
        ? `Text: ${post.selftext.slice(0, 200)}${post.selftext.length > 200 ? '...' : ''}`
        : null,
      `Link: https://reddit.com${post.permalink}`,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`r/${subreddit} (${sort})`, rows);
}

async function searchReddit(params) {
  const query = requireText(params, 'query');
  const subreddit = String(params.subreddit ?? '')
    .trim()
    .replace(/^r\//, '');
  const sort = ['relevance', 'hot', 'new', 'top'].includes(
    String(params.sort ?? 'relevance').toLowerCase(),
  )
    ? String(params.sort).toLowerCase()
    : 'relevance';
  const limit = clampInteger(params.limit, 10, 1, 25);
  const base = subreddit
    ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json`
    : 'https://www.reddit.com/search.json';
  const url = new URL(base);
  url.searchParams.set('q', query);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', String(limit));
  if (!subreddit) url.searchParams.set('restrict_sr', '0');
  const data = await fetchJson(url.toString());
  const posts = data?.data?.children ?? [];
  if (!posts.length) return `No Reddit results for "${query}".`;
  const rows = posts.map(({ data: post }) =>
    [
      post.title,
      `r/${post.subreddit} — Score: ${post.score ?? 0}, comments: ${post.num_comments ?? 0}`,
      `Link: https://reddit.com${post.permalink}`,
    ].join('\n   '),
  );
  return formatList(`Reddit search: ${query}`, rows);
}

// ── Open Library ─────────────────────────────────────────────────────────────
async function searchBooks(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const data = await fetchJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year,number_of_pages_median,isbn,subject`,
  );
  const docs = data.docs ?? [];
  if (!docs.length) return `No books found for "${query}".`;
  const rows = docs.map((book) =>
    [
      book.title,
      `Author: ${(book.author_name ?? []).slice(0, 2).join(', ') || 'Unknown'}`,
      book.first_publish_year ? `Year: ${book.first_publish_year}` : null,
      book.number_of_pages_median ? `Pages: ${book.number_of_pages_median}` : null,
      book.isbn?.[0] ? `ISBN: ${book.isbn[0]}` : null,
      book.subject?.length ? `Subjects: ${book.subject.slice(0, 3).join(', ')}` : null,
      `Link: https://openlibrary.org${book.key}`,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`Book search: ${query}`, rows);
}

async function getBookByIsbn(params) {
  const isbn = requireText(params, 'isbn').replace(/[\s\-]/g, '');
  const data = await fetchJson(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`,
  );
  const book = data[`ISBN:${isbn}`];
  if (!book) throw new Error(`No book found for ISBN ${isbn}.`);
  const details = book.details ?? {};
  return [
    `Book: ${details.title ?? 'Unknown'}`,
    `Authors: ${(details.authors ?? []).map((a) => a.name).join(', ') || 'Unknown'}`,
    `ISBN: ${isbn}`,
    `Publisher: ${(details.publishers ?? []).join(', ') || 'n/a'}`,
    `Published: ${details.publish_date ?? 'n/a'}`,
    `Pages: ${details.number_of_pages ?? 'n/a'}`,
    `Subjects: ${
      (details.subjects ?? [])
        .slice(0, 5)
        .map((s) => (typeof s === 'string' ? s : s.name))
        .join(', ') || 'n/a'
    }`,
    `Link: ${book.info_url ?? `https://openlibrary.org/isbn/${isbn}`}`,
  ].join('\n');
}

// ── World Bank ────────────────────────────────────────────────────────────────
const WORLD_BANK_INDICATORS = Object.freeze({
  gdp: 'NY.GDP.MKTP.CD',
  gdp_per_capita: 'NY.GDP.PCAP.CD',
  gdp_growth: 'NY.GDP.MKTP.KD.ZG',
  population: 'SP.POP.TOTL',
  inflation: 'FP.CPI.TOTL.ZG',
  unemployment: 'SL.UEM.TOTL.ZS',
  co2: 'EN.ATM.CO2E.PC',
  life_expectancy: 'SP.DYN.LE00.IN',
  internet_usage: 'IT.NET.USER.ZS',
  literacy: 'SE.ADT.LITR.ZS',
  exports: 'NE.EXP.GNFS.ZS',
  imports: 'NE.IMP.GNFS.ZS',
});

async function fetchWorldBankIndicator(countryCode, indicatorCode, years) {
  const data = await fetchJson(
    `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${indicatorCode}?format=json&mrv=${years}&per_page=${years}`,
  );
  const rows = Array.isArray(data) ? data[1] : null;
  return (rows ?? []).filter((row) => row.value != null).slice(0, years);
}

async function getWorldBankData(params) {
  const countryInput = requireText(params, 'country');
  const years = clampInteger(params.years, 5, 1, 20);
  let countryCode;
  if (countryInput.length <= 3) {
    countryCode = countryInput.toUpperCase();
  } else {
    const search = await fetchJson(
      `https://api.worldbank.org/v2/country?name=${encodeURIComponent(countryInput)}&format=json&per_page=5`,
    ).catch(() => null);
    const countries = Array.isArray(search) ? search[1] : null;
    countryCode = countries?.[0]?.id ?? countryInput.slice(0, 3).toUpperCase();
  }
  const indicatorInput = String(params.indicator ?? '')
    .trim()
    .toLowerCase();
  if (!indicatorInput) {
    const summaryIndicators = [
      { name: 'GDP (current USD)', code: WORLD_BANK_INDICATORS.gdp },
      { name: 'GDP per capita (USD)', code: WORLD_BANK_INDICATORS.gdp_per_capita },
      { name: 'Population', code: WORLD_BANK_INDICATORS.population },
      { name: 'Inflation (%)', code: WORLD_BANK_INDICATORS.inflation },
      { name: 'Unemployment (%)', code: WORLD_BANK_INDICATORS.unemployment },
      { name: 'Life expectancy (years)', code: WORLD_BANK_INDICATORS.life_expectancy },
    ];
    const results = await Promise.all(
      summaryIndicators.map(async (indicator) => {
        const rows = await fetchWorldBankIndicator(countryCode, indicator.code, 1).catch(() => []);
        const latest = rows[0];
        return latest
          ? `${indicator.name}: ${Number(latest.value).toLocaleString('en-US')} (${latest.date})`
          : `${indicator.name}: n/a`;
      }),
    );
    return [`World Bank data: ${countryInput} (${countryCode})`, '', ...results].join('\n');
  }
  const resolvedCode = WORLD_BANK_INDICATORS[indicatorInput] ?? indicatorInput.toUpperCase();
  const rows = await fetchWorldBankIndicator(countryCode, resolvedCode, years);
  if (!rows.length)
    throw new Error(
      `No World Bank data found for country "${countryInput}", indicator "${indicatorInput}".`,
    );
  const indicatorName = rows[0]?.indicator?.value ?? resolvedCode;
  return [
    `World Bank: ${indicatorName}`,
    `Country: ${rows[0]?.country?.value ?? countryInput} (${countryCode})`,
    '',
    ...rows.map((row) => `${row.date}: ${Number(row.value).toLocaleString('en-US')}`),
  ].join('\n');
}

// ── USGS Earthquakes ─────────────────────────────────────────────────────────
async function getEarthquakes(params) {
  const minMagnitude = Number(params.min_magnitude ?? 4.0);
  const limit = clampInteger(params.limit, 10, 1, 50);
  const days = clampInteger(params.days, 7, 1, 30);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - days * 86400000);
  const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('starttime', startTime.toISOString().slice(0, 10));
  url.searchParams.set('endtime', endTime.toISOString().slice(0, 10));
  url.searchParams.set('minmagnitude', String(minMagnitude));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('orderby', 'magnitude');
  if (params.lat != null && params.lon != null) {
    url.searchParams.set('latitude', String(requireNumberParam(params, 'lat')));
    url.searchParams.set('longitude', String(requireNumberParam(params, 'lon')));
    url.searchParams.set('maxradiuskm', String(clampInteger(params.radius_km, 500, 1, 20000)));
  }
  const data = await fetchJson(url.toString());
  const features = data.features ?? [];
  if (!features.length)
    return `No earthquakes found with magnitude >= ${minMagnitude} in the past ${days} days.`;
  const rows = features.map((feature) => {
    const props = feature.properties ?? {};
    const time = new Date(props.time ?? 0).toISOString().slice(0, 19).replace('T', ' ');
    const depth = feature.geometry?.coordinates?.[2];
    return [
      `M${props.mag?.toFixed(1) ?? 'n/a'} — ${props.place ?? 'Unknown location'}`,
      `Time: ${time} UTC`,
      `Depth: ${depth != null ? `${depth} km` : 'n/a'}, Status: ${props.status ?? 'n/a'}`,
      `Link: ${props.url ?? 'https://earthquake.usgs.gov/earthquakes/map/'}`,
    ].join('\n   ');
  });
  return formatList(`Recent earthquakes (past ${days} days, M >= ${minMagnitude})`, rows);
}

// ── Open Food Facts ──────────────────────────────────────────────────────────
async function searchFood(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const data = await fetchJson(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=product_name,brands,nutriscore_grade,nutriments,categories_tags`,
  );
  const products = (data.products ?? []).filter((p) => p.product_name);
  if (!products.length) return `No food products found for "${query}".`;
  const rows = products.slice(0, limit).map((product) => {
    const n = product.nutriments ?? {};
    const parts = [
      product.product_name,
      product.brands ? `Brand: ${product.brands.split(',')[0].trim()}` : null,
      product.nutriscore_grade ? `Nutri-Score: ${product.nutriscore_grade.toUpperCase()}` : null,
      [
        n['energy-kcal_100g'] != null ? `Cal: ${Math.round(n['energy-kcal_100g'])} kcal` : null,
        n['fat_100g'] != null ? `Fat: ${n['fat_100g']} g` : null,
        n['carbohydrates_100g'] != null ? `Carbs: ${n['carbohydrates_100g']} g` : null,
        n['proteins_100g'] != null ? `Protein: ${n['proteins_100g']} g` : null,
        n['sugars_100g'] != null ? `Sugars: ${n['sugars_100g']} g` : null,
        n['salt_100g'] != null ? `Salt: ${n['salt_100g']} g` : null,
      ]
        .filter(Boolean)
        .join(', ') || null,
    ].filter(Boolean);
    return parts.join('\n   ');
  });
  return formatList(`Food search: ${query}`, rows);
}

async function getFoodByBarcode(params) {
  const barcode = requireText(params, 'barcode').replace(/\s/g, '');
  const data = await fetchJson(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
  );
  if (data.status === 0) throw new Error(`No product found for barcode ${barcode}.`);
  const product = data.product ?? {};
  const n = product.nutriments ?? {};
  const macros = [
    n['energy-kcal_100g'] != null ? `Calories: ${Math.round(n['energy-kcal_100g'])} kcal` : null,
    n['fat_100g'] != null ? `Fat: ${n['fat_100g']} g` : null,
    n['saturated-fat_100g'] != null ? `Saturated fat: ${n['saturated-fat_100g']} g` : null,
    n['carbohydrates_100g'] != null ? `Carbs: ${n['carbohydrates_100g']} g` : null,
    n['sugars_100g'] != null ? `Sugars: ${n['sugars_100g']} g` : null,
    n['fiber_100g'] != null ? `Fiber: ${n['fiber_100g']} g` : null,
    n['proteins_100g'] != null ? `Protein: ${n['proteins_100g']} g` : null,
    n['salt_100g'] != null ? `Salt: ${n['salt_100g']} g` : null,
  ].filter(Boolean);
  return [
    `Product: ${product.product_name ?? 'Unknown'}`,
    `Brand: ${product.brands ?? 'n/a'}`,
    `Barcode: ${barcode}`,
    `Nutri-Score: ${product.nutriscore_grade ? product.nutriscore_grade.toUpperCase() : 'n/a'}`,
    `NOVA group: ${product.nova_group ?? 'n/a'}`,
    `Quantity: ${product.quantity ?? 'n/a'}`,
    `Ingredients: ${(product.ingredients_text ?? 'n/a').slice(0, 300)}`,
    '',
    'Nutrition per 100g:',
    ...macros,
    '',
    `Link: https://world.openfoodfacts.org/product/${barcode}`,
  ].join('\n');
}

// ── Wikidata ───────────────────────────────────────────────────────────────
async function searchWikidata(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const data = await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=${limit}&format=json&origin=*`,
  );
  const results = data.search ?? [];
  if (!results.length) return `No Wikidata entities found for "${query}".`;
  const rows = results.map(
    (entity) =>
      `${entity.label ?? entity.id} (${entity.id})\n   ${entity.description ?? 'No description'}\n   https://www.wikidata.org/wiki/${entity.id}`,
  );
  return formatList(`Wikidata search: ${query}`, rows);
}

async function getWikidataEntity(params) {
  const id = requireText(params, 'id').toUpperCase();
  const data = await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(id)}&props=labels|descriptions|aliases|sitelinks|claims&languages=en&format=json&origin=*`,
  );
  const entity = data.entities?.[id];
  if (!entity || entity.missing !== undefined) throw new Error(`Wikidata entity not found: ${id}`);

  const label = entity.labels?.en?.value ?? id;
  const description = entity.descriptions?.en?.value ?? 'n/a';
  const aliases = (entity.aliases?.en ?? []).map((a) => a.value).slice(0, 5);
  const wpTitle = entity.sitelinks?.enwiki?.title;
  const wpLink = wpTitle
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wpTitle.replace(/ /g, '_'))}`
    : null;

  // Key properties to surface
  const KEY_PROPS = {
    P31: 'Instance of',
    P21: 'Sex / gender',
    P569: 'Date of birth',
    P570: 'Date of death',
    P19: 'Place of birth',
    P20: 'Place of death',
    P27: 'Country of citizenship',
    P106: 'Occupation',
    P800: 'Notable work',
    P166: 'Award received',
    P69: 'Educated at',
    P26: 'Spouse',
    P40: 'Child',
    P22: 'Father',
    P25: 'Mother',
    P856: 'Official website',
  };

  const claims = entity.claims ?? {};
  const qidsToResolve = new Set();
  const claimData = {};

  for (const [prop, propLabel] of Object.entries(KEY_PROPS)) {
    if (!claims[prop]) continue;
    const values = [];
    for (const claim of (claims[prop] ?? []).slice(0, 5)) {
      const snak = claim.mainsnak;
      if (snak.snaktype !== 'value') continue;
      const dv = snak.datavalue;
      if (dv.type === 'wikibase-entityid') {
        const qid = dv.value.id;
        qidsToResolve.add(qid);
        values.push({ type: 'entity', qid });
      } else if (dv.type === 'time') {
        const match = String(dv.value.time ?? '').match(/^[+-]?(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, year, month, day] = match;
          const precision = dv.value.precision ?? 11;
          values.push({
            type: 'string',
            value:
              precision >= 11
                ? `${year}-${month}-${day}`
                : precision >= 10
                  ? `${year}-${month}`
                  : year,
          });
        }
      } else if (dv.type === 'monolingualtext') {
        values.push({ type: 'string', value: dv.value?.text ?? '' });
      } else if (typeof dv.value === 'string') {
        values.push({ type: 'string', value: dv.value });
      }
    }
    if (values.length) claimData[prop] = { propLabel, values };
  }

  // Batch-resolve entity QID labels
  const entityLabels = {};
  if (qidsToResolve.size > 0) {
    const qidList = [...qidsToResolve].slice(0, 50).join('|');
    const labelData = await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qidList)}&props=labels&languages=en&format=json&origin=*`,
    ).catch(() => null);
    for (const [qid, ent] of Object.entries(labelData?.entities ?? {})) {
      entityLabels[qid] = ent.labels?.en?.value ?? qid;
    }
  }

  const lines = [
    `Wikidata entity: ${label} (${id})`,
    `Description: ${description}`,
    aliases.length ? `Also known as: ${aliases.join(', ')}` : null,
    '',
  ];

  for (const { propLabel, values } of Object.values(claimData)) {
    const resolved = values.map((v) =>
      v.type === 'entity' ? (entityLabels[v.qid] ?? v.qid) : v.value,
    );
    lines.push(`${propLabel}: ${resolved.join(', ')}`);
  }

  lines.push('');
  if (wpLink) lines.push(`Wikipedia: ${wpLink}`);
  lines.push(`Wikidata: https://www.wikidata.org/wiki/${id}`);

  return lines.filter((l) => l !== null).join('\n');
}

// ── WHO Global Health Observatory ───────────────────────────────────────────
async function listWhoIndicators(params) {
  const search = String(params.search ?? '').trim();
  const limit = clampInteger(params.limit, 15, 1, 50);
  const filterParam = search
    ? `?$filter=contains(tolower(IndicatorName),tolower('${encodeURIComponent(search)}'))&$top=${limit}`
    : `?$top=${limit}`;
  const data = await fetchJson(`https://ghoapi.azureedge.net/api/Indicator${filterParam}`);
  const indicators = data.value ?? [];
  if (!indicators.length)
    return search ? `No WHO indicators matching "${search}".` : 'No WHO indicators found.';
  const rows = indicators
    .slice(0, limit)
    .map((ind) => `${ind.IndicatorCode}: ${ind.IndicatorName}`);
  return formatList(search ? `WHO indicators matching "${search}"` : 'WHO indicators', rows);
}

async function getWhoHealthData(params) {
  const indicator = requireText(params, 'indicator').toUpperCase();
  const country = String(params.country ?? '')
    .trim()
    .toUpperCase();
  const limit = clampInteger(params.limit, 10, 1, 30);
  const filterParam = country
    ? `?$filter=SpatialDim eq '${country}'&$top=${limit}&$orderby=TimeDim desc`
    : `?$top=${limit}&$orderby=TimeDim desc`;
  const data = await fetchJson(
    `https://ghoapi.azureedge.net/api/${encodeURIComponent(indicator)}${filterParam}`,
  );
  const rows = data.value ?? [];
  if (!rows.length)
    return `No WHO data found for indicator "${indicator}"${country ? ` in country "${country}"` : ''}.`;
  const formatted = rows
    .slice(0, limit)
    .map(
      (row) =>
        `${row.TimeDim ?? 'n/a'} | ${row.SpatialDim ?? 'n/a'} | ${
          row.NumericValue != null
            ? Number(row.NumericValue).toLocaleString('en-US', { maximumFractionDigits: 2 })
            : (row.Value ?? 'n/a')
        }`,
    );
  return [
    `WHO: ${indicator}${country ? ` — ${country}` : ''}`,
    'Year | Country | Value',
    '',
    ...formatted,
  ].join('\n');
}

// ── PubChem ─────────────────────────────────────────────────────────────────
async function searchCompound(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 10);
  const propData = await fetchJson(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/MolecularFormula,MolecularWeight,IUPACName,IsomericSMILES/JSON?MaxRecords=${limit}`,
  ).catch(() => null);
  const compounds = propData?.PropertyTable?.Properties ?? [];
  if (!compounds.length) return `No PubChem compounds found for "${query}".`;
  const rows = compounds
    .slice(0, limit)
    .map((c) =>
      [
        `CID: ${c.CID}`,
        `Formula: ${c.MolecularFormula ?? 'n/a'}, MW: ${c.MolecularWeight ?? 'n/a'} g/mol`,
        `IUPAC: ${c.IUPACName ?? 'n/a'}`,
        `SMILES: ${(c.IsomericSMILES ?? 'n/a').slice(0, 80)}`,
        `Link: https://pubchem.ncbi.nlm.nih.gov/compound/${c.CID}`,
      ].join('\n   '),
    );
  return formatList(`PubChem search: ${query}`, rows);
}

async function getCompoundInfo(params) {
  const cid = requireText(params, 'cid').replace(/\D/g, '');
  if (!cid) throw new Error('Invalid CID.');
  const [props, synonyms] = await Promise.all([
    fetchJson(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,IsomericSMILES,InChIKey,Charge,XLogP,ExactMass/JSON`,
    ).catch(() => null),
    fetchJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`).catch(
      () => null,
    ),
  ]);
  const p = props?.PropertyTable?.Properties?.[0];
  if (!p) throw new Error(`No PubChem compound found for CID ${cid}.`);
  const names = (synonyms?.InformationList?.Information?.[0]?.Synonym ?? []).slice(0, 5);
  return [
    `PubChem compound: CID ${cid}`,
    `IUPAC name: ${p.IUPACName ?? 'n/a'}`,
    names.length ? `Common names: ${names.join(', ')}` : null,
    `Molecular formula: ${p.MolecularFormula ?? 'n/a'}`,
    `Molecular weight: ${p.MolecularWeight ?? 'n/a'} g/mol`,
    `Exact mass: ${p.ExactMass ?? 'n/a'}`,
    `XLogP: ${p.XLogP ?? 'n/a'}`,
    `InChIKey: ${p.InChIKey ?? 'n/a'}`,
    `SMILES: ${(p.IsomericSMILES ?? 'n/a').slice(0, 120)}`,
    `Link: https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Crossref ───────────────────────────────────────────────────────────────
const CROSSREF_HEADERS = Object.freeze({
  'User-Agent': 'Joanium/2026 (mailto:support@joanium.com)',
});

async function searchCrossref(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const type = String(params.type ?? '')
    .trim()
    .toLowerCase();
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query', query);
  url.searchParams.set('rows', String(limit));
  url.searchParams.set(
    'select',
    'DOI,title,author,published-print,published-online,container-title,type,URL,is-referenced-by-count',
  );
  if (type && type !== 'all') url.searchParams.set('filter', `type:${type}`);
  const data = await fetchJson(url.toString(), { headers: CROSSREF_HEADERS });
  const items = data.message?.items ?? [];
  if (!items.length) return `No Crossref works found for "${query}".`;
  const rows = items.map((item) => {
    const title = Array.isArray(item.title) ? item.title[0] : (item.title ?? 'Untitled');
    const authorList = item.author ?? [];
    const authors = authorList
      .slice(0, 3)
      .map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim())
      .join(', ');
    const year =
      item['published-print']?.['date-parts']?.[0]?.[0] ??
      item['published-online']?.['date-parts']?.[0]?.[0] ??
      'n/a';
    const journal = Array.isArray(item['container-title'])
      ? item['container-title'][0]
      : (item['container-title'] ?? 'n/a');
    const citations = item['is-referenced-by-count'] ?? 0;
    return [
      title,
      authors
        ? `Authors: ${authors}${authorList.length > 3 ? ` +${authorList.length - 3} more` : ''}`
        : null,
      `Year: ${year} | Journal: ${journal}`,
      `Citations: ${citations} | Type: ${item.type ?? 'n/a'}`,
      `DOI: ${item.DOI ?? 'n/a'} | ${item.URL ?? `https://doi.org/${item.DOI}`}`,
    ]
      .filter(Boolean)
      .join('\n   ');
  });
  return formatList(`Crossref search: ${query}`, rows);
}

async function getDoiInfo(params) {
  const doi = requireText(params, 'doi').replace(/^https?:\/\/doi\.org\//, '');
  const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: CROSSREF_HEADERS,
  });
  const item = data.message ?? {};
  const title = Array.isArray(item.title) ? item.title[0] : (item.title ?? 'Untitled');
  const authors = (item.author ?? [])
    .map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim())
    .join(', ');
  const year =
    item['published-print']?.['date-parts']?.[0]?.[0] ??
    item['published-online']?.['date-parts']?.[0]?.[0] ??
    'n/a';
  const journal = Array.isArray(item['container-title'])
    ? item['container-title'][0]
    : (item['container-title'] ?? 'n/a');
  return [
    `Crossref: ${title}`,
    `Authors: ${authors || 'n/a'}`,
    `Published: ${year}`,
    `Journal/Source: ${journal}`,
    `Type: ${item.type ?? 'n/a'}`,
    `Publisher: ${item.publisher ?? 'n/a'}`,
    `Citations: ${item['is-referenced-by-count'] ?? 0}`,
    `References: ${item['references-count'] ?? 0}`,
    `DOI: ${item.DOI ?? doi}`,
    `URL: ${item.URL ?? `https://doi.org/${doi}`}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function searchOpenAlexWorks(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', String(limit));
  url.searchParams.set('sort', 'cited_by_count:desc');
  const data = await fetchJson(url.toString());
  const works = data.results ?? [];
  if (!works.length) return `No OpenAlex works found for "${query}".`;
  const rows = works.map((work) => {
    const authors = (work.authorships ?? [])
      .slice(0, 3)
      .map((entry) => entry.author?.display_name)
      .filter(Boolean)
      .join(', ');
    const source = work.primary_location?.source?.display_name ?? 'n/a';
    return [
      work.display_name ?? 'Untitled',
      authors ? `Authors: ${authors}` : null,
      `Year: ${work.publication_year ?? 'n/a'} | Source: ${source}`,
      `Citations: ${work.cited_by_count ?? 0}`,
      `DOI: ${work.doi ?? 'n/a'}`,
      `OpenAlex: ${work.id ?? 'n/a'}`,
    ]
      .filter(Boolean)
      .join('\n   ');
  });
  return formatList(`OpenAlex works: ${query}`, rows);
}

async function searchEuropePmc(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('pageSize', String(limit));
  const data = await fetchJson(url.toString());
  const results = data.resultList?.result ?? [];
  if (!results.length) return `No Europe PMC papers found for "${query}".`;
  const rows = results.map((item) =>
    [
      item.title ?? 'Untitled',
      item.authorString ? `Authors: ${item.authorString}` : null,
      `Year: ${item.pubYear ?? 'n/a'} | Journal: ${item.journalTitle ?? 'n/a'}`,
      `Citations: ${item.citedByCount ?? 0}`,
      `PMID: ${item.pmid ?? 'n/a'} | DOI: ${item.doi ?? 'n/a'}`,
      `Link: ${item.fullTextUrlList?.fullTextUrl?.[0]?.url ?? `https://europepmc.org/article/${item.source}/${item.id}`}`,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`Europe PMC: ${query}`, rows);
}

async function searchClinicalTrials(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://clinicaltrials.gov/api/v2/studies');
  url.searchParams.set('query.term', query);
  url.searchParams.set('pageSize', String(limit));
  const data = await fetchJson(url.toString());
  const studies = data.studies ?? [];
  if (!studies.length) return `No ClinicalTrials.gov studies found for "${query}".`;
  const rows = studies.map((study) => {
    const protocol = study.protocolSection ?? {};
    const id = protocol.identificationModule?.nctId ?? 'n/a';
    const conditions = (protocol.conditionsModule?.conditions ?? []).slice(0, 4).join(', ');
    const phases = (protocol.designModule?.phases ?? []).join(', ') || 'n/a';
    const locations = (protocol.contactsLocationsModule?.locations ?? [])
      .slice(0, 2)
      .map((loc) => [loc.city, loc.state, loc.country].filter(Boolean).join(', '))
      .filter(Boolean)
      .join(' | ');
    return [
      protocol.identificationModule?.briefTitle ?? id,
      `NCT ID: ${id} | Status: ${protocol.statusModule?.overallStatus ?? 'n/a'}`,
      conditions ? `Conditions: ${conditions}` : null,
      `Phase: ${phases}`,
      locations ? `Locations: ${locations}` : null,
      `Link: https://clinicaltrials.gov/study/${id}`,
    ]
      .filter(Boolean)
      .join('\n   ');
  });
  return formatList(`ClinicalTrials.gov: ${query}`, rows);
}

async function searchDrugLabels(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 3, 1, 10);
  const labelQuery = `openfda.brand_name:"${query}" OR openfda.generic_name:"${query}"`;
  const url = new URL('https://api.fda.gov/drug/label.json');
  url.searchParams.set('search', labelQuery);
  url.searchParams.set('limit', String(limit));
  const data = await fetchJson(url.toString()).catch(async () => {
    const fallback = new URL('https://api.fda.gov/drug/label.json');
    fallback.searchParams.set('search', query);
    fallback.searchParams.set('limit', String(limit));
    return fetchJson(fallback.toString());
  });
  const labels = data.results ?? [];
  if (!labels.length) return `No openFDA drug labels found for "${query}".`;
  const rows = labels.map((label) => {
    const fda = label.openfda ?? {};
    const warnings = (label.warnings ?? label.warnings_and_cautions ?? []).join(' ');
    return [
      (fda.brand_name ?? fda.generic_name ?? ['Unknown drug']).slice(0, 3).join(', '),
      `Generic: ${(fda.generic_name ?? ['n/a']).slice(0, 3).join(', ')}`,
      `Manufacturer: ${(fda.manufacturer_name ?? ['n/a']).slice(0, 2).join(', ')}`,
      warnings ? `Warnings: ${stripHtml(warnings).slice(0, 260)}` : null,
      `Set ID: ${label.set_id ?? 'n/a'}`,
    ]
      .filter(Boolean)
      .join('\n   ');
  });
  return formatList(`openFDA drug labels: ${query}`, rows);
}

async function searchRxNormDrugs(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 8, 1, 20);
  const data = await fetchJson(
    `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`,
  );
  const concepts = (data.drugGroup?.conceptGroup ?? [])
    .flatMap((group) =>
      (group.conceptProperties ?? []).map((concept) => ({
        ...concept,
        tty: concept.tty ?? group.tty,
      })),
    )
    .slice(0, limit);
  if (!concepts.length) return `No RxNorm concepts found for "${query}".`;
  const rows = concepts.map((concept) =>
    [
      concept.name ?? 'Unnamed concept',
      `RXCUI: ${concept.rxcui ?? 'n/a'} | TTY: ${concept.tty ?? 'n/a'}`,
      concept.synonym ? `Synonym: ${concept.synonym}` : null,
      `Link: https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${concept.rxcui}`,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`RxNorm drugs: ${query}`, rows);
}

async function searchSpecies(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 8, 1, 20);
  const url = new URL('https://api.gbif.org/v1/species/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  const data = await fetchJson(url.toString());
  const species = data.results ?? [];
  if (!species.length) return `No GBIF species found for "${query}".`;
  const rows = species.map((item) =>
    [
      item.scientificName ?? item.canonicalName ?? 'Unnamed taxon',
      `Rank: ${item.rank ?? 'n/a'} | Status: ${item.taxonomicStatus ?? 'n/a'}`,
      `Kingdom: ${item.kingdom ?? 'n/a'} | Family: ${item.family ?? 'n/a'}`,
      `GBIF key: ${item.key ?? 'n/a'} | https://www.gbif.org/species/${item.key}`,
    ].join('\n   '),
  );
  return formatList(`GBIF species: ${query}`, rows);
}

async function searchINaturalistObservations(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('taxon_name', query);
  url.searchParams.set('order_by', 'observed_on');
  url.searchParams.set('per_page', String(limit));
  const data = await fetchJson(url.toString());
  const observations = data.results ?? [];
  if (!observations.length) return `No iNaturalist observations found for "${query}".`;
  const rows = observations.map((item) => {
    const taxon = item.taxon ?? {};
    const name = taxon.preferred_common_name
      ? `${taxon.preferred_common_name} (${taxon.name})`
      : (taxon.name ?? query);
    return [
      name,
      `Observed: ${item.observed_on ?? 'n/a'} | Quality: ${item.quality_grade ?? 'n/a'}`,
      `Place: ${item.place_guess ?? 'n/a'}`,
      `Link: ${item.uri ?? `https://www.inaturalist.org/observations/${item.id}`}`,
    ].join('\n   ');
  });
  return formatList(`iNaturalist observations: ${query}`, rows);
}

async function searchGdeltNews(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'ArtList');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', String(limit));
  url.searchParams.set('sort', 'DateDesc');
  const timespan = String(params.timespan ?? '').trim();
  if (/^\d+[dmh]$/i.test(timespan)) url.searchParams.set('timespan', timespan);
  const data = await fetchJson(url.toString());
  const articles = data.articles ?? [];
  if (!articles.length) return `No GDELT articles found for "${query}".`;
  const rows = articles.map((article) =>
    [
      article.title ?? 'Untitled',
      `Source: ${article.domain ?? 'n/a'} | Language: ${article.language ?? 'n/a'}`,
      `Date: ${article.seendate ?? 'n/a'}`,
      `URL: ${article.url ?? 'n/a'}`,
    ].join('\n   '),
  );
  return formatList(`GDELT news: ${query}`, rows);
}

async function searchFederalRegister(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://www.federalregister.gov/api/v1/documents.json');
  url.searchParams.set('conditions[term]', query);
  url.searchParams.set('order', 'newest');
  url.searchParams.set('per_page', String(limit));
  const data = await fetchJson(url.toString());
  const documents = data.results ?? [];
  if (!documents.length) return `No Federal Register documents found for "${query}".`;
  const rows = documents.map((doc) =>
    [
      doc.title ?? 'Untitled',
      `Date: ${doc.publication_date ?? 'n/a'} | Type: ${doc.type ?? 'n/a'}`,
      `Agencies: ${(doc.agencies ?? []).map((agency) => agency.name).join(', ') || 'n/a'}`,
      `Citation: ${doc.citation ?? 'n/a'}`,
      `URL: ${doc.html_url ?? doc.pdf_url ?? 'n/a'}`,
    ].join('\n   '),
  );
  return formatList(`Federal Register: ${query}`, rows);
}

async function searchSecCompanies(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 8, 1, 25);
  const data = await fetchJson('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'Joanium/2026 support@joanium.local' },
  });
  const needle = query.toLowerCase();
  const companies = Object.values(data)
    .filter((company) => {
      const cik = String(company.cik_str ?? '');
      return (
        String(company.ticker ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(company.title ?? '')
          .toLowerCase()
          .includes(needle) ||
        cik.includes(needle.replace(/^0+/, ''))
      );
    })
    .slice(0, limit);
  if (!companies.length) return `No SEC company records found for "${query}".`;
  const rows = companies.map((company) => {
    const cik = String(company.cik_str ?? '').padStart(10, '0');
    return [
      `${company.ticker ?? 'n/a'} - ${company.title ?? 'Unknown company'}`,
      `CIK: ${cik}`,
      `EDGAR: https://www.sec.gov/edgar/browse/?CIK=${cik}`,
    ].join('\n   ');
  });
  return formatList(`SEC companies: ${query}`, rows);
}

async function getPublicHolidays(params) {
  const country = requireText(params, 'country_code').toUpperCase();
  const year = clampInteger(params.year, new Date().getFullYear(), 1900, 2100);
  const holidays = await fetchJson(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(country)}`,
  );
  if (!Array.isArray(holidays) || !holidays.length) {
    return `No public holidays found for ${country} in ${year}.`;
  }
  const rows = holidays.map((holiday) =>
    [
      `${holiday.date} - ${holiday.name}`,
      holiday.localName && holiday.localName !== holiday.name
        ? `Local name: ${holiday.localName}`
        : null,
      `Global: ${holiday.global ? 'yes' : 'no'}`,
      Array.isArray(holiday.counties) && holiday.counties.length
        ? `Counties: ${holiday.counties.join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`Public holidays: ${country} ${year}`, rows);
}

async function searchMusicBrainzArtists(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://musicbrainz.org/ws/2/artist/');
  url.searchParams.set('query', query);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', String(limit));
  const data = await fetchJson(url.toString(), {
    headers: { 'User-Agent': 'Joanium/2026 support@joanium.local' },
  });
  const artists = data.artists ?? [];
  if (!artists.length) return `No MusicBrainz artists found for "${query}".`;
  const rows = artists.map((artist) =>
    [
      artist.name ?? 'Unnamed artist',
      `Type: ${artist.type ?? 'n/a'} | Country: ${artist.country ?? 'n/a'} | Score: ${artist.score ?? 'n/a'}`,
      artist.disambiguation ? `Note: ${artist.disambiguation}` : null,
      `MBID: ${artist.id}`,
      `Link: https://musicbrainz.org/artist/${artist.id}`,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`MusicBrainz artists: ${query}`, rows);
}

async function searchItunes(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const media = String(params.media ?? 'all').trim();
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', query);
  url.searchParams.set('limit', String(limit));
  if (media && media !== 'all') url.searchParams.set('media', media);
  const data = await fetchJson(url.toString(), { signal: AbortSignal.timeout(10000) });
  const results = data?.results ?? [];
  if (!results.length) return `No iTunes catalog results found for "${query}".`;
  const rows = results.map((item) =>
    [
      item.trackName ?? item.collectionName ?? item.artistName ?? 'Untitled',
      `Artist: ${item.artistName ?? 'n/a'} | Kind: ${item.kind ?? item.wrapperType ?? 'n/a'}`,
      `Genre: ${item.primaryGenreName ?? 'n/a'}`,
      `URL: ${item.trackViewUrl ?? item.collectionViewUrl ?? item.artistViewUrl ?? 'n/a'}`,
      item.previewUrl ? `Preview: ${item.previewUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`iTunes catalog: ${query}`, rows);
}

async function searchTvShows(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const data = await fetchJson(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
  );
  const shows = Array.isArray(data) ? data.slice(0, limit) : [];
  if (!shows.length) return `No TVMaze shows found for "${query}".`;
  const rows = shows.map(({ score, show }) =>
    [
      show?.name ?? 'Untitled',
      `Score: ${Number(score ?? 0).toFixed(2)} | Status: ${show?.status ?? 'n/a'}`,
      `Premiered: ${show?.premiered ?? 'n/a'} | Genres: ${(show?.genres ?? []).join(', ') || 'n/a'}`,
      `Network: ${show?.network?.name ?? show?.webChannel?.name ?? 'n/a'}`,
      `URL: ${show?.url ?? 'n/a'}`,
    ].join('\n   '),
  );
  return formatList(`TVMaze shows: ${query}`, rows);
}

async function searchBreweries(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://api.openbrewerydb.org/v1/breweries/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(limit));
  const data = await fetchJson(url.toString());
  const breweries = Array.isArray(data) ? data : [];
  if (!breweries.length) return `No breweries found for "${query}".`;
  const rows = breweries.map((brewery) =>
    [
      brewery.name ?? 'Unnamed brewery',
      `Type: ${brewery.brewery_type ?? 'n/a'}`,
      `Location: ${[brewery.city, brewery.state_province, brewery.country].filter(Boolean).join(', ') || 'n/a'}`,
      brewery.website_url ? `Website: ${brewery.website_url}` : null,
    ]
      .filter(Boolean)
      .join('\n   '),
  );
  return formatList(`Open Brewery DB: ${query}`, rows);
}

async function searchAnime(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const url = new URL('https://api.jikan.moe/v4/anime');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  const data = await fetchJson(url.toString());
  const anime = data.data ?? [];
  if (!anime.length) return `No Jikan anime results found for "${query}".`;
  const rows = anime.map((item) =>
    [
      item.title ?? 'Untitled',
      `Type: ${item.type ?? 'n/a'} | Episodes: ${item.episodes ?? 'n/a'} | Status: ${item.status ?? 'n/a'}`,
      `Score: ${item.score ?? 'n/a'} | Year: ${item.year ?? item.aired?.prop?.from?.year ?? 'n/a'}`,
      `Genres: ${(item.genres ?? []).map((genre) => genre.name).join(', ') || 'n/a'}`,
      `URL: ${item.url ?? 'n/a'}`,
    ].join('\n   '),
  );
  return formatList(`Jikan anime: ${query}`, rows);
}

async function searchRecipes(params) {
  const query = requireText(params, 'query');
  const limit = clampInteger(params.limit, 5, 1, 20);
  const data = await fetchJson(
    `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`,
  );
  const meals = (data.meals ?? []).slice(0, limit);
  if (!meals.length) return `No recipes found for "${query}".`;
  const rows = meals.map((meal) => {
    const ingredients = [];
    for (let index = 1; index <= 20; index += 1) {
      const ingredient = String(meal[`strIngredient${index}`] ?? '').trim();
      const measure = String(meal[`strMeasure${index}`] ?? '').trim();
      if (ingredient) ingredients.push(`${measure ? `${measure} ` : ''}${ingredient}`.trim());
    }
    return [
      meal.strMeal ?? 'Untitled recipe',
      `Category: ${meal.strCategory ?? 'n/a'} | Area: ${meal.strArea ?? 'n/a'}`,
      `Ingredients: ${ingredients.slice(0, 10).join(', ') || 'n/a'}`,
      meal.strSource ? `Source: ${meal.strSource}` : null,
      meal.strYoutube ? `Video: ${meal.strYoutube}` : null,
    ]
      .filter(Boolean)
      .join('\n   ');
  });
  return formatList(`Recipes: ${query}`, rows);
}

async function queryOsvVulnerabilities(params) {
  const packageName = requireText(params, 'package_name');
  const ecosystemInput = requireText(params, 'ecosystem').toLowerCase();
  const ecosystemMap = {
    npm: 'npm',
    pypi: 'PyPI',
    maven: 'Maven',
    go: 'Go',
    'crates.io': 'crates.io',
    crates: 'crates.io',
    nuget: 'NuGet',
    rubygems: 'RubyGems',
    packagist: 'Packagist',
  };
  const ecosystem = ecosystemMap[ecosystemInput] ?? params.ecosystem;
  const version = String(params.version ?? '').trim();
  const limit = clampInteger(params.limit, 10, 1, 20);
  const body = {
    package: {
      name: packageName,
      ecosystem,
    },
  };
  if (version) body.version = version;
  const data = await fetchJson('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const vulns = (data.vulns ?? []).slice(0, limit);
  if (!vulns.length) {
    return `No OSV vulnerabilities found for ${ecosystem}/${packageName}${version ? ` ${version}` : ''}.`;
  }
  const rows = vulns.map((vuln) =>
    [
      `${vuln.id} - ${vuln.summary ?? 'No summary'}`,
      `Modified: ${vuln.modified ?? 'n/a'} | Published: ${vuln.published ?? 'n/a'}`,
      `Aliases: ${(vuln.aliases ?? []).slice(0, 5).join(', ') || 'n/a'}`,
      `Details: ${stripHtml(vuln.details ?? '').slice(0, 240) || 'n/a'}`,
    ].join('\n   '),
  );
  return formatList(`OSV vulnerabilities: ${ecosystem}/${packageName}`, rows);
}

export function createPublicDataToolHandlers() {
  return {
    search_web: searchWeb,
    search_wikipedia: wikipediaSummary,
    get_wikipedia_search_results: wikipediaSearchResults,
    get_wikipedia_full_article: wikipediaFullArticle,
    get_wikipedia_sections: wikipediaSections,
    get_wikipedia_random_article: wikipediaRandomArticle,
    get_wikipedia_on_this_day: wikipediaOnThisDay,
    get_definition: getDefinition,
    get_country_info: getCountryInfo,
    get_quote: getQuote,
    get_joke: getJoke,
    get_hacker_news: getHackerNews,
    search_photos: searchPhotos,
    npm_search: npmSearch,
    npm_package_info: npmPackageInfo,
    npm_package_versions: npmPackageVersions,
    npm_package_downloads: npmPackageDownloads,
    npm_compare_packages: npmComparePackages,
    stackoverflow_search: stackOverflowSearch,
    stackoverflow_question_answers: stackOverflowAnswers,
    stackoverflow_questions_by_tag: stackOverflowQuestionsByTag,
    stackoverflow_hot: stackOverflowHot,
    stackoverflow_similar: stackOverflowSimilar,
    get_weather: getWeather,
    get_hourly_forecast: getHourlyForecast,
    get_weekly_forecast: getWeeklyForecast,
    get_air_quality: getAirQuality,
    get_sunrise_sunset: getSunriseSunset,
    get_exchange_rate: getExchangeRate,
    get_treasury_data: getTreasuryData,
    get_fred_data: getFredData,
    get_crypto_price: getCryptoPrice,
    get_crypto_trending: getCryptoTrending,
    get_top_coins: getTopCoins,
    search_crypto: searchCrypto,
    get_apod: getApod,
    get_iss_location: getIssLocation,
    shorten_url: shortenUrl,
    get_url_metadata: getUrlMetadata,
    generate_qr_code_url: generateQrCodeUrl,
    get_whois_info: getWhoisInfo,
    check_redirect_chain: checkRedirectChain,
    get_ip_info: getIpInfo,
    forward_geocode: forwardGeocode,
    reverse_geocode: reverseGeocode,
    search_places: searchPlaces,
    get_postal_code_info: getPostalCodeInfo,
    get_elevation: getElevation,
    // math & datetime
    calculate,
    get_current_datetime: getCurrentDatetime,
    date_calculator: dateCalculator,
    // research
    search_arxiv: searchArxiv,
    get_arxiv_paper: getArxivPaper,
    // social
    get_reddit_posts: getRedditPosts,
    search_reddit: searchReddit,
    // books
    search_books: searchBooks,
    get_book_by_isbn: getBookByIsbn,
    // economics
    get_world_bank_data: getWorldBankData,
    // geoscience
    get_earthquakes: getEarthquakes,
    // nutrition
    search_food: searchFood,
    get_food_by_barcode: getFoodByBarcode,
    // wikidata
    search_wikidata: searchWikidata,
    get_wikidata_entity: getWikidataEntity,
    // who gho
    list_who_indicators: listWhoIndicators,
    get_who_health_data: getWhoHealthData,
    // pubchem
    search_compound: searchCompound,
    get_compound_info: getCompoundInfo,
    // crossref
    search_crossref: searchCrossref,
    get_doi_info: getDoiInfo,
    // additional free public APIs
    search_openalex_works: searchOpenAlexWorks,
    search_europe_pmc: searchEuropePmc,
    search_clinical_trials: searchClinicalTrials,
    search_drug_labels: searchDrugLabels,
    search_rxnorm_drugs: searchRxNormDrugs,
    search_species: searchSpecies,
    search_inaturalist_observations: searchINaturalistObservations,
    search_gdelt_news: searchGdeltNews,
    search_federal_register: searchFederalRegister,
    search_sec_companies: searchSecCompanies,
    get_public_holidays: getPublicHolidays,
    search_musicbrainz_artists: searchMusicBrainzArtists,
    search_itunes: searchItunes,
    search_tv_shows: searchTvShows,
    search_breweries: searchBreweries,
    search_anime: searchAnime,
    search_recipes: searchRecipes,
    query_osv_vulnerabilities: queryOsvVulnerabilities,
  };
}
