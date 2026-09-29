import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminApp from './AdminApp.vue';
import './admin.css';

// A separate page from the game: no save storage, sync or game start-up runs here.
// Pinia only backs the read-only town renderer's display settings.
createApp(AdminApp).use(createPinia()).mount('#admin');
