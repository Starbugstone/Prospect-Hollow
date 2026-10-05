<template>
  <section>
    <a class="admin-back" href="#/players">← Players</a>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <template v-if="data">
      <header class="admin-heading">
        <h1>
          {{ shownEmail(player.email) }}
          <span v-if="isOnline(player.lastSeenAt)" class="admin-online">Online</span>
        </h1>
        <p class="admin-muted">Player {{ player.id }}</p>
      </header>
      <dl class="admin-facts">
        <div>
          <dt>Joined</dt>
          <dd>{{ dateTime(player.createdAt) }}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>
            {{ relativeTime(player.lastSeenAt) }} <small>{{ dateTime(player.lastSeenAt) }}</small>
          </dd>
        </div>
        <div>
          <dt>Last sign-in</dt>
          <dd>
            {{ relativeTime(player.lastSignInAt) }}
            <small>{{ dateTime(player.lastSignInAt) }}</small>
          </dd>
        </div>
        <div>
          <dt>Email sign-ins</dt>
          <dd>{{ player.signIns }}</dd>
        </div>
        <div>
          <dt>Active days (30 days)</dt>
          <dd>{{ player.activeDays }}</dd>
        </div>
        <div>
          <dt>Last device</dt>
          <dd>
            {{
              player.platform === 'app'
                ? 'Mobile app'
                : player.platform === 'web'
                  ? 'Web browser'
                  : '—'
            }}
          </dd>
        </div>
        <div>
          <dt>Last IP address</dt>
          <dd>
            <code>{{ player.ip ?? '—' }}</code>
          </dd>
        </div>
        <div>
          <dt>Last browser</dt>
          <dd :title="player.agent ?? ''">{{ describeAgent(player.agent) }}</dd>
        </div>
      </dl>
      <p v-if="!player.lastSeenAt" class="admin-muted">
        Connections are recorded from the admin release onward; this player has not connected since.
      </p>

      <h2>Player distinctions</h2>
      <p class="admin-muted">
        Badges held by the account, shown in the game and in one showcase slot per town. Removing
        one (for a cheater) hides it everywhere, and later grants to every player skip this player
        until you give it back.
      </p>
      <table class="admin-table admin-distinctions">
        <thead>
          <tr>
            <th scope="col">Distinction</th>
            <th scope="col">State</th>
            <th scope="col"><span class="visually-hidden">Action</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in distinctions" :key="item.id" :data-distinction="item.id">
            <td>
              <strong>{{ item.name }}</strong>
              <small class="admin-muted"> · {{ item.kindLabel }}</small>
            </td>
            <td>{{ item.stateText }}</td>
            <td>
              <ConfirmAction
                v-if="item.state === 'held'"
                danger
                label="Remove"
                :title="`Remove ${item.name} from this player?`"
                message="It leaves their account and every showcase straight away. You can give it back later."
                :run="() => setDistinction(item, false)"
              />
              <ConfirmAction
                v-else-if="item.kind === 'event' || item.state === 'removed'"
                :label="item.state === 'removed' ? 'Give back' : 'Give'"
                :title="`Give ${item.name} to this player?`"
                :message="
                  item.kind === 'event'
                    ? 'They receive it now and see it the next time their game checks in.'
                    : 'It follows their time since the first sign-in again.'
                "
                :run="() => setDistinction(item, true)"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Towns</h2>
      <table class="admin-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Era</th>
            <th scope="col" class="number">Coins</th>
            <th scope="col" class="number">Buildings</th>
            <th scope="col" class="number">Levels</th>
            <th scope="col" class="number">Stars</th>
            <th scope="col">Last save</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="town in data.towns"
            :key="town.id"
            class="admin-row-link"
            @click="go(`towns/${town.id}`)"
          >
            <td>
              <a :href="`#/towns/${town.id}`" @click.stop>{{ town.name }}</a>
            </td>
            <td>{{ eraLabel(town.stats.era) }}</td>
            <td class="number">{{ whole(town.stats.coins) }}</td>
            <td class="number">{{ town.stats.buildings }}</td>
            <td class="number">{{ town.stats.levels }}</td>
            <td class="number">{{ town.stats.stars }}</td>
            <td :title="dateTime(town.savedAt)">{{ relativeTime(town.savedAt) }}</td>
            <td><TownState :town="town" /></td>
          </tr>
          <tr v-if="!data.towns.length">
            <td colspan="8" class="admin-empty">
              No cloud towns. The player may still play on a device.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>
        Live sessions <small>{{ data.sessions.length }}</small>
      </h2>
      <ul v-if="data.sessions.length" class="admin-list">
        <li v-for="session in data.sessions" :key="session.createdAt">
          Signed in {{ dateTime(session.createdAt) }} · expires {{ date(session.expiresAt) }}
        </li>
      </ul>
      <p v-else class="admin-muted">Not signed in on any device.</p>

      <h2>Actions</h2>
      <div class="admin-actions">
        <ConfirmAction
          label="Sign out everywhere"
          title="Sign this player out on every device?"
          message="Their towns are kept. They sign in again with a new email link."
          :disabled="!data.sessions.length"
          :run="signOutEverywhere"
        />
        <ConfirmAction
          danger
          label="Delete account"
          title="Delete this account?"
          message="The account, its cloud towns and their history are deleted now. Copies already on the player’s devices stay there."
          :confirm-text="player.email"
          :confirm-hint="prefs.hideEmails ? 'the player’s email' : undefined"
          :run="deleteAccount"
        />
      </div>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
    </template>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '../api';
