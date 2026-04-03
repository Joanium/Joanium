import * as ContactsAPI from '../API/ContactsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatPerson(person, index) {
  const name = ContactsAPI.getDisplayName(person);
  const emails = (person.emailAddresses ?? []).map(e => `${e.value}${e.type ? ` (${e.type})` : ''}`);
  const phones = (person.phoneNumbers ?? []).map(p => `${p.value}${p.type ? ` (${p.type})` : ''}`);
  const org = person.organizations?.[0];
  const address = person.addresses?.[0];
  const lines = [
    `${index}. **${name}**`,
    `   Resource: \`${person.resourceName}\``,
    emails.length ? `   Email: ${emails.join(', ')}` : '',
    phones.length ? `   Phone: ${phones.join(', ')}` : '',
    org ? `   ${[org.title, org.name].filter(Boolean).join(' @ ')}` : '',
    address?.formattedValue ? `   Address: ${address.formattedValue}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function buildContactPayload({ given_name, family_name, email, phone, company, job_title } = {}) {
  const payload = {};
  if (given_name || family_name) {
    payload.names = [{
      givenName: given_name ?? '',
      familyName: family_name ?? '',
    }];
  }
  if (email) payload.emailAddresses = [{ value: email, type: 'home' }];
  if (phone) payload.phoneNumbers = [{ value: phone, type: 'mobile' }];
  if (company || job_title) {
    payload.organizations = [{
      name: company ?? '',
      title: job_title ?? '',
    }];
  }
  return payload;
}

export async function executeContactsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'contacts_get_my_profile': {
      const profile = await ContactsAPI.getMyProfile(credentials);
      const name = ContactsAPI.getDisplayName(profile);
      const emails = (profile.emailAddresses ?? []).map(e => e.value);
      const phones = (profile.phoneNumbers ?? []).map(p => p.value);
      const org = profile.organizations?.[0];
      const bio = profile.biographies?.[0]?.value;
      return [
        `**${name}**`,
        profile.resourceName ? `Resource: \`${profile.resourceName}\`` : '',
        emails.length ? `Email: ${emails.join(', ')}` : '',
        phones.length ? `Phone: ${phones.join(', ')}` : '',
        org ? `Work: ${[org.title, org.name].filter(Boolean).join(' @ ')}` : '',
        bio ? `Bio: ${bio.slice(0, 200)}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'contacts_list': {
      const { max_results = 50 } = params;
      const { contacts, totalItems } = await ContactsAPI.listContacts(credentials, { maxResults: max_results });
      if (!contacts.length) return 'No contacts found in your Google account.';
      return `Contacts (${contacts.length} of ${totalItems}):\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`;
    }

    case 'contacts_search': {
      const { query, max_results = 10 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const contacts = await ContactsAPI.searchContacts(credentials, query.trim(), max_results);
      if (!contacts.length) return `No contacts found matching "${query}".`;
      return `Search "${query}" — ${contacts.length} result${contacts.length !== 1 ? 's' : ''}:\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`;
    }

    case 'contacts_get': {
      const { resource_name } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      const contact = await ContactsAPI.getContact(credentials, resource_name.trim());
      return formatPerson(contact, '');
    }

    case 'contacts_create': {
      const payload = buildContactPayload(params);
      if (!Object.keys(payload).length) throw new Error('At least one field (given_name, email, phone, etc.) is required.');
      const contact = await ContactsAPI.createContact(credentials, payload);
      const name = ContactsAPI.getDisplayName(contact);
      return [
        `Contact created: **${name}**`,
        `Resource: \`${contact.resourceName}\``,
        ContactsAPI.getPrimaryEmail(contact) ? `Email: ${ContactsAPI.getPrimaryEmail(contact)}` : '',
        ContactsAPI.getPrimaryPhone(contact) ? `Phone: ${ContactsAPI.getPrimaryPhone(contact)}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'contacts_update': {
      const { resource_name, ...fields } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      const updateData = buildContactPayload(fields);
      if (!Object.keys(updateData).length) throw new Error('At least one field to update is required.');
      const updatePersonFields = Object.keys(updateData).join(',');
      const contact = await ContactsAPI.updateContact(credentials, resource_name.trim(), updateData, updatePersonFields);
      const name = ContactsAPI.getDisplayName(contact);
      return [
        `Contact updated: **${name}**`,
        `Resource: \`${contact.resourceName}\``,
        ContactsAPI.getPrimaryEmail(contact) ? `Email: ${ContactsAPI.getPrimaryEmail(contact)}` : '',
        ContactsAPI.getPrimaryPhone(contact) ? `Phone: ${ContactsAPI.getPrimaryPhone(contact)}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'contacts_delete': {
      const { resource_name } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      await ContactsAPI.deleteContact(credentials, resource_name.trim());
      return `Contact \`${resource_name}\` permanently deleted.`;
    }

    default:
      throw new Error(`Unknown Contacts tool: ${toolName}`);
  }
}
