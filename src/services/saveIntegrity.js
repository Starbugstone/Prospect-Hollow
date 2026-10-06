// This is a durable command outbox, not a client-side proof of honest play. The
// server anchors its sequence against the last accepted save and checks the rules.
import { markRaw, toRaw } from 'vue';
import { jsonCopy } from './jsonCopy';
// Replacing a journal is reactive, but historical receipts never change. Keeping
// their tree raw avoids proxying every old command during existing local saves.
const plain = (value) => (value && typeof value === 'object' ? markRaw(toRaw(value)) : value);
const sequence = (value) => Number.isSafeInteger(value) && value >= 0;
const journal = (value) =>
  value?.version === 1 &&
  typeof value.epoch === 'string' &&
  sequence(value.baseSequence) &&
  Array.isArray(value.actions) &&
  sequence(value.baseSequence + value.actions.length) &&
  (!value.actions.length ||
    (value.actions[0]?.sequence === value.baseSequence + 1 &&
      value.actions.at(-1)?.sequence === value.baseSequence + value.actions.length));

// Compatibility checks stay constant-time on the client. Full command structure,
// intermediate sequences and rule validation belong to the background server.

export const createIntegrity = () =>
  plain({
    version: 1,
    epoch: crypto.randomUUID(),
    clientAt: Date.now(),
    baseSequence: 0,
    actions: [],
  });

// A missing journal is a pre-integrity save. A present damaged or newer journal
// stays in the backup so cloud review can preserve it instead of inventing trust.
export const loadIntegrity = (saved) =>
  saved === undefined ? createIntegrity() : plain(jsonCopy(toRaw(saved)));

export function appendIntegrityAction(integrity, kind, data) {
  integrity = plain(integrity);
  if (!journal(integrity)) return integrity;
  const next = integrity.baseSequence + integrity.actions.length + 1;
  if (!Number.isSafeInteger(next)) return integrity;
  return plain({
    ...integrity,
    actions: [
      ...integrity.actions,
      { sequence: next, id: crypto.randomUUID(), kind, data: jsonCopy(data) },
    ],
  });
}

export function acknowledgeIntegrity(integrity, ack) {
  integrity = plain(integrity);
  if (
    !journal(integrity) ||
    ack?.version !== 1 ||
    ack.epoch !== integrity.epoch ||
    !sequence(ack.ackSequence) ||
    ack.ackSequence < integrity.baseSequence ||
    ack.ackSequence > integrity.baseSequence + integrity.actions.length
  )
    return integrity;
  const checkpoint = typeof ack.checkpoint === 'string' ? ack.checkpoint : integrity.checkpoint;
  if (ack.ackSequence === integrity.baseSequence && checkpoint === integrity.checkpoint)
    return integrity;
  return plain({
    ...integrity,
    baseSequence: ack.ackSequence,
    actions: integrity.actions.slice(ack.ackSequence - integrity.baseSequence),
    ...(checkpoint === undefined ? {} : { checkpoint }),
  });
}

// Sync can acknowledge a prefix while gameplay continues in memory. Importing
// just that checkpoint avoids bringing acknowledged commands back on the next save.
export function mergeIntegrity(integrity, persisted) {
  integrity = plain(integrity);
  if (!journal(persisted) || persisted.epoch !== integrity?.epoch) return integrity;
  return acknowledgeIntegrity(integrity, {
    version: 1,
    epoch: persisted.epoch,
    ackSequence: persisted.baseSequence,
    checkpoint: persisted.checkpoint,
  });
}

// Nothing acknowledges a guest town's receipts, and enrolment accepts its history as
// an unverified baseline that only reads the receipts of a run still in progress.
// Past this limit the journal keeps just those, so the save stays bounded. A journal
// the server has sealed (it has a checkpoint) keeps every receipt for a restore.
export const GUEST_JOURNAL_LIMIT = 200;
export function compactGuestIntegrity(integrity, profile) {
  integrity = plain(integrity);
  if (
    !journal(integrity) ||
    integrity.checkpoint !== undefined ||
    integrity.actions.length <= GUEST_JOURNAL_LIMIT
  )
    return integrity;
  const run = profile?.issuedRun > profile?.settledRun ? profile.issuedRun : null;
  const start =
    run === null
      ? -1
      : integrity.actions.findLastIndex((a) => a.kind === 'run-start' && a.data?.runId === run);
  const dropped = start < 0 ? integrity.actions.length : start;
  if (!dropped) return integrity;
  return plain({
    ...integrity,
    baseSequence: integrity.baseSequence + dropped,
    actions: integrity.actions.slice(dropped),
  });
}

// Stamp the upload envelope once, when it enters the existing durable retry queue.
// The first server baseline uses this to allow for a device clock ahead of the server.
export function prepareIntegritySnapshot(profile, now = Date.now()) {
  if (!journal(profile?.integrity)) return profile;
  return { ...profile, integrity: plain({ ...toRaw(profile.integrity), clientAt: now }) };
}
