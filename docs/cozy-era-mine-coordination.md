# Cozy eras and deeper-mine coordination

This implementation follows the approved Canopy Age and Riverlight Age concept
art. Their canonical saved era identifiers are `canopy` (2100) and `riverlight`
(2140), following `tomorrow`. Both use the shared city evolution contract,
`architecture: 'cozy'`, and `cozyStyle: 'canopy' | 'riverlight'`.

## Ownership

- The cozy-era implementation owns era definitions, building catalogs and new
  plots, town art, residents, wildlife, cozy-era translations, mine **surface** profiles,
  surface rendering and the equivalent accessible SVG drawing.
- Deeper-mine work owns campaign chapter authoring, appended level definitions,
  new puzzle mechanics, their art, mine-guide translations and chapter-progression regression coverage.
  This town implementation does not edit those files.
- Preserve the concurrent work in `docs/mine-expansion-brainstorm.md` and
  `docs/images/mine-concepts/`. Those files are a separate design proposal, not
  an approved implementation contract.

Both implementations append entries to `src/i18n/fr.json`. Cozy-era entries are
the town implementation's ownership; deeper-mine names, guides, goals and
mechanic messages are the mine implementation's ownership. Re-read the current
file before patching and preserve the other work's entries. The shared file must
pass the complete translation check after both groups are integrated.

## Shared behavior

The inspected mine proposal begins after the existing level 372 and suggests
six chapters, levels 373–408. These proposed numbers are not a town-era gate:
town eras continue using the existing building completion/modernization gates.
Do not couple an era to an assumed final campaign count, add placeholder
levels, or renumber existing levels to reserve space for an era.

The concurrently integrated campaign currently appends **five** chapters,
levels **373–402**, from `src/data/deepMineLevels.js`. `campaign.js`,
`expansion.js` and `levelNames.js` import that shared content. This is the actual
runtime catalog; the earlier six-chapter brainstorm does not override it.
The generated `backend/content/public-schema.json` has been refreshed from the
client catalog and now includes the two cozy era identifiers, all six new
buildings and 402 authored puzzles. Regenerate it through
`scripts/export-public-content.mjs` if the mine campaign changes again.

Mine surface evolution is independent of puzzle mechanics, costs and rewards.
It retains the original portal decline, winding machinery, permanent workshop
sites, historical keystone, heritage wheel and mine cart route. Cozy additions
refit the existing sorting terrace and portal instead of occupying the road,
rail approach or open forecourt. Later cozy eras inherit their profile through
the shared `cozyStyle` capability; new mine mechanics need no separate surface
lifecycle.

Moves remain unlimited in every authored or continuous-play puzzle. Optional
speed thresholds affect bonuses only. Free dead-board recovery, normal rewards
and normal completion remain available after more than 100 moves and after the
optional speed target expires.

## Validation and handoff

Run all local checks in Docker as required by `AGENTS.md`. Surface work extends
mine profile and rendered clearance coverage, keeping the existing 6,000 static
triangle and 16 animated-object budgets. Campaign work must preserve and run
`testing/chapter-progression.test.js`, including its unlimited-move regression,
and cover every newly introduced route to completing objectives.

Docker evidence for the surface integration: 43 focused mine tests pass,
including rendered road/rail/forecourt clearances and construction cinematics.
Canopy and Riverlight retain 5,912 and 5,992 static triangles respectively.
The backend save API suite passes 192 assertions, including cozy-era shared-town
identity, all six buildings, modernization caps, retained older facades, wallet
privacy and unsupported-era fallback. The generic era-demo exporter generated
all 11 era fixtures without an era-specific script change.

The final backend audit rebuilt the `runtime` Docker image after the concurrent
SaveIntegrity changes. The production build and bundle budgets passed. The
rebuilt image's bundled public schema and save rules both include 402 levels,
all 11 eras and all six cozy buildings. Against a separate throwaway PostgreSQL,
the latest save API passed 192 assertions, save integrity passed 41 assertions,
concurrency passed 16 assertions and release readiness passed 7 assertions.
The test database container was stopped after the run. The external integrity
source and parity fixtures were inspected without modification.

