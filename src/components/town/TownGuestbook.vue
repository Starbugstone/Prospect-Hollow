<template>
  <section class="town-guestbook" :class="{ 'is-collapsed': collapsed }">
    <h2>
      <button
        class="guestbook-toggle"
        :aria-expanded="!collapsed"
        :aria-controls="bodyId"
        @click="settings.setGuestbookCollapsed(!collapsed)"
      >
        <GameIcon name="book" />
        <span class="guestbook-title">{{ t("Mayor's guestbook") }}</span>
        <span v-if="collapsed && present.length" class="guestbook-live">{{
          t('Here now · {count}', { count: number(present.length) })
        }}</span>
        <GameIcon class="guestbook-chevron" name="chevron" />
      </button>
    </h2>
    <div v-show="!collapsed" :id="bodyId" class="guestbook-body">
      <p v-if="!townId && !villageId">
        {{ t('Back up and share your town to welcome other players.') }}
      </p>
      <template v-else>
        <p v-if="error || problem" role="status">{{ t(error || problem) }}</p>
        <h3>{{ t('Here now · {count}', { count: number(present.length) }) }}</h3>
        <p v-if="!snapshot && !error">{{ t('Loading visitors…') }}</p>
        <p v-else-if="!present.length" class="guestbook-empty">
          {{ t('No players visiting right now.') }}
        </p>
        <ul v-else class="guestbook-now">
          <li v-for="visitor in present" :key="visitor.id">
            <span class="guestbook-badge" aria-hidden="true">✦</span>
            <div>
              <strong>{{ visitorName(visitor) }}</strong
              ><small v-if="visitorTitle(visitor)">{{ visitorTitle(visitor) }}</small
              ><small>{{ eraName(visitor.era) }}</small>
            </div>
            <button v-if="canFind" @click="$emit('find', visitor.id)">
              {{ t('Find visitor') }}
            </button>
            <a
              v-if="visitor.publicId"
              :href="visitUrl(visitor.publicId)"
              target="_blank"
              rel="noopener"
              >{{ t('Visit town') }}</a
            >
          </li>
        </ul>
        <h3>{{ t('Visit history') }}</h3>
        <p v-if="!visits.length && snapshot" class="guestbook-empty">
          {{ t('Your guestbook is waiting for its first visitor.') }}
        </p>
        <!-- Older pages load while the reader scrolls this box, which keeps the rest of the
             card in reach however long the guestbook grows. -->
        <div
          v-else-if="visits.length"
          ref="scroller"
          class="guestbook-scroll"
          role="region"
          :aria-label="t('Visit history')"
          tabindex="0"
        >
          <section v-for="day in days" :key="day.key" class="guestbook-day">
            <h4>{{ day.label }}</h4>
            <ol class="guestbook-history">
              <li v-for="visit in day.visits" :key="visit.id">
                <div>
                  <a
                    v-if="visit.publicId"
                    :href="visitUrl(visit.publicId)"
                    target="_blank"
                    rel="noopener"
                    ><strong>{{ visitorName(visit) }}</strong></a
                  >
                  <strong v-else>{{ visitorName(visit) }}</strong>
                  <small v-if="visitorTitle(visit)">{{ visitorTitle(visit) }}</small>
                </div>
                <div class="guestbook-time">
                  <time :datetime="iso(visit.arrivedAt)" :title="when(visit.arrivedAt)">{{
                    hour(visit.arrivedAt)
                  }}</time
                  ><small v-if="visit.departedAt">{{
                    t('Stayed {minutes} min', { minutes: number(stay(visit)) })
                  }}</small
                  ><small v-else class="guestbook-visiting">{{ t('Visiting now') }}</small>
                </div>
              </li>
            </ol>
          </section>
          <button
            v-if="hasMore"
            ref="more"
            class="guestbook-more"
            :disabled="busy"
            @click="loadMore"
          >
            {{ t(busy ? 'Loading older visits…' : 'Show older visits') }}
          </button>
          <p v-else class="guestbook-end">{{ t('This is the first visit in the guestbook.') }}</p>
        </div>
      </template>
    </div>
  </section>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue';
import { townVisitors, villageVisitors } from '../../services/visitorApi';
import { visitUrl } from '../../services/appRoute';
import { mergeVisits, visitDays, visitorName, visitorTitle } from '../../data/liveVisitors';
import { ERA_BY_ID } from '../../data/eras';
import { t, number, locale } from '../../i18n';
import { useSettingsStore } from '../../stores/settingsStore';
import GameIcon from '../GameIcon.vue';
const props = defineProps({
  townId: String,
  villageId: String,
  snapshot: Object,
  error: String,
  era: String,
  canFind: Boolean,
});
defineEmits(['find']);
// The live poll refreshes page 1; older pages are appended as the history box scrolls.
const older = shallowRef([]),
  page = ref(1),
  olderHasNext = ref(null),
  busy = ref(false),
  problem = ref(''),
  scroller = ref(null),
  more = ref(null);
