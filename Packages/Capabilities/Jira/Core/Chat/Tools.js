export const JIRA_TOOLS = [
  // ── Existing ────────────────────────────────────────────────────────────────
  {
    name: 'jira_list_my_issues',
    description:
      "List the user's open Jira issues assigned to them, with status, priority, and project.",
    category: 'jira',
    connectorId: 'jira',
    parameters: {},
  },

  // ── 1. Get Issue ────────────────────────────────────────────────────────────
  {
    name: 'jira_get_issue',
    description:
      'Get full details of a specific Jira issue by its key, including description, status, assignee, priority, subtasks, links, and comment count.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
    },
  },

  // ── 2. Create Issue ─────────────────────────────────────────────────────────
  {
    name: 'jira_create_issue',
    description:
      'Create a new Jira issue in a given project with a summary, issue type, description, priority, assignee, and labels.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      projectKey: {
        type: 'string',
        description: 'The project key, e.g. ENG',
        required: true,
      },
      summary: {
        type: 'string',
        description: 'Short one-line summary of the issue',
        required: true,
      },
      issueType: {
        type: 'string',
        description: 'Issue type name, e.g. Bug, Task, Story, Epic. Defaults to Task.',
        required: false,
      },
      description: {
        type: 'string',
        description: 'Longer description of the issue',
        required: false,
      },
      priority: {
        type: 'string',
        description: 'Priority name: Highest, High, Medium, Low, Lowest',
        required: false,
      },
      assigneeAccountId: {
        type: 'string',
        description: 'Atlassian accountId of the user to assign. Use jira_search_users to find it.',
        required: false,
      },
      labels: {
        type: 'array',
        description: 'Array of label strings to attach to the issue',
        required: false,
      },
    },
  },

  // ── 3. Update Issue ─────────────────────────────────────────────────────────
  {
    name: 'jira_update_issue',
    description:
      'Update one or more fields (summary, description, priority, assignee, labels, fix version) of an existing Jira issue.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key to update, e.g. PROJ-456',
        required: true,
      },
      summary: { type: 'string', description: 'New summary text', required: false },
      description: { type: 'string', description: 'New description text', required: false },
      priority: {
        type: 'string',
        description: 'New priority: Highest, High, Medium, Low, Lowest',
        required: false,
      },
      assigneeAccountId: {
        type: 'string',
        description: 'Atlassian accountId of the new assignee',
        required: false,
      },
      labels: {
        type: 'array',
        description: 'Full replacement list of labels',
        required: false,
      },
      fixVersion: {
        type: 'string',
        description: 'Name of the fix version/release to set',
        required: false,
      },
    },
  },

  // ── 4. Delete Issue ─────────────────────────────────────────────────────────
  {
    name: 'jira_delete_issue',
    description:
      'Permanently delete a Jira issue by its key. Use with caution — this cannot be undone.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key to delete, e.g. PROJ-789',
        required: true,
      },
    },
  },

  // ── 5. Add Comment ──────────────────────────────────────────────────────────
  {
    name: 'jira_add_comment',
    description: 'Post a new comment on a Jira issue.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
      comment: {
        type: 'string',
        description: 'The comment text to post',
        required: true,
      },
    },
  },

  // ── 6. Get Comments ─────────────────────────────────────────────────────────
  {
    name: 'jira_get_comments',
    description: 'Retrieve comments on a Jira issue, ordered by creation date.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of comments to return (default 20)',
        required: false,
      },
    },
  },

  // ── 7. Delete Comment ───────────────────────────────────────────────────────
  {
    name: 'jira_delete_comment',
    description: 'Delete a specific comment from a Jira issue by comment ID.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
      commentId: {
        type: 'string',
        description: 'The numeric comment ID to delete',
        required: true,
      },
    },
  },

  // ── 8. Assign Issue ─────────────────────────────────────────────────────────
  {
    name: 'jira_assign_issue',
    description:
      'Assign a Jira issue to a user by their Atlassian account ID. Pass null for accountId to unassign.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
      accountId: {
        type: 'string',
        description:
          'Atlassian accountId of the assignee. Use jira_search_users to find it. Pass null to unassign.',
        required: true,
      },
    },
  },

  // ── 9. Get Transitions ──────────────────────────────────────────────────────
  {
    name: 'jira_get_transitions',
    description:
      'Get the list of available workflow transitions for a Jira issue — useful before calling jira_transition_issue.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
    },
  },

  // ── 10. Transition Issue ────────────────────────────────────────────────────
  {
    name: 'jira_transition_issue',
    description:
      'Move a Jira issue to a new workflow status using a transition ID. Call jira_get_transitions first to find valid transition IDs.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key to transition, e.g. PROJ-123',
        required: true,
      },
      transitionId: {
        type: 'string',
        description: 'The transition ID obtained from jira_get_transitions',
        required: true,
      },
    },
  },

  // ── 11. List Projects ───────────────────────────────────────────────────────
  {
    name: 'jira_list_projects',
    description: 'List all accessible Jira projects in the workspace, ordered by name.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {},
  },

  // ── 12. Get Project ─────────────────────────────────────────────────────────
  {
    name: 'jira_get_project',
    description:
      'Get detailed information about a specific Jira project, including its lead, description, and available issue types.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      projectKey: {
        type: 'string',
        description: 'The project key, e.g. ENG',
        required: true,
      },
    },
  },

  // ── 13. Search Issues ───────────────────────────────────────────────────────
  {
    name: 'jira_search_issues',
    description:
      'Search Jira issues using a JQL (Jira Query Language) query. Returns matching issues with summary, status, assignee, and priority.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      jql: {
        type: 'string',
        description:
          'A valid JQL query string, e.g. "project = ENG AND status = \\"In Progress\\"" or "priority = High ORDER BY updated DESC"',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of issues to return (default 25, max 100)',
        required: false,
      },
    },
  },

  // ── 14. Get Boards ──────────────────────────────────────────────────────────
  {
    name: 'jira_get_boards',
    description: 'List all Agile (Scrum/Kanban) boards available in the Jira workspace.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      maxResults: {
        type: 'number',
        description: 'Maximum number of boards to return (default 25)',
        required: false,
      },
    },
  },

  // ── 15. Get Board Sprints ───────────────────────────────────────────────────
  {
    name: 'jira_get_board_sprints',
    description:
      "List sprints for a specific Agile board. Use jira_get_boards first to find board IDs. Can filter by sprint state: 'active', 'future', 'closed', or 'active,future'.",
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      boardId: {
        type: 'number',
        description: 'The numeric board ID from jira_get_boards',
        required: true,
      },
      state: {
        type: 'string',
        description:
          "Filter by sprint state: 'active', 'future', 'closed', or 'active,future'. Defaults to 'active,future'.",
        required: false,
      },
    },
  },

  // ── 16. Get Sprint Issues ───────────────────────────────────────────────────
  {
    name: 'jira_get_sprint_issues',
    description:
      'Get all issues belonging to a specific sprint. Use jira_get_board_sprints to find sprint IDs.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      sprintId: {
        type: 'number',
        description: 'The numeric sprint ID from jira_get_board_sprints',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of issues to return (default 50)',
        required: false,
      },
    },
  },

  // ── 17. Get Backlog ─────────────────────────────────────────────────────────
  {
    name: 'jira_get_backlog',
    description:
      "Get all issues in the backlog (not assigned to any sprint) for a specific board. Use jira_get_boards first to find the board's ID.",
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      boardId: {
        type: 'number',
        description: 'The numeric board ID from jira_get_boards',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of backlog items to return (default 50)',
        required: false,
      },
    },
  },

  // ── 18. Get Issue Types ─────────────────────────────────────────────────────
  {
    name: 'jira_get_issue_types',
    description:
      'Get all available issue types and their valid statuses for a specific Jira project. Useful before creating issues or filtering searches.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      projectKey: {
        type: 'string',
        description: 'The project key, e.g. ENG',
        required: true,
      },
    },
  },

  // ── 19. Get Priorities ──────────────────────────────────────────────────────
  {
    name: 'jira_get_priorities',
    description:
      'Get all available Jira priority levels (e.g. Highest, High, Medium, Low, Lowest) for use when creating or updating issues.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {},
  },

  // ── 20. Search Users ────────────────────────────────────────────────────────
  {
    name: 'jira_search_users',
    description:
      'Search for Jira users by name or email. Returns accountIds needed for assigning issues or watching.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      query: {
        type: 'string',
        description: 'Search string — a name or partial email address',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of users to return (default 10)',
        required: false,
      },
    },
  },

  // ── 21. Get Watchers ────────────────────────────────────────────────────────
  {
    name: 'jira_get_watchers',
    description: 'Get the list of users watching a Jira issue, plus the total watch count.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
    },
  },

  // ── 22. Watch Issue ─────────────────────────────────────────────────────────
  {
    name: 'jira_watch_issue',
    description: 'Add a user (by accountId) as a watcher on a Jira issue.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
      accountId: {
        type: 'string',
        description: 'Atlassian accountId of the user to add as a watcher',
        required: true,
      },
    },
  },

  // ── 23. Get Changelog ───────────────────────────────────────────────────────
  {
    name: 'jira_get_changelog',
    description:
      'Get the full change history of a Jira issue — who changed what field, from what value, to what value, and when.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of changelog entries to return (default 25)',
        required: false,
      },
    },
  },

  // ── 24. Link Issues ─────────────────────────────────────────────────────────
  {
    name: 'jira_link_issues',
    description:
      'Create a link between two Jira issues (e.g. "blocks", "is blocked by", "relates to", "duplicates"). Use jira_get_issue_link_types to see available link type names.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      inwardIssueKey: {
        type: 'string',
        description: 'The key of the inward issue (e.g. the blocker), e.g. PROJ-100',
        required: true,
      },
      outwardIssueKey: {
        type: 'string',
        description: 'The key of the outward issue (e.g. the blocked issue), e.g. PROJ-101',
        required: true,
      },
      linkTypeName: {
        type: 'string',
        description:
          'Name of the link type, e.g. "Blocks", "Relates", "Duplicates". Defaults to "Relates".',
        required: false,
      },
    },
  },

  // ── 25. Get Issue Link Types ────────────────────────────────────────────────
  {
    name: 'jira_get_issue_link_types',
    description:
      'Get all available issue link types (e.g. blocks, relates to, duplicates) to use with jira_link_issues.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {},
  },

  // ── 26. Get Versions ────────────────────────────────────────────────────────
  {
    name: 'jira_get_versions',
    description:
      'Get all versions/releases defined for a Jira project, with release dates and status.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      projectKey: {
        type: 'string',
        description: 'The project key, e.g. ENG',
        required: true,
      },
    },
  },

  // ── 27. Create Version ──────────────────────────────────────────────────────
  {
    name: 'jira_create_version',
    description:
      'Create a new version/release in a Jira project with a name, description, start date, and release date.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      projectKey: {
        type: 'string',
        description: 'The project key, e.g. ENG',
        required: true,
      },
      name: {
        type: 'string',
        description: 'Version name, e.g. v2.4.0',
        required: true,
      },
      description: {
        type: 'string',
        description: 'Optional description of the version',
        required: false,
      },
      startDate: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format',
        required: false,
      },
      releaseDate: {
        type: 'string',
        description: 'Release date in YYYY-MM-DD format',
        required: false,
      },
    },
  },

  // ── 28. Get Worklogs ────────────────────────────────────────────────────────
  {
    name: 'jira_get_worklogs',
    description:
      'Get all work log entries for a Jira issue, showing who logged time, how much, and any comments.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
    },
  },

  // ── 29. Log Work ────────────────────────────────────────────────────────────
  {
    name: 'jira_log_work',
    description:
      'Log time spent on a Jira issue. Time format examples: "2h", "1h 30m", "3d 4h". Optionally add a comment and the start time.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      issueKey: {
        type: 'string',
        description: 'The Jira issue key, e.g. PROJ-123',
        required: true,
      },
      timeSpent: {
        type: 'string',
        description: 'Time spent in Jira duration format, e.g. "2h", "1h 30m", "3d"',
        required: true,
      },
      comment: {
        type: 'string',
        description: 'Optional comment to accompany the work log',
        required: false,
      },
      started: {
        type: 'string',
        description:
          'ISO 8601 datetime when the work started, e.g. "2024-01-15T09:00:00.000+0000". Defaults to now.',
        required: false,
      },
    },
  },

  // ── 30. Get Statuses ────────────────────────────────────────────────────────
  {
    name: 'jira_get_statuses',
    description:
      'Get all workflow statuses available for each issue type in a Jira project. Useful for understanding what states issues can be in.',
    category: 'jira',
    connectorId: 'jira',
    parameters: {
      projectKey: {
        type: 'string',
        description: 'The project key, e.g. ENG',
        required: true,
      },
    },
  },
];
