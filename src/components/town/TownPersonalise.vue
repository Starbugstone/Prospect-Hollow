<template>
  <section class="town-personalise">
    <div class="personal-intro">
      <span class="town-kicker">{{ t('Make yourself at home') }}</span>
      <h2>{{ t('A town that feels like yours') }}</h2>
      <p>{{ t('Your colours, your character. Visitors see your choices too.') }}</p>
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

    <div v-else-if="section === 'colours'" class="personal-section">
      <div class="personal-building-preview">
        <svg viewBox="-180 -255 360 300" :aria-label="t('Colour preview')" role="img">
          <TownBuilding
            id="home"
            :stage="Math.max(1, town.buildings.home || 0)"
            :era="town.era"
            :era-level="town.buildingEraLevels.home || 1"
            :paint="p.paint.all"
          />
        </svg>
        <small>{{ t('Example building · these colours apply throughout your town') }}</small>
      </div>
      <label class="personal-field"
        >{{ t('Building element')
        }}<select v-model="paintGroup">
          <option v-for="group in PAINT_GROUPS" :key="group.id" :value="group.id">
            {{ t(group.label) }}
          </option>
        </select></label
      >
      <TownColourPicker
        :label="t(PAINT_GROUPS.find((g) => g.id === paintGroup).label)"
        :model-value="p.paint.all[paintGroup]"
        resettable
        @update:model-value="change({ kind: 'paint', group: paintGroup, value: $event })"
      />
      <p class="personal-note">
        {{
          t(
            'Your palette follows all buildings as they grow, including new buildings and landmark plots. Monuments keep their own colours.',
          )
        }}
      </p>
      <p class="personal-note">
        {{
          t(
            'Some elements appear as the building develops. Glass, plants and signs keep their original colours.',
          )
        }}
      </p>
    </div>

    <div v-else-if="section === 'buildings'" class="personal-section">
      <div class="personal-segments">
        <button :aria-pressed="buildingTab === 'familiar'" @click="buildingTab = 'familiar'">
          {{ t('Familiar places') }}</button
        ><button :aria-pressed="buildingTab === 'gardens'" @click="buildingTab = 'gardens'">
          {{ t('Landmark plots') }}
        </button>
      </div>
      <template v-if="buildingTab === 'familiar'">
        <label class="personal-field"
          >{{ t('Choose a building')
          }}<select v-model="choiceBuilding" @change="$emit('focus', choiceBuilding)">
            <option v-for="building in choiceBuildings" :key="building.id" :value="building.id">
              {{ t(building.name) }}
            </option>
          </select></label
        >
        <p class="personal-note">
          {{
            t(
              choiceLocked(town, choiceBuilding)
                ? 'This place is already settled. Keep its character here, or try another design in a new town.'
                : 'Choose its character before construction begins. The design stays as it grows.',
            )
          }}
        </p>
        <div class="personal-designs">
          <button
            v-for="choice in BUILDING_CHOICES[choiceBuilding]"
            :key="choice"
            :disabled="choiceLocked(town, choiceBuilding)"
            :aria-pressed="(p.choices[choiceBuilding] || 'original') === choice"
            @click="change({ kind: 'choice', id: choiceBuilding, value: choice })"
          >
            <TownDesignPreview :choice="choice" /><span>{{ t(CHOICE_LABELS[choice]) }}</span
            ><small v-if="(p.choices[choiceBuilding] || 'original') === choice">{{
              t('Selected')
            }}</small>
          </button>
        </div>
      </template>
      <template v-else>
        <p>
          {{
            t(
              'One special place in every era. Choose its character, then develop it through the ages. All landmark plots are optional.',
            )
          }}
        </p>
        <label class="personal-field"
          >{{ t('Choose a landmark plot') }}
          <select v-model="landmarkAreaId">
            <option v-for="area in PERSONAL_AREAS" :key="area.id" :value="area.id">
              {{ t(ERA_BY_ID[area.era].label) }} · {{ t(area.label) }}
            </option>
          </select>
        </label>
        <article
          v-for="area in PERSONAL_AREAS.filter((a) => a.id === landmarkAreaId)"
          :key="area.id"
          class="personal-area"
        >
          <header>
            <h3>{{ t(area.label) }}</h3>
            <span>{{ t(ERA_BY_ID[area.era].label) }}</span>
          </header>
          <p v-if="!areaUnlocked(town, area)" class="personal-note">
            {{ t('Opens in {era}', { era: t(ERA_BY_ID[area.era].label) }) }}
          </p>
          <template v-else>
            <p class="personal-note">
              {{
                t(
                  area.timeless
                    ? 'A timeless monument. Replace it for the new monument’s full price, with no refund.'
                    : 'Three stages per era, with upgrades through Riverlight. Your building choice is permanent.',
                )
              }}
            </p>
            <div class="personal-designs">
              <button
                v-for="choice in area.choices"
                :key="choice"
                :disabled="!area.timeless && !!town.personalisation?.areas?.[area.id]?.[0]"
                :aria-pressed="p.areas[area.id]?.[0] === choice"
                @click="chooseArea(area, 0, choice)"
              >
                <TownLandmarkPreview :choice="choice" />
                <span>{{ t(LANDMARK_BY_ID[choice].label) }}</span>
                <small>{{ t(LANDMARK_BY_ID[choice].detail) }}</small>
                <strong>{{
                  t('{coins} coins', { coins: LANDMARK_BY_ID[choice].price.toLocaleString() })
                }}</strong>
                <small v-if="p.areas[area.id]?.[0] === choice">{{ t('Selected') }}</small>
              </button>
            </div>
            <template v-if="!area.timeless && town.personalisation?.areas?.[area.id]?.[0]">
              <p>
                {{
                  t('Stage {stage} of {maximum}', {
                    stage: areaStage(draft, area),
                    maximum: areaMaximum(town, area),
                  })
                }}
              </p>
              <button
                v-if="upgradeFor(area)"
                class="town-primary"
                :disabled="draft.coins < upgradeFor(area).price || pendingArea(area)"
                @click="chooseArea(area, 0, town.personalisation.areas[area.id][0])"
              >
                {{
                  t('Upgrade · {coins} coins', { coins: upgradeFor(area).price.toLocaleString() })
                }}
              </button>
              <p v-else class="personal-note">{{ t('Fully developed for this era.') }}</p>
            </template>
          </template>
        </article>
      </template>
    </div>

    <div v-else class="personal-section">
      <p>
        {{
          t(
            'Give an earned distinction a place on a building. Visitors can see what your town is proud of.',
          )
        }}
      </p>
      <label class="personal-field"
        >{{ t('Choose a building')
        }}<select v-model="plaqueBuilding" @change="$emit('focus', plaqueBuilding)">
          <option v-for="building in builtBuildings" :key="building.id" :value="building.id">
            {{ t(building.name) }}
          </option>
        </select></label
      >
      <p v-if="!builtBuildings.length || !badges.length" class="personal-empty">
        {{
          t(
            'Your earned honours and player distinctions will appear here. Build a place to display them, then choose your favourite.',
          )
        }}
      </p>
      <div v-else class="personal-badges">
        <button
          :aria-pressed="!p.plaques[plaqueBuilding]"
          @click="change({ kind: 'plaque', id: plaqueBuilding, value: null })"
        >
          <GameIcon name="close" /><span>{{ t('No plaque') }}</span></button
        ><button
          v-for="badge in badges"
          :key="badge.id"
          :aria-pressed="p.plaques[plaqueBuilding] === badge.id"
          @click="change({ kind: 'plaque', id: plaqueBuilding, value: badge.id })"
        >
          <HonourBadge :definition="badge" :size="56" /><span>{{ t(badge.name) }}</span>
        </button>
      </div>
    </div>

    <div v-if="confirmAreas" class="personal-confirm" role="alert">
      <strong>{{ t('Make these places part of your town?') }}</strong>
      <p>
        {{
          t(
            'Building choices are permanent. Monuments can be replaced at full price with no refund.',
          )
        }}
      </p>
      <button class="town-primary" @click="save(true)">
        {{
          t('Confirm purchase · {coins} coins', {
            coins: (town.coins - draft.coins).toLocaleString(),
          })
        }}</button
      ><button class="town-secondary" @click="confirmAreas = false">
        {{ t('Keep choosing') }}
      </button>
    </div>
    <footer class="personal-save">
      <p v-if="error" class="personal-note" role="alert">{{ error }}</p>
      <span role="status">{{
        commands.length
          ? t('Preview · not saved yet')
          : t(saved ? 'Changes saved' : 'Make a choice to preview it')
      }}</span>
      <div>
        <button class="town-secondary" :disabled="!commands.length" @click="discard">
          {{ t('Undo changes') }}</button
        ><button class="town-primary" :disabled="!commands.length" @click="save(false)">
          {{ t('Save changes') }}
        </button>
      </div>
    </footer>
  </section>
