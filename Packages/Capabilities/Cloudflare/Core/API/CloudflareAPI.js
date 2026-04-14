const BASE = 'https://api.cloudflare.com/client/v4';

function headers(creds) {
  return { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' };
}

async function cfFetch(path, creds, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(creds), ...(options.headers ?? {}) },
  });
  const data = await res.json();
  if (!data.success)
    throw new Error(data.errors?.[0]?.message ?? `Cloudflare API error: ${res.status}`);
  return data.result;
}

// ─── Token & Account ──────────────────────────────────────────────────────────

export async function verifyToken(creds) {
  return cfFetch('/user/tokens/verify', creds);
}

export async function getUser(creds) {
  const u = await cfFetch('/user', creds);
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    twoFactorEnabled: u.two_factor_authentication_enabled,
  };
}

export async function listAccounts(creds) {
  const accounts = await cfFetch('/accounts?per_page=50', creds);
  return (accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type }));
}

// ─── Zones ────────────────────────────────────────────────────────────────────

export async function listZones(creds) {
  const zones = await cfFetch('/zones?per_page=50&status=active', creds);
  return (zones ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    status: z.status,
    plan: z.plan?.name ?? 'Unknown',
    nameServers: z.name_servers ?? [],
    modifiedOn: z.modified_on,
  }));
}

export async function getZone(creds, zoneId) {
  const z = await cfFetch(`/zones/${zoneId}`, creds);
  return {
    id: z.id,
    name: z.name,
    status: z.status,
    plan: z.plan?.name ?? 'Unknown',
    nameServers: z.name_servers ?? [],
    originalNameServers: z.original_name_servers ?? [],
    createdOn: z.created_on,
    modifiedOn: z.modified_on,
    paused: z.paused,
  };
}

export async function getZoneSettings(creds, zoneId) {
  const settings = await cfFetch(`/zones/${zoneId}/settings`, creds);
  return (settings ?? []).map((s) => ({
    id: s.id,
    value: s.value,
    editable: s.editable,
    modifiedOn: s.modified_on,
  }));
}

export async function updateZoneSetting(creds, zoneId, settingId, value) {
  return cfFetch(`/zones/${zoneId}/settings/${settingId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export async function getZoneAnalytics(creds, zoneId, { since, until } = {}) {
  const sinceParam = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const untilParam = until ?? new Date().toISOString();
  const data = await cfFetch(
    `/zones/${zoneId}/analytics/dashboard?since=${sinceParam}&until=${untilParam}&continuous=true`,
    creds,
  );
  const totals = data?.totals ?? {};
  return {
    requests: totals.requests?.all ?? 0,
    bandwidth: totals.bandwidth?.all ?? 0,
    threats: totals.threats?.all ?? 0,
    pageviews: totals.pageviews?.all ?? 0,
    uniqueVisitors: totals.uniques?.all ?? 0,
  };
}

// ─── DNS Records ──────────────────────────────────────────────────────────────

export async function listDnsRecords(creds, zoneId) {
  const records = await cfFetch(`/zones/${zoneId}/dns_records?per_page=100`, creds);
  return (records ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
    priority: r.priority,
    createdOn: r.created_on,
    modifiedOn: r.modified_on,
  }));
}

export async function getDnsRecord(creds, zoneId, recordId) {
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, creds);
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
  };
}

export async function createDnsRecord(
  creds,
  zoneId,
  { type, name, content, ttl = 1, proxied = false, priority },
) {
  const body = { type, name, content, ttl, proxied };
  if (priority !== undefined) body.priority = priority;
  const r = await cfFetch(`/zones/${zoneId}/dns_records`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
  };
}

export async function updateDnsRecord(creds, zoneId, recordId, fields) {
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, creds, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
  };
}

export async function deleteDnsRecord(creds, zoneId, recordId) {
  const r = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, creds, { method: 'DELETE' });
  return { id: r.id, deleted: true };
}

export async function exportDnsRecords(creds, zoneId) {
  // Returns raw BIND-format text; bypass JSON parsing
  const res = await fetch(`${BASE}/zones/${zoneId}/dns_records/export`, {
    headers: headers(creds),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.text();
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export async function purgeCache(
  creds,
  zoneId,
  { purgeEverything = false, files = [], tags = [], hosts = [] } = {},
) {
  const body = purgeEverything
    ? { purge_everything: true }
    : {
        files: files.length ? files : undefined,
        tags: tags.length ? tags : undefined,
        hosts: hosts.length ? hosts : undefined,
      };
  return cfFetch(`/zones/${zoneId}/purge_cache`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCachingLevel(creds, zoneId) {
  return cfFetch(`/zones/${zoneId}/settings/cache_level`, creds);
}

export async function updateCachingLevel(creds, zoneId, value) {
  // value: 'aggressive' | 'basic' | 'simplified'
  return cfFetch(`/zones/${zoneId}/settings/cache_level`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

// ─── Firewall Rules ───────────────────────────────────────────────────────────

export async function listFirewallRules(creds, zoneId) {
  const rules = await cfFetch(`/zones/${zoneId}/firewall/rules?per_page=100`, creds);
  return (rules ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    action: r.action,
    expression: r.filter?.expression,
    enabled: r.paused === false,
    priority: r.priority,
  }));
}

export async function createFirewallRule(
  creds,
  zoneId,
  { expression, action, description = '', priority },
) {
  // First create the filter
  const filters = await cfFetch(`/zones/${zoneId}/filters`, creds, {
    method: 'POST',
    body: JSON.stringify([{ expression }]),
  });
  const filterId = filters[0].id;

  const body = [{ filter: { id: filterId }, action, description }];
  if (priority !== undefined) body[0].priority = priority;

  const rules = await cfFetch(`/zones/${zoneId}/firewall/rules`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const r = rules[0];
  return {
    id: r.id,
    description: r.description,
    action: r.action,
    expression: r.filter?.expression,
  };
}

export async function deleteFirewallRule(creds, zoneId, ruleId) {
  const r = await cfFetch(`/zones/${zoneId}/firewall/rules/${ruleId}`, creds, { method: 'DELETE' });
  return { id: r.id, deleted: true };
}

// ─── IP Access Rules ──────────────────────────────────────────────────────────

export async function listIPAccessRules(creds, zoneId) {
  const rules = await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules?per_page=100`, creds);
  return (rules ?? []).map((r) => ({
    id: r.id,
    mode: r.mode,
    value: r.configuration?.value,
    target: r.configuration?.target,
    notes: r.notes,
    createdOn: r.created_on,
  }));
}

