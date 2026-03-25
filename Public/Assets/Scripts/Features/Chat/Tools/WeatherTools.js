export const WEATHER_TOOLS = [
    {
        name: 'get_weather',
        description: 'Get current weather and conditions for any city or location using Open-Meteo. Returns temperature, humidity, wind speed, and weather description.',
        category: 'open_meteo',
        parameters: {
            location: { type: 'string', required: true, description: 'City name or location (e.g. "Chennai", "New York", "Tokyo")' },
            units: { type: 'string', required: false, description: 'Temperature units: "celsius" (default) or "fahrenheit"' },
        },
    },
];