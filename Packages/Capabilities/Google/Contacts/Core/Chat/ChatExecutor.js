import * as ContactsAPI from '../API/ContactsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatPerson(person, index) {
  const name = ContactsAPI.getDisplayName(person);
  const emails = (person.emailAddresses ?? []).map(
    (e) => `${e.value}${e.type ? ` (${e.type})` : ''}`,
  );
  const phones = (person.phoneNumbers ?? []).map(
    (p) => `${p.value}${p.type ? ` (${p.type})` : ''}`,
  );
  const org = person.organizations?.[0];
  const address = person.addresses?.[0];
  const birthday = person.birthdays?.[0]?.date;
  const note = person.biographies?.[0]?.value;
  const urls = (person.urls ?? []).map((u) => `${u.value}${u.type ? ` (${u.type})` : ''}`);
  const relations = (person.relations ?? []).map(
    (r) => `${r.person}${r.type ? ` (${r.type})` : ''}`,
  );
  const prefix = index !== '' ? `${index}. ` : '';
  const lines = [
    `${prefix}**${name}**`,
    `   Resource: \`${person.resourceName}\``,
    emails.length ? `   Email: ${emails.join(', ')}` : '',
    phones.length ? `   Phone: ${phones.join(', ')}` : '',
    org ? `   ${[org.title, org.name].filter(Boolean).join(' @ ')}` : '',
    address?.formattedValue ? `   Address: ${address.formattedValue}` : '',
    birthday ? `   Birthday: ${formatBirthday(birthday)}` : '',
    urls.length ? `   Web: ${urls.join(', ')}` : '',
    relations.length ? `   Relations: ${relations.join(', ')}` : '',
    note ? `   Note: ${note.slice(0, 150)}${note.length > 150 ? '…' : ''}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function formatBirthday({ year, month, day }) {
  const parts = [];
  if (month) parts.push(String(month).padStart(2, '0'));
  if (day) parts.push(String(day).padStart(2, '0'));
  const base = parts.join('/');
  return year ? `${year}/${base}` : base;
}

function buildContactPayload({ given_name, family_name, email, phone, company, job_title } = {}) {
  const payload = {};
  if (given_name || family_name) {
    payload.names = [
      {
        givenName: given_name ?? '',
        familyName: family_name ?? '',
      },
    ];
  }
  if (email) payload.emailAddresses = [{ value: email, type: 'home' }];
  if (phone) payload.phoneNumbers = [{ value: phone, type: 'mobile' }];
  if (company || job_title) {
    payload.organizations = [
      {
        name: company ?? '',
        title: job_title ?? '',
      },
    ];
  }
  return payload;
}

export async function executeContactsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'contacts_get_my_profile': {
      const profile = await ContactsAPI.getMyProfile(credentials);
      const name = ContactsAPI.getDisplayName(profile);
      const emails = (profile.emailAddresses ?? []).map((e) => e.value);
      const phones = (profile.phoneNumbers ?? []).map((p) => p.value);
      const org = profile.organizations?.[0];
      const bio = profile.biographies?.[0]?.value;
      return [
        `**${name}**`,
        profile.resourceName ? `Resource: \`${profile.resourceName}\`` : '',
        emails.length ? `Email: ${emails.join(', ')}` : '',
        phones.length ? `Phone: ${phones.join(', ')}` : '',
        org ? `Work: ${[org.title, org.name].filter(Boolean).join(' @ ')}` : '',
        bio ? `Bio: ${bio.slice(0, 200)}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'contacts_list': {
      const { max_results = 50 } = params;
      const { contacts, totalItems } = await ContactsAPI.listContacts(credentials, {
        maxResults: max_results,
      });
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
      if (!Object.keys(payload).length)
        throw new Error('At least one field (given_name, email, phone, etc.) is required.');
      const contact = await ContactsAPI.createContact(credentials, payload);
      const name = ContactsAPI.getDisplayName(contact);
      return [
        `Contact created: **${name}**`,
        `Resource: \`${contact.resourceName}\``,
        ContactsAPI.getPrimaryEmail(contact)
          ? `Email: ${ContactsAPI.getPrimaryEmail(contact)}`
          : '',
        ContactsAPI.getPrimaryPhone(contact)
          ? `Phone: ${ContactsAPI.getPrimaryPhone(contact)}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'contacts_update': {
      const { resource_name, ...fields } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      const updateData = buildContactPayload(fields);
      if (!Object.keys(updateData).length)
        throw new Error('At least one field to update is required.');
      const updatePersonFields = Object.keys(updateData).join(',');
      const contact = await ContactsAPI.updateContact(
        credentials,
        resource_name.trim(),
        updateData,
        updatePersonFields,
      );
      const name = ContactsAPI.getDisplayName(contact);
      return [
        `Contact updated: **${name}**`,
        `Resource: \`${contact.resourceName}\``,
        ContactsAPI.getPrimaryEmail(contact)
          ? `Email: ${ContactsAPI.getPrimaryEmail(contact)}`
          : '',
        ContactsAPI.getPrimaryPhone(contact)
          ? `Phone: ${ContactsAPI.getPrimaryPhone(contact)}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'contacts_delete': {
      const { resource_name } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      await ContactsAPI.deleteContact(credentials, resource_name.trim());
      return `Contact \`${resource_name}\` permanently deleted.`;
    }

    case 'contacts_list_all': {
      const contacts = await ContactsAPI.listAllContacts(credentials);
      if (!contacts.length) return 'No contacts found in your Google account.';
      return `All contacts (${contacts.length} total):\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`;
    }

    case 'contacts_count': {
      const total = await ContactsAPI.countContacts(credentials);
      return `Your Google account has **${total.toLocaleString()}** contact${total !== 1 ? 's' : ''}.`;
    }

    case 'contacts_bulk_create': {
      const { contacts } = params;
      if (!Array.isArray(contacts) || !contacts.length)
        throw new Error('contacts must be a non-empty array.');
      const payloads = contacts.map(buildContactPayload);
      const results = await ContactsAPI.bulkCreateContacts(credentials, payloads);
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      const lines = [`Bulk create: ${succeeded.length} created, ${failed.length} failed.`];
      for (const r of succeeded) {
        lines.push(`  ✓ ${ContactsAPI.getDisplayName(r.contact)} (\`${r.contact.resourceName}\`)`);
      }
      for (const r of failed) {
        lines.push(`  ✗ ${JSON.stringify(r.input)} — ${r.error}`);
      }
      return lines.join('\n');
    }

    case 'contacts_bulk_delete': {
      const { resource_names } = params;
      if (!Array.isArray(resource_names) || !resource_names.length)
        throw new Error('resource_names must be a non-empty array.');
      const results = await ContactsAPI.bulkDeleteContacts(credentials, resource_names);
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      const lines = [`Bulk delete: ${succeeded.length} deleted, ${failed.length} failed.`];
      for (const r of failed) lines.push(`  ✗ \`${r.resourceName}\` — ${r.error}`);
      return lines.join('\n');
    }

    case 'contacts_add_email': {
      const { resource_name, email, type = 'home' } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!email?.trim()) throw new Error('Missing required param: email');
      const contact = await ContactsAPI.appendEmail(
        credentials,
        resource_name.trim(),
        email.trim(),
        type,
      );
      const allEmails = (contact.emailAddresses ?? []).map((e) => e.value).join(', ');
      return `Email added to **${ContactsAPI.getDisplayName(contact)}**.\nAll emails: ${allEmails}`;
    }

    case 'contacts_add_phone': {
      const { resource_name, phone, type = 'mobile' } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!phone?.trim()) throw new Error('Missing required param: phone');
      const contact = await ContactsAPI.appendPhone(
        credentials,
        resource_name.trim(),
        phone.trim(),
        type,
      );
      const allPhones = (contact.phoneNumbers ?? []).map((p) => p.value).join(', ');
      return `Phone added to **${ContactsAPI.getDisplayName(contact)}**.\nAll phones: ${allPhones}`;
    }

    case 'contacts_set_note': {
      const { resource_name, note } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!note?.trim()) throw new Error('Missing required param: note');
      const contact = await ContactsAPI.setNote(credentials, resource_name.trim(), note.trim());
      return `Note saved for **${ContactsAPI.getDisplayName(contact)}**.`;
    }

    case 'contacts_add_address': {
      const {
        resource_name,
        street_address,
        city,
        region,
        postal_code,
        country,
        type = 'home',
      } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      const contact = await ContactsAPI.setAddress(credentials, resource_name.trim(), {
        streetAddress: street_address,
        city,
        region,
        postalCode: postal_code,
        country,
        type,
      });
      return `Address added to **${ContactsAPI.getDisplayName(contact)}**.`;
    }

    case 'contacts_add_website': {
      const { resource_name, url, type = 'homePage' } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!url?.trim()) throw new Error('Missing required param: url');
      const contact = await ContactsAPI.setWebsite(
        credentials,
        resource_name.trim(),
        url.trim(),
        type,
      );
      return `Website added to **${ContactsAPI.getDisplayName(contact)}**.`;
    }

    case 'contacts_set_birthday': {
      const { resource_name, month, day, year } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!month || !day) throw new Error('month and day are required.');
      const contact = await ContactsAPI.setBirthday(credentials, resource_name.trim(), {
        year,
        month,
        day,
      });
      const bd = contact.birthdays?.[0]?.date;
      return `Birthday set for **${ContactsAPI.getDisplayName(contact)}**: ${bd ? formatBirthday(bd) : '(saved)'}`;
    }

    case 'contacts_add_relation': {
      const { resource_name, related_person, relation_type = 'friend' } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!related_person?.trim()) throw new Error('Missing required param: related_person');
      const contact = await ContactsAPI.addRelation(
        credentials,
        resource_name.trim(),
        related_person.trim(),
        relation_type,
      );
      return `Relation added to **${ContactsAPI.getDisplayName(contact)}**: ${related_person} (${relation_type})`;
    }

    case 'contacts_list_birthdays': {
      const contacts = await ContactsAPI.listContactsWithBirthdays(credentials);
      if (!contacts.length) return 'No contacts with birthdays found.';
      const sorted = contacts.slice().sort((a, b) => {
        const ad = a.birthdays?.[0]?.date ?? {};
        const bd = b.birthdays?.[0]?.date ?? {};
        return (ad.month ?? 99) - (bd.month ?? 99) || (ad.day ?? 99) - (bd.day ?? 99);
      });
      const lines = sorted.map((c) => {
        const bd = c.birthdays[0].date;
        return `  ${formatBirthday(bd).padEnd(10)} — **${ContactsAPI.getDisplayName(c)}**`;
      });
      return `Contacts with birthdays (${sorted.length}):\n\n${lines.join('\n')}`;
    }

    case 'contacts_list_by_company': {
      const { company } = params;
      if (!company?.trim()) throw new Error('Missing required param: company');
      const contacts = await ContactsAPI.listContactsByCompany(credentials, company.trim());
      if (!contacts.length) return `No contacts found at "${company}".`;
      return `Contacts at "${company}" (${contacts.length}):\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`;
    }

    case 'contacts_search_by_email': {
      const { email, max_results = 10 } = params;
      if (!email?.trim()) throw new Error('Missing required param: email');
      const contacts = await ContactsAPI.searchContacts(credentials, email.trim(), max_results);
      const matched = contacts.filter((c) =>
        c.emailAddresses?.some((e) => e.value.toLowerCase().includes(email.toLowerCase())),
      );
      if (!matched.length) return `No contacts found with email matching "${email}".`;
      return `Email search "${email}" — ${matched.length} result${matched.length !== 1 ? 's' : ''}:\n\n${matched.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`;
    }

    case 'contacts_search_by_phone': {
      const { phone, max_results = 10 } = params;
      if (!phone?.trim()) throw new Error('Missing required param: phone');
      const contacts = await ContactsAPI.searchContacts(credentials, phone.trim(), max_results);
      const matched = contacts.filter((c) =>
        c.phoneNumbers?.some((p) => p.value.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))),
      );
      if (!matched.length) return `No contacts found with phone matching "${phone}".`;
      return `Phone search "${phone}" — ${matched.length} result${matched.length !== 1 ? 's' : ''}:\n\n${matched.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`;
    }

    case 'contacts_find_duplicates': {
      const groups = await ContactsAPI.findDuplicates(credentials);
      if (!groups.length) return 'No duplicate contacts detected.';
      const lines = [
        `Found ${groups.length} potential duplicate group${groups.length !== 1 ? 's' : ''}:\n`,
      ];
      for (const g of groups) {
        lines.push(`**${g.reason}**`);
        g.contacts.forEach((c, i) => lines.push(formatPerson(c, i + 1)));
        lines.push('');
      }
      return lines.join('\n');
    }

    case 'contacts_export_csv': {
      const csv = await ContactsAPI.exportContactsCSV(credentials);
      const rowCount = csv.split('\n').length - 1;
      return `CSV export (${rowCount} contacts):\n\n\`\`\`csv\n${csv}\n\`\`\``;
    }

    case 'contacts_remove_email': {
      const { resource_name, email } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!email?.trim()) throw new Error('Missing required param: email');
      const existing = await ContactsAPI.getContact(credentials, resource_name.trim());
      const filtered = (existing.emailAddresses ?? []).filter(
        (e) => e.value.toLowerCase() !== email.toLowerCase(),
      );
      if (filtered.length === (existing.emailAddresses ?? []).length) {
        return `Email "${email}" was not found on this contact.`;
      }
      const contact = await ContactsAPI.updateContact(
        credentials,
        resource_name.trim(),
        { emailAddresses: filtered },
        'emailAddresses',
      );
      return `Email "${email}" removed from **${ContactsAPI.getDisplayName(contact)}**.`;
    }

    case 'contacts_remove_phone': {
      const { resource_name, phone } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!phone?.trim()) throw new Error('Missing required param: phone');
      const existing = await ContactsAPI.getContact(credentials, resource_name.trim());
      const filtered = (existing.phoneNumbers ?? []).filter((p) => p.value !== phone);
      if (filtered.length === (existing.phoneNumbers ?? []).length) {
        return `Phone "${phone}" was not found on this contact.`;
      }
      const contact = await ContactsAPI.updateContact(
        credentials,
        resource_name.trim(),
        { phoneNumbers: filtered },
        'phoneNumbers',
      );
      return `Phone "${phone}" removed from **${ContactsAPI.getDisplayName(contact)}**.`;
    }

    case 'contacts_list_recent': {
      const { since_date, max_results = 50 } = params;
      if (!since_date?.trim()) throw new Error('Missing required param: since_date');
      const cutoff = new Date(since_date);
      if (isNaN(cutoff))
        throw new Error(`Invalid date: "${since_date}". Use ISO 8601 format, e.g. "2024-01-01".`);
      const allContacts = await ContactsAPI.listAllContacts(credentials);
      const recent = allContacts
        .filter((c) => {
          const updated = c.metadata?.sources?.[0]?.updateTime;
          return updated && new Date(updated) >= cutoff;
        })
        .slice(0, max_results);
      if (!recent.length) return `No contacts updated on or after ${since_date}.`;
      return `Contacts updated since ${since_date} (${recent.length}):\n\n${recent.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`;
    }

    default:
      throw new Error(`Unknown Contacts tool: ${toolName}`);
  }
}
