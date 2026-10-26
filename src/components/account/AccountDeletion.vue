<template>
  <section class="account-section account-deletion" aria-labelledby="account-deletion-title">
    <h2 id="account-deletion-title">{{ t('Delete my account') }}</h2>
    <p>{{ t('This permanently removes:') }}</p>
    <ul class="office-losses">
      <li>{{ t('Your email address and every signed-in device') }}</li>
      <li v-if="summary">
        {{
          t('Your cloud towns ({towns}) and their saved versions ({versions})', {
            towns: number(summary.towns + summary.deletedTowns),
            versions: number(summary.savedVersions),
          })
        }}
      </li>
      <li v-if="summary?.honours || summary?.distinctions">
        {{
          t(
            'Your Town Honours ({honours}) and player distinctions ({distinctions}). Distinctions such as Alpha Player can never be earned again.',
            { honours: number(summary.honours), distinctions: number(summary.distinctions) },
          )
        }}
      </li>
      <li>{{ t('Your public name, last connection and activity') }}</li>
      <li>{{ t('This device’s copies of your cloud towns and their local backups') }}</li>
    </ul>
    <p class="account-hint">
      {{
        t(
          'Towns you visited keep counting your visits, without your name or town. Other devices keep playing their copy offline until you remove it there. We send one last email to confirm, then forget the address.',
        )
      }}
    </p>
    <div class="account-callout">
      <GameIcon name="download" />
      <p>
        <strong>{{ t('Keep a copy first') }}</strong>
        {{
          t(
            'Download your data, or save a backup file of a town from My towns to keep playing it offline.',
          )
        }}
      </p>
      <div class="account-row">
        <button :disabled="busy" @click="act(downloadAccountData)">
          {{ t('Download my data') }}
        </button>
        <button type="button" class="account-link" @click="$emit('towns')">
          {{ t('My towns') }}
        </button>
      </div>
    </div>
    <form class="account-stack" @submit.prevent="act(remove)">
      <label class="account-field"
        >{{ t('Type DELETE MY ACCOUNT to confirm')
        }}<input v-model="confirmation" autocomplete="off" spellcheck="false"
      /></label>
      <button class="account-destructive" :disabled="busy || confirmation !== PHRASE">
        <GameIcon name="trash" />{{ t('Delete my account forever') }}
      </button>
    </form>
  </section>
</template>
<script setup>
import { ref } from 'vue';
import { deleteAccount } from '../../services/cloudProfile';
import { downloadAccountData } from '../../services/playerData';
import { useAccountContext } from './accountContext';
import { t, number } from '../../i18n';
import GameIcon from '../GameIcon.vue';
defineProps({ summary: { type: Object, default: null } });
defineEmits(['towns']);
// The server checks the same phrase in every language.
const PHRASE = 'DELETE MY ACCOUNT';
const { busy, message, act, changed } = useAccountContext();
const confirmation = ref('');
async function remove() {
  await deleteAccount(confirmation.value);
  changed();
  message.value = 'Your account was deleted. We sent a last email to confirm.';
}
</script>
