export async function resolveCoin(coinInput) {
  const searchData = await safeJson(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(coinInput)}`,
    ),
    result = searchData.coins?.[0];
  if (!result) throw new Error(`Couldn't find cryptocurrency "${coinInput}".`);
  return result;
}
export function currencySymbol(c) {
  return (
    { usd: '$', eur: '€', inr: '₹', gbp: '£', jpy: '¥', aud: 'A$', cad: 'C$' }[c.toLowerCase()] ??
    c.toUpperCase() + ' '
  );
}
