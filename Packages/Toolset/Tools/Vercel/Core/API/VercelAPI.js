import { apiFetch } from '../../../../Core/ConnectorHttp.js';
import { tryParseJson } from '../../../../../Shared/Utils/AsyncUtils.js';
import { mapDeployment } from './Utils.js';

const BASE = 'https://api.vercel.com';

function headers(creds) {
  return { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' };
}

function teamQuery(creds) {
  return creds.teamId ? `?teamId=${creds.teamId}` : '';
}

function teamQueryAppend(creds, existing = '') {
  if (!creds.teamId) return existing;
  return existing ? `${existing}&teamId=${creds.teamId}` : `?teamId=${creds.teamId}`;
}

async function vFetch(path, creds, options = {}) {
  return apiFetch(
    `${BASE}${path}`,
    headers(creds),
    options,
    (data, res) => data.error?.message ?? `Vercel API error: ${res.status}`,
  );
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function getUser(creds) {
  const data = await vFetch('/v2/user', creds);
  return data.user ?? data;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(creds) {
  const data = await vFetch(
    `/v9/projects?limit=50${creds.teamId ? `&teamId=${creds.teamId}` : ''}`,
    creds,
  );
  return (data.projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    framework: p.framework ?? 'unknown',
    updatedAt: p.updatedAt,
    latestDeploy: p.latestDeployments?.[0]?.readyState ?? 'unknown',
    domains: (p.alias ?? []).map((a) => a.domain),
  }));
}

export async function getProject(creds, idOrName) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v9/projects/${encodeURIComponent(idOrName)}${q}`, creds);
  return {
    id: data.id,
    name: data.name,
    framework: data.framework ?? 'unknown',
    nodeVersion: data.nodeVersion,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    link: data.link,
    rootDirectory: data.rootDirectory,
    latestDeploy: data.latestDeployments?.[0]?.readyState ?? 'unknown',
    domains: (data.alias ?? []).map((a) => a.domain),
  };
}

export async function createProject(creds, { name, framework, gitRepo }) {
  const body = { name };
  if (framework) body.framework = framework;
  if (gitRepo) body.gitRepository = gitRepo;
  const q = teamQuery(creds);
  const data = await vFetch(`/v9/projects${q}`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { id: data.id, name: data.name, framework: data.framework };
}

export async function deleteProject(creds, idOrName) {
  const q = teamQuery(creds);
  await vFetch(`/v9/projects/${encodeURIComponent(idOrName)}${q}`, creds, { method: 'DELETE' });
  return { deleted: true };
}

export async function updateProject(creds, idOrName, updates) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v9/projects/${encodeURIComponent(idOrName)}${q}`, creds, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return { id: data.id, name: data.name, framework: data.framework };
}

export async function pauseProject(creds, idOrName) {
  const q = teamQuery(creds);
  await vFetch(`/v1/projects/${encodeURIComponent(idOrName)}/pause${q}`, creds, {
    method: 'POST',
  });
  return { paused: true };
}

export async function unpauseProject(creds, idOrName) {
  const q = teamQuery(creds);
  await vFetch(`/v1/projects/${encodeURIComponent(idOrName)}/unpause${q}`, creds, {
    method: 'POST',
  });
  return { unpaused: true };
}

// ─── Deployments ──────────────────────────────────────────────────────────────

export async function listDeployments(creds, limit = 20) {
  const q = teamQueryAppend(creds, `?limit=${limit}`);
  const data = await vFetch(`/v6/deployments${q}`, creds);
  return (data.deployments ?? []).map(mapDeployment);
}

export async function listDeploymentsByProject(creds, projectId, limit = 20) {
  const q = teamQueryAppend(creds, `?projectId=${encodeURIComponent(projectId)}&limit=${limit}`);
  const data = await vFetch(`/v6/deployments${q}`, creds);
  return (data.deployments ?? []).map(mapDeployment);
}

