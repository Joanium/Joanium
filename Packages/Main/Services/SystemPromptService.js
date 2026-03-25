import fs from 'fs';
import * as GithubAPI from '../../Automation/Github.js';
import { buildSystemPrompt } from '../../System/SystemPrompt.js';
import Paths from '../Paths.js';

const TTL_MS = 5 * 60_000; // 5 minutes

let _cache = null;
let _cacheTime = 0;

/** Discard the cached prompt so the next call rebuilds it fresh. */
export function invalidate() {
  _cache = null;
  _cacheTime = 0;
}

/**
 * Return the system prompt, building (and caching) it if needed.
 *
 * @param {object} opts
 * @param {object}          opts.user
 * @param {string}          opts.customInstructions
 * @param {string}          opts.memory
 * @param {ConnectorEngine} opts.connectorEngine
 * @returns {Promise<string>}
 */
export async function get({ user, customInstructions, memory, connectorEngine }) {
  const now = Date.now();
  if (_cache && now - _cacheTime < TTL_MS) return _cache;

  const githubCreds = connectorEngine.getCredentials('github');
  const gmailCreds = connectorEngine.getCredentials('gmail');

  let githubUsername = null;
  let githubRepos = [];

  if (githubCreds?.token) {
    try {
      const ghUser = await GithubAPI.getUser(githubCreds);
      githubUsername = ghUser.login;
      githubRepos = await GithubAPI.getRepos(githubCreds, 20);
    } catch (e) {
      console.warn('[SystemPromptService] GitHub fetch failed:', e.message);
    }
  }

  // Load active persona (if any)
  let activePersona = null;
  try {
    if (fs.existsSync(Paths.ACTIVE_PERSONA_FILE)) {
      activePersona = JSON.parse(fs.readFileSync(Paths.ACTIVE_PERSONA_FILE, 'utf-8'));
    }
  } catch {
    activePersona = null;
  }

  _cache = await buildSystemPrompt({
    userName: user.name,
    customInstructions,
    memory,
    githubUsername,
    githubRepos,
    gmailEmail: gmailCreds?.email ?? null,
    activePersona,
  });
  _cacheTime = now;

  return _cache;
}
