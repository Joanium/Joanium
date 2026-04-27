const BASE = 'https://api.netlify.com/api/v1';

function headers(creds) {
  return { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' };
}

export async function netlifyRequest(path, creds, { method = 'GET', body, successValue } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: method,
    headers: headers(creds),
    ...(void 0 === body ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? data.error ?? `Netlify API error: ${response.status}`);
  }

  if (void 0 !== successValue) return successValue;
  if (204 === response.status) return null;

  return response.json();
}
