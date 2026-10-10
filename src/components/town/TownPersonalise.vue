<template>
  <section class="town-personalise">
    <div class="personal-intro">
      <span class="town-kicker">{{ t('Make yourself at home') }}</span>
      <h2>{{ t('A town that feels like yours') }}</h2>
      <p>{{ t('Your crest, your achievements.') }}</p>
    </div>
    <nav class="personal-sections" :aria-label="t('Personalisation sections')">
      <button
        v-for="item in sections"
        :key="item.id"
        :aria-pressed="section === item.id"
        @click="section = item.id"
      >
        <GameIcon :name="item.icon" /><span>{{ t(item.label) }}</span>
      </button>
    </nav>

    <div v-if="section === 'crest'" class="personal-section">
      <div class="personal-floating-crest" aria-hidden="true">
        <TownCrest v-show="showFloatingCrest" :crest="crest" />
      </div>
      <div ref="crestHero" class="personal-hero">
        <TownCrest :crest="crest" />
        <div>
          <h3>{{ t('Your town crest') }}</h3>
          <p>{{ t('Fly your colours on the mine hill.') }}</p>
          <button v-if="!p.crest" class="town-primary" @click="changeCrest({})">
            {{ t('Raise this banner') }}</button
          ><button
            v-else
            class="personal-text-button"
            @click="change({ kind: 'crest', value: null })"
          >
            {{ t('Remove banner') }}
          </button>
        </div>
      </div>
      <div class="personal-two-fields">
        <label
          >{{ t('Banner shape')
          }}<select :value="crest.shape" @change="changeCrest({ shape: $event.target.value })">
            <option v-for="shape in CREST_SHAPES" :key="shape" :value="shape">
              {{ t(shapeLabels[shape]) }}
            </option>
          </select></label
        >
        <label
          >{{ t('Banner pattern')
          }}<select :value="crest.pattern" @change="changeCrest({ pattern: $event.target.value })">
            <option v-for="pattern in CREST_PATTERNS" :key="pattern" :value="pattern">
              {{ t(patternLabels[pattern]) }}
            </option>
          </select></label
        >
      </div>
      <div class="personal-filter">
        <div class="personal-segments">
          <button
            v-for="category in ['All', 'Animals', 'Symbols']"
            :key="category"
            :aria-pressed="emblemCategory === category"
            @click="emblemCategory = category"
          >
            {{ t(category) }}
          </button>
        </div>
        <input
          v-model="search"
          type="search"
          :aria-label="t('Find an emblem')"
          :placeholder="t('Find an emblem')"
        />
      </div>
      <div class="personal-emblems" :aria-label="t('Emblems')">
        <button
          v-for="emblem in emblems"
          :key="emblem.id"
          :aria-pressed="crest.emblem === emblem.id"
          @click="changeCrest({ emblem: emblem.id })"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="emblem.path" /></svg
          ><span>{{ t(emblem.label) }}</span>
        </button>
      </div>
      <p v-if="!emblems.length">{{ t('No matching emblems. Try another name.') }}</p>
      <div class="personal-segments personal-colour-tabs">
        <button :aria-pressed="crestColour === 'primary'" @click="crestColour = 'primary'">
          {{ t('Main colour') }}</button
        ><button :aria-pressed="crestColour === 'secondary'" @click="crestColour = 'secondary'">
          {{ t('Pattern colour') }}
        </button>
        <button
          :aria-pressed="crestColour === 'emblemColour'"
          @click="crestColour = 'emblemColour'"
        >
          {{ t('Emblem colour') }}
        </button>
      </div>
      <TownColourPicker
        :label="t(crestColourLabels[crestColour])"
        :model-value="crest[crestColour]"
        @update:model-value="changeCrest({ [crestColour]: $event })"
      />
    </div>

    <div v-else class="personal-section">
      <p>
        {{ t('Display your favourite earned distinction on the mine face above the mineshaft.') }}
      </p>
      <p v-if="!badges.length" class="personal-empty">
        {{
          t(
            'Your earned honours and player distinctions will appear here. Choose your favourite for the mine.',
          )
        }}
      </p>
      <div v-else class="personal-badges">
        <button
          :aria-pressed="!p.plaques.mine"
          @click="change({ kind: 'plaque', id: 'mine', value: null })"
        >
          <GameIcon name="close" /><span>{{ t('No plaque') }}</span></button
        ><button
          v-for="badge in badges"
          :key="badge.id"
          :aria-pressed="p.plaques.mine === badge.id"
          @click="change({ kind: 'plaque', id: 'mine', value: badge.id })"
        >
          <HonourBadge :definition="badge" :size="56" /><span>{{ t(badge.name) }}</span>
        </button>
      </div>
    </div>

    <footer class="personal-save">
      <p v-if="error" class="personal-note" role="alert">{{ error }}</p>
      <span role="status">{{
        commands.length ? t('Preview · not saved yet') : t('Make a choice to preview it')
      }}</span>
      <div>
        <button class="town-secondary" :disabled="!commands.length" @click="discard">
          {{ t('Undo changes') }}</button
        ><button class="town-primary" :disabled="!commands.length" @click="save">
          {{ t('Save changes') }}
        </button>
      </div>
    </footer>
  </section>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../../i18n';
