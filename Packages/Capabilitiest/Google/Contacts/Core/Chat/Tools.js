export const CONTACTS_TOOLS = [
  {
    name: 'contacts_get_my_profile',
    description: "Get the authenticated user's own Google profile — name, email, phone, and organization.",
    category: 'contacts',
    parameters: {},
  },
  {
    name: 'contacts_list',
    description: "List the user's Google Contacts.",
    category: 'contacts',
    parameters: {
      max_results: { type: 'number', required: false, description: 'Max contacts to return (default: 50, max: 1000).' },
    },
  },
  {
    name: 'contacts_search',
    description: 'Search Google Contacts by name, email, or phone number.',
    category: 'contacts',
    parameters: {
      query:       { type: 'string', required: true,  description: 'Search term (name, email, or phone).' },
      max_results: { type: 'number', required: false, description: 'Max results to return (default: 10).' },
    },
  },
  {
    name: 'contacts_get',
    description: 'Get full details for a specific contact by their resource name.',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: "Contact resource name (e.g. 'people/c12345678'). Get from contacts_list or contacts_search." },
    },
  },
  {
    name: 'contacts_create',
    description: 'Create a new Google Contact.',
    category: 'contacts',
    parameters: {
      given_name:   { type: 'string', required: false, description: 'First name.' },
      family_name:  { type: 'string', required: false, description: 'Last name.' },
      email:        { type: 'string', required: false, description: 'Primary email address.' },
      phone:        { type: 'string', required: false, description: 'Primary phone number.' },
      company:      { type: 'string', required: false, description: 'Company or organization name.' },
      job_title:    { type: 'string', required: false, description: 'Job title.' },
    },
  },
  {
    name: 'contacts_update',
    description: 'Update an existing contact. Provide only the fields you want to change.',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true,  description: "Contact resource name (e.g. 'people/c12345678')." },
      given_name:    { type: 'string', required: false, description: 'New first name.' },
      family_name:   { type: 'string', required: false, description: 'New last name.' },
      email:         { type: 'string', required: false, description: 'New primary email.' },
      phone:         { type: 'string', required: false, description: 'New primary phone number.' },
      company:       { type: 'string', required: false, description: 'New company name.' },
      job_title:     { type: 'string', required: false, description: 'New job title.' },
    },
  },
  {
    name: 'contacts_delete',
    description: 'Permanently delete a Google Contact.',
    category: 'contacts',
    parameters: {
      resource_name: { type: 'string', required: true, description: "Contact resource name (e.g. 'people/c12345678')." },
    },
  },
];
