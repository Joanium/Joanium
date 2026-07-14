import { mapBucket } from './Utils.js';
import { tryParseJson } from '../../../../../Shared/Utils/AsyncUtils.js';

const BASE = 'https://api.supabase.com/v1';

function headers(creds) {
  return { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' };
}

async function sbFetch(path, creds, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(creds), ...options });
  if (!res.ok) {
    const data = await tryParseJson(res);
    throw new Error(data.message ?? `Supabase API error: ${res.status}`);
  }
  return res.json();
}

// ─── Projects & Organisations ────────────────────────────────────────────────

export async function listProjects(creds) {
  const projects = await sbFetch('/projects', creds);
  return (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    ref: p.ref,
    region: p.region,
    status: p.status,
    organizationId: p.organization_id,
    createdAt: p.created_at,
  }));
}

export async function getProject(creds, projectRef) {
  const p = await sbFetch(`/projects/${projectRef}`, creds);
  return {
    id: p.id,
    name: p.name,
    ref: p.ref,
    region: p.region,
    status: p.status,
    organizationId: p.organization_id,
    createdAt: p.created_at,
    dbHost: p.db_host,
    dbPort: p.db_port,
    dbName: p.db_name,
    dbUser: p.db_user,
  };
}

export async function getProjectHealth(creds, projectRef) {
  const health = await sbFetch(`/projects/${projectRef}/health`, creds);
  return (health ?? []).map((h) => ({
    name: h.name,
    status: h.status,
    error: h.error ?? null,
  }));
}

export async function listOrganizations(creds) {
  const orgs = await sbFetch('/organizations', creds);
  return (orgs ?? []).map((o) => ({ id: o.id, name: o.name, slug: o.slug }));
}

export async function getOrganization(creds, orgSlug) {
  const o = await sbFetch(`/organizations/${orgSlug}`, creds);
  return { id: o.id, name: o.name, slug: o.slug };
}

// ─── Database ────────────────────────────────────────────────────────────────

export async function listSchemas(creds, projectRef, { includeSystemSchemas = false } = {}) {
  const params = new URLSearchParams({ include_system_schemas: includeSystemSchemas });
  const schemas = await sbFetch(`/projects/${projectRef}/database/schemas?${params}`, creds);
  return (schemas ?? []).map((s) => ({ name: s.name, owner: s.owner }));
}

export async function listTables(
  creds,
  projectRef,
  { schema = 'public', includeSystemSchemas = false } = {},
) {
  const params = new URLSearchParams({
    included_schemas: schema,
    include_system_schemas: includeSystemSchemas,
  });
  const tables = await sbFetch(`/projects/${projectRef}/database/tables?${params}`, creds);
  return (tables ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    schema: t.schema,
    rowCount: t.live_rows_estimate ?? null,
    bytesTotal: t.bytes ?? null,
    replicaIdentity: t.replica_identity,
    isPartitioned: t.is_partitioned,
    comment: t.comment ?? null,
  }));
}

export async function listColumns(creds, projectRef, { schema = 'public', table } = {}) {
  const params = new URLSearchParams({ included_schemas: schema });
  if (table) params.set('table', table);
  const cols = await sbFetch(`/projects/${projectRef}/database/columns?${params}`, creds);
  return (cols ?? []).map((c) => ({
    tableId: c.table_id,
    tableName: c.table,
    schema: c.schema,
    name: c.name,
    ordinalPosition: c.ordinal_position,
    dataType: c.data_type,
    defaultValue: c.default_value ?? null,
    isNullable: c.is_nullable,
    isIdentity: c.is_identity,
    isPrimaryKey: c.is_primary_key,
    isUnique: c.is_unique,
    comment: c.comment ?? null,
  }));
}

export async function listViews(
  creds,
  projectRef,
  { schema = 'public', includeSystemSchemas = false } = {},
) {
  const params = new URLSearchParams({
    included_schemas: schema,
    include_system_schemas: includeSystemSchemas,
  });
  const views = await sbFetch(`/projects/${projectRef}/database/views?${params}`, creds);
  return (views ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    schema: v.schema,
    isUpdatable: v.is_updatable,
    comment: v.comment ?? null,
  }));
}

