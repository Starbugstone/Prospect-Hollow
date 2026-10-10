<template>
  <section>
    <a v-if="data" class="admin-back" :href="`#/players/${town.owner.id}`"
      >← {{ shownEmail(town.owner.email) }}</a
    >
    <a v-else class="admin-back" href="#/towns">← Towns</a>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <template v-if="data">
      <header class="admin-heading">
        <h1>{{ town.name }} <TownState :town="town" /> <SyncBlocked :town="town" /></h1>
        <p class="admin-muted">Town {{ town.id }} · revision {{ town.revision }}</p>
      </header>
      <div v-if="risk.stale" class="admin-warning" role="alert">
        <p>
          The player’s game saved revision {{ status.revision }}
          {{ relativeTime(status.savedAt, now) }}. This page still shows revision
          {{ town.revision }}.
        </p>
        <button type="button" class="admin-button" @click="load()">Load the latest save</button>
      </div>
      <div class="admin-town-layout">
        <TownPreview
          v-if="data.appearance"
          :key="`${town.id}/${town.revision}`"
          :appearance="data.appearance"
        />
        <p v-else class="admin-empty">This save cannot be drawn.</p>
        <dl class="admin-facts admin-facts-column">
          <div>
            <dt>Era</dt>
            <dd>{{ eraLabel(stats.era) }}</dd>
          </div>
          <EditableFact
            label="Coins"
            :value="fieldFor('coins')?.current ?? stats.coins"
            :field="fieldFor('coins')"
            :before-edit="beforeEdit"
            :save="correct"
          />
          <div>
            <dt>Buildings built</dt>
            <dd>{{ stats.buildings }}</dd>
          </div>
          <div>
            <dt>Levels completed</dt>
            <dd>{{ stats.levels }} of {{ LEVEL_COUNT }}</dd>
          </div>
          <div>
            <dt>Stars</dt>
            <dd>{{ stats.stars }} of {{ LEVEL_COUNT * 3 }}</dd>
          </div>
          <div>
            <dt>Total best score</dt>
            <dd>{{ whole(stats.score) }}</dd>
          </div>
          <div>
            <dt>Last cloud save</dt>
            <dd>{{ dateTime(town.savedAt) }}</dd>
          </div>
          <div>
            <dt>Owner last seen</dt>
            <dd :title="dateTime(town.ownerSeenAt)">
              <span v-if="isOnline(town.ownerSeenAt)" class="admin-online">Online</span>
              <template v-else>{{ relativeTime(town.ownerSeenAt) }}</template>
            </dd>
          </div>
          <div v-if="town.deletedAt">
            <dt>Deleted</dt>
            <dd>{{ dateTime(town.deletedAt) }}</dd>
          </div>
          <div>
            <dt
              title="Each signed-in visitor once across recorded visits; excludes owner visits and anonymous guests."
            >
              Unique visitors
            </dt>
            <dd>{{ whole(town.uniqueVisitors) }}</dd>
          </div>
          <div>
            <dt>Saloon collected by a visitor</dt>
            <dd>{{ town.saloonCollectedAt ? dateTime(town.saloonCollectedAt) : 'never' }}</dd>
          </div>
          <div>
            <dt>Guest waiting</dt>
            <dd>
              {{ town.guest ? `${town.guest.name}, ${relativeTime(town.guest.at)}` : 'none' }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="admin-town-tabs" role="tablist" aria-label="Town details">
        <button
          v-for="item in tabs"
          :id="`town-tab-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="tab === item.id"
          :aria-controls="`town-panel-${item.id}`"
          :tabindex="tab === item.id ? 0 : -1"
          @click="tab = item.id"
          @keydown="switchTab($event, item.id)"
        >
          {{ item.label }}
        </button>
      </div>
      <div
        v-if="tab === 'achievements'"
        id="town-panel-achievements"
        role="tabpanel"
        aria-labelledby="town-tab-achievements"
        tabindex="0"
      >
        <TownHonours
          :profile="profile"
          :unique-visitors="town.uniqueVisitors"
          :towns-visited="town.townsVisited"
          :distinctions="town.ownerDistinctions"
        />
      </div>
      <div
        v-show="tab === 'overview'"
        id="town-panel-overview"
        role="tabpanel"
        aria-labelledby="town-tab-overview"
        tabindex="0"
      >
        <h2>Campaign</h2>
        <ol class="admin-levels" aria-label="Levels and stars">
          <li
            v-for="level in levels"
            :key="level.id"
            :class="`stars-${level.stars}`"
            :title="level.title"
          >
            <span>{{ level.id }}</span>
            <span aria-hidden="true">{{ '★'.repeat(level.stars) || '·' }}</span>
          </li>
        </ol>
        <p v-if="levels.length < LEVEL_COUNT" class="admin-muted">
          Levels {{ levels.length + 1 }}–{{ LEVEL_COUNT }} not reached yet.
        </p>

        <div class="admin-columns">
          <div>
            <h2>Buildings</h2>
            <table class="admin-table compact">
              <thead>
                <tr>
                  <th scope="col">Building</th>
                  <th scope="col" class="number">Level</th>
                  <th scope="col">Style</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="building in buildings" :key="building.id">
                  <td>{{ building.name }}</td>
                  <td class="number">{{ building.level }}</td>
                  <td>{{ building.era }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2>Inventory</h2>
            <template v-if="editable">
              <p class="admin-muted">
                ✎ corrects a value after a bug. Each fix saves a new revision, with the previous one
                kept in the cloud history; the player’s game loads it on its next sync. Builder
                hammers may go past the cap that play earns up to.
              </p>
              <dl class="admin-facts admin-facts-column">
                <EditableFact
                  v-for="field in inventoryFacts"
                  :key="field.key"
                  :label="field.label"
                  :value="field.current"
                  :field="field"
                  :before-edit="beforeEdit"
                  :save="correct"
                />
              </dl>
            </template>
            <dl v-else class="admin-facts admin-facts-column">
              <div v-for="power in powers" :key="power.id">
                <dt>{{ power.label }}</dt>
                <dd>{{ power.quantity }}</dd>
              </div>
              <div>
                <dt>Builder hammers</dt>
                <dd>{{ profile.builderHammers ?? 0 }}</dd>
              </div>
            </dl>
            <template v-if="projects.length">
              <h2>Under construction</h2>
              <ul class="admin-list">
                <li v-for="project in projects" :key="project.id">
                  {{ project.name }}: {{ project.wins }} of {{ project.required }} puzzles
                </li>
              </ul>
            </template>
          </div>
        </div>

        <h2>Cloud sync <SyncBlocked :town="town" /></h2>
        <p class="admin-muted">
          Uploads the save protection rejected, newest first (the latest five, kept 30 days).
          Compare one to see the cloud save, what the server expected and what the game sent. Accept
          the next sync for a false desync, or edit the values and reset the player’s game to that
          save.
        </p>
        <ForceSyncToggle
          v-if="!town.deletedAt"
          class="admin-check"
          labelled
          :town="town"
          @update:force-sync="town.forceSync = $event"
          @error="error = $event"
        />
        <table v-if="data.syncRejections.length" class="admin-table">
          <thead>
            <tr>
              <th scope="col">Rejected</th>
              <th scope="col" class="number">Revision</th>
              <th scope="col">Reason</th>
              <th scope="col">Field</th>
              <th scope="col"><span class="visually-hidden">Action</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="rejection in data.syncRejections"
              :key="rejection.id"
              :class="{ 'admin-current': rejection.id === comparing }"
            >
              <td :title="dateTime(rejection.at)">{{ relativeTime(rejection.at) }}</td>
              <td class="number">{{ rejection.revision }}</td>
              <td :title="rejection.message">{{ codeLabel(rejection.code) }}</td>
              <td>
                <code v-if="rejection.field">{{ rejection.field }}</code>
              </td>
              <td>
                <button
                  type="button"
                  class="admin-button quiet"
                  @click="comparing = comparing === rejection.id ? '' : rejection.id"
                >
                  {{ comparing === rejection.id ? 'Hide' : 'Compare' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="admin-muted">No rejected uploads.</p>
        <p v-if="syncNotice" class="admin-notice" role="status">{{ syncNotice }}</p>
        <SyncCompare
          v-if="comparing"
          :key="comparing"
          :town-id="town.id"
          :town-name="town.name"
          :rejection-id="comparing"
          @close="comparing = ''"
          @reset="afterReset"
        />

        <h2>Cloud history</h2>
        <p class="admin-muted">
          Restoring saves an older revision as the newest one; the current save stays in this list.
          The owner’s device takes it on its next sync, or asks which copy to keep if it has
          unsynced progress.
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col" class="number">Revision</th>
              <th scope="col">Saved</th>
              <th scope="col">Era</th>
              <th scope="col" class="number">Coins</th>
              <th scope="col" class="number">Levels</th>
              <th scope="col"><span class="visually-hidden">Action</span></th>
            </tr>
          </thead>
          <tbody>
            <tr class="admin-current">
              <td class="number">{{ town.revision }}</td>
              <td>{{ dateTime(town.savedAt) }}</td>
              <td>{{ eraLabel(stats.era) }}</td>
              <td class="number">{{ whole(stats.coins) }}</td>
              <td class="number">{{ stats.levels }}</td>
              <td>Current</td>
            </tr>
            <tr v-for="entry in data.history" :key="entry.revision">
              <td class="number">{{ entry.revision }}</td>
              <td>{{ dateTime(entry.savedAt) }}</td>
              <td>{{ eraLabel(entry.stats.era) }}</td>
              <td class="number">{{ whole(entry.stats.coins) }}</td>
              <td class="number">{{ entry.stats.levels }}</td>
              <td>
                <ConfirmAction
                  label="Restore"
                  :title="`Restore revision ${entry.revision}?`"
                  :message="`It is saved as revision ${town.revision + 1}. Revision ${town.revision} stays in the history.`"
                  :disabled="Boolean(town.deletedAt)"
                  :run="() => restore(entry.revision)"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <template v-if="!town.deletedAt">
          <h2>Moderation</h2>
          <form class="admin-inline-form" @submit.prevent="rename">
            <label>
              Town name
              <input v-model="name" maxlength="24" required />
            </label>
            <button class="admin-button" :disabled="busy || name.trim() === town.name">
              Rename
            </button>
          </form>
          <div class="admin-actions">
            <ConfirmAction
              v-if="town.isPublic"
              label="Stop sharing"
              title="Stop sharing this town?"
              message="Its share link stops working and it leaves the public list. The owner can share it again."
              :run="unshare"
            />
            <ConfirmAction
              danger
              label="Delete town"
              title="Delete this town?"
              message="It leaves the owner’s account at once and is purged after 30 days. Copies on the owner’s devices stay there."
              :confirm-text="town.name"
              :run="remove"
            />
          </div>
        </template>
        <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

        <h2>Save data</h2>
        <button type="button" class="admin-button quiet" @click="download">
          Download save (JSON)
        </button>
        <details class="admin-raw">
          <summary>Show the full save</summary>
          <pre>{{ JSON.stringify(profile, null, 2) }}</pre>
        </details>
      </div>
      <OnlineWarning ref="warning" :seen-at="status?.ownerSeenAt ?? town.ownerSeenAt" />
    </template>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { adminApi } from '../api';
import { go, shownEmail } from '../state';
import { codeLabel, dateTime, isOnline, relativeTime, whole } from '../format';
import { downloadJson } from '../download';
import { BUILDINGS, LEVEL_COUNT, buildingLabel, eraLabel, powerLabel } from '../labels';
import ConfirmAction from '../components/ConfirmAction.vue';
import TownState from '../components/TownState.vue';
import TownPreview from '../components/TownPreview.vue';
import TownHonours from '../components/TownHonours.vue';
import SyncBlocked from '../components/SyncBlocked.vue';
import SyncCompare from '../components/SyncCompare.vue';
import ForceSyncToggle from '../components/ForceSyncToggle.vue';
import EditableFact from '../components/EditableFact.vue';
import OnlineWarning from '../components/OnlineWarning.vue';
import { correctionBody, editingRisk, inventoryFields, STATUS_POLL_MS } from '../inventory';
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'achievements', label: 'Achievements' },
];
const tab = ref('overview');
function switchTab(event, id) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  tab.value =
    event.key === 'Home'
      ? tabs[0].id
      : event.key === 'End'
        ? tabs.at(-1).id
        : tabs.find((item) => item.id !== id).id;
  document.getElementById(`town-tab-${tab.value}`)?.focus();
}
const props = defineProps({ id: String });
const data = ref(null),
  error = ref(''),
  notice = ref(''),
  name = ref(''),
  busy = ref(false),
  comparing = ref(''),
  syncNotice = ref('');
const town = computed(() => data.value.town);
const stats = computed(() => data.value.town.stats);
const profile = computed(() => data.value.profile ?? {});
const saved = computed(() => profile.value.town ?? {});
// Played chapters plus the next one; the rest of a long campaign is summarised.
const levels = computed(() =>
  Array.from(
    { length: Math.min(LEVEL_COUNT, (Math.ceil(stats.value.highestLevel / 6) + 1) * 6) },
    (_, index) => {
      const id = index + 1;
      const record = profile.value.records?.[id];
      const stars = Number.isInteger(record?.stars) ? Math.max(0, Math.min(3, record.stars)) : 0;
      const time =
        record?.bestTimeMs > 0 ? ` · best time ${(record.bestTimeMs / 1000).toFixed(1)} s` : '';
      return {
        id,
        stars,
        title: record
          ? `Level ${id}: ${stars} star${stars === 1 ? '' : 's'} · score ${whole(record.score)}${time}`
          : `Level ${id}: not completed`,
      };
    },
  ),
);
// Game order first, then any id this version of the panel does not know yet.
const buildings = computed(() => {
  const built = saved.value.buildings ?? {};
  const order = [...BUILDINGS.map((building) => building.id), ...Object.keys(built)];
  return [...new Set(order)]
    .filter((id) => built[id] > 0)
    .map((id) => ({
      id,
      name: buildingLabel(id),
      level: built[id],
      era: eraLabel(saved.value.buildingEras?.[id] ?? saved.value.era),
    }));
});
const powers = computed(() =>
  (Array.isArray(profile.value.powers) ? profile.value.powers : []).map((power) => ({
    id: power.id,
    label: powerLabel(power.id),
    quantity: power.quantity ?? 0,
  })),
);
const projects = computed(() =>
  Object.entries(saved.value.projects ?? {}).map(([id, project]) => ({
    id,
    name: buildingLabel(id),
    wins: project?.wins ?? 0,
    required: project?.required ?? '?',
  })),
);
async function load(result) {
  try {
    data.value = result ?? (await adminApi('GET', `towns/${props.id}`));
    name.value = data.value.town.name;
    status.value = null;
  } catch (e) {
    error.value = e.message;
  }
}
async function change(body, message) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await load(await adminApi('PATCH', `towns/${props.id}`, { body }));
    notice.value = message;
  } finally {
    busy.value = false;
  }
}
const rename = () =>
  change({ name: name.value.trim() }, 'Town renamed.').catch((e) => (error.value = e.message));
