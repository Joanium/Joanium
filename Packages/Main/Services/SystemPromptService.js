import fs from 'fs';
import * as GithubAPI from '../../Features/Automation/Integrations/Github.js';
import { buildSystemPrompt } from '../../System/Prompting/SystemPrompt.js';
import Paths from '../Core/Paths.js';

const TTL_MS = 5 * 60_000;

let _cache = null;
let _cacheTime = 0;

export function invalidate() {
  _cache = null;
  _cacheTime = 0;
}

export async function get({ user, customInstructions, memory, connectorEngine, featureRegistry = null }) {
  const now = Date.now();
  if (_cache && now - _cacheTime < TTL_MS) return _cache;

  const githubCreds = connectorEngine.getCredentials('github');
  const googleCreds = connectorEngine.getCredentials('google');

  let githubUsername = null;
  let githubRepos = [];
  let featurePromptContext = { connectedServices: [], sections: [] };

  if (featureRegistry?.buildPromptContext) {
    try {
      featurePromptContext = await featureRegistry.buildPromptContext({
        connectorEngine,
        invalidateSystemPrompt: invalidate,
      });
    } catch (error) {
      console.warn('[SystemPromptService] Feature prompt context failed:', error.message);
    }
  }

  if (!featurePromptContext.sections?.length && githubCreds?.token) {
    try {
      const ghUser = await GithubAPI.getUser(githubCreds);
      githubUsername = ghUser.login;
      githubRepos = await GithubAPI.getRepos(githubCreds, 20);
    } catch (error) {
      console.warn('[SystemPromptService] GitHub fetch failed:', error.message);
    }
  }

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
    gmailEmail: googleCreds?.email ?? null,
    activePersona,
    connectedServices: featurePromptContext.connectedServices ?? [],
    extraContextSections: featurePromptContext.sections ?? [],
  });
  _cacheTime = now;

  return _cache;
}
