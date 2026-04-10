import * as FormsAPI from '../API/FormsAPI.js';
import { requireGoogleCredentials } from '../../../Common.js';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function typeLabel(type) {
  const map = {
    RADIO: 'Multiple choice',
    CHECKBOX: 'Checkboxes',
    DROP_DOWN: 'Dropdown',
    TEXT: 'Short/long answer',
    SCALE: 'Linear scale',
    DATE: 'Date',
    TIME: 'Time',
    FILE_UPLOAD: 'File upload',
    PAGE_BREAK: 'Page break',
    SECTION_TEXT: 'Section header',
    IMAGE: 'Image',
    VIDEO: 'Video',
    QUESTION_GROUP: 'Grid',
    UNKNOWN: 'Unknown',
  };
  return map[type] ?? type;
}

// Escape a value for CSV — wraps in quotes if it contains commas, quotes, or newlines
function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Compute median of a sorted numeric array
function median(sorted) {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function executeFormsChatTool(ctx, toolName, params = {}) {
  const credentials = requireGoogleCredentials(ctx);

  switch (toolName) {
    case 'forms_get_form': {
      const { form_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const form = await FormsAPI.getForm(credentials, form_id.trim());
      const questions = FormsAPI.extractQuestions(form);
      const questionItems = questions.filter(
        (q) => !['PAGE_BREAK', 'SECTION_TEXT', 'IMAGE', 'VIDEO'].includes(q.type),
      );

      const lines = [
        `**${form.info?.title ?? 'Untitled Form'}**`,
        form.info?.description ? `Description: ${form.info.description}` : '',
        `Form ID: \`${form.formId}\``,
        `Link: ${form.responderUri ?? `https://docs.google.com/forms/d/${form.formId}/viewform`}`,
        `Questions: ${questionItems.length}`,
        '',
        '── Questions ──',
      ];

      questions.forEach((q, i) => {
        if (['PAGE_BREAK', 'SECTION_TEXT'].includes(q.type)) {
          lines.push(`\n— ${q.title || 'Section'} —`);
          return;
        }
        if (['IMAGE', 'VIDEO'].includes(q.type)) return;

        const reqFlag = q.required ? ' *(required)*' : '';
        lines.push(`\n${i + 1}. **${q.title || '(Untitled question)'}**${reqFlag}`);
        lines.push(`   Type: ${typeLabel(q.type)}`);
        if (q.description) lines.push(`   Description: ${q.description}`);
        if (q.options?.length) lines.push(`   Options: ${q.options.join(' · ')}`);
        if (q.scale) lines.push(`   Scale: ${q.scale.low} – ${q.scale.high}`);
        if (q.questionId) lines.push(`   Question ID: \`${q.questionId}\``);
      });

      return lines.filter((v) => v !== null && v !== undefined).join('\n');
    }

    case 'forms_get_summary': {
      const { form_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { totalResponses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: 1 }),
      ]);

      const questions = FormsAPI.extractQuestions(form);
      const answerableCount = questions.filter(
        (q) => !['PAGE_BREAK', 'SECTION_TEXT', 'IMAGE', 'VIDEO'].includes(q.type),
      ).length;

      return [
        `**${form.info?.title ?? 'Untitled Form'}**`,
        form.info?.description ? `Description: ${form.info.description}` : '',
        '',
        `Form ID: \`${form.formId}\``,
        `Responder link: ${form.responderUri ?? `https://docs.google.com/forms/d/${form.formId}/viewform`}`,
        `Edit link: https://docs.google.com/forms/d/${form.formId}/edit`,
        '',
        `Total questions: ${answerableCount}`,
        `Total responses: ${totalResponses}`,
        form.settings?.quizSettings ? 'Type: Quiz' : 'Type: Form',
        form.settings?.quizSettings?.isQuiz ? `Points possible: tracked` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'forms_list_responses': {
      const { form_id, max_results = 50 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const form = await FormsAPI.getForm(credentials, form_id.trim());
      const { responses, totalResponses } = await FormsAPI.listResponses(
        credentials,
        form_id.trim(),
        { maxResults: max_results },
      );

      if (!responses.length) {
        return `No responses found for form "${form.info?.title ?? form_id}".`;
      }

      const questions = FormsAPI.extractQuestions(form);
      const qMap = Object.fromEntries(
        questions.filter((q) => q.questionId).map((q) => [q.questionId, q.title || '(Untitled)']),
      );

      const sections = responses.map((resp, i) => {
        const header = [
          `Response ${i + 1}`,
          `  Response ID: \`${resp.responseId}\``,
          resp.createTime ? `  Submitted: ${formatDate(resp.createTime)}` : '',
          resp.respondentEmail ? `  Respondent: ${resp.respondentEmail}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const answers = Object.entries(resp.answers ?? {}).map(([qId, answer]) => {
          const qTitle = qMap[qId] ?? qId;
          const value = FormsAPI.extractAnswerValue(answer);
          return `  Q: ${qTitle}\n  A: ${value}`;
        });

        return [header, ...answers].join('\n');
      });

      return [
        `**${form.info?.title ?? 'Form'}** — ${responses.length} of ${totalResponses} response(s)`,
        '',
        sections.join('\n\n── ── ──\n\n'),
      ].join('\n');
    }

    case 'forms_get_response': {
      const { form_id, response_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!response_id?.trim()) throw new Error('Missing required param: response_id');

      const [form, resp] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.getResponse(credentials, form_id.trim(), response_id.trim()),
      ]);

      const questions = FormsAPI.extractQuestions(form);
      const qMap = Object.fromEntries(
        questions.filter((q) => q.questionId).map((q) => [q.questionId, q.title || '(Untitled)']),
      );

      const lines = [
        `Response \`${resp.responseId}\``,
        resp.createTime ? `Submitted: ${formatDate(resp.createTime)}` : '',
        resp.respondentEmail ? `Respondent: ${resp.respondentEmail}` : '',
        resp.totalScore != null ? `Score: ${resp.totalScore}` : '',
        '',
        '── Answers ──',
      ];

      for (const [qId, answer] of Object.entries(resp.answers ?? {})) {
        const qTitle = qMap[qId] ?? qId;
        const value = FormsAPI.extractAnswerValue(answer);
        lines.push(`\nQ: ${qTitle}`);
        lines.push(`A: ${value}`);
        if (answer.grade) {
          lines.push(
            `   Score: ${answer.grade.score ?? 0} / ${answer.grade.questionScore?.maxPoints ?? '?'}`,
          );
          if (answer.grade.correct !== undefined) {
            lines.push(`   Correct: ${answer.grade.correct ? 'Yes' : 'No'}`);
          }
        }
      }

      return lines.filter(Boolean).join('\n');
    }

    case 'forms_get_response_count': {
      const { form_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { totalResponses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: 1 }),
      ]);

      return `**${form.info?.title ?? 'Untitled Form'}** has **${totalResponses}** response(s).`;
    }

    case 'forms_get_latest_response': {
      const { form_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: 5000 }),
      ]);

      if (!responses.length) {
        return `No responses found for form "${form.info?.title ?? form_id}".`;
      }

      // Sort descending by createTime, pick first
      const latest = [...responses].sort(
        (a, b) => new Date(b.createTime) - new Date(a.createTime),
      )[0];

      const questions = FormsAPI.extractQuestions(form);
      const qMap = Object.fromEntries(
        questions.filter((q) => q.questionId).map((q) => [q.questionId, q.title || '(Untitled)']),
      );

      const lines = [
        `**Most recent response** for "${form.info?.title ?? form_id}"`,
        `Response ID: \`${latest.responseId}\``,
        latest.createTime ? `Submitted: ${formatDate(latest.createTime)}` : '',
        latest.respondentEmail ? `Respondent: ${latest.respondentEmail}` : '',
        '',
        '── Answers ──',
      ];

      for (const [qId, answer] of Object.entries(latest.answers ?? {})) {
        lines.push(`\nQ: ${qMap[qId] ?? qId}`);
        lines.push(`A: ${FormsAPI.extractAnswerValue(answer)}`);
      }

      return lines.filter(Boolean).join('\n');
    }

    case 'forms_get_first_response': {
      const { form_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: 5000 }),
      ]);

      if (!responses.length) {
        return `No responses found for form "${form.info?.title ?? form_id}".`;
      }

      const first = [...responses].sort(
        (a, b) => new Date(a.createTime) - new Date(b.createTime),
      )[0];

      const questions = FormsAPI.extractQuestions(form);
      const qMap = Object.fromEntries(
        questions.filter((q) => q.questionId).map((q) => [q.questionId, q.title || '(Untitled)']),
      );

      const lines = [
        `**First response** for "${form.info?.title ?? form_id}"`,
        `Response ID: \`${first.responseId}\``,
        first.createTime ? `Submitted: ${formatDate(first.createTime)}` : '',
        first.respondentEmail ? `Respondent: ${first.respondentEmail}` : '',
        '',
        '── Answers ──',
      ];

      for (const [qId, answer] of Object.entries(first.answers ?? {})) {
        lines.push(`\nQ: ${qMap[qId] ?? qId}`);
        lines.push(`A: ${FormsAPI.extractAnswerValue(answer)}`);
      }

      return lines.filter(Boolean).join('\n');
    }

    case 'forms_get_responses_in_range': {
      const { form_id, start_date, end_date, max_results = 50 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!start_date?.trim()) throw new Error('Missing required param: start_date');
      if (!end_date?.trim()) throw new Error('Missing required param: end_date');

      const start = new Date(start_date);
      const end = new Date(end_date);
      if (isNaN(start) || isNaN(end)) throw new Error('Invalid date format. Use ISO 8601.');

      const [form, { responses, totalResponses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: 5000 }),
      ]);

      const filtered = responses
        .filter((r) => {
          const t = new Date(r.createTime);
          return t >= start && t <= end;
        })
        .slice(0, max_results);

      if (!filtered.length) {
        return `No responses found between ${formatDate(start_date)} and ${formatDate(end_date)}.`;
      }

      const questions = FormsAPI.extractQuestions(form);
      const qMap = Object.fromEntries(
        questions.filter((q) => q.questionId).map((q) => [q.questionId, q.title || '(Untitled)']),
      );

      const sections = filtered.map((resp, i) => {
        const header = [
          `Response ${i + 1} — \`${resp.responseId}\``,
          resp.createTime ? `  Submitted: ${formatDate(resp.createTime)}` : '',
          resp.respondentEmail ? `  Respondent: ${resp.respondentEmail}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        const answers = Object.entries(resp.answers ?? {}).map(
          ([qId, answer]) =>
            `  Q: ${qMap[qId] ?? qId}\n  A: ${FormsAPI.extractAnswerValue(answer)}`,
        );
        return [header, ...answers].join('\n');
      });

      return [
        `**${form.info?.title ?? 'Form'}** — ${filtered.length} response(s) between ${formatDate(start_date)} and ${formatDate(end_date)} (out of ${totalResponses} total)`,
        '',
        sections.join('\n\n── ── ──\n\n'),
      ].join('\n');
    }

    case 'forms_find_responses_by_email': {
      const { form_id, email } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!email?.trim()) throw new Error('Missing required param: email');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: 5000 }),
      ]);

      const needle = email.trim().toLowerCase();
      const matched = responses.filter((r) => r.respondentEmail?.toLowerCase() === needle);

      if (!matched.length) {
        return `No responses found from "${email}" in form "${form.info?.title ?? form_id}".`;
      }

      const questions = FormsAPI.extractQuestions(form);
      const qMap = Object.fromEntries(
        questions.filter((q) => q.questionId).map((q) => [q.questionId, q.title || '(Untitled)']),
      );

      const sections = matched.map((resp, i) => {
        const header = [
          `Response ${i + 1} — \`${resp.responseId}\``,
          resp.createTime ? `  Submitted: ${formatDate(resp.createTime)}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        const answers = Object.entries(resp.answers ?? {}).map(
          ([qId, answer]) =>
            `  Q: ${qMap[qId] ?? qId}\n  A: ${FormsAPI.extractAnswerValue(answer)}`,
        );
        return [header, ...answers].join('\n');
      });

      return [
        `**${matched.length} response(s)** from ${email} in "${form.info?.title ?? form_id}"`,
        '',
        sections.join('\n\n── ── ──\n\n'),
      ].join('\n');
    }

    case 'forms_search_responses': {
      const { form_id, keyword, max_results = 200 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!keyword?.trim()) throw new Error('Missing required param: keyword');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const needle = keyword.trim().toLowerCase();
      const questions = FormsAPI.extractQuestions(form);
      const qMap = Object.fromEntries(
        questions.filter((q) => q.questionId).map((q) => [q.questionId, q.title || '(Untitled)']),
      );

      const matched = responses.filter((resp) =>
        Object.values(resp.answers ?? {}).some((answer) =>
          FormsAPI.extractAnswerValue(answer).toLowerCase().includes(needle),
        ),
      );

      if (!matched.length) {
        return `No responses containing "${keyword}" found in form "${form.info?.title ?? form_id}".`;
      }

      const sections = matched.map((resp, i) => {
        const header = [
          `Match ${i + 1} — \`${resp.responseId}\``,
          resp.createTime ? `  Submitted: ${formatDate(resp.createTime)}` : '',
          resp.respondentEmail ? `  Respondent: ${resp.respondentEmail}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        const answers = Object.entries(resp.answers ?? {}).map(([qId, answer]) => {
          const val = FormsAPI.extractAnswerValue(answer);
          const highlight = val.toLowerCase().includes(needle) ? ' ◄' : '';
          return `  Q: ${qMap[qId] ?? qId}\n  A: ${val}${highlight}`;
        });
        return [header, ...answers].join('\n');
      });

      return [
        `**${matched.length} response(s)** containing "${keyword}" in "${form.info?.title ?? form_id}"`,
        '',
        sections.join('\n\n── ── ──\n\n'),
      ].join('\n');
    }

    // ── New tools: question inspection ────────────────────────────────────────

    case 'forms_list_questions': {
      const { form_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const form = await FormsAPI.getForm(credentials, form_id.trim());
      const questions = FormsAPI.extractQuestions(form);

      const lines = [`**${form.info?.title ?? 'Untitled Form'}** — Questions`, ''];

      let qNum = 0;
      for (const q of questions) {
        if (['PAGE_BREAK', 'SECTION_TEXT'].includes(q.type)) {
          lines.push(`\n— ${q.title || 'Section'} —`);
          continue;
        }
        if (['IMAGE', 'VIDEO'].includes(q.type)) continue;
        qNum++;
        const reqFlag = q.required ? ' *(required)*' : '';
        lines.push(`${qNum}. **${q.title || '(Untitled)'}**${reqFlag} — ${typeLabel(q.type)}`);
        if (q.options?.length) lines.push(`   Options: ${q.options.join(' · ')}`);
        if (q.scale) lines.push(`   Scale: ${q.scale.low} – ${q.scale.high}`);
        if (q.questionId) lines.push(`   ID: \`${q.questionId}\``);
      }

      return lines.join('\n');
    }

    case 'forms_get_question_by_title': {
      const { form_id, title_query } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!title_query?.trim()) throw new Error('Missing required param: title_query');

      const form = await FormsAPI.getForm(credentials, form_id.trim());
      const questions = FormsAPI.extractQuestions(form);
      const needle = title_query.trim().toLowerCase();

      const matches = questions.filter((q) => q.title?.toLowerCase().includes(needle));

      if (!matches.length) {
        return `No questions matching "${title_query}" found in form "${form.info?.title ?? form_id}".`;
      }

      const lines = [
        `**${matches.length} question(s)** matching "${title_query}" in "${form.info?.title ?? form_id}"`,
        '',
      ];

      matches.forEach((q, i) => {
        lines.push(`${i + 1}. **${q.title}**`);
        lines.push(`   Type: ${typeLabel(q.type)}`);
        lines.push(`   Required: ${q.required ? 'Yes' : 'No'}`);
        if (q.description) lines.push(`   Description: ${q.description}`);
        if (q.options?.length) lines.push(`   Options: ${q.options.join(' · ')}`);
        if (q.scale) lines.push(`   Scale: ${q.scale.low} – ${q.scale.high}`);
        if (q.questionId) lines.push(`   Question ID: \`${q.questionId}\``);
        lines.push('');
      });

      return lines.join('\n');
    }

    // ── New tools: analytics ──────────────────────────────────────────────────

    case 'forms_count_answers_for_question': {
      const { form_id, question_id, max_results = 500 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!question_id?.trim()) throw new Error('Missing required param: question_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const questions = FormsAPI.extractQuestions(form);
      const question = questions.find((q) => q.questionId === question_id.trim());
      if (!question) throw new Error(`Question ID "${question_id}" not found in this form.`);

      const counts = {};
      let answered = 0;

      for (const resp of responses) {
        const answer = resp.answers?.[question_id.trim()];
        if (!answer) continue;
        const value = FormsAPI.extractAnswerValue(answer);
        if (value === '(no answer)') continue;
        answered++;
        // Each answer may be comma-joined multi-select — split and count individually
        for (const choice of value.split(', ')) {
          counts[choice] = (counts[choice] ?? 0) + 1;
        }
      }

      if (!answered) {
        return `No answers recorded for question "${question.title}" across ${responses.length} response(s).`;
      }

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const lines = [
        `**"${question.title}"** — Answer breakdown (${answered} of ${responses.length} responded)`,
        '',
      ];

      for (const [option, count] of sorted) {
        const pct = ((count / answered) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round((count / answered) * 20));
        lines.push(`${option}`);
        lines.push(`  ${bar} ${count} (${pct}%)`);
      }

      return lines.join('\n');
    }

    case 'forms_analyze_scale_question': {
      const { form_id, question_id, max_results = 500 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!question_id?.trim()) throw new Error('Missing required param: question_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const questions = FormsAPI.extractQuestions(form);
      const question = questions.find((q) => q.questionId === question_id.trim());
      if (!question) throw new Error(`Question ID "${question_id}" not found in this form.`);

      const values = [];
      for (const resp of responses) {
        const answer = resp.answers?.[question_id.trim()];
        if (!answer) continue;
        const raw = FormsAPI.extractAnswerValue(answer);
        const num = parseFloat(raw);
        if (!isNaN(num)) values.push(num);
      }

      if (!values.length) {
        return `No numeric answers found for question "${question.title}".`;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const med = median(sorted);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];

      // Distribution
      const dist = {};
      for (const v of values) dist[v] = (dist[v] ?? 0) + 1;

      const lines = [
        `**"${question.title}"** — Scale analysis (${values.length} response(s))`,
        '',
        `Average:  ${avg.toFixed(2)}`,
        `Median:   ${med}`,
        `Min:      ${min}`,
        `Max:      ${max}`,
        '',
        '── Distribution ──',
      ];

      for (const [score, count] of Object.entries(dist).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      )) {
        const pct = ((count / values.length) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round((count / values.length) * 20));
        lines.push(`${score}: ${bar} ${count} (${pct}%)`);
      }

      return lines.join('\n');
    }

    case 'forms_collect_text_answers': {
      const { form_id, question_id, max_results = 100 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!question_id?.trim()) throw new Error('Missing required param: question_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const questions = FormsAPI.extractQuestions(form);
      const question = questions.find((q) => q.questionId === question_id.trim());
      if (!question) throw new Error(`Question ID "${question_id}" not found.`);

      const answers = [];
      for (const resp of responses) {
        const answer = resp.answers?.[question_id.trim()];
        const value = FormsAPI.extractAnswerValue(answer);
        if (value && value !== '(no answer)') {
          answers.push({ value, submitted: resp.createTime, email: resp.respondentEmail });
        }
      }

      if (!answers.length) {
        return `No text answers found for question "${question.title}".`;
      }

      const lines = [`**"${question.title}"** — ${answers.length} text answer(s)`, ''];

      answers.forEach((a, i) => {
        const meta = [a.submitted ? formatDate(a.submitted) : '', a.email ? a.email : '']
          .filter(Boolean)
          .join(' · ');
        lines.push(`${i + 1}. ${a.value}${meta ? `\n   _(${meta})_` : ''}`);
      });

      return lines.join('\n');
    }

    case 'forms_get_top_answers': {
      const { form_id, question_id, top_n = 5, max_results = 500 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!question_id?.trim()) throw new Error('Missing required param: question_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const questions = FormsAPI.extractQuestions(form);
      const question = questions.find((q) => q.questionId === question_id.trim());
      if (!question) throw new Error(`Question ID "${question_id}" not found.`);

      const counts = {};
      let total = 0;

      for (const resp of responses) {
        const answer = resp.answers?.[question_id.trim()];
        const value = FormsAPI.extractAnswerValue(answer);
        if (!value || value === '(no answer)') continue;
        total++;
        for (const choice of value.split(', ')) {
          counts[choice] = (counts[choice] ?? 0) + 1;
        }
      }

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, top_n);

      if (!sorted.length) {
        return `No answers found for question "${question.title}".`;
      }

      const lines = [
        `**Top ${sorted.length} answer(s)** for "${question.title}" (${total} response(s))`,
        '',
      ];

      sorted.forEach(([val, count], i) => {
        const pct = ((count / total) * 100).toFixed(1);
        lines.push(`${i + 1}. ${val} — ${count} (${pct}%)`);
      });

      return lines.join('\n');
    }

    case 'forms_get_unanswered_count': {
      const { form_id, max_results = 200 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const questions = FormsAPI.extractQuestions(form).filter(
        (q) => !['PAGE_BREAK', 'SECTION_TEXT', 'IMAGE', 'VIDEO'].includes(q.type) && q.questionId,
      );

      const total = responses.length;
      if (!total) return `No responses found for form "${form.info?.title ?? form_id}".`;

      const lines = [
        `**"${form.info?.title ?? form_id}"** — Skipped questions (${total} response(s))`,
        '',
      ];

      for (const q of questions) {
        const answered = responses.filter((r) => {
          const val = FormsAPI.extractAnswerValue(r.answers?.[q.questionId]);
          return val && val !== '(no answer)';
        }).length;
        const skipped = total - answered;
        const pct = ((skipped / total) * 100).toFixed(1);
        lines.push(`• **${q.title || '(Untitled)'}**: ${skipped} skipped (${pct}%)`);
      }

      return lines.join('\n');
    }

    // ── New tools: quiz support ───────────────────────────────────────────────

    case 'forms_get_score_summary': {
      const { form_id, max_results = 200 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const scoredResponses = responses.filter((r) => r.totalScore != null);
      if (!scoredResponses.length) {
        return `No quiz scores found. Make sure "${form.info?.title ?? form_id}" is a quiz with graded responses.`;
      }

      const scores = scoredResponses.map((r) => r.totalScore).sort((a, b) => a - b);
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const med = median(scores);
      const dist = {};
      for (const s of scores) dist[s] = (dist[s] ?? 0) + 1;

      const lines = [
        `**"${form.info?.title ?? 'Quiz'}"** — Score summary (${scoredResponses.length} graded response(s))`,
        '',
        `Average score: ${avg.toFixed(2)}`,
        `Median score:  ${med}`,
        `Highest score: ${scores[scores.length - 1]}`,
        `Lowest score:  ${scores[0]}`,
        '',
        '── Score distribution ──',
      ];

      for (const [score, count] of Object.entries(dist).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      )) {
        const bar = '█'.repeat(Math.min(count, 30));
        lines.push(`${String(score).padStart(4)}: ${bar} (${count})`);
      }

      return lines.join('\n');
    }

    case 'forms_get_quiz_leaderboard': {
      const { form_id, top_n = 10, max_results = 200 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const scoredResponses = responses
        .filter((r) => r.totalScore != null)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, top_n);

      if (!scoredResponses.length) {
        return `No quiz scores found for "${form.info?.title ?? form_id}".`;
      }

      const lines = [
        `**"${form.info?.title ?? 'Quiz'}"** — Top ${scoredResponses.length} score(s)`,
        '',
      ];

      scoredResponses.forEach((resp, i) => {
        const name = resp.respondentEmail ?? `Anonymous (${resp.responseId.slice(0, 8)})`;
        const submitted = resp.createTime ? ` — ${formatDate(resp.createTime)}` : '';
        lines.push(`${i + 1}. **${resp.totalScore}** pts — ${name}${submitted}`);
      });

      return lines.join('\n');
    }

    // ── New tools: utility ────────────────────────────────────────────────────

    case 'forms_get_respondent_list': {
      const { form_id, max_results = 200 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses, totalResponses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const withEmail = responses.filter((r) => r.respondentEmail);

      if (!withEmail.length) {
        return `No respondent emails found. The form may not be collecting email addresses, or no responses have been submitted yet.`;
      }

      const lines = [
        `**"${form.info?.title ?? form_id}"** — ${withEmail.length} respondent(s) (showing ${withEmail.length} of ${totalResponses} total)`,
        '',
      ];

      withEmail.forEach((resp, i) => {
        const submitted = resp.createTime ? formatDate(resp.createTime) : 'unknown';
        lines.push(`${i + 1}. ${resp.respondentEmail} — submitted ${submitted}`);
      });

      return lines.join('\n');
    }

    case 'forms_compare_responses': {
      const { form_id, response_id_a, response_id_b } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');
      if (!response_id_a?.trim()) throw new Error('Missing required param: response_id_a');
      if (!response_id_b?.trim()) throw new Error('Missing required param: response_id_b');

      const [form, respA, respB] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.getResponse(credentials, form_id.trim(), response_id_a.trim()),
        FormsAPI.getResponse(credentials, form_id.trim(), response_id_b.trim()),
      ]);

      const questions = FormsAPI.extractQuestions(form).filter(
        (q) => !['PAGE_BREAK', 'SECTION_TEXT', 'IMAGE', 'VIDEO'].includes(q.type) && q.questionId,
      );

      const labelA = respA.respondentEmail ?? `Response A (${respA.responseId.slice(0, 8)})`;
      const labelB = respB.respondentEmail ?? `Response B (${respB.responseId.slice(0, 8)})`;

      const lines = [
        `**Comparison** in "${form.info?.title ?? form_id}"`,
        `A: ${labelA}${respA.createTime ? ` — ${formatDate(respA.createTime)}` : ''}`,
        `B: ${labelB}${respB.createTime ? ` — ${formatDate(respB.createTime)}` : ''}`,
        '',
      ];

      for (const q of questions) {
        const valA = FormsAPI.extractAnswerValue(respA.answers?.[q.questionId]);
        const valB = FormsAPI.extractAnswerValue(respB.answers?.[q.questionId]);
        const same = valA === valB;
        lines.push(`**${q.title || '(Untitled)'}**${same ? ' ✓' : ''}`);
        lines.push(`  A: ${valA}`);
        lines.push(`  B: ${valB}`);
        lines.push('');
      }

      return lines.join('\n');
    }

    case 'forms_export_csv': {
      const { form_id, max_results = 200 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses, totalResponses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      if (!responses.length) {
        return `No responses found for form "${form.info?.title ?? form_id}".`;
      }

      const questions = FormsAPI.extractQuestions(form).filter(
        (q) => !['PAGE_BREAK', 'SECTION_TEXT', 'IMAGE', 'VIDEO'].includes(q.type) && q.questionId,
      );

      // Header row
      const headerCols = [
        'Response ID',
        'Submitted',
        'Respondent Email',
        ...questions.map((q) => q.title || q.questionId),
      ];
      const rows = [headerCols.map(csvEscape).join(',')];

      for (const resp of responses) {
        const cols = [
          resp.responseId,
          resp.createTime ? new Date(resp.createTime).toISOString() : '',
          resp.respondentEmail ?? '',
          ...questions.map((q) => FormsAPI.extractAnswerValue(resp.answers?.[q.questionId])),
        ];
        rows.push(cols.map(csvEscape).join(','));
      }

      const csv = rows.join('\n');
      return [
        `**CSV export** for "${form.info?.title ?? form_id}" — ${responses.length} of ${totalResponses} response(s)`,
        '',
        '```csv',
        csv,
        '```',
      ].join('\n');
    }

    case 'forms_get_form_settings': {
      const { form_id } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const form = await FormsAPI.getForm(credentials, form_id.trim());
      const s = form.settings ?? {};
      const quiz = s.quizSettings;

      const lines = [
        `**Settings** for "${form.info?.title ?? form_id}"`,
        '',
        `Form ID: \`${form.formId}\``,
        `Responder link: ${form.responderUri ?? `https://docs.google.com/forms/d/${form.formId}/viewform`}`,
        '',
        '── General ──',
        `Collect email: ${s.emailCollectionType === 'VERIFIED' ? 'Yes (verified)' : s.emailCollectionType === 'RESPONDENT_INPUT' ? 'Yes (self-reported)' : 'No'}`,
        `Login required: ${s.requireLogin ? 'Yes' : 'No'}`,
        `Limit to one response: ${s.limitOneResponsePerUser ? 'Yes' : 'No'}`,
        `Allow response editing: ${s.canEditAfterSubmit ? 'Yes' : 'No'}`,
        `Show summary to respondents: ${s.publishSummary ? 'Yes' : 'No'}`,
        '',
        quiz ? '── Quiz settings ──' : 'Type: Regular form (not a quiz)',
      ];

      if (quiz) {
        lines.push(`Is quiz: ${quiz.isQuiz ? 'Yes' : 'No'}`);
        if (quiz.isQuiz) {
          lines.push(`Release grade: ${quiz.gradeSettings?.whenToGrade ?? 'Unknown'}`);
          lines.push(
            `Show correct answers: ${quiz.gradeSettings?.correctAnswersVisibility ?? 'Unknown'}`,
          );
          lines.push(`Show point values: ${quiz.gradeSettings?.pointValueVisibility ?? 'Unknown'}`);
        }
      }

      if (form.info?.documentTitle) {
        lines.push('');
        lines.push(`Document title: ${form.info.documentTitle}`);
      }

      return lines.filter(Boolean).join('\n');
    }

    case 'forms_get_completion_rate': {
      const { form_id, max_results = 200 } = params;
      if (!form_id?.trim()) throw new Error('Missing required param: form_id');

      const [form, { responses, totalResponses }] = await Promise.all([
        FormsAPI.getForm(credentials, form_id.trim()),
        FormsAPI.listResponses(credentials, form_id.trim(), { maxResults: max_results }),
      ]);

      const questions = FormsAPI.extractQuestions(form).filter(
        (q) => !['PAGE_BREAK', 'SECTION_TEXT', 'IMAGE', 'VIDEO'].includes(q.type) && q.questionId,
      );

      const total = responses.length;
      if (!total) return `No responses found for form "${form.info?.title ?? form_id}".`;

      const lines = [
        `**Completion rate** for "${form.info?.title ?? form_id}" (${total} response(s) analyzed of ${totalResponses} total)`,
        '',
      ];

      for (const q of questions) {
        const answered = responses.filter((r) => {
          const val = FormsAPI.extractAnswerValue(r.answers?.[q.questionId]);
          return val && val !== '(no answer)';
        }).length;
        const pct = ((answered / total) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round((answered / total) * 20));
        const reqFlag = q.required ? ' *(required)*' : '';
        lines.push(`**${q.title || '(Untitled)'}**${reqFlag}`);
        lines.push(`  ${bar} ${answered}/${total} answered (${pct}%)`);
      }

      return lines.join('\n');
    }

    default:
      throw new Error(`Unknown Forms tool: ${toolName}`);
  }
}
