import { tryParseJson } from '../../../../../Shared/Utils/AsyncUtils.js';

const BASE = 'https://api.hubapi.com';

function headers(creds) {
  return { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' };
}

async function hFetch(path, creds, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(creds), ...options });
  if (!res.ok) {
    const data = await tryParseJson(res);
    throw new Error(data.message ?? `HubSpot API error: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getUser(creds) {
  const data = await hFetch(`/oauth/v1/access-tokens/${creds.token}`, creds);
  return { hubId: data.hub_id, hubDomain: data.hub_domain, userId: data.user_id, user: data.user };
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function listContacts(creds, limit = 20) {
  const data = await hFetch(
    `/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,phone,company,createdate`,
    creds,
  );
  return (data.results ?? []).map(mapContact);
}

export async function getContact(creds, id) {
  const c = await hFetch(
    `/crm/v3/objects/contacts/${id}?properties=firstname,lastname,email,phone,company,createdate,lifecyclestage,jobtitle`,
    creds,
  );
  return mapContact(c);
}

export async function createContact(creds, props) {
  const c = await hFetch('/crm/v3/objects/contacts', creds, {
    method: 'POST',
    body: JSON.stringify({ properties: props }),
  });
  return mapContact(c);
}

export async function updateContact(creds, id, props) {
  const c = await hFetch(`/crm/v3/objects/contacts/${id}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ properties: props }),
  });
  return mapContact(c);
}

export async function deleteContact(creds, id) {
  await hFetch(`/crm/v3/objects/contacts/${id}`, creds, { method: 'DELETE' });
  return { deleted: true, id };
}

export async function searchContacts(creds, query) {
  const data = await hFetch('/crm/v3/objects/contacts/search', creds, {
    method: 'POST',
    body: JSON.stringify({
      query,
      limit: 20,
      properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
    }),
  });
  return (data.results ?? []).map(mapContact);
}

function mapContact(c) {
  return {
    id: c.id,
    firstName: c.properties?.firstname ?? '',
    lastName: c.properties?.lastname ?? '',
    email: c.properties?.email ?? '',
    phone: c.properties?.phone ?? '',
    company: c.properties?.company ?? '',
    jobTitle: c.properties?.jobtitle ?? '',
    lifecycleStage: c.properties?.lifecyclestage ?? '',
    createdAt: c.properties?.createdate ?? '',
  };
}

// ─── Deals ───────────────────────────────────────────────────────────────────

export async function listDeals(creds, limit = 20) {
  const data = await hFetch(
    `/crm/v3/objects/deals?limit=${limit}&properties=dealname,dealstage,amount,closedate,pipeline`,
    creds,
  );
  return (data.results ?? []).map(mapDeal);
}

export async function getDeal(creds, id) {
  const d = await hFetch(
    `/crm/v3/objects/deals/${id}?properties=dealname,dealstage,amount,closedate,pipeline,hubspot_owner_id,description`,
    creds,
  );
  return mapDeal(d);
}

export async function createDeal(creds, props) {
  const d = await hFetch('/crm/v3/objects/deals', creds, {
    method: 'POST',
    body: JSON.stringify({ properties: props }),
  });
  return mapDeal(d);
}

