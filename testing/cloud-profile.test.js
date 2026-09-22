import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { version as contentVersion } from '../backend/content/game.json';

const stores = vi.hoisted(() => ({ campaign: null, game: null, inventory: null }));
vi.mock('../src/stores/campaignStore', () => ({ useCampaignStore: () => stores.campaign }));
vi.mock('../src/stores/gameStore', () => ({ useGameStore: () => stores.game }));
vi.mock('../src/stores/inventoryStore', () => ({ useInventoryStore: () => stores.inventory }));
vi.mock('../src/i18n', () => ({ locale: { value: 'en' } }));

const prefix = 'prospect-cloud-command:';
let api;
let storage;
let fetchMock;
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function reply(value, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(value) };
}
function profile(playerId = 'account-a', revision = 0, run = null) {
  return {
    playerId,
    revision,
    contentVersion,
    linked: true,
    locale: 'en',
    run,
    profile: { town: { coins: revision }, records: {}, powers: [] },
  };
}
function memoryStorage() {
  const value = {};
  Object.defineProperties(value, {
    getItem: { value: (key) => value[key] ?? null },
    setItem: {
      value: (key, entry) => {
        value[key] = String(entry);
      },
    },
    removeItem: {
      value: (key) => {
        delete value[key];
      },
    },
    clear: {
      value: () => {
        for (const key of Object.keys(value)) delete value[key];
      },
    },
  });
  return value;
}

