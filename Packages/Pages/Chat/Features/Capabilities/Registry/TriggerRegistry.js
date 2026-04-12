import { TRIGGERED_GROUPS_FROM_MANIFESTS } from './CapabilityManifest.js';
export const TRIGGERED_GROUPS = TRIGGERED_GROUPS_FROM_MANIFESTS;
for (const group of TRIGGERED_GROUPS) {
  ((group._singleWords = new Set()), (group._phrases = []));
  for (const trigger of group.triggers) {
    const t = String(trigger).trim().toLowerCase();
    t && (t.includes(' ') ? group._phrases.push(t) : group._singleWords.add(t));
  }
}
const _categoryToGroup = new Map();
for (const group of TRIGGERED_GROUPS)
  for (const cat of group.featureCategories) _categoryToGroup.set(cat, group.name);
export function matchTriggeredGroups(userText = '') {
  const text = String(userText ?? '')
    .trim()
    .toLowerCase();
  if (!text) return new Set();
  const words = text.match(/[a-z0-9]+/g) ?? [],
    matched = new Set();
  for (const group of TRIGGERED_GROUPS) {
    let found = group._phrases.some((phrase) => text.includes(phrase));
    (found || (found = words.some((word) => group._singleWords.has(word))),
      found && matched.add(group.name));
  }
  return matched;
}
export function groupForCategory(category = '') {
  return _categoryToGroup.get(category) ?? null;
}
export function buildTriggeredGroupCatalog() {
  return TRIGGERED_GROUPS.map((group) => {
    const sample = group.triggers.slice(0, 5).join(', ');
    return `- ${group.name}: ${group.description} (e.g. ${sample})`;
  }).join('\n');
}
