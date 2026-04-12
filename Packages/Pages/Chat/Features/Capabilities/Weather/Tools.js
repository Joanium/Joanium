export const WEATHER_TOOLS = [
  {
    name: 'get_weather',
    description:
      'Get current weather and conditions for any city or location using Open-Meteo. Returns temperature, humidity, wind speed, and weather description.',
    category: 'open_meteo',
    parameters: {
      location: {
        type: 'string',
        required: !0,
        description: 'City name or location (e.g. "Chennai", "New York", "Tokyo")',
      },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
    },
  },
  {
    name: 'get_hourly_forecast',
    description:
      'Get a detailed hour-by-hour weather forecast for the next 48 hours for any location. Includes temperature, precipitation probability, wind speed, and weather code per hour.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
      hours: {
        type: 'number',
        required: !1,
        description: 'Number of hours to show (default 24, max 48)',
      },
    },
  },
  {
    name: 'get_weekly_forecast',
    description:
      'Get a 7-day daily weather forecast for any location. Includes high/low temperatures, precipitation sum, UV index max, and dominant weather condition per day.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
    },
  },
  {
    name: 'get_air_quality',
    description:
      'Get current air quality index (AQI) and pollutant concentrations (PM2.5, PM10, NO2, CO, ozone) for any location using the Open-Meteo Air Quality API.',
    category: 'open_meteo_air_quality',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_uv_index',
    description:
      "Get today's UV index forecast (hourly) for any location. Includes UV index values throughout the day and a safety recommendation.",
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_wind_forecast',
    description:
      'Get detailed wind forecast for the next 48 hours, including wind speed, gusts, and direction at 10 m and 80 m height.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_precipitation_forecast',
    description:
      'Get hourly precipitation (rain, showers, snowfall) and probability forecast for the next 48 hours.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_historical_weather',
    description:
      'Retrieve historical daily weather data (temperature, precipitation, wind) for any location and date range using the Open-Meteo Archive API.',
    category: 'open_meteo_archive',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
      start_date: { type: 'string', required: !0, description: 'Start date in YYYY-MM-DD format' },
      end_date: { type: 'string', required: !0, description: 'End date in YYYY-MM-DD format' },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
    },
  },
  {
    name: 'get_sunrise_sunset',
    description:
      'Get sunrise, sunset, and day length for any location for the next 7 days. Also returns civil/nautical/astronomical twilight times.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_solar_radiation',
    description:
      'Get hourly solar radiation (shortwave, direct normal, diffuse) and sunshine duration forecast for any location — useful for solar energy planning.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_soil_data',
    description:
      'Get soil temperature and moisture at multiple depths (0 cm, 6 cm, 18 cm, 54 cm) for any location — useful for agriculture and gardening.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_marine_weather',
    description:
      'Get marine/ocean weather for any coastal location: wave height, wave direction, wave period, wind waves, and swell data using the Open-Meteo Marine API.',
    category: 'open_meteo_marine',
    parameters: {
      location: { type: 'string', required: !0, description: 'Coastal city or location name' },
    },
  },
  {
    name: 'get_flood_forecast',
    description:
      'Get river discharge and flood probability forecast for the next 16 days for any location using the Open-Meteo Flood API (GloFAS data).',
    category: 'open_meteo_flood',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_climate_normals',
    description:
      'Get long-term monthly climate averages (temperature, precipitation, wind) for any location based on 30-year climate model data from the Open-Meteo Climate API.',
    category: 'open_meteo_climate',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_ensemble_forecast',
    description:
      'Get an ensemble weather forecast (multiple model members) to understand forecast uncertainty for temperature and precipitation over the next 7 days.',
    category: 'open_meteo_ensemble',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
    },
  },
  {
    name: 'get_dew_point_forecast',
    description:
      'Get hourly dew point temperature and relative humidity forecast for the next 48 hours. Useful for comfort assessment and condensation risk.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
    },
  },
  {
    name: 'get_snowfall_forecast',
    description:
      'Get hourly snowfall depth and snow depth on the ground forecast for the next 48 hours for any location.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_pressure_forecast',
    description:
      'Get hourly surface pressure and sea-level pressure forecast for the next 48 hours. Useful for tracking weather systems and storm development.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_visibility_forecast',
    description:
      'Get hourly visibility (in metres) and fog probability for the next 48 hours for any location.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
    },
  },
  {
    name: 'get_feels_like_forecast',
    description:
      'Get hourly "feels like" (apparent temperature) forecast for the next 48 hours, factoring in wind chill and humidity.',
    category: 'open_meteo',
    parameters: {
      location: { type: 'string', required: !0, description: 'City name or location' },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
    },
  },
  {
    name: 'get_weather_comparison',
    description:
      'Compare current weather conditions side-by-side between two different cities or locations.',
    category: 'open_meteo',
    parameters: {
      location_a: { type: 'string', required: !0, description: 'First city name or location' },
      location_b: { type: 'string', required: !0, description: 'Second city name or location' },
      units: {
        type: 'string',
        required: !1,
        description: 'Temperature units: "celsius" (default) or "fahrenheit"',
      },
    },
  },
];
