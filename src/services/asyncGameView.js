import { defineAsyncComponent, h } from 'vue';
import GameViewStatus from '../components/GameViewStatus.vue';
// Every lazily loaded game view has a visible loading and recovery state. A
// missing chunk after deployment must not leave an apparently empty game.
export function asyncGameView(loader, label) {
  return defineAsyncComponent({
    loader,
    delay: 150,
    timeout: 15000,
    loadingComponent: { render: () => h(GameViewStatus, { label }) },
    errorComponent: { render: () => h(GameViewStatus, { label, failed: true }) },
  });
}
