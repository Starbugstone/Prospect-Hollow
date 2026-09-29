<template>
  <p v-if="!adminSession.checked" class="admin-loading" role="status">Loading…</p>
  <SignIn v-else-if="adminSession.stage !== 'full'" />
  <div v-else class="admin-shell">
    <header class="admin-bar">
      <a class="admin-brand" href="#/">
        Prospect Hollow admin <span>{{ host }}</span>
      </a>
      <nav class="admin-nav" aria-label="Sections">
        <a
          v-for="link in links"
          :key="link.section"
          :href="`#/${link.path}`"
          :aria-current="route.section === link.section ? 'page' : undefined"
        >
          {{ link.label }}
        </a>
      </nav>
      <label class="admin-toggle">
        <input v-model="prefs.hideEmails" type="checkbox" />
        Hide emails
      </label>
      <span class="admin-user">{{ adminSession.username }}</span>
      <button type="button" class="admin-button quiet" @click="signOut">Sign out</button>
    </header>
    <main class="admin-main">
      <component :is="view" :id="route.id" :key="`${route.section}/${route.id}`" />
    </main>
  </div>
</template>
<script setup>
import { computed, onMounted } from 'vue';
import { adminSession, restoreSession, signOut } from './api';
import { prefs, route } from './state';
import SignIn from './views/SignIn.vue';
import Overview from './views/Overview.vue';
import Players from './views/Players.vue';
import PlayerDetail from './views/PlayerDetail.vue';
import Towns from './views/Towns.vue';
import TownDetail from './views/TownDetail.vue';
import Admins from './views/Admins.vue';
import AuditLog from './views/AuditLog.vue';
const host = location.host;
const links = [
  { section: 'overview', path: '', label: 'Overview' },
  { section: 'players', path: 'players', label: 'Players' },
  { section: 'towns', path: 'towns', label: 'Towns' },
  { section: 'admins', path: 'admins', label: 'Admins' },
  { section: 'log', path: 'log', label: 'Activity log' },
];
const view = computed(
  () =>
    ({
      overview: Overview,
      players: route.id ? PlayerDetail : Players,
      towns: route.id ? TownDetail : Towns,
      admins: Admins,
      log: AuditLog,
    })[route.section],
);
onMounted(restoreSession);
</script>