export async function updateDeal(creds, id, props) {
  const d = await hFetch(`/crm/v3/objects/deals/${id}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ properties: props }),
  });
  return mapDeal(d);
}

export async function deleteDeal(creds, id) {
  await hFetch(`/crm/v3/objects/deals/${id}`, creds, { method: 'DELETE' });
  return { deleted: true, id };
}

export async function searchDeals(creds, query) {
  const data = await hFetch('/crm/v3/objects/deals/search', creds, {
    method: 'POST',
    body: JSON.stringify({
      query,
      limit: 20,
      properties: ['dealname', 'dealstage', 'amount', 'closedate', 'pipeline'],
    }),
  });
  return (data.results ?? []).map(mapDeal);
}

function mapDeal(d) {
  return {
    id: d.id,
    name: d.properties?.dealname ?? 'Unnamed Deal',
    stage: d.properties?.dealstage ?? '',
    amount: d.properties?.amount ? parseFloat(d.properties.amount) : null,
    closeDate: d.properties?.closedate ?? null,
    pipeline: d.properties?.pipeline ?? '',
    ownerId: d.properties?.hubspot_owner_id ?? null,
    description: d.properties?.description ?? '',
  };
}

// ─── Companies ───────────────────────────────────────────────────────────────

export async function listCompanies(creds, limit = 20) {
  const data = await hFetch(
    `/crm/v3/objects/companies?limit=${limit}&properties=name,domain,industry,numberofemployees`,
    creds,
  );
  return (data.results ?? []).map(mapCompany);
}

export async function getCompany(creds, id) {
  const c = await hFetch(
    `/crm/v3/objects/companies/${id}?properties=name,domain,industry,numberofemployees,city,country,phone`,
    creds,
  );
  return mapCompany(c);
}

export async function createCompany(creds, props) {
  const c = await hFetch('/crm/v3/objects/companies', creds, {
    method: 'POST',
    body: JSON.stringify({ properties: props }),
  });
  return mapCompany(c);
}

export async function updateCompany(creds, id, props) {
  const c = await hFetch(`/crm/v3/objects/companies/${id}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ properties: props }),
  });
  return mapCompany(c);
}

export async function searchCompanies(creds, query) {
  const data = await hFetch('/crm/v3/objects/companies/search', creds, {
    method: 'POST',
    body: JSON.stringify({
      query,
      limit: 20,
      properties: ['name', 'domain', 'industry', 'numberofemployees'],
    }),
  });
  return (data.results ?? []).map(mapCompany);
}

