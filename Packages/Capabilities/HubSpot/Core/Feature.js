import defineFeature from '../../Core/DefineFeature.js';
import * as HubSpotAPI from './API/HubSpotAPI.js';
import { getHubSpotCredentials, withHubSpot } from './Shared/Common.js';
import { HUBSPOT_TOOLS } from './Chat/Tools.js';
import { executeHubSpotChatTool } from './Chat/ChatExecutor.js';
import {
  hubspotDataSourceCollectors,
  hubspotOutputHandlers,
} from './Automation/AutomationHandlers.js';

export default defineFeature({
  id: 'hubspot',
  name: 'HubSpot',

  connectors: {
    services: [
      {
        id: 'hubspot',
        name: 'HubSpot',
        icon: '<img src="../../../Assets/Icons/Hubspot.png" alt="HubSpot" class="connector-icon-img" />',
        description:
          'Access your HubSpot CRM — contacts, deals, companies, tickets, tasks, notes, and pipeline from chat.',
        helpUrl: 'https://app.hubspot.com/private-apps',
        helpText: 'Create a Private App →',
        oauthType: null,
        subServices: [],
        setupSteps: [
          'Go to app.hubspot.com → Settings → Integrations → Private Apps',
          'Click "Create a private app" and give it a name',
          'Under Scopes, enable: crm.objects.contacts.read/write, crm.objects.deals.read/write, crm.objects.companies.read/write, crm.objects.tickets.read/write, crm.objects.owners.read',
          'Click "Create app" and copy the Access Token below',
        ],
        capabilities: [
          'List, create, update, delete contacts',
          'Manage deals and full sales pipeline',
          'Browse and update companies',
          'Create and track support tickets',
          'Log notes and create follow-up tasks',
          'Explore pipeline stages and owners',
          'Associate contacts, deals, and companies',
          'Search across all CRM records at once',
        ],
        fields: [
          {
            key: 'token',
            label: 'Private App Token',
            placeholder: 'pat-...',
            type: 'password',
            hint: 'Create at app.hubspot.com → Settings → Integrations → Private Apps.',
          },
        ],
        automations: [
          {
            name: 'Deals Digest',
            description: 'Daily — summarize open deals and pipeline activity',
          },
        ],
        defaultState: { enabled: false, credentials: {} },
        async validate(ctx) {
          const creds = ctx.connectorEngine?.getCredentials('hubspot');
          if (!creds?.token) return { ok: false, error: 'No credentials stored' };
          try {
            const user = await HubSpotAPI.getUser(creds);
            ctx.connectorEngine?.updateCredentials('hubspot', {
              hubId: user.hubId ?? null,
              hubDomain: user.hubDomain ?? null,
            });
            return { ok: true, hubDomain: user.hubDomain };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        },
      },
    ],
  },

  main: {
    methods: {
      // Contacts
      listContacts: (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          contacts: await HubSpotAPI.listContacts(c, limit ?? 20),
        })),
      getContact: (ctx, { id }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, contact: await HubSpotAPI.getContact(c, id) })),
      createContact: (ctx, { props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          contact: await HubSpotAPI.createContact(c, props),
        })),
      updateContact: (ctx, { id, props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          contact: await HubSpotAPI.updateContact(c, id, props),
        })),
      deleteContact: (ctx, { id }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, ...(await HubSpotAPI.deleteContact(c, id)) })),
      searchContacts: (ctx, { query }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          contacts: await HubSpotAPI.searchContacts(c, query),
        })),

      // Deals
      listDeals: (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          deals: await HubSpotAPI.listDeals(c, limit ?? 20),
        })),
      getDeal: (ctx, { id }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, deal: await HubSpotAPI.getDeal(c, id) })),
      createDeal: (ctx, { props }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, deal: await HubSpotAPI.createDeal(c, props) })),
      updateDeal: (ctx, { id, props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          deal: await HubSpotAPI.updateDeal(c, id, props),
        })),
      deleteDeal: (ctx, { id }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, ...(await HubSpotAPI.deleteDeal(c, id)) })),
      searchDeals: (ctx, { query }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          deals: await HubSpotAPI.searchDeals(c, query),
        })),

      // Companies
      listCompanies: (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          companies: await HubSpotAPI.listCompanies(c, limit ?? 20),
        })),
      getCompany: (ctx, { id }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, company: await HubSpotAPI.getCompany(c, id) })),
      createCompany: (ctx, { props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          company: await HubSpotAPI.createCompany(c, props),
        })),
      updateCompany: (ctx, { id, props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          company: await HubSpotAPI.updateCompany(c, id, props),
        })),
      searchCompanies: (ctx, { query }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          companies: await HubSpotAPI.searchCompanies(c, query),
        })),

      // Tickets
      listTickets: (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          tickets: await HubSpotAPI.listTickets(c, limit ?? 20),
        })),
      createTicket: (ctx, { props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          ticket: await HubSpotAPI.createTicket(c, props),
        })),
      updateTicket: (ctx, { id, props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          ticket: await HubSpotAPI.updateTicket(c, id, props),
        })),

      // Notes
      listNotes: (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          notes: await HubSpotAPI.listNotes(c, limit ?? 20),
        })),
      createNote: (ctx, { body, associations }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          note: await HubSpotAPI.createNote(c, body, associations ?? []),
        })),

      // Tasks
      listTasks: (ctx, { limit } = {}) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          tasks: await HubSpotAPI.listTasks(c, limit ?? 20),
        })),
      createTask: (ctx, { props }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, task: await HubSpotAPI.createTask(c, props) })),
      updateTask: (ctx, { id, props }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          task: await HubSpotAPI.updateTask(c, id, props),
        })),

      // Pipelines & Owners
      listPipelines: (ctx) =>
        withHubSpot(ctx, async (c) => ({ ok: true, pipelines: await HubSpotAPI.listPipelines(c) })),
      getPipelineStages: (ctx, { pipelineId }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          stages: await HubSpotAPI.getPipelineStages(c, pipelineId),
        })),
      listOwners: (ctx) =>
        withHubSpot(ctx, async (c) => ({ ok: true, owners: await HubSpotAPI.listOwners(c) })),
      getOwner: (ctx, { ownerId }) =>
        withHubSpot(ctx, async (c) => ({ ok: true, owner: await HubSpotAPI.getOwner(c, ownerId) })),

      // Associations
      associateObjects: (ctx, { fromType, fromId, toType, toId, associationTypeId }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          ...(await HubSpotAPI.associateObjects(
            c,
            fromType,
            fromId,
            toType,
            toId,
            associationTypeId,
          )),
        })),
      listAssociations: (ctx, { fromType, fromId, toType }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          associations: await HubSpotAPI.listAssociations(c, fromType, fromId, toType),
        })),

      // Analytics & Search
      getDealSummary: (ctx) =>
        withHubSpot(ctx, async (c) => ({ ok: true, summary: await HubSpotAPI.getDealSummary(c) })),
      searchCRM: (ctx, { query }) =>
        withHubSpot(ctx, async (c) => ({
          ok: true,
          results: await HubSpotAPI.searchCRM(c, query),
        })),

      // Chat tool executor
      executeChatTool: async (ctx, { toolName, params }) =>
        executeHubSpotChatTool(ctx, toolName, params),
    },
  },

  renderer: { chatTools: HUBSPOT_TOOLS },

  automation: {
    dataSources: [{ value: 'hubspot_deals', label: 'HubSpot - Deals Pipeline', group: 'HubSpot' }],
    outputTypes: [],
    instructionTemplates: {
      hubspot_deals:
        'Review these HubSpot deals. Summarize the pipeline, identify high-value or at-risk deals, and suggest any follow-up actions.',
    },
    dataSourceCollectors: hubspotDataSourceCollectors,
    outputHandlers: hubspotOutputHandlers,
  },

  prompt: {
    async getContext(ctx) {
      const creds = getHubSpotCredentials(ctx);
      if (!creds) return null;
      const hubDomain = creds.hubDomain ?? null;
      return {
        connectedServices: [hubDomain ? `HubSpot (${hubDomain})` : 'HubSpot'],
        sections: [
          `HubSpot is connected. Available tools:
• Contacts: hubspot_list_contacts, hubspot_get_contact, hubspot_create_contact, hubspot_update_contact, hubspot_delete_contact, hubspot_search_contacts
• Deals: hubspot_list_deals, hubspot_get_deal, hubspot_create_deal, hubspot_update_deal, hubspot_delete_deal, hubspot_search_deals
• Companies: hubspot_list_companies, hubspot_get_company, hubspot_create_company, hubspot_update_company, hubspot_search_companies
• Tickets: hubspot_list_tickets, hubspot_create_ticket, hubspot_update_ticket
• Notes: hubspot_list_notes, hubspot_create_note
• Tasks: hubspot_list_tasks, hubspot_create_task, hubspot_update_task
• Pipeline: hubspot_list_pipelines, hubspot_get_pipeline_stages
• Owners: hubspot_list_owners, hubspot_get_owner
• Associations: hubspot_associate_contact_to_deal, hubspot_associate_company_to_contact, hubspot_list_associations
• Analytics: hubspot_get_deal_summary, hubspot_search_crm`,
        ],
      };
    },
  },
});
