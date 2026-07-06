import {
  bodyJson,
  buildUrl,
  clampInteger,
  formatList,
  parseCommaList,
  requireConnectorCredentials,
  requireText,
} from '../../../Core/ConnectorHttp.js';

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

async function cloudflareRequest(
  rootDirectory,
  path,
  { method = 'GET', searchParams = {}, body } = {},
) {
  const credentials = await requireConnectorCredentials(
    rootDirectory,
    'cloudflare',
    ['token'],
    'Cloudflare',
  );
  const response = await fetch(buildUrl(CLOUDFLARE_API, path, searchParams), {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${credentials.token}`,
    },
    ...bodyJson(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    const message =
      data?.errors?.map((error) => error.message).join('; ') || 'Cloudflare request failed';
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }
  return data.result;
}

function formatZone(zone, index = null) {
  return [
    `${index == null ? '' : `${index + 1}. `}${zone.name}`,
    `ID: ${zone.id}`,
    `Status: ${zone.status}`,
    `Plan: ${zone.plan?.name ?? 'unknown'}`,
    `Name servers: ${(zone.name_servers ?? []).join(', ') || 'n/a'}`,
  ].join('\n');
}

export function createCloudflareToolHandlers({ rootDirectory }) {
  return {
    async cloudflare_get_user() {
      const user = await cloudflareRequest(rootDirectory, '/user');
      return [
        `Cloudflare user: ${user.email}`,
        `ID: ${user.id}`,
        `Two factor: ${user.two_factor_authentication_enabled ?? false}`,
      ].join('\n');
    },

    async cloudflare_list_accounts(params = {}) {
      const limit = clampInteger(params.limit, 20, 1, 50);
      const accounts = await cloudflareRequest(rootDirectory, '/accounts', {
        searchParams: { per_page: limit },
      });
      return formatList(
        'Cloudflare accounts',
        accounts.map((account, index) => `${index + 1}. ${account.name}\n   ID: ${account.id}`),
      );
    },

    async cloudflare_list_zones(params = {}) {
      const limit = clampInteger(params.limit, 20, 1, 50);
      const zones = await cloudflareRequest(rootDirectory, '/zones', {
        searchParams: { name: params.name, per_page: limit },
      });
      return formatList('Cloudflare zones', zones.map(formatZone));
    },

    async cloudflare_get_zone(params = {}) {
      return formatZone(
        await cloudflareRequest(
          rootDirectory,
          `/zones/${encodeURIComponent(requireText(params.zone_id ?? params.zoneId, 'zone_id'))}`,
        ),
      );
    },

    async cloudflare_list_dns_records(params = {}) {
      const zoneId = encodeURIComponent(requireText(params.zone_id ?? params.zoneId, 'zone_id'));
      const limit = clampInteger(params.limit, 20, 1, 100);
      const records = await cloudflareRequest(rootDirectory, `/zones/${zoneId}/dns_records`, {
        searchParams: { name: params.name, type: params.type, per_page: limit },
      });
      return formatList(
        'Cloudflare DNS records',
        records.map(
          (record, index) =>
            `${index + 1}. ${record.type} ${record.name} -> ${record.content}\n   ID: ${record.id} | Proxied: ${record.proxied ?? false} | TTL: ${record.ttl}`,
        ),
      );
    },

    async cloudflare_create_dns_record(params = {}) {
      const zoneId = encodeURIComponent(requireText(params.zone_id ?? params.zoneId, 'zone_id'));
      const record = await cloudflareRequest(rootDirectory, `/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: {
          type: requireText(params.type, 'type').toUpperCase(),
          name: requireText(params.name, 'name'),
          content: requireText(params.content, 'content'),
          proxied: Boolean(params.proxied),
          ttl: Number(params.ttl) || 1,
        },
      });
      return [
        `Cloudflare DNS record created`,
        `${record.type} ${record.name} -> ${record.content}`,
        `ID: ${record.id}`,
      ].join('\n');
    },

    async cloudflare_purge_cache(params = {}) {
      const zoneId = encodeURIComponent(requireText(params.zone_id ?? params.zoneId, 'zone_id'));
      const files = parseCommaList(params.files);
      await cloudflareRequest(rootDirectory, `/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        body: files.length ? { files } : { purge_everything: true },
      });
      return files.length
        ? `Purged ${files.length} Cloudflare cache URL(s).`
        : 'Purged the full Cloudflare zone cache.';
    },
  };
}
