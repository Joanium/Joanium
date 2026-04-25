function getGoogleApiErrorDetail(body = {}) {
  return body.error?.message ?? JSON.stringify(body);
}

export function createGoogleApiFetch(refreshCreds, defaults = {}) {
  return async function googleApiFetch(creds, url, options = {}, config = {}) {
    const {
      serviceName = 'Google',
      responseType = 'json',
      defaultContentType = 'application/json',
      forbiddenErrorMessage = null,
    } = {
      ...defaults,
      ...config,
    };
    const fresh = await refreshCreds(creds);
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        ...(defaultContentType ? { 'Content-Type': defaultContentType } : {}),
        ...(options.headers ?? {}),
      },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const detail = getGoogleApiErrorDetail(errorBody);
      if (403 === response.status && forbiddenErrorMessage)
        throw new Error(`${forbiddenErrorMessage}. Detail: ${detail}`);
      throw new Error(`${serviceName} API error (${response.status}): ${detail}`);
    }
    return 204 === response.status
      ? null
      : 'text' === responseType
        ? response.text()
        : 'auto' === responseType
          ? (response.headers.get('content-type') ?? '').includes('json')
            ? response.json()
            : response.text()
          : response.json();
  };
}

async function getFreshGoogleCreds(creds) {
  const { getFreshCreds: getFreshCreds } = await import('../../../GoogleWorkspace.js');
  return getFreshCreds(creds);
}

export function createGoogleJsonFetch(serviceName, options = {}) {
  return createGoogleApiFetch(getFreshGoogleCreds, {
    serviceName: serviceName,
    responseType: 'json',
    ...options,
  });
}
