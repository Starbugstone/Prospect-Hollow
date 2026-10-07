# Town personalisation

The town's **Personalise** tab contains Crest, Colours, Buildings and Distinctions.
Changes preview in the town and are committed together with Save changes. Undo
removes the preview. Construction purchases require a second confirmation showing
the total cost. Public visits use the same normalized appearance and renderer.

## Appearance contract

`town.personalisation` is versioned and bounded by `townPersonalisation.js`.
Missing data means original artwork, outfits and no banner or plaques. The crest
catalog contains 60 authored animal/symbol vectors; its shape, pattern and colours
are shared by the menu, hill banner and village cards. Five material roles control
building paint; four clothing roles leave skin, uniforms and visiting guests alone.
Material references are replaced without modifying cached materials.

Existing buildings can receive permanent frontage choices before construction.
Already-built legacy buildings retain their original design. Paint, clothing,
crest and earned plaques remain editable. Public player plaques are verified
against the owner's current distinctions; Town Honours come from server-verified
honours. Hidden or unearned distinction IDs are never rendered as earned plaques.

## Optional landmark plots

`townLandmarks.js` owns fifteen spacious parcels, one introduced in each era. Each
ordinary parcel has three architectural choices, with three paid stages per era
through the current final era. New eras extend the shared stage calculation;
there is no hardcoded final-era completion requirement. Earlier-stage architecture
is retained until upgraded. Landmark purchases and upgrades are immediate and
optional, provide no economic bonuses, and never affect era progression.

The third-era parcel is Monument Square. Five permanent architectural models have
separate prices: Founders' Arch (6,000), Crystal Spire (8,000), Guardian of the
Hollow (10,000), World Tree (12,000), Celestial Sphere (15,000). Every player in
Industrial or later may build one. A replacement costs the full listed price of
the new monument, with no refund; buying the currently selected monument is
rejected. Monuments have no upgrades and ignore era, crest and paint changes.
The first successful monument purchase earns the single gold Town Honour **A Lasting
Legacy**, regardless of the selected model. Replacements preserve its original award;
older monument-owning saves receive it through honours generation 2 catch-up. The server
verifies ownership from the paid landmark replay before publishing this distinction.
These are initial prices for playtesting; normal landmark upgrade prices are the
base price multiplied by the relative era tier.

`areas` stores one selected ID per parcel and `areaLevels` its purchased stage.
Commands include expected previous choice/stage, preventing duplicate or stale
purchases. The campaign store atomically commits the debit and journal receipt.
The server replays `landmark-buy` against its exported prices and compares both
coins and landmark ownership/stages. Cosmetic save edits cannot acquire a free
monument. Existing checkpoint/retry semantics apply to these receipts.

## Extending and checking

Add options/parcels to the shared catalog, use `buildLandmark` forms or add a new
silhouette, and provide matching menu artwork and French labels. Export
`public-schema.json` and regenerate integrity fixtures in Docker. Parcel radii
are shared with terrain reservation, navigation obstacles and camera framing.

Regression coverage checks all choices and upgrade stages, parcel/river/building
clearances, timeless monument geometry, full-price replacement, insufficient
funds, stale commands, save normalization, visitors, paint isolation and clothing
across eras. Actual frontend purchase flows for every parcel are replayed by
`backend/tests/save-integrity.php`. Keep the ordinary chapter progression tests,
including unlimited moves, alongside these checks.
