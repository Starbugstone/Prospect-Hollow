const queues = new WeakMap();
const copy = (value) => JSON.parse(JSON.stringify(value));
const recoveryCopy = (record, reason) => ({
  id: crypto.randomUUID(),
  profile: record.profile,
  updatedAt: record.meta.updatedAt,
  baseRevision: record.meta.baseRevision,
  reason,
});
function serialize(storage, key, operation) {
  let pending = queues.get(storage);
  if (!pending) queues.set(storage, (pending = new Map()));
  const task = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  pending.set(key, task);
  task
    .finally(() => {
      if (pending.get(key) === task) pending.delete(key);
    })
    .catch(() => {});
  return task;
}
// Synchronization copies snapshots; it never authorizes or executes gameplay actions.
export function createSyncService({
  storage,
  request,
  account,
  canApply = () => true,
  applied = () => {},
  eligible = () => true,
  targets = (owner) => storage.records(owner),
  run = (id, owner, operation) => serialize(storage, `${owner}:${id}`, operation),
}) {
  let running;
  const current = (owner) => account()?.id === owner;
  const entry = (id, owner) =>
    storage.get?.(id, owner) ?? storage.records(owner).find((r) => r.meta.id === id);
  function accept(id, owner, result, sequence, downloaded = false, pending = null) {
    if (!current(owner)) return;
    if (result.townId !== id) throw new Error('The server returned a different town.');
    let replaced = false;
    storage.mutate(id, owner, (r) => {
      if (result.revision < r.meta.baseRevision) return false;
      if (pending && r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
      if (pending?.replace) {
        if (r.meta.sequence !== sequence || !canApply(id)) {
          r.meta.conflict = result;
          r.meta.pending = null;
          return;
        }
        r.meta.recovery = recoveryCopy(r, 'replacement');
        r.meta.desyncNotice = false;
        r.profile = result.profile;
        replaced = true;
      }
      if (downloaded && (r.meta.sequence !== sequence || r.meta.dirty || !canApply(id)))
        return false;
      if (downloaded) {
        r.profile = result.profile;
        replaced = true;
      }
      r.meta = {
        ...r.meta,
        baseRevision: result.revision,
        cloudAt: result.updatedAt,
        name: result.name,
        publicId: result.publicId,
        isPublic: result.isPublic,
        dirty: r.meta.sequence !== sequence,
        pending: null,
        conflict: null,
        missing: false,
      };
    });
    if (replaced) applied(id);
  }
  function conflict(id, owner, cloud, pending = null) {
    if (cloud.townId !== id) throw new Error('The server returned a different town.');
    let replaced = false;
    if (current(owner))
      storage.mutate(id, owner, (r) => {
        if (cloud.revision < Math.max(r.meta.baseRevision, r.meta.conflict?.revision ?? 0))
          return false;
        if (pending && r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
        r.meta.conflict = cloud;
        r.meta.pending = null;
        // A running mine stays entirely local. Its final village changes join the
        // recovery copy when we can safely apply the server save on return.
        if (!eligible(id, owner) || !canApply(id)) return;
        if (r.meta.dirty) r.meta.recovery = recoveryCopy(r, 'desync');
        r.profile = cloud.profile;
        r.meta = {
          ...r.meta,
          baseRevision: cloud.revision,
          cloudAt: cloud.updatedAt,
          name: cloud.name,
          publicId: cloud.publicId,
          isPublic: cloud.isPublic,
          dirty: false,
          conflict: null,
          sequence: r.meta.sequence + 1,
          desyncNotice: r.meta.recovery?.reason === 'desync',
        };
        replaced = true;
      });
    if (replaced) applied(id);
  }
  async function upload(id, owner, pending, resolve = false) {
    try {
      const result = await request(`towns/${id}${resolve ? '/resolve' : ''}`, pending.body, 'PUT');
      accept(id, owner, result, pending.sequence, false, pending);
    } catch (error) {
      if (error.status === 409 && error.data?.cloud) {
        conflict(id, owner, error.data.cloud, pending);
        if (pending.recoveryOverride)
          throw new Error(
            'The cloud save changed again. Review it before confirming another overwrite.',
          );
      } else if (error.status === 404 && current(owner))
        storage.mutate(id, owner, (r) => {
          if (r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
          r.meta.missing = true;
        });
      else throw error;
    }
  }
  async function syncTown(id, owner, pull) {
    let local = entry(id, owner);
    if (!local || local.meta.missing || !current(owner) || !eligible(id, owner)) return;
    if (local.meta.pending)
      return upload(id, owner, local.meta.pending, local.meta.pending.resolve);
    if (local.meta.conflict && !canApply(id)) return;
    if (!local.meta.conflict && !pull && !local.meta.dirty) return;
    let remote;
    try {
      remote = await request(`towns/${id}`);
    } catch (error) {
      if (error.status === 404) {
        if (current(owner))
          storage.mutate(id, owner, (r) => {
            r.meta.missing = true;
          });
        return;
      }
      throw error;
    }
    if (!current(owner)) return;
    local = entry(id, owner);
    if (!local || !eligible(id, owner)) return;
    // A separate worker may have staged a durable retry while the GET waited.
    if (local.meta.pending)
      return upload(id, owner, local.meta.pending, local.meta.pending.resolve);
    if (remote.townId !== id) throw new Error('The server returned a different town.');
    if (remote.revision < Math.max(local.meta.baseRevision, local.meta.conflict?.revision ?? 0))
      throw new Error('The cloud reply is older than this device. Your local save has been kept.');
    if (local.meta.conflict || remote.revision !== local.meta.baseRevision) {
      if (local.meta.dirty || local.meta.conflict) conflict(id, owner, remote);
      else accept(id, owner, remote, local.meta.sequence, true);
    } else if (local.meta.dirty) {
      const pending = {
        sequence: local.meta.sequence,
        body: {
          baseRevision: local.meta.baseRevision,
          profile: local.profile,
          uploadId: crypto.randomUUID(),
        },
      };
      storage.mutate(id, owner, (r) => {
        r.meta.pending = pending;
      });
      await upload(id, owner, pending);
    }
  }
  return {
    sync({ pull = true } = {}) {
      if (running) return running;
      const owner = account()?.id;
      if (!owner) return Promise.resolve();
      running = (async () => {
        for (const r of targets(owner)) {
          if (!current(owner)) break;
          if (eligible(r.meta.id, owner))
            await run(r.meta.id, owner, () => syncTown(r.meta.id, owner, pull));
        }
      })().finally(() => {
        running = null;
      });
      return running;
    },
    reviewRecovery(id) {
      const owner = account()?.id;
      return run(id, owner, async () => {
        if (!current(owner) || !eligible(id, owner)) throw new Error('Review this town again.');
        if (!canApply(id)) throw new Error('Return to the village to review your preserved save.');
        await syncTown(id, owner, true);
        const local = entry(id, owner);
        if (!current(owner) || !eligible(id, owner) || !canApply(id))
          throw new Error('Return to the village to review your preserved save.');
        if (
          !local?.meta.recovery?.id ||
          local.meta.pending ||
          local.meta.conflict ||
          local.meta.dirty
        )
          throw new Error('Sync this town before reviewing the preserved save.');
        return copy({
          townId: id,
          owner,
          revision: local.meta.baseRevision,
          sequence: local.meta.sequence,
          recovery: local.meta.recovery,
          cloud: { profile: local.profile, updatedAt: local.meta.cloudAt },
        });
      });
    },
    overwriteRecovery(id, review) {
      const owner = account()?.id;
      return run(id, owner, async () => {
        const local = entry(id, owner);
        if (
          !current(owner) ||
          !eligible(id, owner) ||
          review?.owner !== owner ||
          review?.townId !== id
        )
          throw new Error('Review this town again.');
        if (!canApply(id)) throw new Error('Return to the village to review your preserved save.');
        if (
          !local?.meta.recovery ||
          local.meta.recovery.id !== review.recovery.id ||
          local.meta.sequence !== review.sequence ||
          local.meta.baseRevision !== review.revision ||
          local.meta.pending ||
          local.meta.conflict
        )
          throw new Error('Your save changed. Review it before confirming another overwrite.');
        const pending = {
          resolve: true,
          replace: true,
          recoveryOverride: local.meta.recovery.id,
          sequence: local.meta.sequence,
          body: {
            baseRevision: review.revision,
            profile: copy(local.meta.recovery.profile),
            uploadId: crypto.randomUUID(),
          },
        };
        storage.mutate(id, owner, (r) => {
          r.meta.pending = pending;
        });
        await upload(id, owner, pending, true);
      });
    },
    restore(id, profile) {
      const owner = account()?.id;
      return run(id, owner, async () => {
        const local = entry(id, owner);
        if (!current(owner) || !eligible(id, owner) || !local || !canApply(id))
          throw new Error('Leave the mine before restoring a save.');
        if (local.meta.dirty || local.meta.pending || local.meta.conflict)
          throw new Error(
            'Sync or resolve your current progress before restoring a previous save.',
          );
        const pending = {
          resolve: true,
          replace: true,
          sequence: local.meta.sequence,
          body: { baseRevision: local.meta.baseRevision, profile, uploadId: crypto.randomUUID() },
        };
        storage.mutate(id, owner, (r) => {
          r.meta.pending = pending;
        });
        await upload(id, owner, pending, true);
      });
    },
  };
}
