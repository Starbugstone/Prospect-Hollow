# Town personalisation

The town's **Personalise** tab contains Crest, Colours, Buildings and Distinctions.
Changes preview in the town and are committed together with Save changes. Undo
removes the preview. Construction purchases require a second confirmation showing
the total cost. Public visits use the same normalized appearance and renderer.

## Appearance contract

`town.personalisation` is versioned and bounded by `townPersonalisation.js`.
Missing data means original artwork, outfits and no banner or plaques. The crest
catalog contains 60 authored animal/symbol vectors; its shape, pattern and colours
are shared by the menu, hill banner and village cards. The emblem has an independent
colour; a small floating crest preview stays visible when the editor scrolls past
the main preview. Five material roles control one shared building palette, shown
on an example home. Residents always keep their individual era outfits.
Material references are replaced without modifying cached materials.

Existing buildings can receive permanent frontage choices before construction
(Personalise › Buildings).
Already-built legacy buildings retain their original design. Paint,
crest and earned plaques remain editable. Public player plaques are verified
against the owner's current distinctions; Town Honours come from server-verified
honours. Hidden or unearned distinction IDs are never rendered as earned plaques.

Appearance version 2 stores the shared palette in `paint.all`, including for future
buildings and ordinary landmarks. Monuments retain their authored colours. Legacy
per-building paint is migrated by preferring the home's colour for each role,
then the first saved colour in building/landmark catalog order. An explicitly empty
shared palette preserves a reset. Legacy clothing overrides are discarded. Missing
or invalid `crest.emblemColour` uses the original dark ink. PHP normalization and
public town projection follow the same rules.

## Monument sites

`townLandmarks.js` owns eleven spacious monument sites, one introduced in each era.
Monuments are optional: they give no economic bonus, never gate an era and can be
built at any time once their site opens. **A site's first monument is permanent.**
No other design can replace it, on the client or in the server replay.

Monument sites follow the same interaction as every other building:

- Each unlocked site without a monument shows an open-site marker in the town (a
  gravel court, kerb stones, survey stakes and an empty plinth) and a dashed gold map
  label. Tapping the marker or label opens the site's card (`TownMonumentSite.vue`).
  The default overview frames every unlocked site.
- The card lists the site's designs with artwork, description and price. Choosing
  one previews it on the site in the town, even when the player cannot afford it
  yet. Nothing is spent until the player confirms a second, explicit "for good"
  step that explains the choice is permanent.
- A built monument keeps its label and card. Ordinary sites grow by three paid
  stages per era (through the current final era, with no hardcoded completion era);
  each stage adds detail and never changes the design. Upgrades are one tap, like
  building improvements.
- The Build tab lists every unlocked site under **Monuments** (open sites with their
  starting price, built ones with their stage or next upgrade price) and names the
  next site to open. Personalise only points to monument sites; it no longer sells
  them.
- Visitors see built monuments and can open a read-only card; open sites have no
  label for them.

The third-era site is Monument Square. Its five timeless models have separate
prices: Founders' Arch (6,000), Crystal Spire (8,000), Guardian of the Hollow
(10,000), World Tree (12,000), Celestial Sphere (15,000). Every player in Industrial
or later may build one. Timeless monuments have no upgrades and ignore era, crest
and paint changes. The first monument purchase earns the single gold Town Honour
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
rejected replacements in every later era, insufficient funds, stale commands, save normalization, visitors, shared paint and individual outfits
across eras. Actual frontend purchase flows for every parcel are replayed by
`backend/tests/save-integrity.php`. Keep the ordinary chapter progression tests,
including unlimited moves, alongside these checks.
