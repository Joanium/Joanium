import * as HubSpotAPI from '../API/HubSpotAPI.js';
import { getHubSpotCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeHubSpotChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getHubSpotCredentials, notConnected, async (creds) => {
    // ─── Contacts ───────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_contacts') {
      const contacts = await HubSpotAPI.listContacts(creds, 20);
      return { ok: true, contacts };
    }

    if (toolName === 'hubspot_get_contact') {
      const contact = await HubSpotAPI.getContact(creds, params.id);
      return { ok: true, contact };
    }

    if (toolName === 'hubspot_create_contact') {
      const { id: _id, ...props } = params; // id not needed for create
      const contact = await HubSpotAPI.createContact(creds, props);
      return { ok: true, contact };
    }

    if (toolName === 'hubspot_update_contact') {
      const contact = await HubSpotAPI.updateContact(creds, params.id, params.props);
      return { ok: true, contact };
    }

    if (toolName === 'hubspot_delete_contact') {
      const result = await HubSpotAPI.deleteContact(creds, params.id);
      return { ok: true, ...result };
    }

    if (toolName === 'hubspot_search_contacts') {
      const contacts = await HubSpotAPI.searchContacts(creds, params.query);
      return { ok: true, contacts };
    }

    // ─── Deals ──────────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_deals') {
      const deals = await HubSpotAPI.listDeals(creds, 20);
      return { ok: true, deals };
    }

    if (toolName === 'hubspot_get_deal') {
      const deal = await HubSpotAPI.getDeal(creds, params.id);
      return { ok: true, deal };
    }

    if (toolName === 'hubspot_create_deal') {
      const { id: _id, ...props } = params;
      const deal = await HubSpotAPI.createDeal(creds, props);
      return { ok: true, deal };
    }

    if (toolName === 'hubspot_update_deal') {
      const deal = await HubSpotAPI.updateDeal(creds, params.id, params.props);
      return { ok: true, deal };
    }

    if (toolName === 'hubspot_delete_deal') {
      const result = await HubSpotAPI.deleteDeal(creds, params.id);
      return { ok: true, ...result };
    }

    if (toolName === 'hubspot_search_deals') {
      const deals = await HubSpotAPI.searchDeals(creds, params.query);
      return { ok: true, deals };
    }

    // ─── Companies ──────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_companies') {
      const companies = await HubSpotAPI.listCompanies(creds, 20);
      return { ok: true, companies };
    }

    if (toolName === 'hubspot_get_company') {
      const company = await HubSpotAPI.getCompany(creds, params.id);
      return { ok: true, company };
    }

    if (toolName === 'hubspot_create_company') {
      const { id: _id, ...props } = params;
      const company = await HubSpotAPI.createCompany(creds, props);
      return { ok: true, company };
    }

    if (toolName === 'hubspot_update_company') {
      const company = await HubSpotAPI.updateCompany(creds, params.id, params.props);
      return { ok: true, company };
    }

    if (toolName === 'hubspot_search_companies') {
      const companies = await HubSpotAPI.searchCompanies(creds, params.query);
      return { ok: true, companies };
    }

    // ─── Tickets ────────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_tickets') {
      const tickets = await HubSpotAPI.listTickets(creds, 20);
      return { ok: true, tickets };
    }

    if (toolName === 'hubspot_create_ticket') {
      const { id: _id, ...props } = params;
      const ticket = await HubSpotAPI.createTicket(creds, props);
      return { ok: true, ticket };
    }

    if (toolName === 'hubspot_update_ticket') {
      const ticket = await HubSpotAPI.updateTicket(creds, params.id, params.props);
      return { ok: true, ticket };
    }

    // ─── Notes ──────────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_notes') {
      const notes = await HubSpotAPI.listNotes(creds, 20);
      return { ok: true, notes };
    }

    if (toolName === 'hubspot_create_note') {
      const { body, contactId, dealId, companyId } = params;
      const associations = [];
      if (contactId) {
        associations.push({
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
        });
      }
      if (dealId) {
        associations.push({
          to: { id: dealId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }],
        });
      }
      if (companyId) {
        associations.push({
          to: { id: companyId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 }],
        });
      }
      const note = await HubSpotAPI.createNote(creds, body, associations);
      return { ok: true, note };
    }

    // ─── Tasks ──────────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_tasks') {
      const tasks = await HubSpotAPI.listTasks(creds, 20);
      return { ok: true, tasks };
    }

    if (toolName === 'hubspot_create_task') {
      const { id: _id, ...props } = params;
      const task = await HubSpotAPI.createTask(creds, props);
      return { ok: true, task };
    }

    if (toolName === 'hubspot_update_task') {
      const task = await HubSpotAPI.updateTask(creds, params.id, params.props);
      return { ok: true, task };
    }

    // ─── Pipelines ──────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_pipelines') {
      const pipelines = await HubSpotAPI.listPipelines(creds);
      return { ok: true, pipelines };
    }

    if (toolName === 'hubspot_get_pipeline_stages') {
      const stages = await HubSpotAPI.getPipelineStages(creds, params.pipelineId);
      return { ok: true, stages };
    }

    // ─── Owners ─────────────────────────────────────────────────────────────
    if (toolName === 'hubspot_list_owners') {
      const owners = await HubSpotAPI.listOwners(creds);
      return { ok: true, owners };
    }

    if (toolName === 'hubspot_get_owner') {
      const owner = await HubSpotAPI.getOwner(creds, params.ownerId);
      return { ok: true, owner };
    }

    // ─── Associations ────────────────────────────────────────────────────────
    if (toolName === 'hubspot_associate_contact_to_deal') {
      // Association type 3 = Contact → Deal (HUBSPOT_DEFINED)
      const result = await HubSpotAPI.associateObjects(
        creds,
        'contacts',
        params.contactId,
        'deals',
        params.dealId,
        3,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'hubspot_associate_company_to_contact') {
      // Association type 1 = Company → Contact (HUBSPOT_DEFINED)
      const result = await HubSpotAPI.associateObjects(
        creds,
        'companies',
        params.companyId,
        'contacts',
        params.contactId,
        1,
      );
      return { ok: true, ...result };
    }

    if (toolName === 'hubspot_list_associations') {
      const associations = await HubSpotAPI.listAssociations(
        creds,
        params.fromType,
        params.fromId,
        params.toType,
      );
      return { ok: true, associations };
    }

    // ─── Analytics & Search ──────────────────────────────────────────────────
    if (toolName === 'hubspot_get_deal_summary') {
      const summary = await HubSpotAPI.getDealSummary(creds);
      return { ok: true, summary };
    }

    if (toolName === 'hubspot_search_crm') {
      const results = await HubSpotAPI.searchCRM(creds, params.query);
      return { ok: true, results };
    }

    return null; // unknown tool
  });
}
