import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import {
  nominatimJson,
  haversineKm,
  bearingDeg,
  cardinalDir,
  encodeGeohash,
  decodeGeohash,
} from './Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'GeoExecutor',
  tools: toolsList,
  handlers: {
    get_ip_info: async (params, onStage) => {
      const { ip: ip } = params,
        target = ip?.trim() || '';
      onStage(`🌍 Looking up ${target || 'your IP'}…`);
      const url = target
          ? `http://ip-api.com/json/${encodeURIComponent(target)}?fields=status,message,query,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`
          : 'http://ip-api.com/json/?fields=status,message,query,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as',
        data = await safeJson(url);
      return 'fail' === data.status
        ? `IP lookup failed: ${data.message ?? 'Invalid IP address'}. Try a valid IPv4 or IPv6 address.`
        : [
            `🌍 IP Geolocation — ${data.query}`,
            '',
            `📍 Location: ${data.city}, ${data.regionName}, ${data.country} (${data.countryCode})`,
            `📮 ZIP: ${data.zip || 'N/A'}`,
            `🗺️ Coordinates: ${data.lat}, ${data.lon}`,
            `🕐 Timezone: ${data.timezone}`,
            '',
            `🏢 ISP: ${data.isp}`,
            `🏛️ Organization: ${data.org || data.isp}`,
            `🔌 AS: ${data.as || 'N/A'}`,
            '',
            'Source: ip-api.com',
          ].join('\n');
    },
    reverse_geocode: async (params, onStage) => {
      const { lat: lat, lon: lon } = params;
      onStage(`📍 Reverse geocoding ${lat}, ${lon}…`);
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`,
        data = await nominatimJson(url);
      if (data.error) return `Reverse geocode failed: ${data.error}`;
      const a = data.address || {},
        city = a.city || a.town || a.village || a.hamlet || a.municipality || 'N/A';
      return [
        `📍 Reverse Geocode — ${lat}, ${lon}`,
        '',
        `📌 Full address: ${data.display_name}`,
        `🏙️ City/Town:    ${city}`,
        `🏛️ State/Region: ${a.state || a.province || 'N/A'}`,
        `🌍 Country:      ${a.country} (${a.country_code?.toUpperCase() || 'N/A'})`,
        `📮 Postcode:     ${a.postcode || 'N/A'}`,
        `🏷️ Place type:   ${data.type || data.category || 'N/A'}`,
        '',
        'Source: OpenStreetMap / Nominatim',
      ].join('\n');
    },
    forward_geocode: async (params, onStage) => {
      const { query: query, limit: limit = 3 } = params;
      onStage(`🔍 Geocoding "${query}"…`);
      const cap = Math.min(Math.max(1, limit), 10),
        url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=${cap}&addressdetails=1`,
        results = await nominatimJson(url);
      if (!results?.length) return `No geocoding results found for "${query}".`;
      const lines = [`🔍 Geocode Results for "${query}"`, ''];
      return (
        results.forEach((r, i) => {
          lines.push(
            `${i + 1}. ${r.display_name}`,
            `   📍 Lat/Lon: ${parseFloat(r.lat).toFixed(6)}, ${parseFloat(r.lon).toFixed(6)}`,
            `   🏷️  Type: ${r.type || r.category} | Importance: ${parseFloat(r.importance).toFixed(2)}`,
            `   📦 Bounding box: [${r.boundingbox?.join(', ')}]`,
            '',
          );
        }),
        lines.push('Source: OpenStreetMap / Nominatim'),
        lines.join('\n')
      );
    },
    search_places: async (params, onStage) => {
      const { query: query, country_code: country_code, limit: limit = 5 } = params;
      onStage(`🗺️ Searching places for "${query}"…`);
      const cap = Math.min(Math.max(1, limit), 20);
      let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=${cap}&addressdetails=1`;
      country_code && (url += `&countrycodes=${country_code.toLowerCase()}`);
      const results = await nominatimJson(url);
      if (!results?.length)
        return `No places found for "${query}"${country_code ? ` in ${country_code.toUpperCase()}` : ''}.`;
      const lines = [`🗺️ Place Search — "${query}"`, ''];
      return (
        results.forEach((r, i) => {
          lines.push(
            `${i + 1}. ${r.display_name}`,
            `   📍 ${parseFloat(r.lat).toFixed(5)}, ${parseFloat(r.lon).toFixed(5)} | Type: ${r.type || r.category}`,
            '',
          );
        }),
        lines.push('Source: OpenStreetMap / Nominatim'),
        lines.join('\n')
      );
    },
    get_elevation: async (params, onStage) => {
      const { locations: locations } = params;
      if (!Array.isArray(locations) || !locations.length)
        return 'Provide at least one { lat, lon } location.';
      const capped = locations.slice(0, 100);
      onStage(`🏔️ Fetching elevation for ${capped.length} point(s)…`);
      const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locations: capped.map(({ lat: lat, lon: lon }) => ({ latitude: lat, longitude: lon })),
          }),
        }),
        data = await res.json();
      if (!data.results?.length) return 'Elevation lookup failed. Check your coordinates.';
      const lines = [
        `🏔️ Elevation Results (${data.results.length} point${data.results.length > 1 ? 's' : ''})`,
        '',
      ];
      return (
        data.results.forEach((r, i) => {
          lines.push(
            `${i + 1}. (${r.latitude}, ${r.longitude}) → ${r.elevation} m / ${(3.28084 * r.elevation).toFixed(1)} ft`,
          );
        }),
        lines.push('', 'Source: open-elevation.com'),
        lines.join('\n')
      );
    },
    get_timezone_by_coords: async (params, onStage) => {
      const { lat: lat, lon: lon } = params;
      onStage(`🕐 Looking up timezone for ${lat}, ${lon}…`);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1&daily=sunrise`,
        data = await safeJson(url);
      if (data.error) return `Timezone lookup failed: ${data.reason || 'Unknown error'}`;
      const tz = data.timezone || 'N/A',
        abbr = data.timezone_abbreviation || '',
        offset =
          null != data.utc_offset_seconds
            ? `UTC${data.utc_offset_seconds >= 0 ? '+' : ''}${data.utc_offset_seconds / 3600}`
            : 'N/A',
        now = new Date();
      return [
        `🕐 Timezone — ${lat}, ${lon}`,
        '',
        `🌐 IANA Timezone: ${tz}`,
        `🔤 Abbreviation: ${abbr}`,
        `⏱️ UTC Offset:   ${offset}`,
        `🗓️ Local time:   ${new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' }).format(now)}`,
        '',
        'Source: Open-Meteo',
      ].join('\n');
    },
    get_country_info: async (params, onStage) => {
      const { query: query } = params;
      onStage(`🌍 Fetching country info for "${query}"…`);
      const url = /^[a-zA-Z]{2,3}$/.test(query.trim())
          ? `https://restcountries.com/v3.1/alpha/${encodeURIComponent(query.trim())}`
          : `https://restcountries.com/v3.1/name/${encodeURIComponent(query.trim())}?fullText=true`,
        data = await safeJson(url);
      if (404 === data.status || !Array.isArray(data) || !data.length)
        return `Country "${query}" not found. Use a full name (e.g. "Germany") or ISO code (e.g. "DE").`;
      const c = data[0],
        currencies =
          Object.values(c.currencies || {})
            .map((cur) => `${cur.name} (${cur.symbol || '?'})`)
            .join(', ') || 'N/A',
        languages = Object.values(c.languages || {}).join(', ') || 'N/A',
        capital = c.capital?.[0] || 'N/A',
        pop = c.population?.toLocaleString() || 'N/A',
        area = c.area?.toLocaleString() || 'N/A',
        callingCode = (c.idd?.root || '') + (c.idd?.suffixes?.[0] || ''),
        timezones = c.timezones?.join(', ') || 'N/A',
        region = [c.region, c.subregion].filter(Boolean).join(' › ');
      return [
        `${c.flag || ''} ${c.name?.common} (${c.cca2} / ${c.cca3})`,
        `Official name: ${c.name?.official}`,
        '',
        `🏙️ Capital:      ${capital}`,
        `🌍 Region:       ${region}`,
        `👥 Population:   ${pop}`,
        `📐 Area:         ${area} km²`,
        `💰 Currency:     ${currencies}`,
        `🗣️ Languages:    ${languages}`,
        `📞 Calling code: ${callingCode || 'N/A'}`,
        `🕐 Timezones:    ${timezones}`,
        `🚗 Drives on:    ${c.car?.side || 'N/A'}`,
        `🌐 TLD:          ${c.tld?.join(', ') || 'N/A'}`,
        '',
        'Source: restcountries.com',
      ].join('\n');
    },
    get_country_neighbors: async (params, onStage) => {
      const { query: query } = params;
      onStage(`🌍 Finding neighbors of "${query}"…`);
      const url = /^[a-zA-Z]{2,3}$/.test(query.trim())
          ? `https://restcountries.com/v3.1/alpha/${encodeURIComponent(query.trim())}`
          : `https://restcountries.com/v3.1/name/${encodeURIComponent(query.trim())}?fullText=true`,
        data = await safeJson(url);
      if (!Array.isArray(data) || !data.length) return `Country "${query}" not found.`;
      const country = data[0],
        borders = country.borders || [];
      if (!borders.length)
        return `${country.flag || ''} ${country.name?.common} has no land borders (island nation or landlocked enclave).`;
      onStage(`🗺️ Resolving ${borders.length} border countries…`);
      const borderUrl = `https://restcountries.com/v3.1/alpha?codes=${borders.join(',')}`,
        neighborData = await safeJson(borderUrl),
        lines = [
          `${country.flag || ''} Neighbors of ${country.name?.common} (${borders.length})`,
          '',
        ];
      return (
        Array.isArray(neighborData)
          ? neighborData
              .sort((a, b) => a.name.common.localeCompare(b.name.common))
              .forEach((n) => {
                lines.push(`  ${n.flag || '🏳️'} ${n.name?.common} (${n.cca2} / ${n.cca3})`);
              })
          : borders.forEach((b) => lines.push(`  ${b}`)),
        lines.push('', 'Source: restcountries.com'),
        lines.join('\n')
      );
    },
    get_postal_code_info: async (params, onStage) => {
      const { country_code: country_code, postal_code: postal_code } = params;
      onStage(`📮 Looking up postal code ${postal_code} (${country_code.toUpperCase()})…`);
      const url = `https://api.zippopotam.us/${country_code.toLowerCase()}/${encodeURIComponent(postal_code)}`,
        res = await fetch(url);
      if (!res.ok)
        return `Postal code "${postal_code}" not found in ${country_code.toUpperCase()}. Check the code and country.`;
      const data = await res.json(),
        lines = [
          `📮 Postal Code — ${data['post code']}, ${data.country} (${data['country abbreviation']})`,
          '',
        ];
      return (
        (data.places || []).forEach((p, i) => {
          lines.push(
            `${i + 1}. ${p['place name']}, ${p.state} (${p['state abbreviation'] || p.state})`,
            `   📍 ${p.latitude}, ${p.longitude}`,
          );
        }),
        lines.push('', 'Source: zippopotam.us'),
        lines.join('\n')
      );
    },
    get_nearby_places: async (params, onStage) => {
      const {
          lat: lat,
          lon: lon,
          radius: radius = 500,
          category: category,
          limit: limit = 10,
        } = params,
        r = Math.min(Math.max(50, radius), 5e3),
        cap = Math.min(Math.max(1, limit), 30);
      onStage(`📌 Searching nearby${category ? ` ${category}` : ''} places within ${r}m…`);
      const query = `[out:json][timeout:15];\n(\n  ${(category ? [`node(around:${r},${lat},${lon})["amenity"="${category}"];`, `node(around:${r},${lat},${lon})["tourism"="${category}"];`, `node(around:${r},${lat},${lon})["shop"="${category}"];`, `node(around:${r},${lat},${lon})["leisure"="${category}"];`] : [`node(around:${r},${lat},${lon})["amenity"];`, `node(around:${r},${lat},${lon})["tourism"];`, `node(around:${r},${lat},${lon})["shop"];`]).join('\n  ')}\n);\nout body ${cap};`,
        res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        }),
        elements = ((await res.json()).elements || []).slice(0, cap);
      if (!elements.length)
        return `No places found within ${r}m of (${lat}, ${lon})${category ? ` for category "${category}"` : ''}.`;
      const lines = [`📌 Nearby Places — ${lat}, ${lon} (within ${r}m)`, ''];
      return (
        elements.forEach((el, i) => {
          const name = el.tags?.name || el.tags?.['name:en'] || '(unnamed)',
            type = el.tags?.amenity || el.tags?.tourism || el.tags?.shop || el.tags?.leisure || '?',
            dist = haversineKm(lat, lon, el.lat, el.lon);
          (lines.push(`${i + 1}. ${name} [${type}] — ${(1e3 * dist).toFixed(0)}m away`),
            el.tags?.['addr:street'] &&
              lines.push(
                `   📍 ${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim(),
              ),
            el.tags?.opening_hours && lines.push(`   🕐 ${el.tags.opening_hours}`),
            el.tags?.phone && lines.push(`   📞 ${el.tags.phone}`),
            el.tags?.website && lines.push(`   🌐 ${el.tags.website}`),
            lines.push(''));
        }),
        lines.push('Source: OpenStreetMap / Overpass API'),
        lines.join('\n')
      );
    },
    get_distance: async (params) => {
      const { lat1: lat1, lon1: lon1, lat2: lat2, lon2: lon2 } = params,
        km = haversineKm(lat1, lon1, lat2, lon2),
        bearing = bearingDeg(lat1, lon1, lat2, lon2),
        cardinal = cardinalDir(bearing);
      return [
        '📏 Distance Calculation',
        '',
        `  From: ${lat1}, ${lon1}`,
        `  To:   ${lat2}, ${lon2}`,
        '',
        '  📐 Great-circle distance:',
        `     ${km.toFixed(3)} km`,
        `     ${(0.621371 * km).toFixed(3)} miles`,
        `     ${(0.539957 * km).toFixed(3)} nautical miles`,
        '',
        `  🧭 Bearing: ${bearing.toFixed(1)}° (${cardinal})`,
        '',
        'Method: Haversine formula (assumes spherical Earth, R = 6 371 km)',
      ].join('\n');
    },
    get_midpoint: async (params) => {
      const { lat1: lat1, lon1: lon1, lat2: lat2, lon2: lon2 } = params,
        toRad = (d) => (d * Math.PI) / 180,
        toDeg = (r) => (180 * r) / Math.PI,
        φ1 = toRad(lat1),
        λ1 = toRad(lon1),
        φ2 = toRad(lat2),
        λ2 = toRad(lon2),
        Bx = Math.cos(φ2) * Math.cos(λ2 - λ1),
        By = Math.cos(φ2) * Math.sin(λ2 - λ1),
        φm = Math.atan2(Math.sin(φ1) + Math.sin(φ2), Math.sqrt((Math.cos(φ1) + Bx) ** 2 + By ** 2)),
        λm = λ1 + Math.atan2(By, Math.cos(φ1) + Bx),
        midLat = parseFloat(toDeg(φm).toFixed(6)),
        midLon = parseFloat(toDeg(λm).toFixed(6));
      return [
        '📍 Geographic Midpoint',
        '',
        `  Point A: ${lat1}, ${lon1}`,
        `  Point B: ${lat2}, ${lon2}`,
        '',
        `  📍 Midpoint: ${midLat}, ${midLon}`,
        `  📏 ~${haversineKm(lat1, lon1, midLat, midLon).toFixed(1)} km from each endpoint`,
        '',
        'Method: Spherical 3D vector midpoint',
      ].join('\n');
    },
    check_point_in_radius: async (params) => {
      const {
          centre_lat: centre_lat,
          centre_lon: centre_lon,
          point_lat: point_lat,
          point_lon: point_lon,
          radius_km: radius_km,
        } = params,
        dist = haversineKm(centre_lat, centre_lon, point_lat, point_lon),
        inside = dist <= radius_km;
      return [
        '🔵 Geofence Check',
        '',
        `  Centre:   ${centre_lat}, ${centre_lon}`,
        `  Point:    ${point_lat}, ${point_lon}`,
        `  Radius:   ${radius_km} km`,
        '',
        `  📏 Distance: ${dist.toFixed(3)} km`,
        `  ${inside ? '✅ INSIDE  the radius' : '❌ OUTSIDE the radius'} (${inside ? '-' : '+'}${Math.abs(dist - radius_km).toFixed(3)} km ${inside ? 'margin' : 'over'})`,
      ].join('\n');
    },
    convert_dms_to_dd: async (params) => {
      const { degrees: degrees, minutes: minutes, seconds: seconds, direction: direction } = params,
        dir = direction.toUpperCase();
      if (!['N', 'S', 'E', 'W'].includes(dir))
        return `Invalid direction "${direction}". Use N, S, E, or W.`;
      const dd = degrees + minutes / 60 + seconds / 3600;
      return [
        '🔄 DMS → Decimal Degrees',
        '',
        `  Input:  ${degrees}° ${minutes}' ${seconds}" ${dir}`,
        `  Output: ${(['S', 'W'].includes(dir) ? -dd : dd).toFixed(8)}°`,
        '  Axis:   ' + (['N', 'S'].includes(dir) ? 'Latitude' : 'Longitude'),
      ].join('\n');
    },
    convert_dd_to_dms: async (params) => {
      const { decimal: decimal, axis: axis } = params,
        ax = axis?.toLowerCase();
      if (!['lat', 'lon'].includes(ax)) return `Invalid axis "${axis}". Use "lat" or "lon".`;
      const abs = Math.abs(decimal),
        deg = Math.floor(abs),
        minF = 60 * (abs - deg),
        min = Math.floor(minF);
      return [
        '🔄 Decimal Degrees → DMS',
        '',
        `  Input:  ${decimal}° (${'lat' === ax ? 'Latitude' : 'Longitude'})`,
        `  Output: ${deg}° ${min}' ${(60 * (minF - min)).toFixed(4)}" ${'lat' === ax ? (decimal >= 0 ? 'N' : 'S') : decimal >= 0 ? 'E' : 'W'}`,
      ].join('\n');
    },
    encode_geohash: async (params) => {
      const { lat: lat, lon: lon, precision: precision = 9 } = params,
        prec = Math.min(Math.max(1, Math.round(precision)), 12),
        hash = encodeGeohash(lat, lon, prec),
        decoded = decodeGeohash(hash),
        errM = 111320 * Math.max(decoded.latErr, decoded.lonErr);
      return [
        '🔷 Geohash Encode',
        '',
        `  Input:     ${lat}, ${lon}`,
        `  Precision: ${prec} chars`,
        `  Geohash:   ${hash}`,
        '  Accuracy:  ±' +
          (errM < 1
            ? errM.toFixed(2) + ' m'
            : errM < 1e3
              ? errM.toFixed(1) + ' m'
              : (errM / 1e3).toFixed(2) + ' km'),
      ].join('\n');
    },
    decode_geohash: async (params) => {
      const { hash: hash } = params;
      let decoded;
      try {
        decoded = decodeGeohash(hash.trim());
      } catch (e) {
        return `Invalid geohash: ${e.message}`;
      }
      const { lat: lat, lon: lon, latErr: latErr, lonErr: lonErr, bounds: bounds } = decoded,
        errM = 111320 * Math.max(latErr, lonErr);
      return [
        '🔷 Geohash Decode',
        '',
        `  Geohash:   ${hash.trim()} (${hash.trim().length} chars)`,
        `  Center:    ${lat.toFixed(8)}, ${lon.toFixed(8)}`,
        '  Accuracy:  ±' +
          (errM < 1
            ? errM.toFixed(2) + ' m'
            : errM < 1e3
              ? errM.toFixed(1) + ' m'
              : (errM / 1e3).toFixed(2) + ' km'),
        '',
        '  Bounding box:',
        `    SW: ${bounds.minLat.toFixed(6)}, ${bounds.minLon.toFixed(6)}`,
        `    NE: ${bounds.maxLat.toFixed(6)}, ${bounds.maxLon.toFixed(6)}`,
      ].join('\n');
    },
    get_map_url: async (params) => {
      const { lat: lat, lon: lon, query: query, zoom: zoom = 14 } = params,
        z = Math.min(Math.max(1, Math.round(zoom)), 19);
      if (!lat && !lon && !query) return 'Provide either lat/lon coordinates or a place query.';
      const lines = ['🗺️ Map URLs', ''];
      if (
        (null != lat &&
          null != lon &&
          lines.push(
            `📍 Coordinates: ${lat}, ${lon} (zoom ${z})`,
            '',
            '🌍 OpenStreetMap:',
            `   https://www.openstreetmap.org/#map=${z}/${lat}/${lon}`,
            '',
            '🗺️ Google Maps:',
            `   https://maps.google.com/?q=${lat},${lon}&z=${z}`,
            '',
            '🍎 Apple Maps:',
            `   https://maps.apple.com/?ll=${lat},${lon}&z=${z}`,
          ),
        query)
      ) {
        const enc = encodeURIComponent(query);
        lines.push(
          '',
          `🔍 Query: "${query}"`,
          '',
          '🌍 OpenStreetMap search:',
          `   https://www.openstreetmap.org/search?query=${enc}`,
          '',
          '🗺️ Google Maps search:',
          `   https://maps.google.com/?q=${enc}`,
          '',
          '🍎 Apple Maps search:',
          `   https://maps.apple.com/?q=${enc}`,
        );
      }
      return lines.join('\n');
    },
  },
});
