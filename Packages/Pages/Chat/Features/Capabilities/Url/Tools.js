export const URL_TOOLS = [
  {
    name: 'shorten_url',
    description: 'Shorten a long URL into a compact, shareable link using CleanURI.',
    category: 'cleanuri',
    parameters: {
      url: {
        type: 'string',
        required: true,
        description: 'The full URL to shorten (e.g. "https://example.com/very/long/path")',
      },
    },
  },
  {
    name: 'parse_url',
    description:
      'Break a URL into its components: protocol, hostname, port, pathname, query string, and hash fragment.',
    category: 'parse',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to parse.' },
    },
  },
  {
    name: 'extract_query_params',
    description:
      'Extract and list all query string parameters from a URL as a readable key→value table.',
    category: 'parse',
    parameters: {
      url: {
        type: 'string',
        required: true,
        description: 'The URL whose query params to extract.',
      },
    },
  },
  {
    name: 'build_url',
    description:
      'Build a complete URL from individual parts: base, path segments, and query parameters.',
    category: 'build',
    parameters: {
      base: {
        type: 'string',
        required: true,
        description: 'Base URL, e.g. "https://example.com".',
      },
      path: {
        type: 'string',
        required: false,
        description: 'Path to append, e.g. "/products/shoes".',
      },
      params: {
        type: 'object',
        required: false,
        description: 'Key/value pairs to add as query parameters.',
      },
    },
  },
  {
    name: 'add_utm_params',
    description:
      'Append UTM tracking parameters (source, medium, campaign, term, content) to any URL.',
    category: 'build',
    parameters: {
      url: { type: 'string', required: true, description: 'The base URL to tag.' },
      source: {
        type: 'string',
        required: false,
        description: 'utm_source value, e.g. "newsletter".',
      },
      medium: { type: 'string', required: false, description: 'utm_medium value, e.g. "email".' },
      campaign: {
        type: 'string',
        required: false,
        description: 'utm_campaign value, e.g. "spring_sale".',
      },
      term: {
        type: 'string',
        required: false,
        description: 'utm_term value (paid search keyword).',
      },
      content: {
        type: 'string',
        required: false,
        description: 'utm_content value (A/B variant label).',
      },
    },
  },
  {
    name: 'remove_tracking_params',
    description:
      'Strip common tracking and analytics query parameters (utm_*, fbclid, gclid, ref, etc.) from a URL.',
    category: 'clean',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to clean.' },
    },
  },
  {
    name: 'encode_url',
    description: 'Percent-encode a raw string so it is safe to use as a URL component.',
    category: 'encode',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'The raw text or URL component to encode.',
      },
    },
  },
  {
    name: 'decode_url',
    description: 'Decode a percent-encoded URL or URL component back into readable plain text.',
    category: 'encode',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'The encoded URL or component to decode.',
      },
    },
  },
  {
    name: 'extract_domain',
    description: 'Extract the bare domain name (and optionally subdomain) from any URL.',
    category: 'parse',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to inspect.' },
      include_subdomain: {
        type: 'boolean',
        required: false,
        description: 'If true, include subdomain (e.g. "blog.example.com"); default false.',
      },
    },
  },
  {
    name: 'slugify_to_url',
    description:
      'Convert a human-readable title or phrase into a URL-friendly slug (lowercase, hyphens, no special chars).',
    category: 'build',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'The text to slugify, e.g. "Hello World! It\'s Great".',
      },
    },
  },
  {
    name: 'extract_urls_from_text',
    description: 'Find and list every URL present in a block of free-form text.',
    category: 'extract',
    parameters: {
      text: { type: 'string', required: true, description: 'The text block to scan for URLs.' },
    },
  },
  {
    name: 'compare_urls',
    description:
      'Compare two URLs side-by-side and highlight every difference (protocol, host, path, params, hash).',
    category: 'compare',
    parameters: {
      url_a: { type: 'string', required: true, description: 'First URL.' },
      url_b: { type: 'string', required: true, description: 'Second URL.' },
    },
  },
  {
    name: 'url_to_markdown_link',
    description: 'Format a URL and optional label into a Markdown hyperlink: [label](url).',
    category: 'format',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL.' },
      label: {
        type: 'string',
        required: false,
        description: 'Link text; defaults to the URL hostname if omitted.',
      },
    },
  },
  {
    name: 'url_to_html_link',
    description:
      'Format a URL and optional label into an HTML <a> tag with optional target and rel attributes.',
    category: 'format',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL.' },
      label: {
        type: 'string',
        required: false,
        description: 'Link text; defaults to the URL if omitted.',
      },
      open_new_tab: {
        type: 'boolean',
        required: false,
        description: 'If true, adds target="_blank" rel="noopener noreferrer".',
      },
    },
  },
  {
    name: 'get_url_metadata',
    description:
      'Fetch the page title, description, OG image, and other metadata for any public URL using Microlink (free, no key).',
    category: 'metadata',
    parameters: {
      url: { type: 'string', required: true, description: 'The public URL to inspect.' },
    },
  },
  {
    name: 'generate_qr_code_url',
    description:
      'Generate a QR code image URL for any link using the free api.qrserver.com service (no key needed). Returns a direct image URL you can open or embed.',
    category: 'generate',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to encode in the QR code.' },
      size: {
        type: 'number',
        required: false,
        description: 'Pixel size of the QR image (square); default 200.',
      },
    },
  },
  {
    name: 'get_whois_info',
    description:
      'Retrieve WHOIS / RDAP registration info (registrar, creation date, expiry date, nameservers) for a domain using the free RDAP protocol — no API key needed.',
    category: 'whois',
    parameters: {
      domain: {
        type: 'string',
        required: true,
        description: 'The domain name to look up, e.g. "example.com".',
      },
    },
  },
  {
    name: 'url_to_base64',
    description:
      'Encode a URL as a Base64 string, or decode a Base64 string back to the original URL.',
    category: 'encode',
    parameters: {
      value: {
        type: 'string',
        required: true,
        description: 'The URL or Base64 string to process.',
      },
      action: { type: 'string', required: false, description: '"encode" (default) or "decode".' },
    },
  },
  {
    name: 'check_redirect_chain',
    description:
      'Trace the full redirect chain of a URL (301, 302, etc.) hop-by-hop until the final destination, using the free redirectchecker.io API.',
    category: 'redirect',
    parameters: {
      url: {
        type: 'string',
        required: true,
        description: 'The URL whose redirect chain to follow.',
      },
    },
  },
  {
    name: 'count_url_params',
    description:
      'Count the number of query parameters in a URL and report whether there are any duplicates.',
    category: 'parse',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL to inspect.' },
    },
  },
];
