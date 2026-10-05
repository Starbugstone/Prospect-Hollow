# Prospect Hollow contributor rules

## Permanent gameplay rule: no move limits

The user has explicitly required unlimited puzzle moves. All contributors and
agents must preserve this rule unless the user explicitly reverses it.

- Never add move or turn caps, move-exhaustion failure, forced restarts, or any
  condition that blocks puzzle completion because a move count was reached.
- This applies to the normal campaign, every current and future chapter, side
  quests, and replays. Do not simulate unlimited moves with a large finite
  `maxMoves` value: gameplay must have no move budget.
- Never add a hard puzzle timer that prevents continued play or normal puzzle
  completion. Existing optional speed and score bonus thresholds may be missed;
  the player must remain able to continue and complete the puzzle normally.
- A recorded move count or elapsed time is a statistic, not a failure condition.
  Difficulty must come from coherent layouts, objectives, and mechanic
  combinations, while puzzles remain solvable with unlimited moves.
- A board with no legal match must remain recoverable, for example through the
  existing free reshuffle. Lack of a legal match is not move-budget exhaustion.
- Building construction measured in completed puzzles is allowed. For example,
  two completed puzzles to construct a landmark is a construction duration, not
  a cap on moves inside either puzzle.
- The user also explicitly permits optional event preparation countdowns with a
  completed-normal-puzzle budget and a persistent real elapsed-time deadline
  (including time away), whichever is reached first. These start only when the
  player accepts the event and are separate from
  move counts within a puzzle. They must never interrupt or fail an active puzzle,
  change its normal earnings, or block campaign progression. Budgets and expiry
  outcomes require their own agreed event design; do not infer
  a time cap for the puzzle from permission to time an optional event.
- Finite headless test budgets and runaway-cascade guards are diagnostics or
  technical protections, not gameplay move caps. Never expose them as a move
  allowance or use them to force a player to restart a puzzle.

When changing puzzle progression, preserve and run the regression coverage in
`testing/chapter-progression.test.js`, including matching beyond 100 moves after
the optional speed target has elapsed. Extend relevant regression coverage if a
new mechanic creates another route that might accidentally gate completion.

## Maintainable era and feature evolution

Keep repeated era configuration in one authoritative definition. When several
call sites express the same capability or rule, use a shared contract, helper or
factory so adding an era does not require repeating the same edits throughout
the game. Prefer the simplest abstraction that removes real duplication; do not
force class interfaces into JavaScript or abstract code with only one use.

Preserve existing gameplay, rewards and unlimited moves while refactoring.
Cover shared behavior and extension to a new era with meaningful regression
tests, including fallback behavior for unsupported or incomplete definitions.

Apply the same principle to shared feature lifecycles: future events, progression
tracking and cinematic presentation should use common contracts and lifecycle
helpers instead of duplicating state transitions, persistence or presentation
pipelines for each building. Keep feature-specific content in definitions and
reuse the shared implementation where behavior is the same. See
[the era architecture guide](docs/era-architecture.md) for the current contracts,
renderer registries and extension checks.

## Permanent board rule: completed obstacles leave no icon

The user requires that once the player completes a board obstacle, its icon
leaves the board. This is a hard rule for every current and future mechanic.

- A lit lantern or survey marker, a fired spore relay, a spent charge core, a
  collected fossil, a cut root knot, a broken seal, gate or stone, melted ice,
  a released chain and a thawed gem all render as an ordinary cell. Relic exits
  disappear once the last relic is delivered.
- Never keep a dimmed icon, a check mark, a tint or a coloured border on a
  completed cell. A short break or collection effect is fine, as long as it
  goes away.
- Every obstacle in `src/data/obstacles.js` needs a sample in
  `testing/completed-board-markers.test.js`; the test fails until a new obstacle
  has one, then checks that its completed cell matches a plain one.

## Town Honours: fixed ranks that grow with the game

Town Honours are families of metal ranks (bronze → silver → gold, then diamond and later
metals) defined in `src/data/honours.js`. The game will gain eras, levels and mechanics, so
no honour may treat the current content as final.

- A shipped rank's requirement is fixed: its goal, measure and metal never change, and ranks
  are never removed or reordered. Content growth adds ranks at the end of a family (diamond
  and beyond) or new families. Requirements are fixed numbers or named milestones, never
  "all levels", "every era" or "the final era".
- `testing/fixtures/shipped-honour-ranks.json` records every shipped rank. Add new ranks to
  it in the same change; changing a shipped entry needs a raised requirement version and the
  user's explicit approval.
- Content changes need an honours decision in the same change: a new gem gets its family and
  goals, a new mine element a family or `NON_MASTERY_ELEMENTS`, a new era a Through the Ages
  rank or `NON_MILESTONE_ERAS`, a new bonus fusion a rank or `LATER_FUSIONS`. A new rank sets
  `since` to a raised `HONOURS_VERSION` so existing saves catch up and see it as new.
  Regenerate the level element index with `node scripts/export-honour-levels.mjs` and the
  server catalogs (`npm run export:save-rules`, `node scripts/export-public-content.mjs`)
  after changing levels or honours.
- Earned honours are permanent: never revoke, reset or re-evaluate them away, and keep the
  version they were earned under. Never reuse or rename an honour or family ID.
- Calibrate new goals with the campaign simulator and record the evidence in
  [the honours guide](docs/honours.md).
- The server verifies what it publishes from its own counters and the validated save
  (`backend/src/Honours.php`); keep the measure kinds of the game and the server in step.
- Honours never gate progression, rewards or puzzle completion, and never add move or time
  limits.
- Keep `testing/honours.test.js` passing; its coverage checks fail when a gem, era, fusion or
  mine element has no honours decision.

## Local checks run in Docker

The user requires every local check to run in Docker, never with the host's PHP
or Node. This covers tests, formatting, builds, Composer and PHP scripts. The
host PHP lacks required extensions (`intl`, `pcntl`, `pdo_*`), and these images
match CI and production. Run the commands from the repository root. `--user`
keeps generated files owned by you rather than root.

- Frontend, on Node 24 as in the Dockerfile's frontend stage. Use the same
  prefix for `npm run verify`, `npm run build`, `npm run format:check` or a
  single `npx vitest run <file>`:
  `docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:24-bookworm-slim npm test`
- Backend image, built from this repository's Dockerfile. Rebuild it after
  changing the Dockerfile or PHP extensions:
  `docker build --target runtime -t prospect-hollow-check .`
- Backend checks without a database, e.g. name moderation. For Composer, use
  `-e HOME=/tmp -w /src/backend --entrypoint composer`:
  `docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/src -w /src --entrypoint php prospect-hollow-check backend/tests/moderation.php`
- Backend checks with a database run against a throwaway PostgreSQL. Pick
  another container name and port if a parallel session already uses these:

  ```bash
  docker run -d --rm --name hollow-test-pg -e POSTGRES_USER=cascade -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cascade -p 127.0.0.1:55433:5432 postgres:17-bookworm
  docker run --rm --user "$(id -u):$(id -g)" --network host -v "$PWD":/src -w /src -e TEST_DATABASE_URL=postgresql://cascade:test@127.0.0.1:55433/cascade --entrypoint php prospect-hollow-check backend/tests/saves.php
  docker stop hollow-test-pg
  ```

  The same applies to `concurrency.php` and `release-health.php`.

- PHP formatting is part of Prettier (`@prettier/plugin-php`), so `npm run format:check`
  covers the backend too. Static analysis runs PHPStan (level 6, `backend/phpstan.neon`):
  `docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/src -w /src/backend --entrypoint composer prospect-hollow-check analyse`