</template>
<script setup>
import TownLandmarkPreview from './TownLandmarkPreview.vue';
import { LANDMARK_BY_ID, landmarkOffer, areaMaximum } from '../../data/townLandmarks';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../../i18n';
import { BUILDINGS } from '../../data/town';
import { ERA_BY_ID } from '../../data/eras';
import { HONOURS } from '../../data/honours';
import { distinctionBadge } from '../../data/playerDistinctions';
import { CREST_EMBLEMS, CREST_EMBLEM_IDS } from '../../data/townCrests';
import {
  BUILDING_CHOICES,
  CHOICE_LABELS,
  DEFAULT_EMBLEM_COLOUR,
  CREST_PATTERNS,
  CREST_SHAPES,
  PAINT_GROUPS,
  PERSONAL_AREAS,
  areaStage,
  areaUnlocked,
  choiceLocked,
  normalizePersonalisation,
  personaliseTown,
} from '../../data/townPersonalisation';
import { plotUnlocked } from '../../game/town/TownRules';
import GameIcon from '../GameIcon.vue';
import HonourBadge from '../honours/HonourBadge.vue';
import TownBuilding from './TownBuilding.vue';
import TownCrest from './TownCrest.vue';
import TownColourPicker from './TownColourPicker.vue';
import TownDesignPreview from './TownDesignPreview.vue';

