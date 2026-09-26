import { reactive } from 'vue';
import { Capacitor } from '@capacitor/core';
import { townStorage } from './townStorage';
import { createSyncService } from './syncService';
const native = Capacitor.isNativePlatform();
const base = (import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/$/, '');
let bearer = '',
  epoch = 0,
  service;
export const cloud = reactive({
  account: null,
  csrf: '',
  towns: [],
  status: 'Saved locally',
  busy: false,
  error: '',
  storageVersion: 0,
});
export async function request(
  path,
  body,
  method = body === undefined ? 'GET' : 'POST',
  authentication = false,
) {
  if (!cloud.account && !authentication) throw new Error('Sign in to use cloud features.');
  if (native && !base.startsWith('https://'))
    throw new Error('Cloud saving needs an HTTPS server configured for this app.');
  const generation = epoch;
  const response = await fetch(`${base}/${path}`, {
    method,
    credentials: native ? 'omit' : 'same-origin',
    cache: 'no-store',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      'X-CSRF-Token': cloud.csrf,
      ...(native && bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (generation !== epoch)
    throw new Error('The account changed while this request was in progress.');
  if (!response.ok) {
    if (response.status === 401 && !authentication) disconnect();
    const error = new Error(data.error ?? 'Cloud save unavailable. Your local progress is safe.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  if (data.csrf) cloud.csrf = data.csrf;
  return data;
}
export function configureSync(options) {
  const stored = townStorage.state()?.account ?? null;
  if (stored?.id !== cloud.account?.id) {
    epoch++;
    bearer = '';
    cloud.csrf = '';
    cloud.towns = [];
  }
  service = createSyncService({
    storage: townStorage,
    request,
    account: () => cloud.account,
    ...options,
  });
  cloud.account = stored;
  return service;
}
export async function refreshAccount() {
  if (!cloud.account) return;
  const result = await request('account');
  if (result.account.id !== cloud.account.id) {
    disconnect();
    throw new Error('The account changed. Sign in again.');
  }
  cloud.account = result.account;
  townStorage.account(result.account);
  cloud.towns = result.towns;
}
export async function syncNow() {
  if (!cloud.account || cloud.busy || !service) return;
  cloud.busy = true;
  cloud.status = 'Syncing…';
  cloud.error = '';
  try {
    if (!cloud.csrf) await refreshAccount();
    await service.sync();
    const records = townStorage.records(cloud.account?.id);
    cloud.status = records.some((r) => r.meta.conflict)
      ? 'Conflict needs attention'
      : records.some((r) => r.meta.missing)
        ? 'Cloud town unavailable — local copy kept'
        : records.some((r) => r.meta.dirty)
          ? 'Saved locally — cloud backup pending'
          : records.length && townStorage.active()?.meta.owner
            ? 'Cloud saved'
            : 'Saved locally';
  } catch (error) {
    cloud.status = cloud.account ? 'Offline — cloud backup pending' : 'Saved locally';
    cloud.error = error.message;
  } finally {
    cloud.busy = false;
    cloud.storageVersion++;
  }
}
export function sendLogin(email) {
  return request('auth/login-link', { email }, 'POST', true);
}
export async function confirmLogin(link) {
  const token = link.includes('#login=') ? link.split('#login=')[1] : link.trim();
  const result = await request('auth/confirm', { token, native }, 'POST', true);
  epoch++;
  bearer = result.token ?? '';
  cloud.account = result.account;
  townStorage.account(result.account);
  await refreshAccount();
  await syncNow();
}
export function disconnect() {
  epoch++;
  bearer = '';
  cloud.account = null;
  cloud.csrf = '';
  cloud.towns = [];
  cloud.status = 'Saved locally';
  townStorage.logout();
  cloud.storageVersion++;
}
export async function logout(all = false) {
  // Revocation must succeed before claiming the server session is signed out.
  await request(all ? 'auth/revoke-all' : 'auth/logout', {});
  disconnect();
}
export async function attachLocal(name) {
  if (!cloud.account) throw new Error('Sign in to save this town.');
  const local = townStorage.active(),
    owner = cloud.account.id;
  if (local.meta.owner && local.meta.owner !== owner)
    throw new Error('This town belongs to a different account.');
  const known = cloud.towns.find((t) => t.townId === local.meta.id);
  if (known) {
    townStorage.attach({ ...known, revision: local.meta.baseRevision || 0 }, owner, -1);
    await syncNow();
    return;
  }
  // This save-level retry is durable, including an acknowledgment lost during attachment.
  const saved = local.meta.attachment;
  const body =
    saved?.body.name === name
      ? saved.body
      : {
          townId: local.meta.id,
          name,
          baseRevision: 0,
          uploadId: crypto.randomUUID(),
          profile: local.profile,
        };
  townStorage.renameLocal(name);
  const sequence = saved?.body === body ? saved.sequence : local.meta.sequence;
  townStorage.attachment(body, sequence);
  const result = await request('towns', body);
  townStorage.attach(result, owner, sequence);
  await refreshAccount();
  await syncNow();
}
export async function resolveConflict(id, choice) {
  await service.resolve(id, choice);
  cloud.storageVersion++;
  await syncNow();
}
