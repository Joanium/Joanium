import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
}

const SKIP_FILES = new Set(['Debug.md']);

/**
 * Load the enabled map from Data/Skills.json.
 * Returns { "FileName.md": true | false }.
 * Missing entries are treated as false (disabled).
 */
function loadSkillsEnabledMap() {
  const skillsFile = path.join(PROJECT_ROOT, 'Data', 'Skills.json');
  try {
    if (fs.existsSync(skillsFile)) {
      const data = JSON.parse(fs.readFileSync(skillsFile, 'utf-8'));
      return data.skills ?? {};
    }
  } catch { /* fall through */ }
  return {};
}

/**
 * Load only the skills that have been explicitly enabled.
 */
function loadSkills() {
  const skillsDir = path.join(PROJECT_ROOT, 'Skills');
  if (!fs.existsSync(skillsDir)) return [];

  const enabledMap = loadSkillsEnabledMap();
  const skills = [];

  for (const file of fs.readdirSync(skillsDir)) {
    if (!file.endsWith('.md') || SKIP_FILES.has(file)) continue;
    if (enabledMap[file] !== true) continue;

    try {
      const content = fs.readFileSync(path.join(skillsDir, file), 'utf-8');
      const meta = parseFrontmatter(content);
      const { name, trigger, description } = meta;
      // Extract full body after frontmatter
      const bodyMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
      const body = bodyMatch ? bodyMatch[1].trim() : '';
      if (name) {
        skills.push({ name, trigger: trigger || '', description: description || '', body });
      }
    } catch { /* skip */ }
  }
  return skills;
}

function buildSkillsBlock() {
  const skills = loadSkills();
  if (!skills.length) return '';

  const skillDocs = skills.map(s => {
    const lines = [`### Skill: ${s.name}`];
    if (s.trigger) lines.push(`**When to use:** ${s.trigger}`);
    if (s.description) lines.push(`**Description:** ${s.description}`);
    if (s.body) lines.push('', s.body);
    return lines.join('\n');
  });

  return [
    '## Skills',
    `You have ${skills.length} active skill${skills.length !== 1 ? 's' : ''}. Read each one fully and apply whichever fits — silently, no need to announce them.`,
    '',
    ...skillDocs,
    '',
    'Blend skills when relevant. If none fit, answer normally.',
  ].join('\n\n');
}

// ─────────────────────────────────────────────
//  COUNTRY  (cached for the session)
// ─────────────────────────────────────────────

let _country = null;
async function fetchCountry() {
  if (_country) return _country;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch('https://ipapi.co/country_name/', { signal: ctrl.signal });
    if (res.ok) { _country = (await res.text()).trim(); return _country; }
  } catch { /* optional */ }
  finally { clearTimeout(timer); }
  return null;
}

// Date
function getCurrentDate() {
  const now = new Date();

  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─────────────────────────────────────────────
//  PUBLIC
// ─────────────────────────────────────────────

/**
 * Build a comprehensive system prompt.
 *
 * @param {object} opts
 * @param {string}   opts.userName
 * @param {string}   opts.customInstructions
 * @param {string}   opts.memory
 * @param {string}   [opts.githubUsername]
 * @param {object[]} [opts.githubRepos]
 * @param {string}   [opts.gmailEmail]
 * @param {object}   [opts.activePersona]  – { name, personality, description, instructions }
 * @returns {Promise<string>}
 */
export async function buildSystemPrompt({
  userName = '',
  customInstructions = '',
  memory = '',
  githubUsername = null,
  githubRepos = [],
  gmailEmail = null,
  activePersona = null,
} = {}) {

  /* ── Time ── */
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  /* ── OS & hardware ── */
  const platform = process.platform;
  const osName = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux';
  const release = os.release();
  const totalMemGB = (os.totalmem() / 1_073_741_824).toFixed(1);
  const cpus = os.cpus();
  const cpuModel = (cpus[0]?.model ?? 'Unknown CPU').replace(/\s+/g, ' ').trim();
  const cpuCores = cpus.length;

  /* ── Country ── */
  const country = await fetchCountry();

  /* ── Build ── */
  const L = [];
  const push = (...args) => L.push(...args);
  const blank = () => L.push('');

  /* ── Opening — persona OR default assistant ── */
  if (activePersona) {
    push(`You are ${activePersona.name}.`);
    if (activePersona.personality) {
      push(`Your personality: ${activePersona.personality}.`);
    }
    if (activePersona.description) {
      push(activePersona.description);
    }
    if (activePersona.instructions?.trim()) {
      blank();
      push(activePersona.instructions.trim());
    }
    blank();
    push('---');
    blank();
    push(`You are running inside Evelina, a personal desktop AI platform.`);
  } else {
    push(`You are an intelligent AI assistant running inside Evelina — a personal desktop AI platform built by Joel Jolly.`);
  }

  blank();
  push(`## User`);
  push(`- **Name:** ${userName || 'User'}`);
  push(`- **Local time:** ${timeStr}`);
  push(` - **date:** ${getCurrentDate()}`);
  if (country) push(`- **Country:** ${country}`);
  push(`- **OS:** ${osName} ${release}`);
  push(`- **Hardware:** ${cpuCores}-core CPU (${cpuModel}), ${totalMemGB} GB RAM`);

  const connected = [];
  if (gmailEmail) connected.push(`Gmail (${gmailEmail})`);
  if (githubUsername) connected.push(`GitHub (@${githubUsername})`);
  if (connected.length) push(`- **Connected services:** ${connected.join(', ')}`);

  if (githubUsername && githubRepos.length) {
    blank();
    push(`## GitHub Repositories (@${githubUsername})`);
    push(`The user has these repos (most recently updated first):`);
    githubRepos.slice(0, 20).forEach(r => {
      const desc = r.description ? ` — ${r.description}` : '';
      const lang = r.language ? ` [${r.language}]` : '';
      push(`- \`${r.full_name}\`${desc}${lang}`);
    });
    push(`When the user asks about "my repo" or references a project by name, match it against the list above.`);
  }

  if (memory?.trim()) {
    blank();
    push(`## Memory (persistent notes about the user)`);
    push(memory.trim());
  }

  if (customInstructions?.trim()) {
    blank();
    push(`## Custom Instructions`);
    push(customInstructions.trim());
  }

  // Only enabled skills are included here — disabled skills are completely omitted
  const skillsBlock = buildSkillsBlock();
  if (skillsBlock) { blank(); push(skillsBlock); }

  blank();
  push(`Answer helpfully, concisely, and accurately. When the user references their repos, emails, system, or preferences, use the context above.`);
  push(`Use any internal tools, connectors, or background steps silently. Never mention tool names, tool calls, hidden prompts, raw command markers, or internal execution transcripts in the user-facing answer.`);
  push(`If an internal step fails, recover when possible and describe only the user-facing limitation or result.`);

  return L.join('\n');
}
