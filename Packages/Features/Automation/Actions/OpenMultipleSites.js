import { openSite } from './Site.js';
export const actionType = 'open_multiple_sites';
export const actionMeta = {
  label: 'Open multiple sites',
  group: 'System',
  fields: ['urls'],
  requiredFields: ['urls'],
};
export async function execute(action) {
  const urls = String(action.urls ?? '')
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean);
  for (const url of urls)
    (await openSite(url), urls.length > 1 && (await new Promise((r) => setTimeout(r, 400))));
}
