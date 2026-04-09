async function getFreshGoogleCreds(creds) {
  const { getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}

const PEOPLE_BASE = 'https://people.googleapis.com/v1';

const PERSON_FIELDS =
  'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies,urls,relations,userDefined,memberships,metadata';
const BASIC_FIELDS = 'names,emailAddresses,phoneNumbers,organizations';

async function peopleFetch(creds, url, options = {}) {
  const fresh = await getFreshGoogleCreds(creds);
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
    throw new Error(
      `Contacts API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    );
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

export async function listAllContacts(creds) {
  const allContacts = [];
  let pageToken = null;
  do {
    const { contacts, nextPageToken } = await listContacts(creds, { maxResults: 1000, pageToken });
    allContacts.push(...contacts);
    pageToken = nextPageToken;
  } while (pageToken);
  return allContacts;
}

export async function searchContacts(creds, query, maxResults = 10) {
  const params = new URLSearchParams({
    query,
    readMask: BASIC_FIELDS,
    pageSize: String(Math.min(maxResults, 30)),
  });
  const data = await peopleFetch(creds, `${PEOPLE_BASE}/people:searchContacts?${params}`);
  return (data.results ?? []).map((r) => r.person).filter(Boolean);
}

export async function getContact(creds, resourceName) {
  return peopleFetch(creds, `${PEOPLE_BASE}/${resourceName}?personFields=${PERSON_FIELDS}`);
}

export async function createContact(
  creds,
  { names = [], emailAddresses = [], phoneNumbers = [], organizations = [] } = {},
) {
  const body = {};
  if (names.length) body.names = names;
  if (emailAddresses.length) body.emailAddresses = emailAddresses;
  if (phoneNumbers.length) body.phoneNumbers = phoneNumbers;
  if (organizations.length) body.organizations = organizations;
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
  return peopleFetch(
    creds,
    `${PEOPLE_BASE}/${encoded}:updateContact?updatePersonFields=${fields}`,
    {
      method: 'PATCH',
      body: JSON.stringify(merged),
    },
  );
}

export async function deleteContact(creds, resourceName) {
  await peopleFetch(creds, `${PEOPLE_BASE}/${resourceName}:deleteContact`, { method: 'DELETE' });
  return true;
}

export async function bulkCreateContacts(creds, contacts = []) {
  const results = [];
  for (const c of contacts) {
    try {
      const created = await createContact(creds, c);
      results.push({ ok: true, contact: created });
    } catch (err) {
      results.push({ ok: false, error: err.message, input: c });
    }
  }
  return results;
}

export async function bulkDeleteContacts(creds, resourceNames = []) {
  const results = [];
  for (const rn of resourceNames) {
    try {
      await deleteContact(creds, rn);
      results.push({ ok: true, resourceName: rn });
    } catch (err) {
      results.push({ ok: false, resourceName: rn, error: err.message });
    }
  }
  return results;
}

export async function appendEmail(creds, resourceName, email, type = 'home') {
  const existing = await getContact(creds, resourceName);
  const emails = [...(existing.emailAddresses ?? []), { value: email, type }];
  return updateContact(creds, resourceName, { emailAddresses: emails }, 'emailAddresses');
}

export async function appendPhone(creds, resourceName, phone, type = 'mobile') {
  const existing = await getContact(creds, resourceName);
  const phones = [...(existing.phoneNumbers ?? []), { value: phone, type }];
  return updateContact(creds, resourceName, { phoneNumbers: phones }, 'phoneNumbers');
}

export async function setNote(creds, resourceName, note) {
  return updateContact(
    creds,
    resourceName,
    { biographies: [{ value: note, contentType: 'TEXT_PLAIN' }] },
    'biographies',
  );
}

export async function setAddress(
  creds,
  resourceName,
  { streetAddress, city, region, postalCode, country, type = 'home' } = {},
) {
  const existing = await getContact(creds, resourceName);
  const addresses = [
    ...(existing.addresses ?? []),
    { streetAddress, city, region, postalCode, country, type },
  ];
  return updateContact(creds, resourceName, { addresses }, 'addresses');
}

export async function setWebsite(creds, resourceName, url, type = 'homePage') {
  const existing = await getContact(creds, resourceName);
  const urls = [...(existing.urls ?? []), { value: url, type }];
  return updateContact(creds, resourceName, { urls }, 'urls');
}

export async function setBirthday(creds, resourceName, { year, month, day } = {}) {
  const date = {};
  if (year) date.year = year;
  if (month) date.month = month;
  if (day) date.day = day;
  return updateContact(creds, resourceName, { birthdays: [{ date }] }, 'birthdays');
}

export async function addRelation(creds, resourceName, personName, relationType = 'friend') {
  const existing = await getContact(creds, resourceName);
  const relations = [...(existing.relations ?? []), { person: personName, type: relationType }];
  return updateContact(creds, resourceName, { relations }, 'relations');
}

// ── New: Filtered list helpers ────────────────────────────────────────────────

export async function listContactsWithBirthdays(creds) {
  const params = new URLSearchParams({
    personFields: `${BASIC_FIELDS},birthdays`,
    pageSize: '1000',
    sortOrder: 'FIRST_NAME_ASCENDING',
  });
  const data = await peopleFetch(creds, `${PEOPLE_BASE}/people/me/connections?${params}`);
  const all = data.connections ?? [];
  return all.filter((c) => c.birthdays?.length);
}

export async function listContactsByCompany(creds, company) {
  const all = await listAllContacts(creds);
  const q = company.toLowerCase();
  return all.filter((c) =>
    c.organizations?.some(
      (o) => o.name?.toLowerCase().includes(q) || o.title?.toLowerCase().includes(q),
    ),
  );
}

export async function countContacts(creds) {
  const data = await peopleFetch(
    creds,
    `${PEOPLE_BASE}/people/me/connections?personFields=names&pageSize=1`,
  );
  return data.totalItems ?? 0;
}

export async function findDuplicates(creds) {
  const all = await listAllContacts(creds);
  const emailMap = new Map();
  const nameMap = new Map();

  for (const c of all) {
    const email = c.emailAddresses?.[0]?.value?.toLowerCase();
    const name = c.names?.[0]?.displayName?.toLowerCase();
    if (email) {
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email).push(c);
    }
    if (name) {
      if (!nameMap.has(name)) nameMap.set(name, []);
      nameMap.get(name).push(c);
    }
  }

  const groups = [];
  for (const [key, contacts] of emailMap) {
    if (contacts.length > 1) groups.push({ reason: `Duplicate email: ${key}`, contacts });
  }
  for (const [key, contacts] of nameMap) {
    if (contacts.length > 1) groups.push({ reason: `Duplicate name: ${key}`, contacts });
  }
  return groups;
}

export async function getMergeSuggestions(creds) {
  const data = await peopleFetch(
    creds,
    `${PEOPLE_BASE}/people:listDirectoryPeople?readMask=${BASIC_FIELDS}&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT&pageSize=50`,
  ).catch(() => ({ people: [] }));
  return data.people ?? [];
}

export async function exportContactsCSV(creds) {
  const all = await listAllContacts(creds);
  const rows = [['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Resource Name']];
  for (const c of all) {
    rows.push([
      getDisplayName(c),
      c.emailAddresses?.[0]?.value ?? '',
      c.phoneNumbers?.[0]?.value ?? '',
      c.organizations?.[0]?.name ?? '',
      c.organizations?.[0]?.title ?? '',
      c.resourceName ?? '',
    ]);
  }
  return rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
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
