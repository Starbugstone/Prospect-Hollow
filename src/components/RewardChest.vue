<template>
  <section
    class="arcade-chest"
    :class="[reward.source, reward.id, phase]"
    :aria-label="t('Chest opening')"
  >
    <div class="chest-backdrop" aria-hidden="true">
      <div class="prize-rays"></div>
      <div class="prize-grid"></div>
      <div class="prize-orbit"></div>
      <i
        v-for="i in 32"
        :key="i"
        class="prize-spark"
        :style="{
          '--i': i,
          '--x': `${(i * 37) % 100}%`,
          '--y': `${(i * 61) % 100}%`,
          '--turn': `${i * 137}deg`,
          '--dx': `${50 - ((i * 37) % 100)}vw`,
          '--dy': `${50 - ((i * 61) % 100)}dvh`,
        }"
        >✦</i
      >
      <div v-if="phase === 'opening' || phase === 'opened'" class="prize-burst" :key="phase"></div>
    </div>
    <header class="chest-topbar">
      <span class="arcade-kicker"> {{ t('LEVEL CLEAR') }} <b>✦</b> {{ t('BONUS ROUND') }} </span>
      <button class="arcade-skip" @click="$emit('skip')">
        {{ t('Skip to results') }} <span>↗</span>
      </button>
    </header>
    <div class="chest-stage">
      <div class="chest-announcement">
        <span class="chest-counter">
          {{ t('CHEST') }} {{ chestIndex + 1 }} / {{ totalChests }} · {{ t(reward.label) }}</span
        >
        <h2>
          {{
            t(
              phase === 'opened'
                ? 'JACKPOT!'
                : reward.source === 'speed'
                  ? 'A LITTLE EXTRA!'
                  : reward.source === 'completion'
                    ? 'YOU DID IT!'
                    : 'HIGH SCORE!',
            )
          }}
        </h2>
        <p>
          {{
            t(
              reward.source === 'speed'
                ? 'A quick puzzle and an extra surprise.'
                : reward.source === 'completion'
                  ? 'Every finished puzzle deserves a little treasure.'
                  : 'You crushed the target. Here’s your score chest.',
            )
          }}
        </p>
      </div>
      <div v-if="phase === 'closed' || phase === 'charging'" class="chest-center">
        <div class="chest-halo"></div>
        <button
          class="chest-trigger"
          :aria-label="t('Open {value0} chest', { value0: t(reward.source) })"
          :disabled="phase !== 'closed'"
          autofocus
          @click="open"
        >
          <svg class="arcade-chest-art" viewBox="0 0 320 260" fill="none" aria-hidden="true">
            <defs>
              <linearGradient
                id="chest-body"
                x1="50"
                y1="90"
                x2="260"
                y2="240"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#954ad6" />
                <stop offset="1" stop-color="#361261" />
              </linearGradient>
              <linearGradient
                id="chest-gold"
                x1="80"
                y1="70"
                x2="200"
                y2="240"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#fff6b2" />
                <stop offset=".45" stop-color="#ffc956" />
                <stop offset="1" stop-color="#ce741e" />
              </linearGradient>
            </defs>
            <ellipse cx="160" cy="233" rx="116" ry="17" fill="#140727" opacity=".55" />
            <path
              d="M47 131H273V212L255 231H65L47 212Z"
              fill="url(#chest-body)"
              stroke="#ffdf79"
              stroke-width="5"
            />
            <path d="M47 131H273V153H47Z" fill="#260738" />
            <path d="M70 145H91V228H70ZM229 145H250V228H229Z" fill="url(#chest-gold)" />
            <path d="M49 204L66 219H254L272 204V216L257 234H64L47 216Z" fill="url(#chest-gold)" />
            <g class="treasure-lid">
              <path
                d="M47 128V103Q47 48 98 48H222Q273 48 273 103V128Z"
                fill="url(#chest-body)"
                stroke="#ffdf79"
                stroke-width="5"
              />
              <path
                d="M72 125V97Q72 62 99 52M248 125V97Q248 62 221 52"
                stroke="url(#chest-gold)"
                stroke-width="20"
              />
              <path d="M46 124H274V142H46Z" fill="url(#chest-gold)" />
              <path
                d="M145 54H176L186 69L160 106L134 69Z"
                fill="#fa82ef"
                stroke="#ffdd8e"
                stroke-width="3"
              />
              <path d="M160 55L151 70L160 97L169 70Z" fill="#fff1ff" />
            </g>
            <path
              d="M139 128H181V169L160 187L139 169Z"
              fill="url(#chest-gold)"
              stroke="#fff1b1"
              stroke-width="3"
            />
            <path d="M160 139L173 157L160 176L147 157Z" fill="#b25bff" />
            <path d="M160 144V168" stroke="#fff3ff" stroke-width="3" />
            <g fill="#fff4c0">
              <circle cx="81" cy="177" r="4" />
              <circle cx="239" cy="177" r="4" />
              <path
                d="M29 83L33 96L46 100L33 104L29 117L25 104L12 100L25 96ZM283 164L287 177L300 181L287 185L283 198L279 185L266 181L279 177Z"
              />
            </g>
          </svg>
          <span class="chest-tap" aria-hidden="true"
            >{{ t(phase === 'charging' ? 'POWERING UP…' : 'TAP TO OPEN') }} <b>✦</b></span
          >
        </button>
        <div class="chest-value">
          <b>1</b
          ><span>
            {{ t('SURPRISE') }}
            <small>{{ t(reward.source.toUpperCase()) }} {{ t('REWARD') }} </small></span
          >
        </div>
      </div>
      <button
        v-else
        ref="roulette"
        type="button"
        class="slot-machine"
        :aria-label="
          t(
            phase === 'opening'
              ? 'Tap the roulette to stop on an item'
              : 'Collect reward and continue',
          )
        "
        @click="phase === 'opening' ? stopRoulette() : $emit('continue')"
        :class="{ landed: phase === 'opened' }"
        :aria-busy="phase === 'opening'"
      >
        <div class="slot-lights" aria-hidden="true"></div>
        <div class="slot-marquee">
          <span>✦</span> {{ t(phase === 'opened' ? 'BONUS WON!' : 'BONUS SPIN') }} <span>✦</span>
        </div>
        <div class="slot-housing" aria-hidden="true">
          <span class="slot-pointer left">▶</span>
          <div class="slot-window">
            <div
              class="slot-strip"
              :class="{ rolling: phase === 'opening' }"
              :style="{ '--stop': stopIndex - 1, '--spin-duration': `${spinDurationMs}ms` }"
              @animationend.self="finish()"
            >
              <div
                v-for="(power, index) in reelSymbols"
                :key="index"
                class="slot-symbol"
                :class="{ 'winning-symbol': index === stopIndex }"
              >
                <div class="reward-art">
                  <img :src="rewardArt(power)" alt="" />
                  <span class="reward-use" :title="t(rewardUse(power))">
                    <GameIcon :name="rewardUse(power) === 'Village' ? 'home' : 'pickaxe'" />
                  </span>
                </div>
                <span>{{ t(power.label) }}</span>
              </div>
            </div>
            <div class="slot-payline"></div>
          </div>
          <span class="slot-pointer right">◀</span>
        </div>
        <div class="slot-result" role="status" aria-live="polite" aria-atomic="true">
          <template v-if="phase === 'opened'"
            ><b>+{{ prize.quantity ?? 1 }}</b
            ><strong>{{ t(prize.label) }}</strong
            ><span class="prize-use"
              ><GameIcon :name="rewardUse(prize) === 'Village' ? 'home' : 'pickaxe'" />{{
                t(rewardUse(prize))
              }}</span
            ><span class="prize-note">
              {{
                t(
                  prize.convertedFrom
                    ? 'STORAGE FULL · EXCHANGED FOR COINS'
                    : prize.kind === 'coins'
                      ? 'ADDED TO YOUR VILLAGE SAVINGS'
                      : prize.kind === 'builder-hammer'
                        ? 'USE ON A CONSTRUCTION IN THE VILLAGE'
                        : 'ADDED TO YOUR ARMORY',
                )
              }}
            </span></template
          >
          <template v-else
            ><strong> {{ t('LET IT ROLL!') }} </strong
            ><span> {{ t('ONE SPIN. ONE SURPRISE.') }} </span></template
          >
        </div>
      </button>
    </div>
    <footer class="chest-controls">
      <p v-if="phase === 'closed'" class="chest-open-hint">
        {{ t('Puzzle bonuses, coins, or a builder hammer await.') }}
      </p>
      <p v-else-if="phase === 'charging' || phase === 'opening'" class="chest-open-hint">
        {{
          t(
            phase === 'opening'
              ? 'Tap the roulette to stop on an item'
              : 'Your roulette is getting ready…',
          )
        }}
      </p>
      <p v-else class="chest-next-hint">
        {{ t('TAP YOUR BONUS') }} <span>→</span>
        <small>{{
          t(chestIndex + 1 < totalChests ? 'OPEN THE NEXT CHEST' : 'SEE YOUR RESULTS')
        }}</small>
      </p>
      <span class="chest-save-note">{{
        t(totalChests > 1 ? 'SCORE + SPEED · DOUBLE CHEST RUN' : 'EARNED IT. KEEP IT. USE IT.')
      }}</span>
    </footer>
  </section>
