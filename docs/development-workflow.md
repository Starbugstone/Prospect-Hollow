# Game development workflow

Deliver a small playable change with evidence for its acceptance check. These
defaults apply without invoking a full orchestration workflow. Use only the
stages the change needs; ordinary edits do not need a review panel or a model.

## Start with observable behavior

Describe what the player should see or be able to do, the authoritative state
owner, and the check that would reject a broken implementation. Preserve the
permanent rules in [AGENTS.md](../AGENTS.md), including unlimited puzzle moves,
recoverable boards, permanent honours and shared settlement interaction.

For a bug, reproduce the failure before changing it. Keep its initial state,
seed, action sequence and expected result. For a feature, implement one complete
player action through state, presentation and persistence before expanding it.
Extend shared era and lifecycle definitions instead of copying implementations.

## Turn repeated mistakes into checks

Use a lint constraint or shared contract for architectural violations that can
be checked reliably. Use behavioral regressions for gameplay, timing, rewards,
persistence or input. Show that the check rejects the original failure and
accepts a valid case. Extend an existing check before adding a new mechanism.
A visual preference still needs visual review; source-text matching alone does
not establish what the player sees.

Existing examples include ESLint's shared town-controls imports and map-overlay
restrictions, and the completed-board-marker and honours coverage tests. Keep
comments explaining reasons or constraints that names cannot express. PR counts
and comment removal are not acceptance criteria.

## Reproduce and calibrate with the existing harness

Use [the project verification skill](../.agents/skills/verify-prospect-hollow/SKILL.md)
and its feature map for changed browser journeys. Check both the visible result
and persisted state where the change affects saving. Use synthetic accounts and
isolated test state. Record blocked journeys as blocked.

Run all local checks in Docker using the commands in [AGENTS.md](../AGENTS.md).
For level, star-target, scoring or bonus changes, run `npm run test:levels` as
required there; ordinary `npm test` and CI skip these slow simulations. The
[campaign simulator](../testing/helpers/campaignSimulation.js) already seeds its
random source. Retain seeds and report completion, reshuffles, scoring and
diagnostic-budget failures. A headless agent helps calibrate difficulty but does
not replace player feedback. Its finite test budget never becomes a move limit.

Documentation-only changes need content, link and formatting checks rather than
the application suite. Keep the verification map current when journeys change.

## Model consequential state transitions

Start with one named invariant. Good candidates are save-sync conflict handling,
reward application without duplication, construction completion across reload,
and cancellation of cinematic callbacks after leaving a scene. Optional event
expiry must preserve active puzzles and normal earnings under the agreed rules.

Use executable invariant checks first. If interleavings remain hard to cover,
consider a small TLA+ or equivalent model covering the relevant actions. Include
retries, offline/reload paths and wall-clock changes where the subsystem uses
them. Record state bounds, timing/fairness assumptions, code correspondence,
command and checked revision. Translate counterexamples into implementation
regressions. A passing bounded model establishes only its stated scope. Update
the model when the covered transition contract changes.

## Preserve and measure performance budgets

The [existing bundle gate](../scripts/check-bundle-budget.mjs) runs after the
production build. It limits game chunks, gives libraries separate ceilings,
checks their startup loading and rejects static mesh-catalog imports. It is not
a compressed first-download budget. Extend it only after measuring a startup
baseline and defining which resources and compression the new gate counts.

Profile representative busy towns and puzzle cascades before changing frame-loop
allocations. Reuse scratch objects, pools and caches where measurements justify
them. Introduce a hot-file convention only with a scoped automated check; keep
initialization and accepted-action work outside frame-allocation restrictions.
Keep raw frame-time and resource evidence with its environment and workload,
following [the rendering performance log](town-rendering-performance-log.md).
Headless simulations and emulated rendering do not establish phone performance.

Report the result, relevant checks actually run, and any verification limits.
Follow the existing branch and delivery rules in AGENTS.md.

## Source and adaptation

These defaults adapt [Poteto's game workflow post of 1 November 2026](https://x.com/poteto/status/2117043478140276847).
Its text was retrieved through the [FxTwitter mirror](https://api.fxtwitter.com/poteto/status/2117043478140276847).
The post describes bug-prevention lint rules, TLA+, allocation restrictions,
deterministic replay, build budgets and headless difficulty tuning. Its delivery
and performance figures are the author's reports, not measurements of this game.
Seeded tests here do not establish full production replay determinism. Server
replay validation and a replacement engine are separate product decisions.
