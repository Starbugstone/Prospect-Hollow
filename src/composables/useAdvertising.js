import { onBeforeUnmount, shallowRef } from 'vue';
import { ads } from '../services/ads';

export function useAdvertising() {
  const state = shallowRef(ads.getState());
  const unsubscribe = ads.subscribe((value) => {
    state.value = value;
  });
  onBeforeUnmount(unsubscribe);
  return { ads, adState: state };
}
