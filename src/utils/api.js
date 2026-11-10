const inFlightGetRequests = new Map();

export async function apiRequest(path, options = {}) {
  const method = options.method || 'GET';
  const csrf = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrf_access_token='))
    ?.split('=')
    .slice(1)
    .join('=');
  const requestKey = method === 'GET' ? `${csrf || 'anonymous'}:${path}` : null;
  if (requestKey && inFlightGetRequests.has(requestKey)) return inFlightGetRequests.get(requestKey);

  const request = (async () => {
    const response = await fetch(`/api/portal${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' && csrf ? { 'X-CSRF-TOKEN': decodeURIComponent(csrf) } : {}),
        ...options.headers,
      },
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('The server returned an invalid response. Check that the Flask API is running.');
    }
    if (!response.ok) throw new Error(result.error || result.msg || 'The request could not be completed.');
    return result;
  })();

  if (requestKey) inFlightGetRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (requestKey && inFlightGetRequests.get(requestKey) === request) {
      inFlightGetRequests.delete(requestKey);
    }
  }
}
