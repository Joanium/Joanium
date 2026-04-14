export const CLOUDFLARE_TOOLS = [
  // ─── Existing ──────────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_zones',
    description:
      "List all of the user's Cloudflare domains (zones) with their status, plan, and name servers.",
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {},
  },

  // ─── Account & Token ───────────────────────────────────────────────────────
  {
    name: 'cloudflare_verify_token',
    description: 'Verify that the connected Cloudflare API token is valid and show its status.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {},
  },
  {
    name: 'cloudflare_get_user',
    description:
      'Get the Cloudflare account details for the authenticated user, including email and 2FA status.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {},
  },
  {
    name: 'cloudflare_list_accounts',
    description: 'List all Cloudflare accounts accessible with the current token.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {},
  },

  // ─── Zone Management ───────────────────────────────────────────────────────
  {
    name: 'cloudflare_get_zone',
    description: 'Get detailed information about a specific Cloudflare zone by its zone ID.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_get_zone_settings',
    description:
      'Retrieve all configuration settings for a Cloudflare zone (SSL, caching, minification, etc.).',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_update_zone_setting',
    description:
      'Update a single setting for a Cloudflare zone, such as enabling Always-On HTTPS or Browser Cache TTL.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      settingId: {
        type: 'string',
        description: 'The setting identifier, e.g. "always_use_https", "browser_cache_ttl".',
      },
      value: { description: 'The new value for the setting.' },
    },
  },
  {
    name: 'cloudflare_get_zone_analytics',
    description:
      'Get traffic analytics for a zone: total requests, bandwidth, threats, and unique visitors over the last 24 hours (or a custom window).',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      since: {
        type: 'string',
        description: 'ISO 8601 start time (optional, defaults to 24 h ago).',
      },
      until: { type: 'string', description: 'ISO 8601 end time (optional, defaults to now).' },
    },
  },

  // ─── DNS Records ───────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_dns_records',
    description:
      'List all DNS records for a Cloudflare zone, including type, name, content, proxy status, and TTL.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_get_dns_record',
    description: 'Fetch a single DNS record by its ID within a zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      recordId: { type: 'string', description: 'The DNS record ID.' },
    },
  },
  {
    name: 'cloudflare_create_dns_record',
    description: 'Create a new DNS record in a Cloudflare zone (A, AAAA, CNAME, MX, TXT, etc.).',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      type: {
        type: 'string',
        description: 'DNS record type: A, AAAA, CNAME, MX, TXT, SRV, NS, CAA, etc.',
      },
      name: {
        type: 'string',
        description: 'DNS record name, e.g. "example.com" or "sub.example.com".',
      },
      content: {
        type: 'string',
        description: 'DNS record value, e.g. an IP address or target hostname.',
      },
      ttl: { type: 'number', description: 'TTL in seconds. Use 1 for automatic.' },
      proxied: {
        type: 'boolean',
        description: 'Whether to proxy traffic through Cloudflare (orange-cloud).',
      },
      priority: { type: 'number', description: 'Priority for MX and SRV records.' },
    },
  },
  {
    name: 'cloudflare_update_dns_record',
    description:
      'Update an existing DNS record in a Cloudflare zone. Only the fields provided will be changed.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      recordId: { type: 'string', description: 'The DNS record ID to update.' },
      type: { type: 'string', description: 'New DNS record type (optional).' },
      name: { type: 'string', description: 'New name (optional).' },
      content: { type: 'string', description: 'New content/value (optional).' },
      ttl: { type: 'number', description: 'New TTL in seconds (optional).' },
      proxied: { type: 'boolean', description: 'New proxy status (optional).' },
    },
  },
  {
    name: 'cloudflare_delete_dns_record',
    description: 'Permanently delete a DNS record from a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      recordId: { type: 'string', description: 'The DNS record ID to delete.' },
    },
  },
  {
    name: 'cloudflare_export_dns_records',
    description: 'Export all DNS records for a zone as a BIND-formatted zone file (plain text).',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },

  // ─── Cache ─────────────────────────────────────────────────────────────────
  {
    name: 'cloudflare_purge_cache',
    description:
      'Purge cached content for a zone. Can purge everything, specific URLs, cache tags, or hostnames.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      purgeEverything: {
        type: 'boolean',
        description: 'If true, purges all cached content for the zone.',
      },
      files: { type: 'array', description: 'List of specific URLs to purge.' },
      tags: { type: 'array', description: 'List of cache tags to purge (Enterprise only).' },
      hosts: { type: 'array', description: 'List of hostnames to purge.' },
    },
  },
  {
    name: 'cloudflare_get_caching_level',
    description:
      'Get the current caching level setting for a zone (aggressive, basic, or simplified).',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_update_caching_level',
    description:
      'Set the caching level for a zone. Options: "aggressive" (caches based on query strings), "basic" (ignores query strings), or "simplified".',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      value: { type: 'string', description: '"aggressive", "basic", or "simplified".' },
    },
  },

  // ─── Firewall Rules ────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_firewall_rules',
    description:
      'List all firewall rules configured for a Cloudflare zone, showing their expression, action, and priority.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_create_firewall_rule',
    description:
      'Create a new firewall rule for a zone using a Wireshark-style filter expression and an action.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      expression: {
        type: 'string',
        description: 'Firewall filter expression, e.g. "(ip.src eq 1.2.3.4)".',
      },
      action: {
        type: 'string',
        description:
          'Action: "block", "challenge", "js_challenge", "managed_challenge", "allow", "log", or "bypass".',
      },
      description: { type: 'string', description: 'Human-readable description of the rule.' },
      priority: { type: 'number', description: 'Rule priority (optional).' },
    },
  },
  {
    name: 'cloudflare_delete_firewall_rule',
    description: 'Delete a firewall rule from a Cloudflare zone by its rule ID.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      ruleId: { type: 'string', description: 'The firewall rule ID to delete.' },
    },
  },

  // ─── IP Access Rules ───────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_ip_access_rules',
    description:
      'List all IP access rules (block, challenge, or whitelist) configured for a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_create_ip_access_rule',
    description:
      'Create an IP access rule to block, challenge, or whitelist an IP address, IP range, ASN, or country.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      mode: {
        type: 'string',
        description: '"block", "challenge", "whitelist", or "js_challenge".',
      },
      target: { type: 'string', description: '"ip", "ip_range", "asn", or "country".' },
      value: {
        type: 'string',
        description:
          'The IP address, CIDR range (e.g. "192.0.2.0/24"), ASN (e.g. "AS12345"), or two-letter country code.',
      },
      notes: { type: 'string', description: 'Optional note describing why this rule exists.' },
    },
  },
  {
    name: 'cloudflare_delete_ip_access_rule',
    description: 'Delete an IP access rule from a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      ruleId: { type: 'string', description: 'The IP access rule ID to delete.' },
    },
  },

  // ─── Page Rules ────────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_page_rules',
    description:
      'List all active page rules for a Cloudflare zone, including their URL patterns and configured actions.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_create_page_rule',
    description:
      'Create a page rule that applies specific Cloudflare settings or redirects to URLs matching a pattern.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      url: { type: 'string', description: 'URL pattern with wildcards, e.g. "example.com/api/*".' },
      actions: {
        type: 'array',
        description:
          'Array of action objects, each with an "id" and "value". E.g. [{"id":"cache_level","value":"bypass"}].',
      },
      priority: {
        type: 'number',
        description: 'Rule priority — lower numbers run first (optional, default 1).',
      },
      status: {
        type: 'string',
        description: '"active" or "disabled" (optional, default "active").',
      },
    },
  },
  {
    name: 'cloudflare_delete_page_rule',
    description: 'Delete a page rule from a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      ruleId: { type: 'string', description: 'The page rule ID to delete.' },
    },
  },

  // ─── SSL / TLS ─────────────────────────────────────────────────────────────
  {
    name: 'cloudflare_get_ssl_setting',
    description:
      'Get the current SSL/TLS encryption mode for a zone: off, flexible, full, or strict.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_update_ssl_setting',
    description: 'Change the SSL/TLS encryption mode for a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      value: { type: 'string', description: 'SSL mode: "off", "flexible", "full", or "strict".' },
    },
  },
  {
    name: 'cloudflare_list_certificates',
    description:
      'List all SSL certificate packs configured for a Cloudflare zone, including their type and status.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },

  // ─── Workers ───────────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_workers',
    description: "List all Cloudflare Workers scripts in the user's account.",
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: {
        type: 'string',
        description: 'The Cloudflare account ID. Use cloudflare_list_accounts to find it.',
      },
    },
  },
  {
    name: 'cloudflare_list_worker_routes',
    description:
      'List all Worker routes configured for a zone, showing which URL patterns trigger which Worker scripts.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
];
