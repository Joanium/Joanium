import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'AstronomyExecutor',
  tools: toolsList,
  handlers: {
    get_apod: async (params, onStage) => {
      const { date } = params;
      onStage(`🔭 Fetching NASA Astronomy Picture of the Day…`);

      // NASA APOD — DEMO_KEY allows 30 req/hr (plenty for personal use)
      let apiKey = 'DEMO_KEY';
      try {
        const config = await window.electronAPI?.invoke?.('get-free-connector-config', 'nasa');
        if (config?.credentials?.apiKey?.trim()) {
          apiKey = config.credentials.apiKey.trim();
        }
      } catch {
        /* optional */
      }

      let url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
      if (date) url += `&date=${encodeURIComponent(date)}`;

      const data = await safeJson(url);

      if (!data?.title) {
        return 'Could not fetch NASA APOD right now. Try again shortly.';
      }

      const lines = [
        `🔭 NASA Astronomy Picture of the Day`,
        ``,
        `**${data.title}**`,
        `📅 ${data.date}`,
        ``,
        data.explanation,
        ``,
      ];

      if (data.media_type === 'image') {
        lines.push(`🖼️ Image: ${data.hdurl ?? data.url}`);
      } else if (data.media_type === 'video') {
        lines.push(`🎬 Video: ${data.url}`);
      }

      if (data.copyright) lines.push(`📷 Credit: ${data.copyright}`);
      lines.push(`Source: NASA APOD (apod.nasa.gov)`);

      return lines.join('\n');
    },

    get_iss_location: async (params, onStage) => {
      onStage(`🛸 Tracking the ISS…`);

      // Open Notify API — free, no key
      const data = await safeJson('http://api.open-notify.org/iss-now.json');

      if (data.message !== 'success' || !data.iss_position) {
        return 'Could not get ISS position right now. Try again shortly.';
      }

      const { latitude, longitude } = data.iss_position;
      const timestamp = data.timestamp
        ? new Date(data.timestamp * 1000).toLocaleString()
        : new Date().toLocaleString();

      // Try to reverse-geocode approximate location
      let locationDesc = '';
      try {
        const geoData = await safeJson(
          `https://geocoding-api.open-meteo.com/v1/search?name=${latitude},${longitude}&count=1&format=json`,
        );
        if (geoData.results?.[0]) {
          const r = geoData.results[0];
          locationDesc = `${r.name}, ${r.country}`;
        }
      } catch {
        /* non-fatal */
      }

      // Get crew info
      let crewInfo = '';
      try {
        const crewData = await safeJson('http://api.open-notify.org/astros.json');
        if (crewData.message === 'success') {
          const issCrew = crewData.people?.filter((p) => p.craft === 'ISS') ?? [];
          if (issCrew.length) {
            crewInfo = `\n👨‍🚀 Crew (${issCrew.length}): ${issCrew.map((p) => p.name).join(', ')}`;
          }
        }
      } catch {
        /* non-fatal */
      }

      return [
        `🛸 International Space Station — Live Position`,
        ``,
        `📍 Latitude: ${latitude}`,
        `📍 Longitude: ${longitude}`,
        locationDesc ? `🌍 Above: ${locationDesc}` : `🌊 Above: Open ocean / remote area`,
        `🕐 Timestamp: ${timestamp}`,
        crewInfo,
        ``,
        `🗺️ Track live: https://spotthestation.nasa.gov/tracking_map.cfm`,
        `Source: Open Notify API`,
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
});
