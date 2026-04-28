import defineFeature from '../../Core/DefineFeature.js';
import * as SupabaseAPI from './API/SupabaseAPI.js';
import { getSupabaseCredentials, withSupabase } from './Shared/Common.js';
import { SUPABASE_TOOLS } from './Chat/Tools.js';
import { executeSupabaseChatTool } from './Chat/ChatExecutor.js';
import {
  supabaseDataSourceCollectors,
  supabaseOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default defineFeature({
  id: 'supabase',
  name: 'Supabase',

  connectors: {
    services: [
      {
        id: 'supabase',
        name: 'Supabase',
        icon: '<img src="../../../Assets/Icons/Supabase.png" alt="Supabase" class="connector-icon-img" />',
        description: 'Monitor your Supabase projects, databases, and edge functions from chat.',
        helpUrl: 'https://supabase.com/dashboard/account/tokens',
        helpText: 'Create an Access Token →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to supabase.com → Dashboard → Account → Access Tokens',
          'Click "Generate new token" and give it a name',
          'Copy the generated token below',
        ],
        capabilities: [
          'List all Supabase projects with region and status',
          'Inspect database schemas, tables, columns, views, indexes, triggers, and functions',
          'Run SQL queries against any project database',
          'List and inspect edge functions',
          'View storage buckets and configuration',
          'Inspect auth users and OAuth provider settings',
          'Check API settings, PostgREST config, secrets, and network restrictions',
          'Tail recent logs across api, auth, storage, postgres, realtime, and functions services',
          'Monitor project health via automations',
          'AI is aware of your full Supabase environment',
        ],
        fields: [
          {
            key: 'token',
            label: 'Access Token',
            placeholder: 'sbp_...',
            type: 'password',
            hint: 'Create at supabase.com/dashboard/account/tokens.',
          },
        ],
        automations: [
          {
            name: 'Project Status',
            description: 'Daily — report Supabase project statuses and flag any issues',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('supabase');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const projects = await SupabaseAPI.listProjects(creds);
            return { ok: true, projectCount: projects.length };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      // ── Projects & Orgs ────────────────────────────────────────────────────
      listProjects: (ctx) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          projects: await SupabaseAPI.listProjects(creds),
        })),
      getProject: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          project: await SupabaseAPI.getProject(creds, projectRef),
        })),
      getProjectHealth: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          health: await SupabaseAPI.getProjectHealth(creds, projectRef),
        })),
      listOrganizations: (ctx) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          organizations: await SupabaseAPI.listOrganizations(creds),
        })),
      getOrganization: (ctx, { orgSlug }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          organization: await SupabaseAPI.getOrganization(creds, orgSlug),
        })),

      // ── Database ───────────────────────────────────────────────────────────
      listSchemas: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          schemas: await SupabaseAPI.listSchemas(creds, opts.projectRef, opts),
        })),
      listTables: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          tables: await SupabaseAPI.listTables(creds, opts.projectRef, opts),
        })),
      listColumns: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          columns: await SupabaseAPI.listColumns(creds, opts.projectRef, opts),
        })),
      listViews: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          views: await SupabaseAPI.listViews(creds, opts.projectRef, opts),
        })),
      listExtensions: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          extensions: await SupabaseAPI.listExtensions(creds, projectRef),
        })),
      listRoles: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          roles: await SupabaseAPI.listRoles(creds, opts.projectRef, opts),
        })),
      listMigrations: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          migrations: await SupabaseAPI.listMigrations(creds, projectRef),
        })),
      listTriggers: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          triggers: await SupabaseAPI.listTriggers(creds, opts.projectRef, opts),
        })),
      listDbFunctions: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          functions: await SupabaseAPI.listDbFunctions(creds, opts.projectRef, opts),
        })),
      listIndexes: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          indexes: await SupabaseAPI.listIndexes(creds, opts.projectRef, opts),
        })),
      runQuery: (ctx, { projectRef, query }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          rows: await SupabaseAPI.runQuery(creds, projectRef, query),
        })),

      // ── Edge Functions ─────────────────────────────────────────────────────
      listFunctions: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          functions: await SupabaseAPI.listFunctions(creds, projectRef),
        })),
      getFunction: (ctx, { projectRef, functionSlug }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          function: await SupabaseAPI.getFunction(creds, projectRef, functionSlug),
        })),

      // ── Storage ────────────────────────────────────────────────────────────
      listBuckets: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          buckets: await SupabaseAPI.listBuckets(creds, projectRef),
        })),
      getBucket: (ctx, { projectRef, bucketId }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          bucket: await SupabaseAPI.getBucket(creds, projectRef, bucketId),
        })),

      // ── Auth ───────────────────────────────────────────────────────────────
      listAuthUsers: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          users: await SupabaseAPI.listAuthUsers(creds, opts.projectRef, opts),
        })),
      getAuthConfig: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          config: await SupabaseAPI.getAuthConfig(creds, projectRef),
        })),

      // ── API / Config ───────────────────────────────────────────────────────
      getPostgRESTConfig: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          config: await SupabaseAPI.getPostgRESTConfig(creds, projectRef),
        })),
      getApiSettings: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          settings: await SupabaseAPI.getApiSettings(creds, projectRef),
        })),

      // ── Secrets / Domains / Network ────────────────────────────────────────
      listSecrets: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          secrets: await SupabaseAPI.listSecrets(creds, projectRef),
        })),
      getCustomHostname: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          hostname: await SupabaseAPI.getCustomHostname(creds, projectRef),
        })),
      getNetworkRestrictions: (ctx, { projectRef }) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          restrictions: await SupabaseAPI.getNetworkRestrictions(creds, projectRef),
        })),

      // ── Logs ───────────────────────────────────────────────────────────────
      getLogs: (ctx, opts) =>
        withSupabase(ctx, async (creds) => ({
          ok: true,
          logs: await SupabaseAPI.getLogs(creds, opts.projectRef, opts),
        })),

      // ── Chat Tool Executor ─────────────────────────────────────────────────
      executeChatTool: (ctx, { toolName, params }) =>
        executeSupabaseChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: SUPABASE_TOOLS },

  automation: {
    dataSources: [{ value: 'supabase_projects', label: 'Supabase - Projects', group: 'Supabase' }],
    outputTypes: [],
    instructionTemplates: {
      supabase_projects:
        'Review these Supabase projects. Summarize their status, flag any that are inactive or paused, and note any concerns.',
    },
    dataSourceCollectors: supabaseDataSourceCollectors,
    outputHandlers: supabaseOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getSupabaseCredentials(ctx);
      if (!creds) return null;
      return {
        connectedServices: ['Supabase'],
        sections: [
          `Supabase is connected. You have access to the following tools:

**Projects & Organisations**
- supabase_list_projects — list all projects
- supabase_get_project — get details for a specific project (requires projectRef)
- supabase_get_project_health — check health of all services for a project
- supabase_list_organizations — list all organisations
- supabase_get_organization — get details for an organisation (requires orgSlug)

**Database**
- supabase_list_schemas — list database schemas
- supabase_list_tables — list tables in a schema
- supabase_list_columns — list columns for a table or schema
- supabase_list_views — list database views
- supabase_list_extensions — list installed/available PostgreSQL extensions
- supabase_list_roles — list database roles
- supabase_list_migrations — list migration history
- supabase_list_triggers — list database triggers
- supabase_list_db_functions — list stored functions/procedures
- supabase_list_indexes — list table indexes
- supabase_run_query — run a SQL query and return results

**Edge Functions**
- supabase_list_functions — list all edge functions
- supabase_get_function — get details of a specific edge function

**Storage**
- supabase_list_buckets — list storage buckets
- supabase_get_bucket — get details of a specific bucket

**Auth**
- supabase_list_auth_users — list authenticated users (supports search & pagination)
- supabase_get_auth_config — get auth settings and enabled OAuth providers

**API & Configuration**
- supabase_get_postgrest_config — get PostgREST API settings
- supabase_get_api_settings — get project URL and API keys

**Secrets, Domains & Network**
- supabase_list_secrets — list edge function secret names
- supabase_get_custom_hostname — get custom domain configuration
- supabase_get_network_restrictions — get allowed IP restrictions

**Logs**
- supabase_get_logs — fetch recent logs for api, auth, storage, postgres, realtime, or functions`,
        ],
      };
    },
  },
});
