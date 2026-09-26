// Messages request a cooperative transfer; the Web Lock remains the authority.
// No heartbeats, expiring ownership leases, or forced lock stealing.
export function createTownHandoff({
  coordinator,
  prepare,
  channel = new BroadcastChannel('prospect-town-handoff-v1'),
  locks = navigator.locks,
  timeout = 20000,
  now = Date.now,
}) {
  let incoming = false,
    outgoing,
    disposed = false;
  const post = (message) => {
    if (!disposed) channel.postMessage(message);
  };
  const expired = () =>
    new Error(
      'The other window did not respond. Bring it to the front or close it, then try again.',
    );
  async function receive({ data }) {
    if (data?.type === 'cancel' && incoming?.id === data.id && incoming.key === data.key) {
      incoming.cancelled = true;
      return;
    }
    if (data?.type === 'failed' && outgoing?.id === data.id && outgoing.key === data.key) {
      outgoing.controller.abort(new Error(data.message));
      return;
    }
    if (
      disposed ||
      data?.type !== 'request' ||
      typeof data.key !== 'string' ||
      typeof data.id !== 'string' ||
      !Number.isFinite(data.until) ||
      incoming ||
      !coordinator.owns(data.key) ||
      data.until <= now() ||
      data.until > now() + timeout
    )
      return;
    const request = { id: data.id, key: data.key, cancelled: false };
    incoming = request;
    try {
      await prepare(data.key, () => {
        if (disposed || request.cancelled) throw new Error('Town transfer cancelled.');
        if (data.until <= now()) throw expired();
      });
      await coordinator.release();
    } catch (error) {
      post({ type: 'failed', id: data.id, key: data.key, message: error.message });
    } finally {
      incoming = false;
    }
  }
  channel.addEventListener('message', receive);
  return {
    async openHere(key) {
      if (disposed) throw new Error('Town transfer cancelled.');
      if (outgoing) throw new Error('A town transfer is already in progress.');
      return locks.request(`prospect-handoff:${key}`, { ifAvailable: true }, async (lock) => {
        if (!lock)
          throw new Error('Another window is already transferring this town. Try again shortly.');
        if (await coordinator.acquire(key)) return true;
        if (disposed) {
          await coordinator.release();
          throw new Error('Town transfer cancelled.');
        }
        const controller = new AbortController();
        outgoing = { id: crypto.randomUUID(), key, controller };
        const timer = setTimeout(() => controller.abort(expired()), timeout);
        // Queue before notifying the owner, so a third tab cannot jump the transfer.
        const acquired = coordinator.acquire(key, { signal: controller.signal });
        try {
          post({ type: 'request', id: outgoing.id, key, until: now() + timeout });
          return await acquired;
        } catch (error) {
          post({ type: 'cancel', id: outgoing.id, key });
          controller.abort(error);
          await acquired.catch(() => {});
          throw error;
        } finally {
          clearTimeout(timer);
          outgoing = undefined;
        }
      });
    },
    cancel() {
      if (outgoing) post({ type: 'cancel', id: outgoing.id, key: outgoing.key });
      outgoing?.controller.abort(new Error('Town transfer cancelled.'));
    },
    dispose() {
      this.cancel();
      disposed = true;
      channel.removeEventListener('message', receive);
      channel.close();
    },
  };
}