const props = defineProps({
  town: { type: Object, required: true },
  honours: { type: Object, required: true },
  received: { type: Object, default: () => ({}) },
  initialBuilding: String,
  commit: { type: Function, required: true },
});
const emit = defineEmits(['preview', 'focus']);
const sections = [
  { id: 'crest', label: 'Crest', icon: 'spark' },
  { id: 'colours', label: 'Colours', icon: 'color-wand' },
  { id: 'buildings', label: 'Buildings', icon: 'home' },
  { id: 'distinctions', label: 'Distinctions', icon: 'star' },
];
const section = ref(
  props.initialBuilding
    ? BUILDING_CHOICES[props.initialBuilding] && !choiceLocked(props.town, props.initialBuilding)
      ? 'buildings'
      : 'colours'
    : 'crest',
);
const commands = ref([]),
  saved = ref(false),
  confirmAreas = ref(false);
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
const p = computed(() =>
  normalizePersonalisation(draft.value.personalisation, draft.value, CREST_EMBLEM_IDS),
);
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
const availableBuildings = computed(() => [
  ...BUILDINGS.filter((b) => plotUnlocked(props.town, b.id)),
  ...PERSONAL_AREAS.filter((a) => !a.timeless && areaUnlocked(props.town, a)).map((a) => ({
    id: a.id,
    name: a.label,
  })),
]);
const builtBuildings = computed(() =>
  availableBuildings.value.filter(
    (b) => props.town.buildings[b.id] > 0 || props.town.personalisation?.areas?.[b.id]?.[0],
  ),
);
const choiceBuildings = computed(() =>
  availableBuildings.value.filter((b) => BUILDING_CHOICES[b.id]),
);
const choiceBuilding = ref(
  BUILDING_CHOICES[props.initialBuilding]
    ? props.initialBuilding
    : choiceBuildings.value[0]?.id || 'home',
);
const plaqueBuilding = ref(builtBuildings.value[0]?.id || 'well');
const paintGroup = ref('walls'),
  buildingTab = ref(props.initialBuilding ? 'familiar' : 'gardens');
