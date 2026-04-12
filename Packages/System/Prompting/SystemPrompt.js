import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url),
  __dirname = path.dirname(__filename),
  PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
let _country = null;
function normalizeSection(section) {
  return section
    ? 'string' == typeof section
      ? { title: 'Additional Context', body: section }
      : 'object' == typeof section && section.title && section.body
        ? { title: section.title, body: section.body }
        : null
    : null;
}
function normalizeForComparison(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
let systemPromptConfig = {};
try {
  const spPath = path.join(PROJECT_ROOT, 'SystemInstructions', 'SystemPrompt.json');
  fs.existsSync(spPath) && (systemPromptConfig = JSON.parse(fs.readFileSync(spPath, 'utf-8')));
} catch (e) {}
const getConfig = (key, fallback = null) => systemPromptConfig[key] || fallback;
export async function buildSystemPrompt({
  userName: userName = '',
  customInstructions: customInstructions = '',
  gmailEmail: gmailEmail = null,
  activePersona: activePersona = null,
  connectedServices: connectedServices = [],
  extraContextSections: extraContextSections = [],
} = {}) {
  const timeStr = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
    platform = process.platform,
    osName = 'darwin' === platform ? 'macOS' : 'win32' === platform ? 'Windows' : 'Linux',
    release = os.release(),
    totalMemGB = (os.totalmem() / 1073741824).toFixed(1),
    cpus = os.cpus(),
    cpuModel = (cpus[0]?.model ?? 'Unknown CPU').replace(/\s+/g, ' ').trim(),
    cpuCores = cpus.length,
    country = await (async function () {
      if (_country) return _country;
      const ctrl = new AbortController(),
        timer = setTimeout(() => ctrl.abort(), 250);
      try {
        const res = await fetch('https://ipapi.co/country_name/', { signal: ctrl.signal });
        if (res.ok) return ((_country = (await res.text()).trim()), _country);
      } catch {
      } finally {
        clearTimeout(timer);
      }
      return null;
    })(),
    lines = [],
    push = (...args) => lines.push(...args),
    blank = () => lines.push('');
  if (activePersona) {
    const personaInstructions = activePersona.instructions?.trim() ?? '',
      normalizedInstructions = normalizeForComparison(personaInstructions),
      personaIntro = `You are ${activePersona.name}.`;
    (normalizedInstructions.includes(normalizeForComparison(personaIntro)) || push(personaIntro),
      activePersona.personality && push(`Your personality: ${activePersona.personality}.`),
      !personaInstructions && activePersona.description && push(activePersona.description),
      personaInstructions && (blank(), push(personaInstructions)),
      blank(),
      push('---'),
      blank(),
      getConfig('joaniumContext') && push(getConfig('joaniumContext')));
  } else push(getConfig('joaniumPersona'));
  (blank(),
    push('# User'),
    push(`- Name: ${userName || 'User'}`),
    push(`- Local time: ${timeStr}`),
    push(
      `- Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    ),
    country && push(`- Country: ${country}`),
    push(`- OS: ${osName} ${release}`),
    push(`- Hardware: ${cpuCores}-core CPU (${cpuModel}), ${totalMemGB} GB RAM`));
  const mergedConnectedServices = [...connectedServices];
  return (
    gmailEmail &&
      !mergedConnectedServices.some(
        (item) => item.includes('Google Workspace') || item.includes('Gmail'),
      ) &&
      mergedConnectedServices.push(`Gmail (${gmailEmail})`),
    mergedConnectedServices.length &&
      push(`- Connected services: ${[...new Set(mergedConnectedServices)].join(', ')}`),
    (function (lines, sections = []) {
      for (const rawSection of sections) {
        const section = normalizeSection(rawSection);
        section &&
          (lines.push(''), lines.push(`## ${section.title}`), lines.push(section.body.trim()));
      }
    })(lines, extraContextSections),
    customInstructions?.trim() &&
      (blank(), push('# Custom Instructions'), push(customInstructions.trim())),
    blank(),
    (function (entries = []) {
      const seen = new Set(),
        deduped = [];
      for (const entry of entries) {
        const text = String(entry ?? '').trim();
        if (!text) continue;
        const normalized = normalizeForComparison(text);
        normalized && !seen.has(normalized) && (seen.add(normalized), deduped.push(text));
      }
      return deduped;
    })(getConfig('finalInstructions', [])).forEach((instruction) => push(instruction)),
    lines.join('\n')
  );
}
