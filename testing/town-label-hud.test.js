import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { projectLabelPositions } from '../src/game/town/TownLabelProjection';
import { mapHud, mapHudTop } from '../src/game/town/TownMapHud';

// The valley's names keep clear of the map's chrome: the header pills, the needs row
// under them and the goal pills stacked down the right (town.css). A name that cannot
// clear them is left out, as on the Moon.

// A valley view whose camera puts each place's name at a chosen screen point (CSS px).
function valley(width, height, places, hud) {
  const camera = new PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const at = ([x, y]) =>
    new Vector3((x / width) * 2 - 1, 1 - (y / height) * 2, 0.5).unproject(camera);
  let labels = null;
  const d = {
    camera,
    controls: { target: new Vector3() },
    canvas: { clientWidth: width, clientHeight: height },
    town: { buildings: Object.fromEntries(Object.keys(places).map((id) => [id, 1])), projects: {} },
    anchors: Object.entries(places).map(([id, point]) => ({
      id,
      position: at(point),
      collection: at(point),
      width: 120,
      span: 8,
    })),
    hud,
    onLabels: (placed) => (labels = placed),
  };
  projectLabelPositions(d);
  return Object.fromEntries(labels.map(({ id, visible }) => [id, visible]));
}

describe('valley names and the map chrome', () => {
  const desktop = {
    underNeeds: [640, 95],
    underCommission: [1150, 140],
    clear: [640, 400],
  };

  it('leaves out a name under the needs row, and keeps it when there is no needs row', () => {
    expect(valley(1280, 800, desktop, { needs: true })).toEqual({
      underNeeds: false,
      underCommission: true,
      clear: true,
    });
    expect(valley(1280, 800, desktop, { needs: false }).underNeeds).toBe(true);
  });

  it('leaves out a name under the commission pill at the top right', () => {
    const shown = valley(1280, 800, desktop, { needs: true, commission: true });
    expect(shown).toEqual({ underNeeds: false, underCommission: false, clear: true });
    expect(valley(1280, 800, desktop, { needs: true, project: true }).underCommission).toBe(false);
  });

  it('on a phone reserves only the project pill: the commission pill is at the foot', () => {
    const phone = { topRight: [300, 150], clear: [187, 360] };
    expect(valley(375, 740, phone, { needs: true, commission: true })).toEqual({
      topRight: true,
      clear: true,
    });
    expect(valley(375, 740, phone, { needs: true, project: true })).toEqual({
      topRight: false,
      clear: true,
    });
  });

  it('shares the header rows with the Moon', () => {
    expect([1, 2, 3].map(mapHudTop)).toEqual([60, 112, 164]);
    expect(mapHud(1280, 800, {}).top).toBe(60);
    expect(mapHud(1280, 800, { needs: true, project: true, commission: true })).toEqual({
      top: 112,
      chrome: [{ id: 'hud-goals', x: 1268 - 145, y: 216 / 2, width: 290, height: 216 }],
    });
  });
});
