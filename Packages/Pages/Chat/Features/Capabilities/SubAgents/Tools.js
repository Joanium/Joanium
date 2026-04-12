export const SUBAGENT_TOOLS = [
  {
    name: 'spawn_sub_agents',
    description:
      'Delegate a medium or high complexity task into multiple focused sub-agents that investigate in parallel and return structured handoffs. Use this when decomposition will materially improve speed, coverage, or accuracy. Avoid it for trivial requests.',
    category: 'utility',
    parameters: {
      tasks: {
        type: 'string',
        required: !0,
        description:
          'JSON array of sub-agent task objects. Each task should include a title and goal, and may include context or deliverable. Example: [{"title":"Trace auth bug","goal":"Find the login failure root cause","deliverable":"Root cause and likely fix"}]',
      },
      coordination_goal: {
        type: 'string',
        required: !1,
        description: 'Optional overall mission that explains how the delegated tasks fit together.',
      },
      synthesis_style: {
        type: 'string',
        required: !1,
        description:
          'How the delegated results should be merged for the coordinator, for example brief, detailed, action_items, or comparison.',
      },
    },
  },
];
