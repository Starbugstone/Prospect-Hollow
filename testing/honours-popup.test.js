import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, effectScope, h, nextTick, reactive, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { HONOURS, mergeHonours, normalizeHonours } from '../src/data/honours';
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
import { distinctionBadge } from '../src/data/playerDistinctions';
import { setLocale } from '../src/i18n';
import fr from '../src/i18n/fr.json';

// The SSR checks render fixed cards; every other test runs the real queue.
const preview = vi.hoisted(() => ({ card: null }));
vi.mock('../src/composables/useHonourAnnouncements', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // A preset card replaces the queue of its kind (town unless stated).
    useHonourAnnouncements: (active, options = {}) =>
      preview.card && (preview.card.kind ?? 'town') === (options.kind ?? 'town')
        ? preview.card
        : real.useHonourAnnouncements(active, options),
  };
});

// Earned entries as the store saves them, unannounced and unseen unless stated.
function award(honours, ids, { at, ...flags } = {}) {
  const next = normalizeHonours(honours);
  ids.forEach((id, i) => {
    next.earned[id] = { at: at === undefined ? 1000 + i : at, version: 1, ...flags };
  });
  return normalizeHonours(next);
}
const fresh = (ids, options) => award(null, ids, options);

describe('Honour notice batching', () => {
  it('announces nothing without new honours, and Town Guardian ranks like any other', () => {
    expect(honourNotice(null)).toBe(null);
    const announced = fresh(['stars-bronze']);
    announced.earned['stars-bronze'].announced = true;
    expect(honourNotice(announced)).toBe(null);
    expect(honourNotice(fresh(['guardian-bronze'])).entries.map(({ id }) => id)).toEqual([
      'guardian-bronze',
    ]);
  });

  it('makes one summary of a batch, finest metal first, with one rank per family', () => {
    const notice = honourNotice(
      fresh(['fusion-bronze', 'score-silver', 'score-gold', 'forge-bronze', 'guardian-bronze']),
    );
    expect(notice.entries.map(({ id }) => id)).toEqual([
      'score-gold',
      'fusion-bronze',
      'guardian-bronze',
      'forge-bronze',
    ]);
    // Both score ranks are acknowledged, so the lower rank never follows on its own.
    expect(notice.ids.sort()).toEqual(
      ['fusion-bronze', 'forge-bronze', 'guardian-bronze', 'score-gold', 'score-silver'].sort(),
    );
    expect(notice.backfilled).toBe(false);
  });

  it('names the rank a family moves up from, once announced before', () => {
    const honours = fresh(['score-bronze']);
    honours.earned['score-bronze'].announced = true;
    const [promoted] = honourNotice(award(honours, ['score-silver'])).entries;
    expect(promoted.id).toBe('score-silver');
    expect(promoted.from.id).toBe('score-bronze');
    // Two ranks at once, or a first rank, is not a promotion.
    expect(honourNotice(fresh(['score-bronze', 'score-silver'])).entries[0].from).toBe(null);
    expect(honourNotice(fresh(['stars-bronze'])).entries[0].from).toBe(null);
  });

  it('marks a batch containing legacy backfill as one recorded summary', () => {
    const honours = fresh(['stars-bronze', 'score-silver', 'quartermaster-gold'], {
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
  function start({ active = true, game, distinctions, kind } = {}) {
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
    const toast = scope.run(() =>
      useHonourAnnouncements(() => state.active, {
        game,
        page,
        ...(kind ? { kind } : {}),
        ...(distinctions ? { distinctions } : {}),
      }),
    );
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
    earn(['stars-bronze']);
    await settle();
    expect(toast.notice.value.entries.map(({ id }) => id)).toEqual(['stars-bronze']);
    expect(toast.visible.value).toBe(true);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledWith('chest-open');
    expect(campaign.honours.earned['stars-bronze'].announced).toBe(true);
    expect(campaign.honours.earned['stars-bronze'].seen).toBe(false);
    vi.advanceTimersByTime(NOTICE_MS - 100);
    expect(toast.notice.value).not.toBe(null);
    vi.advanceTimersByTime(100);
    expect(toast.notice.value).toBe(null);
    await settle(NOTICE_MS * 2);
    expect(toast.notice.value).toBe(null);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
  });

  it('gives player distinctions their own card, shown with the town card', async () => {
    const alpha = { id: 'player-alpha', at: 5 };
    const year = { id: 'player-time', at: 6, tenure: { unit: 'year', count: 2 } };
    const distinctions = {
      unannounced: ref([alpha, year]),
      markAnnounced: vi.fn((keys) => {
        distinctions.unannounced.value = distinctions.unannounced.value.filter(
          (item) => !keys.includes(item.tenure ? `${item.id}@year-2` : item.id),
        );
      }),
      markSeen: vi.fn(),
    };
    const shared = reactive({
      sessionActive: false,
      sessionVersion: 1,
      audioManager: { playArcadeCue: vi.fn() },
    });
    const { toast: town } = start({ game: shared });
    const { toast: player } = start({ game: shared, kind: 'player', distinctions });
    earn(['stars-bronze', 'forge-bronze']);
    await settle();
    // Both cards are up at once; several of a kind share their card, never mixed.
    expect(town.notice.value.player).toBeUndefined();
    expect(town.notice.value.entries.map(({ id }) => id).sort()).toEqual([
      'forge-bronze',
      'stars-bronze',
    ]);
    expect(player.notice.value).toMatchObject({ player: true });
    // Two cards appearing together chime once.
    expect(shared.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
    expect(player.notice.value.entries.map(({ id }) => id)).toEqual([
      'player-alpha',
      'player-time',
    ]);
    expect(distinctions.markAnnounced).toHaveBeenCalledWith(['player-alpha', 'player-time@year-2']);
    expect(campaign.honours.earned['stars-bronze'].announced).toBe(true);
    // Each card closes on its own and opens its own collection tab.
    player.view();
    expect(player.notice.value).toBe(null);
    expect(town.notice.value).not.toBe(null);
    expect(useHonourNavigation().requests.collection).toEqual({ familyId: 'player-alpha' });
    await settle(NOTICE_MS * 2);
    expect(town.notice.value).toBe(null);
    // A card on its own later chimes again.
    distinctions.unannounced.value = [
      { id: 'player-time', at: 8, tenure: { unit: 'year', count: 4 } },
    ];
    await settle();
    expect(player.notice.value).not.toBe(null);
    expect(shared.audioManager.playArcadeCue).toHaveBeenCalledTimes(2);
    player.dismiss();
    // Quiet announces without a popup; Off also clears the New marker.
    settings.honourNotices = 'off';
    distinctions.unannounced.value = [
      { id: 'player-time', at: 7, tenure: { unit: 'year', count: 3 } },
    ];
    await settle();
    expect(player.notice.value).toBe(null);
    expect(distinctions.markSeen).toHaveBeenCalledWith(['player-time@year-3']);
  });

  it('pauses while hovered or keyboard-focused and resumes the remaining time', async () => {
    const { toast } = start();
    earn(['forge-bronze']);
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
    earn(['fusion-bronze', 'score-silver', 'score-gold', 'forge-bronze']);
    await settle();
    expect(toast.notice.value.entries).toHaveLength(3);
    expect(toast.notice.value.fromPuzzle).toBe(false);
    toast.dismiss();
    await settle(NOTICE_MS * 3);
    expect(toast.notice.value).toBe(null);
    expect(game.audioManager.playArcadeCue).toHaveBeenCalledTimes(1);
    for (const id of ['fusion-bronze', 'score-silver', 'score-gold', 'forge-bronze'])
      expect(campaign.honours.earned[id].announced).toBe(true);
  });

  it('summarises legacy backfill once', async () => {
    const { toast } = start();
    earn(['stars-bronze', 'score-silver', 'quartermaster-gold', 'ages-gold'], {
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
    earn(['score-silver']);
    await settle();
    toast.view();
    expect(toast.notice.value).toBe(null);
    expect(useHonourNavigation().requests.collection).toEqual({ familyId: 'score' });
    earn(['fusion-bronze', 'forge-bronze']);
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
    earn(['stars-bronze', 'fusion-silver']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    expect(game.audioManager.playArcadeCue).not.toHaveBeenCalled();
    expect(Object.keys(campaign.honours.earned)).toEqual(['stars-bronze', 'fusion-silver']);
    expect(campaign.honours.earned['stars-bronze'].announced).toBe(true);
    // Quiet keeps the collection's New marker; Off clears it.
    expect(campaign.honours.earned['fusion-silver'].seen).toBe(cleared);
    settings.setHonourNotices('full');
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
  });

  it('never repeats after a reload or a stale sync copy', async () => {
    const first = start();
    earn(['quartermaster-gold']);
    const stale = normalizeHonours(JSON.parse(JSON.stringify(campaign.honours)));
    await settle();
    expect(first.toast.notice.value).not.toBe(null);
    first.scope.stop();
    campaign.reloadLocal();
    expect(campaign.honours.earned['quartermaster-gold'].announced).toBe(true);
    campaign.honours = mergeHonours(campaign.honours, stale);
    const second = start();
    await settle(NOTICE_MS);
    expect(second.toast.notice.value).toBe(null);
  });

  it('presents once per session even when the acknowledgement cannot be saved', async () => {
    const { toast, game } = start();
    vi.spyOn(campaign, 'markHonoursAnnounced').mockReturnValue(false);
    earn(['stars-bronze']);
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
    earn(['stars-bronze', 'fusion-bronze']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    expect(campaign.honours.earned['stars-bronze'].announced).toBe(false);
    game.sessionActive = false;
    state.active = true;
    await settle();
    expect(toast.notice.value.fromPuzzle).toBe(true);
  });

  it('never announces outside the owner village or in a read-only save', async () => {
    const { toast, state } = start({ active: false });
    earn(['stars-bronze']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    campaign.readOnly = true;
    state.active = true;
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    expect(campaign.honours.earned['stars-bronze'].announced).toBe(false);
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
    earn(['stars-gold']);
    await settle(NOTICE_MS);
    expect(toast.notice.value).toBe(null);
    settings.isSettingsOpen = false;
    campaign.town = town;
    Object.assign(dom, { busy: false, village: true });
    mutate();
    await settle(SETTLE_MS - 1);
    expect(toast.notice.value).toBe(null);
    await settle(1);
    expect(toast.notice.value.entries[0].id).toBe('stars-gold');
  });

  it('hides and pauses a card while a dialog opens, and closes it when leaving town', async () => {
    const { toast, state } = start();
    earn(['stars-bronze']);
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
    earn(['stars-bronze']);
    await settle();
    campaign.honours = fresh(['forge-bronze']);
    await nextTick();
    expect(toast.notice.value).toBe(null);
    await settle();
    expect(toast.notice.value.entries[0].id).toBe('forge-bronze');
  });
});

describe('Honour popup rendering', () => {
  const definition = (id) => HONOURS.byId[id];
  // `from` names the rank a single family is promoted from.
  const card = (ids, { from = null, ...extra } = {}) => ({
    notice: ref({
      key: 1,
      entries: ids.map((id) => ({
        id,
        definition: definition(id),
        entry: {},
        from: from && definition(from),
      })),
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

  it('words a player distinction card with its time step and no metal', async () => {
    const step = { unit: 'year', count: 2 };
    const preset = { ...card([]), kind: 'player' };
    preset.notice.value = {
      key: 2,
      player: true,
      entries: [
        {
          id: 'player-time',
          definition: distinctionBadge('player-time', { tenure: step }),
          entry: { tenure: step },
          from: null,
        },
      ],
      ids: ['player-time@year-2'],
      backfilled: false,
    };
    const html = await render(preset);
    for (const text of ['Player distinction', 'Loyal Prospector · 2 years', '2 years since'])
      expect(html).toContain(text);
    expect(html).toContain('honour-badge-player');
    // Its own violet card, without the town card's metal and difficulty.
    expect(html).toContain('honour-toast-player');
    expect(html).not.toContain('honour-toast-difficulty');
    preset.notice.value = {
      ...preset.notice.value,
      entries: [
        {
          id: 'player-alpha',
          definition: distinctionBadge('player-alpha', { at: 1 }),
          entry: {},
          from: null,
        },
      ],
    };
    expect(await render(preset)).toContain('You played during the alpha. Thank you!');
  });

  it('renders a single achievement as a polite, non-modal status card', async () => {
    const html = await render(card(['quartermaster-gold']));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toMatch(/autofocus|aria-modal|tabindex|<dialog/);
    for (const text of [
      'Achievement earned',
      'Master Quartermaster · Gold',
      '5 powers fully stocked',
      'Hard',
      '>Open<',
      'aria-label="Dismiss"',
      'honour-toast-timer',
    ])
      expect(html).toContain(text);
    // The badge takes the rank's gold rosette, and a first rank is no promotion.
    expect(html).toMatch(/<polygon points="(?:[\d.]+,[\d.]+ ){31}[\d.]+,[\d.]+"/);
    expect(html).toContain('honour-metal-gold');
    expect(html).not.toContain('Very hard');
    expect(html).not.toContain('honour-toast-promotion');
  });

  it('shows a family moving up with both metals, spoken in words', async () => {
    const html = await render(card(['score-silver'], { from: 'score-bronze' }));
    for (const text of [
      'New rank earned',
      'Score Ace · Silver',
      'Two and a half times the star target',
      '<span aria-hidden="true">Bronze → Silver</span>',
      '<span class="town-sr-only">Promoted from Bronze to Silver</span>',
      'Medium',
    ])
      expect(html).toContain(text);
  });

  it('renders a batch as one summary card', async () => {
    const html = await render(card(['score-silver', 'fusion-bronze', 'forge-bronze']));
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
      card(['stars-bronze', 'score-silver', 'quartermaster-gold', 'ages-gold'], {
        backfilled: true,
      }),
    );
    expect(backfill).toContain('4 distinctions enregistrées');
    expect(backfill).toContain('Étoile montante, As du score et 2 autres');
    expect(backfill).toContain('D’après votre progression');
    const single = await render(card(['quartermaster-gold']));
    for (const text of [
      'Succès obtenu',
      'Maître intendant · Or',
      '5 pouvoirs au complet',
      'Difficile',
      '>Ouvrir<',
      'Fermer le message',
    ])
      expect(single).toContain(text);
    const promoted = await render(card(['score-silver'], { from: 'score-bronze' }));
    for (const text of ['Nouveau rang obtenu', 'As du score · Argent', 'Bronze → Argent'])
      expect(promoted).toContain(text);
    expect(promoted).toContain('Promotion : de Bronze à Argent');
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
      'Hard',
      'Bronze',
      'Silver',
      'Gold',
      'Diamond',
      'New rank earned',
      'Promoted from {from} to {to}',
      '{name} · {metal}',
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