function mapCompany(c) {
  return {
    id: c.id,
    name: c.properties?.name ?? 'Unknown',
    domain: c.properties?.domain ?? '',
    industry: c.properties?.industry ?? '',
    employees: c.properties?.numberofemployees ?? null,
    city: c.properties?.city ?? '',
    country: c.properties?.country ?? '',
    phone: c.properties?.phone ?? '',
  };
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export async function listTickets(creds, limit = 20) {
  const data = await hFetch(
    `/crm/v3/objects/tickets?limit=${limit}&properties=subject,hs_ticket_priority,hs_pipeline_stage,hs_pipeline,createdate`,
    creds,
  );
  return (data.results ?? []).map(mapTicket);
}

export async function createTicket(creds, props) {
  const t = await hFetch('/crm/v3/objects/tickets', creds, {
    method: 'POST',
    body: JSON.stringify({ properties: props }),
  });
  return mapTicket(t);
}

export async function updateTicket(creds, id, props) {
  const t = await hFetch(`/crm/v3/objects/tickets/${id}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ properties: props }),
  });
  return mapTicket(t);
}

function mapTicket(t) {
  return {
    id: t.id,
    subject: t.properties?.subject ?? 'No subject',
    priority: t.properties?.hs_ticket_priority ?? '',
    stage: t.properties?.hs_pipeline_stage ?? '',
    pipeline: t.properties?.hs_pipeline ?? '',
    createdAt: t.properties?.createdate ?? '',
  };
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function listNotes(creds, limit = 20) {
  const data = await hFetch(
    `/crm/v3/objects/notes?limit=${limit}&properties=hs_note_body,hs_timestamp,hubspot_owner_id`,
    creds,
  );
  return (data.results ?? []).map(mapNote);
}

export async function createNote(creds, body, associations = []) {
  const payload = {
    properties: { hs_note_body: body, hs_timestamp: new Date().toISOString() },
    ...(associations.length ? { associations } : {}),
  };
  const n = await hFetch('/crm/v3/objects/notes', creds, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapNote(n);
}

function mapNote(n) {
  return {
    id: n.id,
    body: n.properties?.hs_note_body ?? '',
    timestamp: n.properties?.hs_timestamp ?? '',
    ownerId: n.properties?.hubspot_owner_id ?? null,
  };
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function createTask(creds, props) {
  const t = await hFetch('/crm/v3/objects/tasks', creds, {
    method: 'POST',
    body: JSON.stringify({ properties: props }),
  });
  return mapTask(t);
}

export async function listTasks(creds, limit = 20) {
  const data = await hFetch(
    `/crm/v3/objects/tasks?limit=${limit}&properties=hs_task_subject,hs_task_status,hs_task_priority,hs_timestamp`,
    creds,
  );
  return (data.results ?? []).map(mapTask);
}

export async function updateTask(creds, id, props) {
  const t = await hFetch(`/crm/v3/objects/tasks/${id}`, creds, {
    method: 'PATCH',
    body: JSON.stringify({ properties: props }),
  });
  return mapTask(t);
}

function mapTask(t) {
  return {
    id: t.id,
    subject: t.properties?.hs_task_subject ?? 'Untitled Task',
    status: t.properties?.hs_task_status ?? '',
    priority: t.properties?.hs_task_priority ?? '',
    dueDate: t.properties?.hs_timestamp ?? null,
  };
}

// ─── Pipelines ───────────────────────────────────────────────────────────────

export async function listPipelines(creds) {
  const data = await hFetch('/crm/v3/pipelines/deals', creds);
  return (data.results ?? []).map((p) => ({
    id: p.id,
    label: p.label,
    displayOrder: p.displayOrder,
    stageCount: p.stages?.length ?? 0,
  }));
}

export async function getPipelineStages(creds, pipelineId) {
  const data = await hFetch(`/crm/v3/pipelines/deals/${pipelineId}/stages`, creds);
  return (data.results ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    displayOrder: s.displayOrder,
    probability: s.metadata?.probability ?? null,
  }));
}

// ─── Owners ──────────────────────────────────────────────────────────────────

export async function listOwners(creds, limit = 50) {
  const data = await hFetch(`/crm/v3/owners?limit=${limit}`, creds);
  return (data.results ?? []).map(mapOwner);
}

export async function getOwner(creds, ownerId) {
  const o = await hFetch(`/crm/v3/owners/${ownerId}`, creds);
  return mapOwner(o);
}

function mapOwner(o) {
  return {
    id: o.id,
    firstName: o.firstName ?? '',
    lastName: o.lastName ?? '',
    email: o.email ?? '',
    userId: o.userId ?? null,
  };
}

// ─── Associations ─────────────────────────────────────────────────────────────

export async function associateObjects(creds, fromType, fromId, toType, toId, associationTypeId) {
  await hFetch(`/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`, creds, {
    method: 'PUT',
    body: JSON.stringify([{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId }]),
  });
  return { ok: true, fromId, toId };
}

export async function listAssociations(creds, fromType, fromId, toType) {
  const data = await hFetch(`/crm/v4/objects/${fromType}/${fromId}/associations/${toType}`, creds);
  return (data.results ?? []).map((r) => ({ toId: r.toObjectId, type: r.associationType }));
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

export async function getDealSummary(creds) {
  const deals = await listDeals(creds, 100);
  const total = deals.reduce((s, d) => s + (d.amount ?? 0), 0);
  const byStage = deals.reduce((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1;
    return acc;
  }, {});
  const closing30 = deals.filter((d) => {
    if (!d.closeDate) return false;
    const diff = (new Date(d.closeDate) - Date.now()) / 86400000;
    return diff >= 0 && diff <= 30;
  });
  return { totalDeals: deals.length, totalValue: total, byStage, closingIn30Days: closing30 };
}

// ─── Global search ────────────────────────────────────────────────────────────

export async function searchCRM(creds, query) {
  const [contacts, deals, companies] = await Promise.allSettled([
    searchContacts(creds, query),
    searchDeals(creds, query),
    searchCompanies(creds, query),
  ]);
  return {
    contacts: contacts.status === 'fulfilled' ? contacts.value : [],
    deals: deals.status === 'fulfilled' ? deals.value : [],
    companies: companies.status === 'fulfilled' ? companies.value : [],
  };
}