const unshare = () => change({ isPublic: false }, 'The town is no longer shared.');
async function restore(revision) {
  await load(await adminApi('POST', `towns/${props.id}/restore`, { body: { revision } }));
  notice.value = `Revision ${revision} restored as revision ${town.value.revision}.`;
}
async function remove() {
  await adminApi('DELETE', `towns/${props.id}`, { body: { confirmation: town.value.name } });
  go(`players/${town.value.owner.id}`);
}
const download = () =>
  downloadJson(`${town.value.name}-revision-${town.value.revision}`, profile.value);
async function afterReset(result) {
  comparing.value = '';
  await load(result);
  syncNotice.value = `Saved as revision ${town.value.revision}. The owner’s game loads it on its next sync.`;
}
// Quick fixes after a bug: coins, stored bonuses and builder hammers, one value at a time.
const editable = computed(() =>
  data.value.inventory && !town.value.deletedAt ? inventoryFields(data.value.inventory) : null,
);
const fieldFor = (key) => editable.value?.find((field) => field.key === key) ?? null;
const inventoryFacts = computed(() => editable.value?.filter((field) => field.key !== 'coins'));
// Polled while the page is open, so a sync from the player's game shows up during an edit.
const status = ref(null),
  now = ref(Date.now() / 1000);
const risk = computed(() =>
  editingRisk(town.value.revision, status.value ?? town.value, now.value),
);
async function poll() {
  now.value = Date.now() / 1000;
  if (document.hidden || !data.value) return;
  try {
    status.value = await adminApi('GET', `towns/${props.id}/status`);
  } catch {
    /* The last known status stands; saving still checks the revision. */
  }
}
// The first edit while the player is online asks before going on.
const warning = ref(null);
let warned = false;
async function beforeEdit() {
  await poll();
  if (warned || !risk.value.online) return true;
  warned = await warning.value.ask();
  return warned;
}
async function correct(field, value) {
  try {
    await load(
      await adminApi('PATCH', `towns/${props.id}/inventory`, {
        body: correctionBody(field, value, town.value.revision),
      }),
    );
  } catch (e) {
    if (e.status !== 409) throw e;
    await load();
    const latest = fieldFor(field.key);
    throw new Error(
      `The player’s game saved meanwhile${latest ? `; this is now ${whole(latest.current)}` : ''}. Save again to keep your value.`,
      { cause: e },
    );
  }
}
let timer;
onMounted(() => {
  load();
  timer = setInterval(poll, STATUS_POLL_MS);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
