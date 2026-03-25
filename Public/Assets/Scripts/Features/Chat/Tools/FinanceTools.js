export const FINANCE_TOOLS = [
    {
        name: 'get_exchange_rate',
        description: 'Get real-time currency exchange rates for 160+ currencies. Convert between any two currencies.',
        category: 'exchange_rate',
        parameters: {
            from: { type: 'string', required: true, description: 'Base currency ISO code (e.g. "USD", "EUR", "INR", "GBP")' },
            to: { type: 'string', required: false, description: 'Target currency ISO code (e.g. "EUR"). If omitted, returns all major rates.' },
        },
    },
    {
        name: 'get_treasury_data',
        description: 'Get official US Treasury financial data — national debt, average interest rates, or daily cash balance from fiscaldata.treasury.gov.',
        category: 'treasury',
        parameters: {
            type: {
                type: 'string',
                required: false,
                description: 'Type of data: "debt" (national debt, default), "rates" (average interest rates), or "balance" (daily cash balance)',
            },
        },
    },
    {
        name: 'get_fred_data',
        description: 'Get economic data from the Federal Reserve (FRED). Covers GDP, unemployment rate, CPI/inflation, federal funds rate, and hundreds of other indicators.',
        category: 'fred',
        parameters: {
            series_id: {
                type: 'string',
                required: true,
                description: 'FRED series ID (e.g. "GDP", "UNRATE" for unemployment, "CPIAUCSL" for CPI/inflation, "FEDFUNDS" for fed rate, "DGS10" for 10-year treasury yield, "SP500")',
            },
            limit: { type: 'number', required: false, description: 'Number of recent observations to return (default: 5)' },
        },
    },
];