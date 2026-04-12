const FORMS_BASE = 'https://forms.googleapis.com/v1/forms';
async function formsFetch(creds, url, options = {}) {
  const fresh = await (async function (creds) {
      const { getFreshCreds: getFreshCreds } = await import('../../../GoogleWorkspace.js');
      return getFreshCreds(creds);
    })(creds),
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Forms API error (${res.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    );
  }
  return 204 === res.status ? null : res.json();
}
export async function getForm(creds, formId) {
  return formsFetch(creds, `${FORMS_BASE}/${formId}`);
}
export async function listResponses(
  creds,
  formId,
  { maxResults: maxResults = 50, filter: filter } = {},
) {
  const params = new URLSearchParams({ pageSize: String(Math.min(maxResults, 5e3)) });
  filter && params.set('filter', filter);
  const data = await formsFetch(creds, `${FORMS_BASE}/${formId}/responses?${params}`);
  return { responses: data.responses ?? [], totalResponses: data.totalSize ?? 0 };
}
export async function getResponse(creds, formId, responseId) {
  return formsFetch(creds, `${FORMS_BASE}/${formId}/responses/${responseId}`);
}
export function extractQuestions(form) {
  const questions = [];
  for (const item of form.items ?? []) {
    const q = {
      itemId: item.itemId,
      title: item.title ?? '',
      description: item.description ?? '',
      type: 'UNKNOWN',
      required: !1,
      questionId: null,
    };
    if (item.questionItem) {
      const question = item.questionItem.question;
      ((q.questionId = question?.questionId ?? null),
        (q.required = question?.required ?? !1),
        question?.choiceQuestion
          ? (q.type = question.choiceQuestion.type)
          : question?.textQuestion
            ? (q.type = 'TEXT')
            : question?.scaleQuestion
              ? (q.type = 'SCALE')
              : question?.dateQuestion
                ? (q.type = 'DATE')
                : question?.timeQuestion
                  ? (q.type = 'TIME')
                  : question?.fileUploadQuestion
                    ? (q.type = 'FILE_UPLOAD')
                    : question?.rowQuestion && (q.type = 'ROW'),
        question?.choiceQuestion?.options &&
          (q.options = question.choiceQuestion.options.map((o) => o.value)),
        question?.scaleQuestion &&
          (q.scale = { low: question.scaleQuestion.low, high: question.scaleQuestion.high }));
    } else
      item.questionGroupItem
        ? (q.type = 'QUESTION_GROUP')
        : item.pageBreakItem
          ? (q.type = 'PAGE_BREAK')
          : item.textItem
            ? (q.type = 'SECTION_TEXT')
            : item.imageItem
              ? (q.type = 'IMAGE')
              : item.videoItem && (q.type = 'VIDEO');
    questions.push(q);
  }
  return questions;
}
export function extractAnswerValue(answer) {
  return answer
    ? answer.textAnswers?.answers?.length
      ? answer.textAnswers.answers.map((a) => a.value).join(', ')
      : answer.fileUploadAnswers?.answers?.length
        ? answer.fileUploadAnswers.answers.map((a) => a.fileId ?? a.fileName ?? '(file)').join(', ')
        : '(no answer)'
    : '(no answer)';
}
