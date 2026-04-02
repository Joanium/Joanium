export const type = 'weather';
export const meta = { label: 'Weather', group: 'Web' };
export async function collect(ds) {
  if (!ds.location) return 'No location specified.';
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ds.location)}&count=1&format=json`
  ).then(r => r.json());
  if (!geo.results?.length) return `Location not found: ${ds.location}`;
  const { latitude, longitude, name, country, timezone } = geo.results[0];
  const units = ds.units ?? 'celsius';
  const w = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation` +
    `&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${encodeURIComponent(timezone ?? 'auto')}&forecast_days=1`
  ).then(r => r.json());
  const c = w.current, deg = units === 'fahrenheit' ? '°F' : '°C';
  return `Weather in ${name}, ${country}:\nTemp: ${c.temperature_2m}${deg}\nHumidity: ${c.relative_humidity_2m}%\nWind: ${c.wind_speed_10m} km/h`;
}
