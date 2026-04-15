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

  // ─── NEW: Zone Pause / Unpause ─────────────────────────────────────────────
  {
    name: 'cloudflare_pause_zone',
    description:
      'Pause Cloudflare on a zone, routing traffic directly to the origin server and disabling all Cloudflare features (CDN, WAF, etc.). Use with caution.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID to pause.' },
    },
  },
  {
    name: 'cloudflare_unpause_zone',
    description:
      'Re-enable Cloudflare on a previously paused zone, restoring CDN, WAF, and all Cloudflare features.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID to unpause.' },
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

  // ─── NEW: Worker Routes ────────────────────────────────────────────────────
  {
    name: 'cloudflare_create_worker_route',
    description:
      'Create a new Worker route that maps a URL pattern to a specific Worker script for a zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      pattern: {
        type: 'string',
        description: 'URL pattern with optional wildcards, e.g. "example.com/api/*".',
      },
      script: {
        type: 'string',
        description:
          'Name of the Worker script to invoke. Leave empty to disable Workers on this route.',
      },
    },
  },
  {
    name: 'cloudflare_delete_worker_route',
    description: 'Delete an existing Worker route from a zone by its route ID.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      routeId: { type: 'string', description: 'The Worker route ID to delete.' },
    },
  },

  // ─── NEW: Rate Limiting ────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_rate_limits',
    description:
      'List all rate limiting rules configured for a zone, showing their thresholds, periods, and actions.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_create_rate_limit',
    description:
      'Create a rate limiting rule that blocks or challenges clients exceeding a request threshold within a time period.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      threshold: {
        type: 'number',
        description: 'Number of requests allowed before the rule triggers.',
      },
      period: {
        type: 'number',
        description: 'Time window in seconds (1–86400) in which the threshold is counted.',
      },
      action: {
        type: 'string',
        description:
          'Action when limit is exceeded: "block", "challenge", "js_challenge", or "simulate".',
      },
      urlPattern: {
        type: 'string',
        description: 'URL pattern to match, e.g. "example.com/login*". Supports wildcards.',
      },
      description: { type: 'string', description: 'Optional description of the rule.' },
      disabled: {
        type: 'boolean',
        description: 'Set to true to create the rule in a disabled state.',
      },
    },
  },
  {
    name: 'cloudflare_delete_rate_limit',
    description: 'Delete a rate limiting rule from a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      rateLimitId: { type: 'string', description: 'The rate limit rule ID to delete.' },
    },
  },

  // ─── NEW: KV Storage ───────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_kv_namespaces',
    description: 'List all Workers KV namespaces in a Cloudflare account.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
    },
  },
  {
    name: 'cloudflare_create_kv_namespace',
    description: 'Create a new Workers KV namespace in a Cloudflare account.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      title: { type: 'string', description: 'A human-readable name for the KV namespace.' },
    },
  },
  {
    name: 'cloudflare_delete_kv_namespace',
    description: 'Delete a Workers KV namespace and all its keys from a Cloudflare account.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      namespaceId: { type: 'string', description: 'The KV namespace ID to delete.' },
    },
  },
  {
    name: 'cloudflare_list_kv_keys',
    description: 'List keys stored in a Workers KV namespace, with optional prefix filtering.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      namespaceId: { type: 'string', description: 'The KV namespace ID.' },
      prefix: { type: 'string', description: 'Optional key prefix to filter results.' },
      limit: {
        type: 'number',
        description: 'Maximum number of keys to return (default 100, max 1000).',
      },
    },
  },
  {
    name: 'cloudflare_get_kv_value',
    description: 'Read the value of a specific key from a Workers KV namespace.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      namespaceId: { type: 'string', description: 'The KV namespace ID.' },
      key: { type: 'string', description: 'The key whose value to retrieve.' },
    },
  },
  {
    name: 'cloudflare_put_kv_value',
    description: 'Write or overwrite a value for a key in a Workers KV namespace.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      namespaceId: { type: 'string', description: 'The KV namespace ID.' },
      key: { type: 'string', description: 'The key to write.' },
      value: { type: 'string', description: 'The value to store (plain text or serialised JSON).' },
      expiration: {
        type: 'number',
        description: 'Optional absolute Unix timestamp for key expiry.',
      },
      expirationTtl: {
        type: 'number',
        description: 'Optional TTL in seconds from now for key expiry.',
      },
    },
  },
  {
    name: 'cloudflare_delete_kv_value',
    description: 'Delete a specific key-value pair from a Workers KV namespace.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      namespaceId: { type: 'string', description: 'The KV namespace ID.' },
      key: { type: 'string', description: 'The key to delete.' },
    },
  },

  // ─── NEW: R2 Storage ───────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_r2_buckets',
    description: 'List all R2 object storage buckets in a Cloudflare account.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
    },
  },
  {
    name: 'cloudflare_create_r2_bucket',
    description: 'Create a new R2 object storage bucket in a Cloudflare account.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      name: {
        type: 'string',
        description: 'Globally unique bucket name (lowercase, hyphens allowed).',
      },
      locationHint: {
        type: 'string',
        description: 'Optional region hint: "apac", "eeur", "enam", "oc", or "weur".',
      },
    },
  },
  {
    name: 'cloudflare_delete_r2_bucket',
    description:
      'Delete an empty R2 bucket from a Cloudflare account. The bucket must be empty before deletion.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      bucketName: { type: 'string', description: 'The name of the R2 bucket to delete.' },
    },
  },

  // ─── NEW: Load Balancers ───────────────────────────────────────────────────
  {
    name: 'cloudflare_list_load_balancers',
    description: 'List all load balancers configured for a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_list_load_balancer_pools',
    description:
      'List all load balancer origin pools in a Cloudflare account, including health status and origins.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
    },
  },
  {
    name: 'cloudflare_create_load_balancer_pool',
    description:
      'Create a new origin pool for a Cloudflare load balancer with one or more origin servers.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      name: { type: 'string', description: 'A short name for the pool (no spaces).' },
      origins: {
        type: 'array',
        description:
          'Array of origin objects, each with "name", "address", and optionally "enabled" (boolean) and "weight" (number).',
      },
      description: { type: 'string', description: 'Optional description of the pool.' },
      enabled: { type: 'boolean', description: 'Whether the pool is enabled (default true).' },
      minimumOrigins: {
        type: 'number',
        description:
          'Minimum number of healthy origins required to consider the pool healthy (default 1).',
      },
    },
  },

  // ─── NEW: Custom Hostnames ─────────────────────────────────────────────────
  {
    name: 'cloudflare_list_custom_hostnames',
    description: 'List all custom hostnames (SSL for SaaS) configured for a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_create_custom_hostname',
    description:
      'Add a custom hostname (SSL for SaaS) to a Cloudflare zone, provisioning a certificate for it.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      hostname: {
        type: 'string',
        description: 'The custom hostname to add, e.g. "app.customer.com".',
      },
      sslMethod: {
        type: 'string',
        description: 'SSL validation method: "http" (default) or "txt" (DNS TXT record).',
      },
      sslType: {
        type: 'string',
        description: 'Certificate type: "dv" for Domain Validation (default).',
      },
    },
  },
  {
    name: 'cloudflare_delete_custom_hostname',
    description: 'Remove a custom hostname from a Cloudflare zone, revoking its certificate.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      customHostnameId: { type: 'string', description: 'The custom hostname ID to delete.' },
    },
  },

  // ─── NEW: Tunnels ──────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_tunnels',
    description:
      'List all Cloudflare Tunnels (cloudflared) in an account, showing their status and active connections.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
    },
  },
  {
    name: 'cloudflare_get_tunnel',
    description:
      'Get detailed information about a specific Cloudflare Tunnel, including its active connector connections.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      tunnelId: { type: 'string', description: 'The tunnel ID to retrieve.' },
    },
  },

  // ─── NEW: Access ───────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_access_applications',
    description:
      'List all Cloudflare Access applications in an account, showing their domains and session durations.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
    },
  },
  {
    name: 'cloudflare_list_access_policies',
    description:
      'List all policies attached to a specific Cloudflare Access application, showing who is allowed or denied.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      accountId: { type: 'string', description: 'The Cloudflare account ID.' },
      appId: { type: 'string', description: 'The Access application ID.' },
    },
  },

  // ─── NEW: Logpush ──────────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_logpush_jobs',
    description:
      'List all Logpush jobs configured for a zone, showing their dataset, destination, and health status.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },

  // ─── NEW: Health Checks ────────────────────────────────────────────────────
  {
    name: 'cloudflare_list_health_checks',
    description:
      'List all standalone health checks configured for a Cloudflare zone, including their current status and failure reasons.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
    },
  },
  {
    name: 'cloudflare_create_health_check',
    description:
      'Create a standalone health check that monitors an origin server and reports its availability.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      name: { type: 'string', description: 'A short name for this health check.' },
      address: {
        type: 'string',
        description: 'The hostname or IP address of the origin to check.',
      },
      type: {
        type: 'string',
        description: 'Protocol type: "HTTPS" (default), "HTTP", or "TCP".',
      },
      path: {
        type: 'string',
        description: 'HTTP path to request for HTTP/HTTPS checks (default "/").',
      },
      interval: {
        type: 'number',
        description: 'Seconds between health check runs (default 60).',
      },
      retries: {
        type: 'number',
        description: 'Number of retries before marking the origin unhealthy (default 2).',
      },
      timeout: {
        type: 'number',
        description: 'Seconds to wait for a response before timing out (default 5).',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether to enable the check immediately (default true).',
      },
      description: {
        type: 'string',
        description: 'Optional description of what this check monitors.',
      },
    },
  },
  {
    name: 'cloudflare_delete_health_check',
    description: 'Delete a standalone health check from a Cloudflare zone.',
    category: 'cloudflare',
    connectorId: 'cloudflare',
    parameters: {
      zoneId: { type: 'string', description: 'The Cloudflare zone ID.' },
      healthCheckId: { type: 'string', description: 'The health check ID to delete.' },
    },
  },
];
