// Presence is short-lived server state, completely separate from playable town saves.
export const VISITOR_HEARTBEAT_MS = 12_000;
export const VISITOR_POLL_MS = 3_000;
export const VISITOR_AWAY_MS = 15_000;

function visitorToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function visitorBrowserToken(storage) {
  const key = 'prospect-hollow-visitor-browser';
  try {
    storage ??= globalThis.localStorage;
    const saved = storage?.getItem(key);
    if (/^[a-f0-9]{64}$/.test(saved ?? '')) return saved;
    const token = visitorToken();
    storage?.setItem(key, token);
    return token;
  } catch {
    return visitorToken();
  }
}

// Sequence numbers fence a late heartbeat after departure. A new stay gets a new
// token; the server deduplicates simultaneous tabs using account/browser identity.
export function createVisitorPresence({
  send,
  leave,
  changed = () => {},
  failed = () => {},
  token = visitorToken,
  hidden = () => document.hidden,
  interval = VISITOR_HEARTBEAT_MS,
  away = VISITOR_AWAY_MS,
}) {
  let current,
    timer,
    awayTimer,
    stopped = false;
  function depart() {
    clearTimeout(timer);
    clearTimeout(awayTimer);
    awayTimer = null;
    const visit = current;
    current = null;
    if (visit) {
      changed(false);
      return Promise.resolve(leave({ token: visit.token, sequence: ++visit.sequence })).catch(
        () => {},
      );
    }
  }
  async function beat(visit) {
    if (stopped || current !== visit || visit.busy || hidden()) return;
    visit.busy = true;
    try {
      const result = await send({ token: visit.token, sequence: ++visit.sequence });
      if (stopped || current !== visit) return;
      visit.failures = 0;
      changed(result.active !== false);
    } catch (error) {
      if (stopped || current !== visit) return;
      visit.failures++;
      changed(false);
      failed(error);
      if ([401, 403, 404, 422].includes(error.status)) {
        depart();
        return;
      }
    } finally {
      visit.busy = false;
      if (!stopped && current === visit && !hidden()) {
        clearTimeout(timer);
        timer = setTimeout(() => beat(visit), interval * Math.min(4, 2 ** visit.failures));
      }
    }
  }
  function resume() {
    if (stopped) return;
    if (hidden()) {
      clearTimeout(timer);
      if (current && !awayTimer)
        awayTimer = setTimeout(() => {
          awayTimer = null;
          depart();
        }, away);
      return;
    }
    clearTimeout(awayTimer);
    awayTimer = null;
    clearTimeout(timer);
    current ??= { token: token(), sequence: 0, failures: 0, busy: false };
    beat(current);
  }
  return {
    start: resume,
    resume,
    suspend: depart,
    stop() {
      stopped = true;
      return depart();
    },
  };
}

// Poll only the visible owner's village. Replies from a closed/switched town are
// ignored; failures back off and never touch the campaign or its save status.
export function createOwnerVisitorPoller({
  load,
  apply,
  failed = () => {},
  hidden = () => document.hidden,
  interval = VISITOR_POLL_MS,
}) {
  let stopped = false,
    busy = false,
    failures = 0,
    timer;
  async function poll() {
    if (stopped || busy || hidden()) return;
    busy = true;
    try {
      const result = await load();
      if (!stopped) {
        failures = 0;
        apply(result);
      }
    } catch (error) {
      if (!stopped) {
        failures++;
        failed(error);
      }
    } finally {
      busy = false;
      if (!stopped && !hidden()) timer = setTimeout(poll, interval * Math.min(16, 2 ** failures));
    }
  }
  return {
    start: poll,
    resume() {
      clearTimeout(timer);
      if (!failures) poll();
      else if (!stopped && !hidden() && !busy)
        timer = setTimeout(poll, interval * Math.min(16, 2 ** failures));
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
