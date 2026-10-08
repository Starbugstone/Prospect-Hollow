<template>
  <section class="town-monument" aria-labelledby="monument-title">
    <div class="town-detail-title">
      <div>
        <p class="town-kicker">{{ t('Monument site') }} · {{ t(era.label) }}</p>
        <h2 id="monument-title">{{ t(built ? LANDMARK_BY_ID[built].label : area.label) }}</h2>
      </div>
      <span class="town-level-badge">{{ badge }}</span>
    </div>

    <p v-if="!unlocked" class="monument-note">
      <TownIcon name="lock" />{{
        t('This site opens in {era}. Monuments are optional and never block progress.', {
          era: t(era.label),
        })
      }}
    </p>

    <template v-else-if="built">
      <figure class="monument-hero">
        <TownLandmarkPreview :choice="built" :stage="stage" :paint="paint" />
        <figcaption>
          <strong>{{ t(LANDMARK_BY_ID[built].label) }}</strong>
          <span>{{ t(LANDMARK_BY_ID[built].detail) }}</span>
        </figcaption>
      </figure>
      <p v-if="justBuilt" class="monument-celebration" role="status">
        <TownIcon name="spark" />{{
          t('The {monument} now stands in {site}.', {
            monument: t(LANDMARK_BY_ID[built].label),
            site: t(area.label),
          })
        }}
      </p>
      <p class="monument-note">
        <TownIcon name="lock" />{{
          t(
            area.timeless
              ? 'Your town’s timeless centerpiece, alive from the moment it is built.'
              : 'Five lasting levels. Grand architecture, with moving parts from level three.',
          )
        }}
      </p>
      <ol v-if="!area.timeless" class="monument-milestones" :aria-label="t('Monument levels')">
        <li
          v-for="(milestone, index) in LANDMARK_PROGRESSION.levels"
          :key="milestone.label"
          :class="{ 'is-complete': stage > index }"
        >
          <strong>{{ index + 1 }} · {{ t(milestone.label) }}</strong>
          <span>{{ t(milestone.detail) }}</span>
        </li>
      </ol>
      <div v-if="!readOnly && !area.timeless" class="town-detail-offer">
        <h3>
          {{ t('Stage {stage} of {maximum}', { stage, maximum }) }}
        </h3>
        <progress
          class="monument-progress"
          :value="stage"
          :max="maximum"
          :aria-label="t('Monument stage')"
        />
        <button
          v-if="upgrade"
          class="town-primary town-purchase"
          :disabled="town.coins < upgrade.price"
          @click="buy(upgrade)"
        >
          <span
            ><TownIcon name="monument" />{{
              t('Grow to stage {stage}', { stage: upgrade.level })
            }}</span
          >
          <span><TownIcon name="coin" />{{ number(upgrade.price) }}</span>
        </button>
        <p class="town-purchase-hint">
          {{
            !upgrade
              ? t('A completed town wonder. Future eras keep all five levels.')
              : town.coins < upgrade.price
                ? t('You need {coins} more coins.', { coins: number(upgrade.price - town.coins) })
                : t(landmarkLevel(upgrade.level).detail)
          }}
        </p>
      </div>
    </template>

    <template v-else>
      <p class="monument-intro">
        {{
          t(
            'Choose one monument for this site. It is optional and never needed to reach the next era.',
          )
        }}
      </p>
      <div class="monument-choices" role="radiogroup" :aria-label="t('Monument designs')">
        <button
          v-for="choice in area.choices"
          :key="choice"
          role="radio"
          :aria-checked="picked === choice"
          @click="pick(choice)"
        >
          <TownLandmarkPreview :choice="choice" :paint="paint" />
          <span class="monument-choice-text">
            <strong>{{ t(LANDMARK_BY_ID[choice].label) }}</strong>
            <small>{{ t(LANDMARK_BY_ID[choice].detail) }}</small>
          </span>
          <span
            class="monument-price"
            :class="{ 'is-short': town.coins < LANDMARK_BY_ID[choice].price }"
          >
            <TownIcon name="coin" />{{ number(LANDMARK_BY_ID[choice].price) }}
          </span>
        </button>
      </div>
      <div v-if="!readOnly" class="monument-build">
        <div
          v-if="confirming && offer"
          class="monument-confirm"
          role="group"
          :aria-label="t('Confirm monument')"
        >
          <strong>
            <TownIcon name="lock" />{{
              t('Build the {monument} for good?', { monument: t(LANDMARK_BY_ID[picked].label) })
            }}
          </strong>
          <p>
            {{
              t(
                'Monuments are permanent. Once it is built, this site keeps the {monument} and the other designs stay unbuilt here.',
                { monument: t(LANDMARK_BY_ID[picked].label) },
              )
            }}
          </p>
          <button ref="confirmButton" class="town-primary town-purchase" @click="buy(offer)">
            <span><TownIcon name="monument" />{{ t('Build it') }}</span>
            <span><TownIcon name="coin" />{{ number(offer.price) }}</span>
          </button>
          <button class="town-secondary" @click="confirming = false">
            {{ t('Keep looking') }}
          </button>
        </div>
        <template v-else>
          <button
            class="town-primary town-purchase"
            :disabled="!offer || town.coins < offer.price"
            @click="confirm"
          >
            <span
              ><TownIcon name="monument" />{{
                picked
                  ? t('Build the {monument}', { monument: t(LANDMARK_BY_ID[picked].label) })
                  : t('Choose a design')
              }}</span
            >
            <span v-if="offer"><TownIcon name="coin" />{{ number(offer.price) }}</span>
          </button>
          <p class="town-purchase-hint">
            {{
              !picked
                ? t('Tap a design to preview it in your town.')
                : town.coins < offer.price
                  ? t('You need {coins} more coins. The site will wait for you.', {
                      coins: number(offer.price - town.coins),
                    })
                  : t('Previewing in your town. Nothing is spent until you confirm.')
            }}
          </p>
        </template>
      </div>
    </template>
    <p v-if="error" class="monument-error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t, number } from '../../i18n';
