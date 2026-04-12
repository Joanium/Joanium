import * as ContactsAPI from '../API/ContactsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';
import { formatPerson, formatBirthday, buildContactPayload } from './Utils.js';
export async function executeContactsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);
  switch (toolName) {
    case 'contacts_get_my_profile': {
      const profile = await ContactsAPI.getMyProfile(credentials),
        name = ContactsAPI.getDisplayName(profile),
        emails = (profile.emailAddresses ?? []).map((e) => e.value),
        phones = (profile.phoneNumbers ?? []).map((p) => p.value),
        org = profile.organizations?.[0],
        bio = profile.biographies?.[0]?.value;
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
      const { max_results: max_results = 50 } = params,
        { contacts: contacts, totalItems: totalItems } = await ContactsAPI.listContacts(
          credentials,
          { maxResults: max_results },
        );
      return contacts.length
        ? `Contacts (${contacts.length} of ${totalItems}):\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`
        : 'No contacts found in your Google account.';
    }
    case 'contacts_search': {
      const { query: query, max_results: max_results = 10 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const contacts = await ContactsAPI.searchContacts(credentials, query.trim(), max_results);
      return contacts.length
        ? `Search "${query}" — ${contacts.length} result${1 !== contacts.length ? 's' : ''}:\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`
        : `No contacts found matching "${query}".`;
    }
    case 'contacts_get': {
      const { resource_name: resource_name } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      const contact = await ContactsAPI.getContact(credentials, resource_name.trim());
      return formatPerson(contact, '');
    }
    case 'contacts_create': {
      const payload = buildContactPayload(params);
      if (!Object.keys(payload).length)
        throw new Error('At least one field (given_name, email, phone, etc.) is required.');
      const contact = await ContactsAPI.createContact(credentials, payload);
      return [
        `Contact created: **${ContactsAPI.getDisplayName(contact)}**`,
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
      const { resource_name: resource_name, ...fields } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      const updateData = buildContactPayload(fields);
      if (!Object.keys(updateData).length)
        throw new Error('At least one field to update is required.');
      const updatePersonFields = Object.keys(updateData).join(','),
        contact = await ContactsAPI.updateContact(
          credentials,
          resource_name.trim(),
          updateData,
          updatePersonFields,
        );
      return [
        `Contact updated: **${ContactsAPI.getDisplayName(contact)}**`,
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
      const { resource_name: resource_name } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      return (
        await ContactsAPI.deleteContact(credentials, resource_name.trim()),
        `Contact \`${resource_name}\` permanently deleted.`
      );
    }
    case 'contacts_list_all': {
      const contacts = await ContactsAPI.listAllContacts(credentials);
      return contacts.length
        ? `All contacts (${contacts.length} total):\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`
        : 'No contacts found in your Google account.';
    }
    case 'contacts_count': {
      const total = await ContactsAPI.countContacts(credentials);
      return `Your Google account has **${total.toLocaleString()}** contact${1 !== total ? 's' : ''}.`;
    }
    case 'contacts_bulk_create': {
      const { contacts: contacts } = params;
      if (!Array.isArray(contacts) || !contacts.length)
        throw new Error('contacts must be a non-empty array.');
      const payloads = contacts.map(buildContactPayload),
        results = await ContactsAPI.bulkCreateContacts(credentials, payloads),
        succeeded = results.filter((r) => r.ok),
        failed = results.filter((r) => !r.ok),
        lines = [`Bulk create: ${succeeded.length} created, ${failed.length} failed.`];
      for (const r of succeeded)
        lines.push(`  ✓ ${ContactsAPI.getDisplayName(r.contact)} (\`${r.contact.resourceName}\`)`);
      for (const r of failed) lines.push(`  ✗ ${JSON.stringify(r.input)} — ${r.error}`);
      return lines.join('\n');
    }
    case 'contacts_bulk_delete': {
      const { resource_names: resource_names } = params;
      if (!Array.isArray(resource_names) || !resource_names.length)
        throw new Error('resource_names must be a non-empty array.');
      const results = await ContactsAPI.bulkDeleteContacts(credentials, resource_names),
        succeeded = results.filter((r) => r.ok),
        failed = results.filter((r) => !r.ok),
        lines = [`Bulk delete: ${succeeded.length} deleted, ${failed.length} failed.`];
      for (const r of failed) lines.push(`  ✗ \`${r.resourceName}\` — ${r.error}`);
      return lines.join('\n');
    }
    case 'contacts_add_email': {
      const { resource_name: resource_name, email: email, type: type = 'home' } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!email?.trim()) throw new Error('Missing required param: email');
      const contact = await ContactsAPI.appendEmail(
          credentials,
          resource_name.trim(),
          email.trim(),
          type,
        ),
        allEmails = (contact.emailAddresses ?? []).map((e) => e.value).join(', ');
      return `Email added to **${ContactsAPI.getDisplayName(contact)}**.\nAll emails: ${allEmails}`;
    }
    case 'contacts_add_phone': {
      const { resource_name: resource_name, phone: phone, type: type = 'mobile' } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!phone?.trim()) throw new Error('Missing required param: phone');
      const contact = await ContactsAPI.appendPhone(
          credentials,
          resource_name.trim(),
          phone.trim(),
          type,
        ),
        allPhones = (contact.phoneNumbers ?? []).map((p) => p.value).join(', ');
      return `Phone added to **${ContactsAPI.getDisplayName(contact)}**.\nAll phones: ${allPhones}`;
    }
    case 'contacts_set_note': {
      const { resource_name: resource_name, note: note } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!note?.trim()) throw new Error('Missing required param: note');
      const contact = await ContactsAPI.setNote(credentials, resource_name.trim(), note.trim());
      return `Note saved for **${ContactsAPI.getDisplayName(contact)}**.`;
    }
    case 'contacts_add_address': {
      const {
        resource_name: resource_name,
        street_address: street_address,
        city: city,
        region: region,
        postal_code: postal_code,
        country: country,
        type: type = 'home',
      } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      const contact = await ContactsAPI.setAddress(credentials, resource_name.trim(), {
        streetAddress: street_address,
        city: city,
        region: region,
        postalCode: postal_code,
        country: country,
        type: type,
      });
      return `Address added to **${ContactsAPI.getDisplayName(contact)}**.`;
    }
    case 'contacts_add_website': {
      const { resource_name: resource_name, url: url, type: type = 'homePage' } = params;
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
      const { resource_name: resource_name, month: month, day: day, year: year } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!month || !day) throw new Error('month and day are required.');
      const contact = await ContactsAPI.setBirthday(credentials, resource_name.trim(), {
          year: year,
          month: month,
          day: day,
        }),
        bd = contact.birthdays?.[0]?.date;
      return `Birthday set for **${ContactsAPI.getDisplayName(contact)}**: ${bd ? formatBirthday(bd) : '(saved)'}`;
    }
    case 'contacts_add_relation': {
      const {
        resource_name: resource_name,
        related_person: related_person,
        relation_type: relation_type = 'friend',
      } = params;
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
          const ad = a.birthdays?.[0]?.date ?? {},
            bd = b.birthdays?.[0]?.date ?? {};
          return (ad.month ?? 99) - (bd.month ?? 99) || (ad.day ?? 99) - (bd.day ?? 99);
        }),
        lines = sorted.map((c) => {
          const bd = c.birthdays[0].date;
          return `  ${formatBirthday(bd).padEnd(10)} — **${ContactsAPI.getDisplayName(c)}**`;
        });
      return `Contacts with birthdays (${sorted.length}):\n\n${lines.join('\n')}`;
    }
    case 'contacts_list_by_company': {
      const { company: company } = params;
      if (!company?.trim()) throw new Error('Missing required param: company');
      const contacts = await ContactsAPI.listContactsByCompany(credentials, company.trim());
      return contacts.length
        ? `Contacts at "${company}" (${contacts.length}):\n\n${contacts.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`
        : `No contacts found at "${company}".`;
    }
    case 'contacts_search_by_email': {
      const { email: email, max_results: max_results = 10 } = params;
      if (!email?.trim()) throw new Error('Missing required param: email');
      const matched = (
        await ContactsAPI.searchContacts(credentials, email.trim(), max_results)
      ).filter((c) =>
        c.emailAddresses?.some((e) => e.value.toLowerCase().includes(email.toLowerCase())),
      );
      return matched.length
        ? `Email search "${email}" — ${matched.length} result${1 !== matched.length ? 's' : ''}:\n\n${matched.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`
        : `No contacts found with email matching "${email}".`;
    }
    case 'contacts_search_by_phone': {
      const { phone: phone, max_results: max_results = 10 } = params;
      if (!phone?.trim()) throw new Error('Missing required param: phone');
      const matched = (
        await ContactsAPI.searchContacts(credentials, phone.trim(), max_results)
      ).filter((c) =>
        c.phoneNumbers?.some((p) => p.value.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))),
      );
      return matched.length
        ? `Phone search "${phone}" — ${matched.length} result${1 !== matched.length ? 's' : ''}:\n\n${matched.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`
        : `No contacts found with phone matching "${phone}".`;
    }
    case 'contacts_find_duplicates': {
      const groups = await ContactsAPI.findDuplicates(credentials);
      if (!groups.length) return 'No duplicate contacts detected.';
      const lines = [
        `Found ${groups.length} potential duplicate group${1 !== groups.length ? 's' : ''}:\n`,
      ];
      for (const g of groups)
        (lines.push(`**${g.reason}**`),
          g.contacts.forEach((c, i) => lines.push(formatPerson(c, i + 1))),
          lines.push(''));
      return lines.join('\n');
    }
    case 'contacts_export_csv': {
      const csv = await ContactsAPI.exportContactsCSV(credentials);
      return `CSV export (${csv.split('\n').length - 1} contacts):\n\n\`\`\`csv\n${csv}\n\`\`\``;
    }
    case 'contacts_remove_email': {
      const { resource_name: resource_name, email: email } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!email?.trim()) throw new Error('Missing required param: email');
      const existing = await ContactsAPI.getContact(credentials, resource_name.trim()),
        filtered = (existing.emailAddresses ?? []).filter(
          (e) => e.value.toLowerCase() !== email.toLowerCase(),
        );
      if (filtered.length === (existing.emailAddresses ?? []).length)
        return `Email "${email}" was not found on this contact.`;
      const contact = await ContactsAPI.updateContact(
        credentials,
        resource_name.trim(),
        { emailAddresses: filtered },
        'emailAddresses',
      );
      return `Email "${email}" removed from **${ContactsAPI.getDisplayName(contact)}**.`;
    }
    case 'contacts_remove_phone': {
      const { resource_name: resource_name, phone: phone } = params;
      if (!resource_name?.trim()) throw new Error('Missing required param: resource_name');
      if (!phone?.trim()) throw new Error('Missing required param: phone');
      const existing = await ContactsAPI.getContact(credentials, resource_name.trim()),
        filtered = (existing.phoneNumbers ?? []).filter((p) => p.value !== phone);
      if (filtered.length === (existing.phoneNumbers ?? []).length)
        return `Phone "${phone}" was not found on this contact.`;
      const contact = await ContactsAPI.updateContact(
        credentials,
        resource_name.trim(),
        { phoneNumbers: filtered },
        'phoneNumbers',
      );
      return `Phone "${phone}" removed from **${ContactsAPI.getDisplayName(contact)}**.`;
    }
    case 'contacts_list_recent': {
      const { since_date: since_date, max_results: max_results = 50 } = params;
      if (!since_date?.trim()) throw new Error('Missing required param: since_date');
      const cutoff = new Date(since_date);
      if (isNaN(cutoff))
        throw new Error(`Invalid date: "${since_date}". Use ISO 8601 format, e.g. "2024-01-01".`);
      const recent = (await ContactsAPI.listAllContacts(credentials))
        .filter((c) => {
          const updated = c.metadata?.sources?.[0]?.updateTime;
          return updated && new Date(updated) >= cutoff;
        })
        .slice(0, max_results);
      return recent.length
        ? `Contacts updated since ${since_date} (${recent.length}):\n\n${recent.map((c, i) => formatPerson(c, i + 1)).join('\n\n')}`
        : `No contacts updated on or after ${since_date}.`;
    }
    default:
      throw new Error(`Unknown Contacts tool: ${toolName}`);
  }
}
