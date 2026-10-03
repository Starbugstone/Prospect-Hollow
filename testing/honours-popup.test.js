import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, effectScope, h, nextTick, reactive, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { HONOURS, awardHonour, mergeHonours, normalizeHonours } from '../src/data/honours';
import { BANDIT_EVENT } from '../src/data/town';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useHonourNavigation } from '../src/composables/useHonourNavigation';
import {
  NOTICE_MS,
  SETTLE_MS,
  honourNotice,
  useHonourAnnouncements,
} from '../src/composables/useHonourAnnouncements';
import HonourToast from '../src/components/honours/HonourToast.vue';
import { setLocale } from '../src/i18n';
import fr from '../src/i18n/fr.json';

// The SSR checks render fixed cards; every other test runs the real queue.
const preview = vi.hoisted(() => ({ card: null }));
vi.mock('../src/composables/useHonourAnnouncements', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    useHonourAnnouncements: (...args) => preview.card ?? real.useHonourAnnouncements(...args),
  };
});

const award = (honours, ids, options = {}) =>
  ids.reduce((next, id, i) => awardHonour(next, id, { at: 1000 + i, ...options }), honours);
const fresh = (ids, options) => award(normalizeHonours(null), ids, options);

describe('Honour notice batching', () => {
  it('announces nothing without new honours, and never the quiet era medals', () => {
    expect(honourNotice(null)).toBe(null);
    expect(honourNotice(fresh(['defence-frontier']))).toBe(null);
    const announced = fresh(['first-perfect']);
    announced.earned['first-perfect'].announced = true;
    expect(honourNotice(announced)).toBe(null);
  });

  it('makes one summary of a batch, with only the highest new score rank', () => {
    const notice = honourNotice(
      fresh(['first-fusion', 'score-ace', 'score-legend', 'forge-delivers', 'defence-frontier']),
    );
    expect(notice.entries.map(({ id }) => id)).toEqual([
      'score-legend',
      'first-fusion',
      'forge-delivers',
    ]);
    // Both score ranks are acknowledged, so the lower rank never follows on its own.
    expect(notice.ids.sort()).toEqual(
      ['first-fusion', 'forge-delivers', 'score-ace', 'score-legend'].sort(),
    );
    expect(notice.backfilled).toBe(false);
  });

  it('marks a batch containing legacy backfill as one recorded summary', () => {
    const honours = fresh(['first-perfect', 'score-ace', 'master-quartermaster'], {
      at: null,
      backfilled: true,
    });
    const notice = honourNotice(honours);
    expect(notice.backfilled).toBe(true);
    expect(notice.entries).toHaveLength(3);
  });
});

