export const type = 'crypto_price';
export const meta = { label: 'Crypto Prices', group: 'Web' };
export async function collect(ds) {
  const coins = (ds.coins ?? 'bitcoin,ethereum').split(',').map(c => c.trim().toLowerCase()).join(',');
  const cur = (ds.currency ?? 'usd').toLowerCase();
  const data = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=${cur}&include_24hr_change=true`
  ).then(r => r.json());
  if (!Object.keys(data).length) return 'EMPTY: No crypto price data returned.';
  return `Crypto Prices:\n` +
    Object.entries(data).map(([coin, info]) =>
      `${coin}: ${info[cur]} ${cur.toUpperCase()} (${info[`${cur}_24h_change`]?.toFixed(2) ?? 'N/A'}% 24h)`
    ).join('\n');
}