export async function getDeployment(creds, deploymentId) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v13/deployments/${encodeURIComponent(deploymentId)}${q}`, creds);
  return {
    id: data.uid,
    name: data.name,
    url: data.url,
    state: data.readyState ?? data.state,
    target: data.target,
    createdAt: data.createdAt,
    buildingAt: data.buildingAt,
    ready: data.ready,
    creator: data.creator?.username ?? null,
    inspectorUrl: data.inspectorUrl,
    meta: data.meta,
    errorMessage: data.errorMessage ?? null,
  };
}

export async function deleteDeployment(creds, deploymentId) {
  const q = teamQuery(creds);
  await vFetch(`/v13/deployments/${encodeURIComponent(deploymentId)}${q}`, creds, {
    method: 'DELETE',
  });
  return { deleted: true };
}

export async function cancelDeployment(creds, deploymentId) {
  const q = teamQuery(creds);
  const data = await vFetch(
    `/v12/deployments/${encodeURIComponent(deploymentId)}/cancel${q}`,
    creds,
    {
      method: 'PATCH',
    },
  );
  return { id: data.uid, state: data.state };
}

export async function redeployDeployment(creds, deploymentId) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v13/deployments${q}`, creds, {
    method: 'POST',
    body: JSON.stringify({ deploymentId, target: 'production' }),
  });
  return { id: data.id ?? data.uid, url: data.url, state: data.readyState };
}

export async function promoteDeployment(creds, projectId, deploymentId) {
  const q = teamQuery(creds);
  const data = await vFetch(
    `/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deploymentId)}${q}`,
    creds,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return { requestedAt: data.requestedAt, jobStatus: data.jobStatus };
}

export async function getDeploymentEvents(creds, deploymentId) {
  const q = teamQueryAppend(creds, '?direction=forward&follow=0&limit=100');
  const data = await vFetch(
    `/v2/deployments/${encodeURIComponent(deploymentId)}/events${q}`,
    creds,
  );
  const events = Array.isArray(data) ? data : (data.events ?? []);
  return events.map((e) => ({
    type: e.type,
    text: e.payload?.text ?? e.text ?? '',
    date: e.date,
  }));
}

export async function getDeploymentFiles(creds, deploymentId) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v6/deployments/${encodeURIComponent(deploymentId)}/files${q}`, creds);
  const files = Array.isArray(data) ? data : (data.files ?? []);
  return files.map((f) => ({ name: f.name, type: f.type, uid: f.uid, children: f.children }));
}

export async function getDeploymentFileContent(creds, deploymentId, fileId) {
  // Reads raw text rather than JSON — not routed through vFetch.
  const q = teamQuery(creds);
  const res = await fetch(
    `${BASE}/v7/deployments/${encodeURIComponent(deploymentId)}/files/${encodeURIComponent(fileId)}${q}`,
    { headers: headers(creds) },
  );
  if (!res.ok) {
    const data = await tryParseJson(res);
    throw new Error(data.error?.message ?? `Vercel API error: ${res.status}`);
  }
  return { content: await res.text() };
}

// ─── Domains ──────────────────────────────────────────────────────────────────

export async function listDomains(creds) {
  const q = teamQueryAppend(creds, '?limit=50');
  const data = await vFetch(`/v5/domains${q}`, creds);
  return (data.domains ?? []).map((d) => ({
    name: d.name,
    verified: d.verified,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
    boughtAt: d.boughtAt,
    serviceType: d.serviceType,
  }));
}

export async function getDomain(creds, domain) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v5/domains/${encodeURIComponent(domain)}${q}`, creds);
  const d = data.domain ?? data;
  return {
    name: d.name,
    verified: d.verified,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
    boughtAt: d.boughtAt,
    nameservers: d.nameservers,
    intendedNameservers: d.intendedNameservers,
    serviceType: d.serviceType,
    cdnEnabled: d.cdnEnabled,
  };
}

