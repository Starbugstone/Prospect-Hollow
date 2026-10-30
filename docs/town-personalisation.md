# Town personalisation

The town's **Personalise** tab contains Crest and Distinctions. Changes preview in
the town and are committed together with Save changes, which closes the window
after a successful save. Undo removes the preview; a failed save keeps the editor
open. Public visits use the same normalized appearance and renderer.

## Appearance contract

`town.personalisation` version 3 retains the crest, paid landmark ownership and
stages, and one optional earned plaque at `plaques.mine`. Legacy building palettes,
frontage styles, clothing overrides and plaques on other buildings are discarded
by both client and server normalization. Buildings keep their authored artwork;
there are no painting passes, preview directives or frontage geometry overrides.

The crest catalog contains 60 authored animal/symbol vectors. Shape, pattern,
colours and independent emblem ink are shared by the menu, hill banner and village
cards. Missing or invalid emblem ink uses the original dark ink. The banner's
small cloth mesh gently ripples below its fixed crossbar in the existing town
animation loop. It uses the animated render layer, preserving static town batches
and the cached background. Pause, hidden views and reduced motion freeze it;
replacing or removing a banner retires its animation and owned resources.
`TownEmblems.buildTownFlag()` also supplies the flag preserved inside the Moon's
First Footprints monument, held still beneath its dome. The monument and its SVG
previews show the current town crest; changing or removing it refreshes the Moon
site. Towns without a supported crest retain the original mission pennant.

The distinction plaque sits on the central mine rock face above the sunken shaft.
It has its own scenery cache entry, so changing it or the crest never rebuilds
ordinary buildings. Public player plaques are verified against the owner's current
distinctions; Town Honours come from server-verified honours. Hidden or unearned
IDs are never rendered as earned plaques. The plate shows the badge exactly as the
honours list draws it (`honourBadgeImage.js` renders `HonourBadge` to a texture), and
tapping the plaque names the honour or distinction above it until the next tap.

## Monument sites

`townLandmarks.js` owns thirteen spacious monument sites: ten in the valley and three on the Moon. Coin sites open every other era
(Frontier, Industrial, Motor Age, Music & Television, Tomorrow City, Riverlight,
Stargazer and Twin Hollows),
so the town gets variety without a monument for every era. Two additional resource
sites open in Twin Hollows for saved moonstones. Each era site offers
three designs drawn from what that era brings to the town:

| Era                 | Site                    | Designs                                                       |
| ------------------- | ----------------------- | ------------------------------------------------------------- |
| Frontier            | Founders' Meadow        | Prospectors' Headframe, Wind Garden, Founders' Longhall       |
| Motor Age           | Promenade               | Sunburst Filling Station, Chrome Diner, Terminus Clock        |
| Music & Television  | Arts Quarter            | Music Shell, Big Screen, Signal Spire                         |
| Tomorrow City       | Horizon Park            | Orbit House, Solar Crown, Maglev Loop                         |
| Riverlight          | Riverlight Court        | Warm Spring Terraces, Garden of Light, Lotus Pavilion         |
| Stargazer           | Stargazers’ Lawn        | Orrery Garden, Comet Arch, Aurora Dome                        |
| Twin Hollows        | Homecoming Green        | Twin-lantern Walk, Earth and Moon Garden, Family Welcome Arch |
| Twin Hollows        | Moonstone Garden        | Moonstone Fountain, Homeward Obelisk, Lunar Crystal Pavilion  |
| Twin Hollows (Moon) | Moonrock Court          | Moonstone Henge, Earthlight Spire, Crater Amphitheatre        |
| Twin Hollows (Moon) | Earthrise Plaza         | First Footprints, Earthrise Arch, Orbital Beacon              |
| Twin Hollows (Moon) | Earthlight Conservatory | Earthlight Orchard, Crystal Nursery, Earthlight Bakehouse     |
| Twin Hollows        | Homecoming Commons      | Story Hall, Homecoming Bandstand, Wild Meadow                 |

