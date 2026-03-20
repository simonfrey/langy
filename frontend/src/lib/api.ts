const BASE = '/api';

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

function getToken(): string | null {
  return localStorage.getItem('langy_token');
}

export function setToken(token: string) {
  localStorage.setItem('langy_token', token);
}

export function clearToken() {
  localStorage.removeItem('langy_token');
}

function handleUnauthorized() {
  clearToken();
  localStorage.removeItem('langy_user');
  onUnauthorized?.();
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/** Normalize image URLs from the API — strips any reverse-proxy prefix before /api/ */
export function imageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const idx = url.indexOf('/api/');
  return idx >= 0 ? url.slice(idx) : url;
}

export async function apiFormData<T = unknown>(
  path: string,
  formData: FormData,
  method: string = 'POST',
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}
