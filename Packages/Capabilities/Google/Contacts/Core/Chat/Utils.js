export function formatPerson(person, index) {
  const name = ContactsAPI.getDisplayName(person),
    emails = (person.emailAddresses ?? []).map((e) => `${e.value}${e.type ? ` (${e.type})` : ''}`),
    phones = (person.phoneNumbers ?? []).map((p) => `${p.value}${p.type ? ` (${p.type})` : ''}`),
    org = person.organizations?.[0],
    address = person.addresses?.[0],
    birthday = person.birthdays?.[0]?.date,
    note = person.biographies?.[0]?.value,
    urls = (person.urls ?? []).map((u) => `${u.value}${u.type ? ` (${u.type})` : ''}`),
    relations = (person.relations ?? []).map((r) => `${r.person}${r.type ? ` (${r.type})` : ''}`);
  return [
    `${'' !== index ? `${index}. ` : ''}**${name}**`,
    `   Resource: \`${person.resourceName}\``,
    emails.length ? `   Email: ${emails.join(', ')}` : '',
    phones.length ? `   Phone: ${phones.join(', ')}` : '',
    org ? `   ${[org.title, org.name].filter(Boolean).join(' @ ')}` : '',
    address?.formattedValue ? `   Address: ${address.formattedValue}` : '',
    birthday ? `   Birthday: ${formatBirthday(birthday)}` : '',
    urls.length ? `   Web: ${urls.join(', ')}` : '',
    relations.length ? `   Relations: ${relations.join(', ')}` : '',
    note ? `   Note: ${note.slice(0, 150)}${note.length > 150 ? '…' : ''}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
export function formatBirthday({ year: year, month: month, day: day }) {
  const parts = [];
  (month && parts.push(String(month).padStart(2, '0')),
    day && parts.push(String(day).padStart(2, '0')));
  const base = parts.join('/');
  return year ? `${year}/${base}` : base;
}
export function buildContactPayload({
  given_name: given_name,
  family_name: family_name,
  email: email,
  phone: phone,
  company: company,
  job_title: job_title,
} = {}) {
  const payload = {};
  return (
    (given_name || family_name) &&
      (payload.names = [{ givenName: given_name ?? '', familyName: family_name ?? '' }]),
    email && (payload.emailAddresses = [{ value: email, type: 'home' }]),
    phone && (payload.phoneNumbers = [{ value: phone, type: 'mobile' }]),
    (company || job_title) &&
      (payload.organizations = [{ name: company ?? '', title: job_title ?? '' }]),
    payload
  );
}
