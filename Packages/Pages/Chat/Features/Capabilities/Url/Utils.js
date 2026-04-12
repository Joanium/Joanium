export function parseOrThrow(url) {
  try {
    return new URL(url);
  } catch {
    throw new Error(`"${url}" is not a valid URL. Include https:// or http://`);
  }
}
export const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'twclid',
  'igshid',
  'mc_eid',
  '_ga',
  '_gl',
  'ref',
  'source',
  'affiliate_id',
  'partner_id',
  'click_id',
]);