export async function checkDomainAvailability(creds, domainName) {
  const q = teamQueryAppend(creds, `?name=${encodeURIComponent(domainName)}`);
  const data = await vFetch(`/v4/domains/status${q}`, creds);
  return { available: data.available, domainName };
}

export async function checkDomainPrice(creds, domainName) {
  const q = teamQueryAppend(creds, `?name=${encodeURIComponent(domainName)}&type=new`);
  const data = await vFetch(`/v4/domains/price${q}`, creds);
  return { price: data.price, period: data.period, domainName };
}

export async function listProjectDomains(creds, projectId) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains${q}`, creds);
  return (data.domains ?? []).map((d) => ({
    name: d.name,
    verified: d.verified,
    redirect: d.redirect,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function addProjectDomain(creds, projectId, domain) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains${q}`, creds, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  return { name: data.name, verified: data.verified };
}

export async function removeProjectDomain(creds, projectId, domain) {
  const q = teamQuery(creds);
  await vFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${q}`,
    creds,
    { method: 'DELETE' },
  );
  return { removed: true };
}

export async function verifyProjectDomain(creds, projectId, domain) {
  const q = teamQuery(creds);
  const data = await vFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify${q}`,
    creds,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return { verified: data.verified, verification: data.verification };
}

// ─── DNS Records ──────────────────────────────────────────────────────────────

export async function listDnsRecords(creds, domain) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v4/domains/${encodeURIComponent(domain)}/records${q}`, creds);
  return (data.records ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    value: r.value,
    ttl: r.ttl,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function createDnsRecord(creds, domain, { type, name, value, ttl }) {
  const q = teamQuery(creds);
  const body = { type, name, value };
  if (ttl) body.ttl = ttl;
  const data = await vFetch(`/v2/domains/${encodeURIComponent(domain)}/records${q}`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { uid: data.uid };
}

export async function deleteDnsRecord(creds, domain, recordId) {
  const q = teamQuery(creds);
  await vFetch(
    `/v2/domains/${encodeURIComponent(domain)}/records/${encodeURIComponent(recordId)}${q}`,
    creds,
    { method: 'DELETE' },
  );
  return { deleted: true };
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export async function listCerts(creds, domain) {
  const q = teamQueryAppend(creds, domain ? `?domain=${encodeURIComponent(domain)}` : '');
  const data = await vFetch(`/v7/certs${q}`, creds);
  return (data.certs ?? []).map((c) => ({
    id: c.id,
    cns: c.cns,
    expiration: c.expiration,
    autoRenew: c.autoRenew,
    createdAt: c.createdAt,
  }));
}

export async function issueCert(creds, domains) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v7/certs${q}`, creds, {
    method: 'POST',
    body: JSON.stringify({ domains }),
  });
  return { id: data.id, cns: data.cns, expiration: data.expiration };
}

export async function deleteCert(creds, certId) {
  const q = teamQuery(creds);
  await vFetch(`/v7/certs/${encodeURIComponent(certId)}${q}`, creds, { method: 'DELETE' });
  return { deleted: true };
}

// ─── Environment Variables ─────────────────────────────────────────────────────

