import { sendNotification } from './Notification.js';
export const actionType = 'http_request';
export const actionMeta = {
  label: 'HTTP request',
  group: 'Network',
  fields: ['url', 'method', 'headers', 'body', 'notify'],
  requiredFields: ['url'],
};
export async function execute(action) {
  if (!action.url) throw new Error('http_request: no URL provided');
  const method = (action.method || 'GET').toUpperCase(),
    headers = {};
  (action.headers &&
    String(action.headers)
      .split('\n')
      .forEach((line) => {
        const idx = line.indexOf(':');
        if (idx > 0) {
          const key = line.slice(0, idx).trim(),
            val = line.slice(idx + 1).trim();
          key && (headers[key] = val);
        }
      }),
    !headers['Content-Type'] && action.body && (headers['Content-Type'] = 'application/json'));
  const opts = { method: method, headers: headers };
  !['GET', 'HEAD'].includes(method) && action.body && (opts.body = action.body);
  try {
    const res = await fetch(action.url, opts);
    action.notify &&
      sendNotification(`${method} ${res.ok ? 'OK' : 'FAIL'} ${res.status}`, action.url);
  } catch (err) {
    throw (action.notify && sendNotification('HTTP Request Failed', err.message), err);
  }
}
