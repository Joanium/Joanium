import { createExecutor } from '../Shared/createExecutor.js';
import { WMO_CODES, safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
import { resolveLocation, deg, uvLabel, windDir, aqiLabel } from './Utils.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'WeatherExecutor',
  tools: toolsList,
  handlers: {
    get_weather: async (params, onStage) => {
      const { location: location, units: units = 'celsius' } = params;
      if (!location) throw new Error('Missing required param: location');
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage(`🌡️ Fetching weather for ${name}, ${country}…`);
      const tz = encodeURIComponent(timezone ?? 'auto'),
        w = await safeJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,cloud_cover,surface_pressure&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${tz}&forecast_days=3`,
        ),
        c = w.current,
        d = w.daily,
        D = deg(units),
        desc = WMO_CODES[c.weather_code] ?? '🌡️ Unknown conditions',
        forecast =
          d?.time
            ?.slice(0, 3)
            .map(
              (date, i) =>
                `  ${date}: ${(WMO_CODES[d.weathercode[i]] ?? '').split(' ').slice(1).join(' ')} | ${d.temperature_2m_max[i]}${D} / ${d.temperature_2m_min[i]}${D} | Precip: ${d.precipitation_sum[i]}mm`,
            )
            .join('\n') ?? 'No forecast data';
      return [
        `📍 ${name}, ${country}`,
        '',
        `Current Conditions: ${desc}`,
        `🌡️  Temperature: ${c.temperature_2m}${D} (feels like ${c.apparent_temperature}${D})`,
        `💧 Humidity: ${c.relative_humidity_2m}%`,
        `💨 Wind: ${c.wind_speed_10m} km/h`,
        `☁️  Cloud cover: ${c.cloud_cover}%`,
        `🌧️  Precipitation: ${c.precipitation}mm`,
        `⚙️  Pressure: ${c.surface_pressure} hPa`,
        '',
        '3-Day Forecast:',
        forecast,
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_hourly_forecast: async (params, onStage) => {
      const { location: location, units: units = 'celsius', hours: hours = 24 } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('⏱️ Fetching hourly forecast…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        limit = Math.min(Number(hours) || 24, 48),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${tz}&forecast_days=2`,
          )
        ).hourly,
        D = deg(units);
      return [
        `📍 ${name}, ${country} — Next ${limit}h Hourly Forecast`,
        '  Time              Icon   Temp      Rain%   Wind',
        h.time
          .slice(0, limit)
          .map((t, i) => {
            const wc = (WMO_CODES[h.weather_code[i]] ?? '').split(' ')[0];
            return `  ${t.replace('T', ' ')}  ${wc}  ${h.temperature_2m[i]}${D}  💧${h.precipitation_probability[i]}%  💨${h.wind_speed_10m[i]}km/h`;
          })
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_weekly_forecast: async (params, onStage) => {
      const { location: location, units: units = 'celsius' } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('📅 Fetching 7-day forecast…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        d = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max,precipitation_probability_max,wind_speed_10m_max&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${tz}&forecast_days=7`,
          )
        ).daily,
        D = deg(units);
      return [
        `📍 ${name}, ${country} — 7-Day Forecast`,
        '  Date        Condition         Hi/Lo         Rain         UV',
        d.time
          .map(
            (date, i) =>
              `  ${date}  ${WMO_CODES[d.weathercode[i]] ?? '❓'}  ${d.temperature_2m_max[i]}${D}/${d.temperature_2m_min[i]}${D}  💧${d.precipitation_sum[i]}mm(${d.precipitation_probability_max[i]}%)  ☀️UV${d.uv_index_max[i]}`,
          )
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_air_quality: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
      } = await resolveLocation(location);
      onStage('🫁 Fetching air quality data…');
      const c = (
          await safeJson(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,european_aqi`,
          )
        ).current,
        aqi = c.european_aqi;
      return [
        `📍 ${name}, ${country} — Current Air Quality`,
        '',
        `🏷️  AQI (European): ${aqi} — ${aqiLabel(aqi)}`,
        '',
        'Pollutants:',
        `  PM2.5:           ${c.pm2_5} µg/m³`,
        `  PM10:            ${c.pm10} µg/m³`,
        `  NO₂:             ${c.nitrogen_dioxide} µg/m³`,
        `  Ozone (O₃):      ${c.ozone} µg/m³`,
        `  Carbon Monoxide: ${c.carbon_monoxide} µg/m³`,
        '',
        'Source: Open-Meteo Air Quality API (open-meteo.com)',
      ].join('\n');
    },
    get_uv_index: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('☀️ Fetching UV index…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        w = await safeJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=uv_index&daily=uv_index_max&timezone=${tz}&forecast_days=1`,
        ),
        peak = w.daily?.uv_index_max?.[0] ?? 'N/A',
        rows = (w.hourly?.time ?? [])
          .map((t, i) => {
            const uv = w.hourly.uv_index[i];
            return `  ${t.replace('T', ' ')}  UV: ${uv}  ${uvLabel(uv)}`;
          })
          .join('\n');
      return [
        `📍 ${name}, ${country} — UV Index Today`,
        `Peak UV: ${peak} — ${uvLabel(peak)}`,
        '',
        rows,
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_wind_forecast: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('💨 Fetching wind data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,wind_speed_80m,wind_direction_80m&wind_speed_unit=kmh&timezone=${tz}&forecast_days=2`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Wind Forecast (next 24 h)`,
        '  Time              Speed@10m  Gusts      Dir    Speed@80m',
        h.time
          .slice(0, 24)
          .map(
            (t, i) =>
              `  ${t.replace('T', ' ')}  ${h.wind_speed_10m[i]}km/h (gust ${h.wind_gusts_10m[i]}km/h) ${windDir(h.wind_direction_10m[i])}  @80m: ${h.wind_speed_80m[i]}km/h`,
          )
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_precipitation_forecast: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('🌧️ Fetching precipitation data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=precipitation,rain,showers,snowfall,precipitation_probability,weather_code&timezone=${tz}&forecast_days=2`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Precipitation Forecast`,
        h.time
          .slice(0, 48)
          .filter((_, i) => h.precipitation_probability[i] > 0 || h.precipitation[i] > 0)
          .map((t, i) => {
            const wc = (WMO_CODES[h.weather_code[i]] ?? '').split(' ')[0];
            return `  ${t.replace('T', ' ')}  ${wc}  Total:${h.precipitation[i]}mm  Rain:${h.rain[i]}  Snow:${h.snowfall[i]}cm  Prob:${h.precipitation_probability[i]}%`;
          })
          .join('\n') || '  No significant precipitation in the next 48 hours.',
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_historical_weather: async (params, onStage) => {
      const {
        location: location,
        start_date: start_date,
        end_date: end_date,
        units: units = 'celsius',
      } = params;
      if (!start_date || !end_date)
        throw new Error('start_date and end_date are required (YYYY-MM-DD)');
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('🗂️ Fetching historical data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        d = (
          await safeJson(
            `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start_date}&end_date=${end_date}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,weathercode&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${tz}`,
          )
        ).daily,
        D = deg(units);
      return [
        `📍 ${name}, ${country} — Historical Weather ${start_date} → ${end_date}`,
        d.time
          .map(
            (date, i) =>
              `  ${date}  ${(WMO_CODES[d.weathercode[i]] ?? '').split(' ')[0]}  Hi:${d.temperature_2m_max[i]}${D} Lo:${d.temperature_2m_min[i]}${D} Avg:${d.temperature_2m_mean[i]}${D}  💧${d.precipitation_sum[i]}mm  💨${d.wind_speed_10m_max[i]}km/h`,
          )
          .join('\n'),
        '',
        'Source: Open-Meteo Archive API (open-meteo.com)',
      ].join('\n');
    },
    get_sunrise_sunset: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('🌅 Fetching sunrise/sunset times…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        d = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=sunrise,sunset,daylight_duration,sunshine_duration&timezone=${tz}&forecast_days=7`,
          )
        ).daily;
      return [
        `📍 ${name}, ${country} — Sunrise & Sunset (7 days)`,
        '  Date        Sunrise   Sunset    Daylight  Sunshine',
        d.time
          .map((date, i) => {
            const daylightH = (d.daylight_duration[i] / 3600).toFixed(1),
              sunshineH = (d.sunshine_duration[i] / 3600).toFixed(1);
            return `  ${date}  🌅 ${d.sunrise[i].split('T')[1]}  🌇 ${d.sunset[i].split('T')[1]}  Day: ${daylightH}h  ☀️ Sunshine: ${sunshineH}h`;
          })
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_solar_radiation: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('☀️ Fetching solar radiation data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=shortwave_radiation,direct_normal_irradiance,diffuse_radiation,sunshine_duration&timezone=${tz}&forecast_days=1`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Solar Radiation Today`,
        h.time
          .map(
            (t, i) =>
              `  ${t.replace('T', ' ')}  Global:${h.shortwave_radiation[i]}W/m²  Direct:${h.direct_normal_irradiance[i]}W/m²  Diffuse:${h.diffuse_radiation[i]}W/m²`,
          )
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_soil_data: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('🌱 Fetching soil data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,soil_temperature_54cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm&timezone=${tz}&forecast_days=1`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Current Soil Conditions`,
        '',
        'Soil Temperature:',
        `   0 cm: ${h.soil_temperature_0cm[0]}°C`,
        `   6 cm: ${h.soil_temperature_6cm[0]}°C`,
        `  18 cm: ${h.soil_temperature_18cm[0]}°C`,
        `  54 cm: ${h.soil_temperature_54cm[0]}°C`,
        '',
        'Soil Moisture (m³/m³):',
        `  0–1 cm:   ${h.soil_moisture_0_to_1cm[0]}`,
        `  1–3 cm:   ${h.soil_moisture_1_to_3cm[0]}`,
        `  3–9 cm:   ${h.soil_moisture_3_to_9cm[0]}`,
        `  9–27 cm:  ${h.soil_moisture_9_to_27cm[0]}`,
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_marine_weather: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('🌊 Fetching marine data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        w = await safeJson(
          `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period&hourly=wave_height,wave_direction,swell_wave_height&timezone=${tz}&forecast_days=3`,
        ),
        c = w.current ?? {},
        rows = (w.hourly?.time ?? [])
          .slice(0, 24)
          .map(
            (t, i) =>
              `  ${t.replace('T', ' ')}  🌊 Wave:${w.hourly.wave_height[i]}m  🌀 Swell:${w.hourly.swell_wave_height[i]}m  Dir:${windDir(w.hourly.wave_direction[i])}`,
          )
          .join('\n');
      return [
        `📍 ${name}, ${country} — Marine Weather`,
        '',
        'Current Conditions:',
        `  🌊 Wave Height:      ${c.wave_height ?? 'N/A'} m`,
        `  🔄 Wave Direction:   ${null != c.wave_direction ? windDir(c.wave_direction) : 'N/A'}`,
        `  ⏱️  Wave Period:      ${c.wave_period ?? 'N/A'} s`,
        `  💨 Wind Wave Height: ${c.wind_wave_height ?? 'N/A'} m`,
        `  🌀 Swell Height:     ${c.swell_wave_height ?? 'N/A'} m`,
        `  🔄 Swell Direction:  ${null != c.swell_wave_direction ? windDir(c.swell_wave_direction) : 'N/A'}`,
        `  ⏱️  Swell Period:     ${c.swell_wave_period ?? 'N/A'} s`,
        '',
        '24h Hourly Wave Forecast:',
        rows,
        '',
        'Source: Open-Meteo Marine API (open-meteo.com)',
      ].join('\n');
    },
    get_flood_forecast: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
      } = await resolveLocation(location);
      onStage('🌊 Fetching flood/river data…');
      const d = (
        await safeJson(
          `https://flood-api.open-meteo.com/v1/flood?latitude=${latitude}&longitude=${longitude}&daily=river_discharge,river_discharge_mean,river_discharge_max&forecast_days=16`,
        )
      ).daily;
      return [
        `📍 ${name}, ${country} — Flood / River Discharge Forecast (16 days)`,
        (d?.time ?? [])
          .map(
            (date, i) =>
              `  ${date}  River Discharge: ${d.river_discharge[i]} m³/s  (avg: ${d.river_discharge_mean[i]}, max: ${d.river_discharge_max[i]})`,
          )
          .join('\n') || '  No river discharge data available for this location.',
        '',
        'Source: Open-Meteo Flood API / GloFAS (open-meteo.com)',
      ].join('\n');
    },
    get_climate_normals: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
      } = await resolveLocation(location);
      onStage('🌐 Fetching climate normals…');
      const m = (
          await safeJson(
            `https://climate-api.open-meteo.com/v1/climate?latitude=${latitude}&longitude=${longitude}&start_date=1991-01-01&end_date=2020-12-31&monthly=temperature_2m_mean,precipitation_sum,wind_speed_10m_mean&models=EC_Earth3P_HR`,
          )
        ).monthly,
        MONTHS = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
      return [
        `📍 ${name}, ${country} — Climate Normals (1991–2020)`,
        (m?.time ?? [])
          .slice(0, 12)
          .map(
            (t, i) =>
              `  ${MONTHS[new Date(t).getMonth()]}  Avg Temp: ${m.temperature_2m_mean[i]}°C  Precip: ${m.precipitation_sum[i]}mm  Wind: ${m.wind_speed_10m_mean[i]}km/h`,
          )
          .join('\n'),
        '',
        'Source: Open-Meteo Climate API (open-meteo.com)',
      ].join('\n');
    },
    get_ensemble_forecast: async (params, onStage) => {
      const { location: location, units: units = 'celsius' } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('🎲 Fetching ensemble forecast…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        D = deg(units),
        d = (
          await safeJson(
            `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=${units}&timezone=${tz}&forecast_days=7&models=icon_seamless`,
          )
        ).daily,
        rows = (d?.time ?? [])
          .map((date, i) => {
            const maxVals = Object.keys(d)
                .filter((k) => k.startsWith('temperature_2m_max'))
                .map((k) => d[k][i])
                .filter((v) => null != v),
              minVals = Object.keys(d)
                .filter((k) => k.startsWith('temperature_2m_min'))
                .map((k) => d[k][i])
                .filter((v) => null != v),
              avgMax = maxVals.length
                ? (maxVals.reduce((a, b) => a + b, 0) / maxVals.length).toFixed(1)
                : 'N/A',
              avgMin = minVals.length
                ? (minVals.reduce((a, b) => a + b, 0) / minVals.length).toFixed(1)
                : 'N/A',
              spreadMax = maxVals.length
                ? (Math.max(...maxVals) - Math.min(...maxVals)).toFixed(1)
                : 'N/A';
            return `  ${date}  Avg Hi: ${avgMax}${D}  Avg Lo: ${avgMin}${D}  Uncertainty: ±${spreadMax}${D}`;
          })
          .join('\n');
      return [
        `📍 ${name}, ${country} — Ensemble Forecast (ICON, ${Object.keys(d ?? {}).filter((k) => k.startsWith('temperature_2m_max')).length} members)`,
        'Higher uncertainty = less predictable weather.',
        rows,
        '',
        'Source: Open-Meteo Ensemble API (open-meteo.com)',
      ].join('\n');
    },
    get_dew_point_forecast: async (params, onStage) => {
      const { location: location, units: units = 'celsius' } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('💧 Fetching dew point data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        D = deg(units),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=dew_point_2m,relative_humidity_2m,temperature_2m&temperature_unit=${units}&timezone=${tz}&forecast_days=2`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Dew Point Forecast (24 h)`,
        '  Time              Temp       Dew Point  Humidity',
        h.time
          .slice(0, 24)
          .map(
            (t, i) =>
              `  ${t.replace('T', ' ')}  Temp:${h.temperature_2m[i]}${D}  Dew:${h.dew_point_2m[i]}${D}  RH:${h.relative_humidity_2m[i]}%`,
          )
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_snowfall_forecast: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('❄️ Fetching snowfall data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=snowfall,snow_depth,weather_code&timezone=${tz}&forecast_days=2`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Snowfall Forecast`,
        h.time
          .slice(0, 48)
          .filter((_, i) => h.snowfall[i] > 0 || h.snow_depth[i] > 0)
          .map(
            (t, i) =>
              `  ${t.replace('T', ' ')}  ❄️ Falling: ${h.snowfall[i]} cm  📏 Depth on ground: ${h.snow_depth[i]} m`,
          )
          .join('\n') || '  No snowfall expected in the next 48 hours.',
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_pressure_forecast: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('⚙️ Fetching pressure data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=surface_pressure,pressure_msl&timezone=${tz}&forecast_days=2`,
          )
        ).hourly,
        rows = h.time
          .slice(0, 24)
          .map(
            (t, i) =>
              `  ${t.replace('T', ' ')}  Surface: ${h.surface_pressure[i]} hPa  Sea-Level: ${h.pressure_msl[i]} hPa`,
          )
          .join('\n'),
        first12avg = h.pressure_msl.slice(0, 12).reduce((a, b) => a + b, 0) / 12,
        next12avg = h.pressure_msl.slice(12, 24).reduce((a, b) => a + b, 0) / 12;
      return [
        `📍 ${name}, ${country} — Pressure Forecast (24 h)`,
        'Trend: ' +
          (next12avg > first12avg + 1
            ? '📈 Rising (improving weather likely)'
            : next12avg < first12avg - 1
              ? '📉 Falling (deteriorating weather likely)'
              : '➡️ Steady'),
        rows,
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_visibility_forecast: async (params, onStage) => {
      const { location: location } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('👁️ Fetching visibility data…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=visibility,weather_code&timezone=${tz}&forecast_days=2`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Visibility Forecast (48 h)`,
        h.time
          .slice(0, 48)
          .map((t, i) => {
            const vis = h.visibility[i],
              label =
                vis < 200
                  ? '🌫️ Dense Fog'
                  : vis < 1e3
                    ? '🌁 Fog'
                    : vis < 4e3
                      ? '🌫️ Mist'
                      : vis < 1e4
                        ? '🌥️ Poor'
                        : '✅ Clear';
            return `  ${t.replace('T', ' ')}  ${null != vis ? (vis / 1e3).toFixed(1) + ' km' : 'N/A'}  ${label}`;
          })
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_feels_like_forecast: async (params, onStage) => {
      const { location: location, units: units = 'celsius' } = params;
      onStage(`🌍 Locating ${location}…`);
      const {
        latitude: latitude,
        longitude: longitude,
        name: name,
        country: country,
        timezone: timezone,
      } = await resolveLocation(location);
      onStage('🌡️ Fetching apparent temperature…');
      const tz = encodeURIComponent(timezone ?? 'auto'),
        D = deg(units),
        h = (
          await safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=apparent_temperature,temperature_2m,wind_speed_10m,relative_humidity_2m&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${tz}&forecast_days=2`,
          )
        ).hourly;
      return [
        `📍 ${name}, ${country} — Feels-Like Temperature Forecast (48 h)`,
        '  Time              Actual     Feels Like  Wind       Humidity',
        h.time
          .slice(0, 48)
          .map(
            (t, i) =>
              `  ${t.replace('T', ' ')}  Actual:${h.temperature_2m[i]}${D}  Feels:${h.apparent_temperature[i]}${D}  💨${h.wind_speed_10m[i]}km/h  💧${h.relative_humidity_2m[i]}%`,
          )
          .join('\n'),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
    get_weather_comparison: async (params, onStage) => {
      const { location_a: location_a, location_b: location_b, units: units = 'celsius' } = params;
      if (!location_a || !location_b)
        throw new Error('Both location_a and location_b are required');
      onStage('🌍 Locating both cities…');
      const [geoA, geoB] = await Promise.all([
        resolveLocation(location_a),
        resolveLocation(location_b),
      ]);
      onStage('🌡️ Fetching weather for both…');
      const D = deg(units),
        fetchWeather = ({ latitude: latitude, longitude: longitude, timezone: timezone }) =>
          safeJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,cloud_cover,surface_pressure&temperature_unit=${units}&wind_speed_unit=kmh&timezone=${encodeURIComponent(timezone ?? 'auto')}`,
          ),
        [wA, wB] = await Promise.all([fetchWeather(geoA), fetchWeather(geoB)]),
        cA = wA.current,
        cB = wB.current,
        row = (label, va, vb) => `  ${label.padEnd(24)} ${String(va).padEnd(18)} ${vb}`;
      return [
        '🌍 Weather Comparison',
        '',
        row('', `${geoA.name}, ${geoA.country}`, `${geoB.name}, ${geoB.country}`),
        row('─'.repeat(22), '─'.repeat(16), '─'.repeat(16)),
        row('Condition', WMO_CODES[cA.weather_code] ?? '?', WMO_CODES[cB.weather_code] ?? '?'),
        row('Temperature', `${cA.temperature_2m}${D}`, `${cB.temperature_2m}${D}`),
        row('Feels Like', `${cA.apparent_temperature}${D}`, `${cB.apparent_temperature}${D}`),
        row('Humidity', `${cA.relative_humidity_2m}%`, `${cB.relative_humidity_2m}%`),
        row('Wind', `${cA.wind_speed_10m} km/h`, `${cB.wind_speed_10m} km/h`),
        row('Cloud Cover', `${cA.cloud_cover}%`, `${cB.cloud_cover}%`),
        row('Precipitation', `${cA.precipitation} mm`, `${cB.precipitation} mm`),
        row('Pressure', `${cA.surface_pressure} hPa`, `${cB.surface_pressure} hPa`),
        '',
        'Source: Open-Meteo (open-meteo.com)',
      ].join('\n');
    },
  },
});
