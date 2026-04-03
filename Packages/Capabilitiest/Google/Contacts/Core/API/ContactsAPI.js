import { getFreshCreds } from '../../../GoogleWorkspace.js';

const PEOPLE_BASE = 'https://people.googleapis.com/v1';

const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies,urls,relations';
const BASIC_FIELDS  = 'names,emailAddresses,phoneNumbers,organizations';

async function peopleFetch(creds, url, options = {}) {
  const fresh = await getFreshCreds(creds);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Contacts API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getMyProfile(creds) {
  return peopleFetch(creds, `${PEOPLE_BASE}/people/me?personFields=${PERSON_FIELDS}`);
}

export async function listContacts(creds, { maxResults = 50, pageToken } = {}) {
  const params = new URLSearchParams({
    personFields: BASIC_FIELDS,
    pageSize: String(Math.min(maxResults, 1000)),
    sortOrder: 'FIRST_NAME_ASCENDING',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const data = await peopleFetch(creds, `${PEOPLE_BASE}/people/me/connections?${params}`);
  return {
    contacts: data.connections ?? [],
    nextPageToken: data.nextPageToken ?? null,
    totalItems: data.totalItems ?? 0,
  };
}

export async function searchContacts(creds, query, maxResults = 10) {
  const params = new URLSearchParams({
    query,
    readMask: BASIC_FIELDS,
    pageSize: String(Math.min(maxResults, 30)),
  });
  const data = await peopleFetch(creds, `${PEOPLE_BASE}/people:searchContacts?${params}`);
  return (data.results ?? []).map(r => r.person).filter(Boolean);
}

export async function getContact(creds, resourceName) {
  return peopleFetch(creds, `${PEOPLE_BASE}/${resourceName}?personFields=${PERSON_FIELDS}`);
}

export async function createContact(creds, { names = [], emailAddresses = [], phoneNumbers = [], organizations = [] } = {}) {
  const body = {};
  if (names.length)          body.names = names;
  if (emailAddresses.length) body.emailAddresses = emailAddresses;
  if (phoneNumbers.length)   body.phoneNumbers = phoneNumbers;
  if (organizations.length)  body.organizations = organizations;
  return peopleFetch(creds, `${PEOPLE_BASE}/people:createContact`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateContact(creds, resourceName, updateData = {}, updatePersonFields) {
  const existing = await getContact(creds, resourceName);
  const merged = { ...existing, ...updateData };
  const fields = updatePersonFields ?? Object.keys(updateData).join(',');
  const encoded = encodeURIComponent(resourceName);
  return peopleFetch(creds, `${PEOPLE_BASE}/${encoded}:updateContact?updatePersonFields=${fields}`, {
    method: 'PATCH',
    body: JSON.stringify(merged),
  });
}

export async function deleteContact(creds, resourceName) {
  await peopleFetch(creds, `${PEOPLE_BASE}/${resourceName}:deleteContact`, { method: 'DELETE' });
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getDisplayName(person) {
  if (!person) return '(Unknown)';
  const name = person.names?.[0];
  return name?.displayName ?? name?.givenName ?? '(No name)';
}

export function getPrimaryEmail(person) {
  return person?.emailAddresses?.[0]?.value ?? null;
}

export function getPrimaryPhone(person) {
  return person?.phoneNumbers?.[0]?.value ?? null;
}
