import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson, fmt } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'CountryExecutor',
  tools: toolsList,
  handlers: {
    get_country_info: async (params, onStage) => {
      const { country } = params;
      if (!country) throw new Error('Missing required param: country');
      onStage(`🌐 Looking up ${country}…`);

      // restcountries.com — free, no key
      let data;
      try {
        data = await safeJson(
          `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=false`,
        );
      } catch {
        // Try by code
        try {
          data = await safeJson(
            `https://restcountries.com/v3.1/alpha/${encodeURIComponent(country)}`,
          );
        } catch {
          return `Country "${country}" not found. Try a full name like "India" or a code like "US", "JP", "BR".`;
        }
      }

      if (!Array.isArray(data) || !data.length) {
        return `No results for "${country}". Try a different name or country code.`;
      }

      const c = data[0];

      const languages = c.languages ? Object.values(c.languages).join(', ') : 'N/A';
      const currencies = c.currencies
        ? Object.values(c.currencies)
            .map((cur) => `${cur.name} (${cur.symbol ?? ''})`)
            .join(', ')
        : 'N/A';
      const timezones =
        (c.timezones ?? []).slice(0, 3).join(', ') + (c.timezones?.length > 3 ? '…' : '');
      const borders = c.borders?.length ? c.borders.join(', ') : 'None (island or isolated)';

      return [
        `🌐 ${c.name?.common ?? country} ${c.flag ?? ''}`,
        `   ${c.name?.official ?? ''}`,
        ``,
        `🏛️ Capital: ${(c.capital ?? []).join(', ') || 'N/A'}`,
        `👥 Population: ${c.population ? c.population.toLocaleString() : 'N/A'}`,
        `📐 Area: ${c.area ? c.area.toLocaleString() + ' km²' : 'N/A'}`,
        `🌍 Region: ${c.region ?? 'N/A'}${c.subregion ? ` — ${c.subregion}` : ''}`,
        `🗣️ Languages: ${languages}`,
        `💰 Currencies: ${currencies}`,
        `🕐 Timezones: ${timezones}`,
        `🚗 Driving side: ${c.car?.side ?? 'N/A'}`,
        `🔤 Country code: ${c.cca2 ?? ''} / ${c.cca3 ?? ''}`,
        `📞 Calling code: ${c.idd?.root ?? ''}${(c.idd?.suffixes ?? [])[0] ?? ''}`,
        `🗺️ Borders: ${borders}`,
        `🔗 Maps: ${c.maps?.googleMaps ?? 'N/A'}`,
        ``,
        `Source: REST Countries (restcountries.com)`,
      ].join('\n');
    },
  },
});
