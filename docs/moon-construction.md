# Construction feedback in New Hollow

Moon buildings use the campaign's existing offers, puzzle-driven construction,
builder hammers, completion action, benefits, rewards and saved presentation
receipts. They have no separate construction clock or progression rules.

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
  `constructionVisual`, `buildingStatusLabel` and `TOWN_ACTIONS`.
- The direct finish/collect interaction. Moon buttons now emit `select` through
  `TownScene.choose` to `TownView.selectBuilding`, the same route as valley taps.
  Read-only inspection keeps its existing separate route.
- Affordable-upgrade feedback. Both scenes use `TownUpgradeGlow`, and both maps
  receive the same computed indicators and available purchases from `TownScene`.
- Floating per-building action markers. The Moon consumes the entire shared
  indicator map and action registry, including collection actions; current Moon
  definitions do not independently produce saloon coins or forge TNT.
- A local completion effect. A short lunar spark burst follows a changed saved
  building finish, including builder-hammer upgrades. It follows the Moon's
  existing paced animation clock and pause/visibility state. Reduced motion
  skips it and clears any burst already in flight.
- A projected collection origin, so shared reward feedback can originate at a
  Moon building rather than falling back to the centre of the valley view.

The build directory, next-step guidance, project milestones, resource reward
overlay and campaign builder logic already use settlement-independent data and
remain shared. Mine-era construction ceremonies and town-square fireworks are
their own presentations, not per-building worksite indicators. Moon event and
spacecraft presentations are separate from this change.

Sites are cached independently from the merged settlement mesh. Advancing a
project therefore does not rebuild buildings, settlers or access paths. Replacing
or removing a site disposes its owned merged geometry; primitive geometry and
palette materials remain shared until scene disposal. Acting on a ready hammer
removes the saved project, its worksite and its ready marker. Any subsequent
upgrade hint represents a new available purchase.

`testing/moon-construction.test.js` covers every Moon building from funded site
through progress, readiness and the real campaign completion action, plus
upgrades, future saved-finish changes, resource labels, reloads and disposal.
`testing/browser/moon-input.cjs` covers the select-event route alongside native
keyboard, mouse/touch, camera and Earth-return interactions.