export async function listExtensions(creds, projectRef) {
  const exts = await sbFetch(`/projects/${projectRef}/database/extensions`, creds);
  return (exts ?? []).map((e) => ({
    name: e.name,
    schema: e.schema ?? null,
    defaultVersion: e.default_version,
    installedVersion: e.installed_version ?? null,
    comment: e.comment ?? null,
  }));
}

export async function listRoles(creds, projectRef, { includeSystemRoles = false } = {}) {
  const params = new URLSearchParams({ include_system_roles: includeSystemRoles });
  const roles = await sbFetch(`/projects/${projectRef}/database/roles?${params}`, creds);
  return (roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isReplicationRole: r.is_replication_role,
    canLogin: r.can_login,
    canCreateDb: r.can_create_db,
    canCreateRole: r.can_create_role,
    connectionLimit: r.connection_limit,
    config: r.config ?? null,
  }));
}

export async function listMigrations(creds, projectRef) {
  const migrations = await sbFetch(`/projects/${projectRef}/database/migrations`, creds);
  return (migrations ?? []).map((m) => ({
    version: m.version,
    name: m.name ?? null,
    insertedAt: m.inserted_at,
  }));
}

export async function listTriggers(
  creds,
  projectRef,
  { schema = 'public', includeSystemTriggers = false } = {},
) {
  const params = new URLSearchParams({
    included_schemas: schema,
    include_system_triggers: includeSystemTriggers,
  });
  const triggers = await sbFetch(`/projects/${projectRef}/database/triggers?${params}`, creds);
  return (triggers ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    schema: t.schema,
    table: t.table,
    functionName: t.function_name,
    functionSchema: t.function_schema,
    orientation: t.orientation,
    activation: t.activation,
    events: t.events,
    enabled: t.enabled_mode,
  }));
}

export async function listDbFunctions(
  creds,
  projectRef,
  { schema = 'public', includeSystemSchemas = false } = {},
) {
  const params = new URLSearchParams({
    included_schemas: schema,
    include_system_schemas: includeSystemSchemas,
  });
  const fns = await sbFetch(`/projects/${projectRef}/database/functions?${params}`, creds);
  return (fns ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    schema: f.schema,
    language: f.language,
    returnType: f.return_type,
    behavior: f.behavior,
    securityDefiner: f.security_definer,
    args: (f.args ?? []).map((a) => ({ name: a.name, type: a.type, mode: a.mode })),
    comment: f.comment ?? null,
  }));
}

export async function listIndexes(creds, projectRef, { schema = 'public' } = {}) {
  const params = new URLSearchParams({ included_schemas: schema });
  const indexes = await sbFetch(`/projects/${projectRef}/database/indexes?${params}`, creds);
  return (indexes ?? []).map((i) => ({
    name: i.name,
    schema: i.schema,
    tableName: i.table_name,
    accessMethod: i.access_method,
    isUnique: i.is_unique,
    isPrimary: i.is_primary,
    isValid: i.is_valid,
    definition: i.index_definition,
  }));
}

export async function runQuery(creds, projectRef, query) {
  const result = await sbFetch(`/projects/${projectRef}/database/query`, creds, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  return result ?? [];
}

// ─── Edge Functions ──────────────────────────────────────────────────────────

export async function listFunctions(creds, projectRef) {
  const fns = await sbFetch(`/projects/${projectRef}/functions`, creds);
  return (fns ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    status: f.status,
    verifyJwt: f.verify_jwt,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));
}

export async function getFunction(creds, projectRef, functionSlug) {
  const f = await sbFetch(`/projects/${projectRef}/functions/${functionSlug}`, creds);
  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    status: f.status,
    verifyJwt: f.verify_jwt,
    importMap: f.import_map,
    entrypointPath: f.entrypoint_path,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    version: f.version,
  };
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function listBuckets(creds, projectRef) {
  const buckets = await sbFetch(`/projects/${projectRef}/storage/buckets`, creds);
  return (buckets ?? []).map(mapBucket);
}

