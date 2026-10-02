import { recoveryStore } from './recoveryStore';
import { acknowledgeIntegrity, prepareIntegritySnapshot } from './saveIntegrity';
import { jsonCopy } from './jsonCopy';
const queues = new WeakMap();
const CHANGED_SINCE_REVIEW = 'Your save changed. Review it before confirming another overwrite.';
const LEAVE_MINE_TO_REVIEW = 'Return to the village to review your preserved save.';
const WRONG_TOWN = 'The server returned a different town.';
// A rejected upload waits for new progress, except a format the server will never accept.
export const uploadBlocked = (meta) =>
  !!meta?.uploadError &&
  (['save_format_unsupported', 'save_rules_unsupported', 'save_integrity_unsupported'].includes(
    meta.uploadError.code,
  ) ||
    meta.uploadError.sequence === meta.sequence);
// Recovery copies used to live inline in the town record; they move to the recovery store.
export const legacyRecovery = (recovery, owner, townId) => ({
  ...recovery,
  owner,
  townId,
  createdAt: recovery.updatedAt ?? 0,
});
// Server-owned town details that every accepted reply refreshes.
const cloudMeta = (result) => ({
  baseRevision: result.revision,
  cloudAt: result.updatedAt,
  name: result.name,
  publicId: result.publicId,
  isPublic: result.isPublic,
});
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
// Gameplay remains local; the server checks resource receipts with each snapshot.
export function createSyncService({
  storage,
  recoveries = recoveryStore,
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
  // A failed browser backup pauses uploads for this sequence and is reported to the player.
  const backupFailed = (townId, owner, error) => {
    if (current(owner))
      storage.mutate(townId, owner, (r) => {
        r.meta.uploadError = {
          message: error.message,
          code: 'local_backup_failed',
          sequence: r.meta.sequence,
        };
      });
  };
  const entry = (id, owner) =>
    storage.get?.(id, owner) ?? storage.records(owner).find((r) => r.meta.id === id);
  async function preserve(record, reason) {
    const owner = record.meta.owner,
      townId = record.meta.id;
    // Upgrade the old inline backup before anything can replace its pointer.
    if (record.meta.recovery?.profile)
      await recoveries.put(legacyRecovery(record.meta.recovery, owner, townId));
    if (!current(owner)) throw new Error('The account changed while preserving this save.');
    const saved = {
      ...recoveryCopy(record, reason),
      owner,
      townId,
      createdAt: Math.max(Date.now(), (record.meta.recovery?.createdAt ?? 0) + 1),
    };
    try {
      await recoveries.put(saved);
    } catch (error) {
      backupFailed(townId, owner, error);
      throw error;
    }
    const { profile, ...descriptor } = saved;
    return descriptor;
  }
  async function accept(
    id,
    owner,
    result,
    sequence,
    downloaded = false,
    pending = null,
    submittedIntegrity = null,
  ) {
    if (!current(owner)) return;
    if (result.townId !== id) throw new Error(WRONG_TOWN);
    const ack = result.integrity;
    if (ack && pending) {
      const submittedSequence =
        submittedIntegrity?.actions?.at(-1)?.sequence ?? submittedIntegrity?.baseSequence;
      if (
        ack.version !== 1 ||
        ack.epoch !== submittedIntegrity?.epoch ||
        !Number.isSafeInteger(ack.ackSequence) ||
        ack.ackSequence < submittedIntegrity?.baseSequence ||
        ack.ackSequence > submittedSequence
      )
        throw new Error(
          'The server returned an invalid save receipt. Your local progress is kept.',
        );
    }
    let replaced = false,
      recovery;
    const before = entry(id, owner);
    if (pending?.replace && before?.meta.sequence === sequence && canApply(id))
      recovery = await preserve(before, 'replacement');
    if (!current(owner)) return;
    storage.mutate(id, owner, (r) => {
      if (result.revision < r.meta.baseRevision) return false;
      if (pending && r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
      if (pending?.replace) {
        if (r.meta.sequence !== sequence || !canApply(id)) {
          const { profile, ...summary } = result;
          r.meta.conflict = summary;
          r.meta.pending = null;
          return;
        }
        r.meta.recovery = recovery;
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
      if (ack && !replaced && r.profile.integrity)
        r.profile.integrity = acknowledgeIntegrity(r.profile.integrity, ack);
      if (replaced || (pending?.restoreIntent && pending.restoreIntent === r.meta.restoreIntent))
        delete r.meta.restoreIntent;
      r.meta = {
        ...r.meta,
        ...cloudMeta(result),
        dirty: r.meta.sequence !== sequence,
        pending: null,
        conflict: null,
        missing: false,
        uploadError: null,
      };
    });
    if (replaced) applied(id);
  }
  async function conflict(id, owner, cloud, pending = null) {
    if (cloud.townId !== id) throw new Error(WRONG_TOWN);
    let replaced = false,
      recovery;
    const before = entry(id, owner);
    if (current(owner) && before?.meta.dirty && eligible(id, owner) && canApply(id))
      recovery = await preserve(before, 'desync');
    if (current(owner))
      storage.mutate(id, owner, (r) => {
        if (cloud.revision < Math.max(r.meta.baseRevision, r.meta.conflict?.revision ?? 0))
          return false;
        if (pending && r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
        const { profile, ...summary } = cloud;
        r.meta.conflict = summary;
        r.meta.pending = null;
        // A running mine stays entirely local. Its final village changes join the
        // recovery copy when we can safely apply the server save on return.
        if (!eligible(id, owner) || !canApply(id) || r.meta.sequence !== before.meta.sequence)
          return;
        if (r.meta.dirty) r.meta.recovery = recovery;
        r.profile = cloud.profile;
        delete r.meta.restoreIntent;
        r.meta = {
          ...r.meta,
          ...cloudMeta(cloud),
          dirty: false,
          conflict: null,
          sequence: r.meta.sequence + 1,
          desyncNotice: r.meta.recovery?.reason === 'desync',
        };
        replaced = true;
      });
    if (replaced) applied(id);
  }
  async function stage(id, owner, pending) {
    pending = {
      ...pending,
      body: { ...pending.body, profile: prepareIntegritySnapshot(pending.body.profile) },
    };
    try {
      await recoveries.putUpload({
        id: pending.body.uploadId,
        owner,
        townId: id,
        profile: pending.body.profile,
      });
    } catch (error) {
      backupFailed(id, owner, error);
      throw error;
    }
    if (!current(owner) || !eligible(id, owner)) return null;
    if (
      pending.replace &&
      (!canApply(id) || entry(id, owner)?.meta.sequence !== pending.sequence)
    ) {
      await recoveries.removeUpload(pending.body.uploadId, owner, id);
      throw new Error(CHANGED_SINCE_REVIEW);
    }
    const { profile, ...body } = pending.body;
    const durable = { ...pending, body, snapshot: true };
    const saved = storage.mutate(id, owner, (r) => {
      if (r.meta.pending) return false;
      r.meta.pending = durable;
    });
    return saved ? durable : null;
  }
  async function upload(id, owner, pending, resolve = false) {
    if (!pending) return;
    try {
      let body = pending.body;
      if (pending.snapshot) {
        const snapshot = await recoveries.getUpload(body.uploadId, owner, id);
        if (!current(owner) || entry(id, owner)?.meta.pending?.body.uploadId !== body.uploadId)
          return;
        if (!snapshot) {
          storage.mutate(id, owner, (r) => {
            r.meta.pending = null;
            r.meta.dirty = true;
            r.meta.uploadError = {
              message:
                'The pending upload is unavailable. Your current town is kept; retry cloud saving to check the server.',
              sequence: r.meta.sequence,
            };
          });
          return;
        }
        body = { ...body, profile: snapshot.profile };
      }
      const result = await request(`towns/${id}${resolve ? '/resolve' : ''}`, body, 'PUT');
      await accept(id, owner, result, pending.sequence, false, pending, body.profile?.integrity);
    } catch (error) {
      if (error.status === 409 && error.data?.cloud) {
        await conflict(id, owner, error.data.cloud, pending);
        if (pending.recoveryOverride)
          throw new Error(
            'The cloud save changed again. Review it before confirming another overwrite.',
            { cause: error },
          );
      } else if (error.status === 404 && current(owner))
        storage.mutate(id, owner, (r) => {
          if (r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
          r.meta.missing = true;
        });
      else {
        if ([413, 422].includes(error.status) && current(owner))
          storage.mutate(id, owner, (r) => {
            if (r.meta.pending?.body.uploadId !== pending.body.uploadId) return false;
            r.meta.pending = null;
            r.meta.uploadError = {
              message: error.message,
              status: error.status,
              code: error.data?.code,
              sequence: pending.sequence,
            };
          });
        throw error;
      }
    } finally {
      if (
        pending.snapshot &&
        current(owner) &&
        entry(id, owner)?.meta.pending?.body.uploadId !== pending.body.uploadId
      )
        await recoveries.removeUpload(pending.body.uploadId, owner, id).catch(() => {});
    }
  }
  async function syncTown(id, owner, pull) {
    let local = entry(id, owner);
    if (!local || local.meta.missing || !current(owner) || !eligible(id, owner)) return;
    if (uploadBlocked(local.meta)) return;
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
    if (remote.townId !== id) throw new Error(WRONG_TOWN);
    if (remote.revision < Math.max(local.meta.baseRevision, local.meta.conflict?.revision ?? 0))
      throw new Error('The cloud reply is older than this device. Your local save has been kept.');
    if (
      remote.name !== local.meta.name ||
      remote.isPublic !== local.meta.isPublic ||
      remote.publicId !== local.meta.publicId
    )
      storage.mutate(id, owner, (r) => {
        r.meta.name = remote.name;
        r.meta.isPublic = remote.isPublic;
        r.meta.publicId = remote.publicId;
      });
    if (local.meta.conflict || remote.revision !== local.meta.baseRevision) {
      if (local.meta.dirty || local.meta.conflict) await conflict(id, owner, remote);
      else await accept(id, owner, remote, local.meta.sequence, true);
    } else if (local.meta.dirty) {
      const pending = {
        resolve: !!local.meta.restoreIntent,
        restoreIntent: local.meta.restoreIntent ?? null,
        sequence: local.meta.sequence,
        body: {
          baseRevision: local.meta.baseRevision,
          profile: local.profile,
          uploadId: crypto.randomUUID(),
        },
      };
      await upload(id, owner, await stage(id, owner, pending), pending.resolve);
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
    reviewRecovery(id, recoveryId) {
      const owner = account()?.id;
      return run(id, owner, async () => {
        if (!current(owner) || !eligible(id, owner)) throw new Error('Review this town again.');
        if (!canApply(id)) throw new Error(LEAVE_MINE_TO_REVIEW);
        await syncTown(id, owner, true);
        const local = entry(id, owner);
        if (!current(owner) || !eligible(id, owner) || !canApply(id))
          throw new Error(LEAVE_MINE_TO_REVIEW);
        if (
          !local?.meta.recovery?.id ||
          local.meta.pending ||
          local.meta.conflict ||
          local.meta.dirty
        )
          throw new Error('Sync this town before reviewing the preserved save.');
        const recovery =
          local.meta.recovery?.profile && (!recoveryId || recoveryId === local.meta.recovery.id)
            ? local.meta.recovery
            : await recoveries.get(recoveryId ?? local.meta.recovery.id, owner, id);
        if (!recovery) throw new Error('This preserved save is unavailable.');
        return jsonCopy({
          townId: id,
          owner,
          revision: local.meta.baseRevision,
          sequence: local.meta.sequence,
          recovery,
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
        if (!canApply(id)) throw new Error(LEAVE_MINE_TO_REVIEW);
        if (
          !local?.meta.recovery ||
          local.meta.sequence !== review.sequence ||
          local.meta.baseRevision !== review.revision ||
          local.meta.pending ||
          local.meta.conflict
        )
          throw new Error(CHANGED_SINCE_REVIEW);
        const recovery =
          local.meta.recovery?.profile && local.meta.recovery.id === review.recovery.id
            ? local.meta.recovery
            : await recoveries.get(review.recovery.id, owner, id);
        if (
          !recovery ||
          entry(id, owner)?.meta.sequence !== review.sequence ||
          !current(owner) ||
          !canApply(id)
        )
          throw new Error(CHANGED_SINCE_REVIEW);
        const pending = {
          resolve: true,
          replace: true,
          recoveryOverride: recovery.id,
          sequence: local.meta.sequence,
          body: {
            baseRevision: review.revision,
            profile: jsonCopy(recovery.profile),
            uploadId: crypto.randomUUID(),
          },
        };
        await upload(id, owner, await stage(id, owner, pending), true);
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
        await upload(id, owner, await stage(id, owner, pending), true);
      });
    },
  };
}