beforeEach(async () => {
  vi.resetModules();
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('location', { reload: vi.fn() });
  stores.campaign = {
    town: { coins: 0 },
    $patch: vi.fn(function (value) {
      Object.assign(this, value);
    }),
  };
  stores.game = {
    sessionActive: false,
    sessionVersion: 0,
    levelCleared: false,
    exitLevel: vi.fn(() => {
      stores.game.sessionActive = false;
      stores.game.sessionVersion++;
    }),
    $patch: vi.fn(function (value) {
      Object.assign(this, value);
    }),
  };
  stores.inventory = { availableQuantity: () => 0 };
  fetchMock = vi.fn(() => {
    throw new Error('Unexpected request');
  });
  vi.stubGlobal('fetch', fetchMock);
  api = await import('../src/services/cloudProfile');
  api.installCloudAdapters();
  Object.assign(api.cloud, { ready: true, playerId: 'account-a', csrf: 'csrf-a', revision: 0 });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cloud persistence and account boundaries', () => {
  it('persists the exact command before sending it and removes it only after success', async () => {
    storage.setItem('crystal-cascade-profile-v3', 'untouched local village');
    fetchMock.mockImplementation(async (url, options) => {
      expect(url).toBe('/api/v1/actions');
      const body = JSON.parse(options.body);
      expect(JSON.parse(storage.getItem(prefix + body.actionId))).toEqual({
        key: prefix + body.actionId,
        playerId: 'account-a',
        body,
      });
      expect(options.headers['X-Player-Id']).toBe('account-a');
      expect(options.headers['X-Content-Version']).toBe(contentVersion);
      expect(options.credentials).toBe('same-origin');
      return reply(profile('account-a', 1));
    });
    await api.command('preferences', { locale: 'fr' });
    expect(Object.keys(storage).filter((key) => key.startsWith(prefix))).toEqual([]);
    expect(storage.getItem('crystal-cascade-profile-v3')).toBe('untouched local village');
    expect(api.cloud.revision).toBe(1);
  });

  it.each([401, 403])(
    'retains a durable command after HTTP %i so reauthentication can recover it',
    async (status) => {
      fetchMock.mockResolvedValue(reply({ error: 'Sign in again.' }, status));
      await expect(api.command('preferences', { locale: 'fr' })).rejects.toMatchObject({ status });
      const pending = Object.keys(storage).filter((key) => key.startsWith(prefix));
      expect(pending).toHaveLength(1);
      expect(JSON.parse(storage.getItem(pending[0])).body.type).toBe('preferences');
      expect(api.cloud.pending).toBe(true);
      expect(api.cloud.revision).toBe(0);
    },
  );

  it('retries a lost response with the same action ID instead of creating another mutation', async () => {
    let original;
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith('/profile')) return reply(profile('account-a', 1));
      const body = JSON.parse(options.body);
      if (!original) {
        original = body;
        throw new TypeError('Connection dropped after commit');
      }
      expect(body).toEqual(original);
      return reply(profile('account-a', 1));
    });
    await expect(api.command('preferences', { locale: 'fr' })).rejects.toThrow(
      'Connection dropped',
    );
    await api.retryPending();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/actions'))).toHaveLength(2);
    expect(api.cloud.pending).toBe(false);
    expect(api.cloud.revision).toBe(1);
  });

  it('drains two queued actions under their original account before changing identity', async () => {
    const firstResponse = deferred();
    let switched = false;
    let sent = 0;
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith('/profile')) {
        expect(switched).toBe(true);
        return reply(profile('account-b'));
      }
      expect(switched).toBe(false);
      expect(options.headers['X-Player-Id']).toBe('account-a');
      expect(options.headers['X-CSRF-Token']).toBe('csrf-a');
      sent++;
      return sent === 1 ? firstResponse.promise : reply(profile('account-a', 2));
    });
    const first = api.command('preferences', { locale: 'fr' });
    const second = api.command('preferences', { locale: 'en' });
    await vi.waitFor(() => expect(sent).toBe(1));
    const transition = api.changeAccount(async () => {
      switched = true;
      api.cloud.csrf = 'csrf-b';
    });
    expect(switched).toBe(false);
    firstResponse.resolve(reply(profile('account-a', 1)));
    await Promise.all([first, second, transition]);
    expect(sent).toBe(2);
    expect(api.cloud.playerId).toBe('account-b');
    expect(api.cloud.pending).toBe(false);
  });

  it('ignores an older refresh when a newer profile and run have already arrived', async () => {
    const oldResponse = deferred();
    fetchMock
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValueOnce(
        reply(profile('account-a', 2, { runId: 'new-run', status: 'active' })),
      );
    const oldRefresh = api.refresh();
    await api.refresh();
    oldResponse.resolve(reply(profile('account-a', 1, { runId: 'old-run', status: 'active' })));
    await oldRefresh;
    expect(api.cloud.revision).toBe(2);
    expect(stores.campaign.town.coins).toBe(2);
    expect(api.cloud.run.runId).toBe('new-run');
  });

  it('rejects a pre-transition response without restoring the previous account or CSRF token', async () => {
    const oldResponse = deferred();
    fetchMock
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValueOnce(reply({ ...profile('account-b'), csrf: 'csrf-b' }));
    const stale = api.refresh().catch((error) => error);
    await api.changeAccount(async () => {});
    oldResponse.resolve(reply({ ...profile('account-a', 99), csrf: 'csrf-a-old' }));
    expect(await stale).toBeInstanceOf(Error);
    expect(api.cloud.playerId).toBe('account-b');
    expect(api.cloud.csrf).toBe('csrf-b');
    expect(stores.campaign.town.coins).toBe(0);
  });

  it('keeps the destination account when an older tab response arrives after a shared-cookie account change', async () => {
    const oldResponse = deferred();
    const destinationRun = { runId: 'account-b-run', status: 'active' };
    api.cloud.run = { runId: 'account-a-run', status: 'active' };
    stores.game.sessionActive = true;
    stores.game.runId = 'account-a-run';
    fetchMock
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValueOnce(reply({ ...profile('account-b', 2, destinationRun), csrf: 'csrf-b' }));
    const stale = api.refresh().catch((error) => error);
    // Another tab changed the shared session cookie; no local changeAccount call occurs.
    await api.refresh();
    oldResponse.resolve(
      reply({
        ...profile('account-a', 99, { runId: 'old-account-a-run', status: 'active' }),
        csrf: 'csrf-a-old',
      }),
    );
    expect(await stale).toBeInstanceOf(Error);
    expect(api.cloud.playerId).toBe('account-b');
    expect(api.cloud.csrf).toBe('csrf-b');
    expect(api.cloud.revision).toBe(2);
    expect(stores.campaign.town.coins).toBe(2);
    expect(api.cloud.run).toEqual(destinationRun);
    expect(stores.game.sessionVersion).toBe(1);
    expect(stores.game.sessionActive).toBe(false);
  });

  it('ignores malformed pending entries without crashing bootstrap', async () => {
    storage.setItem(prefix + 'broken-json', '{');
    storage.setItem(prefix + 'missing-body', JSON.stringify({ playerId: 'account-a' }));
    storage.setItem(prefix + 'bad-shape', JSON.stringify({ playerId: 'account-a', body: null }));
    fetchMock.mockResolvedValue(reply(profile()));
    await expect(api.bootstrapCloud()).resolves.toBeUndefined();
    expect(api.cloud.ready).toBe(true);
    expect(api.cloud.pending).toBe(false);
    expect(fetchMock.mock.calls.every(([url]) => url.endsWith('/profile'))).toBe(true);
  });

  it('does not let a stored entry replace its actual storage key and masquerade as another pending command', async () => {
    const actionId = 'valid-action-id-123456789';
    storage.setItem(
      prefix + 'wrong-physical-key',
      JSON.stringify({
        key: prefix + actionId,
        playerId: 'account-a',
        body: { actionId, revision: 0, type: 'preferences', args: { locale: 'fr' } },
      }),
    );
    fetchMock.mockImplementation(async (url) => {
      expect(url).toBe('/api/v1/profile');
      return reply(profile());
    });
    await api.bootstrapCloud();
    expect(api.cloud.pending).toBe(false);
    expect(fetchMock.mock.calls.every(([url]) => url.endsWith('/profile'))).toBe(true);
  });

  it('coalesces simultaneous bootstrap calls so late guest cookies cannot race each other', async () => {
    const initialResponse = deferred();
    let calls = 0;
    fetchMock.mockImplementation(async (url) => {
      calls++;
      if (calls === 1) return initialResponse.promise;
      if (url.endsWith('/guests')) return reply({ csrf: 'guest-csrf' });
      return reply(profile('guest-account'));
    });
    api.cloud.ready = false;
    const first = api.bootstrapCloud();
    const second = api.bootstrapCloud();
    initialResponse.resolve(reply({ error: 'No session' }, 401));
    await Promise.all([first, second]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/guests'))).toHaveLength(1);
    expect(api.cloud.playerId).toBe('guest-account');
  });
});

