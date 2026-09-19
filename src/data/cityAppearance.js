import { eraEvolution } from './eras';
import styles from './cityStyles.json';

export function cityAppearance(era) {
  const asset = eraEvolution(era).cityAssets;
  return Object.hasOwn(styles, asset) ? styles[asset] : styles['post-war'];
}
