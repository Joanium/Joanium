import { createExecutor } from '../Shared/createExecutor.js';
import { toolsList } from './ToolsList.js';
import { parseOrThrow, TRACKING_PARAMS } from './Utils.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'UrlExecutor',
  tools: toolsList,
  handlers: {
    shorten_url: async (params, onStage) => {
      const { url: url } = params;
      if (!url) throw new Error('Missing required param: url');
      try {
        new URL(url);
      } catch {
        return `"${url}" doesn't look like a valid URL. Include the full URL with https:// or http://`;
      }
      onStage('🔗 Shortening URL…');
      try {
        const res = await fetch('https://cleanuri.com/API/v1/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `url=${encodeURIComponent(url)}`,
          }),
          data = await res.json();
        if (data.result_url)
          return [
            '🔗 URL Shortened',
            '',
            `Original: ${url}`,
            `Short:    ${data.result_url}`,
            '',
            'Source: CleanURI (cleanuri.com)',
          ].join('\n');
      } catch {}
      try {
        const res = await fetch(
          `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
        );
        if (res.ok) {
          const shortUrl = await res.text();
          if (shortUrl.startsWith('http'))
            return [
              '🔗 URL Shortened',
              '',
              `Original: ${url}`,
              `Short:    ${shortUrl}`,
              '',
              'Source: TinyURL (tinyurl.com)',
            ].join('\n');
        }
      } catch {}
      return 'Could not shorten the URL right now. The shortening services may be temporarily unavailable.';
    },
    parse_url: (params) => {
      const u = parseOrThrow(params.url);
      return [
        `🔎 Parsed URL: ${params.url}`,
        '',
        `Protocol : ${u.protocol}`,
        `Hostname : ${u.hostname}`,
        `Port     : ${u.port || '(default)'}`,
        `Pathname : ${u.pathname || '/'}`,
        `Search   : ${u.search || '(none)'}`,
        `Hash     : ${u.hash || '(none)'}`,
        `Origin   : ${u.origin}`,
      ].join('\n');
    },
    extract_query_params: (params) => {
      const entries = [...parseOrThrow(params.url).searchParams.entries()];
      if (!entries.length) return `No query parameters found in: ${params.url}`;
      const rows = entries.map(([k, v]) => `  ${k} = ${v}`);
      return [
        `🔑 Query Parameters (${entries.length})`,
        '',
        ...rows,
        '',
        `From: ${params.url}`,
      ].join('\n');
    },
    build_url: (params) => {
      const { base: base, path: path = '', params: qp = {} } = params,
        u = parseOrThrow(base.endsWith('/') ? base.slice(0, -1) : base);
      return (
        path && (u.pathname = (path.startsWith('/') ? '' : '/') + path),
        Object.entries(qp).forEach(([k, v]) => u.searchParams.set(k, v)),
        ['🔨 Built URL', '', u.toString()].join('\n')
      );
    },
    add_utm_params: (params) => {
      const {
          url: url,
          source: source,
          medium: medium,
          campaign: campaign,
          term: term,
          content: content,
        } = params,
        u = parseOrThrow(url);
      return (
        source && u.searchParams.set('utm_source', source),
        medium && u.searchParams.set('utm_medium', medium),
        campaign && u.searchParams.set('utm_campaign', campaign),
        term && u.searchParams.set('utm_term', term),
        content && u.searchParams.set('utm_content', content),
        ['📊 URL with UTM Parameters', '', u.toString()].join('\n')
      );
    },
    remove_tracking_params: (params) => {
      const u = parseOrThrow(params.url),
        removed = [];
      for (const key of [...u.searchParams.keys()])
        (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) &&
          (removed.push(key), u.searchParams.delete(key));
      return removed.length
        ? [
            '🧹 Cleaned URL',
            '',
            `Before: ${params.url}`,
            `After:  ${u.toString()}`,
            '',
            `Removed (${removed.length}): ${removed.join(', ')}`,
          ].join('\n')
        : `✅ No tracking parameters found in: ${params.url}`;
    },
    encode_url: (params) => {
      const encoded = encodeURIComponent(params.text);
      return ['🔒 URL Encoded', '', `Input:   ${params.text}`, `Encoded: ${encoded}`].join('\n');
    },
    decode_url: (params) => {
      try {
        const decoded = decodeURIComponent(params.text);
        return ['🔓 URL Decoded', '', `Input:   ${params.text}`, `Decoded: ${decoded}`].join('\n');
      } catch {
        return `Could not decode "${params.text}". It may not be a valid percent-encoded string.`;
      }
    },
    extract_domain: (params) => {
      const full = parseOrThrow(params.url).hostname,
        parts = full.split('.'),
        bare = parts.length > 2 ? parts.slice(-2).join('.') : full;
      return [
        '🌐 Domain',
        '',
        `Full hostname : ${full}`,
        `Bare domain   : ${bare}`,
        `Returned      : ${params.include_subdomain ? full : bare}`,
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
      return ['🐌 URL Slug', '', `Input: ${params.text}`, `Slug:  ${slug}`].join('\n');
    },
    extract_urls_from_text: (params) => {
      const found = [...new Set(params.text.match(/https?:\/\/[^\s"'<>)\]]+/gi) || [])];
      return found.length
        ? [`🔗 URLs Found (${found.length})`, '', ...found.map((u, i) => `${i + 1}. ${u}`)].join(
            '\n',
          )
        : 'No URLs found in the provided text.';
    },
    compare_urls: (params) => {
      const a = parseOrThrow(params.url_a),
        b = parseOrThrow(params.url_b),
        diff = (label, va, vb) => {
          const same = va === vb;
          return `${same ? '✅' : '❌'} ${label.padEnd(12)}: ${va || '(none)'}${same ? '' : `  →  ${vb || '(none)'}`}`;
        };
      return [
        '🔀 URL Comparison',
        '',
        `A: ${params.url_a}`,
        `B: ${params.url_b}`,
        '',
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
      return ['📝 Markdown Link', '', `[${params.label || u.hostname}](${params.url})`].join('\n');
    },
    url_to_html_link: (params) => {
      const label = params.label || params.url,
        extra = params.open_new_tab ? ' target="_blank" rel="noopener noreferrer"' : '';
      return ['🌐 HTML Link', '', `<a href="${params.url}"${extra}>${label}</a>`].join('\n');
    },
    get_url_metadata: async (params, onStage) => {
      (parseOrThrow(params.url), onStage('🔍 Fetching page metadata…'));
      try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(params.url)}`),
          { data: data } = await res.json();
        return data
          ? [
              '📄 Page Metadata',
              '',
              `URL:         ${params.url}`,
              `Title:       ${data.title || '(none)'}`,
              `Description: ${data.description || '(none)'}`,
              `Author:      ${data.author || '(none)'}`,
              `Publisher:   ${data.publisher || '(none)'}`,
              `Image:       ${data.image?.url || '(none)'}`,
              '',
              'Source: Microlink (microlink.io) — free tier',
            ].join('\n')
          : `Could not retrieve metadata for: ${params.url}`;
      } catch {
        return `Could not fetch metadata for "${params.url}". The service may be temporarily unavailable.`;
      }
    },
    generate_qr_code_url: (params, onStage) => {
      (parseOrThrow(params.url), onStage('📷 Generating QR code…'));
      const size = Math.min(Math.max(Number(params.size) || 200, 50), 1e3),
        qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(params.url)}&size=${size}x${size}`;
      return [
        '📷 QR Code Generated',
        '',
        `Target URL : ${params.url}`,
        `Size       : ${size}×${size} px`,
        `Image URL  : ${qrUrl}`,
        '',
        'Open or embed the Image URL to display the QR code.',
        'Source: api.qrserver.com — free, no key required',
      ].join('\n');
    },
    get_whois_info: async (params, onStage) => {
      const domain = params.domain
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .toLowerCase();
      onStage('🔍 Looking up WHOIS / RDAP…');
      try {
        const res = await fetch(`https://rdap.org/domain/${domain}`);
        if (!res.ok) return `No RDAP record found for "${domain}".`;
        const data = await res.json(),
          getEvent = (action) =>
            data.events?.find((e) => e.eventAction === action)?.eventDate?.split('T')[0] ||
            '(unknown)',
          nameservers = data.nameservers?.map((n) => n.ldhName).join(', ') || '(none)';
        return [
          '🌍 WHOIS / RDAP Info',
          '',
          `Domain      : ${domain}`,
          `Registrar   : ${data.entities?.find((e) => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find((f) => 'fn' === f[0])?.[3] || '(unknown)'}`,
          `Registered  : ${getEvent('registration')}`,
          `Updated     : ${getEvent('last changed')}`,
          `Expires     : ${getEvent('expiration')}`,
          `Nameservers : ${nameservers}`,
          `Status      : ${data.status?.join(', ') || '(unknown)'}`,
          '',
          'Source: RDAP Protocol (rdap.org) — free, no key required',
        ].join('\n');
      } catch {
        return `Could not retrieve WHOIS info for "${domain}". The RDAP service may be temporarily unavailable.`;
      }
    },
    url_to_base64: (params) => {
      if ('decode' === (params.action || 'encode').toLowerCase())
        try {
          const decoded = atob(params.value);
          return ['🔓 Base64 → URL', '', `Input:   ${params.value}`, `Decoded: ${decoded}`].join(
            '\n',
          );
        } catch {
          return `"${params.value}" is not valid Base64.`;
        }
      const encoded = btoa(params.value);
      return ['🔒 URL → Base64', '', `Input:   ${params.value}`, `Encoded: ${encoded}`].join('\n');
    },
    check_redirect_chain: async (params, onStage) => {
      (parseOrThrow(params.url), onStage('🔗 Tracing redirect chain…'));
      try {
        const res = await fetch(
            `https://redirectchecker.io/api/check?url=${encodeURIComponent(params.url)}`,
          ),
          data = await res.json(),
          hops = data.chain || data.redirects || data.steps;
        return Array.isArray(hops) && hops.length
          ? [
              `↪️  Redirect Chain (${hops.length} hop${hops.length > 1 ? 's' : ''})`,
              '',
              ...hops.map(
                (h, i) =>
                  `  ${i + 1}. [${h.status || h.statusCode || '?'}] ${h.url || h.location || h}`,
              ),
              '',
              'Source: redirectchecker.io — free',
            ].join('\n')
          : `No redirects detected for: ${params.url}`;
      } catch {
        return `Could not trace the redirect chain for "${params.url}". The service may be temporarily unavailable.`;
      }
    },
    count_url_params: (params) => {
      const all = [...parseOrThrow(params.url).searchParams.entries()],
        keys = all.map(([k]) => k),
        dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      return [
        '🔢 Query Parameter Count',
        '',
        `URL        : ${params.url}`,
        `Total      : ${all.length}`,
        `Unique keys: ${new Set(keys).size}`,
        `Duplicates : ${dupes.length ? dupes.join(', ') : 'none'}`,
      ].join('\n');
    },
  },
});
