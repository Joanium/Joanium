import { WEATHER_TOOLS } from '../Weather/Tools.js';
import { CRYPTO_TOOLS } from '../Crypto/Tools.js';
import { FINANCE_TOOLS } from '../Finance/Tools.js';
import { PHOTO_TOOLS } from '../Photo/Tools.js';
import { WIKI_TOOLS } from '../Wiki/Tools.js';
import { GEO_TOOLS } from '../Geo/Tools.js';
import { FUN_TOOLS } from '../Fun/Tools.js';
import { JOKE_TOOLS } from '../Joke/Tools.js';
import { QUOTE_TOOLS } from '../Quote/Tools.js';
import { COUNTRY_TOOLS } from '../Country/Tools.js';
import { ASTRONOMY_TOOLS } from '../Astronomy/Tools.js';
import { HACKERNEWS_TOOLS } from '../HackerNews/Tools.js';
import { URL_TOOLS } from '../Url/Tools.js';
import { DICTIONARY_TOOLS } from '../Dictionary/Tools.js';
import { DATETIME_TOOLS } from '../DateTime/Tools.js';
import { PASSWORD_TOOLS } from '../Password/Tools.js';
import { Trigger as WeatherTrigger } from '../Weather/Trigger.js';
import { Trigger as CryptoTrigger } from '../Crypto/Trigger.js';
import { Trigger as FinanceTrigger } from '../Finance/Trigger.js';
import { Trigger as PhotoTrigger } from '../Photo/Trigger.js';
import { Trigger as WikiTrigger } from '../Wiki/Trigger.js';
import { Trigger as GeoTrigger } from '../Geo/Trigger.js';
import { Trigger as FunTrigger } from '../Fun/Trigger.js';
import { Trigger as JokeTrigger } from '../Joke/Trigger.js';
import { Trigger as QuoteTrigger } from '../Quote/Trigger.js';
import { Trigger as CountryTrigger } from '../Country/Trigger.js';
import { Trigger as AstronomyTrigger } from '../Astronomy/Trigger.js';
import { Trigger as HackerNewsTrigger } from '../HackerNews/Trigger.js';
import { Trigger as UrlTrigger } from '../Url/Trigger.js';
import { Trigger as DictionaryTrigger } from '../Dictionary/Trigger.js';
import { Trigger as DateTimeTrigger } from '../DateTime/Trigger.js';
import { Trigger as PasswordTrigger } from '../Password/Trigger.js';
import * as WeatherExecutor from '../Weather/Executor.js';
import * as CryptoExecutor from '../Crypto/Executor.js';
import * as FinanceExecutor from '../Finance/Executor.js';
import * as PhotoExecutor from '../Photo/Executor.js';
import * as WikiExecutor from '../Wiki/Executor.js';
import * as GeoExecutor from '../Geo/Executor.js';
import * as FunExecutor from '../Fun/Executor.js';
import * as JokeExecutor from '../Joke/Executor.js';
import * as QuoteExecutor from '../Quote/Executor.js';
import * as CountryExecutor from '../Country/Executor.js';
import * as AstronomyExecutor from '../Astronomy/Executor.js';
import * as HackerNewsExecutor from '../HackerNews/Executor.js';
import * as UrlExecutor from '../Url/Executor.js';
import * as DictionaryExecutor from '../Dictionary/Executor.js';
import * as DateTimeExecutor from '../DateTime/Executor.js';
import * as PasswordExecutor from '../Password/Executor.js';
import { Trigger as GithubTrigger } from '../../../../../Capabilities/Github/Core/Trigger.js';
import { Trigger as GitlabTrigger } from '../../../../../Capabilities/Gitlab/Core/Trigger.js';
import { Trigger as CalendarTrigger } from '../../../../../Capabilities/Google/Calendar/Core/Trigger.js';
import { Trigger as ContactsTrigger } from '../../../../../Capabilities/Google/Contacts/Core/Trigger.js';
import { Trigger as DocsTrigger } from '../../../../../Capabilities/Google/Docs/Core/Trigger.js';
import { Trigger as DriveTrigger } from '../../../../../Capabilities/Google/Drive/Core/Trigger.js';
import { Trigger as FormsTrigger } from '../../../../../Capabilities/Google/Forms/Core/Trigger.js';
import { Trigger as GmailTrigger } from '../../../../../Capabilities/Google/Gmail/Core/Trigger.js';
import { Trigger as GooglePhotosTrigger } from '../../../../../Capabilities/Google/Photos/Core/Trigger.js';
import { Trigger as SheetsTrigger } from '../../../../../Capabilities/Google/Sheets/Core/Trigger.js';
import { Trigger as SlidesTrigger } from '../../../../../Capabilities/Google/Slides/Core/Trigger.js';
import { Trigger as TasksTrigger } from '../../../../../Capabilities/Google/Tasks/Core/Trigger.js';
import { Trigger as YoutubeTrigger } from '../../../../../Capabilities/Google/Youtube/Core/Trigger.js';
export const CAPABILITY_MANIFESTS = [
  {
    name: 'weather',
    description: 'Weather forecasts, temperature, and conditions',
    triggers: WeatherTrigger,
    tools: WEATHER_TOOLS,
    executor: WeatherExecutor,
    featureCategories: ['open_meteo', 'openweathermap'],
    connectors: { open_meteo: 'open_meteo', openweathermap: 'openweathermap' },
  },
  {
    name: 'crypto',
    description: 'Cryptocurrency prices and market data',
    triggers: CryptoTrigger,
    tools: CRYPTO_TOOLS,
    executor: CryptoExecutor,
    featureCategories: ['coingecko'],
    connectors: { coingecko: 'coingecko' },
  },
  {
    name: 'finance',
    description: 'Finance, stocks, currency exchange, and economics',
    triggers: FinanceTrigger,
    tools: FINANCE_TOOLS,
    executor: FinanceExecutor,
    featureCategories: ['exchange_rate', 'treasury', 'fred'],
    connectors: { exchange_rate: 'exchange_rate', treasury: 'treasury', fred: 'fred' },
  },
  {
    name: 'photo',
    description: 'Photo search from Unsplash',
    triggers: PhotoTrigger,
    tools: PHOTO_TOOLS,
    executor: PhotoExecutor,
    featureCategories: ['unsplash'],
    connectors: { unsplash: 'unsplash' },
  },
  {
    name: 'wiki',
    description: 'Wikipedia article lookup and encyclopedia knowledge',
    triggers: WikiTrigger,
    tools: WIKI_TOOLS,
    executor: WikiExecutor,
    featureCategories: ['wikipedia'],
    connectors: { wikipedia: 'wikipedia' },
  },
  {
    name: 'geo',
    description: 'IP geolocation and location data',
    triggers: GeoTrigger,
    tools: GEO_TOOLS,
    executor: GeoExecutor,
    featureCategories: ['ipgeo'],
    connectors: { ipgeo: 'ipgeo' },
  },
  {
    name: 'fun',
    description: 'Fun facts and trivia',
    triggers: FunTrigger,
    tools: FUN_TOOLS,
    executor: FunExecutor,
    featureCategories: ['funfacts'],
    connectors: { funfacts: 'funfacts' },
  },
  {
    name: 'joke',
    description: 'Random jokes',
    triggers: JokeTrigger,
    tools: JOKE_TOOLS,
    executor: JokeExecutor,
    featureCategories: ['jokeapi'],
    connectors: { jokeapi: 'jokeapi' },
  },
  {
    name: 'quote',
    description: 'Inspirational and famous quotes',
    triggers: QuoteTrigger,
    tools: QUOTE_TOOLS,
    executor: QuoteExecutor,
    featureCategories: ['quotes'],
    connectors: { quotes: 'quotes' },
  },
  {
    name: 'country',
    description: 'Country information, flags, capitals, and demographics',
    triggers: CountryTrigger,
    tools: COUNTRY_TOOLS,
    executor: CountryExecutor,
    featureCategories: ['restcountries'],
    connectors: { restcountries: 'restcountries' },
  },
  {
    name: 'astronomy',
    description: 'Astronomy data and NASA imagery',
    triggers: AstronomyTrigger,
    tools: ASTRONOMY_TOOLS,
    executor: AstronomyExecutor,
    featureCategories: ['nasa'],
    connectors: { nasa: 'nasa' },
  },
  {
    name: 'hackernews',
    description: 'Hacker News stories and discussions',
    triggers: HackerNewsTrigger,
    tools: HACKERNEWS_TOOLS,
    executor: HackerNewsExecutor,
    featureCategories: ['hackernews'],
    connectors: { hackernews: 'hackernews' },
  },
  {
    name: 'url',
    description: 'URL shortening and link tools',
    triggers: UrlTrigger,
    tools: URL_TOOLS,
    executor: UrlExecutor,
    featureCategories: ['cleanuri'],
    connectors: { cleanuri: 'cleanuri' },
  },
  {
    name: 'dictionary',
    description: 'Dictionary definitions, word lookups, and translations',
    triggers: DictionaryTrigger,
    tools: DICTIONARY_TOOLS,
    executor: DictionaryExecutor,
    featureCategories: ['dictionary', 'translate'],
    connectors: {},
  },
  {
    name: 'datetime',
    description: 'Date and time calculations and scheduling helpers',
    triggers: DateTimeTrigger,
    tools: DATETIME_TOOLS,
    executor: DateTimeExecutor,
    featureCategories: ['datetime'],
    connectors: {},
  },
  {
    name: 'password',
    description: 'Password generation and security utilities',
    triggers: PasswordTrigger,
    tools: PASSWORD_TOOLS,
    executor: PasswordExecutor,
    featureCategories: ['security'],
    connectors: {},
  },
  {
    name: 'github',
    description: 'GitHub repos, pull requests, issues, and actions',
    triggers: GithubTrigger,
    tools: [],
    executor: null,
    featureCategories: ['github', 'github_review'],
    connectors: { github: 'github', github_review: 'github' },
  },
  {
    name: 'gitlab',
    description: 'GitLab repos, merge requests, and CI/CD pipelines',
    triggers: GitlabTrigger,
    tools: [],
    executor: null,
    featureCategories: ['gitlab'],
    connectors: { gitlab: 'gitlab' },
  },
  {
    name: 'google_calendar',
    description: 'Google Calendar events and scheduling',
    triggers: CalendarTrigger,
    tools: [],
    executor: null,
    featureCategories: ['calendar'],
    connectors: { calendar: 'google' },
  },
  {
    name: 'google_contacts',
    description: 'Google Contacts management',
    triggers: ContactsTrigger,
    tools: [],
    executor: null,
    featureCategories: ['contacts'],
    connectors: {},
  },
  {
    name: 'google_docs',
    description: 'Google Docs document management',
    triggers: DocsTrigger,
    tools: [],
    executor: null,
    featureCategories: ['docs'],
    connectors: {},
  },
  {
    name: 'google_drive',
    description: 'Google Drive file management',
    triggers: DriveTrigger,
    tools: [],
    executor: null,
    featureCategories: ['drive'],
    connectors: { drive: 'google' },
  },
  {
    name: 'google_forms',
    description: 'Google Forms management',
    triggers: FormsTrigger,
    tools: [],
    executor: null,
    featureCategories: ['forms'],
    connectors: {},
  },
  {
    name: 'google_gmail',
    description: 'Gmail email management',
    triggers: GmailTrigger,
    tools: [],
    executor: null,
    featureCategories: ['gmail'],
    connectors: { gmail: 'google' },
  },
  {
    name: 'google_photos',
    description: 'Google Photos management',
    triggers: GooglePhotosTrigger,
    tools: [],
    executor: null,
    featureCategories: ['photos'],
    connectors: {},
  },
  {
    name: 'google_sheets',
    description: 'Google Sheets spreadsheet management',
    triggers: SheetsTrigger,
    tools: [],
    executor: null,
    featureCategories: ['sheets'],
    connectors: {},
  },
  {
    name: 'google_slides',
    description: 'Google Slides presentation management',
    triggers: SlidesTrigger,
    tools: [],
    executor: null,
    featureCategories: ['slides'],
    connectors: {},
  },
  {
    name: 'google_tasks',
    description: 'Google Tasks management',
    triggers: TasksTrigger,
    tools: [],
    executor: null,
    featureCategories: ['tasks'],
    connectors: {},
  },
  {
    name: 'google_youtube',
    description: 'YouTube video management',
    triggers: YoutubeTrigger,
    tools: [],
    executor: null,
    featureCategories: ['youtube'],
    connectors: {},
  },
];
export const ALL_TRIGGERED_TOOLS = CAPABILITY_MANIFESTS.flatMap((m) => m.tools);
export const TOOLS_BY_GROUP = new Map(
  CAPABILITY_MANIFESTS.filter((m) => m.tools.length > 0).map((m) => [m.name, m.tools]),
);
export const TOOL_NAMES_BY_GROUP = new Map(
  [...TOOLS_BY_GROUP.entries()].map(([name, tools]) => [name, new Set(tools.map((t) => t.name))]),
);
export const CATEGORY_CONNECTOR_MAP = new Map();
for (const manifest of CAPABILITY_MANIFESTS)
  for (const cat of manifest.featureCategories) {
    const connectorId = manifest.connectors[cat];
    connectorId && CATEGORY_CONNECTOR_MAP.set(cat, connectorId);
  }
export const MANIFEST_EXECUTORS = CAPABILITY_MANIFESTS.map((m) => m.executor).filter(Boolean);
export const TRIGGERED_GROUPS_FROM_MANIFESTS = CAPABILITY_MANIFESTS.map((m) => ({
  name: m.name,
  description: m.description,
  triggers: m.triggers,
  featureCategories: m.featureCategories,
}));
