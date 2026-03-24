// Romelson — Features/Chat/Executors/UrlExecutor.js
import { safeJson } from './utils.js';

const HANDLED = new Set(['shorten_url']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    if (toolName !== 'shorten_url') throw new Error(`UrlExecutor: unknown tool "${toolName}"`);

    const { url } = params;
    if (!url) throw new Error('Missing required param: url');

    // Basic URL validation
    try { new URL(url); } catch {
        return `"${url}" doesn't look like a valid URL. Include the full URL with https:// or http://`;
    }

    onStage(`🔗 Shortening URL…`);

    // Try CleanURI — free, no key
    try {
        const res = await fetch('https://cleanuri.com/api/v1/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `url=${encodeURIComponent(url)}`,
        });
        const data = await res.json();
        if (data.result_url) {
            return [
                `🔗 URL Shortened`,
                ``,
                `Original: ${url}`,
                `Short: ${data.result_url}`,
                ``,
                `Source: CleanURI (cleanuri.com)`,
            ].join('\n');
        }
    } catch { /* fallback below */ }

    // Fallback: TinyURL — free, no key
    try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        if (res.ok) {
            const shortUrl = await res.text();
            if (shortUrl.startsWith('http')) {
                return [
                    `🔗 URL Shortened`,
                    ``,
                    `Original: ${url}`,
                    `Short: ${shortUrl}`,
                    ``,
                    `Source: TinyURL (tinyurl.com)`,
                ].join('\n');
            }
        }
    } catch { /* fall through */ }

    return `Could not shorten the URL right now. The shortening services may be temporarily unavailable.`;
}
