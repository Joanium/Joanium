import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';

const SE = 'https://api.stackexchange.com/2.3';
const SITE = 'stackoverflow';

function stripHtml(html = '') {
  return html
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, '[code block]')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(str, max = 600) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max).trimEnd() + '…';
}

function fmtQuestion(q, i) {
  const answered = q.is_answered ? '✅' : '❓';
  const tags = (q.tags ?? []).slice(0, 4).join(', ');
  return [
    `${i + 1}. ${answered} **${q.title}**`,
    `   ⬆ ${q.score}  💬 ${q.answer_count} answers  🏷 ${tags || 'untagged'}`,
    `   🔗 ${q.link}`,
  ].join('\n');
}

export const { handles, execute } = createExecutor({
  name: 'StackOverflowExecutor',
  tools: toolsList,
  handlers: {
    stackoverflow_search: async (params, onStage) => {
      const query = String(params.query ?? '').trim();
      const count = Math.min(Math.max(Number(params.count) || 5, 1), 10);
      if (!query) return '❌ Please provide a search query.';

      onStage(`🔍 Searching Stack Overflow for "${query}"…`);

      const url = `${SE}/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=${SITE}&pagesize=${count}`;
      const data = await safeJson(url);
      const items = data?.items ?? [];

      if (!items.length) return `No Stack Overflow results found for "${query}".`;

      const lines = items.map((q, i) => fmtQuestion(q, i));

      return [
        `🔍 Stack Overflow — "${query}"`,
        '',
        ...lines,
        '',
        `💡 Tip: Use \`stackoverflow_question_answers\` with a question ID to get the full answers.`,
      ].join('\n');
    },

    stackoverflow_question_answers: async (params, onStage) => {
      const id = String(params.question_id ?? '')
        .trim()
        .replace(/\D/g, '');
      const count = Math.min(Math.max(Number(params.count) || 3, 1), 5);
      if (!id) return '❌ Please provide a valid Stack Overflow question ID.';

      onStage(`📖 Loading answers for question #${id}…`);

      // Fetch question title + answers with body in one parallel call
      const [qData, aData] = await Promise.all([
        safeJson(`${SE}/questions/${id}?site=${SITE}`),
        safeJson(
          `${SE}/questions/${id}/answers?order=desc&sort=votes&site=${SITE}&pagesize=${count}&filter=withbody`,
        ),
      ]);

      const question = qData?.items?.[0];
      const answers = aData?.items ?? [];

      if (!answers.length) return `No answers found for question #${id}.`;

      const header = question
        ? `📖 **${question.title}**\n   ⬆ ${question.score}  🔗 ${question.link}`
        : `📖 Stack Overflow — Question #${id}`;

      const answerBlocks = answers.map((a, i) => {
        const accepted = a.is_accepted ? ' ✅ Accepted' : '';
        const body = truncate(stripHtml(a.body ?? ''), 700);
        return [
          `─── Answer ${i + 1}${accepted} · ⬆ ${a.score} ───`,
          body,
          `🔗 https://stackoverflow.com/a/${a.answer_id}`,
        ].join('\n');
      });

      return [header, '', ...answerBlocks].join('\n\n');
    },

    stackoverflow_questions_by_tag: async (params, onStage) => {
      const tag = String(params.tag ?? '')
        .trim()
        .toLowerCase();
      const count = Math.min(Math.max(Number(params.count) || 5, 1), 10);
      if (!tag) return '❌ Please provide a tag name.';

      onStage(`🏷 Loading top Stack Overflow questions tagged [${tag}]…`);

      const url = `${SE}/questions?order=desc&sort=votes&tagged=${encodeURIComponent(tag)}&site=${SITE}&pagesize=${count}`;
      const data = await safeJson(url);
      const items = data?.items ?? [];

      if (!items.length) return `No Stack Overflow questions found for tag [${tag}].`;

      const lines = items.map((q, i) => fmtQuestion(q, i));

      return [`🏷 Stack Overflow — Top questions tagged [${tag}]`, '', ...lines].join('\n');
    },

    stackoverflow_hot: async (params, onStage) => {
      const tag = String(params.tag ?? '')
        .trim()
        .toLowerCase();
      const count = Math.min(Math.max(Number(params.count) || 5, 1), 10);

      const tagLabel = tag ? ` [${tag}]` : '';
      onStage(`🔥 Fetching hot Stack Overflow questions${tagLabel}…`);

      const tagParam = tag ? `&tagged=${encodeURIComponent(tag)}` : '';
      const url = `${SE}/questions?order=desc&sort=hot&site=${SITE}&pagesize=${count}${tagParam}`;
      const data = await safeJson(url);
      const items = data?.items ?? [];

      if (!items.length) return `No hot questions found${tagLabel}.`;

      const lines = items.map((q, i) => fmtQuestion(q, i));

      return [`🔥 Stack Overflow — Hot Questions${tagLabel}`, '', ...lines].join('\n');
    },

    stackoverflow_similar: async (params, onStage) => {
      const title = String(params.title ?? '').trim();
      const count = Math.min(Math.max(Number(params.count) || 5, 1), 10);
      if (!title) return '❌ Please provide an error message or question title.';

      onStage(`🔎 Finding Stack Overflow questions similar to "${title.slice(0, 60)}…"`);

      const url = `${SE}/similar?order=desc&sort=relevance&title=${encodeURIComponent(title)}&site=${SITE}&pagesize=${count}`;
      const data = await safeJson(url);
      const items = data?.items ?? [];

      if (!items.length) {
        return `No similar Stack Overflow questions found for: "${title}".\n\nTry \`stackoverflow_search\` with keywords from the error instead.`;
      }

      const lines = items.map((q, i) => fmtQuestion(q, i));

      return [
        `🔎 Stack Overflow — Similar to: "${title.slice(0, 80)}"`,
        '',
        ...lines,
        '',
        `💡 Use \`stackoverflow_question_answers\` with a question ID to read the solutions.`,
      ].join('\n');
    },
  },
});
