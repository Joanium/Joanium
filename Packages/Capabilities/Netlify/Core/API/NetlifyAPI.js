import { netlifyRequest } from './Request.js';

function nFetch(path, creds, options = {}) {
  return netlifyRequest(path, creds, options);
}

// ── User ───────────────────────────────────────────────────────────────────

export async function getUser(creds) {
  return nFetch('/user', creds);
}

// NEW (1) — get the authenticated user profile
export async function getCurrentUser(creds) {
  return nFetch('/user', creds);
}

// ── Sites ──────────────────────────────────────────────────────────────────

export async function listSites(creds) {
  const sites = await nFetch('/sites?per_page=50', creds);
  return (sites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    adminUrl: s.admin_url,
    publishedDeploy: s.published_deploy?.state ?? 'unknown',
    updatedAt: s.updated_at,
    customDomain: s.custom_domain ?? null,
  }));
}

export async function getSite(creds, siteId) {
  return nFetch(`/sites/${siteId}`, creds);
}

export async function updateSite(creds, siteId, body) {
  return nFetch(`/sites/${siteId}`, creds, { method: 'PATCH', body: body });
}

export async function deleteSite(creds, siteId) {
  return nFetch(`/sites/${siteId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

export async function listSiteFiles(creds, siteId) {
  return nFetch(`/sites/${siteId}/files`, creds);
}

// NEW (2) — create a new site
export async function createSite(creds, body) {
  return nFetch('/sites', creds, { method: 'POST', body: body });
}

// NEW (3) — create a site inside a specific team/account
export async function createSiteInTeam(creds, accountId, body) {
  return nFetch(`/accounts/${accountId}/sites`, creds, { method: 'POST', body: body });
}

// NEW (4) — purge the CDN cache for a site
export async function purgeSiteCache(creds, siteId) {
  return nFetch(`/sites/${siteId}/purge`, creds, {
    method: 'POST',
    successValue: { purged: true },
  });
}

// NEW (5) — list Netlify Functions deployed on a site
export async function listSiteFunctions(creds, siteId) {
  return nFetch(`/sites/${siteId}/functions`, creds);
}

// NEW (6) — list service instances (installed plugins) for a site
export async function listServiceInstances(creds, siteId) {
  return nFetch(`/sites/${siteId}/service-instances`, creds);
}

// ── Deploys ────────────────────────────────────────────────────────────────

export async function listDeploys(creds, siteId, limit = 10) {
  const deploys = await nFetch(`/sites/${siteId}/deploys?per_page=${limit}`, creds);
  return (deploys ?? []).map((d) => ({
    id: d.id,
    state: d.state,
    branch: d.branch,
    commitRef: d.commit_ref ?? null,
    commitUrl: d.commit_url ?? null,
    createdAt: d.created_at,
    errorMessage: d.error_message ?? null,
  }));
}

export async function listAllDeploys(creds, limit = 20) {
  const deploys = await nFetch(`/deploys?per_page=${limit}`, creds);
  return (deploys ?? []).map((d) => ({
    id: d.id,
    siteId: d.site_id,
    siteName: d.name,
    state: d.state,
    branch: d.branch,
    createdAt: d.created_at,
    errorMessage: d.error_message ?? null,
  }));
}

export async function getDeploy(creds, deployId) {
  return nFetch(`/deploys/${deployId}`, creds);
}

export async function listSiteDeploys(creds, siteId, limit = 10) {
  const deploys = await nFetch(`/sites/${siteId}/deploys?per_page=${limit}`, creds);
  return (deploys ?? []).map((d) => ({
    id: d.id,
    state: d.state,
    branch: d.branch,
    commitRef: d.commit_ref ?? null,
    createdAt: d.created_at,
    errorMessage: d.error_message ?? null,
  }));
}

export async function cancelDeploy(creds, deployId) {
  return nFetch(`/deploys/${deployId}/cancel`, creds, { method: 'POST' });
}

export async function restoreDeploy(creds, deployId) {
  return nFetch(`/deploys/${deployId}/restore`, creds, { method: 'POST' });
}

export async function triggerSiteBuild(creds, siteId, { clearCache = false } = {}) {
  return nFetch(`/sites/${siteId}/deploys`, creds, {
    method: 'POST',
    body: { clear_cache: clearCache },
  });
}

// NEW (7) — lock a deploy (keeps it as the live deploy permanently)
export async function lockDeploy(creds, deployId) {
  return nFetch(`/deploys/${deployId}/lock`, creds, { method: 'POST' });
}

// NEW (8) — unlock a previously locked deploy
export async function unlockDeploy(creds, deployId) {
  return nFetch(`/deploys/${deployId}/unlock`, creds, { method: 'POST' });
}

// NEW (9) — retry a failed deploy
export async function retryDeploy(creds, deployId) {
  return nFetch(`/deploys/${deployId}/retry`, creds, { method: 'POST' });
}

// ── Forms & Submissions ────────────────────────────────────────────────────

export async function listForms(creds, siteId) {
  return nFetch(`/sites/${siteId}/forms`, creds);
}

export async function listFormSubmissions(creds, formId, limit = 20) {
  return nFetch(`/forms/${formId}/submissions?per_page=${limit}`, creds);
}

export async function deleteSubmission(creds, submissionId) {
  return nFetch(`/submissions/${submissionId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// NEW (10) — delete an entire form
export async function deleteForm(creds, siteId, formId) {
  return nFetch(`/sites/${siteId}/forms/${formId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// ── Hooks (Notifications) ──────────────────────────────────────────────────

export async function listHooks(creds, siteId) {
  return nFetch(`/hooks?site_id=${siteId}`, creds);
}

export async function createHook(creds, body) {
  return nFetch('/hooks', creds, { method: 'POST', body: body });
}

export async function deleteHook(creds, hookId) {
  return nFetch(`/hooks/${hookId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// ── Build Hooks ────────────────────────────────────────────────────────────

export async function listBuildHooks(creds, siteId) {
  return nFetch(`/sites/${siteId}/build_hooks`, creds);
}

export async function createBuildHook(creds, siteId, { title, branch }) {
  return nFetch(`/sites/${siteId}/build_hooks`, creds, {
    method: 'POST',
    body: { title, branch },
  });
}

export async function deleteBuildHook(creds, siteId, buildHookId) {
  return nFetch(`/sites/${siteId}/build_hooks/${buildHookId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

export async function triggerBuildHook(_creds, buildHookId) {
  const res = await fetch(`https://api.netlify.com/build_hooks/${buildHookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Build hook trigger failed: ${res.status}`);
  return { triggered: true };
}

// ── Environment Variables ──────────────────────────────────────────────────

export async function listEnvVars(creds, siteId) {
  return nFetch(`/sites/${siteId}/env`, creds);
}

export async function updateEnvVars(creds, siteId, vars) {
  return nFetch(`/sites/${siteId}/env`, creds, { method: 'PATCH', body: vars });
}

export async function deleteEnvVar(creds, siteId, key) {
  return nFetch(`/sites/${siteId}/env/${encodeURIComponent(key)}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// ── DNS ────────────────────────────────────────────────────────────────────

export async function listDnsZones(creds) {
  return nFetch('/dns_zones', creds);
}

export async function listDnsRecords(creds, zoneId) {
  return nFetch(`/dns_zones/${zoneId}/dns_records`, creds);
}

export async function createDnsRecord(creds, zoneId, record) {
  return nFetch(`/dns_zones/${zoneId}/dns_records`, creds, { method: 'POST', body: record });
}

export async function deleteDnsRecord(creds, zoneId, recordId) {
  return nFetch(`/dns_zones/${zoneId}/dns_records/${recordId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// NEW (11) — get a single DNS zone by ID
export async function getDnsZone(creds, zoneId) {
  return nFetch(`/dns_zones/${zoneId}`, creds);
}

// NEW (12) — create a new DNS zone
export async function createDnsZone(creds, { name, accountId }) {
  return nFetch('/dns_zones', creds, {
    method: 'POST',
    body: { name, account_id: accountId },
  });
}

// NEW (13) — delete a DNS zone
export async function deleteDnsZone(creds, zoneId) {
  return nFetch(`/dns_zones/${zoneId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// NEW (14) — transfer a DNS zone to another account
export async function transferDnsZone(creds, zoneId, { transferAccountId, transferUserId }) {
  return nFetch(`/dns_zones/${zoneId}/transfer`, creds, {
    method: 'PUT',
    body: {
      transfer_account_id: transferAccountId,
      transfer_user_id: transferUserId,
    },
  });
}

// ── Accounts & Members ─────────────────────────────────────────────────────

export async function listAccounts(creds) {
  return nFetch('/accounts', creds);
}

export async function listMembers(creds, accountId) {
  return nFetch(`/accounts/${accountId}/members`, creds);
}

// NEW (15) — get a single account/team by ID
export async function getAccount(creds, accountId) {
  return nFetch(`/accounts/${accountId}`, creds);
}

// NEW (16) — update account settings
export async function updateAccount(creds, accountId, body) {
  return nFetch(`/accounts/${accountId}`, creds, { method: 'PUT', body: body });
}

// NEW (17) — invite a new member to a team
export async function inviteMember(creds, accountId, { email, role }) {
  return nFetch(`/accounts/${accountId}/members`, creds, {
    method: 'POST',
    body: { email, role },
  });
}

// NEW (18) — remove a member from a team
export async function removeMember(creds, accountId, memberId) {
  return nFetch(`/accounts/${accountId}/members/${memberId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// NEW (19) — fetch the audit log for an account
export async function listAuditLog(creds, accountId, limit = 30) {
  return nFetch(`/accounts/${accountId}/audit?per_page=${limit}`, creds);
}

// ── SSL ────────────────────────────────────────────────────────────────────

export async function getSsl(creds, siteId) {
  return nFetch(`/sites/${siteId}/ssl`, creds);
}

export async function provisionSsl(creds, siteId) {
  return nFetch(`/sites/${siteId}/ssl`, creds, { method: 'POST' });
}

// ── Snippets ───────────────────────────────────────────────────────────────

export async function listSnippets(creds, siteId) {
  return nFetch(`/sites/${siteId}/snippets`, creds);
}

// NEW (20) — create an HTML injection snippet
export async function createSnippet(
  creds,
  siteId,
  { title, generalContent, goalContent, position },
) {
  return nFetch(`/sites/${siteId}/snippets`, creds, {
    method: 'POST',
    body: {
      title,
      general: generalContent,
      goal: goalContent ?? null,
      position: position ?? 'head',
    },
  });
}

// NEW (21) — get a specific snippet
export async function getSnippet(creds, siteId, snippetId) {
  return nFetch(`/sites/${siteId}/snippets/${snippetId}`, creds);
}

// NEW (22) — update an existing snippet
export async function updateSnippet(creds, siteId, snippetId, body) {
  return nFetch(`/sites/${siteId}/snippets/${snippetId}`, creds, { method: 'PUT', body: body });
}

// NEW (23) — delete a snippet
export async function deleteSnippet(creds, siteId, snippetId) {
  return nFetch(`/sites/${siteId}/snippets/${snippetId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// ── Deploy Keys ────────────────────────────────────────────────────────────

// NEW (24) — list all deploy keys on the account
export async function listDeployKeys(creds) {
  return nFetch('/deploy_keys', creds);
}

// NEW (25) — create a new deploy key (SSH key pair for repo access)
export async function createDeployKey(creds) {
  return nFetch('/deploy_keys', creds, { method: 'POST', body: {} });
}

// NEW (26) — get a single deploy key by ID
export async function getDeployKey(creds, keyId) {
  return nFetch(`/deploy_keys/${keyId}`, creds);
}

// NEW (27) — delete a deploy key
export async function deleteDeployKey(creds, keyId) {
  return nFetch(`/deploy_keys/${keyId}`, creds, {
    method: 'DELETE',
    successValue: { deleted: true },
  });
}

// ── Split Tests (A/B Testing) ──────────────────────────────────────────────

// NEW (28) — list split tests for a site
export async function listSplitTests(creds, siteId) {
  return nFetch(`/sites/${siteId}/split_tests`, creds);
}

// NEW (29) — create a split test
export async function createSplitTest(creds, siteId, body) {
  return nFetch(`/sites/${siteId}/split_tests`, creds, { method: 'POST', body: body });
}

// NEW (30) — update (reconfigure) a split test
export async function updateSplitTest(creds, siteId, splitTestId, body) {
  return nFetch(`/sites/${siteId}/split_tests/${splitTestId}`, creds, {
    method: 'PUT',
    body: body,
  });
}

// NEW (31, bonus) — enable (publish) a split test
export async function enableSplitTest(creds, siteId, splitTestId) {
  return nFetch(`/sites/${siteId}/split_tests/${splitTestId}/publish`, creds, {
    method: 'POST',
  });
}

// NEW (32, bonus) — disable (unpublish) a split test
export async function disableSplitTest(creds, siteId, splitTestId) {
  return nFetch(`/sites/${siteId}/split_tests/${splitTestId}/unpublish`, creds, {
    method: 'POST',
  });
}
