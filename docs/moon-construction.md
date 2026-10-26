# Construction feedback in New Hollow

Moon buildings use the campaign's existing offers, puzzle-driven construction,
builder hammers, completion action, benefits and rewards. They have no separate
construction clock or progression rules, and like valley buildings they finish
with the construction reveal, not a cinematic.

The original Moon renderer watched building levels alone. A funded project did
not change those levels, so it drew an empty pad throughout construction. Its
labels treated every project as unfinished and its taps opened details directly,
bypassing the valley's ready/collect tap flow.

The valley affordances that were missing on the Moon were:

- A visible worksite for first construction and upgrades, with changes as puzzles
  advance the project. `MoonConstruction` supplies batched metal gantries, habitat
  ribs, prefabricated panels and a robotic crane. The SVG fallback has the same
  construction state with a matching gantry drawing.
- A completed-puzzle count, a persistent ready state, and the builder hammer with
  “Tap to finish”. Both maps use `constructionRuns`, `constructionReady`,
  `constructionVisual`, `TOWN_ACTIONS` and the shared status text of
  `buildingStatus` (`src/game/town/TownBuildingFeedback.js`), which the Build tab's
  lists also read.
- The direct finish/collect interaction. Moon buttons now emit `select` through
  `TownScene.choose` to `TownView.selectBuilding`, the same route as valley taps.
  Read-only inspection keeps its existing separate route.
- Affordable-upgrade feedback. Both scenes use `TownUpgradeGlow`, and both maps
  receive the same computed indicators and available purchases from `TownScene`.
  Valley plots keep the square `add()` glow. Moon lots use `addPolygon()`, whose
  halo and fading wall share the octagonal pad's corners, radius and lot rotation.
- Floating per-building action markers. The Moon consumes the entire shared
  indicator map and action registry, including collection actions; current Moon
  definitions do not independently produce saloon coins or forge TNT.
- The valley's construction reveal (`TownConstruction`), both when work starts and
  when a building is finished, including builder-hammer upgrades and later era
  finishes: new pieces settle top-down under a swinging hammer with a puff of
  dust. A starting worksite merges into one batch once it settles; a finished lot
  is drawn on its own during the reveal, then merged back into the settlement.
  It follows the Moon's paced animation clock; reduced motion and a fresh load
  show the result at once.
- A projected collection origin, so shared reward feedback can originate at a
  Moon building rather than falling back to the centre of the valley view.

The Build tab's list, next-step guidance, project milestones, resource reward
overlay and campaign builder logic already use settlement-independent data and
remain shared. Mine-era construction ceremonies and town-square fireworks are
their own presentations, not per-building worksite indicators. Moon monument
unveilings and the spacecraft are separate presentations.

Sites are cached independently from the merged settlement mesh. Advancing a
project therefore does not rebuild buildings, settlers or access paths. Replacing
or removing a site disposes its owned merged geometry; primitive geometry and
palette materials remain shared until scene disposal. Acting on a ready hammer
removes the saved project, its worksite and its ready marker. Any subsequent
upgrade hint represents a new available purchase.

Settlers live in the finished buildings. `MoonSettlers` gives each one a
deterministic day: leave a home's hatch, follow its public path from
`moonApproaches` to the ring road, cross to another built lot and shrink through
its hatch, rest indoors, then walk home. Every pose is a function of time, so
nothing is saved. The Saucer Pad is an open apron and is never entered. A lone
building sends its settlers on a lap of the ring; with nothing built they just
circle the ring. Settlers reuse the valley's villager skeleton, its walk cycle
(`swingLimbs`) and its path sampling (`walkPath`/`walkPose`), adding only a small
hop at each footfall, so they move like valley villagers. The monument unveiling's
crowd uses the same `moonSuitFigure`. Taps on the Moon go through the valley's
`createTapGesture`, and every parcel's tap target is sized to its roof (the ribbon
and its halo are sky, not the landing).

VIP visitors come to New Hollow too, under the valley's VIP rules and code
([VIP economy](vip-economy.md#settlements)). A climber rides the ribbon down to the
Ribbon landing (`MoonScene.moveTransports`) and the saucer settles on its pad; each
arrival may bring one VIP, who steps out of that lot's hatch in a suit with the valley's
gold badge and an outfit-coloured sash, tours the Commons, the Moonstone workshop and the
Earthrise lookout along the settlers' paths, shops inside them and leaves by the same
hatch. Tapping or hovering a VIP shows the valley's "VIP visitor" name label; the
camera stays put. `testing/moon-vips.test.js` covers both transports, the one-VIP rule,
the shops, receipts, hatches, the label and the shared-town case.

`testing/moon-settlers.test.js` checks that routes run hatch to hatch, keep off
other pads and walk without jumps, and that settlers appear or vanish only at a
hatch. `testing/town-upgrade-glow.test.js` checks that each lot's glow lines up
with its rotated pad and that the square valley glow is unchanged.

`testing/moon-construction.test.js` covers every Moon building from funded site
through progress, readiness and the real campaign completion action, plus
upgrades, future saved-finish changes, resource labels, reloads and disposal.
`testing/browser/moon-input.cjs` covers the select-event route alongside native
keyboard, mouse/touch, camera and Earth-return interactions.
