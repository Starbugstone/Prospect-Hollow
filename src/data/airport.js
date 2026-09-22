import { eraEvolution } from './eras';
import styles from './airportStyles.json';

// Shared by Blender authoring, the runtime mesh selector and the SVG fallback.
export function airportAppearance(era) {
  const style = eraEvolution(era).airportStyle;
  return Object.hasOwn(styles, style) ? styles[style] : styles.regional;
}
