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
Do not use a universal clock tower as a completion marker. Motor Age landmarks
inherit the complete city shell selected by `baseCityEra` (Post-war by default),
including its paid stage, then add period frontage. They never restore an older
industrial shell.

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

Campaign milestones use the same presentation receipts and renderer lifecycle.
`campaignCompletion()` counts the authored normal levels only; the museum uses
that count and filters completed replays below three stars. Unplayed levels remain
part of the remaining total. `queueCampaignPresentations()` evaluates definition
predicates after victories and when loading older saves. The three-star milestone
queues once for a perfect collection, resumes while pending, and keeps its seen
receipt after acknowledgement. Continuous play never earns campaign stars.

`TownCompletionFireworks` provides the temporary square fireworks and three-star
finale. It restores the original sky, fog and light intensities on exit. Reduced
motion uses a still with no rockets or camera motion. Drawing-buffer quality changes
wait until the presentation closes, preserving the final image behind Continue.
`campaign-completion.test.js` and `completion-fireworks.test.js` cover qualification,
saved receipts, future milestone definitions, visual disposal and this final hold.
To reproduce a silent video, generate era demos and run
`scripts/capture-completion-fireworks.js` through Playwright CLI in a disposable
browser. Encode `output/playwright/completion-fireworks-frames/%05d.jpg` at 24 fps.

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
uses concrete blades and stepped parapets. `cityBuildingStyles.json` defines each
building kind’s family, footprint and identity. `cityAppearance(era, kind)` chooses
its own exported model and finishing stage; family models are fallbacks.
`scripts/city_identity.py` authors those models using the shared catalog.
Gardens, antennas, billboards and solar details are selected per building kind
and period. Housing never borrows the business-tower landmark. Future eras can
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

### Villagers and passive VIP visits

`src/data/villagerNames.js` is the editable, commented beta-tester honor roll.
Add quoted names to `female` or `male`, keeping names unique. Rebuild/redeploy to
publish edits. `vipVisitor()` draws uniformly from the combined name pool first,
then reads the selected entry’s gender; an independent draw leaves most visits
ordinary. Residents and construction crews stay unnamed. Era wardrobe capability
and gender silhouettes are shared by ordinary villagers and visitors. VIPs retain a gold badge while `townWardrobes.js` selects one of three
coordinated period outfits per visit, including coat length, hat, skirt and accessory.
The outfit draw is independent of the name/gender draw and stable during the visit. Their names appear on tap/hover in the main view.

`TownVipArrivals` owns transient visits, never campaign events or rewards.
Train, boat and airplane motion publish their actual arrival cycle and stopped
vehicle through `visitorTransports`; there is no independent arrival timer.
A successful VIP draw at that stop starts a six-second secondary-camera inset,
with a name tag above the guest. `TownInset` shares viewport/scissor rendering
with fixed incidents and always restores renderer state. Passive arrivals do not
move the main camera, disable controls, pause play, or intercept input. Fixed
presentations take precedence, and missed arrivals are discarded.
Main-view labels and collection badges that overlap an inset are temporarily
hidden, so they cannot paint over its secondary view; they return when it closes.

The visitor follows the street graph and returns to the same transport entrance.
Before passenger transport, foot visitors leave the stable, wander the village and
return through the same door; there is no vehicle-arrival inset for that foot visit.
Leaving the village (including mining) clears VIP state. Returning may start a
fresh visitor already partway through a walk, without replaying an arrival inset.
No VIP state is saved. With only a stable/visitor capacity, ordinary foot visits
can occasionally be VIPs; once passenger transport is built, named arrivals use
its vehicle cycle instead.

`testing/vip-visitors.test.js` checks the editable lists, uniform name selection,
gender, ordinary visits and reproducibility. `testing/vip-arrivals.test.js` checks
all three real transport cycles, return paths, the inset timeout, independent
camera state and fresh mine-return visits. `testing/town-visual-audit.test.js`
covers the building, traffic and cinematic regressions. The local
`/scripts/town-actor-review.html` uses production meshes to inspect gender variants,
VIP outfits and construction hammer grips.

The VIP review gallery in `output/vip-review/index.html` compares all eight eras,
three coordinated outfits per gender, normal-villager comparisons, arrivals,
wandering and departures with and without tags for every combination. The gallery is portable with its sibling PNG files. The
production arrival inset always includes the name; unnamed inset captures are
review comparisons only. Airport guests use the expanded lounge’s side exit
after stage two, keeping both outward and return paths clear of its footprint.

