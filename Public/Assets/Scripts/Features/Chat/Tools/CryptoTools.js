export const CRYPTO_TOOLS = [
    {
        name: 'get_crypto_price',
        description: 'Get real-time cryptocurrency price, market cap, 24h change, and trading volume from CoinGecko. Works for Bitcoin, Ethereum, and thousands of tokens.',
        category: 'coingecko',
        parameters: {
            coin: { type: 'string', required: true, description: 'Coin name or symbol (e.g. "bitcoin", "ethereum", "solana", "BTC", "ETH")' },
            vs_currency: { type: 'string', required: false, description: 'Quote currency (default: "usd"). Can be "usd", "eur", "inr", "gbp", etc.' },
        },
    },
    {
        name: 'get_crypto_trending',
        description: 'Get the top trending cryptocurrencies on CoinGecko right now.',
        category: 'coingecko',
        parameters: {},
    },
];