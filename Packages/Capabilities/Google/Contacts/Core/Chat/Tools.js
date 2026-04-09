export const CONTACTS_TOOLS = [
  {
    name: 'contacts_get_my_profile',
    description:
      "Get the authenticated user's own Google profile — name, email, phone, and organization.",
    category: 'contacts',
    parameters: {},
  },
  {
    name: 'contacts_list',
    description: "List the user's Google Contacts.",
    category: 'contacts',
    parameters: {
      max_results: {
        type: 'number',
        required: false,
        description: 'Max contacts to return (default: 50, max: 1000).',
      },
    },
  },
  {
    name: 'contacts_search',
    description: 'Search Google Contacts by name, email, or phone number.',
    category: 'contacts',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Search term (name, email, or phone).',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max results to return (default: 10).',
      },
    },
  },
  {
    name: 'contacts_get',
    description: 'Get full details for a specific contact by their resource name.',
    category: 'contacts',
    parameters: {
      resource_name: {
        type: 'string',
        required: true,
        description:
          "Contact resource name (e.g. 'people/c12345678'). Get from contacts_list or contacts_search.",
      },
    },
  },
  {
    name: 'contacts_create',
    description: 'Create a new Google Contact.',
    category: 'contacts',
    parameters: {
      given_name: { type: 'string', required: false, description: 'First name.' },
      family_name: { type: 'string', required: false, description: 'Last name.' },
      email: { type: 'string', required: false, description: 'Primary email address.' },
      phone: { type: 'string', required: false, description: 'Primary phone number.' },
      company: { type: 'string', required: false, description: 'Company or organization name.' },
      job_title: { type: 'string', required: false, description: 'Job title.' },
    },
  },
  {
    name: 'contacts_update',
    description: 'Update an existing contact. Provide only the fields you want to change.',
    category: 'contacts',
    parameters: {
      resource_name: {
        type: 'string',
        required: true,
        description: "Contact resource name (e.g. 'people/c12345678').",
      },
      given_name: { type: 'string', required: false, description: 'New first name.' },
      family_name: { type: 'string', required: false, description: 'New last name.' },
      email: { type: 'string', required: false, description: 'New primary email.' },
      phone: { type: 'string', required: false, description: 'New primary phone number.' },
      company: { type: 'string', required: false, description: 'New company name.' },
      job_title: { type: 'string', required: false, description: 'New job title.' },
    },
  },
  {
    name: 'contacts_delete',
    description: 'Permanently delete a Google Contact.',
    category: 'contacts',
    parameters: {
      resource_name: {
        type: 'string',
        required: true,
        description: "Contact resource name (e.g. 'people/c12345678').",
      },
    },
  },
  {
    name: 'contacts_list_all',
    description:
      'Retrieve every contact in the account by automatically paginating through all pages. Use when you need a complete dataset rather than a capped snapshot.',
    category: 'contacts',
    parameters: {},
  },
  {
    name: 'contacts_count',
    description: "Return the total number of contacts stored in the user's Google account.",
    category: 'contacts',
    parameters: {},
  },
  {
    name: 'contacts_bulk_create',
    description:
      'Create multiple new contacts in one call. Pass an array of contact objects. Each item may have given_name, family_name, email, phone, company, and job_title.',
    category: 'contacts',
    parameters: {
      contacts: {
        type: 'array',
        required: true,
        description:
          'Array of contact objects. Each object supports: given_name, family_name, email, phone, company, job_title.',
      },
    },
  },
  {
    name: 'contacts_bulk_delete',
    description: 'Permanently delete multiple contacts in one call.',
    category: 'contacts',
    parameters: {
      resource_names: {
        type: 'array',
        required: true,
        description:
          "Array of resource name strings to delete (e.g. ['people/c123', 'people/c456']).",
      },
    },
  },
  {
    name: 'contacts_add_email',
    description:
      'Append an additional email address to an existing contact without overwriting their current emails.',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      email: { type: 'string', required: true, description: 'Email address to add.' },
      type: {
        type: 'string',
        required: false,
        description: "Label for the email: 'home', 'work', 'other'. Default: 'home'.",
      },
    },
  },
  {
    name: 'contacts_add_phone',
    description:
      'Append an additional phone number to an existing contact without overwriting their current numbers.',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      phone: { type: 'string', required: true, description: 'Phone number to add.' },
      type: {
        type: 'string',
        required: false,
        description: "Label: 'mobile', 'home', 'work', 'other'. Default: 'mobile'.",
      },
    },
  },
  {
    name: 'contacts_set_note',
    description: 'Set or replace the freeform notes / biography field on a contact.',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      note: { type: 'string', required: true, description: 'Note text to save.' },
    },
  },
  {
    name: 'contacts_add_address',
    description: 'Add a mailing address to a contact.',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      street_address: { type: 'string', required: false, description: 'Street and number.' },
      city: { type: 'string', required: false, description: 'City.' },
      region: { type: 'string', required: false, description: 'State or province.' },
      postal_code: { type: 'string', required: false, description: 'ZIP or postal code.' },
      country: { type: 'string', required: false, description: 'Country name.' },
      type: {
        type: 'string',
        required: false,
        description: "Label: 'home', 'work', 'other'. Default: 'home'.",
      },
    },
  },
  {
    name: 'contacts_add_website',
    description: 'Add a website URL to a contact (personal site, LinkedIn, GitHub, etc.).',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      url: { type: 'string', required: true, description: 'Full URL (include https://).' },
      type: {
        type: 'string',
        required: false,
        description: "Label: 'homePage', 'work', 'blog', 'profile', 'other'. Default: 'homePage'.",
      },
    },
  },
  {
    name: 'contacts_set_birthday',
    description:
      "Set or replace a contact's birthday. Year is optional (use 0 or omit to store month/day only).",
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      month: { type: 'number', required: true, description: 'Month (1–12).' },
      day: { type: 'number', required: true, description: 'Day (1–31).' },
      year: { type: 'number', required: false, description: 'Four-digit year (optional).' },
    },
  },
  {
    name: 'contacts_add_relation',
    description:
      'Record a named relationship on a contact (e.g. spouse, manager, assistant, friend).',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      related_person: {
        type: 'string',
        required: true,
        description: "Name of the related person (e.g. 'Jane Doe').",
      },
      relation_type: {
        type: 'string',
        required: false,
        description:
          "Relationship type: 'spouse', 'child', 'parent', 'manager', 'assistant', 'friend', 'relative', 'partner', 'colleague', 'other'. Default: 'friend'.",
      },
    },
  },
  {
    name: 'contacts_list_birthdays',
    description:
      'List all contacts that have a birthday recorded, sorted by first name. Useful for building a birthday calendar.',
    category: 'contacts',
    parameters: {},
  },
  {
    name: 'contacts_list_by_company',
    description:
      'Filter contacts by company or organisation name. Returns all contacts whose company field contains the search term.',
    category: 'contacts',
    parameters: {
      company: {
        type: 'string',
        required: true,
        description: 'Company name or partial name to filter by.',
      },
    },
  },
  {
    name: 'contacts_search_by_email',
    description: 'Find a contact by their exact or partial email address.',
    category: 'contacts',
    parameters: {
      email: { type: 'string', required: true, description: 'Email address (full or partial).' },
      max_results: { type: 'number', required: false, description: 'Max results (default: 10).' },
    },
  },
  {
    name: 'contacts_search_by_phone',
    description: 'Find a contact by their phone number.',
    category: 'contacts',
    parameters: {
      phone: { type: 'string', required: true, description: 'Phone number (full or partial).' },
      max_results: { type: 'number', required: false, description: 'Max results (default: 10).' },
    },
  },
  {
    name: 'contacts_find_duplicates',
    description:
      'Scan all contacts and surface groups that share the same name or email address — potential duplicates worth reviewing or merging.',
    category: 'contacts',
    parameters: {},
  },
  {
    name: 'contacts_export_csv',
    description:
      'Export all contacts as a CSV-formatted string with columns: Name, Email, Phone, Company, Job Title, Resource Name. Suitable for copying into a spreadsheet.',
    category: 'contacts',
    parameters: {},
  },
  {
    name: 'contacts_remove_email',
    description: "Remove a specific email address from a contact's list of emails.",
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      email: { type: 'string', required: true, description: 'The exact email address to remove.' },
    },
  },
  {
    name: 'contacts_remove_phone',
    description: "Remove a specific phone number from a contact's list of phone numbers.",
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: 'Contact resource name.' },
      phone: { type: 'string', required: true, description: 'The exact phone number to remove.' },
    },
  },
  {
    name: 'contacts_list_recent',
    description:
      'List contacts that were created or last modified on or after a given date. Useful for syncing or auditing recent changes.',
    category: 'contacts',
    parameters: {
      since_date: {
        type: 'string',
        required: true,
        description:
          "ISO 8601 date string to filter from (e.g. '2024-01-01'). Returns contacts updated on or after this date.",
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Max contacts to return (default: 50).',
      },
    },
  },
];
