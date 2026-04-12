export const GEO_TOOLS = [
  {
    name: 'get_ip_info',
    description:
      "Look up geolocation and network info for any IP address — country, city, region, ISP, timezone, and coordinates. Omit the IP to look up the user's own location.",
    category: 'ipgeo',
    parameters: {
      ip: {
        type: 'string',
        required: !1,
        description:
          'IP address to look up (e.g. "8.8.8.8"). Omit to use the user\'s own public IP.',
      },
    },
  },
  {
    name: 'reverse_geocode',
    description:
      'Convert latitude/longitude coordinates into a human-readable address using OpenStreetMap Nominatim.',
    category: 'geocoding',
    parameters: {
      lat: { type: 'number', required: !0, description: 'Latitude (e.g. 48.8584).' },
      lon: { type: 'number', required: !0, description: 'Longitude (e.g. 2.2945).' },
    },
  },
  {
    name: 'forward_geocode',
    description:
      'Convert a place name or address into latitude/longitude coordinates and a bounding box using OpenStreetMap Nominatim.',
    category: 'geocoding',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Address or place name to geocode (e.g. "Eiffel Tower, Paris").',
      },
      limit: {
        type: 'number',
        required: !1,
        description: 'Maximum number of results to return (1–10, default 3).',
      },
    },
  },
  {
    name: 'search_places',
    description:
      'Full-text search for places, landmarks, streets, or businesses via OpenStreetMap Nominatim. Returns name, type, coordinates, and importance score.',
    category: 'geocoding',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Search term (e.g. "coffee shops Berlin").',
      },
      country_code: {
        type: 'string',
        required: !1,
        description: 'Restrict results to a country ISO-3166 code (e.g. "de").',
      },
      limit: { type: 'number', required: !1, description: 'Number of results (1-20, default 5).' },
    },
  },
  {
    name: 'get_elevation',
    description:
      'Get the terrain elevation in metres above sea level for one or more latitude/longitude points using the Open-Elevation API.',
    category: 'terrain',
    parameters: {
      locations: {
        type: 'array',
        required: !0,
        description: 'Array of { lat, lon } objects (up to 100 points).',
      },
    },
  },
  {
    name: 'get_timezone_by_coords',
    description:
      'Get the IANA timezone identifier and current local time for a latitude/longitude pair using WorldTimeAPI.',
    category: 'timezone',
    parameters: {
      lat: { type: 'number', required: !0, description: 'Latitude.' },
      lon: { type: 'number', required: !0, description: 'Longitude.' },
    },
  },
  {
    name: 'get_country_info',
    description:
      'Detailed information about a country: official name, capital, population, area, currencies, languages, calling codes, timezones, and flag. Uses RestCountries API.',
    category: 'country',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Country name, ISO 2-letter code (e.g. "DE"), or ISO 3-letter code (e.g. "DEU").',
      },
    },
  },
  {
    name: 'get_country_neighbors',
    description:
      'List all countries that share a land border with a given country, including their names and ISO codes.',
    category: 'country',
    parameters: {
      query: { type: 'string', required: !0, description: 'Country name or ISO 2/3 letter code.' },
    },
  },
  {
    name: 'get_postal_code_info',
    description:
      'Resolve a postal/ZIP code to its city, state, and country using the free Zippopotam.us API.',
    category: 'postal',
    parameters: {
      country_code: {
        type: 'string',
        required: !0,
        description: 'ISO 2-letter country code (e.g. "US", "GB", "DE").',
      },
      postal_code: {
        type: 'string',
        required: !0,
        description: 'Postal or ZIP code (e.g. "90210").',
      },
    },
  },
  {
    name: 'get_nearby_places',
    description:
      'Find points of interest (amenities, shops, tourism spots) near a coordinate using the free OpenStreetMap Overpass API.',
    category: 'poi',
    parameters: {
      lat: { type: 'number', required: !0, description: 'Latitude of the search centre.' },
      lon: { type: 'number', required: !0, description: 'Longitude of the search centre.' },
      radius: {
        type: 'number',
        required: !1,
        description: 'Search radius in metres (default 500, max 5000).',
      },
      category: {
        type: 'string',
        required: !1,
        description:
          'OSM amenity/tourism/shop tag (e.g. "restaurant", "museum", "pharmacy", "hotel"). Omit for all types.',
      },
      limit: { type: 'number', required: !1, description: 'Maximum results (default 10, max 30).' },
    },
  },
  {
    name: 'get_distance',
    description:
      'Calculate the great-circle (Haversine) distance and bearing between two geographic points. Returns distance in km, miles, and nautical miles.',
    category: 'math',
    parameters: {
      lat1: { type: 'number', required: !0, description: 'Latitude of point A.' },
      lon1: { type: 'number', required: !0, description: 'Longitude of point A.' },
      lat2: { type: 'number', required: !0, description: 'Latitude of point B.' },
      lon2: { type: 'number', required: !0, description: 'Longitude of point B.' },
    },
  },
  {
    name: 'get_midpoint',
    description:
      'Calculate the geographic midpoint (centre point) between two lat/lon coordinates.',
    category: 'math',
    parameters: {
      lat1: { type: 'number', required: !0, description: 'Latitude of point A.' },
      lon1: { type: 'number', required: !0, description: 'Longitude of point A.' },
      lat2: { type: 'number', required: !0, description: 'Latitude of point B.' },
      lon2: { type: 'number', required: !0, description: 'Longitude of point B.' },
    },
  },
  {
    name: 'check_point_in_radius',
    description:
      'Check whether a given point falls within a specified radius of a centre point. Useful for geofencing.',
    category: 'math',
    parameters: {
      centre_lat: { type: 'number', required: !0, description: 'Latitude of the centre.' },
      centre_lon: { type: 'number', required: !0, description: 'Longitude of the centre.' },
      point_lat: { type: 'number', required: !0, description: 'Latitude of the point to test.' },
      point_lon: { type: 'number', required: !0, description: 'Longitude of the point to test.' },
      radius_km: { type: 'number', required: !0, description: 'Radius in kilometres.' },
    },
  },
  {
    name: 'convert_dms_to_dd',
    description:
      'Convert coordinates from Degrees-Minutes-Seconds (DMS) format to Decimal Degrees (DD).',
    category: 'conversion',
    parameters: {
      degrees: { type: 'number', required: !0, description: 'Degrees component.' },
      minutes: { type: 'number', required: !0, description: 'Minutes component.' },
      seconds: { type: 'number', required: !0, description: 'Seconds component.' },
      direction: {
        type: 'string',
        required: !0,
        description: 'Hemisphere: "N", "S", "E", or "W".',
      },
    },
  },
  {
    name: 'convert_dd_to_dms',
    description:
      'Convert a decimal-degree coordinate value to Degrees-Minutes-Seconds (DMS) with compass direction.',
    category: 'conversion',
    parameters: {
      decimal: {
        type: 'number',
        required: !0,
        description: 'Decimal degree value (positive or negative).',
      },
      axis: {
        type: 'string',
        required: !0,
        description: '"lat" for latitude (N/S) or "lon" for longitude (E/W).',
      },
    },
  },
  {
    name: 'encode_geohash',
    description: 'Encode a latitude/longitude pair into a Geohash string at a specified precision.',
    category: 'geohash',
    parameters: {
      lat: { type: 'number', required: !0, description: 'Latitude.' },
      lon: { type: 'number', required: !0, description: 'Longitude.' },
      precision: {
        type: 'number',
        required: !1,
        description: 'Hash length 1–12 (default 9). Higher = more precise.',
      },
    },
  },
  {
    name: 'decode_geohash',
    description:
      'Decode a Geohash string back into a latitude/longitude pair with its error margin bounding box.',
    category: 'geohash',
    parameters: {
      hash: {
        type: 'string',
        required: !0,
        description: 'Geohash string to decode (e.g. "u4pruydqqvj").',
      },
    },
  },
  {
    name: 'get_map_url',
    description:
      'Generate shareable map URLs for OpenStreetMap, Google Maps, and Apple Maps for any coordinates or place name.',
    category: 'maps',
    parameters: {
      lat: { type: 'number', required: !1, description: 'Latitude (use with lon).' },
      lon: { type: 'number', required: !1, description: 'Longitude (use with lat).' },
      query: {
        type: 'string',
        required: !1,
        description: 'Place name or address (alternative to lat/lon).',
      },
      zoom: { type: 'number', required: !1, description: 'Map zoom level 1-19 (default 14).' },
    },
  },
];
