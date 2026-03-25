export const GEO_TOOLS = [
    {
        name: 'get_ip_info',
        description: 'Look up geolocation and network info for any IP address — country, city, region, ISP, timezone, and coordinates. Omit the IP to look up the user\'s own location.',
        category: 'ipgeo',
        parameters: {
            ip: { type: 'string', required: false, description: 'IP address to look up (e.g. "8.8.8.8"). Omit to use the user\'s own public IP.' },
        },
    },
];
