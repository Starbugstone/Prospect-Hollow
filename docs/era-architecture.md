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
