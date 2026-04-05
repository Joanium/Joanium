export const type = 'weather';
export const meta = { label: 'Weather', group: 'Web' };

export async function collect(ds) {
  if (!ds.location) return 'No location specified.';

  try {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ds.location)}&count=1&format=json`,
    );
    if (!geoResponse.ok) {
      return `Weather lookup failed: ${geoResponse.status} ${geoResponse.statusText}`.trim();
    }

    const geo = await geoResponse.json();
    if (!geo.results?.length) return `Location not found: ${ds.location}`;

    const { latitude, longitude, name, country, timezone } = geo.results[0];
    const units = ds.units ?? 'celsius';
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation` +
        `&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${encodeURIComponent(timezone ?? 'auto')}&forecast_days=1`,
    );
    if (!weatherResponse.ok) {
      return `Weather lookup failed: ${weatherResponse.status} ${weatherResponse.statusText}`.trim();
    }

    const weather = await weatherResponse.json();
    const current = weather.current;
    if (!current) return 'Weather lookup failed: no current conditions were returned.';

    const degree = units === 'fahrenheit' ? 'F' : 'C';
    return [
      `Weather in ${name}, ${country}:`,
      `Temp: ${current.temperature_2m} deg ${degree}`,
      `Feels like: ${current.apparent_temperature} deg ${degree}`,
      `Humidity: ${current.relative_humidity_2m}%`,
      `Wind: ${current.wind_speed_10m} km/h`,
      `Precipitation: ${current.precipitation ?? 0} mm`,
    ].join('\n');
  } catch (err) {
    return `Weather lookup failed: ${err.message}`;
  }
}
