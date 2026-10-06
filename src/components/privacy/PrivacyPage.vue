<template>
  <main class="privacy-page">
    <header class="privacy-heading">
      <img src="/art/amethyst.svg" alt="" />
      <h1>{{ t('Privacy at Prospect Hollow') }}</h1>
      <a :href="HOME_PATH">{{ t('Play Prospect Hollow') }}</a>
    </header>
    <article class="privacy-content">
      <p class="privacy-updated">
        {{ t('Last updated {date}', { date: updated }) }}
      </p>
      <section class="privacy-summary" aria-labelledby="privacy-summary-title">
        <h2 id="privacy-summary-title">{{ t('The short version') }}</h2>
        <ul>
          <li v-for="line in PRIVACY_SUMMARY" :key="line">
            <GameIcon name="check" />{{ t(line) }}
          </li>
        </ul>
      </section>
      <nav class="privacy-toc" :aria-label="t('On this page')">
        <a href="#privacy-data">{{ t('What we keep and why') }}</a>
        <a v-for="section in PRIVACY_SECTIONS" :key="section.id" :href="`#privacy-${section.id}`">
          {{ t(section.title) }}
        </a>
        <a href="#privacy-contact">{{ t('Contact') }}</a>
      </nav>
      <section id="privacy-data" aria-labelledby="privacy-data-title">
        <h2 id="privacy-data-title">{{ t('What we keep and why') }}</h2>
        <p>
          {{
            t(
              'Prospect Hollow is made by Starbugstone, who decides how this data is used. With an account, the server keeps:',
            )
          }}
        </p>
        <table class="privacy-table">
          <thead>
            <tr>
              <th scope="col">{{ t('Data') }}</th>
              <th scope="col">{{ t('Why') }}</th>
              <th scope="col">{{ t('Legal basis') }}</th>
              <th scope="col">{{ t('Kept') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in PRIVACY_DATA" :key="row.data">
              <th scope="row">{{ t(row.data) }}</th>
              <td :data-label="t('Why')">{{ t(row.why) }}</td>
              <td :data-label="t('Legal basis')">{{ t(row.basis) }}</td>
              <td :data-label="t('Kept')">{{ t(row.kept, retention) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section
        v-for="section in PRIVACY_SECTIONS"
        :id="`privacy-${section.id}`"
        :key="section.id"
        :aria-labelledby="`privacy-${section.id}-title`"
      >
        <h2 :id="`privacy-${section.id}-title`">{{ t(section.title) }}</h2>
        <p v-for="paragraph in section.paragraphs" :key="paragraph">
          {{ t(paragraph, retention) }}
        </p>
      </section>
      <section id="privacy-contact" aria-labelledby="privacy-contact-title">
        <h2 id="privacy-contact-title">{{ t('Contact') }}</h2>
        <p v-if="contact">
          {{ t('For any question or request about your data, write to') }}
          <a :href="`mailto:${contact}`">{{ contact }}</a
          >.
        </p>
        <p v-else>
          {{
            t(
              'For any question or request about your data, reply to any email the game sent you. We answer within one month.',
            )
          }}
        </p>
      </section>
    </article>
  </main>
</template>
<script setup>
import { computed, onMounted } from 'vue';
import {
  PRIVACY_DATA,
  PRIVACY_SECTIONS,
  PRIVACY_SUMMARY,
  PRIVACY_UPDATED,
  privacyContact,
  retentionValues,
} from '../../data/privacy';
import { HOME_PATH } from '../../services/appRoute';
import { t, locale } from '../../i18n';
import GameIcon from '../GameIcon.vue';
const contact = privacyContact();
const retention = computed(() => retentionValues(t));
const updated = computed(() =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(PRIVACY_UPDATED),
  ),
);
onMounted(() => {
  document.title = `${t('Privacy')} · Prospect Hollow`;
});
</script>
<style>
.privacy-page {
  min-height: 100dvh;
  background: #fbf8ef;
  color: #294139;
  font:
    1rem/1.6 system-ui,
    sans-serif;
}
.privacy-heading {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.5rem;
  background: #183832;
  color: #fff7df;
}
.privacy-heading img {
  width: 1.6rem;
  height: 1.6rem;
}
.privacy-heading h1 {
  flex: 1;
  margin: 0;
  font:
    1.4rem Georgia,
    serif;
}
.privacy-heading a {
  color: #fff7df;
  font-weight: 600;
}
.privacy-content {
  display: grid;
  gap: 2rem;
  max-width: 54rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}
.privacy-content h2 {
  margin: 0 0 0.6rem;
  font:
    1.35rem Georgia,
    serif;
}
.privacy-content p {
  margin: 0 0 0.7rem;
}
.privacy-content section {
  scroll-margin-top: 4.5rem;
}
.privacy-content a {
  color: #315940;
  font-weight: 600;
}
.privacy-updated {
  color: #64756a;
  font-size: 0.9rem;
}
.privacy-summary {
  padding: 1.2rem 1.4rem;
  background: #e9efdf;
  border: 1px solid #cad8bd;
  border-radius: 16px;
}
.privacy-summary ul {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.privacy-summary li {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}
.privacy-summary svg {
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.2rem;
  color: #315940;
}
.privacy-toc {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  font-size: 0.92rem;
}
.privacy-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}
.privacy-table th,
.privacy-table td {
  padding: 0.65rem 0.6rem;
  border-bottom: 1px solid #e3dbc7;
  text-align: left;
  vertical-align: top;
}
.privacy-table thead th {
  color: #64756a;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
/* On phones each row becomes a card with its column names as labels. */
@media (max-width: 640px) {
  .privacy-table thead {
    display: none;
  }
  .privacy-table tr {
    display: grid;
    gap: 0.35rem;
    padding: 0.8rem 0;
    border-bottom: 1px solid #e3dbc7;
  }
  .privacy-table th,
  .privacy-table td {
    padding: 0;
    border: 0;
  }
  .privacy-table td::before {
    content: attr(data-label) ': ';
    font-weight: 600;
  }
}
</style>
