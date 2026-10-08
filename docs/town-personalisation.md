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

The distinction plaque sits on the central mine rock face above the sunken shaft.
It has its own scenery cache entry, so changing it or the crest never rebuilds
ordinary buildings. Public player plaques are verified against the owner's current
distinctions; Town Honours come from server-verified honours. Hidden or unearned
IDs are never rendered as earned plaques. The plate shows the badge exactly as the
honours list draws it (`honourBadgeImage.js` renders `HonourBadge` to a texture), and
tapping the plaque names the honour or distinction above it until the next tap.

## Monument sites

`townLandmarks.js` owns eight spacious monument sites. A site opens every other era
(Frontier, Industrial, Motor Age, Music & Television, Tomorrow City, Riverlight,
Stargazer and Twin Hollows),
so the town gets variety without a monument for every era. Each era site offers
three designs drawn from what that era brings to the town:

| Era                | Site             | Designs                                                       |
| ------------------ | ---------------- | ------------------------------------------------------------- |
| Frontier           | Founders' Meadow | Prospectors' Headframe, Wind Garden, Founders' Longhall       |
| Motor Age          | Promenade        | Sunburst Filling Station, Chrome Diner, Terminus Clock        |
| Music & Television | Arts Quarter     | Music Shell, Big Screen, Signal Spire                         |
| Tomorrow City      | Horizon Park     | Orbit House, Solar Crown, Maglev Loop                         |
| Riverlight         | Riverlight Court | Warm Spring Terraces, Garden of Light, Lotus Pavilion         |
| Stargazer          | Stargazers’ Lawn | Orrery Garden, Comet Arch, Aurora Dome                        |
| Twin Hollows       | Homecoming Green | Twin-lantern Walk, Earth and Moon Garden, Family Welcome Arch |

Every design has its own silhouette (`form`) and card artwork; no two designs share
one. A later era with a site skips at least one era after the previous site, and its
designs must come from that era's own story and buildings.
Only the timeless Monument Square stands in front of the town. Every other site lies
beyond the railway, in two rows behind the mine ridge and a column west of the
airport's approach. That leaves the space elevator and Skyward parcels room across the
track. `testing/monument-site-layout.test.js` keeps new sites behind the railway, on
level ground and out of the approach.
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
  starting price, built ones with their stage or next upgrade price) and names the
  next site to open. Monument purchases are separate from Personalise.
- Visitors see built monuments and can open a read-only card.

The Industrial site is Monument Square. Its five timeless models have separate
prices: Founders' Arch (6,000), Crystal Spire (8,000), Guardian of the Hollow
(10,000), World Tree (12,000), Celestial Sphere (15,000). Every player in Industrial
or later may build one. Timeless monuments have no upgrades and retain their identity. All five animate immediately: a sunwheel, crystal motes, mechanical owl wings, hanging tree ornaments or orbital rings, with a fountain court. The first monument purchase earns the single gold Town Honour
**A Lasting Legacy**, regardless of the model; older monument-owning saves receive
it through honours generation 2 catch-up. The server verifies ownership from the
paid landmark replay before publishing this distinction. Saves that replaced their
monument before replacements were removed keep the monument they own now.

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
and resource cleanup, and individual outfits across eras. Actual frontend purchase
flows for every parcel are replayed by
`backend/tests/save-integrity.php`. Keep the ordinary chapter progression tests,
including unlimited moves, alongside these checks.

Monument movement uses the existing `TownScenery` lifecycle. Only moving groups
are excluded from static batching; updates reuse geometry/materials and are
removed on rebuild/disposal. Reduced-motion preference freezes the authored pose.
The SVG cards show purchased stages and disable their animation for reduced motion.
