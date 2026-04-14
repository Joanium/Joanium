export const VERCEL_TOOLS = [
  // ─── Original ──────────────────────────────────────────────────────────────
  {
    name: 'vercel_list_projects',
    description:
      "List all of the user's Vercel projects with framework, latest deployment state, and domains.",
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },

  // ─── Projects ──────────────────────────────────────────────────────────────
  {
    name: 'vercel_get_project',
    description: 'Get detailed info about a specific Vercel project by its name or ID.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      idOrName: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
    },
  },
  {
    name: 'vercel_create_project',
    description: 'Create a new Vercel project.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      name: {
        type: 'string',
        description: 'Name of the new project',
        required: true,
      },
      framework: {
        type: 'string',
        description: 'Framework preset (e.g. nextjs, vite, nuxtjs)',
        required: false,
      },
    },
  },
  {
    name: 'vercel_update_project',
    description: 'Update settings (name, framework, etc.) of an existing Vercel project.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      idOrName: {
        type: 'string',
        description: 'The project ID or name to update',
        required: true,
      },
      updates: {
        type: 'object',
        description: 'Key-value pairs to update (e.g. { "name": "new-name", "framework": "vite" })',
        required: true,
      },
    },
  },
  {
    name: 'vercel_delete_project',
    description: 'Permanently delete a Vercel project. Use with caution.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      idOrName: {
        type: 'string',
        description: 'The project ID or name to delete',
        required: true,
      },
    },
  },

  // ─── Deployments ───────────────────────────────────────────────────────────
  {
    name: 'vercel_get_deployment',
    description: 'Get detailed info about a specific Vercel deployment by its ID or URL.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      deploymentId: {
        type: 'string',
        description: 'The deployment UID or URL',
        required: true,
      },
    },
  },
  {
    name: 'vercel_cancel_deployment',
    description: 'Cancel an in-progress Vercel deployment.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      deploymentId: {
        type: 'string',
        description: 'The deployment UID to cancel',
        required: true,
      },
    },
  },
  {
    name: 'vercel_redeploy',
    description: 'Redeploy an existing Vercel deployment to production.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      deploymentId: {
        type: 'string',
        description: 'The deployment UID to redeploy',
        required: true,
      },
    },
  },
  {
    name: 'vercel_get_deployment_logs',
    description: 'Fetch build and runtime log events for a specific Vercel deployment.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      deploymentId: {
        type: 'string',
        description: 'The deployment UID to fetch logs for',
        required: true,
      },
    },
  },
  {
    name: 'vercel_list_deployment_checks',
    description: 'List all checks (CI integrations, quality gates) for a given deployment.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      deploymentId: {
        type: 'string',
        description: 'The deployment UID',
        required: true,
      },
    },
  },

  // ─── Domains ───────────────────────────────────────────────────────────────
  {
    name: 'vercel_list_domains',
    description: "List all domains registered in the user's Vercel account.",
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },
  {
    name: 'vercel_get_domain',
    description: 'Get detailed information about a specific domain, including DNS and expiry.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      domain: {
        type: 'string',
        description: 'The domain name (e.g. example.com)',
        required: true,
      },
    },
  },
  {
    name: 'vercel_list_project_domains',
    description: 'List all domains attached to a specific Vercel project.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      projectId: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
    },
  },
  {
    name: 'vercel_add_project_domain',
    description: 'Attach a domain to a Vercel project.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      projectId: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
      domain: {
        type: 'string',
        description: 'The domain name to attach (e.g. example.com)',
        required: true,
      },
    },
  },
  {
    name: 'vercel_remove_project_domain',
    description: 'Remove a domain from a Vercel project.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      projectId: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
      domain: {
        type: 'string',
        description: 'The domain name to remove',
        required: true,
      },
    },
  },

  // ─── Environment Variables ─────────────────────────────────────────────────
  {
    name: 'vercel_list_env_vars',
    description: 'List all environment variables for a Vercel project (values are not decrypted).',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      projectId: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
    },
  },
  {
    name: 'vercel_create_env_var',
    description: 'Create a new environment variable for a Vercel project.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      projectId: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
      key: {
        type: 'string',
        description: 'Environment variable key (e.g. DATABASE_URL)',
        required: true,
      },
      value: {
        type: 'string',
        description: 'The value for the environment variable',
        required: true,
      },
      target: {
        type: 'array',
        description: 'Targets: production, preview, development (defaults to all)',
        required: false,
      },
      type: {
        type: 'string',
        description: 'Variable type: plain, secret, or system (defaults to plain)',
        required: false,
      },
    },
  },
  {
    name: 'vercel_update_env_var',
    description: 'Update the value or target of an existing environment variable.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      projectId: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
      envId: {
        type: 'string',
        description: 'The env var ID (from vercel_list_env_vars)',
        required: true,
      },
      value: {
        type: 'string',
        description: 'New value for the environment variable',
        required: false,
      },
      target: {
        type: 'array',
        description: 'New targets: production, preview, development',
        required: false,
      },
    },
  },
  {
    name: 'vercel_delete_env_var',
    description: 'Delete an environment variable from a Vercel project.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      projectId: {
        type: 'string',
        description: 'The project ID or name',
        required: true,
      },
      envId: {
        type: 'string',
        description: 'The env var ID to delete',
        required: true,
      },
    },
  },

  // ─── Aliases ───────────────────────────────────────────────────────────────
  {
    name: 'vercel_list_aliases',
    description: 'List recent deployment aliases in the Vercel account.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      limit: {
        type: 'number',
        description: 'Max number of aliases to return (default 20)',
        required: false,
      },
    },
  },
  {
    name: 'vercel_delete_alias',
    description: 'Delete a deployment alias by its ID.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      aliasId: {
        type: 'string',
        description: 'The alias UID or domain to delete',
        required: true,
      },
    },
  },

  // ─── Secrets ───────────────────────────────────────────────────────────────
  {
    name: 'vercel_list_secrets',
    description: 'List all secrets stored in the Vercel account (names only, not values).',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },

  // ─── Teams ─────────────────────────────────────────────────────────────────
  {
    name: 'vercel_list_teams',
    description: 'List all teams the authenticated user belongs to.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },
  {
    name: 'vercel_get_team',
    description: 'Get details about a specific Vercel team.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      teamId: {
        type: 'string',
        description: 'The team ID',
        required: true,
      },
    },
  },
  {
    name: 'vercel_list_team_members',
    description: 'List all members of a Vercel team.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      teamId: {
        type: 'string',
        description: 'The team ID',
        required: true,
      },
    },
  },

  // ─── Webhooks ──────────────────────────────────────────────────────────────
  {
    name: 'vercel_list_webhooks',
    description: 'List all webhooks configured in the Vercel account or team.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },
  {
    name: 'vercel_create_webhook',
    description: 'Create a new webhook to receive Vercel events at a URL.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      url: {
        type: 'string',
        description: 'The HTTPS endpoint to receive webhook events',
        required: true,
      },
      events: {
        type: 'array',
        description:
          'List of event types to subscribe to (e.g. ["deployment.created", "deployment.error"])',
        required: true,
      },
    },
  },
  {
    name: 'vercel_delete_webhook',
    description: 'Delete a webhook by its ID.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      webhookId: {
        type: 'string',
        description: 'The webhook ID to delete',
        required: true,
      },
    },
  },

  // ─── Edge Config ───────────────────────────────────────────────────────────
  {
    name: 'vercel_list_edge_configs',
    description: 'List all Edge Config stores in the Vercel account.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },
  {
    name: 'vercel_get_edge_config_items',
    description: 'Retrieve all key-value items stored inside a specific Edge Config.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {
      edgeConfigId: {
        type: 'string',
        description: 'The Edge Config ID or slug',
        required: true,
      },
    },
  },

  // ─── Log Drains ────────────────────────────────────────────────────────────
  {
    name: 'vercel_list_log_drains',
    description: 'List all log drain integrations configured in the account.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },

  // ─── User ──────────────────────────────────────────────────────────────────
  {
    name: 'vercel_get_user',
    description: 'Get the authenticated Vercel user profile, including username and email.',
    category: 'vercel',
    connectorId: 'vercel',
    parameters: {},
  },
];
