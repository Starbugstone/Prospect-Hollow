# Extending eras without repeating rules

`src/data/eras.js` is the authoritative ordered era catalog. Each entry's
`evolution` profile describes its shared building style, modernization prices,
capacity tiers, transport, electrical infrastructure, incident type and art
family. Gameplay, the Three.js town and the accessible Vue drawings read these
capabilities through `eraEvolution()` instead of maintaining separate era lists.
Unknown save identifiers fall back to the Frontier profile.

`defineEra()` in `src/data/eraDefinitions.js` applies shared style defaults,
validates required prices and assets, and freezes the resulting profile. This
happens once when the catalog loads, outside animation loops. Invalid authored
definitions fail early; they do not silently become a partially supported era.
The factory copies arrays so one era cannot mutate another's defaults.

## Reuse an existing visual style

Add an era entry with its identity, campaign metadata and evolution profile.
Choose `river-rail`, `industrial`, `motor-age` or `city` and supply the three
modernization prices. City profiles also declare their Blender asset family and
three new-building prices. Override capabilities, tier capacities, road color,
copy or detail assets where this era differs from the shared style.

The modernization offer factory in `src/game/town/TownModernization.js` combines
that profile with an appearance provider. It owns the common offer structure,
stage progression and capacity-benefit text. Eligibility remains in `TownEras.js`;
building-specific exceptions, including landmark construction duration, remain
explicit. Mining income and bonus formulas are outside this contract.

The rendering registry in `buildings/BuildingRenderer.js` selects the style's
landmark and modernization renderers. City asset aliases resolve the longest
matching era prefix, allowing names such as `aviation-next` without accidentally
selecting the `aviation` prefix. Existing style geometry remains shared; new era
identity can come from its configured asset family, detail asset and capabilities.

An era still needs its actual content: campaign placement, buildings, projects,
translated copy and any new art. A definition does not manufacture those assets.

River & Rail and Industrial final upgrades use `src/data/heritageUpgrades.js`
to map each building's original kind to a useful expansion. `HeritageDetails.js`
and `TownHeritageUpgrade.vue` render that shared choice: for example, a post office
gets dispatch rooms and telegraph fittings while a shop gets a trading awning,
even though their original building shells are aliases. Preserve the original kind
before resolving a shell alias. Unknown kinds get no speculative decoration.
Do not use a universal clock tower as a completion marker. Motor Age buildings
that inherit industrial geometry inherit these working expansions too.

The gallery exporter records each building's introduction era. Its wiki packager
places new buildings first, then existing buildings and the mine, with links to
every entry. Regenerate captures after geometry changes; a changed mesh signature
alone does not establish that an upgrade is visible from the camera.

Airport architecture uses the optional `airportStyle` capability. The shared
`src/data/airportStyles.json` catalog drives Blender authoring, runtime asset
selection and the SVG fallback through `airportAppearance()`. Regional (1958),
metropolitan (1986) and connected (2005) definitions each export a base, lounge
and finishing stage. New eras can inherit a style without renderer changes;
missing or unsupported styles safely use the regional airport. The renderer
receives the building's completed era, so entering a new town era alone never
modernizes the airport. `testing/airport-art.test.js` checks extension/fallback,
stage selection, site bounds and wing clearance.

## Introduce a genuinely new style

Extend the documented `BuildingStyle` / `EraEvolution` contract and defaults in
`eraDefinitions.js`, then register its appearance provider in `TownModernization.js`
and its rendering provider in `BuildingRenderer.js`. Implement the accessible
drawing and mine representation for the new style when their existing capabilities
cannot express it. These are JSDoc interfaces and small factories, appropriate to
this JavaScript project; a class hierarchy is unnecessary.

Keep era-specific artistic details inside their renderer. Share repeated rules
and capabilities rather than flattening distinctive buildings into one generic
design. A new capability used by several systems belongs in the era profile;
avoid adding the same era-name conditional independently to each consumer.

## Regression evidence

`testing/era-definitions.test.js` covers invalid definitions, immutable shared
defaults, unsupported save identifiers, overlapping asset prefixes and a synthetic
future city era. Synthetic successors to all four later building styles produce
the same mesh signatures as their base style, including mine evolution.
`testing/building-era-contract.test.js` exercises the production rendering
registry across every existing building and era.

