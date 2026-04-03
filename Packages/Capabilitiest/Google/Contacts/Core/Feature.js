import defineFeature from '../../../Core/DefineFeature.js';
import * as ContactsAPI from './API/ContactsAPI.js';
import { CONTACTS_TOOLS } from './Chat/Tools.js';
import { executeContactsChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';

export default defineFeature({
  id: 'contacts',
  name: 'Google Contacts',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'contacts',
            icon: '👤',
            name: 'Google Contacts',
            apiUrl: 'https://console.cloud.google.com/apis/library/people.googleapis.com',
          },
        ],
        capabilities: [
          'Search, view, and manage Google Contacts',
        ],
      },
    ],
  },
  main: {
    methods: {
      async getMyProfile(ctx) {
        return withGoogle(ctx, async credentials => ({ ok: true, profile: await ContactsAPI.getMyProfile(credentials) }));
      },

      async listContacts(ctx, { maxResults = 50 } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, ...(await ContactsAPI.listContacts(credentials, { maxResults })) }));
      },

      async searchContacts(ctx, { query, maxResults = 10 }) {
        return withGoogle(ctx, async credentials => {
          if (!query?.trim()) return { ok: false, error: 'query is required' };
          return { ok: true, contacts: await ContactsAPI.searchContacts(credentials, query, maxResults) };
        });
      },

      async getContact(ctx, { resourceName }) {
        return withGoogle(ctx, async credentials => {
          if (!resourceName) return { ok: false, error: 'resourceName is required' };
          return { ok: true, contact: await ContactsAPI.getContact(credentials, resourceName) };
        });
      },

      async createContact(ctx, { contactData = {} } = {}) {
        return withGoogle(ctx, async credentials => ({ ok: true, contact: await ContactsAPI.createContact(credentials, contactData) }));
      },

      async updateContact(ctx, { resourceName, updateData = {}, updatePersonFields }) {
        return withGoogle(ctx, async credentials => {
          if (!resourceName) return { ok: false, error: 'resourceName is required' };
          return { ok: true, contact: await ContactsAPI.updateContact(credentials, resourceName, updateData, updatePersonFields) };
        });
      },

      async deleteContact(ctx, { resourceName }) {
        return withGoogle(ctx, async credentials => {
          if (!resourceName) return { ok: false, error: 'resourceName is required' };
          await ContactsAPI.deleteContact(credentials, resourceName);
          return { ok: true };
        });
      },

      async executeChatTool(ctx, { toolName, params }) {
        return executeContactsChatTool(ctx, toolName, params);
      },
    },
  },
  renderer: {
    chatTools: CONTACTS_TOOLS,
  },
});
