import defineFeature from '../../Core/DefineFeature.js';
import * as VercelAPI from './API/VercelAPI.js';
import { getVercelCredentials, notConnected } from './Shared/Common.js';
import { VERCEL_TOOLS } from './Chat/Tools.js';
import { executeVercelChatTool } from './Chat/ChatExecutor.js';
import {
  vercelDataSourceCollectors,
  vercelOutputHandlers,
} from './Automation/AutomationHandlers.js';

function withVercel(ctx, cb) {
  const creds = getVercelCredentials(ctx);
  return creds
    ? cb(creds).catch((e) => ({ ok: false, error: e.message }))
    : Promise.resolve(notConnected());
}

export default defineFeature({
  id: 'vercel',
  name: 'Vercel',

  connectors: {
    services: [
      {
        id: 'vercel',
        name: 'Vercel',
        icon: '<img src="../../../Assets/Icons/Vercel.png" alt="Vercel" style="width: 26px; height: 26px; object-fit: contain;" />',
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
          'List, create, update and delete projects',
          'Inspect, cancel and redeploy deployments',
          'Manage domains, env vars, aliases, secrets and webhooks',
          'Browse Edge Config stores and log drains',
          'Monitor teams, members and deployment checks',
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
        automations: [
          {
            name: 'Deployment Monitor',
            description: 'Daily — summarize recent deployments and flag any failures',
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

      // ─── Deployments ───────────────────────────────────────────────────────
      listDeployments: (ctx, { limit } = {}) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          deployments: await VercelAPI.listDeployments(creds, limit),
        })),

      getDeployment: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          deployment: await VercelAPI.getDeployment(creds, deploymentId),
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

      getDeploymentEvents: (ctx, { deploymentId }) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          events: await VercelAPI.getDeploymentEvents(creds, deploymentId),
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

      // ─── Log Drains ────────────────────────────────────────────────────────
      listLogDrains: (ctx) =>
        withVercel(ctx, async (creds) => ({
          ok: true,
          logDrains: await VercelAPI.listLogDrains(creds),
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
          `Vercel is connected. You have access to 31 tools covering projects, deployments, domains, ` +
            `environment variables, aliases, secrets, teams, webhooks, Edge Config, and log drains. ` +
            `Use the appropriate vercel_* tool whenever the user asks about their Vercel account.`,
        ],
      };
    },
  },
});
