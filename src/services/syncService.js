const queues = new WeakMap();
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
        r.meta.recovery = { profile: r.profile, updatedAt: r.meta.updatedAt };
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
    if (current(owner))
      storage.mutate(id, owner, (r) => {
        if (cloud.revision < r.meta.baseRevision) return false;
        if (pending && r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
        r.meta.conflict = cloud;
        r.meta.pending = null;
      });
  }
  async function upload(id, owner, pending, resolve = false) {
    try {
      const result = await request(`towns/${id}${resolve ? '/resolve' : ''}`, pending.body, 'PUT');
      accept(id, owner, result, pending.sequence, false, pending);
    } catch (error) {
      if (error.status === 409 && error.data?.cloud) conflict(id, owner, error.data.cloud, pending);
      else if (error.status === 404 && current(owner))
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
    if (local.meta.conflict || (!pull && !local.meta.dirty)) return;
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
    if (local.meta.conflict) return;
    if (remote.revision !== local.meta.baseRevision) {
      if (local.meta.dirty) conflict(id, owner, remote);
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
    resolve(id, choice) {
      const owner = account()?.id;
      return run(id, owner, async () => {
        const local = entry(id, owner);
        if (!eligible(id, owner) || !local?.meta.conflict || !current(owner))
          throw new Error('Review this town again.');
        if (!canApply(id)) throw new Error('Leave the mine before resolving a save conflict.');
        if (local.meta.pending) throw new Error('Sync the pending save before resolving again.');
        if (choice === 'local') {
          const pending = {
            resolve: true,
            sequence: local.meta.sequence,
            body: {
              baseRevision: local.meta.conflict.revision,
              profile: local.profile,
              uploadId: crypto.randomUUID(),
            },
          };
          storage.mutate(id, owner, (r) => {
            r.meta.pending = pending;
          });
          await upload(id, owner, pending, true);
        } else {
          const remote = await request(`towns/${id}`);
          if (!current(owner)) return;
          if (remote.revision !== local.meta.conflict.revision) {
            conflict(id, owner, remote);
            throw new Error('The cloud save changed again. Review the updated comparison.');
          }
          let replaced = false;
          storage.mutate(id, owner, (r) => {
            if (!canApply(id)) throw new Error('Leave the mine before resolving a save conflict.');
            if (r.meta.sequence !== local.meta.sequence)
              throw new Error('Local progress changed. Review it again.');
            // Preserve the losing local branch as a downloadable recovery copy.
            r.meta.recovery = { profile: r.profile, updatedAt: r.meta.updatedAt };
            r.profile = remote.profile;
            r.meta = {
              ...r.meta,
              name: remote.name,
              baseRevision: remote.revision,
              cloudAt: remote.updatedAt,
              dirty: false,
              pending: null,
              conflict: null,
              sequence: r.meta.sequence + 1,
            };
            replaced = true;
          });
          if (replaced) applied(id);
        }
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
