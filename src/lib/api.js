const TOKEN_KEY = 'shoplab.token';

// "Remember me" stores the token in localStorage (survives browser restarts);
// otherwise it lives in sessionStorage and disappears when the tab closes.
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token, remember) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Request failed with status ${status}`);
    this.status = status;
    this.code = data?.code;
    this.fields = data?.fields || {};
    this.data = data;
  }
}

let sessionExpiredHandler = null;
export function onSessionExpired(fn) {
  sessionExpiredHandler = fn;
}

export async function api(path, { method = 'GET', body, signal, raw = false, silent = false } = {}) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { error: 'Network error. Check your connection and try again.', code: 'NETWORK' });
  }

  if (raw && res.ok) return res;
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && token && data?.code === 'SESSION_EXPIRED') {
      clearToken();
      if (!silent) sessionExpiredHandler?.();
    }
    throw new ApiError(res.status, data);
  }
  return data;
}

// Fetches an authenticated file and hands it to the browser as a download.
export async function downloadFile(path, fallbackName) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
