import { __test__ } from './AutomationDraftGenerator.js';

describe('AutomationDraftGenerator helpers', () => {
  test('normalizes times from 12-hour strings', () => {
    expect(__test__.normalizeTimeString('8 am')).toBe('08:00');
    expect(__test__.normalizeTimeString('7:45 PM')).toBe('19:45');
  });

  test('heuristic draft builds weekday github jobs', () => {
    const draft = __test__.heuristicDraftFromPrompt(
      'Every weekday at 8 am check GitHub PRs for joanium/joanium and notify me',
      { provider: 'openai', modelId: 'gpt-5.4' },
    );
    expect(draft.jobs).toHaveLength(5);
    expect(draft.jobs[0].dataSources[0].type).toBe('github_prs');
    expect(draft.jobs[0].dataSources[0].owner).toBe('joanium');
    expect(draft.jobs[0].dataSources[0].repo).toBe('joanium');
  });

  test('heuristic draft extracts gmail and recipient email', () => {
    const draft = __test__.heuristicDraftFromPrompt(
      'Every day at 9am summarize my unread Gmail and email me at joel@example.com',
      null,
    );
    expect(draft.jobs[0].dataSources[0].type).toBe('gmail_inbox');
    expect(draft.jobs[0].output.type).toBe('send_email');
    expect(draft.jobs[0].output.to).toBe('joel@example.com');
  });
});
