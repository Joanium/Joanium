import { createExecutor } from '../Shared/createExecutor.js';
import { WMO_CODES, safeJson } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'WeatherExecutor',
  tools: toolsList,
  handlers: {
    get_weather: async (params, onStage) => {
      const { location, units = 'celsius' } = params;
      if (!location) throw new Error('Missing required param: location');
      onStage(`🌍 Locating ${location}…`);

      const geoData = await safeJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&format=json`,
      );
      if (!geoData.results?.length) {
        return `Couldn't find a location called "${location}". Try a specific city name like "Mumbai" or "London".`;
      }
      const { latitude, longitude, name, country, timezone } = geoData.results[0];
      onStage(`🌡️ Fetching weather for ${name}, ${country}…`);

      const tz = encodeURIComponent(timezone ?? 'auto');
      const weatherData = await safeJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,` +
          `weather_code,precipitation,cloud_cover,surface_pressure` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
          `&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${tz}&forecast_days=3`,
      );

      const c = weatherData.current;
      const d = weatherData.daily;
      const deg = units === 'fahrenheit' ? '°F' : '°C';
      const desc = WMO_CODES[c.weather_code] ?? '🌡️ Unknown conditions';

      const forecast =
        d?.time
          ?.slice(0, 3)
          .map((date, i) => {
            const wc = WMO_CODES[d.weathercode[i]] ?? '';
            return `  ${date}: ${wc.split(' ').slice(1).join(' ')} | ${d.temperature_2m_max[i]}${deg} / ${d.temperature_2m_min[i]}${deg} | Precip: ${d.precipitation_sum[i]}mm`;
          })
          .join('\n') ?? 'No forecast data';

      return [
        `📍 ${name}, ${country}`,
        ``,
        `Current Conditions: ${desc}`,
        `🌡️  Temperature: ${c.temperature_2m}${deg} (feels like ${c.apparent_temperature}${deg})`,
        `💧 Humidity: ${c.relative_humidity_2m}%`,
        `💨 Wind: ${c.wind_speed_10m} km/h`,
        `☁️  Cloud cover: ${c.cloud_cover}%`,
        `🌧️  Precipitation: ${c.precipitation}mm`,
        `⚙️  Pressure: ${c.surface_pressure} hPa`,
        ``,
        `3-Day Forecast:`,
        forecast,
        ``,
        `Source: Open-Meteo (open-meteo.com)`,
      ].join('\n');
    },
  },
});
