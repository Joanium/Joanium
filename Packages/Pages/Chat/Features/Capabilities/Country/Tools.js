export const COUNTRY_TOOLS = [
  {
    name: 'get_country_info',
    description:
      'Get detailed info about any country — capital, population, area, languages, currencies, flag, timezone, region, and more.',
    category: 'restcountries',
    parameters: {
      country: {
        type: 'string',
        required: !0,
        description: 'Country name or code (e.g. "India", "US", "Japan", "Brazil", "DE")',
      },
    },
  },
];
