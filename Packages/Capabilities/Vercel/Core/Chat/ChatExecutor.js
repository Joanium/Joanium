import * as VercelAPI from '../API/VercelAPI.js';
import { getVercelCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeVercelChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getVercelCredentials, notConnected, async (creds) => {
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

    if (toolName === 'vercel_pause_project') {
      const result = await VercelAPI.pauseProject(creds, params.idOrName);
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_unpause_project') {
      const result = await VercelAPI.unpauseProject(creds, params.idOrName);
      return { ok: true, ...result };
    }

    // ─── Deployments ─────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_deployments_by_project') {
      const deployments = await VercelAPI.listDeploymentsByProject(
        creds,
        params.projectId,
        params.limit,
      );
      return { ok: true, deployments };
    }

    if (toolName === 'vercel_get_deployment') {
      const deployment = await VercelAPI.getDeployment(creds, params.deploymentId);
      return { ok: true, deployment };
    }

    if (toolName === 'vercel_delete_deployment') {
      const result = await VercelAPI.deleteDeployment(creds, params.deploymentId);
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_cancel_deployment') {
      const result = await VercelAPI.cancelDeployment(creds, params.deploymentId);
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_redeploy') {
      const deployment = await VercelAPI.redeployDeployment(creds, params.deploymentId);
      return { ok: true, deployment };
    }

    if (toolName === 'vercel_promote_deployment') {
      const result = await VercelAPI.promoteDeployment(
        creds,
        params.projectId,
        params.deploymentId,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_get_deployment_logs') {
      const events = await VercelAPI.getDeploymentEvents(creds, params.deploymentId);
      return { ok: true, events };
    }

    if (toolName === 'vercel_get_deployment_files') {
      const files = await VercelAPI.getDeploymentFiles(creds, params.deploymentId);
      return { ok: true, files };
    }

    if (toolName === 'vercel_get_deployment_file_content') {
      const result = await VercelAPI.getDeploymentFileContent(
        creds,
        params.deploymentId,
        params.fileId,
      );
      return { ok: true, ...result };
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

    if (toolName === 'vercel_check_domain_availability') {
      const result = await VercelAPI.checkDomainAvailability(creds, params.domainName);
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_check_domain_price') {
      const result = await VercelAPI.checkDomainPrice(creds, params.domainName);
      return { ok: true, ...result };
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

    if (toolName === 'vercel_verify_project_domain') {
      const result = await VercelAPI.verifyProjectDomain(creds, params.projectId, params.domain);
      return { ok: true, ...result };
    }

    // ─── DNS Records ─────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_dns_records') {
      const records = await VercelAPI.listDnsRecords(creds, params.domain);
      return { ok: true, records };
    }

    if (toolName === 'vercel_create_dns_record') {
      const result = await VercelAPI.createDnsRecord(creds, params.domain, {
        type: params.type,
        name: params.name,
        value: params.value,
        ttl: params.ttl,
      });
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_delete_dns_record') {
      const result = await VercelAPI.deleteDnsRecord(creds, params.domain, params.recordId);
      return { ok: true, ...result };
    }

    // ─── Certificates ────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_certs') {
      const certs = await VercelAPI.listCerts(creds, params.domain);
      return { ok: true, certs };
    }

    if (toolName === 'vercel_issue_cert') {
      const cert = await VercelAPI.issueCert(creds, params.domains);
      return { ok: true, cert };
    }

    if (toolName === 'vercel_delete_cert') {
      const result = await VercelAPI.deleteCert(creds, params.certId);
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

    if (toolName === 'vercel_create_secret') {
      const secret = await VercelAPI.createSecret(creds, params.name, params.value);
      return { ok: true, secret };
    }

    if (toolName === 'vercel_rename_secret') {
      const secret = await VercelAPI.renameSecret(creds, params.nameOrId, params.newName);
      return { ok: true, secret };
    }

    if (toolName === 'vercel_delete_secret') {
      const result = await VercelAPI.deleteSecret(creds, params.nameOrId);
      return { ok: true, ...result };
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

    if (toolName === 'vercel_invite_team_member') {
      const member = await VercelAPI.inviteTeamMember(creds, params.teamId, {
        email: params.email,
        role: params.role,
      });
      return { ok: true, member };
    }

    if (toolName === 'vercel_remove_team_member') {
      const result = await VercelAPI.removeTeamMember(creds, params.teamId, params.userId);
      return { ok: true, ...result };
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

    // ─── Log Drains ──────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_log_drains') {
      const logDrains = await VercelAPI.listLogDrains(creds);
      return { ok: true, logDrains };
    }

    if (toolName === 'vercel_create_log_drain') {
      const logDrain = await VercelAPI.createLogDrain(creds, {
        name: params.name,
        url: params.url,
        sources: params.sources,
        projectIds: params.projectIds,
      });
      return { ok: true, logDrain };
    }

    if (toolName === 'vercel_delete_log_drain') {
      const result = await VercelAPI.deleteLogDrain(creds, params.logDrainId);
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

    if (toolName === 'vercel_create_edge_config') {
      const edgeConfig = await VercelAPI.createEdgeConfig(creds, params.slug);
      return { ok: true, edgeConfig };
    }

    if (toolName === 'vercel_delete_edge_config') {
      const result = await VercelAPI.deleteEdgeConfig(creds, params.edgeConfigId);
      return { ok: true, ...result };
    }

    if (toolName === 'vercel_update_edge_config_items') {
      const result = await VercelAPI.updateEdgeConfigItems(
        creds,
        params.edgeConfigId,
        params.items,
      );
      return { ok: true, ...result };
    }

    // ─── Firewall ────────────────────────────────────────────────────────────
    if (toolName === 'vercel_get_firewall_config') {
      const config = await VercelAPI.getFirewallConfig(creds, params.projectId);
      return { ok: true, config };
    }

    if (toolName === 'vercel_update_firewall_config') {
      const config = await VercelAPI.updateFirewallConfig(
        creds,
        params.projectId,
        params.firewallConfig,
      );
      return { ok: true, config };
    }

    // ─── Integrations ────────────────────────────────────────────────────────
    if (toolName === 'vercel_list_integrations') {
      const integrations = await VercelAPI.listIntegrations(creds);
      return { ok: true, integrations };
    }

    if (toolName === 'vercel_delete_integration') {
      const result = await VercelAPI.deleteIntegration(creds, params.integrationId);
      return { ok: true, ...result };
    }

    // ─── User ────────────────────────────────────────────────────────────────
    if (toolName === 'vercel_get_user') {
      const user = await VercelAPI.getUser(creds);
      return { ok: true, user };
    }

    return null;
  });
}
