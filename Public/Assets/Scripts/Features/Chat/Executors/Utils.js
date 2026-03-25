export const WMO_CODES = {
    0: '☀️ Clear sky', 1: '🌤️ Mainly clear', 2: '⛅ Partly cloudy',
    3: '☁️ Overcast', 45: '🌫️ Foggy', 48: '🌫️ Icy fog',
    51: '🌦️ Light drizzle', 53: '🌦️ Drizzle', 55: '🌦️ Heavy drizzle',
    61: '🌧️ Slight rain', 63: '🌧️ Moderate rain', 65: '🌧️ Heavy rain',
    71: '🌨️ Slight snow', 73: '🌨️ Moderate snow', 75: '❄️ Heavy snow',
    77: '🌨️ Snow grains', 80: '🌦️ Light showers', 81: '🌧️ Showers',
    82: '⛈️ Violent showers', 85: '🌨️ Snow showers', 86: '❄️ Heavy snow showers',
    95: '⛈️ Thunderstorm', 96: '⛈️ Thunderstorm + hail', 99: '⛈️ Thunderstorm + heavy hail',
};

export function fmt(n, decimals = 2) {
    return n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals }) : 'N/A';
}

export function fmtBig(n) {
    if (n == null) return 'N/A';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${fmt(n)}`;
}

export async function safeJson(url, opts = {}) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
    return res.json();
}