export async function listEnvVars(creds, projectId) {
  const q = teamQueryAppend(creds, '?decrypt=false');
  const data = await vFetch(`/v9/projects/${encodeURIComponent(projectId)}/env${q}`, creds);
  return (data.envs ?? []).map((e) => ({
    id: e.id,
    key: e.key,
    type: e.type,
    target: e.target,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
}

export async function createEnvVar(creds, projectId, { key, value, target, type }) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v9/projects/${encodeURIComponent(projectId)}/env${q}`, creds, {
    method: 'POST',
    body: JSON.stringify({
      key,
      value,
      target: target ?? ['production', 'preview', 'development'],
      type: type ?? 'plain',
    }),
  });
  return { id: data.id, key: data.key, type: data.type };
}

export async function updateEnvVar(creds, projectId, envId, { value, target }) {
  const q = teamQuery(creds);
  const body = {};
  if (value !== undefined) body.value = value;
  if (target !== undefined) body.target = target;
  const data = await vFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}${q}`,
    creds,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  return { id: data.id, key: data.key };
}

export async function deleteEnvVar(creds, projectId, envId) {
  const q = teamQuery(creds);
  await vFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}${q}`,
    creds,
    { method: 'DELETE' },
  );
  return { deleted: true };
}

// ─── Aliases ──────────────────────────────────────────────────────────────────

export async function listAliases(creds, limit = 20) {
  const q = teamQueryAppend(creds, `?limit=${limit}`);
  const data = await vFetch(`/v4/aliases${q}`, creds);
  return (data.aliases ?? []).map((a) => ({
    uid: a.uid,
    alias: a.alias,
    deploymentId: a.deploymentId,
    createdAt: a.createdAt,
  }));
}

export async function deleteAlias(creds, aliasId) {
  const q = teamQuery(creds);
  await vFetch(`/v2/aliases/${encodeURIComponent(aliasId)}${q}`, creds, { method: 'DELETE' });
  return { deleted: true };
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

export async function listSecrets(creds) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v3/secrets${q}`, creds);
  return (data.secrets ?? []).map((s) => ({
    uid: s.uid,
    name: s.name,
    createdAt: s.created,
  }));
}

export async function createSecret(creds, name, value) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v2/secrets/${encodeURIComponent(name)}${q}`, creds, {
    method: 'POST',
    body: JSON.stringify({ name, value }),
  });
  return { uid: data.uid, name: data.name };
}

export async function renameSecret(creds, nameOrId, newName) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v2/secrets/${encodeURIComponent(nameOrId)}${q}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName }),
  });
  return { uid: data.uid, name: data.name };
}

export async function deleteSecret(creds, nameOrId) {
  const q = teamQuery(creds);
  await vFetch(`/v2/secrets/${encodeURIComponent(nameOrId)}${q}`, creds, { method: 'DELETE' });
  return { deleted: true };
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function listTeams(creds) {
  const data = await vFetch('/v2/teams?limit=20', creds);
  return (data.teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    createdAt: t.createdAt,
  }));
}

export async function getTeam(creds, teamId) {
  const data = await vFetch(`/v2/teams/${encodeURIComponent(teamId)}`, creds);
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    createdAt: data.createdAt,
    memberCount: data.membership?.role ?? null,
  };
}

export async function listTeamMembers(creds, teamId) {
  const data = await vFetch(`/v2/teams/${encodeURIComponent(teamId)}/members?limit=50`, creds);
  return (data.members ?? []).map((m) => ({
    uid: m.uid,
    username: m.username,
    email: m.email,
    role: m.role,
    joinedAt: m.joined,
  }));
}

export async function inviteTeamMember(creds, teamId, { email, role }) {
  const data = await vFetch(`/v1/teams/${encodeURIComponent(teamId)}/members`, creds, {
    method: 'POST',
    body: JSON.stringify({ email, role: role ?? 'MEMBER' }),
  });
  return { uid: data.uid, username: data.username, email: data.email, role: data.role };
}

export async function removeTeamMember(creds, teamId, userId) {
  await vFetch(
    `/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
    creds,
    { method: 'DELETE' },
  );
  return { removed: true };
}

// ─── Checks ───────────────────────────────────────────────────────────────────

export async function listDeploymentChecks(creds, deploymentId) {
  const q = teamQuery(creds);
  const data = await vFetch(
    `/v1/deployments/${encodeURIComponent(deploymentId)}/checks${q}`,
    creds,
  );
  return (data.checks ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    conclusion: c.conclusion,
    createdAt: c.createdAt,
    completedAt: c.completedAt,
    detailsUrl: c.detailsUrl,
  }));
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export async function listWebhooks(creds) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/webhooks${q}`, creds);
  return (Array.isArray(data) ? data : (data.webhooks ?? [])).map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    createdAt: w.createdAt,
  }));
}

export async function createWebhook(creds, { url, events }) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/webhooks${q}`, creds, {
    method: 'POST',
    body: JSON.stringify({ url, events }),
  });
  return { id: data.id, url: data.url, events: data.events };
}

