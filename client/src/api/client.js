const BASE_URL = '/api';

let accessToken = localStorage.getItem('accessToken');
let csrfToken = null;

// ── Token Management ────────────────────────────────────

export function setToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

export function getToken() {
  return accessToken;
}

// ── CSRF Token ──────────────────────────────────────────

async function fetchCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${BASE_URL}/csrf-token`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
    }
  } catch {
    // CSRF fetch failure is non-blocking
  }
  return csrfToken;
}

// ── Refresh Token Lock ──────────────────────────────────
// Prevents multiple parallel refresh requests

let refreshPromise = null;

async function refreshToken() {
  // If a refresh is already in-flight, wait for it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      setToken(data.accessToken);
      return data.accessToken;
    } catch {
      setToken(null);
      localStorage.removeItem('user');
      window.location.href = '/login';
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── API Client ──────────────────────────────────────────

export async function api(path, options = {}) {
  const { method = 'GET', body, headers: customHeaders = {}, idempotencyKey } = options;

  const headers = { ...customHeaders };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrf = await fetchCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401 (with lock to prevent parallel refreshes)
  if (res.status === 401 && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
    const newToken = await refreshToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    const err = new Error(error.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = error.error;
    throw err;
  }

  return res.json();
}

// ── GET Request Deduplication ────────────────────────────
// If multiple components request the same GET endpoint simultaneously,
// only one fetch fires. Others get the same promise.
const inflightGets = new Map();

function deduplicatedGet(path) {
  if (inflightGets.has(path)) {
    return inflightGets.get(path);
  }
  const promise = api(path).finally(() => {
    inflightGets.delete(path);
  });
  inflightGets.set(path, promise);
  return promise;
}

// ── Debounce Utility ────────────────────────────────────
export function debounce(fn, ms = 500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Convenience Methods ─────────────────────────────────

export const get = (path) => deduplicatedGet(path);
export const post = (path, body, opts) => api(path, { method: 'POST', body, ...opts });
export const put = (path, body, opts) => api(path, { method: 'PUT', body, ...opts });
export const del = (path) => api(path, { method: 'DELETE' });
