import {
  appendJournal,
  RECEIPTS_PER_MESSAGE,
  JOURNAL_CACHE_SIZE,
  splitJournal,
} from './backgroundJsonProtocol';

// A real task boundary, including on WebViews without scheduler.yield().
export const yieldToBrowser = () =>
  globalThis.scheduler?.yield?.() ?? new Promise((resolve) => setTimeout(resolve, 0));

export function createBackgroundJson(
  makeWorker = () =>
    new Worker(new URL('./backgroundJson.worker.js', import.meta.url), { type: 'module' }),
) {
  let worker,
    unavailable = false,
    serial = 0;
  const pending = new Map(),
    journalTokens = new WeakMap(),
    availableTokens = new Set();
  // Returned receipt trees are immutable, so cached worker references cannot
  // silently miss a caller changing an existing command in place.
  const freezeReceipt = (value) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const item of Object.values(value)) freezeReceipt(item);
      Object.freeze(value);
    }
    return value;
  };
  function open() {
    if (unavailable) return null;
    if (worker) return worker;
    try {
      worker = makeWorker();
      worker.onmessage = ({ data }) => {
        const task = pending.get(data.id);
        if (!task) return;
        if (data.type === 'start') {
          task.value = data.value;
          task.token = data.token;
          if (data.token !== null && data.token !== undefined) {
            availableTokens.add(data.token);
            if (availableTokens.size > JOURNAL_CACHE_SIZE)
              availableTokens.delete(availableTokens.values().next().value);
          }
        } else if (data.type === 'actions')
          appendJournal(task.value, data.value.map(freezeReceipt));
        else {
          pending.delete(data.id);
          if (data.type === 'error') {
            const error = new Error(data.message);
            error.name = data.name;
            error.code = data.code;
            error.workerJobError = true;
            task.reject(error);
          } else {
            if (task.token !== null && task.token !== undefined) {
              const actions = splitJournal(task.value).actions;
              Object.freeze(actions);
              journalTokens.set(actions, task.token);
            }
            task.resolve('value' in task ? task.value : data.value);
          }
        }
      };
      worker.onerror = () => {
        unavailable = true;
        worker?.terminate();
        worker = null;
        for (const task of pending.values())
          task.reject(
            new Error('Cloud saving is temporarily unavailable. Your local progress is kept.'),
          );
        pending.clear();
      };
      return worker;
    } catch {
      unavailable = true;
      return null;
    }
  }
  async function perform(type, value, alternative, forceChunks = false) {
    const active = open();
    const fallback =
      alternative ?? (() => (type === 'parse' ? JSON.parse(value) : JSON.stringify(value)));
    if (!active) return fallback();
    const id = ++serial;
    let resolve, reject;
    const result = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    // Install a rejection handler before yielding while batches are transferred.
    result.catch(() => {});
    pending.set(id, { resolve, reject });
    try {
      if (type === 'parse') active.postMessage({ id, type, value });
      else {
        const parts = splitJournal(value);
        const journal =
          parts.actions && !forceChunks ? journalTokens.get(parts.actions) : undefined;
        const cached = journal !== undefined && availableTokens.has(journal);
        active.postMessage({
          id,
          type: 'start',
          value: parts.value,
          ...(cached ? { journal } : {}),
        });
        if (parts.actions && !cached)
          for (let i = 0; i < parts.actions.length; i += RECEIPTS_PER_MESSAGE) {
            active.postMessage({
              id,
              type: 'actions',
              value: parts.actions.slice(i, i + RECEIPTS_PER_MESSAGE),
            });
            await yieldToBrowser();
          }
        active.postMessage({ id, type });
      }
      return await result;
    } catch (error) {
      pending.delete(id);
      try {
        active.postMessage({ id, type: 'cancel' });
      } catch {}
      // JSON syntax errors keep the transport's existing unreadable-response path.
      if (error.code === 'journal_reference_missing')
        return perform(type, value, alternative, true);
      // An in-flight network job may already have reached the server. Let the
      // existing durable outbox/backoff handle an unknown outcome; never replay
      // arbitrary POST/PATCH requests as an automatic main-thread fallback.
      if (type === 'fetchText' || error.workerJobError || error.name === 'SyntaxError') throw error;
      return fallback();
    }
  }
  return {
    parse: (text) => perform('parse', text),
    stringify: (value) => perform('stringify', value),
    run: perform,
  };
}
export const backgroundJson = createBackgroundJson();
