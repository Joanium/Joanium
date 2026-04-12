const PEOPLE_BASE = 'https://people.googleapis.com/v1',
  PERSON_FIELDS =
    'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses,biographies,urls,relations,userDefined,memberships,metadata',
  BASIC_FIELDS = 'names,emailAddresses,phoneNumbers,organizations';
async function peopleFetch(creds, url, options = {}) {
  const fresh = await (async function (creds) {
      const { getFreshCreds: getFreshCreds } = await import('../../../GoogleWorkspace.js');
      return getFreshCreds(creds);
    })(creds),
    res = await fetch(url, {
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
  return 204 === res.status ? null : res.json();
}
export async function getMyProfile(creds) {
  return peopleFetch(creds, `${PEOPLE_BASE}/people/me?personFields=${PERSON_FIELDS}`);
}
export async function listContacts(
  creds,
  { maxResults: maxResults = 50, pageToken: pageToken } = {},
) {
  const params = new URLSearchParams({
    personFields: BASIC_FIELDS,
    pageSize: String(Math.min(maxResults, 1e3)),
    sortOrder: 'FIRST_NAME_ASCENDING',
  });
  pageToken && params.set('pageToken', pageToken);
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
    const { contacts: contacts, nextPageToken: nextPageToken } = await listContacts(creds, {
      maxResults: 1e3,
      pageToken: pageToken,
    });
    (allContacts.push(...contacts), (pageToken = nextPageToken));
  } while (pageToken);
  return allContacts;
}
export async function searchContacts(creds, query, maxResults = 10) {
  const params = new URLSearchParams({
    query: query,
    readMask: BASIC_FIELDS,
    pageSize: String(Math.min(maxResults, 30)),
  });
  return (
    (await peopleFetch(creds, `${PEOPLE_BASE}/people:searchContacts?${params}`)).results ?? []
  )
    .map((r) => r.person)
    .filter(Boolean);
}
export async function getContact(creds, resourceName) {
  return peopleFetch(creds, `${PEOPLE_BASE}/${resourceName}?personFields=${PERSON_FIELDS}`);
}
export async function createContact(
  creds,
  {
    names: names = [],
    emailAddresses: emailAddresses = [],
    phoneNumbers: phoneNumbers = [],
    organizations: organizations = [],
  } = {},
) {
  const body = {};
  return (
    names.length && (body.names = names),
    emailAddresses.length && (body.emailAddresses = emailAddresses),
    phoneNumbers.length && (body.phoneNumbers = phoneNumbers),
    organizations.length && (body.organizations = organizations),
    peopleFetch(creds, `${PEOPLE_BASE}/people:createContact`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}
export async function updateContact(creds, resourceName, updateData = {}, updatePersonFields) {
  const merged = { ...(await getContact(creds, resourceName)), ...updateData },
    fields = updatePersonFields ?? Object.keys(updateData).join(','),
    encoded = encodeURIComponent(resourceName);
  return peopleFetch(
    creds,
    `${PEOPLE_BASE}/${encoded}:updateContact?updatePersonFields=${fields}`,
    { method: 'PATCH', body: JSON.stringify(merged) },
  );
}
export async function deleteContact(creds, resourceName) {
  return (
    await peopleFetch(creds, `${PEOPLE_BASE}/${resourceName}:deleteContact`, { method: 'DELETE' }),
    !0
  );
}
export async function bulkCreateContacts(creds, contacts = []) {
  const results = [];
  for (const c of contacts)
    try {
      const created = await createContact(creds, c);
      results.push({ ok: !0, contact: created });
    } catch (err) {
      results.push({ ok: !1, error: err.message, input: c });
    }
  return results;
}
export async function bulkDeleteContacts(creds, resourceNames = []) {
  const results = [];
  for (const rn of resourceNames)
    try {
      (await deleteContact(creds, rn), results.push({ ok: !0, resourceName: rn }));
    } catch (err) {
      results.push({ ok: !1, resourceName: rn, error: err.message });
    }
  return results;
}
export async function appendEmail(creds, resourceName, email, type = 'home') {
  return updateContact(
    creds,
    resourceName,
    {
      emailAddresses: [
        ...((await getContact(creds, resourceName)).emailAddresses ?? []),
        { value: email, type: type },
      ],
    },
    'emailAddresses',
  );
}
export async function appendPhone(creds, resourceName, phone, type = 'mobile') {
  return updateContact(
    creds,
    resourceName,
    {
      phoneNumbers: [
        ...((await getContact(creds, resourceName)).phoneNumbers ?? []),
        { value: phone, type: type },
      ],
    },
    'phoneNumbers',
  );
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
  {
    streetAddress: streetAddress,
    city: city,
    region: region,
    postalCode: postalCode,
    country: country,
    type: type = 'home',
  } = {},
) {
  return updateContact(
    creds,
    resourceName,
    {
      addresses: [
        ...((await getContact(creds, resourceName)).addresses ?? []),
        {
          streetAddress: streetAddress,
          city: city,
          region: region,
          postalCode: postalCode,
          country: country,
          type: type,
        },
      ],
    },
    'addresses',
  );
}
export async function setWebsite(creds, resourceName, url, type = 'homePage') {
  return updateContact(
    creds,
    resourceName,
    { urls: [...((await getContact(creds, resourceName)).urls ?? []), { value: url, type: type }] },
    'urls',
  );
}
export async function setBirthday(
  creds,
  resourceName,
  { year: year, month: month, day: day } = {},
) {
  const date = {};
  return (
    year && (date.year = year),
    month && (date.month = month),
    day && (date.day = day),
    updateContact(creds, resourceName, { birthdays: [{ date: date }] }, 'birthdays')
  );
}
export async function addRelation(creds, resourceName, personName, relationType = 'friend') {
  return updateContact(
    creds,
    resourceName,
    {
      relations: [
        ...((await getContact(creds, resourceName)).relations ?? []),
        { person: personName, type: relationType },
      ],
    },
    'relations',
  );
}
export async function listContactsWithBirthdays(creds) {
  const params = new URLSearchParams({
    personFields: `${BASIC_FIELDS},birthdays`,
    pageSize: '1000',
    sortOrder: 'FIRST_NAME_ASCENDING',
  });
  return (
    (await peopleFetch(creds, `${PEOPLE_BASE}/people/me/connections?${params}`)).connections ?? []
  ).filter((c) => c.birthdays?.length);
}
export async function listContactsByCompany(creds, company) {
  const all = await listAllContacts(creds),
    q = company.toLowerCase();
  return all.filter((c) =>
    c.organizations?.some(
      (o) => o.name?.toLowerCase().includes(q) || o.title?.toLowerCase().includes(q),
    ),
  );
}
export async function countContacts(creds) {
  return (
    (await peopleFetch(creds, `${PEOPLE_BASE}/people/me/connections?personFields=names&pageSize=1`))
      .totalItems ?? 0
  );
}
export async function findDuplicates(creds) {
  const all = await listAllContacts(creds),
    emailMap = new Map(),
    nameMap = new Map();
  for (const c of all) {
    const email = c.emailAddresses?.[0]?.value?.toLowerCase(),
      name = c.names?.[0]?.displayName?.toLowerCase();
    (email && (emailMap.has(email) || emailMap.set(email, []), emailMap.get(email).push(c)),
      name && (nameMap.has(name) || nameMap.set(name, []), nameMap.get(name).push(c)));
  }
  const groups = [];
  for (const [key, contacts] of emailMap)
    contacts.length > 1 && groups.push({ reason: `Duplicate email: ${key}`, contacts: contacts });
  for (const [key, contacts] of nameMap)
    contacts.length > 1 && groups.push({ reason: `Duplicate name: ${key}`, contacts: contacts });
  return groups;
}
export async function getMergeSuggestions(creds) {
  return (
    (
      await peopleFetch(
        creds,
        `${PEOPLE_BASE}/people:listDirectoryPeople?readMask=${BASIC_FIELDS}&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT&pageSize=50`,
      ).catch(() => ({ people: [] }))
    ).people ?? []
  );
}
export async function exportContactsCSV(creds) {
  const all = await listAllContacts(creds),
    rows = [['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Resource Name']];
  for (const c of all)
    rows.push([
      getDisplayName(c),
      c.emailAddresses?.[0]?.value ?? '',
      c.phoneNumbers?.[0]?.value ?? '',
      c.organizations?.[0]?.name ?? '',
      c.organizations?.[0]?.title ?? '',
      c.resourceName ?? '',
    ]);
  return rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
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
