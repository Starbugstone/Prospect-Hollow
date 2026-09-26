export class BoardReadiness {
  constructor() {
    this.generation = 0;
    this.binding = null;
    this.waiters = new Set();
  }
  publish(sessionVersion, animator) {
    this.binding = { sessionVersion, rendererGeneration: this.generation, animator };
    this.flush();
    return this.binding;
  }
  invalidate() {
    this.generation++;
    this.binding = null;
  }
  cancel() {
    this.invalidate();
    for (const waiter of this.waiters) waiter.resolve(null);
    this.waiters.clear();
  }
  current(binding, session) {
    return !!binding && binding === this.binding && binding.sessionVersion === session;
  }
  wait(session) {
    if (this.binding?.sessionVersion === session) return Promise.resolve(this.binding);
    return new Promise((resolve) => this.waiters.add({ session, resolve }));
  }
  flush() {
    for (const waiter of this.waiters)
      if (this.binding?.sessionVersion === waiter.session) {
        this.waiters.delete(waiter);
        waiter.resolve(this.binding);
      }
  }
}
