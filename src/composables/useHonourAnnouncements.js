import { computed, onScopeDispose, reactive, ref, toValue, watch } from 'vue';
import { HONOURS, normalizeHonours, pendingAnnouncements } from '../data/honours';
import { BANDIT_EVENT } from '../data/town';
import { pendingPresentation } from '../data/townPresentations';
import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useHonourNavigation } from './useHonourNavigation';

export const NOTICE_MS = 5000;
export const SETTLE_MS = 700;
const DIFFICULTY_ORDER = ['hard', 'medium', 'easy'];
// The village tab bar is on screen only once the village has loaded and no incident,
// era cinematic or presentation is playing. The card waits for it and sits above it.
const VILLAGE_SELECTOR = '.town-tab-bar';
// Elements that hold the player's attention: every open native dialog (village panels
// and sheets, the museum, tours, cinematics, results) and incidents with their outcome card.
const BUSY_SELECTOR = 'dialog[open], .town-has-raid, .town-in-cinematic, .town-raid-notice';

// One card for everything pending: a single honour, or one summary for several honours
// from the same action or batch, never a sequence of toasts. Each family shows its
// highest new rank; `ids` also covers lower ranks earned at once so none repeats later.
// Backfilled honours share one "recorded from your progress so far" summary.
export function honourNotice(honours, catalog = HONOURS) {
  const saved = normalizeHonours(honours);
  const order = (entry) =>
    DIFFICULTY_ORDER.indexOf(entry.definition.difficulty) * catalog.definitions.length +
    catalog.definitions.indexOf(entry.definition);
  const entries = pendingAnnouncements(saved, catalog).sort((a, b) => order(a) - order(b));
  if (!entries.length) return null;
  return {
    entries,
    ids: entries.flatMap(({ definition }) =>
      catalog.familyById[definition.family].ranks
        .filter((rank) => saved.earned[rank.id] && !saved.earned[rank.id].announced)
        .map((rank) => rank.id),
    ),
    backfilled: entries.some(({ entry }) => entry.backfilled),
  };
}

/**
 * The achievement popup queue. Safe points, from store state and page signals:
 * - only in this player's own active village (`active`): never in the mine, including
 *   its results, nor on the home page, in account panels, while visiting another town
 *   or in a read-only save;
 * - never while settings, an era cinematic, a pending town presentation or an unseen
 *   incident is up. The three-star celebration is a presentation, so Perfect Prospector
 *   appears after it finishes or is skipped;
 * - only once the village and its tab bar are on screen, never while a dialog, sheet,
 *   cinematic or results card is open (BUSY_SELECTOR), and only after a short settle, so
 *   town honours follow the committed action.
 * A card on screen hides and pauses while blocked and closes when the village does.
 * Quiet and Off mark honours announced without a popup; Off also clears the New marker.
 */
