import { buildingPaintRole } from '../../data/buildingPaint';
import { validPaint } from '../../data/townPersonalisation';

const sources = new WeakMap();
function paint(root, { value }) {
  for (const element of root.querySelectorAll('[fill], [stroke]')) {
    for (const attribute of ['fill', 'stroke']) {
      const current = element.getAttribute(attribute);
      if (!validPaint(current)) continue;
      let entries = sources.get(element);
      if (!entries) sources.set(element, (entries = {}));
      const old = entries[attribute];
      const source = old && old.painted === current ? old.source : current;
      const role = buildingPaintRole(source, element.getAttribute('data-paint') ?? '', value.era);
      const colour = value.paint?.[role];
      const painted = validPaint(colour) ? colour : source;
      entries[attribute] = { source, painted };
      element.setAttribute(attribute, painted);
    }
  }
}
export const buildingPaintDirective = { mounted: paint, updated: paint };