</template>
<script setup>
import { t } from '../i18n';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  shuffleChestDrops,
  rewardArt,
  availableChestDrops,
  chestReward,
  rewardUse,
} from '../data/rewards';
import GameIcon from './GameIcon.vue';
import { useSettingsStore } from '../stores/settingsStore';
import { useGameStore } from '../stores/gameStore';
import { useCampaignStore } from '../stores/campaignStore';
const props = defineProps({
  reward: { type: Object, required: true },
  chestIndex: Number,
  totalChests: Number,
});
const emit = defineEmits(['continue', 'skip', 'claimed']);
const settings = useSettingsStore();
const game = useGameStore();
const phase = ref('closed');
const roulette = ref(null);
const campaign = useCampaignStore();
const eligibleDrops = availableChestDrops(campaign);
const savedPrize = props.reward.items[0];
const prize = ref(
  eligibleDrops.some((drop) => drop.id === savedPrize.id)
    ? savedPrize
    : chestReward('coins', props.reward.levelId, props.reward.economyVersion ?? 1),
);
// Each chest gets a fresh order, with two chances to catch every reward.
const reelOrder = shuffleChestDrops(Math.random, eligibleDrops);
const symbolDurationMs = 326 / 1.05;
const stopIndex = ref(reelOrder.length * 2);
const spinDurationMs = stopIndex.value * symbolDurationMs;
// The fallback is saved at completion. A tap claims the symbol currently on the payline.
const reelSymbols = Array.from({ length: stopIndex.value + 3 }, (_, index) =>
  index === stopIndex.value ? prize.value : reelOrder[index % reelOrder.length],
);
let timers = [];
const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};
const finish = (selection) => {
  if (phase.value === 'opened') return;
  clearTimers();
  const granted = campaign.claimChest(props.reward.id, selection ?? prize.value.id);
  if (granted) {
    prize.value = granted;
    emit('claimed', granted);
  }
  phase.value = 'opened';
  game.audioManager?.playArcadeCue?.('jackpot');
  nextTick(() => roulette.value?.focus({ preventScroll: true }));
};
const stopRoulette = () => {
  if (phase.value !== 'opening') return;
  const windowBounds = roulette.value.querySelector('.slot-window').getBoundingClientRect();
  const center = (windowBounds.top + windowBounds.bottom) / 2;
  const symbols = [...roulette.value.querySelectorAll('.slot-symbol')];
  let nearest = 0,
    distance = Infinity;
  symbols.forEach((symbol, index) => {
    const bounds = symbol.getBoundingClientRect();
    const delta = Math.abs((bounds.top + bounds.bottom) / 2 - center);
    if (delta < distance) {
      distance = delta;
      nearest = index;
    }
  });
  stopIndex.value = nearest;
  finish(reelSymbols[nearest].id);
};
const open = () => {
  if (phase.value !== 'closed') return;
  game.audioManager?.playArcadeCue?.('chest-charge');
  if (settings.reducedMotion || reelOrder.length === 1) return finish();
  phase.value = 'charging';
  timers.push(
    setTimeout(() => {
      phase.value = 'opening';
      game.audioManager?.playArcadeCue?.('chest-open');
      nextTick(() => roulette.value?.focus({ preventScroll: true }));
      // Keep the mechanical clicks in step with the steady, readable reel.
      for (let index = 0; index < stopIndex.value; index++) {
        timers.push(
          setTimeout(
            () => game.audioManager?.playArcadeCue?.('reel-tick', index),
            (index + 1) * symbolDurationMs,
          ),
        );
      }
      // Fallback for background tabs or a browser that suppresses animation events.
      timers.push(setTimeout(finish, spinDurationMs + 200));
    }, 850),
  );
};
watch(
  () => settings.reducedMotion,
  (value) => {
    if (value && ['opening', 'charging'].includes(phase.value)) finish();
  },
);
onBeforeUnmount(clearTimers);
</script>
<style scoped>
.arcade-chest {
  --prize: #ffdd78;
  position: relative;
  display: flex;
  flex-direction: column;
  isolation: isolate;
  min-height: 100%;
  height: 100dvh;
  overflow: hidden;
  padding: max(18px, env(safe-area-inset-top)) max(22px, env(safe-area-inset-right))
    max(18px, env(safe-area-inset-bottom)) max(22px, env(safe-area-inset-left));
  background: #160a2b;
}
.arcade-chest.speed {
  --prize: #78f6ff;
}
.chest-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: -1;
  background:
    radial-gradient(ellipse at 50% 48%, #6f238677, transparent 65%),
    linear-gradient(#1c0b33, #190e38);
  pointer-events: none;
}
.speed .chest-backdrop {
  background: radial-gradient(ellipse at 50% 48%, #156a8877, transparent 65%), #0d142c;
}
.prize-rays {
  position: absolute;
  width: min(140vmax, 1600px);
  height: min(140vmax, 1600px);
  will-change: transform;
  mask-image: radial-gradient(circle closest-side, #000 35%, transparent 100%);
  top: 50%;
  left: 50%;
  background: repeating-conic-gradient(
    from 0deg,
    transparent 0deg 12deg,
    #e6a34b12 12deg 22deg,
    transparent 22deg 30deg
  );
  animation: prize-rays 45s linear infinite;
}
.prize-grid {
  position: absolute;
  inset: 65% -30% -40%;
  background:
    linear-gradient(#c384ee28 1px, transparent 1px),
    linear-gradient(90deg, #c384ee28 1px, transparent 1px);
  background-size: 55px 55px;
  transform: perspective(220px) rotateX(45deg);
  mask-image: linear-gradient(transparent, #000);
}
.prize-orbit {
  position: absolute;
  width: min(70vw, 540px);
  aspect-ratio: 1;
  border: 1px solid #c58ad832;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow:
    0 0 0 32px #a578c609,
    0 0 0 85px #a578c607;
}
.prize-spark {
  position: absolute;
  left: var(--x);
  top: var(--y);
  font-size: 10px;
  color: var(--prize);
  opacity: 0.3;
  animation: prize-drift 4s calc(var(--i) * -170ms) ease-in-out infinite alternate;
}
.chest-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
}
.arcade-kicker {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #d8bce9;
}
.arcade-kicker b {
  color: var(--prize);
  margin: 0 10px;
}
.arcade-skip {
  border: 1px solid #b58fd04a;
  border-radius: 7px;
  background: #29193999;
  padding: 12px 16px;
  color: #d8c5e7;
  font-size: 11px;
  min-height: 44px;
}
.arcade-skip span {
  margin-left: 8px;
}
.chest-stage {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: safe center;
  flex-direction: column;
  gap: clamp(14px, 3vh, 32px);
  text-align: center;
  padding: 20px 0;
}
.opening .chest-stage,
.opened .chest-stage {
  justify-content: flex-start;
  gap: 12px;
  padding-top: 10px;
}
.opening .chest-announcement h2,
.opened .chest-announcement h2 {
  font-size: clamp(30px, 5vw, 54px);
  margin: 8px 0;
}
.chest-announcement,
.chest-center {
  flex-shrink: 0;
  min-width: 0;
}
.chest-counter {
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--prize);
  font-weight: 700;
}
.chest-announcement h2 {
  font-family: Impact, 'Arial Black', sans-serif;
  font-weight: 900;
  font-style: italic;
  font-size: clamp(44px, 7vw, 94px);
  line-height: 1.05;
  letter-spacing: 1px;
  margin: 12px 0;
  color: #fff4d4;
  text-shadow:
    3px 4px 0 #9439ac,
    6px 8px 0 #361146,
    0 0 38px #f1a94155;
}
.speed h2 {
  text-shadow:
    3px 4px 0 #168bad,
    6px 8px 0 #092944,
    0 0 38px #41cff155;
}
.chest-announcement p {
  font-size: 13px;
  color: #ceb9e1;
  line-height: 1.6;
}
.chest-center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.arcade-chest-art {
  width: clamp(210px, 30vw, 360px);
  height: auto;
  overflow: visible;
  filter: drop-shadow(0 0 28px #efb45955);
  animation: chest-hover 2.4s ease-in-out infinite;
}
.chest-halo {
  position: absolute;
  inset: 12% -20%;
  border-radius: 50%;
  background: radial-gradient(ellipse, #ffcb6860, transparent 65%);
  filter: blur(14px);
}
.chest-value {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: -6px;
  color: var(--prize);
}
.chest-value > b {
  font:
    italic 900 52px/1 Impact,
    'Arial Black',
    sans-serif;
}
.chest-value span {
  text-align: left;
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 2px;
}
.chest-value small {
  display: block;
  color: #ac8dbf;
  font-size: 8px;
  margin-top: 6px;
}
.charging .arcade-chest-art {
  animation: chest-charge 850ms ease-in forwards;
}
.treasure-lid {
  transform-origin: 48px 129px;
}
.charging .treasure-lid {
  animation: lid-open 850ms ease-in forwards;
}
.prize-burst {
  position: absolute;
  inset: -20%;
  background: radial-gradient(circle, #ffe6a955, transparent 62%);
  animation: prize-impact 750ms ease-out both;
}
.chest-controls {
  flex-shrink: 0;
  text-align: center;
  padding-top: 14px;
}
.chest-save-note {
  display: block;
  font-size: 8px;
  letter-spacing: 2px;
  color: #b097c7;
  margin-top: 15px;
}
.arcade-button {
  width: min(380px, 100%);
  min-height: 58px;
  border: 1px solid #fff2ae;
  border-radius: 9px;
  background: linear-gradient(#ffec9a, #ffc556);
  box-shadow:
    0 5px 0 #87502a,
    0 0 30px #ffcf5720;
  color: #321343;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 1px;
  padding: 16px 22px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.arcade-button span {
  font-size: 23px;
  line-height: 1;
}
.arcade-button.secondary {
  background: #37204f;
  color: #e5ccf3;
  border-color: #ba8bd4;
  box-shadow: 0 5px 0 #140b24;
}
@keyframes prize-rays {
  from {
    transform: translate(-50%, -50%) rotate(0);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
@keyframes prize-drift {
  to {
    transform: translate(8px, -22px) rotate(40deg);
    opacity: 0.7;
  }
}
@keyframes chest-hover {
  50% {
    transform: translateY(-12px) rotate(-3deg);
  }
}
@keyframes chest-charge {
  20%,
  50% {
    transform: translateX(-5px) rotate(-3deg);
  }
  35%,
  65% {
    transform: translateX(5px) rotate(3deg);
  }
  90% {
    transform: scale(1.12);
    filter: drop-shadow(0 0 45px #ffe199);
  }
  100% {
    transform: scale(1.22);
    opacity: 0;
  }
}
@keyframes lid-open {
  65% {
    transform: rotate(0);
  }
  100% {
    transform: translateY(-65px) rotate(-28deg);
  }
}
@keyframes prize-impact {
  from {
    opacity: 1;
    transform: scale(0.6);
  }
  to {
    opacity: 0;
    transform: scale(1.8);
  }
}
@keyframes prize-land {
  from {
    transform: scale(0.65) translateY(-22px) rotate(-8deg);
  }
  to {
    transform: scale(1);
  }
}
@media (max-width: 640px) {
  .arcade-chest {
    padding-inline: max(16px, env(safe-area-inset-left));
  }
  .arcade-kicker {
    font-size: 8px;
    letter-spacing: 1px;
  }
  .arcade-kicker b {
    margin: 0 4px;
  }
  .arcade-skip {
    padding: 10px;
    font-size: 10px;
  }
  .arcade-skip span {
    display: none;
  }
  .chest-counter {
    font-size: 9px;
    letter-spacing: 2px;
  }
  .chest-announcement p {
    font-size: 11px;
    max-width: 290px;
    margin: auto;
  }
  .chest-stage {
    gap: 18px;
  }
}
@media (max-height: 700px) {
  .chest-stage {
    gap: 10px;
    padding: 12px 0;
  }
  .chest-announcement h2 {
    font-size: clamp(36px, 6vw, 64px);
    margin: 8px 0;
  }
  .arcade-chest-art {
    width: 205px;
  }
  .chest-value > b {
    font-size: 36px;
  }
  .chest-value span {
    font-size: 11px;
  }
  .arcade-button {
    min-height: 48px;
    padding-block: 12px;
  }
  .chest-save-note {
    margin-top: 10px;
    font-size: 7px;
  }
  .chest-controls {
    padding-top: 8px;
  }
}
@media (max-height: 480px) and (min-width: 641px) {
  .chest-center {
    flex-direction: row;
  }
  .arcade-chest-art {
    width: 155px;
  }
  .chest-stage {
    flex-direction: row;
    gap: 30px;
  }
  .chest-announcement {
    max-width: 280px;
  }
  .chest-announcement h2 {
    font-size: 42px;
  }
  .chest-save-note {
    display: none;
  }
}
.opening .prize-spark,
.opened .prize-spark {
  animation: prize-explode 950ms calc(var(--i) * 7ms) ease-out both;
}
@keyframes prize-explode {
  from {
    transform: translate(var(--dx), var(--dy)) scale(3) rotate(0);
    opacity: 1;
  }
  to {
    transform: scale(0.7) rotate(var(--turn));
    opacity: 0.35;
  }
}

.chest-trigger {
  position: relative;
  display: grid;
  justify-items: center;
  padding: 0 12px 18px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  color: var(--prize);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.chest-trigger:focus-visible {
  outline: 3px dashed var(--prize);
  outline-offset: 6px;
}
.chest-trigger:hover:not(:disabled) .arcade-chest-art {
  filter: drop-shadow(0 0 40px #ffd786aa);
}
.chest-trigger:disabled {
  cursor: default;
  opacity: 1;
}
.chest-tap {
  font:
    italic 900 19px/1.2 'Arial Black',
    sans-serif;
  letter-spacing: 2px;
  transform: rotate(-3deg);
  text-shadow:
    2px 3px #451840,
    0 0 16px #ffc65e77;
  animation: tap-pulse 1.5s ease-in-out infinite;
}
.chest-tap b {
  margin-left: 8px;
}
.chest-open-hint {
  min-height: 36px;
  margin: 0;
  font-size: 12px;
  color: #d4b9e7;
}
.slot-machine:focus-visible {
  outline: 3px solid #fff0ad;
  outline-offset: 5px;
}
.slot-machine {
  color: inherit;
  font: inherit;
  cursor: pointer;
  touch-action: manipulation;
  text-align: center;
  --slot-row: 118px;
  position: relative;
  flex-shrink: 0;
  width: min(380px, calc(100% - 16px));
  padding: 14px 20px 16px;
  border: 3px solid var(--prize);
  border-radius: 23px;
  background: linear-gradient(145deg, #ab58b0, #542052 32%, #270d36 75%);
  box-shadow:
    0 9px 0 #10051e,
    0 0 0 5px #4c244f,
    0 0 65px #e98ce84a,
    inset 0 0 0 5px #ffffff18;
  animation: machine-arrive 280ms ease-out both;
}
.slot-lights {
  position: absolute;
  inset: 5px;
  border: 5px dotted var(--prize);
  border-radius: 17px;
  pointer-events: none;
  filter: drop-shadow(0 0 4px var(--prize));
  animation: marquee-chase 650ms ease-in-out infinite alternate;
  will-change: opacity;
}
.slot-marquee {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0 3px 12px;
  color: #fff6dc;
  font:
    italic 900 22px/1.2 'Arial Black',
    sans-serif;
  letter-spacing: 1px;
  text-shadow: 2px 3px #431344;
}
.slot-marquee > span {
  color: var(--prize);
}
.slot-housing {
  position: relative;
  padding-inline: 12px;
}
.slot-window {
  position: relative;
  height: calc(var(--slot-row) * 3 + 4px);
  overflow: hidden;
  border: 2px solid #fbdba2;
  border-radius: 10px;
  background: #fff1ce;
  box-shadow:
    0 0 0 5px #230b2a,
    inset 0 0 18px #341434;
}
.slot-window::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(#21082cd9, transparent 33% 67%, #21082cd9);
  pointer-events: none;
}
.slot-strip {
  transform: translateY(calc(var(--stop) * var(--slot-row) * -1));
}
.slot-strip.rolling {
  animation: reel-roll var(--spin-duration) linear both;
  will-change: transform;
}
.slot-symbol {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  justify-items: center;
  align-items: center;
  height: var(--slot-row);
  padding: 5px 8px;
  gap: 3px;
  color: #4b2458;
  border-bottom: 1px solid #7d4b6b22;
}
.reward-art {
  position: relative;
  height: 100%;
  min-height: 0;
  width: 85%;
  overflow: hidden;
}
.reward-art img {
  height: 100%;
  width: 100%;
  object-fit: contain;
  display: block;
}
.reward-use {
  position: absolute;
  bottom: 0;
  right: 3px;
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border: 1px solid #b88b46;
  border-radius: 50%;
  background: #fff2cb;
  color: #694b2c;
  box-shadow: 0 2px 4px #43252b44;
}
.reward-use svg {
  width: 17px;
  height: 17px;
}
.prize-use {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
}
.prize-use svg {
  width: 17px;
  height: 17px;
}
.slot-symbol > span {
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  max-width: 100%;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.slot-payline {
  position: absolute;
  top: var(--slot-row);
  height: var(--slot-row);
  width: 100%;
  border-block: 2px solid #ce873b88;
  background: linear-gradient(90deg, #ffca5340, transparent 18% 82%, #ffca5340);
  box-shadow: 0 0 18px #ffdf8233;
}
.slot-pointer {
  position: absolute;
  top: 50%;
  z-index: 1;
  transform: translateY(-50%);
  color: var(--prize);
  font-size: 22px;
  filter: drop-shadow(0 0 5px #ffcf6688);
}
.slot-pointer.left {
  left: -7px;
}
.slot-pointer.right {
  right: -7px;
}
.slot-result {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  justify-content: center;
  align-content: center;
  align-items: center;
  column-gap: 10px;
  min-height: 64px;
  padding-top: 12px;
  color: var(--prize);
}
.slot-result b {
  grid-row: span 2;
  font:
    italic 900 38px/1 Impact,
    'Arial Black',
    sans-serif;
}
.slot-result .prize-use {
  grid-column: 2;
}
.slot-result .prize-note {
  grid-column: 1 / -1;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.slot-result strong {
  font:
    italic 900 20px/1.1 'Arial Black',
    sans-serif;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
.slot-result span {
  display: block;
  margin-top: 6px;
  font-size: 8px;
  letter-spacing: 1.5px;
  color: #e2c8ec;
}
.opening .slot-result {
  grid-template-columns: 1fr;
}
.landed {
  box-shadow:
    0 9px 0 #10051e,
    0 0 0 5px #4c244f,
    0 0 75px #ffd67877;
}
.landed .winning-symbol img {
  animation: prize-land 450ms cubic-bezier(0.2, 1.7, 0.5, 1) both;
}
.landed .slot-result {
  animation: machine-arrive 350ms ease-out both;
}
.landed .slot-lights {
  animation-duration: 1000ms;
}
.chest-next-hint {
  min-height: 58px;
  margin: 0;
  display: grid;
  grid-template-columns: auto auto;
  align-content: center;
  justify-content: center;
  gap: 7px 12px;
  color: var(--prize);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 1.5px;
}
.chest-next-hint small {
  grid-column: span 2;
  color: #d4b9e7;
  font-size: 9px;
  font-weight: 600;
}
@keyframes reel-roll {
  from {
    transform: translateY(var(--slot-row));
  }
  to {
    transform: translateY(calc(var(--stop) * var(--slot-row) * -1));
  }
}
@keyframes machine-arrive {
  from {
    opacity: 0;
    transform: translateY(15px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes marquee-chase {
  to {
    opacity: 0.45;
  }
}
@keyframes tap-pulse {
  50% {
    opacity: 0.65;
    transform: rotate(-3deg) scale(0.97);
  }
}
@media (max-width: 640px) {
  .slot-machine {
    --slot-row: 96px;
    width: min(320px, calc(100% - 16px));
    padding-inline: 16px;
  }
  .slot-marquee {
    font-size: 19px;
  }
}
@media (max-height: 700px) {
  .slot-machine {
    --slot-row: clamp(36px, calc((100dvh - 440px) / 3), 65px);
    width: min(290px, calc(100% - 16px));
    padding-block: 12px;
  }
  .slot-marquee {
    font-size: 17px;
    margin-bottom: 9px;
  }
  .slot-result {
    min-height: 54px;
    padding-top: 10px;
  }
  .slot-result strong {
    font-size: 16px;
  }
  .slot-result b {
    font-size: 30px;
  }
  .slot-symbol {
    grid-template-columns: 48px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 8px;
    padding: 4px 8px;
  }
  .slot-symbol > span {
    font-size: 9px;
  }
  .reward-art {
    width: 100%;
  }
  .reward-use {
    width: 16px;
    height: 16px;
    right: 0;
  }
  .reward-use svg {
    width: 12px;
    height: 12px;
  }
  .chest-trigger {
    padding-bottom: 14px;
  }
  .chest-tap {
    font-size: 16px;
  }
}
@media (max-height: 480px) and (min-width: 641px) {
  .slot-machine {
    --slot-row: clamp(28px, calc((100dvh - 290px) / 3), 52px);
    width: 250px;
  }
  .slot-marquee {
    font-size: 15px;
    margin-bottom: 6px;
  }
  .slot-result {
    min-height: 43px;
    padding-top: 6px;
  }
  .slot-result strong {
    font-size: 14px;
  }
  .slot-result span {
    font-size: 6px;
  }
  .chest-open-hint {
    min-height: 26px;
  }
}
</style>
