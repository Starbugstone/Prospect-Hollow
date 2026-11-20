# Cinematics: clear terrain on both settlement maps

**Prerequisites:** fresh runner stack and passing doctor. No account. The fixture
creates disposable Twin Hollows towns in memory, with finished buildings and
first-level monuments. It does not modify a real player's save.
**Command:** `bash scripts/verify-gameplay.sh run "$RUN" cinematics`.
**Implementation:** `testing/browser/cinematic-terrain.cjs`.

1. Open the real valley renderer, then the Moon renderer, in a fresh context at
   390 × 844 and 1280 × 800.
2. Start the real shared monument presentation at Founders’ Meadow, Monument
   Square, Earthrise Plaza and Earthlight Conservatory. For each, use the overview
   pose and a low pose outside the settlement or crater rim.
3. Discover the terrain's vertex-colored source meshes, including the valley's
   exposed mine face and connected shoulder. Include their hidden batching layer
   in raycasts. A downward self-check must hit the ground before auditing shots.
4. Sample each 16-second timeline every 0.25 seconds. Cast a ray from the camera
   toward the court near ground level; no rendered terrain mesh may block it.
5. Render and capture the approach at 0.75 seconds, the reveal at 7 seconds and
   the final low shot at 16 seconds. Assert the renderer drew the scene and inspect
   the images for readable subjects and unwanted foreground occlusion.
6. Apply the reduced-motion final frame and check that it leaves the camera still.

Expected: 48 rendered keyframe captures, a passing terrain self-check on each
scenario, no blocking terrain rays, and no uncaught or console errors. This is
a sampled scene fixture; it does not exercise the normal UI entry, captions,
audio, persistence, every design or every camera pose. Unit coverage for all
current site choices and representative upgrade levels lives in
`testing/cinematic-terrain.test.js`.

Evidence: `cinematics.log`, `artifacts/cinematics/report.json` and 48 PNGs.
The report includes eye/focus coordinates, terrain mesh count and sampled frame
count. Evidence uses the run-specific output mount and survives cleanup.

For normal-speed silent recording, framing review, all related regression
commands and known limitations, use the shared
[cinematic skill](../../prospect-hollow-cinematics/SKILL.md) and its
[verification reference](../../prospect-hollow-cinematics/references/verification.md).
Its capture option records a `.webm` and per-frame timing/pose metadata.

Harness failure proof: run
`PH_CINEMATIC_INJECT_OCCLUSION=1 bash scripts/verify-gameplay.sh run "$RUN" cinematics`.
It must exit unsuccessfully with
`Terrain blocks valley at 0s`; the injected view looks through the known ground.
Do not accept a passing mutation or remove the self-check to pass a scene.
The runner automatically runs doctor after the failure, retaining
`doctor-after-cinematics.log`. Open a fresh browser before retrying; standalone
drives need their own doctor after failure.
Cleanup: the browser closes in `finally`; clean only the run-owned stack with the
shared cleanup command and confirm the images remain.
