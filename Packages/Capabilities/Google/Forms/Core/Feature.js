import createGoogleFeature from '../../Core/GoogleFeatureFactory.js';
import * as FormsAPI from './API/FormsAPI.js';
import { FORMS_TOOLS } from './Chat/Tools.js';
import { executeFormsChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default createGoogleFeature({
  id: 'forms',
  name: 'Google Forms',
  iconFile: 'Forms.png',
  apiUrl: 'https://console.cloud.google.com/apis/library/forms.googleapis.com',
  capabilities: ['Read Google Form structure and questions', 'Retrieve and analyze form responses'],
  methods: {
    getForm: async (ctx, { formId: formId }) =>
      withGoogle(ctx, async (credentials) => {
        if (!formId) return { ok: !1, error: 'formId is required' };
        const form = await FormsAPI.getForm(credentials, formId);
        return { ok: !0, form: form, questions: FormsAPI.extractQuestions(form) };
      }),
    listResponses: async (
      ctx,
      { formId: formId, maxResults: maxResults = 50, filter: filter } = {},
    ) =>
      withGoogle(ctx, async (credentials) =>
        formId
          ? {
              ok: !0,
              ...(await FormsAPI.listResponses(credentials, formId, {
                maxResults: maxResults,
                filter: filter,
              })),
            }
          : { ok: !1, error: 'formId is required' },
      ),
    getResponse: async (ctx, { formId: formId, responseId: responseId }) =>
      withGoogle(ctx, async (credentials) =>
        formId && responseId
          ? { ok: !0, response: await FormsAPI.getResponse(credentials, formId, responseId) }
          : { ok: !1, error: 'formId and responseId are required' },
      ),
  },
  chatTools: FORMS_TOOLS,
  executeChatTool: executeFormsChatTool,
});