const landmarkAreaId = ref(
  PERSONAL_AREAS.filter((a) => areaUnlocked(props.town, a)).at(-1)?.id || PERSONAL_AREAS[0].id,
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
      (c) =>
        !(
          c.kind === command.kind &&
          c.id === command.id &&
          c.group === command.group &&
          c.slot === command.slot
        ),
    ),
    command,
  ];
  saved.value = false;
  confirmAreas.value = false;
  emit('preview', commands.value);
}
function changeCrest(patch) {
  change({ kind: 'crest', value: { ...crest.value, ...patch } });
}
watch(section, async () => {
  await nextTick();
  document.querySelector('.town-dialog')?.scrollTo({ top: 0 });
});
watch(confirmAreas, async (value) => {
  if (value) {
    await nextTick();
    document
      .querySelector('.personal-confirm')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
});
const error = ref('');
const pendingArea = (area) => commands.value.some((c) => c.kind === 'area' && c.id === area.id);
const upgradeFor = (area) =>
  landmarkOffer(props.town, area, props.town.personalisation?.areas?.[area.id]?.[0]);
function chooseArea(area, slot, value) {
  // A preview can be changed until Save settles the plot.
  commands.value = commands.value.filter(
    (c) => !(c.kind === 'area' && c.id === area.id && c.slot === slot),
  );
  const offer = landmarkOffer(draft.value, area, value);
  if (!offer) {
    emit('preview', commands.value);
    return;
  }
  if (draft.value.coins < offer.price) {
    error.value = t('You need {coins} more coins.', {
      coins: (offer.price - draft.value.coins).toLocaleString(),
    });
    emit('preview', commands.value);
    return;
  }
  error.value = '';
  change({
    kind: 'area',
    id: area.id,
    slot,
    value,
    expectedChoice: offer.expectedChoice,
    expectedLevel: offer.expectedLevel,
  });
  nextTick(() => emit('focus', area.id));
}
function discard() {
  commands.value = [];
  error.value = '';
  confirmAreas.value = false;
  saved.value = false;
  emit('preview', []);
}
function save(confirmed) {
  if (!confirmed && commands.value.some((c) => c.kind === 'area')) {
    confirmAreas.value = true;
    return;
  }
  if (props.commit(commands.value)) {
    discard();
    saved.value = true;
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
  grid-template-columns: repeat(4, 1fr);
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
.personal-two-fields label,
.personal-field {
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
.personal-designs button,
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
.personal-designs button[aria-pressed='true'],
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
.personal-building-preview {
  text-align: center;
  border-radius: 15px;
  padding: 14px;
  background: #e9ecdc;
}
.personal-building-preview > svg {
  width: 100%;
  max-height: 210px;
}
.personal-building-preview small {
  display: block;
  font-size: 11px;
  color: #657365;
}
.personal-designs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 15px;
}
.personal-designs button {
  justify-content: start;
  font-size: 12px;
  padding: 7px;
}
.personal-designs button:disabled {
  cursor: default;
  opacity: 0.6;
}
.personal-designs button:disabled[aria-pressed='true'] {
  opacity: 1;
}
.personal-designs small {
  color: #365943;
  font-weight: 700;
}
.personal-design-art {
  width: 100%;
  max-height: 100px;
}
.personal-area {
  padding: 16px;
  border: 1px solid #d4d6c3;
  border-radius: 14px;
}
.personal-area header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
}
.personal-area header span {
  font-size: 11px;
}
.personal-area h4 {
  font-size: 12px;
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
.personal-confirm {
  background: #f3e7c7;
  border: 1px solid #c8b789;
  border-radius: 12px;
  padding: 18px;
  margin-top: 20px;
}
.personal-confirm button {
  margin: 5px;
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
