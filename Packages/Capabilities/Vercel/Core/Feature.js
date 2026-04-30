import defineFeature from '../../Core/DefineFeature.js';
import * as VercelAPI from './API/VercelAPI.js';
import { getVercelCredentials, withVercel } from './Shared/Common.js';
import { VERCEL_TOOLS } from './Chat/Tools.js';
import { executeVercelChatTool } from './Chat/ChatExecutor.js';
import {
  vercelDataSourceCollectors,
  vercelOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default defineFeature({
  id: 'vercel',
  name: 'Vercel',

  connectors: {
    services: [
      {
        id: 'vercel',
        name: 'Vercel',
        icon: '<img src="../../../Assets/Icons/Vercel.png" alt="Vercel" class="connector-icon-img" />',
        description: 'Monitor your Vercel projects, deployments, and domains from chat.',
        helpUrl: 'https://vercel.com/account/tokens',
        helpText: 'Create a Personal Access Token →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to vercel.com → Settings → Tokens',
          'Click "Create" and give the token a descriptive name',
          "Copy the token immediately — it won't be shown again",
        ],
        capabilities: [
          'List, create, update, pause and delete projects',
          'Inspect, promote, cancel, delete and redeploy deployments',
          'Browse deployment file trees and read file content',
          'Manage domains, DNS records, SSL certificates and verification',
          'Full env var, secret and alias management',
          'Invite and remove team members',
          'Create and delete webhooks, log drains and Edge Configs',
          'Read and update WAF firewall configuration',
          'Manage third-party integrations',
          'AI is aware of your Vercel environment via system prompt',
        ],
        fields: [
          {
            key: 'token',
            label: 'Personal Access Token',
            placeholder: 'Your Vercel access token',
            type: 'password',
            hint: 'Create at vercel.com/account/tokens. Only shown once when created.',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('vercel');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const user = await VercelAPI.getUser(creds);
            ctx.connectorEngine?.updateCredentials('vercel', {
              username: user.username ?? user.name ?? null,
            });
            return { ok: true, username: user.username ?? user.name };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      // ─── Projects ──────────────────────────────────────────────────────────
      listProjects: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          projects: await VercelAPI.listProjects(creds),
        })),

      getProject: (ctx, { idOrName }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          project: await VercelAPI.getProject(creds, idOrName),
        })),

      createProject: (ctx, { name, framework, gitRepo }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          project: await VercelAPI.createProject(creds, { name, framework, gitRepo }),
        })),

      updateProject: (ctx, { idOrName, updates }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          project: await VercelAPI.updateProject(creds, idOrName, updates),
        })),

      deleteProject: (ctx, { idOrName }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteProject(creds, idOrName)),
        })),

      pauseProject: (ctx, { idOrName }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.pauseProject(creds, idOrName)),
        })),

      unpauseProject: (ctx, { idOrName }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.unpauseProject(creds, idOrName)),
        })),

      // ─── Deployments ───────────────────────────────────────────────────────
      listDeployments: (ctx, { limit } = {}) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          deployments: await VercelAPI.listDeployments(creds, limit),
        })),

      listDeploymentsByProject: (ctx, { projectId, limit } = {}) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          deployments: await VercelAPI.listDeploymentsByProject(creds, projectId, limit),
        })),

      getDeployment: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          deployment: await VercelAPI.getDeployment(creds, deploymentId),
        })),

      deleteDeployment: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteDeployment(creds, deploymentId)),
        })),

      cancelDeployment: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.cancelDeployment(creds, deploymentId)),
        })),

      redeployDeployment: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          deployment: await VercelAPI.redeployDeployment(creds, deploymentId),
        })),

      promoteDeployment: (ctx, { projectId, deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.promoteDeployment(creds, projectId, deploymentId)),
        })),

      getDeploymentEvents: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          events: await VercelAPI.getDeploymentEvents(creds, deploymentId),
        })),

      getDeploymentFiles: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          files: await VercelAPI.getDeploymentFiles(creds, deploymentId),
        })),

      getDeploymentFileContent: (ctx, { deploymentId, fileId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.getDeploymentFileContent(creds, deploymentId, fileId)),
        })),

      listDeploymentChecks: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          checks: await VercelAPI.listDeploymentChecks(creds, deploymentId),
        })),

      // ─── Domains ───────────────────────────────────────────────────────────
      listDomains: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          domains: await VercelAPI.listDomains(creds),
        })),

      getDomain: (ctx, { domain }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          domain: await VercelAPI.getDomain(creds, domain),
        })),

      checkDomainAvailability: (ctx, { domainName }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.checkDomainAvailability(creds, domainName)),
        })),

      checkDomainPrice: (ctx, { domainName }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.checkDomainPrice(creds, domainName)),
        })),

      listProjectDomains: (ctx, { projectId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          domains: await VercelAPI.listProjectDomains(creds, projectId),
        })),

      addProjectDomain: (ctx, { projectId, domain }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.addProjectDomain(creds, projectId, domain)),
        })),

      removeProjectDomain: (ctx, { projectId, domain }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.removeProjectDomain(creds, projectId, domain)),
        })),

      verifyProjectDomain: (ctx, { projectId, domain }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.verifyProjectDomain(creds, projectId, domain)),
        })),

      // ─── DNS Records ───────────────────────────────────────────────────────
      listDnsRecords: (ctx, { domain }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          records: await VercelAPI.listDnsRecords(creds, domain),
        })),

      createDnsRecord: (ctx, { domain, type, name, value, ttl }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.createDnsRecord(creds, domain, { type, name, value, ttl })),
        })),

      deleteDnsRecord: (ctx, { domain, recordId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteDnsRecord(creds, domain, recordId)),
        })),

      // ─── Certificates ──────────────────────────────────────────────────────
      listCerts: (ctx, { domain } = {}) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          certs: await VercelAPI.listCerts(creds, domain),
        })),

      issueCert: (ctx, { domains }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          cert: await VercelAPI.issueCert(creds, domains),
        })),

      deleteCert: (ctx, { certId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteCert(creds, certId)),
        })),

      // ─── Environment Variables ─────────────────────────────────────────────
      listEnvVars: (ctx, { projectId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          envs: await VercelAPI.listEnvVars(creds, projectId),
        })),

      createEnvVar: (ctx, { projectId, key, value, target, type }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          env: await VercelAPI.createEnvVar(creds, projectId, { key, value, target, type }),
        })),

      updateEnvVar: (ctx, { projectId, envId, value, target }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          env: await VercelAPI.updateEnvVar(creds, projectId, envId, { value, target }),
        })),

      deleteEnvVar: (ctx, { projectId, envId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteEnvVar(creds, projectId, envId)),
        })),

      // ─── Aliases ───────────────────────────────────────────────────────────
      listAliases: (ctx, { limit } = {}) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          aliases: await VercelAPI.listAliases(creds, limit),
        })),

      deleteAlias: (ctx, { aliasId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteAlias(creds, aliasId)),
        })),

      // ─── Secrets ───────────────────────────────────────────────────────────
      listSecrets: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          secrets: await VercelAPI.listSecrets(creds),
        })),

      createSecret: (ctx, { name, value }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          secret: await VercelAPI.createSecret(creds, name, value),
        })),

      renameSecret: (ctx, { nameOrId, newName }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          secret: await VercelAPI.renameSecret(creds, nameOrId, newName),
        })),

      deleteSecret: (ctx, { nameOrId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteSecret(creds, nameOrId)),
        })),

      // ─── Teams ─────────────────────────────────────────────────────────────
      listTeams: (ctx) =>
        withVercel(ctx, async (creds) => ({ ok: true, teams: await VercelAPI.listTeams(creds) })),

      getTeam: (ctx, { teamId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          team: await VercelAPI.getTeam(creds, teamId),
        })),

      listTeamMembers: (ctx, { teamId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          members: await VercelAPI.listTeamMembers(creds, teamId),
        })),

      inviteTeamMember: (ctx, { teamId, email, role }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          member: await VercelAPI.inviteTeamMember(creds, teamId, { email, role }),
        })),

      removeTeamMember: (ctx, { teamId, userId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.removeTeamMember(creds, teamId, userId)),
        })),

      // ─── Webhooks ──────────────────────────────────────────────────────────
      listWebhooks: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          webhooks: await VercelAPI.listWebhooks(creds),
        })),

      createWebhook: (ctx, { url, events }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          webhook: await VercelAPI.createWebhook(creds, { url, events }),
        })),

      deleteWebhook: (ctx, { webhookId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteWebhook(creds, webhookId)),
        })),

      // ─── Log Drains ────────────────────────────────────────────────────────
      listLogDrains: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          logDrains: await VercelAPI.listLogDrains(creds),
        })),

      createLogDrain: (ctx, { name, url, sources, projectIds }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          logDrain: await VercelAPI.createLogDrain(creds, { name, url, sources, projectIds }),
        })),

      deleteLogDrain: (ctx, { logDrainId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteLogDrain(creds, logDrainId)),
        })),

      // ─── Edge Config ───────────────────────────────────────────────────────
      listEdgeConfigs: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          edgeConfigs: await VercelAPI.listEdgeConfigs(creds),
        })),

      getEdgeConfigItems: (ctx, { edgeConfigId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          items: await VercelAPI.getEdgeConfigItems(creds, edgeConfigId),
        })),

      createEdgeConfig: (ctx, { slug }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          edgeConfig: await VercelAPI.createEdgeConfig(creds, slug),
        })),

      deleteEdgeConfig: (ctx, { edgeConfigId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteEdgeConfig(creds, edgeConfigId)),
        })),

      updateEdgeConfigItems: (ctx, { edgeConfigId, items }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.updateEdgeConfigItems(creds, edgeConfigId, items)),
        })),

      // ─── Firewall ──────────────────────────────────────────────────────────
      getFirewallConfig: (ctx, { projectId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          config: await VercelAPI.getFirewallConfig(creds, projectId),
        })),

      updateFirewallConfig: (ctx, { projectId, firewallConfig }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          config: await VercelAPI.updateFirewallConfig(creds, projectId, firewallConfig),
        })),

      // ─── Integrations ──────────────────────────────────────────────────────
      listIntegrations: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          integrations: await VercelAPI.listIntegrations(creds),
        })),

      deleteIntegration: (ctx, { integrationId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          ...(await VercelAPI.deleteIntegration(creds, integrationId)),
        })),

      // ─── User ──────────────────────────────────────────────────────────────
      getUser: (ctx) =>
        withVercel(ctx, async (creds) => ({ ok: true, user: await VercelAPI.getUser(creds) })),

      // ─── Chat tool router ──────────────────────────────────────────────────
      executeChatTool: (ctx, { toolName, params }) => executeVercelChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: VERCEL_TOOLS },

  automation: {
    dataSources: [
      { value: 'vercel_deployments', label: 'Vercel - Recent Deployments', group: 'Vercel' },
    ],
    outputTypes: [],
    instructionTemplates: {
      vercel_deployments:
        'Review these Vercel deployments. Summarize which succeeded, which failed, and highlight any patterns or recurring errors.',
    },
    dataSourceCollectors: vercelDataSourceCollectors,
    outputHandlers: vercelOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getVercelCredentials(ctx);
      if (!creds) return null;
      const username = creds.username ?? null;
      return {
        connectedServices: [username ? `Vercel (@${username})` : 'Vercel'],
        sections: [
          `Vercel is connected. You have access to 61 tools covering projects (including pause/unpause), ` +
            `deployments (including delete, promote, file tree, file content), domains, DNS records, ` +
            `SSL certificates, environment variables, aliases, secrets (full CRUD), teams (including ` +
            `invite/remove members), webhooks, log drains (create/delete), Edge Config (full CRUD), ` +
            `WAF firewall config, and integrations. ` +
            `Use the appropriate vercel_* tool whenever the user asks about their Vercel account.`,
        ],
      };
    },
  },
});
