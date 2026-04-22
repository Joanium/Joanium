import { createExecutor } from '../Shared/createExecutor.js';
import { fmt, fmtBig, safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
import { resolveCoin, currencySymbol } from './Utils.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'CryptoExecutor',
  tools: toolsList,
  handlers: {
    get_crypto_price: async (params, onStage) => {
      const { coin: coin, vs_currency: vs_currency = 'usd' } = params;
      if (!coin)
        throw new Error('Missing required param: coin (e.g. "bitcoin", "ethereum", "BTC")');
      onStage(`🔍 Searching for ${coin}…`);
      const searchData = await safeJson(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(coin)}`,
        ),
        coinResult = searchData.coins?.[0];
      if (!coinResult)
        return `Couldn't find cryptocurrency "${coin}". Try common names like "bitcoin", "ethereum", "solana", "dogecoin".`;
      onStage(`📈 Loading market data for ${coinResult.name}…`);
      const currencies = [vs_currency, 'usd', 'eur', 'inr']
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(','),
        d = (
          await safeJson(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinResult.id}&vs_currencies=${currencies}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true`,
          )
        )[coinResult.id];
      if (!d)
        return `Price data temporarily unavailable for "${coinResult.name}". Try again shortly.`;
      const change = d[`${vs_currency}_24h_change`]?.toFixed(2) ?? 'N/A',
        changeDir = parseFloat(change) >= 0 ? '📈' : '📉',
        changeLabel = parseFloat(change) >= 0 ? `+${change}%` : `${change}%`,
        lastUpdated = d.last_updated_at
          ? new Date(1e3 * d.last_updated_at).toLocaleString()
          : 'N/A',
        lines = [
          `🪙 ${coinResult.name} (${coinResult.symbol.toUpperCase()})`,
          '',
          `Price (${vs_currency.toUpperCase()}): ${fmt(d[vs_currency])} ${changeDir} ${changeLabel} (24h)`,
          `Market Cap: ${fmtBig(d[`${vs_currency}_market_cap`])}`,
          `24h Volume: ${fmtBig(d[`${vs_currency}_24h_vol`])}`,
        ];
      return (
        'usd' !== vs_currency && d.usd && lines.push(`USD: $${fmt(d.usd)}`),
        'eur' !== vs_currency && d.eur && lines.push(`EUR: €${fmt(d.eur)}`),
        'inr' !== vs_currency && d.inr && lines.push(`INR: ₹${fmt(d.inr, 0)}`),
        lines.push('', `Last updated: ${lastUpdated}`, 'Source: CoinGecko'),
        lines.join('\n')
      );
    },
    get_crypto_trending: async (params, onStage) => {
      onStage('🔥 Fetching trending coins…');
      const data = await safeJson('https://api.coingecko.com/api/v3/search/trending'),
        trending = data.coins?.slice(0, 7) ?? [];
      return trending.length
        ? `🔥 Trending on CoinGecko right now:\n\n${trending
            .map((t, i) => {
              const c = t.item;
              return `${i + 1}. ${c.name} (${c.symbol}) — Rank #${c.market_cap_rank ?? '?'}`;
            })
            .join('\n')}\n\nSource: CoinGecko`
        : 'No trending coins data available right now.';
    },
    get_coin_info: async (params, onStage) => {
      const { coin: coin } = params;
      onStage(`🔍 Resolving ${coin}…`);
      const coinResult = await resolveCoin(coin);
      onStage(`📋 Fetching details for ${coinResult.name}…`);
      const data = await safeJson(
          `https://api.coingecko.com/api/v3/coins/${coinResult.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
        ),
        d = data.description?.en?.replace(/[<>]/g, '').slice(0, 300) ?? 'N/A',
        homepage = data.links?.homepage?.[0] ?? 'N/A',
        reddit = data.links?.subreddit_url ?? 'N/A',
        twitter = data.links?.twitter_screen_name
          ? `https://twitter.com/${data.links.twitter_screen_name}`
          : 'N/A',
        genesis = data.genesis_date ?? 'N/A',
        algo = data.hashing_algorithm ?? 'N/A',
        blockTime =
          null != data.block_time_in_minutes ? `${data.block_time_in_minutes} min` : 'N/A',
        categories = data.categories?.filter(Boolean).slice(0, 5).join(', ') ?? 'N/A';
      return [
        `📋 ${data.name} (${data.symbol?.toUpperCase()})`,
        `Rank: #${data.market_cap_rank ?? '?'}`,
        '',
        `Description: ${d}${300 === d.length ? '…' : ''}`,
        '',
        `Categories:   ${categories}`,
        `Genesis Date: ${genesis}`,
        `Algorithm:    ${algo}`,
        `Block Time:   ${blockTime}`,
        '',
        `Website: ${homepage}`,
        `Reddit:  ${reddit}`,
        `Twitter: ${twitter}`,
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_top_coins: async (params, onStage) => {
      const { limit: limit = 10, vs_currency: vs_currency = 'usd' } = params,
        n = Math.min(Number(limit) || 10, 50);
      onStage(`📊 Fetching top ${n} coins by market cap…`);
      const data = await safeJson(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs_currency}&order=market_cap_desc&per_page=${n}&page=1&sparkline=false&price_change_percentage=24h`,
      );
      if (!data?.length) return 'Market data unavailable right now.';
      const sym = currencySymbol(vs_currency),
        lines = data.map((c, i) => {
          const change = c.price_change_percentage_24h?.toFixed(2) ?? 'N/A',
            arrow = parseFloat(change) >= 0 ? '▲' : '▼';
          return `${String(i + 1).padStart(2)}. ${c.name.padEnd(18)} ${sym}${fmt(c.current_price).padStart(14)}  ${arrow} ${change}%  MCap: ${fmtBig(c.market_cap)}`;
        });
      return [
        `🏆 Top ${n} Coins by Market Cap (${vs_currency.toUpperCase()})`,
        '',
        ...lines,
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_coin_history: async (params, onStage) => {
      const { coin: coin, date: date } = params;
      if (!date) throw new Error('Missing required param: date (DD-MM-YYYY)');
      onStage(`🔍 Resolving ${coin}…`);
      const coinResult = await resolveCoin(coin);
      onStage(`📅 Fetching historical data for ${coinResult.name} on ${date}…`);
      const data = await safeJson(
          `https://api.coingecko.com/api/v3/coins/${coinResult.id}/history?date=${date}&localization=false`,
        ),
        p = data.market_data?.current_price,
        mc = data.market_data?.market_cap,
        vol = data.market_data?.total_volume;
      return p
        ? [
            `📅 ${coinResult.name} (${coinResult.symbol.toUpperCase()}) — ${date}`,
            '',
            `Price:      $${fmt(p.usd ?? 0)} USD  |  ₹${fmt(p.inr ?? 0, 0)} INR  |  €${fmt(p.eur ?? 0)} EUR`,
            `Market Cap: $${fmtBig(mc?.usd ?? 0)}`,
            `Volume:     $${fmtBig(vol?.usd ?? 0)}`,
            '',
            'Source: CoinGecko',
          ].join('\n')
        : `No historical data found for ${coinResult.name} on ${date}.`;
    },
    get_coin_market_chart: async (params, onStage) => {
      const { coin: coin, days: days = 7, vs_currency: vs_currency = 'usd' } = params;
      onStage(`🔍 Resolving ${coin}…`);
      const coinResult = await resolveCoin(coin);
      onStage(`📈 Fetching ${days}-day chart for ${coinResult.name}…`);
      const prices =
        (
          await safeJson(
            `https://api.coingecko.com/api/v3/coins/${coinResult.id}/market_chart?vs_currency=${vs_currency}&days=${days}`,
          )
        ).prices ?? [];
      if (!prices.length) return 'Chart data unavailable right now.';
      const first = prices[0],
        last = prices[prices.length - 1],
        high = Math.max(...prices.map((p) => p[1])),
        low = Math.min(...prices.map((p) => p[1])),
        change = (((last[1] - first[1]) / first[1]) * 100).toFixed(2),
        sym = currencySymbol(vs_currency),
        arrow = parseFloat(change) >= 0 ? '📈' : '📉';
      return [
        `📊 ${coinResult.name} — Last ${days} Day(s) (${vs_currency.toUpperCase()})`,
        '',
        `Start:  ${sym}${fmt(first[1])}  (${new Date(first[0]).toLocaleDateString()})`,
        `End:    ${sym}${fmt(last[1])}  (${new Date(last[0]).toLocaleDateString()})`,
        `Change: ${arrow} ${change}%`,
        `High:   ${sym}${fmt(high)}`,
        `Low:    ${sym}${fmt(low)}`,
        `Points: ${prices.length} data points`,
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_coin_ohlc: async (params, onStage) => {
      const { coin: coin, days: days = 7, vs_currency: vs_currency = 'usd' } = params;
      onStage(`🔍 Resolving ${coin}…`);
      const coinResult = await resolveCoin(coin);
      onStage(`🕯️ Fetching OHLC data for ${coinResult.name}…`);
      const data = await safeJson(
        `https://api.coingecko.com/api/v3/coins/${coinResult.id}/ohlc?vs_currency=${vs_currency}&days=${days}`,
      );
      if (!data?.length) return 'OHLC data unavailable right now.';
      const sym = currencySymbol(vs_currency),
        recent = data.slice(-5),
        lines = recent.map(
          ([ts, o, h, l, c]) =>
            `${new Date(ts).toLocaleDateString()}  O:${sym}${fmt(o)}  H:${sym}${fmt(h)}  L:${sym}${fmt(l)}  C:${sym}${fmt(c)}`,
        );
      return [
        `🕯️ ${coinResult.name} OHLC — Last ${days} Day(s) (${vs_currency.toUpperCase()})`,
        `(Showing last ${recent.length} candles)`,
        '',
        ...lines,
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_global_market: async (params, onStage) => {
      onStage('🌍 Fetching global crypto market stats…');
      const d = (await safeJson('https://api.coingecko.com/api/v3/global')).data;
      if (!d) return 'Global market data unavailable right now.';
      const btcDom = d.market_cap_percentage?.btc?.toFixed(2) ?? 'N/A',
        ethDom = d.market_cap_percentage?.eth?.toFixed(2) ?? 'N/A';
      return [
        '🌍 Global Crypto Market',
        '',
        `Total Market Cap:  $${fmtBig(d.total_market_cap?.usd)}`,
        `24h Volume:        $${fmtBig(d.total_volume?.usd)}`,
        `BTC Dominance:     ${btcDom}%`,
        `ETH Dominance:     ${ethDom}%`,
        `Active Coins:      ${(d.active_cryptocurrencies ?? 0).toLocaleString()}`,
        `Markets:           ${(d.markets ?? 0).toLocaleString()}`,
        `Ongoing ICOs:      ${d.ongoing_icos ?? 'N/A'}`,
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_defi_stats: async (params, onStage) => {
      onStage('🏦 Fetching DeFi market overview…');
      const d = (
        await safeJson('https://api.coingecko.com/api/v3/global/decentralized_finance_defi')
      ).data;
      return d
        ? [
            '🏦 DeFi Market Overview',
            '',
            `DeFi Market Cap:      $${fmtBig(parseFloat(d.defi_market_cap))}`,
            `ETH Market Cap:       $${fmtBig(parseFloat(d.eth_market_cap))}`,
            `DeFi / Eth Ratio:     ${parseFloat(d.defi_to_eth_ratio).toFixed(4)}`,
            `24h Trading Volume:   $${fmtBig(parseFloat(d.trading_volume_24h))}`,
            `DeFi Dominance:       ${parseFloat(d.defi_dominance).toFixed(2)}%`,
            `Top DeFi Coin:        ${d.top_coin_name} (${d.top_coin_defi_dominance?.toFixed(2)}% dominance)`,
            '',
            'Source: CoinGecko',
          ].join('\n')
        : 'DeFi data unavailable right now.';
    },
    get_fear_greed_index: async (params, onStage) => {
      onStage('😨 Fetching Fear & Greed Index…');
      const items =
        (await safeJson('https://api.alternative.me/fng/?limit=3&format=json')).data ?? [];
      if (!items.length) return 'Fear & Greed data unavailable right now.';
      const emojiMap = {
        'Extreme Fear': '😱',
        Fear: '😨',
        Neutral: '😐',
        Greed: '🤑',
        'Extreme Greed': '🚀',
      };
      return [
        '😨 Crypto Fear & Greed Index',
        '',
        ...items.map((item, i) => {
          const label = 0 === i ? 'Today   ' : 1 === i ? 'Yesterday' : '2 Days Ago',
            emoji = emojiMap[item.value_classification] ?? '❓';
          return `${label}: ${item.value.padStart(3)} — ${emoji} ${item.value_classification}`;
        }),
        '',
        'Source: alternative.me',
      ].join('\n');
    },
    get_top_exchanges: async (params, onStage) => {
      const { limit: limit = 10 } = params,
        n = Math.min(Number(limit) || 10, 20);
      onStage(`🏛️ Fetching top ${n} exchanges…`);
      const data = await safeJson(
        `https://api.coingecko.com/api/v3/exchanges?per_page=${n}&page=1`,
      );
      return data?.length
        ? [
            `🏛️ Top ${n} Exchanges`,
            '',
            ...data.map(
              (ex, i) =>
                `${String(i + 1).padStart(2)}. ${ex.name.padEnd(20)} Trust: ${ex.trust_score ?? 'N/A'}/10  Vol: $${fmtBig(4e4 * ex.trade_volume_24h_btc)}  Country: ${ex.country ?? 'N/A'}`,
            ),
            '',
            'Source: CoinGecko',
          ].join('\n')
        : 'Exchange data unavailable right now.';
    },
    get_exchange_info: async (params, onStage) => {
      const { exchange_id: exchange_id } = params;
      if (!exchange_id) throw new Error('Missing required param: exchange_id');
      onStage(`🏛️ Fetching info for ${exchange_id}…`);
      const data = await safeJson(`https://api.coingecko.com/api/v3/exchanges/${exchange_id}`);
      if (data.error)
        return `Exchange "${exchange_id}" not found. Try slugs like "binance", "coinbase", "kraken".`;
      const desc = data.description?.replace(/[<>]/g, '').slice(0, 250) ?? 'N/A';
      return [
        `🏛️ ${data.name}`,
        '',
        `Country:      ${data.country ?? 'N/A'}`,
        `Year Est.:    ${data.year_established ?? 'N/A'}`,
        `Trust Score:  ${data.trust_score ?? 'N/A'} / 10`,
        `Trust Rank:   #${data.trust_score_rank ?? 'N/A'}`,
        `24h Vol (BTC): ₿${fmt(data.trade_volume_24h_btc)}`,
        'Has Trading Incentive: ' + (data.has_trading_incentive ? 'Yes' : 'No'),
        '',
        `About: ${desc}${250 === desc.length ? '…' : ''}`,
        '',
        `URL: ${data.url ?? 'N/A'}`,
        'Source: CoinGecko',
      ].join('\n');
    },
    get_coin_categories: async (params, onStage) => {
      onStage('📂 Fetching coin categories…');
      const data = await safeJson(
        'https://api.coingecko.com/api/v3/coins/categories?order=market_cap_desc',
      );
      return data?.length
        ? [
            '📂 Top Coin Categories by Market Cap',
            '',
            ...data.slice(0, 15).map((cat, i) => {
              const change = cat.market_cap_change_24h?.toFixed(2) ?? 'N/A',
                arrow = parseFloat(change) >= 0 ? '▲' : '▼';
              return `${String(i + 1).padStart(2)}. ${cat.name.padEnd(35)} MCap: $${fmtBig(cat.market_cap)}  ${arrow} ${change}%`;
            }),
            '',
            'Source: CoinGecko',
          ].join('\n')
        : 'Category data unavailable right now.';
    },
    get_coins_by_category: async (params, onStage) => {
      const { category_id: category_id, limit: limit = 10 } = params;
      if (!category_id) throw new Error('Missing required param: category_id');
      const n = Math.min(Number(limit) || 10, 50);
      onStage(`📂 Fetching top coins in category "${category_id}"…`);
      const data = await safeJson(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${category_id}&order=market_cap_desc&per_page=${n}&page=1&sparkline=false`,
      );
      return data?.length
        ? [
            `📂 Top ${n} Coins — ${category_id}`,
            '',
            ...data.map((c, i) => {
              const change = c.price_change_percentage_24h?.toFixed(2) ?? 'N/A',
                arrow = parseFloat(change) >= 0 ? '▲' : '▼';
              return `${String(i + 1).padStart(2)}. ${c.name.padEnd(20)} $${fmt(c.current_price).padStart(14)}  ${arrow} ${change}%`;
            }),
            '',
            'Source: CoinGecko',
          ].join('\n')
        : `No coins found for category "${category_id}". Check the category slug.`;
    },
    get_coin_tickers: async (params, onStage) => {
      const { coin: coin } = params;
      onStage(`🔍 Resolving ${coin}…`);
      const coinResult = await resolveCoin(coin);
      onStage(`📡 Fetching trading pairs for ${coinResult.name}…`);
      const data = await safeJson(
          `https://api.coingecko.com/api/v3/coins/${coinResult.id}/tickers?include_exchange_logo=false&page=1&depth=false&order=volume_desc`,
        ),
        tickers = data.tickers?.slice(0, 10) ?? [];
      if (!tickers.length) return `No trading pairs found for ${coinResult.name}.`;
      const lines = tickers.map(
        (t, i) =>
          `${String(i + 1).padStart(2)}. ${t.market?.name?.padEnd(18) ?? 'N/A'.padEnd(18)} ${(t.base + '/' + t.target).padEnd(12)}  Last: $${fmt(t.converted_last?.usd ?? 0)}  Vol: $${fmtBig(t.converted_volume?.usd ?? 0)}`,
      );
      return [
        `📡 Top Trading Pairs — ${coinResult.name} (${coinResult.symbol.toUpperCase()})`,
        '',
        ...lines,
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    convert_crypto: async (params, onStage) => {
      const { from_coin: from_coin, to_coin: to_coin, amount: amount = 1 } = params;
      onStage(`🔄 Resolving ${from_coin} and ${to_coin}…`);
      const FIATS = ['usd', 'eur', 'inr', 'gbp', 'jpy', 'aud', 'cad', 'chf', 'cny'],
        fromFiat = FIATS.includes(from_coin.toLowerCase()),
        toFiat = FIATS.includes(to_coin.toLowerCase());
      let fromCoinId, fromName, toCoinId, toName;
      if (fromFiat) ((fromCoinId = null), (fromName = from_coin.toUpperCase()));
      else {
        const r = await resolveCoin(from_coin);
        ((fromCoinId = r.id), (fromName = `${r.name} (${r.symbol.toUpperCase()})`));
      }
      if (toFiat) ((toCoinId = null), (toName = to_coin.toUpperCase()));
      else {
        const r = await resolveCoin(to_coin);
        ((toCoinId = r.id), (toName = `${r.name} (${r.symbol.toUpperCase()})`));
      }
      onStage('💱 Fetching prices…');
      const ids = [fromCoinId, toCoinId].filter(Boolean).join(','),
        vsCurrencies = ['usd', ...FIATS].filter((v, i, a) => a.indexOf(v) === i).join(','),
        priceData = await safeJson(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}`,
        );
      let fromUsd, toUsd;
      if (fromFiat) {
        const fiatKey = from_coin.toLowerCase(),
          toInFromFiat = priceData[toCoinId]?.[fiatKey],
          toInUsd = priceData[toCoinId]?.usd;
        if (null == toInFromFiat || null == toInUsd) throw new Error('Price data unavailable.');
        const result = (amount / toInFromFiat) * 1,
          toSym = currencySymbol(to_coin.toLowerCase());
        return `💱 ${fmt(amount)} ${fromName} = ${toSym}${fmt(result)} ${toName}\n\nSource: CoinGecko`;
      }
      if (toFiat) {
        const fiatKey = to_coin.toLowerCase(),
          fromInFiat = priceData[fromCoinId]?.[fiatKey];
        if (null == fromInFiat) throw new Error('Price data unavailable.');
        const result = amount * fromInFiat,
          toSym = currencySymbol(fiatKey);
        return `💱 ${fmt(amount)} ${fromName} = ${toSym}${fmt(result, 'inr' === fiatKey ? 0 : 2)} ${toName}\n\nSource: CoinGecko`;
      }
      if (
        ((fromUsd = priceData[fromCoinId]?.usd),
        (toUsd = priceData[toCoinId]?.usd),
        !fromUsd || !toUsd)
      )
        throw new Error('Price data unavailable for one or both coins.');
      const result = (amount * fromUsd) / toUsd;
      return [
        '💱 Conversion',
        '',
        `${fmt(amount)} ${fromName}`,
        `= ${fmt(result)} ${toName}`,
        '',
        `Rate: 1 ${fromName} = ${fmt(fromUsd / toUsd)} ${toName}`,
        `(via USD: 1 ${fromName} = $${fmt(fromUsd)})`,
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_btc_exchange_rates: async (params, onStage) => {
      onStage('₿ Fetching BTC exchange rates…');
      const rates = (await safeJson('https://api.coingecko.com/api/v3/exchange_rates')).rates ?? {};
      return [
        '₿ Bitcoin Exchange Rates',
        '',
        ...['usd', 'eur', 'gbp', 'inr', 'jpy', 'aud', 'cad', 'eth', 'bnb', 'sol']
          .filter((k) => rates[k])
          .map((k) => {
            const r = rates[k];
            return `${r.name.padEnd(20)} ${r.unit} ${fmt(r.value).padStart(16)} (${r.type})`;
          }),
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_trending_nfts: async (params, onStage) => {
      onStage('🖼️ Fetching trending NFTs…');
      const data = await safeJson('https://api.coingecko.com/api/v3/search/trending'),
        nfts = data.nfts?.slice(0, 7) ?? [];
      return nfts.length
        ? [
            '🖼️ Trending NFT Collections',
            '',
            ...nfts.map(
              (n, i) =>
                `${i + 1}. ${n.name}  |  Floor: $${fmt(n.floor_price_in_native_currency ?? 0)}  |  24h: ${n.floor_price_24h_percentage_change?.toFixed(2) ?? 'N/A'}%`,
            ),
            '',
            'Source: CoinGecko',
          ].join('\n')
        : 'No trending NFT data available right now.';
    },
    get_recently_added: async (params, onStage) => {
      (onStage('🆕 Fetching recently listed coins…'),
        await safeJson(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=id_asc&per_page=20&page=1&sparkline=false&price_change_percentage=24h',
        ));
      const trending = await safeJson('https://api.coingecko.com/api/v3/search/trending'),
        newCoins = trending.coins?.slice(0, 10) ?? [];
      return newCoins.length
        ? [
            '🆕 Recently Trending / Newly Gaining Traction',
            '',
            ...newCoins.map((t, i) => {
              const c = t.item;
              return `${i + 1}. ${c.name} (${c.symbol})  Rank: #${c.market_cap_rank ?? '?'}  Score: ${c.score ?? 'N/A'}`;
            }),
            '',
            'Source: CoinGecko',
          ].join('\n')
        : 'Recently added data unavailable right now.';
    },
    get_gainers_losers: async (params, onStage) => {
      const { vs_currency: vs_currency = 'usd', limit: limit = 5 } = params,
        n = Math.min(Number(limit) || 5, 20);
      onStage('🚀 Fetching top gainers and losers…');
      const sorted = [
          ...(
            await safeJson(
              `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs_currency}&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`,
            )
          ).filter((c) => null != c.price_change_percentage_24h),
        ].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h),
        gainers = sorted.slice(0, n),
        losers = sorted.slice(-n).reverse(),
        sym = currencySymbol(vs_currency),
        fmtRow = (c, i) => {
          const change = c.price_change_percentage_24h.toFixed(2);
          return `${String(i + 1).padStart(2)}. ${c.name.padEnd(20)} ${sym}${fmt(c.current_price).padStart(12)}  ${change}%`;
        };
      return [
        `🚀 Top ${n} Gainers (24h)`,
        '',
        ...gainers.map(fmtRow),
        '',
        `📉 Top ${n} Losers (24h)`,
        '',
        ...losers.map(fmtRow),
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    get_coin_dominance: async (params, onStage) => {
      onStage('📊 Fetching market dominance…');
      const data = await safeJson('https://api.coingecko.com/api/v3/global'),
        pct = data.data?.market_cap_percentage ?? {};
      return [
        '📊 Crypto Market Dominance',
        '',
        ...Object.entries(pct)
          .sort((a, b) => b[1] - a[1])
          .map(
            ([symbol, dom], i) =>
              `${String(i + 1).padStart(2)}. ${symbol.toUpperCase().padEnd(8)} ${dom.toFixed(2)}%  ${'█'.repeat(Math.round(dom / 2))}`,
          ),
        '',
        'Source: CoinGecko',
      ].join('\n');
    },
    search_crypto: async (params, onStage) => {
      const { query: query } = params;
      if (!query) throw new Error('Missing required param: query');
      onStage(`🔍 Searching for "${query}"…`);
      const data = await safeJson(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
        ),
        coins = data.coins?.slice(0, 7) ?? [],
        exchanges = data.exchanges?.slice(0, 3) ?? [],
        nfts = data.nfts?.slice(0, 3) ?? [],
        lines = [];
      return (
        coins.length &&
          (lines.push('🪙 Coins:'),
          coins.forEach((c, i) =>
            lines.push(
              `  ${i + 1}. ${c.name} (${c.symbol.toUpperCase()})  id: "${c.id}"  Rank: #${c.market_cap_rank ?? '?'}`,
            ),
          )),
        exchanges.length &&
          (lines.push('', '🏛️ Exchanges:'),
          exchanges.forEach((ex, i) => lines.push(`  ${i + 1}. ${ex.name}  id: "${ex.id}"`))),
        nfts.length &&
          (lines.push('', '🖼️ NFTs:'),
          nfts.forEach((n, i) => lines.push(`  ${i + 1}. ${n.name}  id: "${n.id}"`))),
        lines.length
          ? [`🔍 Search results for "${query}"`, '', ...lines, '', 'Source: CoinGecko'].join('\n')
          : `No results found for "${query}".`
      );
    },
  },
});
