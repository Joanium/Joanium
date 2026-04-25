import * as CloudflareAPI from '../API/CloudflareAPI.js';
import { getCloudflareCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeCloudflareChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getCloudflareCredentials, notConnected, async (creds) => {
    if (toolName === 'cloudflare_list_zones') {
      const zones = await CloudflareAPI.listZones(creds);
      return { ok: true, zones };
    }

    if (toolName === 'cloudflare_verify_token') {
      const result = await CloudflareAPI.verifyToken(creds);
      return { ok: true, status: result?.status ?? 'active', result };
    }

    if (toolName === 'cloudflare_get_user') {
      const user = await CloudflareAPI.getUser(creds);
      return { ok: true, user };
    }

    if (toolName === 'cloudflare_list_accounts') {
      const accounts = await CloudflareAPI.listAccounts(creds);
      return { ok: true, accounts };
    }

    if (toolName === 'cloudflare_get_zone') {
      const { zoneId } = params;
      const zone = await CloudflareAPI.getZone(creds, zoneId);
      return { ok: true, zone };
    }

    if (toolName === 'cloudflare_get_zone_settings') {
      const { zoneId } = params;
      const settings = await CloudflareAPI.getZoneSettings(creds, zoneId);
      return { ok: true, settings };
    }

    if (toolName === 'cloudflare_update_zone_setting') {
      const { zoneId, settingId, value } = params;
      const result = await CloudflareAPI.updateZoneSetting(creds, zoneId, settingId, value);
      return { ok: true, setting: result };
    }

    if (toolName === 'cloudflare_get_zone_analytics') {
      const { zoneId, since, until } = params;
      const analytics = await CloudflareAPI.getZoneAnalytics(creds, zoneId, { since, until });
      return { ok: true, analytics };
    }

    if (toolName === 'cloudflare_pause_zone') {
      const { zoneId } = params;
      const zone = await CloudflareAPI.pauseZone(creds, zoneId);
      return { ok: true, zone };
    }

    if (toolName === 'cloudflare_unpause_zone') {
      const { zoneId } = params;
      const zone = await CloudflareAPI.unpauseZone(creds, zoneId);
      return { ok: true, zone };
    }

    if (toolName === 'cloudflare_list_dns_records') {
      const { zoneId } = params;
      const records = await CloudflareAPI.listDnsRecords(creds, zoneId);
      return { ok: true, records };
    }

    if (toolName === 'cloudflare_get_dns_record') {
      const { zoneId, recordId } = params;
      const record = await CloudflareAPI.getDnsRecord(creds, zoneId, recordId);
      return { ok: true, record };
    }

    if (toolName === 'cloudflare_create_dns_record') {
      const { zoneId, ...fields } = params;
      const record = await CloudflareAPI.createDnsRecord(creds, zoneId, fields);
      return { ok: true, record };
    }

    if (toolName === 'cloudflare_update_dns_record') {
      const { zoneId, recordId, ...fields } = params;
      const record = await CloudflareAPI.updateDnsRecord(creds, zoneId, recordId, fields);
      return { ok: true, record };
    }

    if (toolName === 'cloudflare_delete_dns_record') {
      const { zoneId, recordId } = params;
      const result = await CloudflareAPI.deleteDnsRecord(creds, zoneId, recordId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_export_dns_records') {
      const { zoneId } = params;
      const zoneFile = await CloudflareAPI.exportDnsRecords(creds, zoneId);
      return { ok: true, zoneFile };
    }

    if (toolName === 'cloudflare_purge_cache') {
      const { zoneId, ...options } = params;
      const result = await CloudflareAPI.purgeCache(creds, zoneId, options);
      return { ok: true, result };
    }

    if (toolName === 'cloudflare_get_caching_level') {
      const { zoneId } = params;
      const setting = await CloudflareAPI.getCachingLevel(creds, zoneId);
      return { ok: true, cachingLevel: setting?.value };
    }

    if (toolName === 'cloudflare_update_caching_level') {
      const { zoneId, value } = params;
      const result = await CloudflareAPI.updateCachingLevel(creds, zoneId, value);
      return { ok: true, cachingLevel: result?.value };
    }

    if (toolName === 'cloudflare_list_firewall_rules') {
      const { zoneId } = params;
      const rules = await CloudflareAPI.listFirewallRules(creds, zoneId);
      return { ok: true, rules };
    }

    if (toolName === 'cloudflare_create_firewall_rule') {
      const { zoneId, ...fields } = params;
      const rule = await CloudflareAPI.createFirewallRule(creds, zoneId, fields);
      return { ok: true, rule };
    }

    if (toolName === 'cloudflare_delete_firewall_rule') {
      const { zoneId, ruleId } = params;
      const result = await CloudflareAPI.deleteFirewallRule(creds, zoneId, ruleId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_ip_access_rules') {
      const { zoneId } = params;
      const rules = await CloudflareAPI.listIPAccessRules(creds, zoneId);
      return { ok: true, rules };
    }

    if (toolName === 'cloudflare_create_ip_access_rule') {
      const { zoneId, ...fields } = params;
      const rule = await CloudflareAPI.createIPAccessRule(creds, zoneId, fields);
      return { ok: true, rule };
    }

    if (toolName === 'cloudflare_delete_ip_access_rule') {
      const { zoneId, ruleId } = params;
      const result = await CloudflareAPI.deleteIPAccessRule(creds, zoneId, ruleId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_page_rules') {
      const { zoneId } = params;
      const rules = await CloudflareAPI.listPageRules(creds, zoneId);
      return { ok: true, rules };
    }

    if (toolName === 'cloudflare_create_page_rule') {
      const { zoneId, ...fields } = params;
      const rule = await CloudflareAPI.createPageRule(creds, zoneId, fields);
      return { ok: true, rule };
    }

    if (toolName === 'cloudflare_delete_page_rule') {
      const { zoneId, ruleId } = params;
      const result = await CloudflareAPI.deletePageRule(creds, zoneId, ruleId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_get_ssl_setting') {
      const { zoneId } = params;
      const setting = await CloudflareAPI.getSSLSetting(creds, zoneId);
      return { ok: true, sslMode: setting?.value };
    }

    if (toolName === 'cloudflare_update_ssl_setting') {
      const { zoneId, value } = params;
      const result = await CloudflareAPI.updateSSLSetting(creds, zoneId, value);
      return { ok: true, sslMode: result?.value };
    }

    if (toolName === 'cloudflare_list_certificates') {
      const { zoneId } = params;
      const certificates = await CloudflareAPI.listCertificates(creds, zoneId);
      return { ok: true, certificates };
    }

    if (toolName === 'cloudflare_list_workers') {
      const { accountId } = params;
      const workers = await CloudflareAPI.listWorkers(creds, accountId);
      return { ok: true, workers };
    }

    if (toolName === 'cloudflare_list_worker_routes') {
      const { zoneId } = params;
      const routes = await CloudflareAPI.listWorkerRoutes(creds, zoneId);
      return { ok: true, routes };
    }

    if (toolName === 'cloudflare_create_worker_route') {
      const { zoneId, pattern, script } = params;
      const route = await CloudflareAPI.createWorkerRoute(creds, zoneId, { pattern, script });
      return { ok: true, route };
    }

    if (toolName === 'cloudflare_delete_worker_route') {
      const { zoneId, routeId } = params;
      const result = await CloudflareAPI.deleteWorkerRoute(creds, zoneId, routeId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_rate_limits') {
      const { zoneId } = params;
      const rules = await CloudflareAPI.listRateLimits(creds, zoneId);
      return { ok: true, rules };
    }

    if (toolName === 'cloudflare_create_rate_limit') {
      const { zoneId, ...fields } = params;
      const rule = await CloudflareAPI.createRateLimit(creds, zoneId, fields);
      return { ok: true, rule };
    }

    if (toolName === 'cloudflare_delete_rate_limit') {
      const { zoneId, rateLimitId } = params;
      const result = await CloudflareAPI.deleteRateLimit(creds, zoneId, rateLimitId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_kv_namespaces') {
      const { accountId } = params;
      const namespaces = await CloudflareAPI.listKVNamespaces(creds, accountId);
      return { ok: true, namespaces };
    }

    if (toolName === 'cloudflare_create_kv_namespace') {
      const { accountId, title } = params;
      const namespace = await CloudflareAPI.createKVNamespace(creds, accountId, title);
      return { ok: true, namespace };
    }

    if (toolName === 'cloudflare_delete_kv_namespace') {
      const { accountId, namespaceId } = params;
      const result = await CloudflareAPI.deleteKVNamespace(creds, accountId, namespaceId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_kv_keys') {
      const { accountId, namespaceId, prefix, limit } = params;
      const keys = await CloudflareAPI.listKVKeys(creds, accountId, namespaceId, { prefix, limit });
      return { ok: true, keys };
    }

    if (toolName === 'cloudflare_get_kv_value') {
      const { accountId, namespaceId, key } = params;
      const value = await CloudflareAPI.getKVValue(creds, accountId, namespaceId, key);
      return { ok: true, key, value };
    }

    if (toolName === 'cloudflare_put_kv_value') {
      const { accountId, namespaceId, key, value, expiration, expirationTtl } = params;
      const result = await CloudflareAPI.putKVValue(creds, accountId, namespaceId, key, value, {
        expiration,
        expirationTtl,
      });
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_delete_kv_value') {
      const { accountId, namespaceId, key } = params;
      const result = await CloudflareAPI.deleteKVValue(creds, accountId, namespaceId, key);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_r2_buckets') {
      const { accountId } = params;
      const buckets = await CloudflareAPI.listR2Buckets(creds, accountId);
      return { ok: true, buckets };
    }

    if (toolName === 'cloudflare_create_r2_bucket') {
      const { accountId, ...fields } = params;
      const result = await CloudflareAPI.createR2Bucket(creds, accountId, fields);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_delete_r2_bucket') {
      const { accountId, bucketName } = params;
      const result = await CloudflareAPI.deleteR2Bucket(creds, accountId, bucketName);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_load_balancers') {
      const { zoneId } = params;
      const loadBalancers = await CloudflareAPI.listLoadBalancers(creds, zoneId);
      return { ok: true, loadBalancers };
    }

    if (toolName === 'cloudflare_list_load_balancer_pools') {
      const { accountId } = params;
      const pools = await CloudflareAPI.listLoadBalancerPools(creds, accountId);
      return { ok: true, pools };
    }

    if (toolName === 'cloudflare_create_load_balancer_pool') {
      const { accountId, ...fields } = params;
      const pool = await CloudflareAPI.createLoadBalancerPool(creds, accountId, fields);
      return { ok: true, pool };
    }

    if (toolName === 'cloudflare_list_custom_hostnames') {
      const { zoneId } = params;
      const hostnames = await CloudflareAPI.listCustomHostnames(creds, zoneId);
      return { ok: true, hostnames };
    }

    if (toolName === 'cloudflare_create_custom_hostname') {
      const { zoneId, ...fields } = params;
      const hostname = await CloudflareAPI.createCustomHostname(creds, zoneId, fields);
      return { ok: true, hostname };
    }

    if (toolName === 'cloudflare_delete_custom_hostname') {
      const { zoneId, customHostnameId } = params;
      const result = await CloudflareAPI.deleteCustomHostname(creds, zoneId, customHostnameId);
      return { ok: true, ...result };
    }

    if (toolName === 'cloudflare_list_tunnels') {
      const { accountId } = params;
      const tunnels = await CloudflareAPI.listTunnels(creds, accountId);
      return { ok: true, tunnels };
    }

    if (toolName === 'cloudflare_get_tunnel') {
      const { accountId, tunnelId } = params;
      const tunnel = await CloudflareAPI.getTunnel(creds, accountId, tunnelId);
      return { ok: true, tunnel };
    }

    if (toolName === 'cloudflare_list_access_applications') {
      const { accountId } = params;
      const apps = await CloudflareAPI.listAccessApplications(creds, accountId);
      return { ok: true, apps };
    }

    if (toolName === 'cloudflare_list_access_policies') {
      const { accountId, appId } = params;
      const policies = await CloudflareAPI.listAccessPolicies(creds, accountId, appId);
      return { ok: true, policies };
    }

    if (toolName === 'cloudflare_list_logpush_jobs') {
      const { zoneId } = params;
      const jobs = await CloudflareAPI.listLogpushJobs(creds, zoneId);
      return { ok: true, jobs };
    }

    if (toolName === 'cloudflare_list_health_checks') {
      const { zoneId } = params;
      const checks = await CloudflareAPI.listHealthChecks(creds, zoneId);
      return { ok: true, checks };
    }

    if (toolName === 'cloudflare_create_health_check') {
      const { zoneId, ...fields } = params;
      const check = await CloudflareAPI.createHealthCheck(creds, zoneId, fields);
      return { ok: true, check };
    }

    if (toolName === 'cloudflare_delete_health_check') {
      const { zoneId, healthCheckId } = params;
      const result = await CloudflareAPI.deleteHealthCheck(creds, zoneId, healthCheckId);
      return { ok: true, ...result };
    }

    return null; // tool not recognised
  });
}
