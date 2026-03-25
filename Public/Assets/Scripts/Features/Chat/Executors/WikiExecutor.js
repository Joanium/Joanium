import { safeJson } from './utils.js';

const HANDLED = new Set(['search_wikipedia']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    if (toolName !== 'search_wikipedia') throw new Error(`WikiExecutor: unknown tool "${toolName}"`);

    const { query } = params;
    if (!query) throw new Error('Missing required param: query');
    onStage(`📚 Searching Wikipedia for "${query}"…`);

    // Use Wikipedia REST API — no key required
    const encoded = encodeURIComponent(query);
    let data;
    try {
        data = await safeJson(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`
        );
    } catch {
        // If direct lookup fails, try search endpoint
        onStage(`🔍 Trying Wikipedia search…`);
        const searchData = await safeJson(
            `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json`
        );
        const title = searchData?.[1]?.[0];
        if (!title) {
            return `No Wikipedia article found for "${query}". Try a more specific or common term.`;
        }
        data = await safeJson(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`
        );
    }

    if (data.type === 'disambiguation') {
        return [
            `📚 "${data.title}" — Disambiguation Page`,
            ``,
            data.extract ?? 'Multiple topics match this term.',
            ``,
            `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`}`,
            ``,
            `Try being more specific (e.g. "${query} (film)" or "${query} (science)").`,
            `Source: Wikipedia`,
        ].join('\n');
    }

    if (!data.extract) {
        return `No Wikipedia article found for "${query}". Try a different search term.`;
    }

    const lines = [
        `📚 ${data.title}`,
        ``,
    ];

    if (data.description) {
        lines.push(`*${data.description}*`, ``);
    }

    lines.push(
        data.extract,
        ``,
        `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`}`,
        `Source: Wikipedia`,
    );

    return lines.join('\n');
}