export async function deleteWebhook(creds, webhookId) {
  const q = teamQuery(creds);
  await vFetch(`/v1/webhooks/${encodeURIComponent(webhookId)}${q}`, creds, { method: 'DELETE' });
  return { deleted: true };
}

// ─── Log Drains ───────────────────────────────────────────────────────────────

export async function listLogDrains(creds) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v3/integrations/log-drains${q}`, creds);
  return (Array.isArray(data) ? data : (data.logDrains ?? [])).map((d) => ({
    id: d.id,
    name: d.name,
    url: d.url,
    sources: d.sources,
    createdAt: d.createdAt,
  }));
}

export async function createLogDrain(creds, { name, url, sources, projectIds }) {
  const q = teamQuery(creds);
  const body = { name, url, sources: sources ?? ['lambda', 'static', 'edge', 'build'] };
  if (projectIds?.length) body.projectIds = projectIds;
  const data = await vFetch(`/v3/integrations/log-drains${q}`, creds, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { id: data.id, name: data.name, url: data.url };
}

export async function deleteLogDrain(creds, logDrainId) {
  const q = teamQuery(creds);
  await vFetch(`/v3/integrations/log-drains/${encodeURIComponent(logDrainId)}${q}`, creds, {
    method: 'DELETE',
  });
  return { deleted: true };
}

// ─── Edge Config ──────────────────────────────────────────────────────────────

export async function listEdgeConfigs(creds) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/edge-config${q}`, creds);
  return (Array.isArray(data) ? data : (data.items ?? [])).map((e) => ({
    id: e.id,
    slug: e.slug,
    digest: e.digest,
    itemCount: e.itemCount,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
}

export async function getEdgeConfigItems(creds, edgeConfigId) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/edge-config/${encodeURIComponent(edgeConfigId)}/items${q}`, creds);
  return Array.isArray(data) ? data : (data.items ?? []);
}

export async function createEdgeConfig(creds, slug) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/edge-config${q}`, creds, {
    method: 'POST',
    body: JSON.stringify({ slug }),
  });
  return { id: data.id, slug: data.slug, createdAt: data.createdAt };
}

export async function deleteEdgeConfig(creds, edgeConfigId) {
  const q = teamQuery(creds);
  await vFetch(`/v1/edge-config/${encodeURIComponent(edgeConfigId)}${q}`, creds, {
    method: 'DELETE',
  });
  return { deleted: true };
}

export async function updateEdgeConfigItems(creds, edgeConfigId, items) {
  // items: array of { operation: 'upsert'|'delete', key, value? }
  const q = teamQuery(creds);
  const data = await vFetch(
    `/v1/edge-config/${encodeURIComponent(edgeConfigId)}/items${q}`,
    creds,
    { method: 'PATCH', body: JSON.stringify({ items }) },
  );
  return { status: data.status ?? 'ok' };
}

// ─── Firewall ─────────────────────────────────────────────────────────────────

export async function getFirewallConfig(creds, projectId) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/security/firewall/config${q}&projectId=${projectId}`, creds);
  return data;
}

export async function updateFirewallConfig(creds, projectId, firewallConfig) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/security/firewall/config${q}&projectId=${projectId}`, creds, {
    method: 'PUT',
    body: JSON.stringify(firewallConfig),
  });
  return data;
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export async function listIntegrations(creds) {
  const q = teamQuery(creds);
  const data = await vFetch(`/v1/integrations/configurations${q}`, creds);
  return (data.configurations ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    projects: c.projects,
  }));
}

export async function deleteIntegration(creds, integrationId) {
  const q = teamQuery(creds);
  await vFetch(`/v1/integrations/configurations/${encodeURIComponent(integrationId)}${q}`, creds, {
    method: 'DELETE',
  });
  return { deleted: true };
}