export function useHonourAnnouncements(
  active,
  {
    campaign = useCampaignStore(),
    settings = useSettingsStore(),
    game = useGameStore(),
    page = globalThis.document,
    catalog = HONOURS,
  } = {},
) {
  const navigation = useHonourNavigation();
  const notice = ref(null);
  const holds = reactive({ hover: false, focus: false, hidden: !!page?.hidden });
  const pageBusy = ref(false);
  // Presented or suppressed in this session, by honour and earned date: a failed save
  // cannot loop the same card, while another town or a fresh save announces normally.
  const handled = reactive(new Set());
  const origins = new Map();
  const key = (id) => `${id}@${campaign.honours.earned[id]?.at ?? 'backfill'}`;
  let serial = 0;

  const owned = computed(() => !!toValue(active) && !campaign.readOnly && !game.sessionActive);
  const pending = computed(() => {
    const next = honourNotice(campaign.honours, catalog);
    if (!next || next.ids.every((id) => handled.has(key(id)))) return null;
    return next;
  });
  const storeBusy = computed(() => {
    const town = campaign.town;
    const incident = town.events?.[BANDIT_EVENT];
    return (
      settings.isSettingsOpen ||
      !!town.transition?.pending ||
      !!pendingPresentation(town) ||
      !!(incident && !incident.seen)
    );
  });
  const blocked = computed(() => !owned.value || storeBusy.value || pageBusy.value);
  const paused = computed(() => holds.hover || holds.focus || holds.hidden || blocked.value);

  // Note which puzzle each honour came from while the results are still on screen.
  watch(
    pending,
    (next) => {
      for (const { id } of next?.entries ?? [])
        if (!origins.has(key(id)))
          origins.set(key(id), game.sessionActive ? game.sessionVersion : null);
    },
    { immediate: true },
  );

  function acknowledge(next) {
    for (const id of next.ids) handled.add(key(id));
    campaign.markHonoursAnnounced(next.ids);
  }
  // Quiet and Off never wait for a popup slot: they only need the owner's village.
  watch(
    [pending, owned, () => settings.honourNotices],
    () => {
      const next = pending.value;
      if (!next || !owned.value || settings.honourNotices === 'full') return;
      acknowledge(next);
      if (settings.honourNotices === 'off') campaign.markHonoursSeen(next.ids);
    },
    { immediate: true },
  );

  let settle, timer, remaining, startedAt;
  function present() {
    const next = pending.value;
    if (!next || notice.value || blocked.value || settings.honourNotices !== 'full') return;
    acknowledge(next);
    const puzzles = new Set(next.entries.map(({ id }) => origins.get(key(id)) ?? null));
    notice.value = {
      ...next,
      key: ++serial,
      fromPuzzle: puzzles.size === 1 && !puzzles.has(null),
    };
    remaining = NOTICE_MS;
    game.audioManager?.playArcadeCue?.('chest-open');
    run();
  }
  watch(
    () => !!pending.value && !notice.value && !blocked.value && settings.honourNotices === 'full',
    (ready) => {
      clearTimeout(settle);
      if (ready) settle = setTimeout(present, SETTLE_MS);
    },
    { immediate: true },
  );

  function run() {
    if (!notice.value || paused.value || timer) return;
    startedAt = Date.now();
    timer = setTimeout(dismiss, remaining);
  }
  function stop() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  }
  function dismiss() {
    stop();
    notice.value = null;
  }
  watch(paused, (hold) => (hold ? stop() : run()));
  watch(owned, (open) => open || dismiss());
  watch(
    () => settings.honourNotices,
    (mode) => mode === 'full' || dismiss(),
  );
  // An import or reset replaces the honours on screen.
  watch(
    () => campaign.honours.earned,
    (earned) => notice.value?.ids.some((id) => !earned[id]) && dismiss(),
  );

  // Page signals are observed only while something waits or shows.
  let observer;
  const checkPage = () => {
    pageBusy.value =
      !page?.querySelector?.(VILLAGE_SELECTOR) || !!page.querySelector(BUSY_SELECTOR);
  };
  watch(
    () => owned.value && (!!pending.value || !!notice.value),
    (watching) => {
      observer?.disconnect();
      observer = null;
      if (watching && page?.body && typeof MutationObserver === 'function') {
        observer = new MutationObserver(checkPage);
        observer.observe(page.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['open', 'class'],
        });
      }
      if (watching) checkPage();
      else pageBusy.value = false;
    },
    { immediate: true },
  );
  const visibility = () => {
    holds.hidden = !!page.hidden;
  };
  page?.addEventListener?.('visibilitychange', visibility);
  onScopeDispose(() => {
    clearTimeout(settle);
    clearTimeout(timer);
    observer?.disconnect();
    page?.removeEventListener?.('visibilitychange', visibility);
  });

  return {
    notice,
    paused,
    visible: computed(() => !!notice.value && !blocked.value),
    hold(reason, on) {
      holds[reason] = on;
    },
    dismiss,
    view() {
      const shown = notice.value;
      dismiss();
      if (shown)
        navigation.openCollection(
          shown.entries.length === 1 ? shown.entries[0].definition.family : null,
        );
    },
  };
}
