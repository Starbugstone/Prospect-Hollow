# Future release: optional town side quests and landmark cinematics

Status: design proposal for a future release, explicitly outside the current
release. Related context: [issue #41](https://github.com/Starbugstone/Prospect-Hollow/issues/41).
Source audit: `8aa015efc4bfd542dc1118a81713954ad0964d88`. This branch contains
documentation and concept art only; it must not be merged into the current release.

## Goal and boundaries

Give players enjoyable reasons to revisit completed buildings, with characterful,
high-quality cinematic rewards and permanent cosmetic mementos. Introduce the
interaction in the Frontier, then expand its ambition as the town grows.

These are optional side quests. Ignoring every quest must leave the complete main
campaign, era advancement, puzzle unlocks, construction, income, bonuses, incident
handling and existing rewards identical. Current-release town project guidance
(package A) is separate: it organizes existing construction without activating
these future quest counters, cosmetics or cinematics.

No new currencies, paid boosters, purchases, advertisements, seasonal passes,
daily deadlines, expiring progress, upkeep, prestige resets or mandatory replay
requirements are included. No move or turn limits or hard gameplay timers, in any
quest, mastery objective or replay. Score/speed thresholds may only remain existing
optional bonuses; missing them cannot prevent normal completion or quest progress.

## Concept art

These are aspirational art-direction boards generated with the built-in image
tool. They are not implemented assets, rendered gameplay or final approved art.
Their detailed characters and lighting exceed the current miniature renderer;
production must preserve the game's faceted silhouettes, cream/ochre buildings,
muted teal roofs and sage greenery. Concept architecture is reference material,
not authorization to replace the town layout or building footprints.

![Horse field show and park dog day concepts](concepts/landmark-side-quests/horse-and-dog-concepts.png)

![Steam, Aviation, Broadcast and Connected City cinematic concepts](concepts/landmark-side-quests/era-cinematic-concepts.png)

See [exact prompts and provenance](concepts/landmark-side-quests/README.md).

## Player flow

1. After an eligible building finishes, its normal construction completion occurs
   as usual. A small optional **Town stories** badge appears; it opens no modal.
2. The player opens a story card: a three-step illustrated track, exact building
   prerequisites, cumulative puzzle counts, cosmetic previews and **Start**.
   **Later** dismisses it without penalty. Ineligible future stories remain quiet
   previews inside this panel, never alerts in the normal puzzle flow.
3. Starting selects one active story. Every subsequent normally completed puzzle
   adds one completion to that story, including legitimate replays. Money, chests,
   construction and ordinary progression apply once through the existing pipeline.
4. Only the selected story accumulates completions. Switching or pausing is free;
   counters persist. There is no progress decay. Progress can accumulate to the
   story's final threshold before later building prerequisites are met.
5. When both a tier's puzzle count and building prerequisite are satisfied, mark
   it **Ready to celebrate**. Show a quiet badge. The player explicitly claims it
   from town when convenient; never interrupt a puzzle, incident or era scene.
6. Claim grants one permanent cosmetic entitlement and offers the celebration.
   **Skip** still grants the same reward. **Replay** later plays the scene without
   further rewards. Multiple ready tiers can be claimed without watching a queue
   of forced scenes. The final camera returns to the player's saved town view.

All counts below are proposed playtest targets, not verified retention targets.
They count completions after story opt-in, cumulatively within that story: 4/8/12
means twelve total, not twenty-four. Abandoned or failed technical sessions count
zero. Puzzle receipt IDs deduplicate retries, reloads and reward acknowledgements.
Time played, speed, score, spending and roulette choices are never prerequisites.

## Specific building progression

Use actual building IDs and unlock eras. `stable` exists in Frontier;
`horseField` first appears in Industrial (and already requires `stable` level 1);
`park` first appears in Motor Age. Do not move the latter two buildings into
Frontier to teach this mechanic.

For this specification, **L1/L2/L3** means the building's original functional
construction stage. **I1/I2/I3** means its Industrial modernization tier. Higher
stages satisfy lower stages. Record these achievements monotonically so later era
changes never remove eligibility. Migration may infer historical Industrial tiers
only when a later era's existing advancement rules prove they were completed;
otherwise require trustworthy saved building history. Never require a player to
downgrade or rebuild. Building work completed with a hammer qualifies normally;
the hammer does not advance or bypass the separate story puzzle counter.

| Story and earliest availability                                                               | Tier 1                                                                                         | Tier 2                                                                                                                                                  | Tier 3                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A welcome at Dusty Spur** — Frontier; `stable`                                              | 2 puzzles + stable L1: Kit introduces the horse; stable welcome sign                           | 4 puzzles + stable L2: groom-and-lead scene; decorative grooming rail                                                                                   | 6 puzzles + stable L3: carriage-yard welcome; small horseshoe plaque                                                                                                                  |
| **Willow horse field show** — Industrial; `horseField`                                        | 2 puzzles + horseField L1: handler greets/grooms one horse; decorated grooming rail and ribbon | 4 puzzles + horseField L2: two horses complete a gentle walk/trot presentation; low practice pole and decorative rosette board                          | 6 puzzles + horseField L3: three-horse presentation and low-pole demonstration; champion-field ribbon on the sign and show rail dressing                                              |
| **Railway exhibition** — Industrial; `railDepot`, `warehouse`, `mill`                         | 4 puzzles + railDepot I1: arrival rehearsal; platform pennants                                 | 8 puzzles + railDepot I2 and warehouse I1: freight demonstration; decorative railway clock                                                              | 12 puzzles + railDepot I3, warehouse I2 and mill L1: exhibition opening; locomotive display plaque                                                                                    |
| **Park dog day** — Motor Age; `park`                                                          | 2 puzzles + park L1: dog meets owner by bench; flowerbed dressing and dog-day bench sign       | 4 puzzles + park L2: fetch practice along a clear park route; low training cones and decorative ball basket                                             | 6 puzzles + park L3: full fetch/run/low-jump/return celebration; commemorative paw-print plaque and dog-day garden dressing                                                           |
| **Prospect air festival** — Aviation; `airport`, `radioTower`                                 | 4 puzzles + airport L1: terminal welcome; terminal/apron bunting outside movement routes       | 8 puzzles + airport L2 and radioTower L1: taxi and radio-check presentation; vintage aircraft exhibition on a separate safe display pad and route board | 12 puzzles + airport L3 and radioTower L2: inaugural departure/flypast; selectable period aircraft livery and festival terminal dressing                                              |
| **Prospect live premiere** — Broadcast; `concertHall`, `television`, `skyline`                | 4 puzzles + concertHall L1: rehearsal; concert poster frame                                    | 8 puzzles + concertHall L2 and television L1: broadcast rehearsal; studio premiere plaque                                                               | 12 puzzles + concertHall L3, television L2 and skyline L1: full concert premiere with skyline reveal; coordinated marquee appearance                                                  |
| **Riverlight opening** — Connected City; `transitHub`, `riverPark`, `crystalLab`, `cityHomes` | 4 puzzles + transitHub L1 and riverPark L1: first promenade arrival; district banners          | 8 puzzles + transitHub L2, riverPark L2 and crystalLab L1: campus open house; decorative campus sculpture                                               | 12 puzzles + transitHub L3, riverPark L3, crystalLab L2 and cityHomes L1: tram/riverfront/tower evening celebration; selectable warm-window appearance and commemorative river plaque |

Existing building costs and construction durations remain unchanged. In
particular, the airport and towers keep their agreed two-puzzle initial
construction and one-puzzle upgrades. Side-quest readiness never occupies a
construction slot or withholds a building's service.

The short Frontier story teaches **choose → play → claim → keep a memento**.
The Industrial horse show introduces a richer animal performance. Motor Age dog
day gives a familiar, short story between larger projects. Later landmark stories
take longer but deliver intermediate visible rewards at four and eight puzzles.
No story requires another story, and none expires when its era ends.

Every tier creates a distinct permanent 3D appearance on the actual plot, not
just a label, counter, menu illustration or journal icon. Tier 2 adds to tier 1;
tier 3 completes a coordinated event appearance. Decorations remain inside the
existing footprint and clear animal, pedestrian, vehicle and camera routes. A
cosmetic toggle restores the undecorated appearance without losing ownership.

### Optional mastery for committed players

After a base finale is claimed, offer a separate opt-in **Encore** track. It
observes existing naturally created board bonuses across unlimited normal
puzzles; it never grants extra gameplay bonuses or requires spending inventory.
Proposed first targets: horse show 12 bonuses, dog day 16, railway/airport 20,
Broadcast/Connected City 24. These are cumulative design targets for playtesting,
not per-level quotas. Additional combination-type goals can be evaluated later
only if every required combination is naturally achievable in eligible boards.

Progress persists between puzzles, pauses, era changes and reloads, with receipt
deduplication. Any puzzle with no qualifying combination simply adds zero, never
fails or resets mastery. There are no move/time caps, speed or score thresholds,
streaks or payment requirements. Mastery never gates the base track, its listed
rewards, another side quest or the main campaign.

Mastery unlocks a distinct permanent 3D rosette/plaque and an optional 12–16 second
encore with additional choreography: a horse presentation with turn, low-pole
step and settled bow from its handler; a dog agility loop with a safe low jump,
fetch and return; a three-aircraft formation after a single-plane departure; a
railway salute with synchronized station/crew reactions; a concert encore with
coordinated performers; a riverfront procession with tram and boat arrival. These
are additional authored scenes, not longer confetti or duplicated camera orbits.
The early Frontier teaching story has no mastery requirement or promotional nag.
Implement mastery after the basic flow and its animation benchmark are proven.

## Cinematic direction and shot lists

Tier 1 and 2 reveals target 2–4 seconds, focused on one readable action and the
new permanent 3D state appearing on the actual plot. Frontier finale targets 8
seconds; other standard finales 10–14 seconds (shot lists below use 10 or 12);
optional mastery encores 12–16 seconds. Durations are direction targets, not
timers the player must endure.
Every scene is skippable immediately, replayable and silent when audio is muted.
Remember skip/reduced-motion preferences. Build anticipation with a brief audio
rise and held action, then deliver the main motion, resident reaction and reward
hold. Do not autoplay the reveal again after every puzzle or reward revisit.

Use authored camera curves with eased velocity and stable horizon. Anticipate the
action before it happens, show contact and reaction, then hold the reward clearly.
Avoid shaking, flashing, particle curtains, repeated orbit shots and reward noise
that hides the town. Foreground actors, a few responding residents and a clear
sound motif create the payoff. Respect current era dress and the real parcel paths.

| Finale                       | Shot-by-shot timing and action                                                                                                                                                                                                                                                                                                                                                                | Audio and final reward hold                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Dusty Spur welcome, 8 s**  | 0–2 s: eye-level stable-yard establishing shot, Kit opens a safe gate. 2–5 s: horse turns ears toward Kit, lowers its head for a brush stroke, then takes two weighted steps. 5–7 s: carriage guests acknowledge Kit and the horse; camera eases out. 7–8 s: readable plaque on stable sign.                                                                                                  | Soft hoof contacts, leather and a short warm acoustic phrase; no forced dialogue.                                   |
| **Horse field show, 10 s**   | 0–2 s: low three-quarter paddock reveal with handler and audience safely behind fence. 2–6 s: side tracking shot of a gentle trot slowing to a walk over a low pole; show all four legs and planted contacts. 6–8 s: handler stops, horse exhales/nuzzles; other horses remain calm behind. 8–10 s: handler raises ribbon, audience reacts, camera holds the decorated sign.                  | Hoof sounds aligned to contacts, quiet breath, restrained applause and a short fiddle flourish.                     |
| **Park dog day, 10 s**       | 0–2 s: owner kneels by bench, dog anticipates a soft throw. 2–5 s: ball arcs and bounces into an unobstructed patch; dog accelerates along a continuous route, makes one safe low hop and picks it up. 5–8 s: three-quarter tracking return, slowing to owner's hand; dog releases ball, owner pets head, tail wags. 8–10 s: gentle pullback reveals paw plaque and nearby smiling residents. | Cloth-ball bounce, light paws, one happy bark after release, gentle woodwind phrase.                                |
| **Railway exhibition, 12 s** | 0–3 s: wheel-height approach along the actual rail spline, backlit steam. 3–6 s: eased tracking alongside driving wheels and rods as train decelerates. 6–9 s: platform-height stop and a worker's welcoming signal, freight yard visible beyond. 9–12 s: modest crane reveal of depot, warehouse and mill; hold plaque beside platform.                                                      | Rail rhythm slows with wheel rotation; soft brake/steam, station bell and brief brass resolution.                   |
| **Air festival, 12 s**       | 0–3 s: apron-level terminal reveal, aircraft already aligned on clear runway. 3–7 s: side tracking takeoff roll with accelerating propellers and wheel contacts. 7–10 s: smooth rotation, climb and gentle bank toward open airspace. 10–12 s: terminal crowd looks up; wide hold reveals aircraft livery and recognizable tower.                                                             | Propeller pitch follows acceleration, restrained crowd reaction, radio chime and uplifting short orchestral phrase. |
| **Live premiere, 12 s**      | 0–3 s: audience-height approach toward stage; musicians anticipate the final phrase. 3–7 s: medium stage shot with coordinated instrument gestures and a broadcast camera operator. 7–10 s: musical resolution, performers bow and crowd responds in staggered groups. 10–12 s: eased crane reveals studios and business tower; marquee remains legible.                                      | Original/licensed short music phrase synchronized to performance, crowd below music, no rapid strobe lighting.      |
| **Riverlight opening, 12 s** | 0–3 s: promenade-height tram arrival at real transit stop. 3–6 s: doors open after full stop; residents step to the platform and wave. 6–9 s: camera follows a family a few steps toward the river, campus beyond. 9–12 s: slow crane reveals towers and river; windows brighten in one gentle wave, ending on plaque and warm skyline.                                                       | Tram bell, quiet doors/footsteps, river ambience, short musical resolution. No futuristic holograms.                |

Cinematic actor movement must use continuous positions and authored collision-free
routes. Never teleport a horse, dog, vehicle or resident into its final pose.
For historical scenes claimed in a much later era, use a clearly marked journal
recollection with the appropriate cached building/character variants, or a
present-day heritage event. Select one approach during the first art prototype;
never temporarily downgrade the saved town or mix incompatible period geometry.

## Asset and animation production

- Build/refine actual meshes, rigs and clips in Blender. Deliver editable `.blend`
  sources, export scripts/settings and optimized runtime assets using the existing
  browser renderer pipeline. The concept PNGs are not runtime textures or assets.
- Horse rig: four distinct limbs with hoof contacts, shoulders/hips, neck/head,
  expressive ears and restrained tail. Author idle, walk, trot, decelerate, pole
  step, nuzzle and settle. Verify weight shifts and hoof placement from both sides;
  no sliding feet, intersecting poles or pavilion collisions.
- Dog rig: four limbs, flexible spine, jaw/muzzle, ears and tail. Author anticipate,
  run, brake/turn, pick up, carry, release, receive pet and sit. Ball attaches only
  at jaw contact and detaches at release; no floating through muzzle or owner.
- Vehicle animation follows current town paths. Rail wheels/rods follow distance;
  aircraft rotation follows credible forward movement and clear terrain; tram
  doors open only while stopped. Keep crowds off rails, runway and road lanes.
- Preserve readable low-poly silhouettes on mobile. Bake suitable lighting/AO,
  reuse materials and atlases, pool actors, cache route samples and animation
  bindings, and release scene-specific resources when no longer needed.
- Stage cinematics against actual final parcel geometry, all building levels and
  later-era variants. Decorations must not obscure paths, controls, animals or
  construction states. Cosmetic toggles must not change collisions or economy.

## Persistence, interruptions and accessibility

Keep versioned side-quest state independent from main progression: active story,
per-story completion count, monotonic building achievements, claimed tier IDs,
cosmetic entitlements and cinematic history. Reuse the normal completion receipt
as input, but never mutate its financial outcome. Make quest counting, claims and
entitlement writes idempotent and robust to reload/import between each step.

Existing saves get an empty optional story journal and current building
eligibility; do not fabricate historical puzzle counts from total level or score.
No completed construction or already-earned main reward is replayed or revoked.

A ready claim waits while an era transition, incident, reward modal or another
cinematic is active. Returning to town is not implicit permission to autoplay.
Pause timeline/audio on hidden tab or lost focus; resume safely. Reload during a
scene preserves the claimed reward and offers replay, never a duplicate payout.
Skip, reduced motion, mute, failed asset load and WebGL context loss all leave the
reward claim and main gameplay accessible. Restore camera, input, audio state and
existing event queue reliably on every exit path.

Reduced motion uses a composed static or gently eased shot and clear reward card,
with the same entitlement. Provide captions for meaningful audio, keyboard/touch
claim and skip controls, visible focus and safe mobile placement. Do not require
sound, camera motion or precise reaction timing to understand or finish a story.

## Quality and release acceptance

- [ ] Package B remains a future-release issue; current release contains no quest
      runtime, premium features or new cinematic dependencies from this branch.
- [ ] All seven stories use real building IDs, correct unlock eras and the exact
      cumulative counts/prerequisites agreed after playtesting.
- [ ] Skipping all stories leaves campaign, era completion, income, bonuses,
      construction and puzzle progression unchanged against a control save.
- [ ] Unlimited moves and continued play after optional speed/score targets are
      tested in normal chapters, story progress and replay flows. No hard timers.
- [ ] Early stable introduction teaches the flow without moving horseField or
      park earlier, adding mandatory Frontier costs or forcing a tutorial modal.
- [ ] Pausing/switching stories, hammers, repeated receipts, late-era claims,
      old-save import, reload, skip and replay preserve accurate progress and
      exactly-once cosmetic grants.
- [ ] Every tier has a distinct permanent 3D cosmetic state on the actual plot,
      an accurate preview and a short authored in-world reveal. Approved rendered
      storyboards/key poses match the art direction before final animation work.
      All final scenes have reviewed Blender source, animation playblasts and
      real-browser recordings; concept sheets, slideshows and placeholder motion
      do not satisfy visual acceptance.
- [ ] Optional mastery has cumulative non-resetting receipt-backed progress,
      distinct 3D mementos and richer choreography; no spending, move/time caps
      or effects on base-quest/campaign completion. All cinematics restore control
      and preserve rewards on skip, failure and reload.
- [ ] Horse and dog clips pass four-limb/contact/path inspection, with no geometry
      intersections, foot sliding, teleporting, broken jaw/ball attachment or
      clipping against furniture and pavilions.
- [ ] Cinematic camera, action, audio, lighting and return-to-control satisfy the
      shot lists on desktop and narrow mobile viewports, including reduced motion.
- [ ] Target fluid 60 FPS on a named representative supported mobile device and
      desktop browser; record frame-time distribution, draw calls, triangles,
      peak memory and warm/cold asset loading. This is a future test target, not
      a claimed current measurement. Scope art/effects to actual device results.
- [ ] Inactive quests add no per-frame scanning or persistent cinematic actors.
      Verify idle-town frame time against baseline; preload without blocking input,
      dispose cleanly and test repeated scene playback for memory growth.
- [ ] Full existing regression suite/build and actual browser workflows pass;
      inspect console/network errors and final-era transitions with unclaimed quests.

## Suggested implementation sequence for the future release

1. Prototype the independent journal/receipt/claim system plus Frontier stable
   story. Validate save migration and non-interference before broader content.
2. Produce one complete Industrial horse-field finale as the animation-quality
   benchmark; then park dog day with the same camera/claim lifecycle.
3. Add Steam railway exhibition and verify historical/later-era playback handling.
4. Add Aviation, then Broadcast, then Connected City stories, each with its own
   animation and mobile performance review. Do not ship placeholder celebrations.
5. Playtest cadence and optional participation before adjusting counts. Preserve
   money gains/bonuses and avoid making story completion a main-campaign metric.

Success observations: players voluntarily opt in, claim and equip the mementos,
watch/replay scenes and return after town construction; main-campaign completion
and responsiveness do not worsen. No retention or revenue uplift is claimed by
this specification, and monetization remains outside its scope.
