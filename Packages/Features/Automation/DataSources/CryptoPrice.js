export const type = 'crypto_price';
export const meta = { label: 'Crypto Prices', group: 'Web' };
export async function collect(ds) {
  try {
    const coins = (ds.coins ?? 'bitcoin,ethereum')
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
        .join(','),
      cur = (ds.currency ?? 'usd').toLowerCase();
    if (!coins) return 'No coin symbols specified.';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=${cur}&include_24hr_change=true`,
    );
    if (!response.ok)
      return `Crypto price fetch failed: ${response.status} ${response.statusText}`.trim();
    const data = await response.json();
    return Object.keys(data).length
      ? 'Crypto Prices:\n' +
          Object.entries(data)
            .map(
              ([coin, info]) =>
                `${coin}: ${info[cur]} ${cur.toUpperCase()} (${info[`${cur}_24h_change`]?.toFixed(2) ?? 'N/A'}% 24h)`,
            )
            .join('\n')
      : 'EMPTY: No crypto price data returned.';
  } catch (err) {
    return `Crypto price fetch failed: ${err.message}`;
  }
}
