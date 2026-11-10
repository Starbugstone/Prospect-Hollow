---
name: prospect-hollow-cinematics
description: Create, repair and verify Prospect Hollow's in-game cinematic videos, monument unveilings, milestone scenes and incident or VIP camera insets on the valley and Moon maps. Use for shot framing, terrain obstruction, camera motion, playback or cinematic capture; excludes ordinary player orbit controls and unrelated video editing.
---

# Prospect Hollow cinematics

Work from the Prospect Hollow checkout. Follow its `AGENTS.md` and
`docs/development-workflow.md`; every local check and capture runs in Docker.
The skill lives in the repository so every contributor and delegated agent can
read the same instructions. A machine-wide installation may link here; do not
fork the instructions into a second copy.

Read [the source map and verification recipe](references/verification.md) when
changing or testing a scene. It identifies the authoritative implementation,
the runnable checks and their coverage limits.

## Define the shot and reproduce the failure

Record the settlement, site/design/upgrade level, era, viewport, starting camera
pose, timestamp and playback mode. Include the initial approach and return to
the player's view: a clear final keyframe does not prove either transition.
Use a disposable town; an owner's screenshot is context, not authorization to
change their save. For a reported obstruction, retain a failing camera/terrain
test or reproducible capture before fixing it.

State the player-visible acceptance check: for example, the monument and its
court remain visible through the complete reveal, without the crater rim
crossing the view. Keep each feature's content in definitions or its effect
adapter; reuse the shared camera and playback lifecycle.

## Camera and terrain

- Use the active map's terrain function. The valley uses
  `cameraTerrainHeight`, which includes the mine hillside; the Moon supplies
  `moonHeight` through `terrainHeight`. Model placement can use `surfaceHeight`;
  it is a different question from camera clearance.
- `keepCameraAboveTerrain` protects the camera and near plane. It deliberately
  permits a hill to hide distant parcels during manual exploration. Do not
  tighten player orbit controls to fix cinematic shots.
- `clearCinematicTerrain` also protects the line of sight to the subject's court.
  Apply it after camera/focus interpolation, rather than only to authored
  endpoints. Blended targets can pass through hills too. Verify the rendered
  mesh as well as the analytic heightfield: coarse triangles can bridge a dip.
- Recheck the whole shot after crater radii, terrain, parcel positions, site
  facings or monument geometry change. Portrait framing pulls the camera farther
  out and can put it beyond a rim. Checking height under the eye alone misses
  intervening ridges and a court hidden below a visible rooftop.
- Preserve the intended heading and readable subject framing when correcting
  terrain. Inspect the whole subject and its silhouette, scaffolding, crowd and
  fountain court; a clear center ray is necessary but does not prove the edges
  remain visible. Buildings, trees and temporary props can occlude a shot too.
- Review motion in time, including shot joins and terrain corrections. Look for
  abrupt elevation changes, sideways swings, repeated correction drift, jitter,
  excessive zoom and near-plane clipping. Do not fix occlusion by hiding terrain.
  Adjust authored paths when shared clearance produces poor composition.

## Playback, ownership and presentation

- `TownPresentation` owns the main scripted camera and temporary effect cleanup;
  `useCinematic` owns the full-screen clock. Reuse them for new adapters. Insets
  use independent cameras and the shared scissor/viewport helper.
- Keep cinematic content on its site's settlement. Ordinary construction uses
  `TownConstruction`, without a new cinematic. Taps keep the camera still;
  explicit navigation and cinematic playback may move it.
- Test normal finish, Skip, Continue, pause/resume, tab hiding, scene disposal,
  map changes and replay. Hidden time must not jump a scene ahead. Restore camera,
  target, overview state, control availability, glow, lights, fog, background,
  renderer viewport/scissor and temporary resources as applicable. Controls must
  stay disabled when another owner, pause or covered map still holds them.
- The final rendered frame must remain intact while Continue waits. Background
  quality adaptation must not resize and clear the drawing buffer then. Return
  interpolation must clear terrain and settle at the saved player pose.
- Reduced motion keeps the camera still and settles effects without flashes,
  rockets or animated construction. Review the 2D/unavailable-WebGL fallback
  when changing completion or acknowledgement behavior.
- Completion, purchases, earnings and rewards belong to game state. Playback,
  replay, Skip or disposal must not grant them again or undo completed work.
  Preserve pending/seen receipts. A camera fix does not need a new state machine;
  changes to consequential state transitions need the repository's invariant
  and interleaving checks.
- Check English and French captions, title/subject consistency, letterboxing,
  safe areas, focus, keyboard Skip/Continue, accessible dialog naming and focus
  return. Captions and controls must leave the action readable on narrow phones
  and short landscape screens. Scene audio must stop on hidden/closed playback.

## Evidence and delivery

Run the relevant regressions and real renderer recipe in the reference. Sample
the entire timeline, not just chapter boundaries; review a normal-speed playback
or a frame sequence when changing motion. Retain keyframes for approaches,
occlusion risks, reveal, finale and return. A screenshot cannot establish smooth
motion, and a ray test cannot establish composition.

For frame-code changes, run the required frame budget and production bundle gate.
Profile before optimizing. Browser/software-WebGL results are not phone results;
label untested physical-device behavior. Do not raise budgets to clear a failure.

Report the actual scenarios, failing-before/passing-after evidence, rendered
captures, checks run and any gaps. Follow the checkout's delivery rules; this
skill grants no deployment, publication, messaging or merge permission.
