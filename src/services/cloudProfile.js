import { reactive } from 'vue';
import { Capacitor } from '@capacitor/core';
import { townStorage, townKey } from './townStorage';
import { townCoordinator } from './townCoordinator';
import { createSyncService } from './syncService';
const native = Capacitor.isNativePlatform();
const base = (import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/$/, '');
let bearer = '',
  epoch = 0,
  service,
  sessionGeneration;
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
  const generation = epoch,
    storedGeneration = townStorage.auth().generation;
  const townId = path.match(/^towns\/([^/]+)/)?.[1] ?? (path === 'towns' ? body?.townId : null);
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
  if (generation !== epoch || storedGeneration !== townStorage.auth().generation)
    throw new Error('The account changed while this request was in progress.');
  if (
    townId &&
    (data.townId ?? data.cloud?.townId) &&
    (data.townId ?? data.cloud?.townId) !== townId
  )
    throw new Error('The server returned a different town. Your local save has been kept.');
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
  const stored = townStorage.auth().account;
  if (stored?.id !== cloud.account?.id || sessionGeneration !== townStorage.auth().generation) {
    epoch++;
    bearer = '';
    cloud.csrf = '';
    cloud.towns = [];
  }
  sessionGeneration = townStorage.auth().generation;
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
  const generation = townStorage.auth().generation;
  const result = await request('account');
  if (generation !== townStorage.auth().generation)
    throw new Error('The account changed. Sign in again.');
  if (result.account.id !== cloud.account.id) {
    disconnect();
    throw new Error('The account changed. Sign in again.');
  }
  cloud.account = result.account;
  townStorage.account(result.account);
  cloud.towns = result.towns;
}
export async function syncNow({ pull = true } = {}) {
  if (!cloud.account || cloud.busy || !service) return;
  cloud.busy = true;
  cloud.status = 'Syncing…';
  cloud.error = '';
  try {
    if (!cloud.csrf) await refreshAccount();
    await service.sync({ pull });
    updateSaveStatus();
    return true;
  } catch (error) {
    cloud.status = cloud.account ? 'Offline — cloud backup pending' : 'Saved locally';
    cloud.error = error.message;
    return false;
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
  townStorage.account(result.account, true);
  sessionGeneration = townStorage.auth().generation;
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
  if (local.meta.owner) throw new Error('This town is already attached to an account.');
  await townCoordinator.run(townStorage.selectedKey(), () =>
    townCoordinator.run(townKey(local.meta.id, owner), async () => {
      const known = cloud.towns.find((t) => t.townId === local.meta.id);
      if (known)
        throw new Error(
          'This town is already on your account. Open it from your town list; your local town is kept.',
        );
      // This save-level retry is durable, including an acknowledgment lost during attachment.
      const saved = local.meta.attachment;
      const body = saved
        ? saved.body
        : {
            townId: local.meta.id,
            name,
            baseRevision: 0,
            uploadId: crypto.randomUUID(),
            profile: local.profile,
          };
      townStorage.renameLocal(body.name);
      const sequence = saved?.body === body ? saved.sequence : local.meta.sequence;
      townStorage.attachment(body, sequence);
      const result = await request('towns', body);
      townStorage.attach(result, owner, sequence);
    }),
  );
  await refreshAccount();
  await syncNow();
}
export async function resolveConflict(id, choice) {
  await service.resolve(id, choice);
  cloud.storageVersion++;
  await syncNow();
}

export async function restoreSave(id, profile) {
  await service.restore(id, profile);
  cloud.storageVersion++;
}
// Metadata changes use the same per-town queue as uploads and resolutions.
export function townAction(id, operation) {
  const owner = cloud.account?.id;
  return townCoordinator.run(townKey(id, owner), async () => {
    if (!owner || townStorage.auth().account?.id !== owner)
      throw new Error('Sign in to use account town slots.');
    return operation();
  });
}
export async function cacheTown(town) {
  const owner = cloud.account?.id;
  if (townStorage.get(town.townId, owner)) return;
  await townAction(town.townId, async () => {
    if (!townStorage.get(town.townId, owner))
      townStorage.remember(await request(`towns/${town.townId}`), owner);
  });
}

export function updateSaveStatus() {
  const meta = townStorage.active()?.meta;
  cloud.status =
    !cloud.account || meta?.owner !== cloud.account.id
      ? 'Saved locally'
      : meta.conflict
        ? 'Conflict needs attention'
        : meta.missing
          ? 'Cloud town unavailable — local copy kept'
          : meta.dirty || meta.pending
            ? 'Saved locally — cloud backup pending'
            : 'Cloud saved';
}