During this refactor, all 32 before/after town snapshots matched exactly: eight
eras at four construction states, covering every modernization offer, capacity,
transport choice, road surface, electricity rule, incident, city variant and gate.
The first 144 focused existing regression tests and the 12 new extension tests
passed. The release's full verification and browser checks supplement this
targeted evidence; simulated extension tests cannot guarantee all future content.

Future optional events and cinematic transitions have a separate framework design
in [issue #42](https://github.com/Starbugstone/Prospect-Hollow/issues/42). This release
does not implement that deferred event runtime.

### Building completion presentations

`data/townPresentations.js` defines completion scenes and their saved receipts.
The campaign store queues a receipt in the same transaction as first construction
or a builder hammer completion; upgrades and old completed saves do not queue it.
`normalizePresentations` validates supported receipts without inventing events.
Acknowledging or skipping a scene changes only its receipt, never its rewards.

`TownPresentationCinematic` owns the shared skippable timeline, pause behavior,
reduced-motion still, and accessible dialog. `TownPresentation` owns camera capture,
restoration and temporary renderer cleanup; content adapters supply scene visuals.
The railway opening lays track, excavates the bore under dust, assembles both stone
arches and sends the first train through. Until the station is completed, the hill
stays solid and there are no rails or portals. The saved station and its rail line
remain complete if the presentation is interrupted; its pending scene can resume
on the next village visit. This completion presentation is separate from the
optional-event framework deferred in issue #42.

### Incident cameras

`TownEventCamera.INCIDENT_SHOTS` assigns two subjects to each incident kind.
Bandits and cargo thieves use the main tracking camera with the responding patrol
in an inset. Fires and storm cleanup follow the response squad while the inset
holds on the incident props. Era definitions continue to select the incident kind;
new eras that reuse a kind automatically receive both views.

The shared camera helper fits moving groups to the viewport, follows the leading
responders in the smaller window, and falls back to the incident site for unknown
kinds or absent patrols. Both views use the village clock and the same animated
instances. The inset renders scenery and actors with its own depth, restores the
renderer viewport/scissor afterward, and disappears on completion, skip, or
reduced motion. `TownScene` supplies its translated caption and border.

`testing/incident-cameras.test.js` covers subject separation, moving and staggered
groups, portrait framing, pause/skip cleanup, renderer-state restoration, and
unsupported receipts. The incident actor tests also check that dismounted crews
stand outside their vehicle and storm branches sit above the promenade pavement.

### Period architecture and mine construction

`cityStyles.json` drives the city Blender exporter, runtime landmark additions and
SVG fallback through `cityAppearance()`. Each city era names its own `cityAssets`
family. The 1958 family uses ribbon windows and broad cornices; the 1986 family
uses concrete blades and stepped parapets. Roof gardens, solar geometry and
connected transport details belong to the contemporary profile. Future eras can
reuse an existing family; incomplete appearance lookups safely fall back.

`mineAppearance()` derives permanent surface equipment from the same era art
family. `addMineWorks()` builds the permanent site and the cinematic model, so
finishing or skipping cannot leave different versions behind. Its cached scenery
batch is separate from the underground shaft and the chapter equipment.

The `era-mine` content adapter uses the common `TownPresentation` camera lifecycle.
`TownBuildSequence` stages named sections, arriving workers, carried supplies and
hammering; callers provide their assembly, timing and work positions. The era
receipt remains the persistence authority. The timeline waits for graphics,
pauses with the view, and resumes a pending receipt on the next village visit.
Reduced motion shows the complete result without camera animation. Graphics
fallback uses the SVG era drawing and a still completion dialog.

`testing/building-era-contract.test.js` checks every available building and all
three later-era stages. `city-era-art.test.js` checks period families, exported
technology details and future/fallback definitions. `mine-era-construction.test.js`
covers all seven transitions, worker motion, completion, batch replacement,
skipping, camera restoration and reduced motion.

For reproducible snapshots, run `npm run dev`, open
`/scripts/era-art-review.html`, and export each era's PNG data to
`output/era-art-data/<era>.json`. Run `python3 scripts/package-era-art-review.py` to
write the individual PNGs, comparisons, wiki galleries and downloadable archive.
The review uses production renderers and real plot positions, including dock
lengths. See [the visual guide](wiki/Era-Visual-Guide.md).
