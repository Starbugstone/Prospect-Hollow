<script>
import { h } from 'vue';

// Shared by future buildings and heritage infrastructure, with grounded sail
// supports and the same palette roles as the corresponding Three.js kits.
function TownFutureRoof({ styleId: s, p, x, w, top, accent, tone = 0 }) {
  if (s === 'sail')
    return h('g', [
      h('path', {
        d: `M${x - w / 2 - 12} ${top - 44}Q${x} ${top - 12} ${x + w / 2 + 12} ${top - 26}L${x + w / 2 + 8} ${top - 4}Q${x} ${top - 20} ${x - w / 2 - 8} ${top - 6}Z`,
        fill: accent ? p.flower : [p.roof, p.glass, p.roof, p.flower][tone % 4],
        stroke: p.timber,
        'stroke-width': 1.5,
      }),
      h('path', {
        d: `M${x - w / 2 - 12} 0V${top - 62}M${x + w / 2 + 12} 0V${top - 44}`,
        stroke: p.timber,
        'stroke-width': 3,
      }),
      h('path', { d: `M${x - w / 2 - 12} ${top - 62}l16 5-16 5Z`, fill: p.flower }),
    ]);
  if (s === 'observatory') {
    const r = Math.min(w * 0.3, 34);
    return h('g', [
      h('rect', { x: x - w / 2 - 4, y: top - 6, width: w + 8, height: 7, fill: p.shell }),
      h('path', {
        d: `M${x - r} ${top - 6}a${r} ${r} 0 0 1 ${r * 2} 0Z`,
        fill: p.shell,
        stroke: p.timber,
        'stroke-width': 3,
      }),
      h('path', {
        d: `M${x} ${top - 6}v${-r}`,
        stroke: p.deep,
        'stroke-width': Math.max(4, r * 0.22),
      }),
    ]);
  }
  const rise = Math.min(34, w * 0.32);
  return h('g', [
    h('path', {
      d: `M${x - w / 2 - 8} ${top}L${x} ${top - rise}L${x + w / 2 + 8} ${top}Z`,
      fill: p.roof,
    }),
    h('path', {
      d: `M${x - w / 2 - 8} ${top}L${x} ${top - rise}L${x + w / 2 + 8} ${top}`,
      stroke: p.light,
      'stroke-width': 3,
      fill: 'none',
    }),
    h('circle', { cx: x, cy: top - rise * 0.4, r: 4, fill: p.light }),
  ]);
}
// Explicit props normalize template callers' style-id to styleId in both the
// browser and SSR; a props-less functional component receives the raw attribute.
TownFutureRoof.props = ['styleId', 'p', 'x', 'w', 'top', 'accent', 'tone'];
export default TownFutureRoof;
</script>