export async function createIPAccessRule(creds, zoneId, { mode, target, value, notes = '' }) {
  // mode: 'block' | 'challenge' | 'whitelist' | 'js_challenge'
  // target: 'ip' | 'ip_range' | 'asn' | 'country'
  const r = await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules`, creds, {
    method: 'POST',
    body: JSON.stringify({ mode, configuration: { target, value }, notes }),
  });
  return { id: r.id, mode: r.mode, value: r.configuration?.value, target: r.configuration?.target };
}

export async function deleteIPAccessRule(creds, zoneId, ruleId) {
  const r = await cfFetch(`/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`, creds, {
    method: 'DELETE',
  });
  return { id: r.id, deleted: true };
}

// ─── Page Rules ───────────────────────────────────────────────────────────────

export async function listPageRules(creds, zoneId) {
  const rules = await cfFetch(
    `/zones/${zoneId}/pagerules?status=active&order=priority&direction=asc`,
    creds,
  );
  return (rules ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    priority: r.priority,
    targets: r.targets?.map((t) => t.constraint?.value),
    actions: r.actions?.map((a) => ({ id: a.id, value: a.value })),
  }));
}

export async function createPageRule(
  creds,
  zoneId,
  { url, actions, priority = 1, status = 'active' },
) {
  const r = await cfFetch(`/zones/${zoneId}/pagerules`, creds, {
    method: 'POST',
    body: JSON.stringify({
      targets: [{ target: 'url', constraint: { operator: 'matches', value: url } }],
      actions,
      priority,
      status,
    }),
  });
  return { id: r.id, status: r.status, priority: r.priority };
}

export async function deletePageRule(creds, zoneId, ruleId) {
  const r = await cfFetch(`/zones/${zoneId}/pagerules/${ruleId}`, creds, { method: 'DELETE' });
  return { id: r.id, deleted: true };
}

// ─── SSL / TLS ────────────────────────────────────────────────────────────────

export async function getSSLSetting(creds, zoneId) {
  return cfFetch(`/zones/${zoneId}/settings/ssl`, creds);
}

export async function updateSSLSetting(creds, zoneId, value) {
  // value: 'off' | 'flexible' | 'full' | 'strict'
  return cfFetch(`/zones/${zoneId}/settings/ssl`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export async function listCertificates(creds, zoneId) {
  const certs = await cfFetch(`/zones/${zoneId}/ssl/certificate_packs`, creds);
  return (certs ?? []).map((c) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    hosts: c.hosts,
    primaryCertificate: c.primary_certificate,
  }));
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export async function listWorkers(creds, accountId) {
  const scripts = await cfFetch(`/accounts/${accountId}/workers/scripts`, creds);
  return (scripts ?? []).map((s) => ({
    id: s.id,
    etag: s.etag,
    createdOn: s.created_on,
    modifiedOn: s.modified_on,
  }));
}

export async function listWorkerRoutes(creds, zoneId) {
  const routes = await cfFetch(`/zones/${zoneId}/workers/routes`, creds);
  return (routes ?? []).map((r) => ({
    id: r.id,
    pattern: r.pattern,
    script: r.script,
  }));
}
