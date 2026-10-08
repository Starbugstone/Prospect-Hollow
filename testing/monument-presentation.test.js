import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createTown } from '../src/data/town';
import { PERSONAL_AREAS } from '../src/data/townLandmarks';
import TownLandmarkPreview from '../src/components/town/TownLandmarkPreview.vue';
import TownMonumentSite from '../src/components/town/TownMonumentSite.vue';

const render = (component, props) =>
  renderToString(createSSRApp({ render: () => h(component, props) }));

describe('Monument cards', () => {
  it.each(PERSONAL_AREAS)('shows distinct purchased milestones for $id', async (area) => {
    for (const choice of area.choices) {
      const stages = new Set();
      for (let stage = 1; stage <= (area.timeless ? 1 : 5); stage++) {
        const svg = await render(TownLandmarkPreview, { choice, stage });
        stages.add(svg);
        expect(svg.includes('class="landmark-fountain"'), `${choice} ${stage}`).toBe(
          area.timeless || stage >= 3,
        );
      }
      expect(stages.size).toBe(area.timeless ? 1 : 5);
    }
  });
  it('shows a permanent completed wonder, without promising more era upgrades', async () => {
    const town = createTown();
    town.personalisation.areas.meadow = ['headframe'];
    town.personalisation.areaLevels.meadow = 11;
    const html = await render(TownMonumentSite, { town, id: 'meadow' });
    expect(html).toContain('Stage 5 of 5');
    expect(html).toContain('A completed town wonder. Future eras keep all five levels.');
    expect(html).not.toContain('Grow to stage');
    expect(html).not.toContain('next era adds');
  });
});
