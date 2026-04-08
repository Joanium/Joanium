import { createExecutor } from '../Shared/createExecutor.js';
import { toolsList } from './ToolsList.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOrThrow(url) {
  try {
    return new URL(url);
  } catch {
    throw new Error(`"${url}" is not a valid URL. Include https:// or http://`);
  }
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'twclid',
  'igshid',
  'mc_eid',
  '_ga',
  '_gl',
  'ref',
  'source',
  'affiliate_id',
  'partner_id',
  'click_id',
]);

// ─── Executor ─────────────────────────────────────────────────────────────────

export const { handles, execute } = createExecutor({
  name: 'UrlExecutor',
  tools: toolsList,
  handlers: {
    shorten_url: async (params, onStage) => {
      const { url } = params;
      if (!url) throw new Error('Missing required param: url');
      try {
        new URL(url);
      } catch {
        return `"${url}" doesn't look like a valid URL. Include the full URL with https:// or http://`;
      }
      onStage(`🔗 Shortening URL…`);
      try {
        const res = await fetch('https://cleanuri.com/API/v1/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `url=${encodeURIComponent(url)}`,
        });
        const data = await res.json();
        if (data.result_url)
          return [
            `🔗 URL Shortened`,
            ``,
            `Original: ${url}`,
            `Short:    ${data.result_url}`,
            ``,
            `Source: CleanURI (cleanuri.com)`,
          ].join('\n');
      } catch {
        /* fallback */
      }
      try {
        const res = await fetch(
          `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
        );
        if (res.ok) {
          const shortUrl = await res.text();
          if (shortUrl.startsWith('http'))
            return [
              `🔗 URL Shortened`,
              ``,
              `Original: ${url}`,
              `Short:    ${shortUrl}`,
              ``,
              `Source: TinyURL (tinyurl.com)`,
            ].join('\n');
        }
      } catch {
        /* fall through */
      }
      return `Could not shorten the URL right now. The shortening services may be temporarily unavailable.`;
    },

    parse_url: (params) => {
      const u = parseOrThrow(params.url);
      const lines = [
        `🔎 Parsed URL: ${params.url}`,
        ``,
        `Protocol : ${u.protocol}`,
        `Hostname : ${u.hostname}`,
        `Port     : ${u.port || '(default)'}`,
        `Pathname : ${u.pathname || '/'}`,
        `Search   : ${u.search || '(none)'}`,
        `Hash     : ${u.hash || '(none)'}`,
        `Origin   : ${u.origin}`,
      ];
      return lines.join('\n');
    },

    extract_query_params: (params) => {
      const u = parseOrThrow(params.url);
      const entries = [...u.searchParams.entries()];
      if (!entries.length) return `No query parameters found in: ${params.url}`;
      const rows = entries.map(([k, v]) => `  ${k} = ${v}`);
      return [
        `🔑 Query Parameters (${entries.length})`,
        ``,
        ...rows,
        ``,
        `From: ${params.url}`,
      ].join('\n');
    },

    build_url: (params) => {
      const { base, path = '', params: qp = {} } = params;
      const u = parseOrThrow(base.endsWith('/') ? base.slice(0, -1) : base);
      if (path) u.pathname = (path.startsWith('/') ? '' : '/') + path;
      Object.entries(qp).forEach(([k, v]) => u.searchParams.set(k, v));
      return [`🔨 Built URL`, ``, u.toString()].join('\n');
    },

    add_utm_params: (params) => {
      const { url, source, medium, campaign, term, content } = params;
      const u = parseOrThrow(url);
      if (source) u.searchParams.set('utm_source', source);
      if (medium) u.searchParams.set('utm_medium', medium);
      if (campaign) u.searchParams.set('utm_campaign', campaign);
      if (term) u.searchParams.set('utm_term', term);
      if (content) u.searchParams.set('utm_content', content);
      return [`📊 URL with UTM Parameters`, ``, u.toString()].join('\n');
    },

    remove_tracking_params: (params) => {
      const u = parseOrThrow(params.url);
      const removed = [];
      for (const key of [...u.searchParams.keys()]) {
        if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) {
          removed.push(key);
          u.searchParams.delete(key);
        }
      }
      if (!removed.length) return `✅ No tracking parameters found in: ${params.url}`;
      return [
        `🧹 Cleaned URL`,
        ``,
        `Before: ${params.url}`,
        `After:  ${u.toString()}`,
        ``,
        `Removed (${removed.length}): ${removed.join(', ')}`,
      ].join('\n');
    },

    encode_url: (params) => {
      const encoded = encodeURIComponent(params.text);
      return [`🔒 URL Encoded`, ``, `Input:   ${params.text}`, `Encoded: ${encoded}`].join('\n');
    },

    decode_url: (params) => {
      try {
        const decoded = decodeURIComponent(params.text);
        return [`🔓 URL Decoded`, ``, `Input:   ${params.text}`, `Decoded: ${decoded}`].join('\n');
      } catch {
        return `Could not decode "${params.text}". It may not be a valid percent-encoded string.`;
      }
    },

    extract_domain: (params) => {
      const u = parseOrThrow(params.url);
      const full = u.hostname;
      const parts = full.split('.');
      const bare = parts.length > 2 ? parts.slice(-2).join('.') : full;
      const result = params.include_subdomain ? full : bare;
      return [
        `🌐 Domain`,
        ``,
        `Full hostname : ${full}`,
        `Bare domain   : ${bare}`,
        `Returned      : ${result}`,
      ].join('\n');
    },

    slugify_to_url: (params) => {
      const slug = params.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-');
      return [`🐌 URL Slug`, ``, `Input: ${params.text}`, `Slug:  ${slug}`].join('\n');
    },

    extract_urls_from_text: (params) => {
      const pattern = /https?:\/\/[^\s"'<>)\]]+/gi;
      const found = [...new Set(params.text.match(pattern) || [])];
      if (!found.length) return `No URLs found in the provided text.`;
      return [`🔗 URLs Found (${found.length})`, ``, ...found.map((u, i) => `${i + 1}. ${u}`)].join(
        '\n',
      );
    },

    compare_urls: (params) => {
      const a = parseOrThrow(params.url_a);
      const b = parseOrThrow(params.url_b);
      const diff = (label, va, vb) => {
        const same = va === vb;
        return `${same ? '✅' : '❌'} ${label.padEnd(12)}: ${va || '(none)'}${same ? '' : `  →  ${vb || '(none)'}`}`;
      };
      return [
        `🔀 URL Comparison`,
        ``,
        `A: ${params.url_a}`,
        `B: ${params.url_b}`,
        ``,
        diff('Protocol', a.protocol, b.protocol),
        diff('Hostname', a.hostname, b.hostname),
        diff('Port', a.port, b.port),
        diff('Pathname', a.pathname, b.pathname),
        diff('Search', a.search, b.search),
        diff('Hash', a.hash, b.hash),
      ].join('\n');
    },

    url_to_markdown_link: (params) => {
      const u = parseOrThrow(params.url);
      const label = params.label || u.hostname;
      return [`📝 Markdown Link`, ``, `[${label}](${params.url})`].join('\n');
    },

    url_to_html_link: (params) => {
      const label = params.label || params.url;
      const extra = params.open_new_tab ? ` target="_blank" rel="noopener noreferrer"` : '';
      return [`🌐 HTML Link`, ``, `<a href="${params.url}"${extra}>${label}</a>`].join('\n');
    },

    get_url_metadata: async (params, onStage) => {
      parseOrThrow(params.url);
      onStage(`🔍 Fetching page metadata…`);
      try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(params.url)}`);
        const { data } = await res.json();
        if (!data) return `Could not retrieve metadata for: ${params.url}`;
        const lines = [
          `📄 Page Metadata`,
          ``,
          `URL:         ${params.url}`,
          `Title:       ${data.title || '(none)'}`,
          `Description: ${data.description || '(none)'}`,
          `Author:      ${data.author || '(none)'}`,
          `Publisher:   ${data.publisher || '(none)'}`,
          `Image:       ${data.image?.url || '(none)'}`,
          ``,
          `Source: Microlink (microlink.io) — free tier`,
        ];
        return lines.join('\n');
      } catch {
        return `Could not fetch metadata for "${params.url}". The service may be temporarily unavailable.`;
      }
    },

    generate_qr_code_url: (params, onStage) => {
      parseOrThrow(params.url);
      onStage(`📷 Generating QR code…`);
      const size = Math.min(Math.max(Number(params.size) || 200, 50), 1000);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(params.url)}&size=${size}x${size}`;
      return [
        `📷 QR Code Generated`,
        ``,
        `Target URL : ${params.url}`,
        `Size       : ${size}×${size} px`,
        `Image URL  : ${qrUrl}`,
        ``,
        `Open or embed the Image URL to display the QR code.`,
        `Source: api.qrserver.com — free, no key required`,
      ].join('\n');
    },

    get_whois_info: async (params, onStage) => {
      const domain = params.domain
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .toLowerCase();
      onStage(`🔍 Looking up WHOIS / RDAP…`);
      try {
        const res = await fetch(`https://rdap.org/domain/${domain}`);
        if (!res.ok) return `No RDAP record found for "${domain}".`;
        const data = await res.json();
        const getEvent = (action) =>
          data.events?.find((e) => e.eventAction === action)?.eventDate?.split('T')[0] ||
          '(unknown)';
        const nameservers = data.nameservers?.map((n) => n.ldhName).join(', ') || '(none)';
        const registrar =
          data.entities
            ?.find((e) => e.roles?.includes('registrar'))
            ?.vcardArray?.[1]?.find((f) => f[0] === 'fn')?.[3] || '(unknown)';
        return [
          `🌍 WHOIS / RDAP Info`,
          ``,
          `Domain      : ${domain}`,
          `Registrar   : ${registrar}`,
          `Registered  : ${getEvent('registration')}`,
          `Updated     : ${getEvent('last changed')}`,
          `Expires     : ${getEvent('expiration')}`,
          `Nameservers : ${nameservers}`,
          `Status      : ${data.status?.join(', ') || '(unknown)'}`,
          ``,
          `Source: RDAP Protocol (rdap.org) — free, no key required`,
        ].join('\n');
      } catch {
        return `Could not retrieve WHOIS info for "${domain}". The RDAP service may be temporarily unavailable.`;
      }
    },

    url_to_base64: (params) => {
      const action = (params.action || 'encode').toLowerCase();
      if (action === 'decode') {
        try {
          const decoded = atob(params.value);
          return [`🔓 Base64 → URL`, ``, `Input:   ${params.value}`, `Decoded: ${decoded}`].join(
            '\n',
          );
        } catch {
          return `"${params.value}" is not valid Base64.`;
        }
      }
      const encoded = btoa(params.value);
      return [`🔒 URL → Base64`, ``, `Input:   ${params.value}`, `Encoded: ${encoded}`].join('\n');
    },

    check_redirect_chain: async (params, onStage) => {
      parseOrThrow(params.url);
      onStage(`🔗 Tracing redirect chain…`);
      try {
        const res = await fetch(
          `https://redirectchecker.io/api/check?url=${encodeURIComponent(params.url)}`,
        );
        const data = await res.json();
        const hops = data.chain || data.redirects || data.steps;
        if (!Array.isArray(hops) || !hops.length) return `No redirects detected for: ${params.url}`;
        const lines = [
          `↪️  Redirect Chain (${hops.length} hop${hops.length > 1 ? 's' : ''})`,
          ``,
          ...hops.map(
            (h, i) =>
              `  ${i + 1}. [${h.status || h.statusCode || '?'}] ${h.url || h.location || h}`,
          ),
          ``,
          `Source: redirectchecker.io — free`,
        ];
        return lines.join('\n');
      } catch {
        return `Could not trace the redirect chain for "${params.url}". The service may be temporarily unavailable.`;
      }
    },

    count_url_params: (params) => {
      const u = parseOrThrow(params.url);
      const all = [...u.searchParams.entries()];
      const keys = all.map(([k]) => k);
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      return [
        `🔢 Query Parameter Count`,
        ``,
        `URL        : ${params.url}`,
        `Total      : ${all.length}`,
        `Unique keys: ${new Set(keys).size}`,
        `Duplicates : ${dupes.length ? dupes.join(', ') : 'none'}`,
      ].join('\n');
    },
  },
});
