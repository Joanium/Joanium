import defineFeature from '../../../Core/DefineFeature.js';
import * as FormsAPI from './API/FormsAPI.js';
import { FORMS_TOOLS } from './Chat/Tools.js';
import { executeFormsChatTool } from './Chat/ChatExecutor.js';
import { withGoogle } from '../../Common.js';
export default defineFeature({
  id: 'forms',
  name: 'Google Forms',
  dependsOn: ['google-workspace'],
  connectors: {
    serviceExtensions: [
      {
        target: 'google',
        subServices: [
          {
            key: 'forms',
            icon: '<img src="../../../Assets/Icons/Forms.png" alt="Google Forms" style="width: 26px; height: 26px; object-fit: contain;" />',
            name: 'Google Forms',
            apiUrl: 'https://console.cloud.google.com/apis/library/forms.googleapis.com',
          },
        ],
        capabilities: [
          'Read Google Form structure and questions',
          'Retrieve and analyze form responses',
        ],
      },
    ],
  },
  main: {
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
      executeChatTool: async (ctx, { toolName: toolName, params: params }) =>
        executeFormsChatTool(ctx, toolName, params),
    },
  },
  renderer: { chatTools: FORMS_TOOLS },
});