import { ERA_BY_ID } from '../../data/eras';
import {
  AREA_BY_ID,
  LANDMARK_BY_ID,
  LANDMARK_PROGRESSION,
  areaChoice,
  areaMaximum,
  areaStage,
  areaUnlocked,
  landmarkOffer,
  landmarkLevel,
} from '../../data/townLandmarks';
import TownIcon from './TownIcon.vue';
import TownLandmarkPreview from './TownLandmarkPreview.vue';

const props = defineProps({
  id: { type: String, required: true },
  town: { type: Object, required: true },
  readOnly: Boolean,
  // Commits one landmark purchase command; returns whether the town accepted it.
  commit: Function,
});
// `preview` names the design shown on the open site, or null.
const emit = defineEmits(['preview']);
const area = computed(() => AREA_BY_ID[props.id]);
const era = computed(() => ERA_BY_ID[area.value.era]);
const unlocked = computed(() => areaUnlocked(props.town, area.value));
const built = computed(() => areaChoice(props.town, area.value));
const stage = computed(() => areaStage(props.town, area.value));
// A timeless centerpiece keeps its own colours; other monuments wear the town's paint.
const paint = computed(() =>
  area.value.timeless ? {} : (props.town.personalisation?.paint?.all ?? {}),
);
const maximum = computed(() => areaMaximum(props.town, area.value));
const upgrade = computed(() =>
  built.value ? landmarkOffer(props.town, area.value, built.value) : null,
);
const badge = computed(() =>
  !unlocked.value
    ? t('Opens in {era}', { era: t(era.value.label) })
    : !built.value
      ? t('Open site · optional')
      : area.value.timeless
        ? t('Monument')
        : t('Stage {stage} of {maximum}', {
            stage: stage.value,
            maximum: maximum.value,
          }),
);

const picked = ref(null),
  confirming = ref(false),
  justBuilt = ref(false),
  error = ref(''),
  confirmButton = ref(null);
