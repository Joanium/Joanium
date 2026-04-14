import * as VercelAPI from '../API/VercelAPI.js';
import { getVercelCredentials, notConnected } from '../Shared/Common.js';

export async function executeVercelChatTool(ctx, toolName, params) {
  const creds = getVercelCredentials(ctx);
  if (!creds) return notConnected();

  try {
    // ─── Projects ────────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_projects') {
      const projects = await VercelAPI.listProjects(creds);
      return { ok: true, projects };
    }

    if (toolName === 'vercel_get_project') {
      const project = await VercelAPI.getProject(creds, params.idOrName);
      return { ok: true, project };
    }

    if (toolName === 'vercel_create_project') {
      const project = await VercelAPI.createProject(creds, {
        name: params.name,
        framework: params.framework,
        gitRepo: params.gitRepo,
      });
      return { ok: true, project };
    }

    if (toolName === 'vercel_update_project') {
      const project = await VercelAPI.updateProject(creds, params.idOrName, params.updates);
      return { ok: true, project };
    }

    if (toolName === 'vercel_delete_project') {
      const result = await VercelAPI.deleteProject(creds, params.idOrName);
      return { ok: true, ...result };
    }

    // ─── Deployments ─────────────────────────────────────────────────────────
    if (toolName === 'vercel_get_deployment') {
      const deployment = await VercelAPI.getDeployment(creds, params.deploymentId);
      return { ok: true, deployment };
    }

    if (toolName === 'vercel_cancel_deployment') {
      const result = await VercelAPI.cancelDeployment(creds, params.deploymentId);
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_redeploy') {
      const deployment = await VercelAPI.redeployDeployment(creds, params.deploymentId);
      return { ok: true, deployment };
    }

    if (toolName === 'vercel_get_deployment_logs') {
      const events = await VercelAPI.getDeploymentEvents(creds, params.deploymentId);
      return { ok: true, events };
    }

    if (toolName === 'vercel_list_deployment_checks') {
      const checks = await VercelAPI.listDeploymentChecks(creds, params.deploymentId);
      return { ok: true, checks };
    }

    // ─── Domains ─────────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_domains') {
      const domains = await VercelAPI.listDomains(creds);
      return { ok: true, domains };
    }

    if (toolName === 'vercel_get_domain') {
      const domain = await VercelAPI.getDomain(creds, params.domain);
      return { ok: true, domain };
    }

    if (toolName === 'vercel_list_project_domains') {
      const domains = await VercelAPI.listProjectDomains(creds, params.projectId);
      return { ok: true, domains };
    }

    if (toolName === 'vercel_add_project_domain') {
      const result = await VercelAPI.addProjectDomain(creds, params.projectId, params.domain);
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_remove_project_domain') {
      const result = await VercelAPI.removeProjectDomain(creds, params.projectId, params.domain);
      return { ok: true, ...result };
    }

    // ─── Environment Variables ────────────────────────────────────────────────
    if (toolName === 'vercel_list_env_vars') {
      const envs = await VercelAPI.listEnvVars(creds, params.projectId);
      return { ok: true, envs };
    }

    if (toolName === 'vercel_create_env_var') {
      const env = await VercelAPI.createEnvVar(creds, params.projectId, {
        key: params.key,
        value: params.value,
        target: params.target,
        type: params.type,
      });
      return { ok: true, env };
    }

    if (toolName === 'vercel_update_env_var') {
      const env = await VercelAPI.updateEnvVar(creds, params.projectId, params.envId, {
        value: params.value,
        target: params.target,
      });
      return { ok: true, env };
    }

    if (toolName === 'vercel_delete_env_var') {
      const result = await VercelAPI.deleteEnvVar(creds, params.projectId, params.envId);
      return { ok: true, ...result };
    }

    // ─── Aliases ─────────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_aliases') {
      const aliases = await VercelAPI.listAliases(creds, params.limit);
      return { ok: true, aliases };
    }

    if (toolName === 'vercel_delete_alias') {
      const result = await VercelAPI.deleteAlias(creds, params.aliasId);
      return { ok: true, ...result };
    }

    // ─── Secrets ─────────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_secrets') {
      const secrets = await VercelAPI.listSecrets(creds);
      return { ok: true, secrets };
    }

    // ─── Teams ───────────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_teams') {
      const teams = await VercelAPI.listTeams(creds);
      return { ok: true, teams };
    }

    if (toolName === 'vercel_get_team') {
      const team = await VercelAPI.getTeam(creds, params.teamId);
      return { ok: true, team };
    }

    if (toolName === 'vercel_list_team_members') {
      const members = await VercelAPI.listTeamMembers(creds, params.teamId);
      return { ok: true, members };
    }

    // ─── Webhooks ────────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_webhooks') {
      const webhooks = await VercelAPI.listWebhooks(creds);
      return { ok: true, webhooks };
    }

    if (toolName === 'vercel_create_webhook') {
      const webhook = await VercelAPI.createWebhook(creds, {
        url: params.url,
        events: params.events,
      });
      return { ok: true, webhook };
    }

    if (toolName === 'vercel_delete_webhook') {
      const result = await VercelAPI.deleteWebhook(creds, params.webhookId);
      return { ok: true, ...result };
    }

    // ─── Edge Config ─────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_edge_configs') {
      const edgeConfigs = await VercelAPI.listEdgeConfigs(creds);
      return { ok: true, edgeConfigs };
    }

    if (toolName === 'vercel_get_edge_config_items') {
      const items = await VercelAPI.getEdgeConfigItems(creds, params.edgeConfigId);
      return { ok: true, items };
    }

    // ─── Log Drains ──────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_log_drains') {
      const logDrains = await VercelAPI.listLogDrains(creds);
      return { ok: true, logDrains };
    }

    // ─── User ────────────────────────────────────────────────────────────────
    if (toolName === 'vercel_get_user') {
      const user = await VercelAPI.getUser(creds);
      return { ok: true, user };
    }

    return null;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
