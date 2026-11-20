# Game development workflow

Deliver a small playable change with evidence for its acceptance check. These
defaults apply without invoking a full orchestration workflow. Use only the
stages the change needs; ordinary edits do not need a review panel or a model.

## Start with observable behavior

Describe what the player should see or be able to do, the authoritative state
owner, and the check that would reject a broken implementation. Preserve the
permanent rules in [AGENTS.md](../AGENTS.md), including unlimited puzzle moves,
recoverable boards, permanent honours and shared settlement interaction.

For a bug, reproduce the failure before changing it. Keep the smallest useful
regression fixture with the fix. For a feature, implement one complete player
action through state, presentation and persistence before expanding it. Extend
shared era and lifecycle definitions instead of copying implementations.

## Replay every puzzle failure

Each puzzle runs on its own seed, so it replays exactly from its level, seed and the
player's accepted moves. A bug report is that log, not a description. On preprod or
a dev build, **Copy this puzzle for a bug report** in Settings produces it, on a phone
too, and so does `prospectDebug.runLog()` in the console. To play one back:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app -e REPLAY_LOG=/app/output/report.json node:24-bookworm-slim npx vitest run testing/run-replay.test.js -t "bug report"
```

A pass means the board the player saw has been reproduced. Build the regression
from the log with `replayRun` in
[src/stores/game/runLog.js](../src/stores/game/runLog.js). Rule changes legitimately
invalidate old logs. A puzzle moved over from another tab has no replayable start, and
its log says so.

Puzzle rules roll `gameRandom`, enforced by ESLint and
[testing/run-replay.test.js](../testing/run-replay.test.js). Animation and sound keep
`Math.random`, so a sparkle can't shift a falling gem. Chest and shop rolls are not on
this seed: they already take an injected random source. The server doesn't replay
puzzles: replay here is a debugging tool, not an anti-cheat.

## Turn repeated mistakes into checks

Every issue found ends with something that catches it next time. Use a lint constraint
or shared contract for architectural violations that can be checked reliably. Use
behavioral regressions for gameplay, timing, rewards, persistence or input. Show that the
check rejects the original failure and accepts a valid case. Extend an existing check
before adding a new mechanism. A visual preference still needs visual review;
source-text matching alone does not establish what the player sees.

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

Each major state machine gets a checked model in `docs/models/<system>/`, starting
with [rewards across save sync](models/reward-sync/README.md). The next candidates are
construction completion across reload and cancelling cinematic callbacks after leaving
a scene. A model belongs with any change to the transitions it covers. Run all of them
with:

```sh
bash scripts/check-models.sh
```

Name `pass-*` configs that must hold, `mut-*` configs that break a guarantee on
purpose and must be caught, and `reach-*` configs that prove the risky cases are
explored. Include retries, offline and reload paths and wall-clock changes where the
subsystem uses them. Record state bounds, assumptions, code correspondence and the
checked commit in the model's README. A passing bounded model establishes only that
scope, so pair it with a test of the same guarantee on the real code. Replay any
counterexample against the implementation before calling it a game bug.

## Hold the performance and download budgets

**Frame cost:** [testing/browser/frame-budget.cjs](../testing/browser/frame-budget.cjs)
plays the busiest puzzle boards and looks round a fully developed town in a browser at
a 4x CPU slowdown, in place of a mid-range phone, and fails if the game's own script
time per frame gets worse. Run it after changing board or town frame code, with nothing
else busy, and after `npm run demo:eras`:

```sh
docker run -d --rm --name hollow-frames-web --user "$(id -u):$(id -g)" -e HOME=/tmp -p 127.0.0.1:8192:8192 -v "$PWD":/app -w /app node:24-bookworm-slim npm run dev -- --host 0.0.0.0 --port 8192 --strictPort
docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app mcr.microsoft.com/playwright:v1.55.0-noble sh -c 'npm i --no-save --silent --prefix /tmp/pw playwright@1.55.0 && PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright node testing/browser/frame-budget.cjs'
docker stop hollow-frames-web
```

A browser test can't measure a phone, so feel on a real phone remains a separate
check. Keep raw frame-time evidence with its environment and workload, following
[the rendering performance log](town-rendering-performance-log.md). Profile before
changing frame code, reusing scratch objects, pools and caches where measurements justify
them. A hot-file allocation rule isn't adopted: nothing measured yet shows garbage
collection is the problem, and it needs that evidence first.

**First download:** the [bundle gate](../scripts/check-bundle-budget.mjs) runs after the
production build. It limits game chunks, gives libraries separate ceilings, checks their
startup loading, rejects static mesh-catalog imports and limits the gzipped first
download. Raise a ceiling on purpose, with the new baseline in the performance log.

Report the result, relevant checks actually run, and any verification limits.
Follow the existing branch and delivery rules in AGENTS.md.

## Source and adaptation

These defaults adapt [Poteto's game workflow post of 1 November 2026](https://x.com/poteto/status/2117043478140276847).
Its text was retrieved through the [FxTwitter mirror](https://api.fxtwitter.com/poteto/status/2117043478140276847).
The post describes bug-prevention lint rules, TLA+, allocation restrictions,
deterministic replay, build budgets and headless difficulty tuning. Its delivery
and performance figures are the author's reports, not measurements of this game.
Its comment ban and per-file allocation rule aren't adopted. Server replay validation
and a replacement engine are separate product decisions.
