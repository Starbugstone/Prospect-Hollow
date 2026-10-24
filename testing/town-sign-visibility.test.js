import { afterEach, expect, it } from 'vitest';
import { Group, Raycaster, Vector3 } from 'three';
import { ERAS } from '../src/data/eras';
import { BUILDINGS, createTown } from '../src/data/town';
import { TOWN_CAMERA_POSITION, TOWN_CAMERA_FOCUS_HEIGHT } from '../src/data/townCamera';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { buildPlot } from '../src/game/town/TownPlots';
import { PLOTS } from '../src/game/town/TownLayout';
import { eraIndex, finishEra, modernizesInEra } from '../src/game/town/TownEras';
const drawers = [];
afterEach(() => drawers.splice(0).forEach((d) => d.disposePrimitives()));
const labels = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.name]));
const view = new Vector3(...TOWN_CAMERA_POSITION);
view.y -= TOWN_CAMERA_FOCUS_HEIGHT;
view.normalize();
it.each(ERAS.filter((e) => e.enabled).map((e) => e.id))(
  'shows the entire %s nameboard face from the default player direction at every paid tier',
  (era) => {
    const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
    drawers.push(d);
    const town = (d.town = createTown());
    town.era = era;
    const available = BUILDINGS.filter(
      (b) => PLOTS[b.id] && eraIndex(b.introducedEra) <= eraIndex(era),
    );
    for (const b of available) {
      town.buildings[b.id] = b.upgrades.length;
      town.buildingEras[b.id] = finishEra(b.id, era);
      town.buildingEraLevels[b.id] = era === 'frontier' ? 0 : 3;
    }
    const ray = new Raycaster(),
      failures = [];
    let boards = 0;
    for (const b of available)
      for (const tier of [1, 2, 3]) {
        town.buildings[b.id] = b.introducedEra === era ? tier : b.upgrades.length;
        town.buildingEraLevels[b.id] =
          era === 'frontier' ? 0 : modernizesInEra(era, b.id) || b.introducedEra === era ? tier : 3;
        const root = new Group();
        root.position.set(PLOTS[b.id][0], 0.08, PLOTS[b.id][1]);
        root.userData.plot = b.id;
        buildPlot(d, b.id, root, town, labels);
        root.updateMatrixWorld(true);
        const signs = [],
          solids = [];
        root.traverse((o) => {
          if (!o.isMesh) return;
          if (o.name === 'Mounted building nameboard') signs.push(o);
          else if (
            !o.material?.transparent &&
            !o.material?.userData.signAtlas &&
            !o.userData.signMount
          )
            solids.push(o);
        });
        for (const sign of signs) {
          boards++;
          const width = sign.scale.x - 0.1;
          const center = sign.parent.localToWorld(
            new Vector3(sign.position.x, sign.position.y, sign.position.z + 0.062),
          );
          const origin = center.clone().addScaledVector(view, 35);
          for (const u of [-0.47, 0, 0.47])
            for (const v of [-0.16, 0, 0.16]) {
              const target = sign.parent.localToWorld(
                new Vector3(
                  sign.position.x + u * width,
                  sign.position.y + v,
                  sign.position.z + 0.062,
                ),
              );
              ray.set(origin, target.clone().sub(origin).normalize());
              ray.far = origin.distanceTo(target) - 0.01;
              const hit = ray.intersectObjects(solids, false)[0];
              if (hit)
                failures.push(
                  `${b.id}/L${tier}/${sign.userData.signMount}: ${hit.object.name || hit.object.geometry.type} hides lettering at ${u},${v}`,
                );
            }
        }
        d.clearGroup(root);
        town.buildings[b.id] = b.upgrades.length;
        town.buildingEraLevels[b.id] = era === 'frontier' ? 0 : 3;
      }
    expect(boards).toBeGreaterThan(0);
    expect(failures.slice(0, 25).join('\n'), `${failures.length} hidden sign samples`).toBe('');
  },
  60000,
);