Final integration exposed slow local saves from the concurrently added integrity
journal. The store now tracks replacement of its immutable journal without
creating reactive proxies for historical receipts. Local persistence copies
mutable gameplay once and serializes the same journal synchronously, retaining
the existing acknowledgement merge and transaction rollback. No server rule,
receipt format, accounting fixture or test timeout changed. The complete
402-level save/reload regression now verifies all 804 unique receipts survive.
The final Docker check passes 138 tests across campaign progression, integrity,
synchronization, cloud profiles and backups; the campaign replay completes in
8.33 seconds with its existing 15-second diagnostic timeout. Matching beyond
100 moves still completes normally after the optional speed target.

The full integration run started on 2026-10-02 at 17:53 UTC and collected 139
test files. It completed with 3,047 passing tests and 13 failures: seven unchanged
20-second historical-town cache timeouts, five deeper-mine presentation contract
failures and one translation test reporting six missing mine messages. All 30
town itinerary tests passed. The historical cache tests synchronously build and
repopulate complete towns through repeated construction cycles; the application
retains its existing staged preparation budget. Recheck those seven cases in
isolation with one Docker test worker before interpreting their timing as a
functional regression. No diagnostic timeout has been increased.

The subsequent isolated Docker run passes all 45 historical-town cache tests
with the original 20-second per-test timeouts unchanged (238.6 seconds total).

Concurrent mine work added or updated `src/game/phaser/BoardAnimator.js`,
`BoardGeometry.js`, `BoardInput.js` and `testing/board-topology.test.js` around
18:09 UTC, after that full run collected its tests. The town implementation is
applying formatting only to those files, preserving their content. The new
topology tests and latest presentation/translation contracts require a separate
Docker run or the mine writer's own verification; the earlier full-suite result
does not establish coverage of that later snapshot. Functional mine source,
authored levels and mechanic translations remain the mine writer's ownership.

A fresh one-worker Docker run at 18:19 UTC passes all 51 tests across the latest
deep-mine presentation (20), translations (9), board topology (19) and board
geometry (3). The mine writer has supplied both the six missing mechanic
messages and all 30 subsequently rewritten level tips in French. No source,
fixture or translation patch was needed to resolve the six earlier failures.

Please write shared source files atomically when preparing another mine change:
write the complete content to a temporary file beside its destination, then
rename it into place. A concurrent production build at 18:17 UTC read
`HintEngine.js` after it had been truncated to line 129 and before the writer
finished; the file was complete again before the fresh focused tests. Final
verification needs a stable source snapshot, and a passing run applies only to
the files it actually collected.

The latest one-worker Docker progression run started at 18:22 UTC and reports
70 passing tests and eight failures across `chapter-progression.test.js`,
`deep-mine-levels.test.js` and `deep-mine-mechanics.test.js` (66.79 seconds).
Chapter progression passes all six tests and deep mechanics passes all 28.
The original 372 configurations, seeds, names, rewards and stars retain their
recorded hash. All seven selected appended puzzles complete beyond 100 moves
after their optional speed targets; inventory-power completion and free
reshuffling regressions also pass. No campaign or mechanic source was edited
by the cozy-era mine surface work.

The mine writer still needs to reconcile eight level-design assertions with
the new shaped-board authoring. Two tests expect rectangular outer columns and
introductions without non-root blockers, which conflict with intentional voids,
encased fossils and blast-only gates. Five held-out pacing cases complete but
exceed the existing 100-turn diagnostic bound: levels 375 (163 turns), 376 (145),
378 (127), 390 (187) and 396 (109). The ordinary-level median is 40 turns against
the existing bound of 35. Preserve the checks while investigating the intended
new design and solver behavior; the town integration has not relaxed these
assertions, increased budgets or altered authored puzzles. Earlier progression
coverage passed before this layout rewrite, so it does not establish a fully
passing final mine snapshot.

The current T3 tool catalog provides preview, device and pull-request tools, but
no cross-thread agent messaging tool. This document is the shared repository
handoff while the two implementations progress. Do not overwrite the other
implementation's changes; re-read this contract and current chapter definitions
before integrating both branches or workspace changes.