The Earthlight Conservatory and the Homecoming Commons are commissions
(`src/data/commissions.js`). Each opens with a finished building level (`opens`), a letter asks
what to build, and the permanent outcome sets who visits: the Moon's residents walk a public path
to its door, and the valley's come to the site's perimeter. Each costs five even stages of 400,000
coins and never gates an era or puzzle. `commissionStatus()` drives the one signal that a commission
is active: a light pill beside the town project (`TownCommissionGoal`), the same pill in the Build
sheet and a letter action icon over a site awaiting its choice. `testing/browser/town-commission-signal.cjs`
checks every state in the real game, on desktop and phone, in English and French.

Every design has its own silhouette (`form`) and card artwork; no two designs share
one. A later era with a valley site skips at least one era after the previous valley site, and its
designs must come from that era's own story and buildings.
Earthrise Plaza opens with the buildable New Hollow lots in Twin Hollows. Its
`settlement: 'moon'` declaration places it at `[0, -33]`, radius 7, beyond the ring
road and clear of lot approaches and rover routes. The valley scene, terrain,
labels and wildlife use `areasForSettlement()`; the Moon uses the same helper with
`'moon'`. Save normalization and purchases retain the complete catalog. The Moon
button opens the shared `TownMonumentSite` card, including preview, permanent
choice, coin prices (31,000 / 32,000 / 33,000), five milestones, saved construction,
and replay. `MoonMonuments.js` draws the same works and adapts the shared unveiling
to suited visitors, lunar ground and the Moon camera. SVG fallback uses
`TownMoonMonument.vue` and the shared preview artwork. The Moon designs replace
open-water fountains and valley colonnades with solar wings, lamps and moonstone
crowns; each tier stays below 6,000 triangles and eight materials.

