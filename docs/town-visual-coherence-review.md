# Town visual coherence review

This change follows a 15-era inspection of 804 building/era sheets, 2,382
stage render requests and 4,764 front/reverse views against production `823e971`.
Requests include repeated retained Twin Hollows finishes; they are not all
distinct purchasable upgrades.
The normalized inventory contains 39 root-cause families from 44 source findings.

The full local review, including every finding, matched actual-renderer images,
tier and handover strips, navigation overlays and performance evidence, is at
`/home/stone/dev/town-visual-audit-2026-10-21/report.html`. Its `findings.json`,
`findings.md`, `validation.json`, `performance.json` and
`mature-module-budget.json` are the machine-readable and text evidence. Scratch
concepts in `proposals/` are superseded; `implemented/` contains real renderer
comparisons. No account or personal information is used in the fixtures.

Completed structures and one mature purpose module survive modernization. New
finish grades refit the same module rather than adding rooms indefinitely.
`buildingStages()` and `heritageUpgrade()` are shared by WebGL and SVG.
Purpose structures keep the same reserved parcel envelope across paid finishes;
physical signs use supported mounts and visible lettering. Road setbacks, clear
entrance approaches, station/rail/bridge clearance and regenerated footprints
are acceptance gates. See [the era architecture guide](era-architecture.md).

The footprint generation/check pipeline also owns numeric mature setback
envelopes. Shipped plots use those numbers directly; missing definitions keep
the memoized safe probe fallback. Animal roaming preparation caches exact point
answers only while navigation and geometry remain unchanged, and rejects far
roads by conservative bounds before the existing exact distance check. These
optimizations preserve collision solids and the reviewed visual geometry.
Physical sign mounts are generated in that same pass and payload. Runtime input
validation preserves the exact authored mount and falls back to the existing
surface/visibility resolver for custom or missing definitions; shipped plots
avoid that repeated raycasting during cold loads and construction swaps.

Moon entrance spokes use shared authored hatch/stair anchors, join the existing
ring and reserve their corridors from craters. Moon walkers and rovers continue
to use their existing decorative ring circulation.

Retained residents, workers, transport VIPs and live visitors are revalidated
once after navigation is rebuilt, before the first render. Only positions inside
new solids move, to a nearby safe point on the same street side; identities and
visit/work state survive. Actor positions are runtime state, not serialized save
fields. Regression fixtures use the old geometry's clear positions.

The aircraft work is coordinated on Claude's separate branch. This change keeps
its imported model exports, palette keys and airport hangar opening unchanged.
It does not change puzzle rules, rewards or unlimited moves.

Deferred art direction remains explicit in the inventory: sparse side/rear
facades, larger open-site finish steps, broader city shell variety and optional
future mill roof styling. Tall-building stage readability is only partly
improved. The Aviation home's final balcony furniture remains subtle at
overview scale; this is an accepted low-severity residual. A real-phone check
is still recommended for the existing mobile town stutter issue #54.

Other low, nonblocking residuals are explicit in the report: deliberate orbit
rings can read unsupported (later helper-level roof brackets are proposed), the
short Windsong side link lacks an upper hatch, inherited homestead porches use
stylized dimensions rather than a strict 1.8-metre door metric, and generic
scaffolding does not yet isolate the new purpose module. Ground approaches remain
required. The scaffolding note is source-only; this audit has no construction
screenshot and does not claim one.
