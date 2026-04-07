import { createExecutor } from '../Shared/createExecutor.js';
import { fmt, fmtBig, safeJson } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'CryptoExecutor',
  tools: toolsList,
  handlers: {
    get_crypto_price: async (params, onStage) => {
      const { coin, vs_currency = 'usd' } = params;
      if (!coin)
        throw new Error('Missing required param: coin (e.g. "bitcoin", "ethereum", "BTC")');
      onStage(`🔍 Searching for ${coin}…`);

      const searchData = await safeJson(
        `https://api.coingecko.com/API/v3/search?query=${encodeURIComponent(coin)}`,
      );
      const coinResult = searchData.coins?.[0];
      if (!coinResult) {
        return `Couldn't find cryptocurrency "${coin}". Try common names like "bitcoin", "ethereum", "solana", "dogecoin".`;
      }
      onStage(`📈 Loading market data for ${coinResult.name}…`);

      const currencies = [vs_currency, 'usd', 'eur', 'inr']
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(',');
      const priceData = await safeJson(
        `https://api.coingecko.com/API/v3/simple/price?ids=${coinResult.id}` +
          `&vs_currencies=${currencies}` +
          `&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true`,
      );

      const d = priceData[coinResult.id];
      if (!d)
        return `Price data temporarily unavailable for "${coinResult.name}". Try again shortly.`;

      const change = d[`${vs_currency}_24h_change`]?.toFixed(2) ?? 'N/A';
      const changeDir = parseFloat(change) >= 0 ? '📈' : '📉';
      const changeLabel = parseFloat(change) >= 0 ? `+${change}%` : `${change}%`;
      const lastUpdated = d.last_updated_at
        ? new Date(d.last_updated_at * 1000).toLocaleString()
        : 'N/A';

      const lines = [
        `🪙 ${coinResult.name} (${coinResult.symbol.toUpperCase()})`,
        ``,
        `Price (${vs_currency.toUpperCase()}): ${fmt(d[vs_currency])} ${changeDir} ${changeLabel} (24h)`,
        `Market Cap: ${fmtBig(d[`${vs_currency}_market_cap`])}`,
        `24h Volume: ${fmtBig(d[`${vs_currency}_24h_vol`])}`,
      ];
      if (vs_currency !== 'usd' && d.usd) lines.push(`USD: $${fmt(d.usd)}`);
      if (vs_currency !== 'eur' && d.eur) lines.push(`EUR: €${fmt(d.eur)}`);
      if (vs_currency !== 'inr' && d.inr) lines.push(`INR: ₹${fmt(d.inr, 0)}`);
      lines.push(``, `Last updated: ${lastUpdated}`, `Source: CoinGecko`);
      return lines.join('\n');
    },

    get_crypto_trending: async (params, onStage) => {
      onStage(`🔥 Fetching trending coins…`);
      const data = await safeJson('https://api.coingecko.com/API/v3/search/trending');
      const trending = data.coins?.slice(0, 7) ?? [];
      if (!trending.length) return 'No trending coins data available right now.';
      const lines = trending.map((t, i) => {
        const c = t.item;
        return `${i + 1}. ${c.name} (${c.symbol}) — Rank #${c.market_cap_rank ?? '?'}`;
      });
      return `🔥 Trending on CoinGecko right now:\n\n${lines.join('\n')}\n\nSource: CoinGecko`;
    },
  },
});
