// openworld — Features/Chat/Executors/index.js
// Main dispatcher — routes each tool name to the correct executor module.
// To add a new tool category: create an executor, import it here, add to EXECUTORS.

import * as GmailExecutor from './GmailExecutor.js';
import * as GithubExecutor from './GithubExecutor.js';
import * as WeatherExecutor from './WeatherExecutor.js';
import * as CryptoExecutor from './CryptoExecutor.js';
import * as FinanceExecutor from './FinanceExecutor.js';
import * as PhotoExecutor from './PhotoExecutor.js';

const EXECUTORS = [
    GmailExecutor,
    GithubExecutor,
    WeatherExecutor,
    CryptoExecutor,
    FinanceExecutor,
    PhotoExecutor,
];

/**
 * Execute a single tool call.
 * @param {string}   toolName
 * @param {object}   params
 * @param {function} onStage — callback(message) to update UI during execution
 * @returns {Promise<string>} — plain-text result to feed back to the AI
 */
export async function executeTool(toolName, params, onStage = () => { }) {
    for (const executor of EXECUTORS) {
        if (executor.handles(toolName)) {
            return executor.execute(toolName, params, onStage);
        }
    }
    throw new Error(`Unknown tool: ${toolName}`);
}