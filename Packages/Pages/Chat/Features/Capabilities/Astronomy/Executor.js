import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'AstronomyExecutor',
  tools: toolsList,
  handlers: {
    get_apod: async (params, onStage) => {
      const { date: date } = params;
      onStage('🔭 Fetching NASA Astronomy Picture of the Day…');
      let apiKey = 'DEMO_KEY';
      try {
        const config = await window.electronAPI?.invoke?.('get-free-connector-config', 'nasa');
        config?.credentials?.apiKey?.trim() && (apiKey = config.credentials.apiKey.trim());
      } catch {}
      let url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
      date && (url += `&date=${encodeURIComponent(date)}`);
      const data = await safeJson(url);
      if (!data?.title) return 'Could not fetch NASA APOD right now. Try again shortly.';
      const lines = [
        '🔭 NASA Astronomy Picture of the Day',
        '',
        `**${data.title}**`,
        `📅 ${data.date}`,
        '',
        data.explanation,
        '',
      ];
      return (
        'image' === data.media_type
          ? lines.push(`🖼️ Image: ${data.hdurl ?? data.url}`)
          : 'video' === data.media_type && lines.push(`🎬 Video: ${data.url}`),
        data.copyright && lines.push(`📷 Credit: ${data.copyright}`),
        lines.push('Source: NASA APOD (apod.nasa.gov)'),
        lines.join('\n')
      );
    },
    get_iss_location: async (params, onStage) => {
      onStage('🛸 Tracking the ISS…');
      const data = await safeJson('http://api.open-notify.org/iss-now.json');
      if ('success' !== data.message || !data.iss_position)
        return 'Could not get ISS position right now. Try again shortly.';
      const { latitude: latitude, longitude: longitude } = data.iss_position,
        timestamp = data.timestamp
          ? new Date(1e3 * data.timestamp).toLocaleString()
          : new Date().toLocaleString();
      let locationDesc = '';
      try {
        const geoData = await safeJson(
          `https://geocoding-api.open-meteo.com/v1/search?name=${latitude},${longitude}&count=1&format=json`,
        );
        if (geoData.results?.[0]) {
          const r = geoData.results[0];
          locationDesc = `${r.name}, ${r.country}`;
        }
      } catch {}
      let crewInfo = '';
      try {
        const crewData = await safeJson('http://api.open-notify.org/astros.json');
        if ('success' === crewData.message) {
          const issCrew = crewData.people?.filter((p) => 'ISS' === p.craft) ?? [];
          issCrew.length &&
            (crewInfo = `\n👨‍🚀 Crew (${issCrew.length}): ${issCrew.map((p) => p.name).join(', ')}`);
        }
      } catch {}
      return [
        '🛸 International Space Station — Live Position',
        '',
        `📍 Latitude: ${latitude}`,
        `📍 Longitude: ${longitude}`,
        locationDesc ? `🌍 Above: ${locationDesc}` : '🌊 Above: Open ocean / remote area',
        `🕐 Timestamp: ${timestamp}`,
        crewInfo,
        '',
        '🗺️ Track live: https://spotthestation.nasa.gov/tracking_map.cfm',
        'Source: Open Notify API',
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
});
