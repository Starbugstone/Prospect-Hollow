import { reactive } from 'vue';
import { Capacitor } from '@capacitor/core';
import { townStorage, townKey } from './townStorage';
import { townCoordinator } from './townCoordinator';
import { createSyncService } from './syncService';
import { recoveryStore } from './recoveryStore';
const native = Capacitor.isNativePlatform();
const base = (import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/$/, '');
let bearer = '',
  epoch = 0,
  service,
  sessionGeneration,
  accountRefresh;
export const cloud = reactive({
  account: null,
  sessionExpired: false,
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
  if (cloud.sessionExpired && !authentication)
    throw new Error('Sign in again to resume cloud saving. Your town stays playable offline.');
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
  // Hosting may reject oversized requests before the API can return JSON.
  const data = await response.json().catch(() => {
    if (response.ok) throw new Error('The server returned an unreadable save response.');
    return {
      error:
        response.status === 413
          ? 'This save is too large for cloud storage. Your local progress is kept.'
          : `Cloud saving failed (HTTP ${response.status}). Your local progress is kept.`,
    };
  });
  if (generation !== epoch || storedGeneration !== townStorage.auth().generation)
    throw new Error('The account changed while this request was in progress.');
  if (
    townId &&
    (data.townId ?? data.cloud?.townId) &&
    (data.townId ?? data.cloud?.townId) !== townId
  )
    throw new Error('The server returned a different town. Your local save has been kept.');
  if (!response.ok) {
    if (response.status === 401 && !authentication) {
      epoch++;
      bearer = '';
      cloud.csrf = '';
      cloud.sessionExpired = true;
      townStorage.expireSession();
      sessionGeneration = townStorage.auth().generation;
      cloud.storageVersion++;
    }
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
    account: () => (cloud.sessionExpired ? null : cloud.account),
    ...options,
  });
  cloud.account = stored;
  cloud.sessionExpired = townStorage.auth().expired === true;
  return service;
}
export function refreshAccount() {
  const generation = townStorage.auth().generation;
  if (accountRefresh?.generation === generation) return accountRefresh.promise;
  const promise = fetchAccount().finally(() => {
    if (accountRefresh?.promise === promise) accountRefresh = undefined;
  });
  accountRefresh = { generation, promise };
  return promise;
}
async function fetchAccount() {
  if (!cloud.account || cloud.sessionExpired) return;
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
export async function syncNow({ pull = true, retryRejected = false } = {}) {
  if (!cloud.account || cloud.sessionExpired || cloud.busy || !service) return;
  if (retryRejected) {
    const meta = townStorage.active()?.meta;
    if (meta?.owner === cloud.account.id)
      townStorage.mutate(meta.id, meta.owner, (r) => {
        r.meta.uploadError = null;
      });
  }
  cloud.busy = true;
  cloud.status = 'Syncing…';
  cloud.error = '';
  try {
    if (!cloud.csrf) await refreshAccount();
    await service.sync({ pull });
    updateSaveStatus();
    return true;
  } catch (error) {
    updateSaveStatus();
    if (cloud.account && !cloud.sessionExpired && !townStorage.active()?.meta.uploadError)
      cloud.status = 'Offline — cloud backup pending';
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
  cloud.sessionExpired = false;
  townStorage.account(result.account, true);
  sessionGeneration = townStorage.auth().generation;
  await refreshAccount();
  await syncNow();
}
export function disconnect() {
  epoch++;
  bearer = '';
  cloud.account = null;
  cloud.sessionExpired = false;
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
const rejectedCreation = (error) =>
  [413, 422].includes(error.status) ||
  (error.status === 409 && ['name_taken', 'slots_full'].includes(error.data?.code));
function townName(name) {
  name = name.normalize('NFKC').trim().replace(/ +/g, ' ');
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} '’\-]{2,23}$/u.test(name))
    throw new Error('Use 3–24 letters, numbers, spaces, apostrophes or hyphens for the town name.');
  return name;
}
// Until the outcome is known, a retry keeps the original UUID and exact request.
export async function createAccountTown(name, profile) {
  const owner = cloud.account?.id;
  if (!owner) throw new Error('Sign in to save this town.');
  return townCoordinator.run(`account-creation:${owner}`, async () => {
    const previous = townStorage.state()?.creation;
    const body =
      previous?.owner === owner
        ? previous.body
        : {
            townId: crypto.randomUUID(),
            name: townName(name),
            baseRevision: 0,
            uploadId: crypto.randomUUID(),
            profile,
          };
    townStorage.creation({ owner, body });
    let result;
    try {
      result = await request('towns', body);
    } catch (error) {
      if (error.status === 409 && error.data?.code === 'town_exists') {
        // A later save may have replaced the creation receipt after its reply was lost.
        // This endpoint still checks authenticated ownership of the original UUID.
        try {
          result = await request(`towns/${body.townId}`);
        } catch (lookup) {
          if (lookup.status === 404) townStorage.creation(null);
          throw lookup;
        }
      } else {
        if (rejectedCreation(error)) townStorage.creation(null);
        throw error;
      }
    }
    // Cache the accepted snapshot before forgetting a lost-response receipt.
    await cacheTown(result);
    await refreshAccount();
    townStorage.creation(null);
    return result;
  });
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
            name: townName(name),
            baseRevision: 0,
            uploadId: crypto.randomUUID(),
            profile: local.profile,
          };
      const sequence = saved?.body === body ? saved.sequence : local.meta.sequence;
      townStorage.attachment(body, sequence);
      let result;
      try {
        result = await request('towns', body);
      } catch (error) {
        if (rejectedCreation(error)) townStorage.attachment(null);
        throw error;
      }
      townStorage.attach(result, owner, sequence);
    }),
  );
  await refreshAccount();
  await syncNow();
}
export async function reviewRecovery(id, recoveryId) {
  try {
    return await service.reviewRecovery(id, recoveryId);
  } finally {
    cloud.storageVersion++;
    updateSaveStatus();
  }
}
export async function overwriteRecovery(id, review) {
  try {
    await service.overwriteRecovery(id, review);
  } finally {
    cloud.storageVersion++;
    updateSaveStatus();
  }
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

export async function listRecoveries(id) {
  const owner = cloud.account?.id;
  const legacy = townStorage.get(id, owner)?.meta.recovery;
  if (legacy?.profile) {
    await recoveryStore.put({ ...legacy, owner, townId: id, createdAt: legacy.updatedAt ?? 0 });
    townStorage.mutate(id, owner, (r) => {
      if (r.meta.recovery?.id !== legacy.id) return false;
      const { profile, ...descriptor } = legacy;
      r.meta.recovery = descriptor;
    });
  }
  return recoveryStore.list(owner, id);
}
export async function getRecovery(id, recoveryId) {
  return recoveryStore.get(recoveryId, cloud.account?.id, id);
}
export async function deleteRecovery(id, recoveryId) {
  return townAction(id, async () => {
    const owner = cloud.account.id;
    await recoveryStore.remove(recoveryId, owner, id);
    const remaining = await recoveryStore.list(owner, id);
    townStorage.mutate(id, owner, (r) => {
      const { profile, ...descriptor } = remaining[0] ?? {};
      r.meta.recovery = remaining.length ? descriptor : null;
      if (!remaining.length) r.meta.desyncNotice = false;
    });
    cloud.storageVersion++;
  });
}
export async function deleteCachedTown(id) {
  return townAction(id, async () => {
    const owner = cloud.account.id;
    if (townStorage.selectedKey() === townKey(id, owner))
      throw new Error('Open another town before removing this device copy.');
    await recoveryStore.clearTown(owner, id);
    townStorage.forget(id, owner);
    cloud.storageVersion++;
  });
}
export async function deleteAccount(confirmation) {
  const owner = cloud.account?.id;
  if (!owner) throw new Error('Sign in to delete your account.');
  if (confirmation !== 'DELETE MY ACCOUNT') throw new Error('Type DELETE MY ACCOUNT to confirm.');
  await request('account', { confirmation }, 'DELETE');
  // Explicit account deletion removes this device's caches, unlike expiry/logout.
  // Server success is final even if a browser refuses local cleanup. Try both
  // storage systems and report the difference instead of offering deletion again.
  let localCleanupComplete = true;
  try {
    disconnect(); // Fence other tabs and in-flight replies before removing their cached records.
  } catch {
    localCleanupComplete = false;
  }
  try {
    townStorage.clearAccountCache(owner);
  } catch {
    localCleanupComplete = false;
  }
  try {
    await recoveryStore.clearOwner(owner);
  } catch {
    localCleanupComplete = false;
  }
  cloud.storageVersion++;
  return { localCleanupComplete };
}
export function updateSaveStatus() {
  const meta = townStorage.active()?.meta;
  cloud.status =
    !cloud.account || meta?.owner !== cloud.account.id
      ? 'Saved locally'
      : cloud.sessionExpired
        ? 'Sign in again — playing offline'
        : meta.uploadError &&
            (meta.uploadError.code === 'save_format_unsupported' ||
              meta.uploadError.sequence === meta.sequence)
          ? 'Cloud backup needs attention'
          : meta.conflict
            ? 'Cloud update pending — local save kept'
            : meta.missing
              ? 'Cloud town unavailable — local copy kept'
              : meta.dirty || meta.pending
                ? 'Saved locally — cloud backup pending'
                : 'Cloud saved';
}
