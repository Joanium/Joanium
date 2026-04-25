import * as LinearAPI from '../API/LinearAPI.js';
import { getLinearCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeLinearChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getLinearCredentials, notConnected, async (creds) => {
    switch (toolName) {
      // ── Viewer ─────────────────────────────────────────────────────────────
      case 'linear_list_my_issues': {
        const issues = await LinearAPI.listMyIssues(creds, 25);
        return { ok: true, issues };
      }
      case 'linear_get_viewer': {
        const viewer = await LinearAPI.getViewer(creds);
        return { ok: true, viewer };
      }

      // ── Issues ─────────────────────────────────────────────────────────────
      case 'linear_get_issue': {
        const issue = await LinearAPI.getIssue(creds, params.id);
        return { ok: true, issue };
      }
      case 'linear_create_issue': {
        const { title, teamId, description, assigneeId, stateId, priority, labelIds, dueDate } =
          params;
        const input = { title, teamId };
        if (description !== undefined) input.description = description;
        if (assigneeId !== undefined) input.assigneeId = assigneeId;
        if (stateId !== undefined) input.stateId = stateId;
        if (priority !== undefined) input.priority = priority;
        if (labelIds !== undefined) input.labelIds = labelIds;
        if (dueDate !== undefined) input.dueDate = dueDate;
        const result = await LinearAPI.createIssue(creds, input);
        return { ok: result.success, issue: result.issue };
      }
      case 'linear_update_issue': {
        const { id, ...rest } = params;
        const input = {};
        const allowed = [
          'title',
          'description',
          'assigneeId',
          'stateId',
          'priority',
          'labelIds',
          'dueDate',
        ];
        for (const key of allowed) if (rest[key] !== undefined) input[key] = rest[key];
        const result = await LinearAPI.updateIssue(creds, id, input);
        return { ok: result.success, issue: result.issue };
      }
      case 'linear_delete_issue': {
        const result = await LinearAPI.deleteIssue(creds, params.id);
        return { ok: result.success };
      }
      case 'linear_archive_issue': {
        const result = await LinearAPI.archiveIssue(creds, params.id);
        return { ok: result.success };
      }
      case 'linear_search_issues': {
        const issues = await LinearAPI.searchIssues(creds, params.query, params.limit ?? 25);
        return { ok: true, issues };
      }
      case 'linear_assign_issue': {
        const result = await LinearAPI.updateIssue(creds, params.id, {
          assigneeId: params.assigneeId,
        });
        return { ok: result.success, issue: result.issue };
      }
      case 'linear_update_issue_state': {
        const result = await LinearAPI.updateIssue(creds, params.id, { stateId: params.stateId });
        return { ok: result.success, issue: result.issue };
      }
      case 'linear_update_issue_priority': {
        const result = await LinearAPI.updateIssue(creds, params.id, { priority: params.priority });
        return { ok: result.success, issue: result.issue };
      }
      case 'linear_set_issue_due_date': {
        const result = await LinearAPI.updateIssue(creds, params.id, {
          dueDate: params.dueDate ?? null,
        });
        return { ok: result.success, issue: result.issue };
      }

      // ── Issue Relations (NEW) ──────────────────────────────────────────────
      case 'linear_list_issue_relations': {
        const relations = await LinearAPI.listIssueRelations(creds, params.issueId);
        return { ok: true, ...relations };
      }
      case 'linear_create_issue_relation': {
        const result = await LinearAPI.createIssueRelation(
          creds,
          params.issueId,
          params.relatedIssueId,
          params.type,
        );
        return { ok: result.success, issueRelation: result.issueRelation };
      }
      case 'linear_delete_issue_relation': {
        const result = await LinearAPI.deleteIssueRelation(creds, params.id);
        return { ok: result.success };
      }
      case 'linear_unarchive_issue': {
        const result = await LinearAPI.unarchiveIssue(creds, params.id);
        return { ok: result.success };
      }

      // ── Attachments (NEW) ──────────────────────────────────────────────────
      case 'linear_list_attachments': {
        const attachments = await LinearAPI.listAttachments(creds, params.issueId);
        return { ok: true, attachments };
      }
      case 'linear_create_attachment': {
        const { issueId, title, url, subtitle, iconUrl } = params;
        const input = { issueId, title, url };
        if (subtitle !== undefined) input.subtitle = subtitle;
        if (iconUrl !== undefined) input.iconUrl = iconUrl;
        const result = await LinearAPI.createAttachment(creds, input);
        return { ok: result.success, attachment: result.attachment };
      }
      case 'linear_delete_attachment': {
        const result = await LinearAPI.deleteAttachment(creds, params.id);
        return { ok: result.success };
      }

      // ── Comments ───────────────────────────────────────────────────────────
      case 'linear_list_comments': {
        const comments = await LinearAPI.listComments(creds, params.issueId);
        return { ok: true, comments };
      }
      case 'linear_add_comment': {
        const result = await LinearAPI.addComment(creds, params.issueId, params.body);
        return { ok: result.success, comment: result.comment };
      }
      case 'linear_update_comment': {
        const result = await LinearAPI.updateComment(creds, params.id, params.body);
        return { ok: result.success, comment: result.comment };
      }
      case 'linear_delete_comment': {
        const result = await LinearAPI.deleteComment(creds, params.id);
        return { ok: result.success };
      }

      // ── Notifications (NEW) ────────────────────────────────────────────────
      case 'linear_list_notifications': {
        const notifications = await LinearAPI.listNotifications(creds, params.limit ?? 25);
        return { ok: true, notifications };
      }
      case 'linear_mark_notification_read': {
        const result = await LinearAPI.markNotificationRead(creds, params.id);
        return { ok: result.success, notification: result.notification };
      }
      case 'linear_archive_notification': {
        const result = await LinearAPI.archiveNotification(creds, params.id);
        return { ok: result.success };
      }

      // ── Teams ──────────────────────────────────────────────────────────────
      case 'linear_list_teams': {
        const teams = await LinearAPI.listTeams(creds);
        return { ok: true, teams };
      }
      case 'linear_get_team': {
        const team = await LinearAPI.getTeam(creds, params.id);
        return { ok: true, team };
      }
      case 'linear_list_team_members': {
        const members = await LinearAPI.listTeamMembers(creds, params.teamId);
        return { ok: true, members };
      }
      case 'linear_list_team_states': {
        const states = await LinearAPI.listTeamStates(creds, params.teamId);
        return { ok: true, states };
      }
      case 'linear_list_team_labels': {
        const labels = await LinearAPI.listTeamLabels(creds, params.teamId);
        return { ok: true, labels };
      }
      case 'linear_update_team': {
        const { id, ...rest } = params;
        const input = {};
        const allowed = ['name', 'description', 'key', 'timezone'];
        for (const key of allowed) if (rest[key] !== undefined) input[key] = rest[key];
        const result = await LinearAPI.updateTeam(creds, id, input);
        return { ok: result.success, team: result.team };
      }

      // ── Workflow States (NEW) ──────────────────────────────────────────────
      case 'linear_create_workflow_state': {
        const { teamId, name, type, color, position } = params;
        const input = { teamId, name, type, color };
        if (position !== undefined) input.position = position;
        const result = await LinearAPI.createWorkflowState(creds, input);
        return { ok: result.success, workflowState: result.workflowState };
      }
      case 'linear_update_workflow_state': {
        const { id, ...rest } = params;
        const input = {};
        const allowed = ['name', 'color', 'position', 'description'];
        for (const key of allowed) if (rest[key] !== undefined) input[key] = rest[key];
        const result = await LinearAPI.updateWorkflowState(creds, id, input);
        return { ok: result.success, workflowState: result.workflowState };
      }
      case 'linear_archive_workflow_state': {
        const result = await LinearAPI.archiveWorkflowState(creds, params.id);
        return { ok: result.success };
      }

      // ── Projects ───────────────────────────────────────────────────────────
      case 'linear_list_projects': {
        const projects = await LinearAPI.listProjects(creds, params.limit ?? 25);
        return { ok: true, projects };
      }
      case 'linear_get_project': {
        const project = await LinearAPI.getProject(creds, params.id);
        return { ok: true, project };
      }
      case 'linear_create_project': {
        const { name, teamIds, description, state } = params;
        const input = { name, teamIds };
        if (description !== undefined) input.description = description;
        if (state !== undefined) input.state = state;
        const result = await LinearAPI.createProject(creds, input);
        return { ok: result.success, project: result.project };
      }
      case 'linear_update_project': {
        const { id, ...rest } = params;
        const input = {};
        const allowed = ['name', 'description', 'state', 'startDate', 'targetDate', 'leadId'];
        for (const key of allowed) if (rest[key] !== undefined) input[key] = rest[key];
        const result = await LinearAPI.updateProject(creds, id, input);
        return { ok: result.success, project: result.project };
      }
      case 'linear_archive_project': {
        const result = await LinearAPI.archiveProject(creds, params.id);
        return { ok: result.success };
      }
      case 'linear_list_project_issues': {
        const issues = await LinearAPI.listProjectIssues(
          creds,
          params.projectId,
          params.limit ?? 25,
        );
        return { ok: true, issues };
      }

      // ── Project Milestones (NEW) ───────────────────────────────────────────
      case 'linear_list_project_milestones': {
        const milestones = await LinearAPI.listProjectMilestones(creds, params.projectId);
        return { ok: true, milestones };
      }
      case 'linear_create_project_milestone': {
        const { projectId, name, targetDate, description } = params;
        const input = { projectId, name };
        if (targetDate !== undefined) input.targetDate = targetDate;
        if (description !== undefined) input.description = description;
        const result = await LinearAPI.createProjectMilestone(creds, input);
        return { ok: result.success, projectMilestone: result.projectMilestone };
      }
      case 'linear_update_project_milestone': {
        const { id, ...rest } = params;
        const input = {};
        const allowed = ['name', 'targetDate', 'description'];
        for (const key of allowed) if (rest[key] !== undefined) input[key] = rest[key];
        const result = await LinearAPI.updateProjectMilestone(creds, id, input);
        return { ok: result.success, projectMilestone: result.projectMilestone };
      }
      case 'linear_delete_project_milestone': {
        const result = await LinearAPI.deleteProjectMilestone(creds, params.id);
        return { ok: result.success };
      }

      // ── Project Updates (NEW) ──────────────────────────────────────────────
      case 'linear_list_project_updates': {
        const updates = await LinearAPI.listProjectUpdates(
          creds,
          params.projectId,
          params.limit ?? 10,
        );
        return { ok: true, updates };
      }
      case 'linear_create_project_update': {
        const { projectId, body, health } = params;
        const input = { projectId, body };
        if (health !== undefined) input.health = health;
        const result = await LinearAPI.createProjectUpdate(creds, input);
        return { ok: result.success, projectUpdate: result.projectUpdate };
      }

      // ── Members ────────────────────────────────────────────────────────────
      case 'linear_list_members': {
        const members = await LinearAPI.listMembers(creds, params.limit ?? 50);
        return { ok: true, members };
      }
      case 'linear_get_user': {
        const user = await LinearAPI.getUser(creds, params.id);
        return { ok: true, user };
      }

      // ── Cycles ─────────────────────────────────────────────────────────────
      case 'linear_list_cycles': {
        const cycles = await LinearAPI.listCycles(creds, params.teamId, params.limit ?? 10);
        return { ok: true, cycles };
      }
      case 'linear_get_cycle_issues': {
        const cycle = await LinearAPI.getCycleIssues(creds, params.cycleId, params.limit ?? 25);
        return { ok: true, cycle };
      }
      case 'linear_create_cycle': {
        const { teamId, startsAt, endsAt, name } = params;
        const input = { teamId, startsAt, endsAt };
        if (name !== undefined) input.name = name;
        const result = await LinearAPI.createCycle(creds, input);
        return { ok: result.success, cycle: result.cycle };
      }
      case 'linear_update_cycle': {
        const { id, ...rest } = params;
        const input = {};
        const allowed = ['name', 'startsAt', 'endsAt', 'description'];
        for (const key of allowed) if (rest[key] !== undefined) input[key] = rest[key];
        const result = await LinearAPI.updateCycle(creds, id, input);
        return { ok: result.success, cycle: result.cycle };
      }
      case 'linear_archive_cycle': {
        const result = await LinearAPI.archiveCycle(creds, params.id);
        return { ok: result.success };
      }
      case 'linear_add_issues_to_cycle': {
        const result = await LinearAPI.addIssuesToCycle(creds, params.cycleId, params.issueIds);
        return { ok: result.success };
      }

      // ── Labels ─────────────────────────────────────────────────────────────
      case 'linear_list_labels': {
        const labels = await LinearAPI.listLabels(creds, params.limit ?? 50);
        return { ok: true, labels };
      }
      case 'linear_create_label': {
        const input = { name: params.name, teamId: params.teamId };
        if (params.color !== undefined) input.color = params.color;
        const result = await LinearAPI.createLabel(creds, input);
        return { ok: result.success, label: result.issueLabel };
      }
      case 'linear_update_label': {
        const { id, ...rest } = params;
        const input = {};
        if (rest.name !== undefined) input.name = rest.name;
        if (rest.color !== undefined) input.color = rest.color;
        const result = await LinearAPI.updateLabel(creds, id, input);
        return { ok: result.success, label: result.issueLabel };
      }
      case 'linear_archive_label': {
        const result = await LinearAPI.archiveLabel(creds, params.id);
        return { ok: result.success };
      }

      // ── Favorites (NEW) ────────────────────────────────────────────────────
      case 'linear_list_favorites': {
        const favorites = await LinearAPI.listFavorites(creds);
        return { ok: true, favorites };
      }

      // ── Organization (NEW) ─────────────────────────────────────────────────
      case 'linear_get_organization': {
        const organization = await LinearAPI.getOrganization(creds);
        return { ok: true, organization };
      }

      default:
        return null;
    }
  });
}