Sites declare `currency`, defaulting to `'coins'` for historical definitions.
`landmarkPayment(town, area, price)` owns the icon, balance, affordability, shortfall
and spend operation used by the card, Build list and purchase path. It delegates
to the shared `townCurrency` contract for coins and moonstones. Unknown currencies
reject purchases on both client and server. Moonstone Garden (valley, `[48, -102]`)
and Moonrock Court (Moon, `[-16, -30]`) open in Twin Hollows. Their six designs
cost 20 moonstones each for the foundation; upgrades cost 30 / 40 / 50 / 60
moonstones, for 200 per finished wonder. Both sites use the same five levels,
construction, permanent choice and unveiling as coin monuments.
See [moonstone calibration](moonstones.md#phase-2-optional-moonstone-monuments).
No receipt can substitute coins, change the catalog price, or spend moonstones
separately from granting ownership. Existing coin and legacy receipts keep their
prices and behavior.

Honours decision: the shipped **A Lasting Legacy** requirement specifically
measures ownership of `monument` (Monument Square), rather than a count of sites.
Ownership of Earthrise Plaza alone does not earn it or change its requirement.
The later **Landmark Patron** family (honours version 5) counts paid foundations
at its fixed named sites, including Earthrise Plaza, Moonstone Garden and
Moonrock Court. See [Town Honours](honours.md) for its ranks and calibration.

Only the timeless Monument Square stands in front of the town. Every other valley site lies
beyond the railway, in two rows behind the mine ridge and a column west of the
airport's approach. Founders' Meadow sits on the river's west bank beyond the ridge.
That leaves the space elevator and Skyward parcels room across the track.
`testing/monument-site-layout.test.js` keeps new sites behind the railway, on level
ground, off the river banks, roads and parcels and out of the approach.

Every design is authored with its entrance, fountain court and porches facing south
(+z, toward the town). A site may declare a `facing` (`south`, `east`, `north` or
`west`) in the `plots` table; `buildPersonalAreas` turns the whole site, open marker or
monument, to face it. Founders' Meadow faces east, across the river. Missing or unknown
facings face south.
Monuments are optional: they give no economic bonus, never gate an era and can be
built at any time once their site opens. **A site's first monument is permanent.**
No other design can replace it, on the client or in the server replay.

Monument sites follow the same interaction as every other building:

- Each unlocked site without a monument shows an open-site marker in the town (a
  gravel court, kerb stones, survey stakes and an empty plinth). Monument sites have
  no map labels. Tapping the marker or monument opens the site's card
  (`TownMonumentSite.vue`). The default overview frames every unlocked site.
- The card lists the site's designs with artwork, description and price. Choosing
  one previews it on the site in the town, even when the player cannot afford it
  yet. Nothing is spent until the player confirms a second, explicit "for good"
  step that explains the choice is permanent.
- A built monument has five permanent levels, available as soon as its site opens:
  Foundation, Grand court, Living landmark, Great monument and Town wonder.
  Prices are 1×, 4×, 10×, 20× and 35× the design's base price. These optional
  long-term projects never gate progression and future eras add no extra levels.
  Level two adds pavilions, three introduces motion and fountain displays, four
  adds a grand colonnade, and five completes the ceremonial entrance and fountains.
  Main structures rise substantially through the five levels. Moving mechanisms
  remain specific to the design (winding wheels, solar petals, pods, planets, etc.).
- Existing paid stage numbers stay in saves and verified receipts; models above
  five display the complete wonder. No purchased choice or honour is removed.
  New receipts carry `monumentVersion: 2`; unversioned receipts replay the old
  era ceilings and prices, preserving offline purchases and existing checkpoints.
- The Build tab lists every unlocked site under **Monuments** (open sites with their
  starting price, built ones with their stage, construction progress or next upgrade
  price) and names the next site to open. Monument purchases are separate from
  Personalise.
- Visitors see built monuments, including any scaffolding, and can open a read-only card.

### Construction and unveiling

Like a wonder in Civilization, every paid monument level is built over completed
puzzles and then unveiled. The puzzle counts live in `LANDMARK_PROGRESSION.levels`
(`puzzles`: 3, 1, 1, 1, 1): the foundation takes three puzzles and every upgrade after it
one. Timeless monuments build like a foundation (3). Progress saved under a longer build
(for example 2 of 2 before upgrades took one puzzle) is kept as ready to unveil, so the
player still sees its unveiling.

- Any completed puzzle counts, replays included, and advances every monument under
  construction by one step (`advanceMonumentWorks`, in the same completion transaction
  as building projects). The victory screen reports each monument's progress and
  names any that are ready to unveil. Construction is a duration in completed puzzles,
  never a move or time limit, and never gates an era, reward or puzzle.
- The paid level counts at once: price, honours (A Lasting Legacy) and `areaLevels`
  never wait for construction. One level is built at a time; the next upgrade is
  offered once the current one is unveiled.
- The town shows a new step after every puzzle (`TownMonumentWorks.js`). A first level
  rises from its foundation in courses inside scaffolding, with building materials
  and a crane. A later level keeps the standing monument inside growing scaffolding.
  A ready level stands complete, still and wrapped, with bunting and an opening
  ribbon. Steel scaffolding replaces timber from the industrial era.
- The player unveils a ready level from its card (`unveilMonument`). The commit comes
  first, then `monumentPresentation` plays through the shared town presentation
  pipeline (`TownMonumentUnveiling`): the scaffolding comes down around the real
  monument, the ribbon is cut and townsfolk gather, Willowkin among them once they
  live in town, under confetti. The first level, the town wonder and every timeless
  monument get the 16-second grand version; levels two to four get a 7-second reveal.
  The scene is skippable, honours reduced motion, and can be replayed from the card.
- The unveiling plays “Thaxted (Holst)” by Kevin MacLeod (CC BY 4.0, credited in
  `public/sound/village/credits.html`, prepared by `scripts/prepare-monument-music.mjs`)
  in place of the village music. It is never loaded while music is muted.
- `personalisation.construction` stores `{ [site]: { level, wins } }`. It is cosmetic:
  the server keeps it through the same normalization as the client
  (`TownPersonalisation::normalize`) and publishes it to visitors, but does not replay
  it. Only the latest paid level of a built site, up to the fifth, can be under
  construction; any other entry, and every monument bought before construction
  existed, shows the finished monument.

The Industrial site is Monument Square. Its five timeless models have separate
prices: Founders' Arch (6,000), Crystal Spire (8,000), Guardian of the Hollow
(10,000), World Tree (12,000), Celestial Sphere (15,000). Every player in Industrial
or later may build one. Timeless monuments have no upgrades and retain their identity. All five animate immediately: a sunwheel, crystal motes, mechanical owl wings, hanging tree ornaments or orbital rings, with a fountain court. The first monument purchase earns the single gold Town Honour
**A Lasting Legacy**, regardless of the model; older monument-owning saves receive
it through honours generation 2 catch-up. The server verifies ownership from the
paid landmark replay before publishing this distinction. Saves that replaced their
monument before replacements were removed keep the monument they own now.

Monument Square's five sculptures are authored in Blender rather than assembled
from the town's coarse rock primitives. `scripts/create-monument-assets.py` writes
the editable `art/monuments/monuments.blend`, GLB interchange export, source review
sheet, indexed runtime meshes and transparent choice-card portraits. Run Blender
in background mode with the script and the repository directory after `--`.
The `monuments` family loads only for towns that own a Monument Square choice,
including one under construction. Static surfaces use the existing scenery batch;
named wing, sun, mote, pendant and orbital joints use the shared motion and actor
pipeline. The three merged brass orbits each cost one animated draw. Missing mesh
downloads retain the procedural fallback. Prices, saved choice IDs, construction,
honours and unlimited puzzle moves are unchanged.

`testing/monument-sculptures.test.js` checks imports, normals, indices, caching,
animation bounds, construction poses, portraits and unavailable downloads.
`testing/browser/monument-sculptures.cjs` captures front and back views in the
actual Three.js renderer with valley lighting; run it through the same Docker
Playwright setup as the [Moon input check](future-eras.md#moon-input-check).

All monument fountain courts use `TownMonumentFountain`: a continuous carved bowl,
recessed pool, turned pedestal and raised cup, with six curved translucent streams.
The geometry is authored directly as cached lathe and tube meshes; it needs no
separate asset download. Droplets follow the stream paths and landing ripples
expand into the pool through `createLandmarkMotion.update`, so construction and
reduced motion hold the same deterministic pose as other monument mechanisms.
Streams share one transparent mesh per court; droplets and ripples share actor
instances. `testing/monument-fountains.test.js` covers every eligible design and
milestone, flow containment, construction holds and geometry disposal. The browser
review also captures close-ups of the main and smaller era fountains.

`areas` stores one selected ID per site and `areaLevels` its purchased stage.
Commands include expected previous choice/stage, preventing duplicate or stale
purchases. The campaign store atomically commits the debit and journal receipt.
The server replays `landmark-buy` against its exported prices and compares both
coins and landmark ownership/stages, rejecting any replacement. Cosmetic save edits
cannot acquire a free monument. Existing checkpoint/retry semantics apply to these
receipts.

## Extending and checking

Add options/parcels to the shared catalog, use `buildLandmark` forms or add a new
silhouette, and provide matching menu artwork and French labels. Export
`public-schema.json` and regenerate integrity fixtures in Docker. Parcel radii
are shared with terrain reservation, navigation obstacles and camera framing.

Regression coverage checks all choices and upgrade stages, parcel/river/building
clearances, open-site markers for unlocked eras only, timeless monument geometry,
rejected replacements in every later era, insufficient funds, stale commands, save
normalization, visitors, removal of retired cosmetics, mine-only badges, flag motion
and resource cleanup, and individual outfits across eras.
`testing/monument-construction.test.js` covers the puzzle counts of every level, one
level at a time, damaged or legacy construction, progress and unveiling through the
campaign store and a reload, every construction step of every design staying on its
site, the unveiling scene and its cleanup, and the cards. Actual frontend purchase
flows for every parcel, with the puzzles that build each level and its unveiling,
are replayed by `backend/tests/save-integrity.php`. Keep the ordinary chapter
progression tests, including unlimited moves, alongside these checks.

Monument movement uses the existing `TownScenery` lifecycle. Only moving groups
are excluded from static batching; updates reuse geometry/materials and are
removed on rebuild/disposal. Reduced-motion preference freezes the authored pose.
The SVG cards show purchased stages and disable their animation for reduced motion.
