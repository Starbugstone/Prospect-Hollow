// The game loads French text only for French players; tests switch locale freely.
import { loadFrench } from '../src/i18n';
await loadFrench();
