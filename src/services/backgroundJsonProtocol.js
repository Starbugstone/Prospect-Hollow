// Save receipts dominate large offline profiles. Transfer them in bounded batches:
// one postMessage of the entire graph would itself block the browser while cloning.
export const RECEIPTS_PER_MESSAGE = 8;
export const JOURNAL_CACHE_SIZE = 2;
export function splitJournal(value) {
  const profile = value?.profile ?? value;
  if (!Array.isArray(profile?.integrity?.actions)) return { value, actions: null };
  const actions = profile.integrity.actions;
  const small = { ...profile, integrity: { ...profile.integrity, actions: [] } };
  return { value: value?.profile ? { ...value, profile: small } : small, actions };
}
export function appendJournal(value, actions) {
  const profile = value?.profile ?? value;
  profile.integrity.actions.push(...actions);
}

// The same handler is exercised by the worker regression tests.
export function createJsonWorkerHandler(send, operations = {}) {
  const pending = new Map(),
    journals = new Map();
  const reply = (id, value) => {
    const result = splitJournal(value);
    const token = result.actions ? id : null;
    if (token !== null) {
      journals.set(token, result.actions);
      if (journals.size > JOURNAL_CACHE_SIZE) journals.delete(journals.keys().next().value);
    }
    send({ id, type: 'start', value: result.value, token });
    if (result.actions)
      for (let i = 0; i < result.actions.length; i += RECEIPTS_PER_MESSAGE)
        send({ id, type: 'actions', value: result.actions.slice(i, i + RECEIPTS_PER_MESSAGE) });
    send({ id, type: 'done' });
  };
  return async ({ id, type, value, journal }) => {
    try {
      if (type === 'parse') {
        reply(id, JSON.parse(value));
      } else if (type === 'cancel') pending.delete(id);
      else if (type === 'start') {
        if (journal !== undefined) {
          const actions = journals.get(journal);
          if (!actions)
            throw Object.assign(new Error('Journal reference expired.'), {
              code: 'journal_reference_missing',
            });
          appendJournal(value, actions);
        }
        pending.set(id, value);
      } else if (type === 'actions') appendJournal(pending.get(id), value);
      else if (type === 'stringify') {
        if (!pending.has(id)) return;
        const result = JSON.stringify(pending.get(id));
        pending.delete(id);
        send({ id, type: 'done', value: result });
      } else if (operations[type]) {
        if (!pending.has(id)) return;
        const input = pending.get(id);
        pending.delete(id);
        reply(id, await operations[type](input));
      }
    } catch (error) {
      pending.delete(id);
      send({ id, type: 'error', name: error.name, message: error.message, code: error.code });
    }
  };
}
