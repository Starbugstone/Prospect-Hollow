import { Vector3 } from 'three';
import { constructionReady } from './TownRules';
import { overlapsEventInset } from './TownInset';
import { forEachWalker } from './TownWalkers';

// Screen placement of building labels, collection icons and the named-villager tag.
// Runs on every camera frame, so it reuses scratch vectors instead of cloning.
const screen = new Vector3();
const inFront = (p) => p.z > -1 && p.z < 1;

// The label's draw order: the mine, the selection, ready builds, the guided goal,
// then affordable plots; nearer labels win among equals.
function labelRank(d, id) {
  if (id === 'mine') return 0;
  if (id === d.selected) return 1;
  if (constructionReady(d.town.projects[id])) return 2;
  if (id === d.guidedPlot) return 3;
  return d.availablePlots?.has(id) ? 4 : 5;
}

export function projectLabelPositions(d) {
  const cameraDistance = d.camera.position.distanceTo(d.controls.target);
  if (Math.abs(cameraDistance - (d.lastAudioDistance ?? 0)) > 0.05) {
    d.lastAudioDistance = cameraDistance;
    d.onCameraDistance?.(cameraDistance);
  }
  const distant = cameraDistance > 66;
  const width = d.canvas.clientWidth,
    height = d.canvas.clientHeight,
    town = d.town;
  const projected = d.anchors.map(({ id, position, width: labelWidth, collection }) => {
    const reward = screen.copy(collection).project(d.camera);
    const icon = {
      x: (reward.x + 1) * 50,
      y: (1 - reward.y) * 50,
      visible:
        inFront(reward) &&
        Math.abs(reward.x) < 0.95 &&
        Math.abs(reward.y) < 0.9 &&
        !overlapsEventInset(d, ((reward.x + 1) * width) / 2, ((1 - reward.y) * height) / 2, 48),
    };
    const p = screen.copy(position).project(d.camera);
    return {
      id,
      x: (p.x + 1) * 50,
      y: (1 - p.y) * 50,
      collection: icon,
      depth: p.z,
      rank: labelRank(d, id),
      inView: inFront(p) && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.9,
      width: labelWidth,
      visible:
        !overlapsEventInset(d, ((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2, labelWidth) &&
        d.plotCache?.get(id)?.group.visible !== false &&
        (id === 'mine' ||
          town.buildings[id] > 0 ||
          !!town.projects[id] ||
          d.availablePlots?.has(id)) &&
        inFront(p) &&
        (Math.abs(p.x) * width) / 2 + labelWidth / 2 + 8 < width / 2 &&
        p.y < 0.84 &&
        p.y > (width < 600 ? -0.42 : -0.78) &&
        (!distant ||
          id === 'mine' ||
          id === d.selected ||
          id === d.guidedPlot ||
          !!town.projects[id] ||
          (!town.buildings[id] && d.availablePlots?.has(id))),
    };
  });
  // Higher-ranked labels claim their space first; overlapping later ones hide.
  const shown = [];
  for (const anchor of [...projected].sort((a, b) => a.rank - b.rank || a.depth - b.depth)) {
    if (!anchor.visible) continue;
    if (
      shown.some(
        (other) =>
          (Math.abs(anchor.x - other.x) * width) / 100 < (anchor.width + other.width) / 2 + 4 &&
          (Math.abs(anchor.y - other.y) * height) / 100 <
            (anchor.id === 'mine' || other.id === 'mine' ? 72 : 42),
      )
    )
      anchor.visible = false;
    else shown.push(anchor);
  }
  d.onLabels(projected);
  projectVillager(d);
  projectPlaque(d);
}

// A tapped mine plaque names its honour or distinction until the next tap.
export function projectPlaque(d) {
  const root = d.namedPlaque;
  if (root?.parent !== d.world) d.namedPlaque = null;
  if (!d.namedPlaque || d.raid || d.cinematic) {
    d.onPlaqueLabel?.(null);
    return;
  }
  const p = screen.setFromMatrixPosition(root.matrixWorld);
  p.y += 0.9;
  p.project(d.camera);
  d.onPlaqueLabel?.(
    inFront(p) && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1
      ? { name: root.userData.distinctionName, x: (p.x + 1) * 50, y: (1 - p.y) * 50 }
      : null,
  );
}

// The named villager's tag follows them; it hides when they go indoors or off screen.
export function projectVillager(d) {
  const actor = d.namedVillager;
  if (
    !actor?.root.visible ||
    !actor.root.userData.villager?.name ||
    actor.root.parent !== d.world
  ) {
    d.namedVillager = null;
    d.villagerLabelPinned = false;
    d.onVillagerLabel?.(null);
    return;
  }
  if (actor.root.scale.x < 0.5 || d.raid || d.cinematic) {
    d.onVillagerLabel?.(null);
    return;
  }
  const p = screen.copy(actor.root.position);
  p.y += 1.5;
  p.project(d.camera);
  d.onVillagerLabel?.(
    Math.abs(p.x) <= 1 &&
      Math.abs(p.y) <= 1 &&
      p.z >= -1 &&
      p.z <= 1 &&
      !overlapsEventInset(
        d,
        ((p.x + 1) * d.canvas.clientWidth) / 2,
        ((1 - p.y) * d.canvas.clientHeight) / 2,
        180,
      )
      ? {
          name: actor.root.userData.villager.name,
          live: !!actor.root.userData.villager.live,
          x: (p.x + 1) * 50,
          y: (1 - p.y) * 50,
        }
      : null,
  );
}

// The named villager nearest a screen point (within 24 px), if any.
function villagerAt(d, clientX, clientY) {
  const rect = d.canvas.getBoundingClientRect();
  let nearest = null,
    distance = 24;
  forEachWalker(
    d,
    (actor) => {
      if (!actor.root.userData.villager?.name || !actor.root.visible || actor.root.scale.x < 0.5)
        return;
      const p = screen.copy(actor.root.position);
      p.y += 1;
      p.project(d.camera);
      if (p.z < -1 || p.z > 1) return;
      const delta = Math.hypot(
        rect.left + ((p.x + 1) * rect.width) / 2 - clientX,
        rect.top + ((1 - p.y) * rect.height) / 2 - clientY,
      );
      if (delta < distance) {
        nearest = actor;
        distance = delta;
      }
    },
    { animals: false },
  );
  return nearest;
}

export function selectVillager(d, actor, toggle = true) {
  const dismiss = toggle && d.villagerLabelPinned && d.namedVillager === actor;
  d.namedVillager = dismiss ? null : actor;
  d.villagerLabelPinned = !dismiss;
  d.dismissedVillager = dismiss ? actor : null;
  projectVillager(d);
}

// A click names (pins) the villager under the pointer; hovering names them until the
// pointer moves on. Only clicking the pinned visitor again dismisses a pinned name.
export function showVillager(d, clientX, clientY, pin = false) {
  if (!pin && d.villagerLabelPinned && d.namedVillager) return true;
  const nearest = villagerAt(d, clientX, clientY);
  if (pin && nearest) selectVillager(d, nearest);
  else if (!d.villagerLabelPinned || !d.namedVillager) {
    // A second click stays dismissed until the pointer leaves this visitor.
    if (nearest !== d.dismissedVillager) d.dismissedVillager = null;
    d.namedVillager = nearest === d.dismissedVillager ? null : nearest;
    d.villagerLabelPinned = false;
  }
  projectVillager(d);
  return !!nearest;
}