import { go, prefs, shownEmail } from '../state';
import { date, dateTime, describeAgent, isOnline, relativeTime, whole } from '../format';
import { eraLabel } from '../labels';
import ConfirmAction from '../components/ConfirmAction.vue';
import TownState from '../components/TownState.vue';
import { distinctionBadge } from '../../data/playerDistinctions';
import { distinctionName } from '../../components/honours/honourDisplay';
const props = defineProps({ id: String });
const data = ref(null),
  error = ref(''),
  notice = ref('');
const player = computed(() => data.value.player);
// Every catalog distinction for this player: held (with the time step), removed or not yet.
const distinctions = computed(() =>
  (player.value.distinctions ?? []).map((item) => {
    const badge = distinctionBadge(item.id, item);
    return {
      ...item,
      name: badge ? distinctionName(badge) : item.id,
      kindLabel: item.kind === 'tenure' ? 'time since first sign-in' : 'event',
      stateText:
        item.state === 'held'
          ? item.kind === 'tenure'
            ? `Held · step reached ${dateTime(item.at)}`
            : `Held since ${dateTime(item.at)}`
          : item.state === 'removed'
            ? `Removed ${dateTime(item.removedAt)}`
            : item.kind === 'tenure'
              ? 'Not yet: one week after the first sign-in'
              : 'Not held',
    };
  }),
);
async function setDistinction(item, held) {
  const result = await adminApi(
    held ? 'POST' : 'DELETE',
    `players/${props.id}/distinctions/${item.id}`,
  );
  data.value.player.distinctions = result.distinctions;
  notice.value = held ? 'Distinction given.' : 'Distinction removed.';
}
async function load() {
  try {
    data.value = await adminApi('GET', `players/${props.id}`);
  } catch (e) {
    error.value = e.message;
  }
}
async function signOutEverywhere() {
  const { sessions } = await adminApi('POST', `players/${props.id}/sign-out`);
  notice.value = `Signed out of ${sessions} session${sessions === 1 ? '' : 's'}.`;
  await load();
}
async function deleteAccount() {
  await adminApi('DELETE', `players/${props.id}`, { body: { confirmation: player.value.email } });
  go('players');
}
onMounted(load);
</script>
