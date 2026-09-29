<template>
  <section class="town-guestbook" :aria-label="t('Visitors')">
    <h2>{{ t('Visitors') }}</h2>
    <p v-if="!townId && !villageId">
      {{ t('Back up and share your town to welcome other players.') }}
    </p>
    <template v-else>
      <p v-if="error || problem" role="status">{{ t(error || problem) }}</p>
      <h3>{{ t('Here now · {count}', { count: number(snapshot?.present?.length ?? 0) }) }}</h3>
      <p v-if="!snapshot && !error">{{ t('Loading visitors…') }}</p>
      <p v-else-if="!snapshot?.present?.length">{{ t('No players visiting right now.') }}</p>
      <ul v-else class="guestbook-now">
        <li v-for="visitor in snapshot.present" :key="visitor.id">
          <span class="guestbook-badge" aria-hidden="true">✦</span>
          <div>
            <strong>{{ visitorName(visitor) }}</strong
            ><small v-if="visitorTitle(visitor)">{{ visitorTitle(visitor) }}</small
            ><small>{{ eraName(visitor.era) }}</small>
          </div>
          <button v-if="canFind" @click="$emit('find', visitor.id)">{{ t('Find visitor') }}</button>
          <a
            v-if="visitor.publicId"
            :href="visitUrl(visitor.publicId)"
            target="_blank"
            rel="noopener"
            >{{ t('Visit town') }}</a
          >
        </li>
      </ul>
      <details :key="townId || villageId" class="guestbook-past">
        <summary>{{ t('Visit history') }}</summary>
        <p v-if="!entries.length && snapshot">
          {{ t('Your guestbook is waiting for its first visitor.') }}
        </p>
        <ol class="guestbook-history">
          <li v-for="visit in entries" :key="visit.id">
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
              <time :datetime="iso(visit.arrivedAt)">{{ when(visit.arrivedAt) }}</time
              ><small v-if="visit.departedAt">{{
                t('Left {time}', { time: when(visit.departedAt) })
              }}</small
              ><small>{{
                visit.departedAt
                  ? t('Stayed {minutes} min', {
                      minutes: number(
                        Math.max(1, Math.ceil((visit.departedAt - visit.arrivedAt) / 60000)),
                      ),
                    })
                  : t('Visiting now')
              }}</small>
            </div>
          </li>
        </ol>
        <nav v-if="page > 1 || hasNext" :aria-label="t('Visit history pages')">
          <button :disabled="page === 1 || busy" @click="load(page - 1)">
            {{ t('Previous') }}
          </button>
          <span>{{ t('Page {page}', { page }) }}</span>
          <button :disabled="!hasNext || busy" @click="load(page + 1)">{{ t('Next') }}</button>
        </nav>
      </details>
    </template>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { townVisitors, villageVisitors } from '../../services/visitorApi';
import { visitUrl } from '../../services/appRoute';
import { visitorName, visitorTitle } from '../../data/liveVisitors';
import { ERA_BY_ID } from '../../data/eras';
import { t, number, locale } from '../../i18n';
const props = defineProps({
  townId: String,
  villageId: String,
  snapshot: Object,
  error: String,
  era: String,
  canFind: Boolean,
});
defineEmits(['find']);
const page = ref(1),
  result = shallowRef(null),
  busy = ref(false),
  problem = ref('');
const entries = computed(() => (page.value === 1 ? props.snapshot : result.value)?.history ?? []);
const hasNext = computed(
  () => (page.value === 1 ? props.snapshot : result.value)?.hasNext ?? false,
);
const eraName = (era) => t(ERA_BY_ID[era ?? props.era]?.label ?? ERA_BY_ID.frontier.label);
const iso = (at) => new Date(at).toISOString();
const when = (at) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
let generation = 0;
watch(
  () => props.townId || props.villageId,
  () => {
    generation++;
    page.value = 1;
    result.value = null;
    busy.value = false;
    problem.value = '';
  },
);
async function load(next) {
  const current = ++generation;
  if (next === 1) {
    page.value = 1;
    result.value = null;
    return;
  }
  busy.value = true;
  problem.value = '';
  try {
    const loaded = props.villageId
      ? await villageVisitors(props.villageId, next)
      : await townVisitors(props.townId, next);
    if (current !== generation) return;
    page.value = next;
    result.value = loaded;
  } catch {
    if (current === generation) problem.value = 'Visit history is temporarily unavailable.';
  } finally {
    if (current === generation) busy.value = false;
  }
}
onBeforeUnmount(() => {
  generation++;
});
</script>
<style scoped>
.town-guestbook {
  margin: 1.1rem 0;
  padding: 1rem;
  border: 1px solid #dacbdc;
  border-radius: 14px;
  background: #faf5fa;
  color: #48364d;
}
.town-guestbook h2 {
  margin-top: 0;
}
.town-guestbook h3 {
  font-size: 1rem;
  margin: 1.2rem 0 0.65rem;
}
.guestbook-past {
  margin-top: 1.2rem;
}
.guestbook-past summary {
  padding: 0.5rem 0;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
.guestbook-past summary:focus-visible {
  outline: 2px solid #82518b;
  outline-offset: 3px;
  border-radius: 4px;
}
.town-guestbook p {
  line-height: 1.5;
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
  padding: 0.65rem 0;
  border-bottom: 1px solid #e8dce9;
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
.guestbook-time {
  margin-left: auto;
  text-align: right;
  font-size: 0.82rem;
}
.town-guestbook nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-top: 1rem;
}
.town-guestbook button {
  font: inherit;
  padding: 0.45rem 0.65rem;
  border: 1px solid #b9a5bb;
  border-radius: 7px;
  background: #fff;
  color: inherit;
}
@media (max-width: 480px) {
  .town-guestbook {
    padding: 0.75rem;
  }
  .guestbook-now li {
    flex-wrap: wrap;
  }
  .guestbook-now li > div {
    flex: 1;
    min-width: 50%;
  }
  .guestbook-history li {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.3rem;
  }
  .guestbook-time {
    margin-left: 0;
    text-align: left;
  }
}
</style>
