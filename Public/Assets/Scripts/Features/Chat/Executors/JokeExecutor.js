// Romelson — Features/Chat/Executors/JokeExecutor.js
import { safeJson } from './utils.js';

const HANDLED = new Set(['get_joke']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    if (toolName !== 'get_joke') throw new Error(`JokeExecutor: unknown tool "${toolName}"`);

    const { category } = params;
    onStage(`😂 Getting a joke…`);

    const validCats = ['programming', 'misc', 'dark', 'pun', 'spooky', 'christmas'];
    const cat = category && validCats.includes(category.toLowerCase())
        ? category.toLowerCase()
        : 'Any';

    // JokeAPI v2 — free, no key
    const data = await safeJson(
        `https://v2.jokeapi.dev/joke/${cat}?blacklistFlags=nsfw,racist,sexist&type=single,twopart`
    );

    if (data.error) {
        return `Couldn't fetch a joke: ${data.message ?? 'Unknown error'}. Try again!`;
    }

    if (data.type === 'single') {
        return [
            `😂 Joke${data.category ? ` (${data.category})` : ''}`,
            ``,
            data.joke,
            ``,
            `Source: JokeAPI (v2.jokeapi.dev)`,
        ].join('\n');
    }

    // Two-part joke
    return [
        `😂 Joke${data.category ? ` (${data.category})` : ''}`,
        ``,
        data.setup,
        ``,
        `> ${data.delivery}`,
        ``,
        `Source: JokeAPI (v2.jokeapi.dev)`,
    ].join('\n');
}
