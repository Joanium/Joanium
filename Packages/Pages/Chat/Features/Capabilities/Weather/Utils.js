export async function resolveLocation(location) {
  const geoData = await safeJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&format=json`,
  );
  if (!geoData.results?.length)
    throw new Error(`Couldn't find a location called "${location}". Try a specific city name.`);
  return geoData.results[0];
}
export const deg = (units) => ('fahrenheit' === units ? '°F' : '°C');
export function uvLabel(uv) {
  return uv <= 2
    ? 'Low'
    : uv <= 5
      ? 'Moderate'
      : uv <= 7
        ? 'High'
        : uv <= 10
          ? 'Very High'
          : 'Extreme';
}
export function windDir(degrees) {
  return (
    [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ][Math.round(degrees / 22.5) % 16] ?? '?'
  );
}
export function aqiLabel(aqi) {
  return aqi <= 50
    ? 'Good'
    : aqi <= 100
      ? 'Moderate'
      : aqi <= 150
        ? 'Unhealthy for Sensitive Groups'
        : aqi <= 200
          ? 'Unhealthy'
          : aqi <= 300
            ? 'Very Unhealthy'
            : 'Hazardous';
}
