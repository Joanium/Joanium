// openworld — Features/Chat/Tools/index.js
// Aggregates all tool definitions. Add a new tool file → import it here → done.

import { GMAIL_TOOLS } from './GmailTools.js';
import { GITHUB_TOOLS } from './GithubTools.js';
import { WEATHER_TOOLS } from './WeatherTools.js';
import { CRYPTO_TOOLS } from './CryptoTools.js';
import { FINANCE_TOOLS } from './FinanceTools.js';
import { PHOTO_TOOLS } from './PhotoTools.js';
import { WIKI_TOOLS } from './WikiTools.js';
import { GEO_TOOLS } from './GeoTools.js';
import { FUN_TOOLS } from './FunTools.js';
import { JOKE_TOOLS } from './JokeTools.js';
import { QUOTE_TOOLS } from './QuoteTools.js';
import { COUNTRY_TOOLS } from './CountryTools.js';
import { ASTRONOMY_TOOLS } from './AstronomyTools.js';
import { HACKERNEWS_TOOLS } from './HackerNewsTools.js';
import { URL_TOOLS } from './UrlTools.js';
import { TERMINAL_TOOLS } from './TerminalTools.js';

export {
    GMAIL_TOOLS, GITHUB_TOOLS, WEATHER_TOOLS, CRYPTO_TOOLS, FINANCE_TOOLS, PHOTO_TOOLS,
    WIKI_TOOLS, GEO_TOOLS, FUN_TOOLS,
    JOKE_TOOLS, QUOTE_TOOLS, COUNTRY_TOOLS, ASTRONOMY_TOOLS, HACKERNEWS_TOOLS,
    URL_TOOLS, TERMINAL_TOOLS,
};

/** Complete flat list of every tool available to the AI. */
export const TOOLS = [
    ...GMAIL_TOOLS,
    ...GITHUB_TOOLS,
    ...WEATHER_TOOLS,
    ...CRYPTO_TOOLS,
    ...FINANCE_TOOLS,
    ...PHOTO_TOOLS,
    ...WIKI_TOOLS,
    ...GEO_TOOLS,
    ...FUN_TOOLS,
    ...JOKE_TOOLS,
    ...QUOTE_TOOLS,
    ...COUNTRY_TOOLS,
    ...ASTRONOMY_TOOLS,
    ...HACKERNEWS_TOOLS,
    ...URL_TOOLS,
    ...TERMINAL_TOOLS,
];

const CATEGORY_TO_CONNECTOR = {
    gmail: 'gmail',
    github: 'github',
    open_meteo: 'open_meteo',
    coingecko: 'coingecko',
    exchange_rate: 'exchange_rate',
    treasury: 'treasury',
    fred: 'fred',
    openweathermap: 'openweathermap',
    unsplash: 'unsplash',
    wikipedia: 'wikipedia',
    ipgeo: 'ipgeo',
    funfacts: 'funfacts',
    jokeapi: 'jokeapi',
    quotes: 'quotes',
    restcountries: 'restcountries',
    nasa: 'nasa',
    hackernews: 'hackernews',
    cleanuri: 'cleanuri',
    terminal: 'local_system',
};

/**
 * Filter tools to only those whose connector is enabled.
 * @param {object} connectorStatuses — result of window.electronAPI.getConnectors()
 */
export function filterToolsByConnectors(connectorStatuses = {}) {
    return TOOLS.filter(tool => {
        const connectorName = CATEGORY_TO_CONNECTOR[tool.category];
        if (!connectorName) return true;
        const status = connectorStatuses[connectorName];
        return status?.enabled === true;
    });
}

/** Build a plain-text description of all tools for prompt injection. */
export function buildToolsPrompt(tools = TOOLS) {
    return tools.map(tool => {
        const params = Object.entries(tool.parameters).map(([key, p]) =>
            `    - ${key} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`
        ).join('\n');
        return [
            `• ${tool.name}`,
            `  Description: ${tool.description}`,
            params ? `  Parameters:\n${params}` : `  Parameters: none`,
        ].join('\n');
    }).join('\n\n');
}