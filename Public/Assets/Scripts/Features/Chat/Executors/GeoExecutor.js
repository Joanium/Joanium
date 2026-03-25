import { safeJson } from './utils.js';

const HANDLED = new Set(['get_ip_info']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    if (toolName !== 'get_ip_info') throw new Error(`GeoExecutor: unknown tool "${toolName}"`);

    const { ip } = params;
    const target = ip?.trim() || '';
    onStage(`🌍 Looking up ${target || 'your IP'}…`);

    // ip-api.com — free, no key, 45 req/min
    const url = target
        ? `http://ip-api.com/json/${encodeURIComponent(target)}?fields=status,message,query,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`
        : `http://ip-api.com/json/?fields=status,message,query,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`;

    const data = await safeJson(url);

    if (data.status === 'fail') {
        return `IP lookup failed: ${data.message ?? 'Invalid IP address'}. Try a valid IPv4 or IPv6 address.`;
    }

    const lines = [
        `🌍 IP Geolocation — ${data.query}`,
        ``,
        `📍 Location: ${data.city}, ${data.regionName}, ${data.country} (${data.countryCode})`,
        `📮 ZIP: ${data.zip || 'N/A'}`,
        `🗺️ Coordinates: ${data.lat}, ${data.lon}`,
        `🕐 Timezone: ${data.timezone}`,
        ``,
        `🏢 ISP: ${data.isp}`,
        `🏛️ Organization: ${data.org || data.isp}`,
        `🔌 AS: ${data.as || 'N/A'}`,
        ``,
        `Source: ip-api.com`,
    ];

    return lines.join('\n');
}
