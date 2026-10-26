import { townLabelDetail, townLabelRank } from '../TownLabels';

export const compactMoonViewport = (width, height) => width < 600 || height < 450;
// Includes the whole button hit rectangle, not just the painted pin. Chrome and
// transient user-opened panels are separate. Attention labels never lose priority.
export const MOON_LABEL_COVERAGE = 0.25;
export const MOON_PIN_SIZE = 28;

export const moonLabelNeedsAttention = ({ status, action, collectable }) =>
  !!action || !!collectable || ['open', 'work', 'ready'].includes(status);

export function moonLabelDensity(labels, width, height, { near = false, selected } = {}) {
  if (!compactMoonViewport(width, height)) return labels;
  let area = labels.filter((lot) => lot.visible).length * MOON_PIN_SIZE ** 2;
  const extra = 96 * 40 - MOON_PIN_SIZE ** 2;
  const ranked = labels.map((lot) => ({
    ...lot,
    rank: townLabelRank({ selected: lot.id === selected, ready: lot.attention }),
  }));
  const detailed = new Set();
  for (const lot of [...ranked].sort((a, b) => a.rank - b.rank)) {
    if (!lot.visible) continue;
    const priority = lot.attention || lot.id === selected;
    if (
      townLabelDetail({
        distant: !near,
        selected: lot.id === selected,
        attention: lot.attention,
      }) &&
      (priority || area + extra <= width * height * MOON_LABEL_COVERAGE)
    ) {
      detailed.add(lot.id);
      area += extra;
    }
  }
  return ranked.map((lot) => ({
    ...lot,
    collapsed: !detailed.has(lot.id),
    width: detailed.has(lot.id) ? 96 : MOON_PIN_SIZE,
    height: detailed.has(lot.id) ? 40 : MOON_PIN_SIZE,
  }));
}