export async function getBucket(creds, projectRef, bucketId) {
  const b = await sbFetch(`/projects/${projectRef}/storage/buckets/${bucketId}`, creds);
  return mapBucket(b);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function listAuthUsers(creds, projectRef, { page = 1, perPage = 50, keywords } = {}) {
  const params = new URLSearchParams({ page, per_page: perPage });
  if (keywords) params.set('keywords', keywords);
  const data = await sbFetch(`/projects/${projectRef}/auth/users?${params}`, creds);
  const users = data?.users ?? data ?? [];
  return users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    phone: u.phone ?? null,
    role: u.role,
    provider: u.app_metadata?.provider ?? null,
    confirmedAt: u.confirmed_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    createdAt: u.created_at,
    bannedUntil: u.banned_until ?? null,
  }));
}

export async function getAuthConfig(creds, projectRef) {
  const cfg = await sbFetch(`/projects/${projectRef}/config/auth`, creds);
  return {
    siteUrl: cfg.site_url,
    jwtExpiry: cfg.jwt_exp,
    enableSignup: cfg.enable_signup,
    enableAnonymousSignins: cfg.enable_anonymous_sign_ins,
    mailerSecure: cfg.mailer_secure_email_change_enabled,
    externalProviders: {
      google: cfg.external_google_enabled,
      github: cfg.external_github_enabled,
      facebook: cfg.external_facebook_enabled,
      twitter: cfg.external_twitter_enabled,
      discord: cfg.external_discord_enabled,
      slack: cfg.external_slack_oidc_enabled,
      apple: cfg.external_apple_enabled,
    },
  };
}

// ─── API / PostgREST Config ───────────────────────────────────────────────────

export async function getPostgRESTConfig(creds, projectRef) {
  const cfg = await sbFetch(`/projects/${projectRef}/config/postgrest`, creds);
  return {
    dbSchema: cfg.db_schema,
    dbExtraSearchPath: cfg.db_extra_search_path,
    maxRows: cfg.max_rows,
    dbPool: cfg.db_pool,
  };
}

export async function getApiSettings(creds, projectRef) {
  const cfg = await sbFetch(`/projects/${projectRef}/api`, creds);
  return {
    serviceApiKey: cfg.service_api_key ?? null,
    anonKey: cfg.anon_key ?? null,
    apiUrl: cfg.url ?? null,
  };
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

export async function listSecrets(creds, projectRef) {
  const secrets = await sbFetch(`/projects/${projectRef}/secrets`, creds);
  return (secrets ?? []).map((s) => ({
    name: s.name,
    // value intentionally omitted for security
  }));
}

// ─── Custom Domains ───────────────────────────────────────────────────────────

export async function getCustomHostname(creds, projectRef) {
  const data = await sbFetch(`/projects/${projectRef}/custom-hostname`, creds);
  return {
    customHostname: data.custom_hostname ?? null,
    status: data.status ?? null,
    data: data.data ?? null,
  };
}

// ─── Network Restrictions ────────────────────────────────────────────────────

export async function getNetworkRestrictions(creds, projectRef) {
  const data = await sbFetch(`/projects/${projectRef}/network-restrictions`, creds);
  return {
    allowedCidrs: data.config?.dbAllowedCidrs ?? [],
    enforcementState: data.enforcement_state ?? null,
    applied: data.old_db_allowed_cidrs !== undefined,
  };
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export async function getLogs(creds, projectRef, { service = 'api', limit = 50 } = {}) {
  const params = new URLSearchParams({ project: projectRef, limit });

  // Map friendly service names to Supabase log collection identifiers
  const collectionMap = {
    api: 'edge_logs',
    auth: 'auth_logs',
    storage: 'storage_logs',
    realtime: 'realtime_logs',
    postgres: 'postgres_logs',
    functions: 'function_edge_logs',
  };
  const collection = collectionMap[service] ?? service;
  params.set('collection', collection);

  const data = await sbFetch(
    `/projects/${projectRef}/analytics/endpoints/logs.all?${params}`,
    creds,
  );
  return (data?.result ?? []).map((r) => ({
    timestamp: r.timestamp,
    event: r.event_message ?? r.metadata?.status ?? null,
    level: r.metadata?.level ?? null,
    method: r.metadata?.method ?? null,
    path: r.metadata?.path ?? null,
    statusCode: r.metadata?.status_code ?? null,
  }));
}
