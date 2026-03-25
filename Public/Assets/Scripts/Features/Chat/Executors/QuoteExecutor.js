import { safeJson } from './utils.js';

const HANDLED = new Set(['get_quote']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    if (toolName !== 'get_quote') throw new Error(`QuoteExecutor: unknown tool "${toolName}"`);

    const { tag } = params;
    onStage(`💬 Finding a quote${tag ? ` about "${tag}"` : ''}…`);

    // ZenQuotes API — free, no key
    try {
        const data = await safeJson('https://zenquotes.io/api/random');
        if (Array.isArray(data) && data[0]?.q) {
            const q = data[0];
            return [
                `💬 Quote`,
                ``,
                `"${q.q}"`,
                ``,
                `— ${q.a}`,
                ``,
                `Source: ZenQuotes (zenquotes.io)`,
            ].join('\n');
        }
    } catch { /* fallback below */ }

    // Fallback: quotable.io
    try {
        const tagParam = tag ? `&tags=${encodeURIComponent(tag)}` : '';
        const data = await safeJson(`https://api.quotable.io/quotes/random?limit=1${tagParam}`);
        if (Array.isArray(data) && data[0]) {
            const q = data[0];
            return [
                `💬 Quote${q.tags?.length ? ` (${q.tags.join(', ')})` : ''}`,
                ``,
                `"${q.content}"`,
                ``,
                `— ${q.author}`,
                ``,
                `Source: Quotable (quotable.io)`,
            ].join('\n');
        }
    } catch { /* fall through */ }

    return 'Could not fetch a quote right now. Try again in a moment!';
}