function mine() {
  const board = [
    'ruby',
    'sapphire',
    'ruby',
    'emerald',
    'ruby',
    'emerald',
    'sapphire',
    'emerald',
    'topaz',
  ].map((type, i) => ({ id: `gem-${i}`, type }));
  return {
    runId: 'mine-a',
    status: 'active',
    level: 1,
    mode: 'normal',
    board,
    tiles: board.map(() => ({ type: 'normal', health: 1 })),
    cols: 3,
    rows: 3,
    score: 0,
    moves: 0,
    jewels: 0,
    remainingLayers: 9,
    totalLayers: 9,
    remainingRelics: 0,
    totalRelics: 0,
    maxCascade: 1,
    comboCounts: {},
    multiMatchCounts: {},
    cleared: false,
    startedAt: 1,
    steps: [],
    shuffled: false,
  };
}
function playing() {
  const run = mine();
  Object.assign(stores.game, {
    board: run.board,
    tiles: run.tiles,
    boardCols: 3,
    boardRows: 3,
    sessionActive: true,
    runId: run.runId,
    animationInProgress: false,
    availableLevels: [{ id: 1, config: { boardLayout: {}, objectives: [] } }],
    bootstrap: vi.fn(),
    cancelHint: vi.fn(),
    clearBonusPreview: vi.fn(),
    scheduleHint: vi.fn(),
    updateObjectives: vi.fn(),
    refreshBoardVisuals: vi.fn(),
    processQueuedInput: vi.fn(),
    queueSwap: vi.fn(() => true),
    renderer: {
      animator: { animateSwap: vi.fn(), animateInvalidSwap: vi.fn(), playSteps: vi.fn() },
    },
  });
  api.cloud.run = run;
  return run;
}

