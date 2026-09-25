import { eraEvolution } from './eras';
import buildings from './cityBuildingStyles.json';
import styles from './cityStyles.json';

export function cityAppearance(era, kind) {
  const asset = eraEvolution(era).cityAssets;
  const palette = Object.hasOwn(styles, asset) ? styles[asset] : styles['post-war'];
  if (!kind || !Object.hasOwn(buildings, kind)) return palette;
  return {
    ...palette,
    ...buildings[kind],
    asset: `${Object.hasOwn(styles, asset) ? asset : 'post-war'}-kind-${kind}`,
  };
}