describe('Honour popup queue', () => {
  let saved, observers, dom, scopes, campaign, settings;
  const mutate = () => observers.forEach((observer) => observer.callback());
  // Advances from a change to the moment a card can appear (or by `ms`).
  const settle = async (ms = SETTLE_MS) => {
    await nextTick();
    vi.advanceTimersByTime(ms);
    await nextTick();
  };
  const earn = (ids, options) => {
    campaign.honours = award(campaign.honours, ids, options);
  };
  function start({ active = true, game } = {}) {
    const state = reactive({ active });
    const page = Object.assign(new EventTarget(), {
      hidden: false,
      body: {},
      querySelector: (selector) =>
        (selector === '.town-tab-bar' ? dom.village : dom.busy) ? {} : null,
    });
    game ??= reactive({
      sessionActive: false,
      sessionVersion: 1,
      audioManager: { playArcadeCue: vi.fn() },
    });
    const scope = effectScope();
    scopes.push(scope);
    const toast = scope.run(() => useHonourAnnouncements(() => state.active, { game, page }));
    return { state, game, page, toast, scope };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    });
    observers = new Set();
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor(callback) {
          this.callback = callback;
        }
        observe() {
          observers.add(this);
        }
        disconnect() {
          observers.delete(this);
        }
      },
    );
    dom = { busy: false, village: true };
    scopes = [];
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    settings = useSettingsStore();
    useHonourNavigation().closeCollection();
  });
  afterEach(() => {
    scopes.forEach((scope) => scope.stop());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows one card with one sound, marks it announced and closes after five seconds', async () => {
    const { toast, game } = start();
    earn(['first-perfect']);
    await settle();
    expect(toast.notice.value.entries.map(({ id }) => id)).toEqual(['first-perfect']);
    expect(toast.visible.value).toBe(true);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledWith('chest-open');
    expect(campaign.honours.earned['first-perfect'].announced).toBe(true);
    expect(campaign.honours.earned['first-perfect'].seen).toBe(false);
    vi.advanceTimersByTime(NOTICE_MS - 100);
    expect(toast.notice.value).not.toBe(null);
    vi.advanceTimersByTime(100);
    expect(toast.notice.value).toBe(null);
    await settle(NOTICE_MS * 2);
    expect(toast.notice.value).toBe(null);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
  });

  it('pauses while hovered or keyboard-focused and resumes the remaining time', async () => {
    const { toast } = start();
    earn(['forge-delivers']);
    await settle();
    vi.advanceTimersByTime(2000);
    toast.hold('hover', true);
    await nextTick();
    vi.advanceTimersByTime(NOTICE_MS * 4);
    toast.hold('hover', false);
    toast.hold('focus', true);
    await nextTick();
    vi.advanceTimersByTime(NOTICE_MS * 4);
    expect(toast.notice.value).not.toBe(null);
    toast.hold('focus', false);
    await nextTick();
    vi.advanceTimersByTime(NOTICE_MS - 2100);
    expect(toast.notice.value).not.toBe(null);
    vi.advanceTimersByTime(100);
    expect(toast.notice.value).toBe(null);
  });

  it('turns one action with several honours into a single summary, never a sequence', async () => {
    const { toast, game } = start();
    earn(['first-fusion', 'score-ace', 'score-legend', 'forge-delivers']);
    await settle();
    expect(toast.notice.value.entries).toHaveLength(3);
    expect(toast.notice.value.fromPuzzle).toBe(false);
    toast.dismiss();
    await settle(NOTICE_MS * 3);
    expect(toast.notice.value).toBe(null);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
    for (const id of ['first-fusion', 'score-ace', 'score-legend', 'forge-delivers'])
      expect(campaign.honours.earned[id].announced).toBe(true);
  });

  it('summarises legacy backfill once', async () => {
    const { toast } = start();
    earn(['first-perfect', 'score-ace', 'perfect-prospector', 'town-complete'], {
      at: null,
      backfilled: true,
    });
    await settle();
    expect(toast.notice.value.backfilled).toBe(true);
    expect(toast.notice.value.entries).toHaveLength(4);
    toast.dismiss();
    await settle(NOTICE_MS * 3);
    expect(toast.notice.value).toBe(null);
  });

  it('opens the collection on the honour, or on the whole set for a summary', async () => {
    const { toast } = start();
    earn(['score-ace']);
    await settle();
    toast.view();
    expect(toast.notice.value).toBe(null);
    expect(useHonourNavigation().requests.collection).toEqual({ familyId: 'score' });
    earn(['first-fusion', 'forge-delivers']);
    await settle();
    toast.view();
    expect(useHonourNavigation().requests.collection).toEqual({ familyId: null });
  });

  it.each([
    ['quiet', false],
    ['off', true],
  ])('in %s mode unlocks and acknowledges silently', async (mode, cleared) => {
    settings.setHonourNotices(mode);
    const { toast, game } = start();
    earn(['first-perfect', 'fusion-master']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    expect(game.audioManager.playArcadeCue).not.toHaveBeenCalled();
    expect(Object.keys(campaign.honours.earned)).toEqual(['first-perfect', 'fusion-master']);
    expect(campaign.honours.earned['first-perfect'].announced).toBe(true);
    // Quiet keeps the collection's New marker; Off clears it.
    expect(campaign.honours.earned['fusion-master'].seen).toBe(cleared);
    settings.setHonourNotices('full');
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
  });

  it('never repeats after a reload or a stale sync copy', async () => {
    const first = start();
    earn(['master-quartermaster']);
    const stale = normalizeHonours(JSON.parse(JSON.stringify(campaign.honours)));
    await settle();
    expect(first.toast.notice.value).not.toBe(null);
    first.scope.stop();
    campaign.reloadLocal();
    expect(campaign.honours.earned['master-quartermaster'].announced).toBe(true);
    campaign.honours = mergeHonours(campaign.honours, stale);
    const second = start();
    await settle(NOTICE_MS);
    expect(second.toast.notice.value).toBe(null);
  });

  it('presents once per session even when the acknowledgement cannot be saved', async () => {
    const { toast, game } = start();
    vi.spyOn(campaign, 'markHonoursAnnounced').mockReturnValue(false);
    earn(['first-perfect']);
    await settle();
    toast.dismiss();
    dom.busy = true;
    mutate();
    await settle();
    dom.busy = false;
    mutate();
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
  });

  it('waits for the results to close and the village to open after a puzzle', async () => {
    const { toast, state, game } = start({ active: false });
    game.sessionActive = true;
    earn(['first-perfect', 'first-fusion']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    expect(campaign.honours.earned['first-perfect'].announced).toBe(false);
    game.sessionActive = false;
    state.active = true;
    await settle();
    expect(toast.notice.value.fromPuzzle).toBe(true);
  });

  it('never announces outside the owner village or in a read-only save', async () => {
    const { toast, state } = start({ active: false });
    earn(['first-perfect']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    campaign.readOnly = true;
    state.active = true;
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    expect(campaign.honours.earned['first-perfect'].announced).toBe(false);
  });

  it.each([
    ['the settings drawer is open', () => (settings.isSettingsOpen = true)],
    [
      'an era cinematic plays',
      () => (campaign.town = { ...campaign.town, transition: { pending: true } }),
    ],
    [
      'the three-star celebration is pending',
      () =>
        (campaign.town = {
          ...campaign.town,
          presentations: { 'three-star-celebration': 'pending' },
        }),
    ],
    [
      'an unseen incident plays',
      () =>
        (campaign.town = {
          ...campaign.town,
          events: { [BANDIT_EVENT]: { id: 'raid-1', seen: false } },
        }),
    ],
    ['a dialog or sheet is open', () => (dom.busy = true)],
    ['the village is still loading', () => (dom.village = false)],
  ])('waits while %s', async (_, open) => {
    const town = campaign.town;
    const { toast } = start();
    open();
    mutate();
    earn(['perfect-prospector']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    settings.isSettingsOpen = false;
    campaign.town = town;
    Object.assign(dom, { busy: false, village: true });
    mutate();
    await settle(SETTLE_MS - 1);
    expect(toast.notice.value).toBe(null);
    await settle(1);
    expect(toast.notice.value.entries[0].id).toBe('perfect-prospector');
  });

  it('hides and pauses a card while a dialog opens, and closes it when leaving town', async () => {
    const { toast, state } = start();
    earn(['first-perfect']);
    await settle();
    dom.busy = true;
    mutate();
    await nextTick();
    expect(toast.visible.value).toBe(false);
    vi.advanceTimersByTime(NOTICE_MS * 2);
    expect(toast.notice.value).not.toBe(null);
    dom.busy = false;
    mutate();
    await nextTick();
    expect(toast.visible.value).toBe(true);
    state.active = false;
    await nextTick();
    expect(toast.notice.value).toBe(null);
  });

  it('follows the current town when its honours are replaced', async () => {
    const { toast } = start();
    earn(['first-perfect']);
    await settle();
    campaign.honours = fresh(['forge-delivers']);
    await nextTick();
    expect(toast.notice.value).toBe(null);
    await settle();
    expect(toast.notice.value.entries[0].id).toBe('forge-delivers');
  });
});

describe('Honour popup rendering', () => {
  const definition = (id) => HONOURS.byId[id];
  const card = (ids, extra = {}) => ({
    notice: ref({
      key: 1,
      entries: ids.map((id) => ({ id, definition: definition(id), entry: {} })),
      ids,
      backfilled: false,
      fromPuzzle: true,
      ...extra,
    }),
    visible: ref(true),
    paused: ref(false),
    hold() {},
    dismiss() {},
    view() {},
  });
  const render = (preset) => {
    preview.card = preset;
    const app = createSSRApp({ render: () => h(HonourToast, { active: true }) });
    app.use(createPinia());
    return renderToString(app);
  };
  afterEach(() => {
    preview.card = null;
    setLocale('en');
  });

  it('renders a single achievement as a polite, non-modal status card', async () => {
    const html = await render(card(['master-quartermaster']));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toMatch(/autofocus|aria-modal|tabindex|<dialog/);
    for (const text of [
      'Achievement earned',
      'Master Quartermaster',
      'Every supply fully stocked',
      'Very hard',
      '>Open<',
      'aria-label="Dismiss"',
      'honour-toast-timer',
    ])
      expect(html).toContain(text);
  });

  it('renders a batch as one summary card', async () => {
    const html = await render(card(['score-ace', 'first-fusion', 'forge-delivers']));
    expect(html).toContain('3 achievements earned');
    expect(html).toContain('Score Ace, First Fusion and 1 more');
    expect(html).toContain('From your last puzzle');
    expect(html).toContain('View all');
    expect(html).not.toContain('honour-toast-difficulty');
    expect(html.match(/class="honour-badge/g)).toHaveLength(3);
  });

  it('renders legacy backfill and French copy', async () => {
    setLocale('fr');
    const backfill = await render(
      card(['first-perfect', 'score-ace', 'perfect-prospector', 'town-complete'], {
        backfilled: true,
      }),
    );
    expect(backfill).toContain('4 distinctions enregistrées');
    expect(backfill).toContain('Premier sans-faute, As du score et 2 autres');
    expect(backfill).toContain('D’après votre progression');
    const single = await render(card(['master-quartermaster']));
    for (const text of [
      'Succès obtenu',
      'Maître intendant',
      'Toutes les réserves au complet',
      'Très difficile',
      '>Ouvrir<',
      'Fermer le message',
    ])
      expect(single).toContain(text);
  });

  it('translates every popup and preference string', () => {
    const messages = [
      'Achievement earned',
      '{count} achievements earned',
      'Honour recorded',
      '{count} honours recorded',
      '{first} and {second}',
      '{first}, {second} and 1 more',
      '{first}, {second} and {count} more',
      'From your last puzzle',
      'Added to your collection',
      'From your progress so far',
      'Easy',
      'Medium',
      'Very hard',
      'Open',
      'View all',
      'Dismiss',
      'Achievement notices',
      'Full',
      'Quiet',
      'Off',
    ];
    expect(messages.filter((message) => !Object.hasOwn(fr, message))).toEqual([]);
  });
});
