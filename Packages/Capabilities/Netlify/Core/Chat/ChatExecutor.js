import * as NetlifyAPI from '../API/NetlifyAPI.js';
import { getNetlifyCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeNetlifyChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getNetlifyCredentials, notConnected, async (creds) => {
    // ── User ───────────────────────────────────────────────────────────────
    if (toolName === 'netlify_get_current_user') {
      const user = await NetlifyAPI.getCurrentUser(creds);
      return { ok: true, user };
    }

    // ── Sites ──────────────────────────────────────────────────────────────
    if (toolName === 'netlify_list_sites') {
      const sites = await NetlifyAPI.listSites(creds);
      return { ok: true, sites };
    }

    if (toolName === 'netlify_get_site') {
      const site = await NetlifyAPI.getSite(creds, params.site_id);
      return { ok: true, site };
    }

    if (toolName === 'netlify_update_site') {
      const { site_id, ...rest } = params;
      const body = {};
      if (rest.name !== undefined) body.name = rest.name;
      if (rest.custom_domain !== undefined) body.custom_domain = rest.custom_domain;
      if (rest.build_command !== undefined || rest.publish_directory !== undefined) {
        body.build_settings = {};
        if (rest.build_command !== undefined) body.build_settings.cmd = rest.build_command;
        if (rest.publish_directory !== undefined) body.build_settings.dir = rest.publish_directory;
      }
      const site = await NetlifyAPI.updateSite(creds, site_id, body);
      return { ok: true, site };
    }

    if (toolName === 'netlify_delete_site') {
      const result = await NetlifyAPI.deleteSite(creds, params.site_id);
      return { ok: true, ...result };
    }

    if (toolName === 'netlify_list_site_files') {
      const files = await NetlifyAPI.listSiteFiles(creds, params.site_id);
      return { ok: true, files };
    }

    if (toolName === 'netlify_create_site') {
      const site = await NetlifyAPI.createSite(creds, {
        name: params.name,
        custom_domain: params.custom_domain,
        repo: params.repo,
      });
      return { ok: true, site };
    }

    if (toolName === 'netlify_create_site_in_team') {
      const site = await NetlifyAPI.createSiteInTeam(creds, params.account_id, {
        name: params.name,
        custom_domain: params.custom_domain,
      });
      return { ok: true, site };
    }

    if (toolName === 'netlify_purge_cache') {
      const result = await NetlifyAPI.purgeSiteCache(creds, params.site_id);
      return { ok: true, ...result };
    }

    if (toolName === 'netlify_list_site_functions') {
      const functions = await NetlifyAPI.listSiteFunctions(creds, params.site_id);
      return { ok: true, functions };
    }

    if (toolName === 'netlify_list_service_instances') {
      const instances = await NetlifyAPI.listServiceInstances(creds, params.site_id);
      return { ok: true, instances };
    }

    // ── Deploys ────────────────────────────────────────────────────────────
    if (toolName === 'netlify_get_deploy') {
      const deploy = await NetlifyAPI.getDeploy(creds, params.deploy_id);
      return { ok: true, deploy };
    }

    if (toolName === 'netlify_list_site_deploys') {
      const deploys = await NetlifyAPI.listSiteDeploys(creds, params.site_id, params.limit);
      return { ok: true, deploys };
    }

    if (toolName === 'netlify_cancel_deploy') {
      const deploy = await NetlifyAPI.cancelDeploy(creds, params.deploy_id);
      return { ok: true, deploy };
    }

    if (toolName === 'netlify_restore_deploy') {
      const deploy = await NetlifyAPI.restoreDeploy(creds, params.deploy_id);
      return { ok: true, deploy };
    }

    if (toolName === 'netlify_trigger_site_build') {
      const deploy = await NetlifyAPI.triggerSiteBuild(creds, params.site_id, {
        clearCache: params.clear_cache ?? false,
      });
      return { ok: true, deploy };
    }

    if (toolName === 'netlify_lock_deploy') {
      const deploy = await NetlifyAPI.lockDeploy(creds, params.deploy_id);
      return { ok: true, deploy };
    }

    if (toolName === 'netlify_unlock_deploy') {
      const deploy = await NetlifyAPI.unlockDeploy(creds, params.deploy_id);
      return { ok: true, deploy };
    }

    if (toolName === 'netlify_retry_deploy') {
      const deploy = await NetlifyAPI.retryDeploy(creds, params.deploy_id);
      return { ok: true, deploy };
    }

    // ── Forms & Submissions ────────────────────────────────────────────────
    if (toolName === 'netlify_list_forms') {
      const forms = await NetlifyAPI.listForms(creds, params.site_id);
      return { ok: true, forms };
    }

    if (toolName === 'netlify_list_form_submissions') {
      const submissions = await NetlifyAPI.listFormSubmissions(creds, params.form_id, params.limit);
      return { ok: true, submissions };
    }

    if (toolName === 'netlify_delete_form_submission') {
      const result = await NetlifyAPI.deleteSubmission(creds, params.submission_id);
      return { ok: true, ...result };
    }

    if (toolName === 'netlify_delete_form') {
      const result = await NetlifyAPI.deleteForm(creds, params.site_id, params.form_id);
      return { ok: true, ...result };
    }

    // ── Hooks (Notifications) ──────────────────────────────────────────────
    if (toolName === 'netlify_list_hooks') {
      const hooks = await NetlifyAPI.listHooks(creds, params.site_id);
      return { ok: true, hooks };
    }

    if (toolName === 'netlify_create_hook') {
      const hook = await NetlifyAPI.createHook(creds, {
        site_id: params.site_id,
        type: params.type,
        event: params.event,
        data: params.data,
      });
      return { ok: true, hook };
    }

    if (toolName === 'netlify_delete_hook') {
      const result = await NetlifyAPI.deleteHook(creds, params.hook_id);
      return { ok: true, ...result };
    }

    // ── Build Hooks ────────────────────────────────────────────────────────
    if (toolName === 'netlify_list_build_hooks') {
      const buildHooks = await NetlifyAPI.listBuildHooks(creds, params.site_id);
      return { ok: true, buildHooks };
    }

    if (toolName === 'netlify_create_build_hook') {
      const buildHook = await NetlifyAPI.createBuildHook(creds, params.site_id, {
        title: params.title,
        branch: params.branch,
      });
      return { ok: true, buildHook };
    }

    if (toolName === 'netlify_delete_build_hook') {
      const result = await NetlifyAPI.deleteBuildHook(creds, params.site_id, params.build_hook_id);
      return { ok: true, ...result };
    }

    if (toolName === 'netlify_trigger_build_hook') {
      const result = await NetlifyAPI.triggerBuildHook(creds, params.build_hook_id);
      return { ok: true, ...result };
    }

    // ── Environment Variables ──────────────────────────────────────────────
    if (toolName === 'netlify_list_env_vars') {
      const env = await NetlifyAPI.listEnvVars(creds, params.site_id);
      return { ok: true, env };
    }

    if (toolName === 'netlify_update_env_vars') {
      const env = await NetlifyAPI.updateEnvVars(creds, params.site_id, params.vars);
      return { ok: true, env };
    }

    if (toolName === 'netlify_delete_env_var') {
      const result = await NetlifyAPI.deleteEnvVar(creds, params.site_id, params.key);
      return { ok: true, ...result };
    }

    // ── DNS ────────────────────────────────────────────────────────────────
    if (toolName === 'netlify_list_dns_zones') {
      const zones = await NetlifyAPI.listDnsZones(creds);
      return { ok: true, zones };
    }

    if (toolName === 'netlify_get_dns_zone') {
      const zone = await NetlifyAPI.getDnsZone(creds, params.zone_id);
      return { ok: true, zone };
    }

    if (toolName === 'netlify_create_dns_zone') {
      const zone = await NetlifyAPI.createDnsZone(creds, {
        name: params.name,
        accountId: params.account_id,
      });
      return { ok: true, zone };
    }

    if (toolName === 'netlify_delete_dns_zone') {
      const result = await NetlifyAPI.deleteDnsZone(creds, params.zone_id);
      return { ok: true, ...result };
    }

    if (toolName === 'netlify_transfer_dns_zone') {
      const zone = await NetlifyAPI.transferDnsZone(creds, params.zone_id, {
        transferAccountId: params.transfer_account_id,
        transferUserId: params.transfer_user_id,
      });
      return { ok: true, zone };
    }

    if (toolName === 'netlify_list_dns_records') {
      const records = await NetlifyAPI.listDnsRecords(creds, params.zone_id);
      return { ok: true, records };
    }

    if (toolName === 'netlify_create_dns_record') {
      const record = await NetlifyAPI.createDnsRecord(creds, params.zone_id, {
        type: params.type,
        hostname: params.hostname,
        value: params.value,
        ttl: params.ttl,
      });
      return { ok: true, record };
    }

    if (toolName === 'netlify_delete_dns_record') {
      const result = await NetlifyAPI.deleteDnsRecord(creds, params.zone_id, params.record_id);
      return { ok: true, ...result };
    }

    // ── Accounts & Members ─────────────────────────────────────────────────
    if (toolName === 'netlify_list_accounts') {
      const accounts = await NetlifyAPI.listAccounts(creds);
      return { ok: true, accounts };
    }

    if (toolName === 'netlify_get_account') {
      const account = await NetlifyAPI.getAccount(creds, params.account_id);
      return { ok: true, account };
    }

    if (toolName === 'netlify_update_account') {
      const account = await NetlifyAPI.updateAccount(creds, params.account_id, {
        name: params.name,
        slug: params.slug,
        type_id: params.type_id,
        billing_email: params.billing_email,
      });
      return { ok: true, account };
    }

    if (toolName === 'netlify_list_members') {
      const members = await NetlifyAPI.listMembers(creds, params.account_id);
      return { ok: true, members };
    }

    if (toolName === 'netlify_invite_member') {
      const member = await NetlifyAPI.inviteMember(creds, params.account_id, {
        email: params.email,
        role: params.role,
      });
      return { ok: true, member };
    }

    if (toolName === 'netlify_remove_member') {
      const result = await NetlifyAPI.removeMember(creds, params.account_id, params.member_id);
      return { ok: true, ...result };
    }

    if (toolName === 'netlify_list_audit_log') {
      const log = await NetlifyAPI.listAuditLog(creds, params.account_id, params.limit);
      return { ok: true, log };
    }

    // ── SSL ────────────────────────────────────────────────────────────────
    if (toolName === 'netlify_get_ssl') {
      const ssl = await NetlifyAPI.getSsl(creds, params.site_id);
      return { ok: true, ssl };
    }

    if (toolName === 'netlify_provision_ssl') {
      const ssl = await NetlifyAPI.provisionSsl(creds, params.site_id);
      return { ok: true, ssl };
    }

    // ── Snippets ───────────────────────────────────────────────────────────
    if (toolName === 'netlify_list_snippets') {
      const snippets = await NetlifyAPI.listSnippets(creds, params.site_id);
      return { ok: true, snippets };
    }

    if (toolName === 'netlify_create_snippet') {
      const snippet = await NetlifyAPI.createSnippet(creds, params.site_id, {
        title: params.title,
        generalContent: params.general,
        goalContent: params.goal,
        position: params.position,
      });
      return { ok: true, snippet };
    }

    if (toolName === 'netlify_get_snippet') {
      const snippet = await NetlifyAPI.getSnippet(creds, params.site_id, params.snippet_id);
      return { ok: true, snippet };
    }

    if (toolName === 'netlify_update_snippet') {
      const snippet = await NetlifyAPI.updateSnippet(creds, params.site_id, params.snippet_id, {
        title: params.title,
        general: params.general,
        goal: params.goal,
        position: params.position,
      });
      return { ok: true, snippet };
    }

    if (toolName === 'netlify_delete_snippet') {
      const result = await NetlifyAPI.deleteSnippet(creds, params.site_id, params.snippet_id);
      return { ok: true, ...result };
    }

    // ── Deploy Keys ────────────────────────────────────────────────────────
    if (toolName === 'netlify_list_deploy_keys') {
      const keys = await NetlifyAPI.listDeployKeys(creds);
      return { ok: true, keys };
    }

    if (toolName === 'netlify_create_deploy_key') {
      const key = await NetlifyAPI.createDeployKey(creds);
      return { ok: true, key };
    }

    if (toolName === 'netlify_get_deploy_key') {
      const key = await NetlifyAPI.getDeployKey(creds, params.key_id);
      return { ok: true, key };
    }

    if (toolName === 'netlify_delete_deploy_key') {
      const result = await NetlifyAPI.deleteDeployKey(creds, params.key_id);
      return { ok: true, ...result };
    }

    // ── Split Tests (A/B Testing) ──────────────────────────────────────────
    if (toolName === 'netlify_list_split_tests') {
      const splitTests = await NetlifyAPI.listSplitTests(creds, params.site_id);
      return { ok: true, splitTests };
    }

    if (toolName === 'netlify_create_split_test') {
      const splitTest = await NetlifyAPI.createSplitTest(creds, params.site_id, {
        branches: params.branches,
      });
      return { ok: true, splitTest };
    }

    if (toolName === 'netlify_update_split_test') {
      const splitTest = await NetlifyAPI.updateSplitTest(
        creds,
        params.site_id,
        params.split_test_id,
        { branches: params.branches },
      );
      return { ok: true, splitTest };
    }

    if (toolName === 'netlify_enable_split_test') {
      const splitTest = await NetlifyAPI.enableSplitTest(
        creds,
        params.site_id,
        params.split_test_id,
      );
      return { ok: true, splitTest };
    }

    if (toolName === 'netlify_disable_split_test') {
      const splitTest = await NetlifyAPI.disableSplitTest(
        creds,
        params.site_id,
        params.split_test_id,
      );
      return { ok: true, splitTest };
    }

    return null;
  });
}
