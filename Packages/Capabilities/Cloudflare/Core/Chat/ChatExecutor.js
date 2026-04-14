import * as CloudflareAPI from '../API/CloudflareAPI.js';
import { getCloudflareCredentials, notConnected } from '../Shared/Common.js';

export async function executeCloudflareChatTool(ctx, toolName, params) {
  const creds = getCloudflareCredentials(ctx);
  if (!creds) return notConnected();

  try {
    // ─── Account & Token ─────────────────────────────────────────────────────
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

    // ─── Zone Management ─────────────────────────────────────────────────────
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

    // ─── DNS Records ─────────────────────────────────────────────────────────
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

    // ─── Cache ───────────────────────────────────────────────────────────────
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

    // ─── Firewall Rules ──────────────────────────────────────────────────────
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

    // ─── IP Access Rules ─────────────────────────────────────────────────────
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

    // ─── Page Rules ──────────────────────────────────────────────────────────
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

    // ─── SSL / TLS ───────────────────────────────────────────────────────────
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

    // ─── Workers ─────────────────────────────────────────────────────────────
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

    return null; // tool not recognised
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