describe('responsive authoritative mining', () => {
  it('restores server ore progress and clears it when the next run has no ore orders', async () => {
    const run = playing();
    run.oreOrders = [{ color: 'ruby', target: 12, progress: 5 }];
    fetchMock.mockResolvedValueOnce(reply(profile('account-a', 1, run)));
    await stores.game.startLevel(1);
    expect(stores.game.oreOrders).toEqual(run.oreOrders);
    fetchMock.mockResolvedValueOnce(reply(profile('account-a', 2, mine())));
    await stores.game.startLevel(1);
    expect(stores.game.oreOrders).toEqual([]);
  });

  it('persists building cinematic acknowledgments through the authoritative command queue', async () => {
    fetchMock.mockResolvedValueOnce(reply(profile('account-a', 1)));
    await stores.campaign.acknowledgePresentation('railway-opening');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      type: 'town.presentation-seen',
      args: { id: 'railway-opening' },
      revision: 0,
    });
  });

  it('starts the swap before the response and waits for both before playing server cascades', async () => {
    const run = playing();
    const response = deferred();
    const animation = deferred();
    const animator = stores.game.renderer.animator;
    animator.animateSwap.mockReturnValue(animation.promise);
    fetchMock.mockReturnValue(response.promise);
    const move = stores.game.resolveSwap(1, 4);
    expect(animator.animateSwap).toHaveBeenCalledOnce();
    expect(stores.game.board).toEqual(run.board);
    expect(stores.game.moves ?? 0).toBe(0);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const accepted = { ...run, score: 100, moves: 1, steps: [{ server: true }] };
    response.resolve(reply(profile('account-a', 1, accepted)));
    await vi.waitFor(() => expect(api.cloud.revision).toBe(1));
    expect(animator.playSteps).not.toHaveBeenCalled();
    animation.resolve();
    expect(await move).toBe(true);
    expect(animator.playSteps).toHaveBeenCalledWith(accepted.steps);
    expect(stores.game.score).toBe(100);
    expect(stores.game.animationInProgress).toBe(false);
  });

  it('rejects an obvious mis-swap immediately without spending a request or changing progress', async () => {
    const run = playing();
    expect(await stores.game.resolveSwap(0, 1)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stores.game.renderer.animator.animateInvalidSwap).toHaveBeenCalledOnce();
    expect(stores.game.board).toEqual(run.board);
    expect(api.cloud.revision).toBe(0);
    expect(api.cloud.error).toBe('');
  });

  it('restores the confirmed board on a lost response and blocks new rewarded moves until retry', async () => {
    const run = playing();
    fetchMock.mockRejectedValue(new TypeError('Lost response'));
    expect(await stores.game.resolveSwap(1, 4)).toBe(false);
    expect(api.cloud.pending).toBe(true);
    expect(stores.game.board).toEqual(run.board);
    expect(stores.game.score).toBe(0);
    expect(stores.game.renderer.animator.playSteps).not.toHaveBeenCalled();
    expect(await stores.game.resolveSwap(1, 4)).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reconciles a conflict only after the in-flight swap finishes', async () => {
    const run = playing();
    const animation = deferred();
    stores.game.renderer.animator.animateSwap.mockReturnValue(animation.promise);
    const latest = { ...run, score: 200, moves: 2 };
    fetchMock
      .mockResolvedValueOnce(reply({ error: 'Stale revision' }, 409))
      .mockResolvedValueOnce(reply(profile('account-a', 2, latest)));
    const move = stores.game.resolveSwap(1, 4);
    await vi.waitFor(() => expect(api.cloud.revision).toBe(2));
    expect(stores.game.animationInProgress).toBe(true);
    expect(stores.game.score ?? 0).toBe(0);
    animation.resolve();
    expect(await move).toBe(false);
    expect(stores.game.score).toBe(200);
    expect(stores.game.animationInProgress).toBe(false);
    expect(api.cloud.pending).toBe(false);
  });

  it('recovers saved progress even if the renderer fails', async () => {
    const run = playing();
    stores.game.renderer.animator.animateSwap.mockRejectedValue(new Error('Renderer failed'));
    stores.game.renderer.animator.playSteps.mockRejectedValue(new Error('Renderer failed'));
    fetchMock.mockResolvedValue(
      reply(profile('account-a', 1, { ...run, score: 100, steps: [{}] })),
    );
    expect(await stores.game.resolveSwap(1, 4)).toBe(true);
    expect(stores.game.score).toBe(100);
    expect(api.cloud.pending).toBe(false);
    expect(stores.game.animationInProgress).toBe(false);
  });

  it('keeps a newer server snapshot received while an older cascade is playing', async () => {
    const run = playing();
    const cascade = deferred();
    stores.game.renderer.animator.playSteps.mockReturnValue(cascade.promise);
    fetchMock
      .mockResolvedValueOnce(reply(profile('account-a', 1, { ...run, score: 100, steps: [{}] })))
      .mockResolvedValueOnce(reply(profile('account-a', 2, { ...run, score: 200, moves: 2 })));
    const move = stores.game.resolveSwap(1, 4);
    await vi.waitFor(() => expect(stores.game.renderer.animator.playSteps).toHaveBeenCalledOnce());
    await api.refresh();
    expect(stores.game.animationInProgress).toBe(true);
    cascade.resolve();
    expect(await move).toBe(false);
    expect(stores.game.score).toBe(200);
    expect(stores.game.moves).toBe(2);
  });

  it('does not play an old cascade or unlock a new session after navigation', async () => {
    const run = playing();
    const response = deferred();
    fetchMock.mockReturnValue(response.promise);
    const move = stores.game.resolveSwap(1, 4);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    stores.game.exitLevel();
    stores.game.animationInProgress = true;
    response.resolve(reply(profile('account-a', 1, { ...run, steps: [{}] })));
    expect(await move).toBe(false);
    expect(stores.game.renderer.animator.playSteps).not.toHaveBeenCalled();
    expect(stores.game.animationInProgress).toBe(true);
  });

  it('preserves buffered input through reconciliation without unlocking its new animation', async () => {
    const run = playing();
    const response = deferred();
    fetchMock.mockReturnValue(response.promise);
    const move = stores.game.resolveSwap(1, 4);
    const queued = { aIndex: 3, bIndex: 4, gems: [] };
    stores.game.queuedSwap = queued;
    expect(stores.game.resolveSwap(3, 4)).toBe(true);
    expect(stores.game.queueSwap).toHaveBeenCalledWith(3, 4);
    stores.game.processQueuedInput.mockImplementation(() => {
      expect(stores.game.queuedSwap).toEqual(queued);
      expect(api.cloud.busy).toBe(false);
      expect(stores.game.animationInProgress).toBe(false);
      stores.game.animationInProgress = true;
    });
    response.resolve(reply(profile('account-a', 1, run)));
    expect(await move).toBe(true);
    expect(stores.game.animationInProgress).toBe(true);
  });

  it('does not put town income polling ahead of an active mining gesture', () => {
    playing();
    expect(stores.campaign.accrueSaloonIncome()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
