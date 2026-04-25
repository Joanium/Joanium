import * as SupabaseAPI from '../API/SupabaseAPI.js';
import { getSupabaseCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeSupabaseChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getSupabaseCredentials, notConnected, async (creds) => {
    switch (toolName) {
      // ─── Projects & Organisations ─────────────────────────────────────────

      case 'supabase_list_projects': {
        const projects = await SupabaseAPI.listProjects(creds);
        return { ok: true, projects };
      }

      case 'supabase_get_project': {
        const project = await SupabaseAPI.getProject(creds, params.projectRef);
        return { ok: true, project };
      }

      case 'supabase_get_project_health': {
        const health = await SupabaseAPI.getProjectHealth(creds, params.projectRef);
        return { ok: true, health };
      }

      case 'supabase_list_organizations': {
        const organizations = await SupabaseAPI.listOrganizations(creds);
        return { ok: true, organizations };
      }

      case 'supabase_get_organization': {
        const organization = await SupabaseAPI.getOrganization(creds, params.orgSlug);
        return { ok: true, organization };
      }

      // ─── Database ─────────────────────────────────────────────────────────

      case 'supabase_list_schemas': {
        const schemas = await SupabaseAPI.listSchemas(creds, params.projectRef, {
          includeSystemSchemas: params.includeSystemSchemas ?? false,
        });
        return { ok: true, schemas };
      }

      case 'supabase_list_tables': {
        const tables = await SupabaseAPI.listTables(creds, params.projectRef, {
          schema: params.schema ?? 'public',
        });
        return { ok: true, tables };
      }

      case 'supabase_list_columns': {
        const columns = await SupabaseAPI.listColumns(creds, params.projectRef, {
          schema: params.schema ?? 'public',
          table: params.table,
        });
        return { ok: true, columns };
      }

      case 'supabase_list_views': {
        const views = await SupabaseAPI.listViews(creds, params.projectRef, {
          schema: params.schema ?? 'public',
        });
        return { ok: true, views };
      }

      case 'supabase_list_extensions': {
        const extensions = await SupabaseAPI.listExtensions(creds, params.projectRef);
        return { ok: true, extensions };
      }

      case 'supabase_list_roles': {
        const roles = await SupabaseAPI.listRoles(creds, params.projectRef, {
          includeSystemRoles: params.includeSystemRoles ?? false,
        });
        return { ok: true, roles };
      }

      case 'supabase_list_migrations': {
        const migrations = await SupabaseAPI.listMigrations(creds, params.projectRef);
        return { ok: true, migrations };
      }

      case 'supabase_list_triggers': {
        const triggers = await SupabaseAPI.listTriggers(creds, params.projectRef, {
          schema: params.schema ?? 'public',
        });
        return { ok: true, triggers };
      }

      case 'supabase_list_db_functions': {
        const functions = await SupabaseAPI.listDbFunctions(creds, params.projectRef, {
          schema: params.schema ?? 'public',
        });
        return { ok: true, functions };
      }

      case 'supabase_list_indexes': {
        const indexes = await SupabaseAPI.listIndexes(creds, params.projectRef, {
          schema: params.schema ?? 'public',
        });
        return { ok: true, indexes };
      }

      case 'supabase_run_query': {
        const rows = await SupabaseAPI.runQuery(creds, params.projectRef, params.query);
        return { ok: true, rows, rowCount: rows.length };
      }

      // ─── Edge Functions ───────────────────────────────────────────────────

      case 'supabase_list_functions': {
        const functions = await SupabaseAPI.listFunctions(creds, params.projectRef);
        return { ok: true, functions };
      }

      case 'supabase_get_function': {
        const fn = await SupabaseAPI.getFunction(creds, params.projectRef, params.functionSlug);
        return { ok: true, function: fn };
      }

      // ─── Storage ──────────────────────────────────────────────────────────

      case 'supabase_list_buckets': {
        const buckets = await SupabaseAPI.listBuckets(creds, params.projectRef);
        return { ok: true, buckets };
      }

      case 'supabase_get_bucket': {
        const bucket = await SupabaseAPI.getBucket(creds, params.projectRef, params.bucketId);
        return { ok: true, bucket };
      }

      // ─── Auth ─────────────────────────────────────────────────────────────

      case 'supabase_list_auth_users': {
        const users = await SupabaseAPI.listAuthUsers(creds, params.projectRef, {
          page: params.page ?? 1,
          perPage: params.perPage ?? 50,
          keywords: params.keywords,
        });
        return { ok: true, users, count: users.length };
      }

      case 'supabase_get_auth_config': {
        const config = await SupabaseAPI.getAuthConfig(creds, params.projectRef);
        return { ok: true, config };
      }

      // ─── API / PostgREST ──────────────────────────────────────────────────

      case 'supabase_get_postgrest_config': {
        const config = await SupabaseAPI.getPostgRESTConfig(creds, params.projectRef);
        return { ok: true, config };
      }

      case 'supabase_get_api_settings': {
        const settings = await SupabaseAPI.getApiSettings(creds, params.projectRef);
        return { ok: true, settings };
      }

      // ─── Secrets ──────────────────────────────────────────────────────────

      case 'supabase_list_secrets': {
        const secrets = await SupabaseAPI.listSecrets(creds, params.projectRef);
        return { ok: true, secrets };
      }

      // ─── Custom Domains ───────────────────────────────────────────────────

      case 'supabase_get_custom_hostname': {
        const hostname = await SupabaseAPI.getCustomHostname(creds, params.projectRef);
        return { ok: true, hostname };
      }

      // ─── Network ──────────────────────────────────────────────────────────

      case 'supabase_get_network_restrictions': {
        const restrictions = await SupabaseAPI.getNetworkRestrictions(creds, params.projectRef);
        return { ok: true, restrictions };
      }

      // ─── Logs ─────────────────────────────────────────────────────────────

      case 'supabase_get_logs': {
        const logs = await SupabaseAPI.getLogs(creds, params.projectRef, {
          service: params.service ?? 'api',
          limit: params.limit ?? 50,
        });
        return { ok: true, logs, count: logs.length };
      }

      default:
        return null;
    }
  });
}