import { HONOURS } from '../../data/honours';
import { distinctionBadge } from '../../data/playerDistinctions';
import { CREST_EMBLEMS, CREST_EMBLEM_IDS } from '../../data/townCrests';
import {
  DEFAULT_EMBLEM_COLOUR,
  CREST_PATTERNS,
  CREST_SHAPES,
  normalizePersonalisation,
  personaliseTown,
} from '../../data/townPersonalisation';
import GameIcon from '../GameIcon.vue';
import HonourBadge from '../honours/HonourBadge.vue';
import TownCrest from './TownCrest.vue';
import TownColourPicker from './TownColourPicker.vue';

const props = defineProps({
  town: { type: Object, required: true },
  honours: { type: Object, required: true },
  received: { type: Object, default: () => ({}) },
  commit: { type: Function, required: true },
});
const emit = defineEmits(['preview', 'focus', 'saved']);
const sections = [
  { id: 'crest', label: 'Crest', icon: 'spark' },
  { id: 'distinctions', label: 'Distinctions', icon: 'star' },
];
const section = ref('crest');
const commands = ref([]);
const earned = computed(() => [
  ...Object.keys(props.honours.earned),
  ...Object.keys(props.received),
]);
const draft = computed(() =>
  commands.value.reduce(
    (town, command) => personaliseTown(town, command, CREST_EMBLEM_IDS, earned.value) ?? town,
    props.town,
  ),
);
const p = computed(() => normalizePersonalisation(draft.value.personalisation, CREST_EMBLEM_IDS));
const crest = computed(
  () =>
    p.value.crest ?? {
      shape: 'shield',
      pattern: 'split',
      emblem: 'fox',
      primary: '#367673',
      secondary: '#e8bf79',
      emblemColour: DEFAULT_EMBLEM_COLOUR,
    },
);
const shapeLabels = {
  shield: 'Shield',
  swallowtail: 'Swallowtail',
  pennant: 'Pennant',
  square: 'Rectangle',
};
const patternLabels = {
  plain: 'Plain',
  split: 'Split',
  diagonal: 'Diagonal',
  quartered: 'Quartered',
  stripes: 'Stripes',
  cross: 'Cross',
};
const crestColourLabels = {
  primary: 'Main colour',
  secondary: 'Pattern colour',
  emblemColour: 'Emblem colour',
};
const emblemCategory = ref('All'),
  search = ref(''),
  crestColour = ref('primary');
const emblems = computed(() =>
  CREST_EMBLEMS.filter(
    (item) =>
      (emblemCategory.value === 'All' || item.category === emblemCategory.value) &&
      t(item.label).toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
  ),
);
const badges = computed(() => [
  ...HONOURS.families.flatMap((family) =>
    family.ranks.filter((rank) => props.honours.earned[rank.id]).slice(-1),
  ),
  ...Object.entries(props.received)
    .map(([id, entry]) => distinctionBadge(id, entry))
    .filter(Boolean),
]);
function change(command) {
  if (!personaliseTown(draft.value, command, CREST_EMBLEM_IDS, earned.value)) return;
  // Keep only the latest edit for an element; a colour drag never creates hundreds of commands.
  commands.value = [
    ...commands.value.filter(
      (c) => !(c.kind === command.kind && c.id === command.id && c.slot === command.slot),
    ),
    command,
  ];
  emit('preview', commands.value);
}
function changeCrest(patch) {
  change({ kind: 'crest', value: { ...crest.value, ...patch } });
}
watch(section, async (value) => {
  if (value === 'distinctions') emit('focus', 'mine');
  await nextTick();
  document.querySelector('.town-dialog')?.scrollTo({ top: 0 });
});
const error = ref('');
function discard() {
  commands.value = [];
  error.value = '';
  emit('preview', []);
}
function save() {
  if (props.commit(commands.value)) {
    discard();
    emit('saved');
  } else error.value = t('Your town changed. Undo the preview and try again.');
}
const crestHero = ref(null);
const showFloatingCrest = ref(false);
let crestObserver;
watch(
  crestHero,
  (hero) => {
    crestObserver?.disconnect();
    showFloatingCrest.value = false;
    if (!hero) return;
    crestObserver = new IntersectionObserver(
      ([entry]) => {
        showFloatingCrest.value =
          !entry.isIntersecting && entry.boundingClientRect.top < entry.rootBounds.top;
      },
      { root: hero.closest('.town-dialog'), rootMargin: '-61px 0px 0px 0px' },
    );
    crestObserver.observe(hero);
  },
  { flush: 'post' },
);
onBeforeUnmount(() => {
  crestObserver?.disconnect();
  emit('preview', []);
});
</script>
<style>
.town-personalise {
  color: #344c40;
}
.personal-intro h2 {
  margin: 5px 0 8px;
  font:
    700 25px/1.15 Georgia,
    serif;
}
.personal-intro p,
.personal-note {
  color: #657365;
  font-size: 13px;
  line-height: 1.5;
}
.personal-sections {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
  padding: 6px;
  margin: 20px 0;
  background: #eaeadd;
  border-radius: 15px;
}
.personal-sections button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 5px;
  font-size: 12px;
  border: 0;
  background: transparent;
  color: #506354;
  border-radius: 10px;
  cursor: pointer;
}
.personal-sections button[aria-pressed='true'] {
  background: #fffdf4;
  color: #294c3b;
  box-shadow: 0 2px 6px #3a473218;
  font-weight: 700;
}
.personal-section {
  display: grid;
  gap: 16px;
}
.personal-section h3,
.personal-section h4 {
  margin: 0 0 8px;
}
.personal-floating-crest {
  position: sticky;
  top: 72px;
  z-index: 1;
  height: 0;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}
