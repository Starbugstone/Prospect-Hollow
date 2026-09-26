// Synchronization copies snapshots; it never authorizes or executes gameplay actions.
export function createSyncService({
  storage,
  request,
  account,
  canApply = () => true,
  applied = () => {},
}) {
  let running;
  const current = (owner) => account()?.id === owner;
  const entry = (id, owner) => storage.records(owner).find((r) => r.meta.id === id);
  function accept(id, owner, result, sequence, downloaded = false) {
    if (!current(owner)) return;
    let replaced = false;
    storage.mutate(id, owner, (r) => {
      if (result.revision < r.meta.baseRevision) return false;
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
  function conflict(id, owner, cloud) {
    if (current(owner))
      storage.mutate(id, owner, (r) => {
        r.meta.conflict = cloud;
        r.meta.pending = null;
      });
  }
  async function upload(id, owner, pending, resolve = false) {
    try {
      const result = await request(`towns/${id}${resolve ? '/resolve' : ''}`, pending.body, 'PUT');
      accept(id, owner, result, pending.sequence);
    } catch (error) {
      if (error.status === 409 && error.data?.cloud) conflict(id, owner, error.data.cloud);
      else throw error;
    }
  }
  async function syncTown(id, owner) {
    let local = entry(id, owner);
    if (!local || local.meta.missing || !current(owner)) return;
    if (local.meta.pending)
      return upload(id, owner, local.meta.pending, local.meta.pending.resolve);
    if (local.meta.conflict) return;
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
    if (!local) return;
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
    sync() {
      if (running) return running;
      const owner = account()?.id;
      if (!owner) return Promise.resolve();
      running = (async () => {
        for (const r of storage.records(owner)) {
          if (!current(owner)) break;
          await syncTown(r.meta.id, owner);
        }
      })().finally(() => {
        running = null;
      });
      return running;
    },
    async resolve(id, choice) {
      const owner = account()?.id,
        local = entry(id, owner);
      if (!local?.meta.conflict || !current(owner)) throw new Error('Review this town again.');
      if (!canApply(id)) throw new Error('Leave the mine before resolving a save conflict.');
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
    },
  };
}
