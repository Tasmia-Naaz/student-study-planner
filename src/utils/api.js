import { apiUrl } from './apiBase';

const inFlightGetRequests = new Map();
let sessionCsrfToken = null;

export function setCsrfToken(token) {
  sessionCsrfToken = token || null;
}

export function getCsrfToken() {
  if (sessionCsrfToken) return sessionCsrfToken;
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrf_access_token='))
    ?.split('=')
    .slice(1)
    .join('=') || null;
}

export function csrfHeaders(method) {
  const csrf = getCsrfToken();
  return method !== 'GET' && csrf ? { 'X-CSRF-TOKEN': decodeURIComponent(csrf) } : {};
}

export async function apiRequest(path, options = {}) {
  const method = options.method || 'GET';
  const csrf = getCsrfToken();
  const requestKey = method === 'GET' ? `${csrf || 'anonymous'}:${path}` : null;
  if (requestKey && inFlightGetRequests.has(requestKey)) return inFlightGetRequests.get(requestKey);

  const request = (async () => {
    const response = await fetch(apiUrl(`/api/portal${path}`), {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...csrfHeaders(method),
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