.personal-floating-crest > svg {
  flex-shrink: 0;
  width: 58px;
  height: 70px;
  padding: 8px;
  border: 1px solid #dbd2bb;
  border-radius: 12px;
  background: #fffdf4;
  box-shadow: 0 4px 16px #253b3433;
}
.personal-hero {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px 20px;
  border-radius: 16px;
  background: linear-gradient(130deg, #e3e9d8, #f6edd9);
}
.personal-hero > svg {
  width: 80px;
  height: 96px;
  flex-shrink: 0;
  filter: drop-shadow(0 5px 3px #5d68472b);
}
.personal-hero p {
  font-size: 13px;
}
.personal-two-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.personal-two-fields label {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
}
.town-personalise select,
.town-personalise input[type='search'] {
  width: 100%;
  min-height: 44px;
  border: 1px solid #c8cdb9;
  border-radius: 9px;
  background: #fffdf7;
  padding: 9px;
  color: #344c40;
  font: inherit;
}
.personal-filter {
  display: grid;
  gap: 10px;
}
.personal-segments {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.personal-segments button {
  border: 1px solid #c4cbb7;
  border-radius: 22px;
  min-height: 40px;
  padding: 8px 17px;
  color: #506354;
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.personal-segments button[aria-pressed='true'] {
  color: #fffdf4;
  background: #4f6b5a;
  border-color: #4f6b5a;
}
.personal-emblems {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
  max-height: 310px;
  overflow-y: auto;
  padding: 3px;
}
.personal-emblems button,
.personal-badges button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid #d4d6c3;
  border-radius: 12px;
  background: #fffdf6;
  color: #506354;
  padding: 12px 4px;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  text-align: center;
}
.personal-emblems button[aria-pressed='true'],
.personal-badges button[aria-pressed='true'] {
  border-color: #496c51;
  box-shadow: inset 0 0 0 2px #496c51;
  background: #e8efdd;
}
.personal-emblems svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.personal-colours {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.personal-colours legend {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
}
.personal-swatches {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 5px;
}
.personal-swatches button {
  aspect-ratio: 1;
  min-width: 0;
  border: 1px solid #0002;
  border-radius: 7px;
  background: var(--swatch);
  padding: 0;
  cursor: pointer;
}
.personal-swatches button[aria-pressed='true'] {
  outline: 2px solid #334e3e;
  outline-offset: 2px;
}
.personal-swatches span {
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: #244632;
  width: 18px;
  height: 18px;
  font-size: 12px;
}
.personal-custom-colour {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 15px;
}
.personal-custom-colour label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.personal-custom-colour input {
  width: 48px;
  height: 38px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.personal-text-button {
  border: 0;
  background: transparent;
  color: #48644d;
  text-decoration: underline;
  padding: 8px 0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.personal-badges {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}
.personal-empty {
  padding: 24px;
  background: #e9ecdc;
  border-radius: 14px;
  line-height: 1.6;
}
.personal-save {
  position: sticky;
  bottom: 0;
  margin: 24px -4px -4px;
  padding: 13px 4px 7px;
  background: #fbf8eb;
  border-top: 1px solid #d4d6c3;
  z-index: 2;
}
.personal-save > span {
  display: block;
  font-size: 12px;
  color: #657365;
  margin-bottom: 10px;
}
.personal-save > div {
  display: flex;
  gap: 10px;
}
.personal-save button {
  flex: 1;
}
.town-personalise button:focus-visible,
.town-personalise input:focus-visible,
.town-personalise select:focus-visible {
  outline: 3px solid #8d6138;
  outline-offset: 3px;
}
@media (max-width: 420px) {
  .personal-emblems {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .personal-swatches {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .personal-sections button {
    flex-direction: column;
    gap: 5px;
    font-size: 11px;
  }
  .personal-hero {
    gap: 15px;
    padding: 14px;
  }
  .personal-hero > svg {
    width: 80px;
    height: 96px;
  }
  .personal-intro h2 {
    font-size: 23px;
  }
}
</style>