const settings = useSettingsStore();
const collapsed = computed(() => settings.guestbookCollapsed);
const bodyId = `guestbook-${useId()}`;
const present = computed(() => props.snapshot?.present ?? []);
const visits = computed(() => mergeVisits(older.value, props.snapshot?.history ?? []));
const days = computed(() => visitDays(visits.value, Date.now(), locale.value));
const hasMore = computed(() => olderHasNext.value ?? props.snapshot?.hasNext ?? false);
const eraName = (era) => t(ERA_BY_ID[era ?? props.era]?.label ?? ERA_BY_ID.frontier.label);
const iso = (at) => new Date(at).toISOString();
const when = (at) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
const hour = (at) => new Intl.DateTimeFormat(locale.value, { timeStyle: 'short' }).format(at);
const stay = (visit) => Math.max(1, Math.ceil((visit.departedAt - visit.arrivedAt) / 60000));
let generation = 0,
  observer = null;
watch(
  () => props.townId || props.villageId,
  () => {
    generation++;
    older.value = [];
    page.value = 1;
    olderHasNext.value = null;
    busy.value = false;
    problem.value = '';
  },
);
async function loadMore() {
  if (busy.value || !hasMore.value) return;
  const current = ++generation,
    next = page.value + 1;
  busy.value = true;
  problem.value = '';
  try {
    const loaded = props.villageId
      ? await villageVisitors(props.villageId, next)
      : await townVisitors(props.townId, next);
    if (current !== generation) return;
    page.value = next;
    older.value = mergeVisits(older.value, loaded.history);
    olderHasNext.value = loaded.hasNext;
  } catch {
    if (current === generation) problem.value = 'Visit history is temporarily unavailable.';
  } finally {
    if (current === generation) busy.value = false;
  }
  // A short page can leave the button in view; observing again checks it once more.
  await nextTick();
  if (!problem.value && more.value) {
    observer?.unobserve(more.value);
    observer?.observe(more.value);
  }
}
// The "Show older visits" button doubles as the scroll trigger, so keyboards and browsers
// without IntersectionObserver can still page through the guestbook.
watch(
  [scroller, more],
  ([box, button]) => {
    observer?.disconnect();
    observer = null;
    if (!box || !button || typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) loadMore();
      },
      { root: box, rootMargin: '0px 0px 120px 0px' },
    );
    observer.observe(button);
  },
  { flush: 'post' },
);
onBeforeUnmount(() => {
  generation++;
  observer?.disconnect();
});
</script>
<style scoped>
.town-guestbook {
  margin: 1.1rem 0;
  border: 1px solid #dacbdc;
  border-radius: 14px;
  background: #faf5fa;
  color: #48364d;
}
.town-guestbook h2 {
  margin: 0;
  font-size: 1.1rem;
}
.guestbook-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.85rem 1rem;
  border: 0;
  border-radius: 14px;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.guestbook-toggle:hover {
  background: #f3e9f3;
}
.guestbook-toggle:focus-visible {
  outline: 2px solid #82518b;
  outline-offset: -2px;
}
.guestbook-title {
  flex: 1;
  min-width: 0;
}
.guestbook-live {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: #dcefe1;
  color: #1f5135;
  font-size: 0.78rem;
  white-space: nowrap;
}
.guestbook-chevron {
  transition: transform 0.15s;
}
.is-collapsed .guestbook-chevron {
  transform: rotate(-90deg);
}
.guestbook-body {
  padding: 0 1rem 1rem;
}
.town-guestbook h3 {
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0.6rem 0 0.4rem;
  opacity: 0.8;
}
.town-guestbook p {
  line-height: 1.5;
  margin: 0.4rem 0;
}
.guestbook-empty {
  opacity: 0.8;
}
.town-guestbook ul,
.town-guestbook ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
.town-guestbook li {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid #e8dce9;
}
.town-guestbook li:last-child {
  border-bottom: 0;
}
.town-guestbook li > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.town-guestbook small {
  display: block;
  line-height: 1.5;
  opacity: 0.85;
}
.guestbook-badge {
  color: #82518b;
  font-size: 1.5rem;
}
.town-guestbook a {
  margin-left: auto;
  color: #684075;
  font-size: 0.9rem;
  white-space: nowrap;
}
.guestbook-scroll {
  max-height: min(24rem, 55vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid #e8dce9;
  border-radius: 10px;
  background: #fffdfd;
}
.guestbook-scroll:focus-visible {
  outline: 2px solid #82518b;
}
.guestbook-day h4 {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 0.35rem 0.75rem;
  background: #f3e9f3;
  font-size: 0.8rem;
}
.guestbook-day h4::first-letter {
  text-transform: uppercase;
}
.town-guestbook .guestbook-history {
  padding: 0 0.75rem;
}
.guestbook-time {
  margin-left: auto;
  text-align: right;
  font-size: 0.82rem;
  white-space: nowrap;
}
.guestbook-visiting {
  color: #1f5135;
  font-weight: 600;
}
.town-guestbook button:not(.guestbook-toggle) {
  font: inherit;
  padding: 0.45rem 0.65rem;
  border: 1px solid #b9a5bb;
  border-radius: 7px;
  background: #fff;
  color: inherit;
}
.town-guestbook .guestbook-more {
  display: block;
  width: calc(100% - 1.5rem);
  margin: 0.5rem 0.75rem 0.75rem;
}
.guestbook-end {
  padding: 0.5rem 0.75rem 0.75rem;
  text-align: center;
  font-size: 0.82rem;
  opacity: 0.7;
}
@media (max-width: 480px) {
  .guestbook-toggle {
    padding: 0.75rem;
  }
  .guestbook-body {
    padding: 0 0.75rem 0.75rem;
  }
  .guestbook-now li {
    flex-wrap: wrap;
  }
  .guestbook-now li > div {
    flex: 1;
    min-width: 50%;
  }
}
</style>