const offer = computed(() =>
  picked.value && !built.value ? landmarkOffer(props.town, area.value, picked.value) : null,
);
function pick(choice) {
  picked.value = choice;
  confirming.value = false;
  error.value = '';
}
async function confirm() {
  confirming.value = true;
  await nextTick();
  confirmButton.value?.focus();
}
function buy(purchase) {
  if (props.readOnly || !purchase) return;
  const accepted = props.commit?.({
    kind: 'area',
    id: area.value.id,
    slot: 0,
    value: purchase.choice,
    expectedChoice: purchase.expectedChoice,
    expectedLevel: purchase.expectedLevel,
  });
  if (!accepted) {
    error.value = t('Your town changed. Check your coins and try again.');
    return;
  }
  error.value = '';
  confirming.value = false;
  justBuilt.value = !purchase.expectedChoice;
  picked.value = null;
}
// The chosen design stands on the open site in the town until it is built or dropped.
watch(
  () => (built.value || props.readOnly ? null : picked.value),
  (choice) => emit('preview', choice),
);
onBeforeUnmount(() => emit('preview', null));
</script>
<style>
.town-monument {
  display: grid;
  gap: 14px;
  color: #344c40;
}
.town-monument .town-detail-title {
  margin-bottom: 0;
}
.monument-intro,
.monument-note {
  margin: 0;
  color: #5f6d5f;
  font-size: 13px;
  line-height: 1.5;
}
.monument-note {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 11px 13px;
  border-radius: 10px;
  background: #f1ecdc;
}
.monument-note svg,
.monument-celebration svg,
.monument-confirm strong svg {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  color: #8a6427;
}
.monument-hero {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(120px, 190px) 1fr;
  gap: 16px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, #eef0e1, #f6eedb);
}
.monument-hero svg {
  width: 100%;
  display: block;
}
.monument-hero figcaption {
  display: grid;
  gap: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: #5f6d5f;
}
.monument-hero strong {
  font:
    700 17px/1.2 Georgia,
    serif;
  color: #344c40;
}
.monument-celebration {
  display: flex;
  gap: 9px;
  align-items: center;
  margin: 0;
  padding: 11px 13px;
  border-radius: 10px;
  background: #f7e6b8;
  color: #4c3d1c;
  font-weight: 600;
  font-size: 13px;
}
.monument-milestones {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.monument-milestones li {
  display: grid;
  gap: 3px;
  border-left: 3px solid #d6d3bd;
  padding: 5px 10px;
  font-size: 12px;
  color: #657365;
}
.monument-milestones li.is-complete {
  border-color: #9f7938;
  color: #344c40;
}
.monument-progress {
  width: 100%;
  accent-color: #8a6427;
}
.monument-choices {
  display: grid;
  gap: 10px;
}
.monument-choices > button {
  display: grid;
  grid-template-columns: 112px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 8px 12px 8px 8px;
  border: 1px solid #d4d6c3;
  border-radius: 13px;
  background: #fffdf6;
  color: #344c40;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.monument-choices > button:hover {
  border-color: #b9a77a;
}
.monument-choices > button[aria-checked='true'] {
  border-color: #8a6427;
  box-shadow: inset 0 0 0 2px #8a6427;
  background: #fbf2da;
}
.monument-choices svg.personal-design-art {
  width: 112px;
  height: auto;
  max-height: none;
}
.monument-choice-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.monument-choice-text strong {
  font:
    700 15px/1.25 Georgia,
    serif;
}
.monument-choice-text small {
  font-size: 12px;
  line-height: 1.45;
  color: #657365;
}
.monument-price {
  display: flex;
  gap: 4px;
  align-items: center;
  font-weight: 800;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.monument-price svg {
  width: 16px;
  height: 16px;
}
.monument-price.is-short {
  color: #9a6a3a;
}
.monument-build {
  position: sticky;
  bottom: 0;
  padding: 10px 0 2px;
  background: #fbf8eb;
}
.monument-confirm {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid #c8b789;
  border-radius: 12px;
  background: #f6ebcd;
}
.monument-confirm strong {
  display: flex;
  gap: 8px;
  align-items: center;
  font:
    700 15px/1.3 Georgia,
    serif;
}
.monument-confirm p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #5b5236;
}
.town-monument .town-purchase > span:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
}
.monument-error {
  margin: 0;
  color: #9a3d2a;
  font-size: 13px;
}
@media (max-width: 420px) {
  .monument-choices > button {
    grid-template-columns: 84px 1fr;
  }
  .monument-choices svg.personal-design-art {
    width: 84px;
  }
  .monument-price {
    grid-column: 2;
  }
  .monument-hero {
    grid-template-columns: 110px 1fr;
  }
}
</style>