To reproduce the complete VIP image set, run Vite and use a fresh Playwright CLI
browser session with `scripts/capture-vip-review.js` as its `run-code` callback.
Then run `python3 scripts/package-vip-review.py`. Packaging checks all 468 required
images (96 character comparisons, 288 village scenes and 84 inset close-ups),
writes an offline gallery and image manifest, and creates `output/vip-review.zip`.
Additional overview captures already in the folder are preserved in the archive.

### NPC obstacle avoidance

`TownNavigation` supplies cached pedestrian detours for residents, VIPs, mounted
visitors, incident crews, construction workers and village animals. The existing
street graph still chooses cross-town routes; navigation adds local detours using
small authored circular footprints, with a body clearance margin. It does not
raycast meshes or create physics bodies.

When adding a solid street prop, call `walkObstacle(group, x, z, radius, height)`
where that prop is rendered. Coordinates are local to the group. Use the physical
base radius (or the half-diagonal for rectangular furniture), not the overhead
canopy. These markers survive geometry batching. Only mark props actually built
in that era; rebuilding the village replaces the index and cached routes, so
removed or underground infrastructure leaves no invisible obstacles.

Prepare walking paths when actors or routes are created. Use `prepareActorWalk`
for ordinary people, `navigation.route` for prepared manual routes, or `localWalk`
for translated construction scenes. Sample with `walkPose`; don't apply another
sidewalk offset afterward. Facing eases at corners while positions stay on the
clear segments. Runtime crowd separation also respects nearby static footprints.
`testing/town-navigation.test.js` covers continuous clearance, all era profiles,
manual actor routes, cache reuse and scenery removal.

### Village animals

`data/townAnimals.js` owns the bounded animal cast and completed-building outdoor
habitats. `TownAnimals` shares roaming, resting, feeding, flight and disturbance
handling; `TownAnimalModels` supplies articulated, instanced animal meshes. Dogs
and cats follow prepared street routes, hens forage around the farm entrance,
and occasional foxes and raccoons stay along the southern village outskirts.
Ground animals share pedestrian obstacle and traffic clearance. Wildlife turns
away from nearby people; pigeons take flight when people, pets or traffic approach.

Behavior reads era capabilities, not a separate chronology. Paved towns give
traffic more space and have less frequent wildlife visits. Feeders use the era's
villager wardrobe. Open-building landing spots come from completed habitats;
power-pole perches come from markers on the actual rendered grid. Underground
wiring therefore removes those perches automatically. Flights rise above the
built scenery before descending through a verified open landing column.

`TownAnimalSpace` adds geometry clearance to the authored navigation markers.
A cached, balanced triangle index includes each immutable scenery root and the
landscape, so fences, trees, planter boxes and merged Blender props are covered
without requiring additional hand-maintained footprints. It checks the animal's
full body envelope, repairs blocked route sections on a bounded local grid, and
rejects covered landing spots. Traffic corrections use the same geometry check.
Construction reveals reserve their finished bounds; moving machinery reserves
its swept volume. A crowded park can move the leashed dog walk to its open side.

Landing sites and grain targets sample their actual supporting floor from that
same index. Feeding reuses fourteen instanced grain meshes: each thrown grain
settles, disappears when a pigeon's beak reaches it, or expires after 2.4 seconds.
Consumed grains remain hidden until the next throw; the hidden effect does not
update its particle pool. Pigeon wing bars are faces of the wing mesh, and beaks
move rigidly with a head that pauses between pecks. Species-specific silhouettes
use cached geometry in `TownAnimalGeometries`, disposed with the diorama.

The cast, grain particles, route plans and habitat index are bounded and rebuilt
with the diorama. All routines use its clock, including pause and reduced motion;
they never change saves, earnings, objectives or puzzle moves. Add outdoor
habitats to the definition and mark new perch geometry with local
`userData.animalPerches` coordinates. `testing/town-animals.test.js` covers every
era, a synthetic successor, missing scenery, continuous routes, feeding and grain
consumption/expiry with bounded instance counts,
disturbances, frozen clocks and a long simulation without scene growth.
`testing/town-animal-clearance.test.js` builds the production scenery at initial
and final building tiers in every era and checks both prepared segments and
animated animal positions, plus thin unmarked fences, covered landings, solid
interiors, moving scenery reservations and traffic displacement.
