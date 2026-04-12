export const CRYPTO_TOOLS = [
  {
    name: 'get_crypto_price',
    description:
      'Get real-time cryptocurrency price, market cap, 24h change, and trading volume from CoinGecko. Works for Bitcoin, Ethereum, and thousands of tokens.',
    category: 'coingecko',
    parameters: {
      coin: {
        type: 'string',
        required: !0,
        description: 'Coin name or symbol (e.g. "bitcoin", "ethereum", "solana", "BTC", "ETH")',
      },
      vs_currency: {
        type: 'string',
        required: !1,
        description: 'Quote currency (default: "usd"). Can be "usd", "eur", "inr", "gbp", etc.',
      },
    },
  },
  {
    name: 'get_crypto_trending',
    description: 'Get the top trending cryptocurrencies on CoinGecko right now.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'get_coin_info',
    description:
      'Get detailed info about a cryptocurrency: description, homepage, genesis date, hashing algorithm, block time, and social links.',
    category: 'coingecko',
    parameters: {
      coin: {
        type: 'string',
        required: !0,
        description: 'Coin name or symbol (e.g. "bitcoin", "ethereum")',
      },
    },
  },
  {
    name: 'get_top_coins',
    description:
      'Get the top N cryptocurrencies by market cap, with price, 24h change, and volume.',
    category: 'coingecko',
    parameters: {
      limit: {
        type: 'number',
        required: !1,
        description: 'How many coins to return (default: 10, max: 50)',
      },
      vs_currency: { type: 'string', required: !1, description: 'Quote currency (default: "usd")' },
    },
  },
  {
    name: 'get_coin_history',
    description: 'Get the price, market cap, and volume of a coin on a specific historical date.',
    category: 'coingecko',
    parameters: {
      coin: { type: 'string', required: !0, description: 'Coin name or symbol' },
      date: {
        type: 'string',
        required: !0,
        description: 'Date in DD-MM-YYYY format (e.g. "01-01-2021")',
      },
    },
  },
  {
    name: 'get_coin_market_chart',
    description: 'Get price, market cap, and volume history for a coin over the past N days.',
    category: 'coingecko',
    parameters: {
      coin: { type: 'string', required: !0, description: 'Coin name or symbol' },
      days: {
        type: 'number',
        required: !1,
        description: 'Number of days of history (default: 7). Use 1, 7, 14, 30, 90, 180, 365.',
      },
      vs_currency: { type: 'string', required: !1, description: 'Quote currency (default: "usd")' },
    },
  },
  {
    name: 'get_coin_ohlc',
    description: 'Get OHLC (open/high/low/close) candlestick data for a coin over the past N days.',
    category: 'coingecko',
    parameters: {
      coin: { type: 'string', required: !0, description: 'Coin name or symbol' },
      days: {
        type: 'number',
        required: !1,
        description: 'Days of OHLC data (default: 7). Allowed: 1, 7, 14, 30, 90, 180, 365.',
      },
      vs_currency: { type: 'string', required: !1, description: 'Quote currency (default: "usd")' },
    },
  },
  {
    name: 'get_global_market',
    description:
      'Get global crypto market stats: total market cap, 24h volume, BTC dominance, active coins, and ongoing ICOs.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'get_defi_stats',
    description:
      'Get DeFi market overview: total DeFi market cap, ETH dominance in DeFi, top DeFi coin, DeFi to ETH ratio.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'get_fear_greed_index',
    description:
      'Get the current Crypto Fear & Greed Index score and classification (Extreme Fear → Extreme Greed) from alternative.me.',
    category: 'alternative.me',
    parameters: {},
  },
  {
    name: 'get_top_exchanges',
    description:
      'Get the top cryptocurrency exchanges ranked by trust score, with volume and country info.',
    category: 'coingecko',
    parameters: {
      limit: {
        type: 'number',
        required: !1,
        description: 'Number of exchanges to return (default: 10)',
      },
    },
  },
  {
    name: 'get_exchange_info',
    description:
      'Get detailed info about a specific exchange: description, country, year established, trust score, and 24h volume.',
    category: 'coingecko',
    parameters: {
      exchange_id: {
        type: 'string',
        required: !0,
        description: 'Exchange ID slug (e.g. "binance", "coinbase", "kraken", "bybit")',
      },
    },
  },
  {
    name: 'get_coin_categories',
    description:
      'Get all cryptocurrency categories (e.g. DeFi, Layer 1, NFT, Metaverse) with market cap and 24h change.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'get_coins_by_category',
    description:
      'Get top coins within a specific category (e.g. "decentralized-finance-defi", "layer-1", "nft").',
    category: 'coingecko',
    parameters: {
      category_id: {
        type: 'string',
        required: !0,
        description:
          'Category slug (e.g. "decentralized-finance-defi", "layer-1", "gaming", "nft", "metaverse")',
      },
      limit: { type: 'number', required: !1, description: 'Number of coins (default: 10)' },
    },
  },
  {
    name: 'get_coin_tickers',
    description:
      'Get the trading pairs (tickers) for a coin across different exchanges, with last price and volume.',
    category: 'coingecko',
    parameters: { coin: { type: 'string', required: !0, description: 'Coin name or symbol' } },
  },
  {
    name: 'convert_crypto',
    description:
      'Convert an amount from one cryptocurrency (or fiat) to another. E.g. "how much is 2.5 ETH in BTC?" or "what is 1000 USD worth in SOL?"',
    category: 'coingecko',
    parameters: {
      from_coin: {
        type: 'string',
        required: !0,
        description: 'Source coin or currency (e.g. "ethereum", "usd", "BTC")',
      },
      to_coin: {
        type: 'string',
        required: !0,
        description: 'Target coin or currency (e.g. "bitcoin", "inr", "SOL")',
      },
      amount: { type: 'number', required: !1, description: 'Amount to convert (default: 1)' },
    },
  },
  {
    name: 'get_btc_exchange_rates',
    description: 'Get BTC exchange rates against major fiat currencies and other crypto assets.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'get_trending_nfts',
    description: 'Get the top trending NFT collections on CoinGecko right now.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'get_recently_added',
    description: 'Get the most recently listed coins on CoinGecko.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'get_gainers_losers',
    description: 'Get the top gaining and top losing cryptocurrencies in the last 24 hours.',
    category: 'coingecko',
    parameters: {
      vs_currency: { type: 'string', required: !1, description: 'Quote currency (default: "usd")' },
      limit: {
        type: 'number',
        required: !1,
        description: 'Number of top gainers/losers each (default: 5)',
      },
    },
  },
  {
    name: 'get_coin_dominance',
    description: 'Get the market dominance percentage of Bitcoin, Ethereum, and other major coins.',
    category: 'coingecko',
    parameters: {},
  },
  {
    name: 'search_crypto',
    description:
      'Search for coins, exchanges, and NFTs by keyword. Useful for finding the correct coin ID before querying.',
    category: 'coingecko',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Search term (e.g. "pepe", "layer zero", "uniswap")',
      },
    },
  },
];
