import createGoogleFeature from '../../Core/GoogleFeatureFactory.js';
import * as ContactsAPI from './API/ContactsAPI.js';
import { CONTACTS_TOOLS } from './Chat/Tools.js';
import { executeContactsChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default createGoogleFeature({
  id: 'contacts',
  name: 'Google Contacts',
  iconFile: 'Contacts.png',
  apiUrl: 'https://console.cloud.google.com/apis/library/people.googleapis.com',
  capabilities: ['Search, view, and manage Google Contacts'],
  methods: {
    getMyProfile: async (ctx) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        profile: await ContactsAPI.getMyProfile(credentials),
      })),
    listContacts: async (ctx, { maxResults: maxResults = 50 } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        ...(await ContactsAPI.listContacts(credentials, { maxResults: maxResults })),
      })),
    searchContacts: async (ctx, { query: query, maxResults: maxResults = 10 }) =>
      withGoogle(ctx, async (credentials) =>
        query?.trim()
          ? { ok: !0, contacts: await ContactsAPI.searchContacts(credentials, query, maxResults) }
          : { ok: !1, error: 'query is required' },
      ),
    getContact: async (ctx, { resourceName: resourceName }) =>
      withGoogle(ctx, async (credentials) =>
        resourceName
          ? { ok: !0, contact: await ContactsAPI.getContact(credentials, resourceName) }
          : { ok: !1, error: 'resourceName is required' },
      ),
    createContact: async (ctx, { contactData: contactData = {} } = {}) =>
      withGoogle(ctx, async (credentials) => ({
        ok: !0,
        contact: await ContactsAPI.createContact(credentials, contactData),
      })),
    updateContact: async (
      ctx,
      {
        resourceName: resourceName,
        updateData: updateData = {},
        updatePersonFields: updatePersonFields,
      },
    ) =>
      withGoogle(ctx, async (credentials) =>
        resourceName
          ? {
              ok: !0,
              contact: await ContactsAPI.updateContact(
                credentials,
                resourceName,
                updateData,
                updatePersonFields,
              ),
            }
          : { ok: !1, error: 'resourceName is required' },
      ),
    deleteContact: async (ctx, { resourceName: resourceName }) =>
      withGoogle(ctx, async (credentials) =>
        resourceName
          ? (await ContactsAPI.deleteContact(credentials, resourceName), { ok: !0 })
          : { ok: !1, error: 'resourceName is required' },
      ),
  },
  chatTools: CONTACTS_TOOLS,
  executeChatTool: executeContactsChatTool,
});
