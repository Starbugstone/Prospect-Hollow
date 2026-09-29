import { reactive } from 'vue';

// The admin session lives in an HttpOnly cookie; mutations also send its CSRF token.
// stage: '' signed out, then 'totp' | 'change' | 'enroll' while signing in, 'full' after.
export const adminSession = reactive({ checked: false, stage: '', username: '' });
let csrf = '';

export class AdminError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function adminUrl(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
  const search = params.toString();
  return `/api/admin/${path}${search ? `?${search}` : ''}`;
}

export async function adminApi(method, path, { body, query } = {}) {
  const read = method === 'GET';
  const response = await fetch(adminUrl(path, query), {
    method,
    credentials: 'same-origin',
    headers: read
      ? { Accept: 'application/json' }
      : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: read ? undefined : JSON.stringify(body ?? {}),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* A proxy error page is not JSON; the status still explains it. */
  }
  if (typeof data?.csrf === 'string') csrf = data.csrf;
  if (typeof data?.stage === 'string') adminSession.stage = data.stage;
  if (!response.ok) {
    // An expired or revoked session returns to the sign-in form.
    if (response.status === 401) {
      adminSession.stage = '';
      csrf = '';
    }
    throw new AdminError(
      data?.error ?? `The request failed (${response.status}).`,
      response.status,
      data,
    );
  }
  return data;
}

export async function restoreSession() {
  try {
    const me = await adminApi('GET', 'me');
    adminSession.username = me.admin.username;
  } catch {
    adminSession.stage = '';
  } finally {
    adminSession.checked = true;
  }
}
export async function signOut() {
  try {
    await adminApi('POST', 'logout');
  } finally {
    adminSession.stage = '';
    adminSession.username = '';
    csrf = '';
  }
}
